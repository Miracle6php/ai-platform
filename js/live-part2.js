import {
    LIVE_DEBUG,
    showLiveDiagnostic,
    formatLiveError,
    logDetailedLiveError,
    getModelFps,
    describeModel,
    describeDecartError,
    startWebSocketTimingWatch,
    installWebRTCDiagnostics
} from "./live-diagnostics.js";

import {
    liveState,
    LUCY_MODEL,
    LUCY_WIDTH,
    LUCY_HEIGHT,
    LUCY_FPS,
    LUCY_PROMPT,
    PHONE_AUDIO_TEST_MODE,
    $,
    safeText,
    show,
    hide,
    setDisabled,
    getCameraTrack,
    getMicrophoneTrack,
    startLiveDiagnostics,
    stopLiveDiagnostics,
    showStudioToast,
    showToast,
    readInitialCredits,
    updateCreditDisplays,
    getCurrentRate,
    updateUsageRate,
    updateReferencePanels,
    startCamera,
    stopCamera,
    updateCameraToggleButton,
    toggleCamera,
    startMicrophone,
    stopMicrophone,
    updateMicrophoneStatus,
    startAudioMonitor,
    stopAudioMonitor,
    setFaceReference,
    removeFaceReference,
    setVoiceReference,
    removeVoiceReference,
    hasRequiredReference,
    updateGoLiveAvailability,
    setMode,
    updateQuality,
    refreshPermissionStatus,
    requestCameraPermission,
    requestMicrophonePermission,
    openDevicePermissionPanel,
    openDevicePermissionPanelAndRequestCamera,
    loadDecartSDK,
    ensureLucyModel,
    createLucyInputStream,
    stopLucyInputStream,
    formatDuration
} from "./live-part1.js";

/*
|--------------------------------------------------------------------------
| live-part2.js
|--------------------------------------------------------------------------
| Second half of the split live.js. This file imports everything it needs
| from live-part1.js (which in turn imports live-diagnostics.js), so the
| HTML only needs to reference THIS file:
|
|   <script type="module" src="js/live-part2.js"></script>
|
| The browser resolves the "./live-part1.js" import automatically -- you
| do not need a separate <script> tag for live-part1.js.
|
| This file contains the actual Lucy connect/disconnect logic, session
| timers, session start/stop, streaming button stubs, event wiring, and
| init().
|
| UPDATES IN THIS VERSION:
|   - Face mode is video-only: the microphone is not started, not
|     monitored, and not sent to Lucy. Voice / face+voice still use it.
|   - connect() options match the SDK: removed onError/onDisconnect
|     (not real options, silently ignored), added onConnectionChange.
|   - prompt.enhance is false so the face-only prompt is used as written.
|   - WebSocket diagnostics no longer print the api_key in the logs.
|   - Added a "sessionEnded" listener after connect.
|
| REMINDER: the SDK loads a Web Worker file next to the bundle. After
| every build, copy it beside live.bundle.js, e.g.
|   cp node_modules/@decartai/sdk/dist/realtime/browser/frame-metadata-worker.js <web-root>/js/
|--------------------------------------------------------------------------
*/

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

// Face mode sends camera video only. Any other mode still needs the mic.
function modeNeedsMicrophone() {
    return liveState.currentMode !== "face";
}

// Strips the api_key query value so temporary tokens never appear in the
// on-screen diagnostics or in anything the user copies out of them.
function redactUrl(url) {
    try {
        return String(url).replace(/(api_key=)[^&]+/gi, "$1[redacted]");
    } catch (_) {
        return "[url]";
    }
}

/*
|--------------------------------------------------------------------------
| DEBUG: raw WebSocket close/error interceptor
|--------------------------------------------------------------------------
| The Decart SDK wraps its signaling WebSocket in a retry layer that, on
| failure, sometimes throws a plain object instead of a real Error --
| p-retry then just logs "Non-error was thrown: [object Object]" with no
| useful detail. That swallows the one thing we actually need: the raw
| WebSocket close code/reason.
|
| This patches the global WebSocket constructor (once) so every socket
| the page opens -- including the one buried inside the SDK -- reports
| its close code, close reason, and any error event straight to the
| existing on-screen diagnostic panel. URLs are logged with the api_key
| redacted. This is temporary debug instrumentation: safe to remove once
| the real failure reason is found.
|--------------------------------------------------------------------------
*/
if (!window.__wsPatched) {
    window.__wsPatched = true;

    const NativeWebSocket = window.WebSocket;

    window.WebSocket = function (url, protocols) {
        const safeUrl = redactUrl(url);

        showLiveDiagnostic(`WS OPEN ATTEMPT: ${safeUrl}`);

        const ws = protocols
            ? new NativeWebSocket(url, protocols)
            : new NativeWebSocket(url);

        ws.addEventListener("open", () => {
            showLiveDiagnostic(`WS OPENED: ${safeUrl}`);
        });

        ws.addEventListener("message", event => {
            let preview = event.data;

            if (typeof preview !== "string") {
                preview = `[non-text frame, type=${Object.prototype.toString.call(preview)}]`;
            } else if (preview.length > 500) {
                preview = preview.slice(0, 500) + "... (truncated)";
            }

            showLiveDiagnostic(`WS MESSAGE RECEIVED: ${preview}`);
        });

        ws.addEventListener("close", event => {
            showLiveDiagnostic(
                `WS CLOSED: code=${event.code} reason="${event.reason || "none"}" wasClean=${event.wasClean} url=${safeUrl}`,
                "error"
            );
        });

        ws.addEventListener("error", () => {
            showLiveDiagnostic(`WS ERROR EVENT: url=${safeUrl}`, "error");
        });

        return ws;
    };

    window.WebSocket.prototype = NativeWebSocket.prototype;

    showLiveDiagnostic("WebSocket diagnostic patch installed.");
}

/*
|--------------------------------------------------------------------------
| DEBUG: raw XMLHttpRequest interceptor
|--------------------------------------------------------------------------
| The "ProgressEvent" error seen during connect is XHR's signature error
| shape (WebSocket/fetch do not fire ProgressEvent). This almost always
| means an XHR request -- most likely the reference-image upload bundled
| into the realtime connect call -- failed with a bare, detail-less
| error, which is the exact behavior browsers show for a blocked CORS
| request. This patch logs every XHR's method/url plus its final
| outcome so we can see exactly which request is failing and against
| which URL. Temporary debug instrumentation, safe to remove once found.
|--------------------------------------------------------------------------
*/
if (!window.__xhrPatched) {
    window.__xhrPatched = true;

    const NativeXHR = window.XMLHttpRequest;
    const nativeOpen = NativeXHR.prototype.open;
    const nativeSend = NativeXHR.prototype.send;

    NativeXHR.prototype.open = function (method, url, ...rest) {
        this.__debugMethod = method;
        this.__debugUrl = url;
        return nativeOpen.call(this, method, url, ...rest);
    };

    NativeXHR.prototype.send = function (...args) {
        const method = this.__debugMethod || "?";
        const url = redactUrl(this.__debugUrl || "?");

        showLiveDiagnostic(`XHR SEND: ${method} ${url}`);

        this.addEventListener("load", () => {
            showLiveDiagnostic(
                `XHR LOAD: ${method} ${url} -> status=${this.status}`
            );
        });

        this.addEventListener("error", () => {
            showLiveDiagnostic(
                `XHR ERROR: ${method} ${url} -> status=${this.status} readyState=${this.readyState} (likely CORS/network block, no further detail is exposed by the browser)`,
                "error"
            );
        });

        this.addEventListener("timeout", () => {
            showLiveDiagnostic(
                `XHR TIMEOUT: ${method} ${url}`,
                "error"
            );
        });

        this.addEventListener("abort", () => {
            showLiveDiagnostic(
                `XHR ABORT: ${method} ${url}`,
                "error"
            );
        });

        return nativeSend.apply(this, args);
    };

    showLiveDiagnostic("XHR diagnostic patch installed.");
}

/*
|--------------------------------------------------------------------------
| DEBUG: raw FileReader interceptor
|--------------------------------------------------------------------------
| Neither the WebSocket nor the XHR patch logged anything before the
| ProgressEvent error, which rules both out. FileReader is the other
| browser API whose "error"/"load"/"abort" events are ProgressEvent
| instances -- and its target is the FileReader object itself, not a DOM
| element, which matches the error's target having no tagName/id/
| className. The SDK likely reads the reference image File via
| FileReader before attaching it to the connection. This patch logs
| every FileReader read attempt and its outcome. Temporary debug
| instrumentation, safe to remove once found.
|--------------------------------------------------------------------------
*/
if (!window.__frPatched) {
    window.__frPatched = true;

    const NativeFileReader = window.FileReader;

    window.FileReader = function () {
        const reader = new NativeFileReader();

        const wrap = (methodName) => {
            const native = reader[methodName];

            reader[methodName] = function (blob, ...rest) {
                const label =
                    blob && blob.name
                        ? `${blob.name} (${blob.type || "unknown type"}, ${blob.size ?? "?"} bytes)`
                        : "unnamed blob";

                showLiveDiagnostic(
                    `FILEREADER ${methodName}: ${label}`
                );

                return native.call(this, blob, ...rest);
            };
        };

        ["readAsDataURL", "readAsArrayBuffer", "readAsText", "readAsBinaryString"].forEach(
            wrap
        );

        reader.addEventListener("load", () => {
            showLiveDiagnostic("FILEREADER LOAD: success");
        });

        reader.addEventListener("error", () => {
            showLiveDiagnostic(
                `FILEREADER ERROR: code=${reader.error?.name || "unknown"} message=${reader.error?.message || "none"}`,
                "error"
            );
        });

        reader.addEventListener("abort", () => {
            showLiveDiagnostic("FILEREADER ABORT", "error");
        });

        return reader;
    };

    window.FileReader.prototype = NativeFileReader.prototype;

    showLiveDiagnostic("FileReader diagnostic patch installed.");
}

async function getRealtimeClientToken() {
    showLiveDiagnostic("Requesting temporary Decart realtime token...");

    let response;

    try {
        response = await fetch("backend/face/realtime-token.php", {
            method: "POST",
            credentials: "include",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: LUCY_MODEL
            })
        });
    } catch (error) {
        logDetailedLiveError("Token network request failed", error);

        showLiveDiagnostic(
            `Token network error: ${formatLiveError(error)}`,
            "error"
        );

        throw error;
    }

    showLiveDiagnostic(`Token endpoint response: HTTP ${response.status}`);

    let data;

    try {
        data = await response.json();
    } catch (error) {
        showLiveDiagnostic(
            "Token endpoint returned invalid JSON.",
            "error"
        );

        throw new Error("Invalid response from realtime token endpoint.");
    }

    if (!response.ok || !data.success || !data.apiKey) {
        const tokenError =
            data.error || data.message || "Unknown token error";

        showLiveDiagnostic(`Token creation failed: ${tokenError}`, "error");

        if (data.http_status) {
            showLiveDiagnostic(
                `Token provider HTTP status: ${data.http_status}`,
                "error"
            );
        }

        if (typeof data.curl_errno !== "undefined") {
            showLiveDiagnostic(
                `Token cURL errno: ${data.curl_errno}`,
                "error"
            );

            // curl errno 28 is CURLE_OPERATION_TIMEDOUT, meaning the PHP
            // backend itself could not reach api.decart.ai. This is a
            // server network/egress problem, not a bug in this JS file.
            if (data.curl_errno === 28) {
                showToast(
                    "The server hosting this app could not reach Decart's API (connection timed out). This is a server-side network/firewall issue, not a browser problem -- check that the server has outbound internet access to api.decart.ai.",
                    "error",
                    "Server cannot reach Decart"
                );
            }
        }

        if (data.curl_error) {
            showLiveDiagnostic(
                `Token cURL error: ${data.curl_error}`,
                "error"
            );
        }

        if (data.provider_response) {
            showLiveDiagnostic(
                `Token provider response:\n${formatLiveError(data.provider_response)}`,
                "error"
            );
        }

        if (data.debug_request_payload) {
            showLiveDiagnostic(
                `Token request payload sent:\n${formatLiveError(data.debug_request_payload)}`,
                "error"
            );
        }

        if (data.debug_raw_response) {
            showLiveDiagnostic(
                `Token RAW response body:\n${data.debug_raw_response}`,
                "error"
            );
        }

        throw new Error(tokenError);
    }

    showLiveDiagnostic(
        `Temporary Decart token received. Model: ${data.model || LUCY_MODEL}`
    );

    showLiveDiagnostic(
        `Origin restriction applied to token: ${data.debug_origin_sent || "NONE"}`
    );

    return data;
}

async function connectToLucy() {
    showLiveDiagnostic("========== LUCY CONNECTION START ==========");

    const wsTimingObserver = startWebSocketTimingWatch();

    try {
        const model = await ensureLucyModel();

        const sdk = await loadDecartSDK();
        const { createDecartClient } = sdk;

        const tokenData = await getRealtimeClientToken();

        liveState.decartClient = createDecartClient({
            apiKey: tokenData.apiKey
        });

        showLiveDiagnostic("Decart client created.");

        showLiveDiagnostic(
            `Using Lucy realtime model: ${describeModel(model)}`
        );

        if (!liveState.selectedFaceFile) {
            throw new Error(
                "A reference image is required for AI Face mode."
            );
        }

        showLiveDiagnostic(
            `Reference image ready for Lucy: ${liveState.selectedFaceFile.name} | ${liveState.selectedFaceFile.type} | ${liveState.selectedFaceFile.size} bytes`
        );

        if (!getCameraTrack()) {
            throw new Error("No active camera track.");
        }

        // The microphone is only required outside face mode.
        if (modeNeedsMicrophone() && !getMicrophoneTrack()) {
            throw new Error("No active microphone track.");
        }

        if (!modeNeedsMicrophone()) {
            showLiveDiagnostic("Face mode: microphone is off, sending video only.");
        }

        // Safety net: the camera should already have been requested with
        // model-matching constraints in startCamera() (live-part1.js).
        // This double-checks and nudges constraints only if they still
        // don't match (e.g. the model resolved after the camera was
        // already granted with fallback defaults).
        const cameraTrackForModel = getCameraTrack();

        if (cameraTrackForModel) {
            const currentSettings = cameraTrackForModel.getSettings
                ? cameraTrackForModel.getSettings()
                : {};

            const modelFps = getModelFps(model) || LUCY_FPS;

            const widthMatches =
                !model.width || currentSettings.width === model.width;

            const heightMatches =
                !model.height || currentSettings.height === model.height;

            if (!widthMatches || !heightMatches) {
                try {
                    await cameraTrackForModel.applyConstraints({
                        width: { ideal: model.width || LUCY_WIDTH },
                        height: { ideal: model.height || LUCY_HEIGHT },
                        frameRate: { ideal: modelFps },
                        resizeMode: "crop-and-scale"
                    });

                    showLiveDiagnostic(
                        `Reapplied camera constraints to match model: ${model.width || LUCY_WIDTH}x${model.height || LUCY_HEIGHT} @ ${modelFps}fps`
                    );
                } catch (error) {
                    showLiveDiagnostic(
                        `Could not reapply camera constraints to match model: ${formatLiveError(error)}`
                    );
                }
            } else {
                showLiveDiagnostic(
                    "Camera already matches Lucy model constraints, no reapply needed."
                );
            }
        }

        const inputStream = await createLucyInputStream(model);

        const outputVideo = $("aiOutputPreview");

        if (!outputVideo) {
            throw new Error("AI output preview was not found.");
        }

        try {
            if (
                typeof liveState.decartClient.realtime.checkConnectivity ===
                "function"
            ) {
                const connectivity =
                    await liveState.decartClient.realtime.checkConnectivity();

                showLiveDiagnostic(
                    `Decart connectivity quality: ${connectivity?.quality || "unknown"}`
                );

                showLiveDiagnostic(
                    `Decart connectivity metrics: ${formatLiveError(connectivity?.metrics || {})}`
                );

                showLiveDiagnostic(
                    `Decart connectivity reasons: ${formatLiveError(connectivity?.reasons || [])}`
                );

                showLiveDiagnostic(
                    `Decart connectivity transport: ${connectivity?.metrics?.transport || "unknown"}`
                );

                showLiveDiagnostic(
                    `Decart connectivity RTT: ${connectivity?.metrics?.rttMs ?? "unknown"} ms`
                );

                if (connectivity?.quality === "critical") {
                    throw new Error(
                        `Decart network connectivity is critical: ${
                            Array.isArray(connectivity.reasons)
                                ? connectivity.reasons.join(", ")
                                : "connection failed"
                        }`
                    );
                }
            }
        } catch (error) {
            if (error?.message?.includes("connectivity is critical")) {
                throw error;
            }

            showLiveDiagnostic(
                `Connectivity check warning: ${formatLiveError(error)}`
            );
        }

        showLiveDiagnostic("Creating Lucy WebRTC connection...");

        showLiveDiagnostic(
            "Reference image will be supplied in the realtime initial state."
        );

        try {
            liveState.realtimeClient = await liveState.decartClient.realtime.connect(
                inputStream,
                {
                    model,

                    mirror: "auto",

                    onRemoteStream: async transformedStream => {
                        showLiveDiagnostic(
                            "SUCCESS: Decart returned an AI output stream."
                        );

                        const tracks =
                            transformedStream?.getVideoTracks?.() || [];

                        showLiveDiagnostic(
                            `AI output video tracks received: ${tracks.length}`
                        );

                        if (!tracks.length) {
                            showLiveDiagnostic(
                                "ERROR: Decart returned a stream without a video track.",
                                "error"
                            );

                            return;
                        }

                        tracks.forEach(track => {
                            showLiveDiagnostic(
                                `AI video track state: ${track.readyState}`
                            );

                            track.addEventListener("ended", () =>
                                showLiveDiagnostic(
                                    "ERROR: Decart AI video track ended.",
                                    "error"
                                )
                            );

                            track.addEventListener("mute", () =>
                                showLiveDiagnostic(
                                    "WARNING: Decart AI video track muted."
                                )
                            );

                            track.addEventListener("unmute", () =>
                                showLiveDiagnostic(
                                    "Decart AI video track unmuted."
                                )
                            );
                        });

                        outputVideo.srcObject = transformedStream;

                        outputVideo.muted = false;
                        outputVideo.playsInline = true;
                        outputVideo.autoplay = true;

                        outputVideo.onloadedmetadata = () =>
                            showLiveDiagnostic(
                                "AI output video metadata loaded."
                            );

                        outputVideo.onerror = () =>
                            showLiveDiagnostic(
                                "ERROR: AI output video element reported an error.",
                                "error"
                            );

                        try {
                            await outputVideo.play();

                            showLiveDiagnostic(
                                "AI output video playback started."
                            );
                        } catch (error) {
                            logDetailedLiveError(
                                "AI output video play failed",
                                error
                            );
                        }

                        hide($("aiOutputPlaceholder"));
                        hide($("aiProcessingOverlay"));
                        show($("aiLiveBadge"));

                        safeText("aiStatus", "AI transformation is live");
                        safeText("outputConnectionText", "Connected");
                    },

                    // Real SDK option: reports every state change while
                    // connecting (replaces the old onError/onDisconnect,
                    // which are not SDK options and were ignored).
                    onConnectionChange: state =>
                        showLiveDiagnostic(
                            `Lucy connection state: ${formatLiveError(state)}`
                        ),

                    onConnectionQuality: report =>
                        showLiveDiagnostic(
                            `Lucy connection quality: ${formatLiveError(report)}`
                        ),

                    initialState: {
                        prompt: {
                            text: LUCY_PROMPT,
                            // false = use the face-only prompt exactly as
                            // written instead of letting it be rewritten.
                            enhance: false
                        },
                        image: liveState.selectedFaceFile
                    }
                }
            );
        } catch (error) {
            const diagnostic = describeDecartError(error);

            logDetailedLiveError("DECART REALTIME CONNECT ERROR", error);

            showLiveDiagnostic(
                `DECART CONNECT ERROR NAME: ${diagnostic.name}`,
                "error"
            );

            showLiveDiagnostic(
                `DECART CONNECT ERROR MESSAGE: ${diagnostic.message}`,
                "error"
            );

            if (diagnostic.stack) {
                showLiveDiagnostic(
                    `DECART CONNECT ERROR STACK:\n${diagnostic.stack}`,
                    "error"
                );
            }

            if (diagnostic.details) {
                showLiveDiagnostic(
                    `DECART RAW ERROR:\n${diagnostic.details}`,
                    "error"
                );
            }

            showLiveDiagnostic(
                "The original Decart error is being rethrown without replacing it.",
                "error"
            );

            try {
                wsTimingObserver?.disconnect();
            } catch (_) {}

            throw error;
        }

        if (!liveState.realtimeClient) {
            throw new Error("Lucy realtime client was not created.");
        }

        showLiveDiagnostic("Lucy WebRTC connection established.");

        showLiveDiagnostic(
            "Reference image was supplied during realtime connection."
        );

        try {
            if (typeof liveState.realtimeClient.on === "function") {
                liveState.realtimeClient.on("connectionChange", state =>
                    showLiveDiagnostic(
                        `Lucy connection state: ${formatLiveError(state)}`
                    )
                );

                liveState.realtimeClient.on("error", error =>
                    logDetailedLiveError(
                        "Lucy realtime runtime error",
                        error
                    )
                );

                // Terminal event: the server ended the session and no
                // reconnect is coming.
                liveState.realtimeClient.on("sessionEnded", info => {
                    showLiveDiagnostic(
                        `Lucy session ended: ${formatLiveError(info)}`,
                        "error"
                    );

                    if (liveState.isLive) {
                        showToast(
                            "The Lucy session ended.",
                            "warning",
                            "Session ended"
                        );

                        stopLiveSession();
                    }
                });

                liveState.realtimeClient.on("stats", stats => {
                    if (stats?.video?.framesPerSecond !== undefined) {
                        showLiveDiagnostic(
                            `Lucy output FPS: ${stats.video.framesPerSecond}`
                        );
                    }

                    if (stats?.glassToGlass?.medianMs !== undefined) {
                        safeText(
                            "outputLatency",
                            `${Math.round(stats.glassToGlass.medianMs)} ms`
                        );
                    }
                });
            }
        } catch (error) {
            showLiveDiagnostic(
                `Lucy event listener warning: ${formatLiveError(error)}`
            );
        }

        // Low-level ICE/PeerConnection diagnostics -- shows real
        // connectionState/iceConnectionState/candidate errors, useful
        // when a token succeeds but no video ever shows up.
        try {
            liveState.webrtcDiagnosticsHandle = installWebRTCDiagnostics(
                liveState.realtimeClient
            );
        } catch (error) {
            showLiveDiagnostic(
                `Could not install WebRTC diagnostics: ${formatLiveError(error)}`
            );
        }

        safeText("aiStatus", "Lucy connected");
        safeText("outputConnectionText", "Connected");

        try {
            wsTimingObserver?.disconnect();
        } catch (_) {}

        return liveState.realtimeClient;
    } catch (error) {
        try {
            wsTimingObserver?.disconnect();
        } catch (_) {}

        throw error;
    }
}

function disconnectLucy() {
    showLiveDiagnostic("Disconnecting Lucy...");

    if (liveState.realtimeClient) {
        try {
            if (typeof liveState.realtimeClient.disconnect === "function") {
                liveState.realtimeClient.disconnect();
            } else if (typeof liveState.realtimeClient.close === "function") {
                liveState.realtimeClient.close();
            }
        } catch (error) {
            showLiveDiagnostic(
                `Lucy disconnect warning: ${formatLiveError(error)}`
            );
        }
    }

    try {
        liveState.webrtcDiagnosticsHandle?.disconnect();
    } catch (_) {}

    liveState.webrtcDiagnosticsHandle = null;

    liveState.realtimeClient = null;
    liveState.decartClient = null;

    stopLucyInputStream();

    const outputVideo = $("aiOutputPreview");

    if (outputVideo) {
        outputVideo.srcObject = null;
        outputVideo.muted = true;
    }

    hide($("aiLiveBadge"));
    hide($("aiProcessingOverlay"));
    show($("aiOutputPlaceholder"));

    safeText("aiStatus", "AI output ready");
    safeText("outputConnectionText", "Not connected");
}

function startSessionTimer() {
    liveState.sessionStartTime = Date.now();

    clearInterval(liveState.sessionTimerInterval);

    liveState.sessionTimerInterval = setInterval(() => {
        if (!liveState.sessionStartTime) {
            return;
        }

        const elapsed = Math.floor(
            (Date.now() - liveState.sessionStartTime) / 1000
        );

        safeText("sessionTimer", formatDuration(elapsed));
        safeText("liveSessionTime", formatDuration(elapsed));
    }, 1000);
}

function stopSessionTimer() {
    clearInterval(liveState.sessionTimerInterval);
    liveState.sessionTimerInterval = null;
}

/*
|--------------------------------------------------------------------------
| LIVE CREDIT BILLING
|--------------------------------------------------------------------------
|
| Sends a heartbeat to backend/face/live-usage.php every
| CREDIT_HEARTBEAT_INTERVAL_MS with only the NEW seconds elapsed since
| the last heartbeat (lastBilledElapsed tracks the boundary). The
| server is the source of truth for both the rate and the resulting
| balance — this used to only update a local counter for display,
| which meant live sessions were never actually charged.
|--------------------------------------------------------------------------
*/

const CREDIT_HEARTBEAT_INTERVAL_MS = 5000;

async function sendLiveUsageHeartbeat(elapsedSecondsSinceLastBill) {
    if (elapsedSecondsSinceLastBill <= 0) {
        return;
    }

    try {
        const response = await fetch("backend/face/live-usage.php", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({
                mode: liveState.currentMode,
                elapsed_seconds: elapsedSecondsSinceLastBill
            })
        });

        const data = await response.json().catch(() => null);

        if (!response.ok || !data || !data.success) {
            showLiveDiagnostic(
                `Live usage heartbeat failed: HTTP ${response.status}`
            );
            return;
        }

        // Server balance is authoritative — replace the local estimate
        // with it rather than continuing to add to a client-side total.
        liveState.availableCredits = data.credits_balance;
        liveState.creditsUsed = 0;

        updateCreditDisplays();

        if (data.exhausted) {
            showToast(
                "Your AIStudio credits have been used up. The live session will stop.",
                "error",
                "Credits exhausted"
            );

            stopLiveSession();
        }
    } catch (error) {
        showLiveDiagnostic(
            `Live usage heartbeat network error: ${error?.message || error}`
        );
        // Deliberately not stopping the session on a network hiccup —
        // the next heartbeat will just bill a larger elapsed_seconds
        // instead. A real outage will surface via the WebRTC connection
        // itself.
    }
}

function startCreditTimer() {
    clearInterval(liveState.creditTimerInterval);

    liveState.lastBilledElapsed = 0;

    liveState.creditTimerInterval = setInterval(() => {
        if (!liveState.isLive || !liveState.sessionStartTime) {
            return;
        }

        const elapsedTotal = Math.floor(
            (Date.now() - liveState.sessionStartTime) / 1000
        );

        const newSeconds = elapsedTotal - liveState.lastBilledElapsed;

        if (newSeconds <= 0) {
            return;
        }

        liveState.lastBilledElapsed = elapsedTotal;

        sendLiveUsageHeartbeat(newSeconds);
    }, CREDIT_HEARTBEAT_INTERVAL_MS);
}

function stopCreditTimer() {
    clearInterval(liveState.creditTimerInterval);
    liveState.creditTimerInterval = null;

    // Bill whatever time has elapsed since the last heartbeat so a
    // session doesn't get a few free seconds every time it's stopped
    // right before the next scheduled heartbeat would have fired.
    //
    // Note: this runs from stopLiveSession(), which already sets
    // isLive = false before calling stopCreditTimer() — so this
    // deliberately does NOT check liveState.isLive (it would always
    // be false here). sessionStartTime is the right guard: it's only
    // ever set in startSessionTimer() and never cleared, so it stays
    // truthy after a stop until the next session starts.
    if (liveState.sessionStartTime) {
        const elapsedTotal = Math.floor(
            (Date.now() - liveState.sessionStartTime) / 1000
        );

        const remainingSeconds = elapsedTotal - liveState.lastBilledElapsed;

        if (remainingSeconds > 0) {
            liveState.lastBilledElapsed = elapsedTotal;
            sendLiveUsageHeartbeat(remainingSeconds);
        }
    }
}

function setLiveButtonState(live) {
    const normal = $("liveButtonNormal");
    const loading = $("liveButtonLoading");
    const stop = $("liveButtonStop");

    if (live) {
        hide(normal);
        hide(loading);
        show(stop);
    } else {
        show(normal);
        hide(loading);
        hide(stop);
    }
}

function showConnectingState() {
    const button = $("liveButton");

    if (button) {
        setDisabled(button, true);
    }

    show($("aiProcessingOverlay"));

    safeText("aiProcessingText", "Connecting to Lucy...");
    safeText("aiStatus", "Connecting...");
    safeText("outputConnectionText", "Connecting...");

    show($("liveButtonLoading"));
    hide($("liveButtonNormal"));
    hide($("liveButtonStop"));
}

function showLiveState() {
    const button = $("liveButton");

    if (button) {
        setDisabled(button, false);
    }

    setLiveButtonState(true);

    show($("liveSessionPanel"));

    safeText("sessionMode", liveState.currentMode);

    safeText(
        "liveSessionMessage",
        "Your live AI session is active."
    );

    safeText("aiStatus", "AI transformation is live");
}

async function startLiveSession() {
    showLiveDiagnostic("========== GO LIVE CLICKED ==========");

    if (liveState.isLive || liveState.isConnecting) {
        showLiveDiagnostic(
            "Live session is already active or connecting."
        );

        return;
    }

    showLiveDiagnostic(`Current mode: ${liveState.currentMode}`);
    showLiveDiagnostic(`Available credits: ${liveState.availableCredits}`);

    if (!hasRequiredReference()) {
        showToast(
            "Select the required reference file(s) before going live.",
            "warning",
            "Reference required"
        );

        updateGoLiveAvailability();

        return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
        showToast(
            "Your browser does not support camera and microphone access.",
            "error",
            "Browser not supported"
        );

        return;
    }

    if (liveState.availableCredits <= 0) {
        showToast(
            "You do not have enough AIStudio credits.",
            "error",
            "Insufficient credits"
        );

        return;
    }

    liveState.isConnecting = true;

    updateGoLiveAvailability();
    showConnectingState();
    startLiveDiagnostics();

    try {
        if (!getCameraTrack()) {
            showLiveDiagnostic(
                "No active camera found. Starting camera once..."
            );

            await startCamera();
        } else {
            showLiveDiagnostic(
                "Active camera found. Reusing existing camera without switching."
            );

            liveState.isCameraOn = true;
        }

        // Face mode is video-only, so the microphone stays off.
        if (modeNeedsMicrophone()) {
            if (!getMicrophoneTrack()) {
                showLiveDiagnostic(
                    "No active microphone found. Starting microphone..."
                );

                await startMicrophone();
            } else {
                showLiveDiagnostic(
                    "Active microphone found. Reusing existing microphone."
                );
            }

            if (PHONE_AUDIO_TEST_MODE) {
                await startAudioMonitor();
            }
        } else {
            showLiveDiagnostic(
                "Face mode: microphone not started (video only)."
            );

            // If a mic was opened earlier (e.g. in another mode), release it.
            stopAudioMonitor();

            if (liveState.micStream) {
                liveState.micStream.getTracks().forEach(track => {
                    try {
                        track.stop();
                    } catch (_) {}
                });

                liveState.micStream = null;
            }
        }

        if (
            liveState.currentMode === "face" ||
            liveState.currentMode === "face-voice"
        ) {
            await connectToLucy();
        } else if (liveState.currentMode === "voice") {
            safeText("aiStatus", "Voice mode is live");
            safeText("outputConnectionText", "Microphone connected");
        }

        liveState.isLive = true;
        liveState.isConnecting = false;

        liveState.creditsUsed = 0;

        startSessionTimer();
        startCreditTimer();

        showLiveState();

        updateGoLiveAvailability();

        showToast("Live session started.", "success", "You're live");
    } catch (error) {
        logDetailedLiveError("LIVE START ERROR", error);

        liveState.isConnecting = false;
        liveState.isLive = false;

        disconnectLucy();
        stopAudioMonitor();

        if (liveState.micStream) {
            liveState.micStream.getTracks().forEach(track => {
                try {
                    track.stop();
                } catch (_) {}
            });

            liveState.micStream = null;
        }

        hide($("liveSessionPanel"));

        setLiveButtonState(false);

        safeText("aiStatus", "AI output ready");
        safeText("outputConnectionText", "Not connected");

        const diagnostic = describeDecartError(error);

        showToast(
            diagnostic.message || "Unable to start the live session.",
            "error",
            "Live session failed"
        );

        await refreshPermissionStatus();
        await updateMicrophoneStatus();

        updateGoLiveAvailability();
    }
}

function stopLiveSession() {
    showLiveDiagnostic("========== STOP LIVE CALLED ==========");

    if (!liveState.isLive && !liveState.isConnecting) {
        stopLiveDiagnostics();
        return;
    }

    liveState.isLive = false;
    liveState.isConnecting = false;

    stopSessionTimer();
    stopCreditTimer();

    disconnectLucy();
    stopAudioMonitor();

    if (liveState.micStream) {
        liveState.micStream.getTracks().forEach(track => {
            try {
                track.stop();
            } catch (_) {}
        });

        liveState.micStream = null;
    }

    hide($("liveSessionPanel"));

    safeText("sessionTimer", "00:00");
    safeText("liveSessionTime", "00:00");
    safeText("liveConnectionLatency", "--");
    safeText("outputLatency", "--");

    setLiveButtonState(false);

    safeText("aiStatus", "AI output ready");
    safeText("outputConnectionText", "Not connected");

    updateMicrophoneStatus();
    updateGoLiveAvailability();

    stopLiveDiagnostics();

    showLiveDiagnostic("Live session stopped.");

    showToast("Live session stopped.", "info", "Session ended");
}

function openBrowserStreaming() {
    if (!liveState.isLive) {
        showToast(
            "Start a live AI session first.",
            "warning",
            "Start a live session"
        );

        return;
    }

    showToast(
        "Browser streaming controls are ready.",
        "info",
        "Browser streaming"
    );
}

function openOBS() {
    if (!liveState.isLive) {
        showToast(
            "Start a live AI session first.",
            "warning",
            "Start a live session"
        );

        return;
    }

    showToast(
        "OBS connection will be available through the streaming configuration.",
        "info",
        "OBS connection"
    );
}

function setupEventListeners() {
    showLiveDiagnostic("Setting up Live Studio event listeners...");

    $("cameraToggleButton")?.addEventListener("click", toggleCamera);

    $("cameraSettingsButton")?.addEventListener(
        "click",
        openDevicePermissionPanelAndRequestCamera
    );

    $("selectLiveFaceButton")?.addEventListener("click", () =>
        $("liveFaceInput")?.click()
    );

    $("replaceLiveFaceButton")?.addEventListener("click", () =>
        $("liveFaceInput")?.click()
    );

    $("removeLiveFaceButton")?.addEventListener(
        "click",
        removeFaceReference
    );

    $("liveFaceInput")?.addEventListener("change", event => {
        const file = event.target.files?.[0];

        if (file) {
            setFaceReference(file);
        }
    });

    $("selectLiveVoiceButton")?.addEventListener("click", () =>
        $("liveVoiceInput")?.click()
    );

    $("replaceLiveVoiceButton")?.addEventListener("click", () =>
        $("liveVoiceInput")?.click()
    );

    $("removeLiveVoiceButton")?.addEventListener(
        "click",
        removeVoiceReference
    );

    $("liveVoiceInput")?.addEventListener("change", event => {
        const file = event.target.files?.[0];

        if (file) {
            setVoiceReference(file);
        }
    });

    $("faceModeButton")?.addEventListener("click", () => setMode("face"));

    $("voiceModeButton")?.addEventListener("click", () => setMode("voice"));

    $("faceVoiceModeButton")?.addEventListener("click", () =>
        setMode("face-voice")
    );

    $("liveQualitySelect")?.addEventListener("change", updateQuality);

    $("liveButton")?.addEventListener("click", () => {
        showLiveDiagnostic("Go Live button event fired.");

        if (liveState.isLive) {
            stopLiveSession();
        } else {
            startLiveSession();
        }
    });

    $("browserStreamButton")?.addEventListener(
        "click",
        openBrowserStreaming
    );

    $("obsButton")?.addEventListener("click", openOBS);

    const faceUpload = $("faceReferenceUpload");

    if (faceUpload) {
        faceUpload.addEventListener("dragover", event =>
            event.preventDefault()
        );

        faceUpload.addEventListener("drop", event => {
            event.preventDefault();

            const file = event.dataTransfer.files?.[0];

            if (file) {
                setFaceReference(file);
            }
        });
    }

    const voiceUpload = $("voiceReferenceUpload");

    if (voiceUpload) {
        voiceUpload.addEventListener("dragover", event =>
            event.preventDefault()
        );

        voiceUpload.addEventListener("drop", event => {
            event.preventDefault();

            const file = event.dataTransfer.files?.[0];

            if (file) {
                setVoiceReference(file);
            }
        });
    }

    showLiveDiagnostic("Live Studio event listeners ready.");
}

function setupDeviceChangeListener() {
    if (!navigator.mediaDevices) {
        return;
    }

    navigator.mediaDevices.addEventListener("devicechange", async () => {
        await updateMicrophoneStatus();
        await refreshPermissionStatus();
    });
}

document.addEventListener("visibilitychange", async () => {
    if (!document.hidden) {
        await refreshPermissionStatus();
        await updateMicrophoneStatus();
    }
});

window.addEventListener("beforeunload", () => {
    stopLiveSession();
    stopCamera();
    stopMicrophone();
    stopLiveDiagnostics();
});

window.AIStudioLive = {
    startCamera,
    stopCamera,
    startMicrophone,
    stopMicrophone,
    startLiveSession,
    stopLiveSession,
    setMode,
    setFaceReference,
    removeFaceReference,
    setVoiceReference,
    removeVoiceReference,
    openDevicePermissionPanel,
    openDevicePermissionPanelAndRequestCamera,
    refreshPermissionStatus,

    showToast: showStudioToast,

    getState() {
        return {
            mode: liveState.currentMode,
            quality: liveState.currentQuality,
            cameraOn: liveState.isCameraOn,
            live: liveState.isLive,
            connecting: liveState.isConnecting,
            hasFaceReference: !!liveState.selectedFaceFile,
            hasVoiceReference: !!liveState.selectedVoiceFile,
            availableCredits: liveState.availableCredits,
            creditsUsed: liveState.creditsUsed,
            rate: getCurrentRate()
        };
    }
};

async function init() {
    showLiveDiagnostic("========== LIVE STUDIO INITIALIZATION ==========");

    try {
        readInitialCredits();

        setupEventListeners();
        setupDeviceChangeListener();

        updateQuality();
        updateUsageRate();

        setMode("face");

        setLiveButtonState(false);

        updateReferencePanels();
        updateGoLiveAvailability();

        await refreshPermissionStatus();
        await updateMicrophoneStatus();

        updateCameraToggleButton();

        safeText("cameraStatus", "Camera ready");
        safeText("aiStatus", "AI output ready");
        safeText("outputConnectionText", "Not connected");

        // Kick off loading the Decart SDK + Lucy model as early as
        // possible (not awaited, so it never blocks page init or the
        // camera permission prompt). By the time the user uploads a face
        // reference and clicks camera/Go Live, the model is usually
        // already resolved, so startCamera() (live-part1.js) can request
        // the camera with the model's real fps/width/height from the
        // start instead of hardcoded defaults.
        ensureLucyModel().catch(() => {
            // Already logged inside ensureLucyModel(); startCamera() and
            // connectToLucy() both retry/fall back on their own.
        });

        showLiveDiagnostic("Live Studio initialization completed.");
    } catch (error) {
        logDetailedLiveError("INITIALIZATION ERROR", error);
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init();
}
