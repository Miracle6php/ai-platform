import {
    LIVE_DEBUG,
    liveDebug,
    showLiveDiagnostic,
    formatLiveError,
    logDetailedLiveError,
    getModelFps,
    describeModel,
    logModelDetails
} from "./live-diagnostics.js";

/*
|--------------------------------------------------------------------------
| live-part1.js
|--------------------------------------------------------------------------
| This is one half of the original single live.js file, split into two
| modules so it's easier to copy/paste and send. It holds:
|   - all shared mutable state (exported as `liveState`)
|   - constants
|   - small DOM helpers
|   - toasts / credits / usage rate
|   - camera + microphone handling
|   - face/voice reference file handling
|   - permission handling
|   - Decart SDK + Lucy model loading (ensureLucyModel)
|
| live-part2.js imports everything it needs from this file (via
| `liveState` and the exported functions below) and adds the actual
| Lucy connect/disconnect logic, session control, event wiring, and
| init(). Only live-part2.js needs to be referenced from the HTML --
| it imports this file itself, so the browser loads both automatically.
|--------------------------------------------------------------------------
*/

export const MAX_FACE_SIZE_MB = 10;
export const MAX_VOICE_SIZE_MB = 5;

export const CREDIT_RATES = {
    face: 6,
    voice: 2,
    "face-voice": 8
};

export const PHONE_AUDIO_TEST_MODE = true;

export const LUCY_MODEL = "lucy-2.5";

// Fallback values only, used if the Decart model object can't be loaded
// yet when the camera is first requested. Once the model loads, its own
// fps/width/height are used instead -- see ensureLucyModel().
export const LUCY_WIDTH = 1280;
export const LUCY_HEIGHT = 720;
export const LUCY_FPS = 30;

// Face-only swap prompt: transfers the reference face and leaves hair,
// clothing, body, background and lighting untouched.
export const LUCY_PROMPT = `Replace only the face of the person in the live video with the face from the reference image, using the reference for facial identity, facial structure, skin, eyes, nose and mouth. Keep the live video's original expressions, lip movement, blinking, gaze and head movement. Do not change the hairstyle, clothing, body, background or lighting.`;

/*
|--------------------------------------------------------------------------
| Shared mutable state
|--------------------------------------------------------------------------
| Everything that used to be a module-scoped `let` in the single-file
| version now lives as a property on this one exported object, so both
| this file and live-part2.js read/write the same values.
|--------------------------------------------------------------------------
*/
export const liveState = {
    cameraStream: null,
    micStream: null,

    lucyInputStream: null,
    lucyCanvas: null,
    lucyCanvasContext: null,
    lucySourceVideo: null,
    lucyAnimationFrame: null,
    lucyCaptureTrack: null,

    audioMonitorContext: null,
    audioMonitorSource: null,

    decartClient: null,
    realtimeClient: null,
    decartSDKPromise: null,

    lucyModel: null,
    lucyModelPromise: null,

    webrtcDiagnosticsHandle: null,

    selectedFaceFile: null,
    selectedVoiceFile: null,

    currentMode: "face",
    currentQuality: "standard",

    isCameraOn: false,
    isLive: false,
    isConnecting: false,

    sessionStartTime: null,
    sessionTimerInterval: null,
    creditTimerInterval: null,

    availableCredits: 0,
    creditsUsed: 0,
    lastBilledElapsed: 0,

    lastCameraPermission: "unknown",
    lastMicrophonePermission: "unknown",

    liveDiagnosticTimer: null
};

export function $(id) {
    return document.getElementById(id);
}

export function safeText(id, value) {
    const el = $(id);

    if (el) {
        el.textContent = value;
    }
}

export function show(el) {
    if (el) {
        el.classList.remove("d-none");
    }
}

export function hide(el) {
    if (el) {
        el.classList.add("d-none");
    }
}

export function setDisabled(el, disabled) {
    if (!el) return;

    el.disabled = disabled;

    if (disabled) {
        el.setAttribute("aria-disabled", "true");
    } else {
        el.removeAttribute("aria-disabled");
    }
}

export function getCameraTrack() {
    if (!liveState.cameraStream) return null;

    const track = liveState.cameraStream
        .getVideoTracks?.()
        .find(t => t.readyState === "live");

    return track || null;
}

export function getMicrophoneTrack() {
    if (!liveState.micStream) return null;

    const track = liveState.micStream
        .getAudioTracks?.()
        .find(t => t.readyState === "live");

    return track || null;
}

export function startLiveDiagnostics() {
    if (!LIVE_DEBUG) return;

    clearInterval(liveState.liveDiagnosticTimer);

    liveState.liveDiagnosticTimer = setInterval(() => {
        if (!liveState.isLive && !liveState.isConnecting) return;

        const cameraTrack = getCameraTrack();

        if (!cameraTrack) {
            showLiveDiagnostic(
                "ERROR: No active camera video track found.",
                "error"
            );
        } else {
            const settings = cameraTrack.getSettings
                ? cameraTrack.getSettings()
                : {};

            showLiveDiagnostic(
                `Camera feed: ${cameraTrack.readyState} | enabled=${cameraTrack.enabled} | muted=${cameraTrack.muted} | ${settings.width || "?"}x${settings.height || "?"}`
            );
        }

        const microphoneTrack = getMicrophoneTrack();

        if (!microphoneTrack) {
            if (liveState.currentMode !== "face") {
                showLiveDiagnostic(
                    "WARNING: No active microphone audio track found."
                );
            }
        } else {
            const settings = microphoneTrack.getSettings
                ? microphoneTrack.getSettings()
                : {};

            showLiveDiagnostic(
                `Microphone feed: ${microphoneTrack.readyState} | enabled=${microphoneTrack.enabled} | muted=${microphoneTrack.muted} | device=${settings.deviceId ? "available" : "unknown"}`
            );
        }

        const output = $("aiOutputPreview");
        const outputStream = output?.srcObject;

        if (outputStream) {
            const tracks = outputStream.getVideoTracks?.() || [];

            if (tracks.length) {
                const track = tracks[0];

                showLiveDiagnostic(
                    `AI output feed: ${track.readyState} | enabled=${track.enabled} | muted=${track.muted}`
                );

                if (output) {
                    showLiveDiagnostic(
                        `AI video element: readyState=${output.readyState} | paused=${output.paused} | ${output.videoWidth || "?"}x${output.videoHeight || "?"}`
                    );
                }
            } else {
                showLiveDiagnostic(
                    "WARNING: AI output stream exists but has no video track."
                );
            }
        } else {
            showLiveDiagnostic("Waiting for Decart AI output stream...");
        }
    }, 2000);
}

export function stopLiveDiagnostics() {
    clearInterval(liveState.liveDiagnosticTimer);
    liveState.liveDiagnosticTimer = null;
}

export function showStudioToast(message, type = "info", title = "") {
    const toast = $("studioToast");
    const icon = $("studioToastIcon");
    const titleElement = $("studioToastTitle");
    const messageElement = $("studioToastMessage");

    if (!toast || !messageElement) {
        console.warn("AIStudio toast elements were not found.");
        return;
    }

    const types = {
        success: { title: "Success", icon: "bi-check-circle-fill" },
        error: { title: "Something went wrong", icon: "bi-x-circle-fill" },
        warning: { title: "Attention needed", icon: "bi-exclamation-triangle-fill" },
        info: { title: "AIStudio", icon: "bi-info-circle-fill" }
    };

    const config = types[type] || types.info;

    toast.classList.remove(
        "toast-success",
        "toast-error",
        "toast-warning",
        "toast-info"
    );

    toast.classList.add(`toast-${type}`);

    if (icon) {
        icon.className = `bi ${config.icon}`;
    }

    if (titleElement) {
        titleElement.textContent = title || config.title;
    }

    messageElement.textContent = message;

    toast.classList.remove("show");

    requestAnimationFrame(() => toast.classList.add("show"));

    clearTimeout(window.studioToastTimer);

    window.studioToastTimer = setTimeout(
        () => toast.classList.remove("show"),
        4500
    );
}

export function showToast(message, type = "info", title = "") {
    showStudioToast(message, type, title);
}

export function readInitialCredits() {
    const body = document.body;

    const value =
        body?.dataset?.userCredits ??
        $("topbarCredits")?.dataset?.credits ??
        $("headerCredits")?.dataset?.credits ??
        "0";

    const parsed = Number(value);

    liveState.availableCredits = Number.isFinite(parsed) ? parsed : 0;

    updateCreditDisplays();

    showLiveDiagnostic(`Credits loaded: ${liveState.availableCredits}`);
}

export function updateCreditDisplays() {
    const remaining = Math.max(
        0,
        Math.floor(liveState.availableCredits - liveState.creditsUsed)
    );

    safeText(
        "topbarCredits",
        Math.max(0, Math.floor(liveState.availableCredits)).toLocaleString()
    );

    safeText(
        "headerCredits",
        Math.max(0, Math.floor(liveState.availableCredits)).toLocaleString()
    );

    safeText(
        "liveCreditsUsed",
        Math.floor(liveState.creditsUsed).toLocaleString()
    );

    safeText("liveCreditsRemaining", remaining.toLocaleString());

    safeText("sessionCredits", remaining.toLocaleString());
}

export function getCurrentRate() {
    return CREDIT_RATES[liveState.currentMode] || CREDIT_RATES.face;
}

export function updateUsageRate() {
    const rate = getCurrentRate();

    safeText("liveUsageRate", `${rate} credits/sec`);

    const estimate = $("liveUsageEstimateText");

    if (estimate) {
        estimate.textContent = `Current usage: ${rate} credits per second`;
    }
}

export function updateReferencePanels() {
    const facePanel = $("faceReferencePanel");
    const voicePanel = $("voiceReferencePanel");

    if (liveState.currentMode === "face") {
        show(facePanel);
        hide(voicePanel);
        return;
    }

    if (liveState.currentMode === "voice") {
        hide(facePanel);
        show(voicePanel);
        return;
    }

    show(facePanel);
    show(voicePanel);
}

/*
|--------------------------------------------------------------------------
| loadDecartSDK() / ensureLucyModel()
|--------------------------------------------------------------------------
| FIX (2026): loadDecartSDK() previously did:
|
|     const sdkPath = "/node_modules/@decartai/sdk/dist/index.js";
|     liveState.decartSDKPromise = import(sdkPath);
|
| That is a dynamic import() built from a runtime STRING VARIABLE, which
| esbuild (or any bundler) cannot statically analyze. As a result the
| bundler left this line completely untouched -- meaning even after
| bundling everything else, the browser was still fetching and running
| the SDK's raw, unbundled dist file directly at runtime. That raw file
| still contains bare specifiers ("zod", "livekit-client", "mitt",
| "p-retry", ...) which only resolved because of the manual import map,
| and which are prone to silent partial-resolution failures -- a very
| plausible root cause of the swallowed WebSocket 1005 disconnect.
|
| The fix: use a bare, static import specifier -- import("@decartai/sdk")
| -- which esbuild CAN see and resolve at build time. This causes the
| entire real SDK (and its real, correctly-resolved dependency tree:
| zod, mitt, p-retry, is-network-error, retry, livekit-client, jose,
| etc.) to be bundled directly into live.bundle.js, exactly like the
| top-level imports already are. No import map, no raw node_modules
| path, and no runtime dependency resolution left in the browser at
| all.
|--------------------------------------------------------------------------
*/
export async function loadDecartSDK() {
    showLiveDiagnostic("Loading Decart SDK...");

    if (liveState.decartSDKPromise) {
        showLiveDiagnostic("Using existing Decart SDK loading promise.");
        return liveState.decartSDKPromise;
    }

    if (typeof window === "undefined" || typeof document === "undefined") {
        throw new Error("Browser environment is unavailable.");
    }

    try {
        // Bare specifier -- statically analyzable and bundled by esbuild.
        liveState.decartSDKPromise = import("@decartai/sdk");

        const sdk = await liveState.decartSDKPromise;

        if (!sdk) {
            throw new Error("Decart SDK returned an empty module.");
        }

        if (typeof sdk.createDecartClient !== "function") {
            throw new Error(
                "Decart SDK loaded, but createDecartClient was not found."
            );
        }

        if (!sdk.models) {
            throw new Error("Decart SDK loaded, but models was not found.");
        }

        showLiveDiagnostic("Decart SDK loaded successfully (bundled).");
        showLiveDiagnostic("createDecartClient: available");
        showLiveDiagnostic("models: available");

        return sdk;
    } catch (error) {
        liveState.decartSDKPromise = null;

        showLiveDiagnostic(
            `Decart SDK load failed: ${formatLiveError(error)}`,
            "error"
        );

        throw error;
    }
}

export async function ensureLucyModel() {
    if (liveState.lucyModel) {
        return liveState.lucyModel;
    }

    if (liveState.lucyModelPromise) {
        return liveState.lucyModelPromise;
    }

    liveState.lucyModelPromise = (async () => {
        const sdk = await loadDecartSDK();

        const model = sdk.models.realtime(LUCY_MODEL);

        liveState.lucyModel = model;

        showLiveDiagnostic(
            `Lucy model ready ahead of camera request: ${describeModel(model)}`
        );

        logModelDetails(model);

        return model;
    })();

    try {
        return await liveState.lucyModelPromise;
    } catch (error) {
        liveState.lucyModelPromise = null;

        showLiveDiagnostic(
            `Could not preload Lucy model, will fall back to default camera constraints: ${formatLiveError(error)}`
        );

        throw error;
    }
}

export async function startCamera() {
    showLiveDiagnostic("Camera start requested...");

    const existing = getCameraTrack();

    if (existing) {
        showLiveDiagnostic("Existing camera stream reused. No camera switch.");

        liveState.isCameraOn = true;

        const video = $("cameraPreview");

        if (video) {
            video.srcObject = liveState.cameraStream;
            video.style.transform = "scaleX(1)";
            video.muted = true;
            video.playsInline = true;

            try {
                await video.play();
            } catch (e) {
                showLiveDiagnostic(
                    `Camera preview play warning: ${formatLiveError(e)}`
                );
            }
        }

        updateCameraToggleButton();

        return liveState.cameraStream;
    }

    let desiredWidth = LUCY_WIDTH;
    let desiredHeight = LUCY_HEIGHT;
    let desiredFps = LUCY_FPS;

    try {
        const model = await Promise.race([
            ensureLucyModel(),
            new Promise((_, reject) =>
                setTimeout(
                    () => reject(new Error("Lucy model preload timed out")),
                    2500
                )
            )
        ]);

        desiredWidth = model.width || LUCY_WIDTH;
        desiredHeight = model.height || LUCY_HEIGHT;
        desiredFps = getModelFps(model) || LUCY_FPS;

        showLiveDiagnostic(
            `Requesting camera using Lucy model constraints: ${desiredWidth}x${desiredHeight} @ ${desiredFps}fps`
        );
    } catch (error) {
        showLiveDiagnostic(
            `Lucy model not ready yet, requesting camera with default constraints (${desiredWidth}x${desiredHeight}@${desiredFps}fps): ${formatLiveError(error)}`
        );
    }

    try {
        liveState.cameraStream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: "user",
                width: { ideal: desiredWidth },
                height: { ideal: desiredHeight },
                frameRate: { ideal: desiredFps },
                resizeMode: "crop-and-scale"
            },
            audio: false
        });

        const tracks = liveState.cameraStream.getVideoTracks();

        showLiveDiagnostic(
            `Camera permission granted. Video tracks: ${tracks.length}`
        );

        tracks.forEach(track => {
            showLiveDiagnostic(
                `Camera track: ${track.readyState}, enabled=${track.enabled}`
            );

            track.addEventListener("ended", () => {
                liveState.isCameraOn = false;

                showLiveDiagnostic("ERROR: Camera track ended.", "error");
            });

            track.addEventListener("mute", () =>
                showLiveDiagnostic("WARNING: Camera track muted.")
            );

            track.addEventListener("unmute", () =>
                showLiveDiagnostic("Camera track unmuted.")
            );
        });

        liveState.isCameraOn = true;

        const video = $("cameraPreview");

        if (video) {
            video.srcObject = liveState.cameraStream;
            video.style.transform = "scaleX(1)";
            video.muted = true;
            video.playsInline = true;

            try {
                await video.play();
                showLiveDiagnostic("Camera preview playback started.");
            } catch (e) {
                showLiveDiagnostic(
                    `Camera preview play warning: ${formatLiveError(e)}`
                );
            }
        }

        const cameraTrack = getCameraTrack();

        const settings = cameraTrack?.getSettings
            ? cameraTrack.getSettings()
            : {};

        showLiveDiagnostic(
            `Actual camera stream: ${settings.width || "?"}x${settings.height || "?"} @ ${settings.frameRate || "?"}fps`
        );

        showLiveDiagnostic(
            `Actual camera facing mode: ${settings.facingMode || "unknown"}`
        );

        show($("cameraLiveBadge"));
        hide($("cameraPlaceholder"));

        safeText("cameraStatus", "Camera is active");
        safeText("cameraDeviceText", "Camera available");

        const status = $("cameraDeviceStatus");

        if (status) {
            status.classList.remove("bg-danger");
            status.classList.add("bg-success");
        }

        updateCameraToggleButton();

        await refreshPermissionStatus();

        return liveState.cameraStream;
    } catch (error) {
        liveState.isCameraOn = false;
        liveState.cameraStream = null;

        logDetailedLiveError("CAMERA ERROR", error);

        safeText("cameraStatus", "Camera access required");
        safeText("cameraDeviceText", "Camera unavailable");

        showToast(
            "Camera access is required for Live Studio.",
            "error",
            "Camera access required"
        );

        updateCameraToggleButton();

        throw error;
    }
}

export function stopCamera() {
    showLiveDiagnostic("Stopping camera...");

    if (liveState.cameraStream) {
        liveState.cameraStream.getTracks().forEach(track => {
            try {
                track.stop();
            } catch (e) {}
        });
    }

    liveState.cameraStream = null;
    liveState.isCameraOn = false;

    const video = $("cameraPreview");

    if (video) {
        video.srcObject = null;
    }

    hide($("cameraLiveBadge"));
    show($("cameraPlaceholder"));

    safeText("cameraStatus", "Camera is off");

    updateCameraToggleButton();
}

export function updateCameraToggleButton() {
    const button = $("cameraToggleButton");

    if (!button) return;

    if (liveState.isCameraOn) {
        button.innerHTML = '<i class="bi bi-camera-video-off"></i>';
        button.setAttribute("aria-label", "Turn camera off");
    } else {
        button.innerHTML = '<i class="bi bi-camera-video"></i>';
        button.setAttribute("aria-label", "Turn camera on");
    }
}

export async function toggleCamera() {
    showLiveDiagnostic("Camera toggle clicked.");

    if (liveState.isCameraOn) {
        if (liveState.isLive) {
            showToast(
                "Stop the live session before turning off the camera.",
                "warning",
                "Live session active"
            );

            return;
        }

        stopCamera();
        return;
    }

    try {
        await startCamera();
    } catch (error) {
        openDevicePermissionPanel();
    }
}

export async function startMicrophone() {
    if (liveState.micStream && getMicrophoneTrack()) {
        showLiveDiagnostic("Existing microphone stream reused.");

        updateMicrophoneStatus();

        return liveState.micStream;
    }

    showLiveDiagnostic("Requesting microphone...");

    try {
        liveState.micStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            },
            video: false
        });

        const audioTracks = liveState.micStream.getAudioTracks();

        showLiveDiagnostic(
            `Microphone ready. Audio tracks: ${audioTracks.length}`
        );

        audioTracks.forEach(track => {
            showLiveDiagnostic(
                `Microphone track: ${track.readyState}, enabled=${track.enabled}`
            );

            track.addEventListener("ended", () =>
                showLiveDiagnostic("ERROR: Microphone track ended.", "error")
            );

            track.addEventListener("mute", () =>
                showLiveDiagnostic("WARNING: Microphone track muted.")
            );

            track.addEventListener("unmute", () =>
                showLiveDiagnostic("Microphone track unmuted.")
            );
        });

        updateMicrophoneStatus();

        await refreshPermissionStatus();

        return liveState.micStream;
    } catch (error) {
        logDetailedLiveError("MICROPHONE ERROR", error);

        safeText("microphoneDeviceText", "Microphone permission required");

        const status = $("microphoneDeviceStatus");

        if (status) {
            status.classList.remove("bg-success", "bg-warning");
            status.classList.add("bg-danger");
        }

        throw error;
    }
}

export function stopMicrophone() {
    stopAudioMonitor();

    if (liveState.micStream) {
        liveState.micStream.getTracks().forEach(track => {
            try {
                track.stop();
            } catch (e) {}
        });
    }

    liveState.micStream = null;

    updateMicrophoneStatus();
}

export async function updateMicrophoneStatus() {
    const microphoneTrack = getMicrophoneTrack();

    const status = $("microphoneDeviceStatus");

    if (microphoneTrack) {
        safeText("microphoneDeviceText", "Microphone is available");

        if (status) {
            status.classList.remove("bg-danger", "bg-warning");
            status.classList.add("bg-success");
        }

        return;
    }

    if (liveState.lastMicrophonePermission === "denied") {
        safeText("microphoneDeviceText", "Microphone permission blocked");

        if (status) {
            status.classList.remove("bg-success", "bg-warning");
            status.classList.add("bg-danger");
        }

        return;
    }

    safeText("microphoneDeviceText", "Microphone permission required");

    if (status) {
        status.classList.remove("bg-success", "bg-danger");
        status.classList.add("bg-warning");
    }
}

export async function startAudioMonitor() {
    if (!PHONE_AUDIO_TEST_MODE) return;

    if (!liveState.micStream) {
        await startMicrophone();
    }

    if (liveState.audioMonitorContext) {
        return;
    }

    try {
        liveState.audioMonitorContext = new (
            window.AudioContext || window.webkitAudioContext
        )();

        liveState.audioMonitorSource =
            liveState.audioMonitorContext.createMediaStreamSource(
                liveState.micStream
            );

        liveState.audioMonitorSource.connect(
            liveState.audioMonitorContext.destination
        );

        if (liveState.audioMonitorContext.state === "suspended") {
            await liveState.audioMonitorContext.resume();
        }

        showPermissionNotice();
    } catch (error) {
        logDetailedLiveError("Audio monitor error", error);
    }
}

export function stopAudioMonitor() {
    try {
        if (liveState.audioMonitorSource) {
            liveState.audioMonitorSource.disconnect();
        }
    } catch (e) {}

    liveState.audioMonitorSource = null;

    if (liveState.audioMonitorContext) {
        try {
            liveState.audioMonitorContext.close();
        } catch (e) {}
    }

    liveState.audioMonitorContext = null;
}

export function showPermissionNotice() {
    let panel = document.getElementById("liveAudioPermissionPanel");

    if (!panel) {
        panel = document.createElement("div");
        panel.id = "liveAudioPermissionPanel";

        Object.assign(panel.style, {
            position: "fixed",
            left: "50%",
            bottom: "20px",
            transform: "translateX(-50%)",
            zIndex: "99998",
            background: "#111827",
            color: "#fff",
            padding: "14px 18px",
            borderRadius: "12px",
            boxShadow: "0 10px 30px rgba(0,0,0,.3)",
            maxWidth: "90%",
            textAlign: "center",
            fontSize: "13px"
        });

        document.body.appendChild(panel);
    }

    panel.innerHTML = `
        <div>
            <strong>
                Phone speaker is being used for this test.
            </strong>
        </div>
        <div style="margin-top:4px;opacity:.75;">
            Microphone monitoring is active.
        </div>
    `;

    show(panel);
}

export function validateFaceFile(file) {
    if (!file) return false;

    const allowed = ["image/jpeg", "image/png", "image/webp"];

    if (!allowed.includes(file.type)) {
        showToast(
            "Please select a JPG, PNG, or WebP reference image.",
            "error",
            "Invalid reference image"
        );

        return false;
    }

    if (file.size > MAX_FACE_SIZE_MB * 1024 * 1024) {
        showToast(
            `Reference image must be smaller than ${MAX_FACE_SIZE_MB} MB.`,
            "error",
            "Image too large"
        );

        return false;
    }

    return true;
}

export function validateVoiceFile(file) {
    if (!file) return false;

    if (!file.type.startsWith("audio/")) {
        showToast(
            "Please select a valid audio file.",
            "error",
            "Invalid voice file"
        );

        return false;
    }

    if (file.size > MAX_VOICE_SIZE_MB * 1024 * 1024) {
        showToast(
            `Voice file must be smaller than ${MAX_VOICE_SIZE_MB} MB.`,
            "error",
            "Voice file too large"
        );

        return false;
    }

    return true;
}

/*
|--------------------------------------------------------------------------
| makeStableFileCopy()
|--------------------------------------------------------------------------
| FIX for NotReadableError: on Android, a File object obtained from
| <input type="file"> is often backed by a live content:// URI handle
| (e.g. from the Gallery/Photos app), not a real, stable filesystem
| path. If enough time passes -- or the tab loses focus, or Android
| reclaims memory -- between selecting the file and actually reading its
| bytes, that handle can silently go stale. Reading it later then throws
| "NotReadableError: The requested file could not be read..." even
| though the file picker succeeded moments before.
|
| The fix is to read the file into memory immediately, at selection
| time, and keep only a fresh in-memory File built from that already-
| read data. That in-memory copy is fully detached from Android's file
| provider and can be read again safely at any point later (e.g. when
| the user finally clicks "Go Live" and the SDK's own FileReader runs),
| no matter how much time has passed or whether the tab was backgrounded
| in between.
|--------------------------------------------------------------------------
*/
async function makeStableFileCopy(file) {
    try {
        const buffer = await file.arrayBuffer();

        return new File([buffer], file.name, {
            type: file.type,
            lastModified: file.lastModified
        });
    } catch (error) {
        showLiveDiagnostic(
            `Could not read "${file.name}" (${error?.name || "Error"}: ${error?.message || "no message"}). The file is unreadable, so it was NOT selected.`,
            "error"
        );

        return null;
    }
}

export async function setFaceReference(file) {
    if (!validateFaceFile(file)) return;

    showLiveDiagnostic(
        `Reading face reference into memory to avoid a stale file handle later: ${file.name}`
    );

    const stableFile = await makeStableFileCopy(file);

    if (!stableFile) {
        const input = $("liveFaceInput");

        if (input) {
            input.value = "";
        }

        showToast(
            "This image can't be read by the browser. Save it to your Downloads folder (or take a new photo) and choose it again.",
            "error",
            "Image unreadable"
        );

        return;
    }

    liveState.selectedFaceFile = stableFile;

    const name = $("liveFaceFileName");
    const meta = $("liveFaceFileMeta");

    if (name) {
        name.textContent = stableFile.name;
    }

    if (meta) {
        meta.textContent = `${(stableFile.size / 1024 / 1024).toFixed(2)} MB`;
    }

    show($("selectedFaceReference"));
    hide($("faceReferenceUpload"));

    updateGoLiveAvailability();

    showToast(
        "Reference image selected.",
        "success",
        "Face reference ready"
    );

    showLiveDiagnostic(`Face reference selected: ${stableFile.name}`);
}

export function removeFaceReference() {
    liveState.selectedFaceFile = null;

    const input = $("liveFaceInput");

    if (input) {
        input.value = "";
    }

    hide($("selectedFaceReference"));
    show($("faceReferenceUpload"));

    safeText("liveFaceFileName", "");
    safeText("liveFaceFileMeta", "");

    updateGoLiveAvailability();

    showToast("Reference image removed.", "info", "Face reference removed");
}

export async function setVoiceReference(file) {
    if (!validateVoiceFile(file)) return;

    showLiveDiagnostic(
        `Reading voice reference into memory to avoid a stale file handle later: ${file.name}`
    );

    const stableFile = await makeStableFileCopy(file);

    if (!stableFile) {
        const input = $("liveVoiceInput");

        if (input) {
            input.value = "";
        }

        showToast(
            "This audio file can't be read by the browser. Save it to your Downloads folder and choose it again.",
            "error",
            "Audio unreadable"
        );

        return;
    }

    liveState.selectedVoiceFile = stableFile;

    const name = $("liveVoiceFileName");
    const meta = $("liveVoiceFileMeta");

    if (name) {
        name.textContent = stableFile.name;
    }

    if (meta) {
        meta.textContent = `${(stableFile.size / 1024 / 1024).toFixed(2)} MB`;
    }

    show($("selectedVoiceReference"));
    hide($("voiceReferenceUpload"));

    updateGoLiveAvailability();

    showToast(
        "Voice reference selected.",
        "success",
        "Voice reference ready"
    );

    showLiveDiagnostic(`Voice reference selected: ${stableFile.name}`);
}

export function removeVoiceReference() {
    liveState.selectedVoiceFile = null;

    const input = $("liveVoiceInput");

    if (input) {
        input.value = "";
    }

    hide($("selectedVoiceReference"));
    show($("voiceReferenceUpload"));

    safeText("liveVoiceFileName", "");
    safeText("liveVoiceFileMeta", "");

    updateGoLiveAvailability();

    showToast("Voice reference removed.", "info", "Voice reference removed");
}

export function hasRequiredReference() {
    const needsFace =
        liveState.currentMode === "face" ||
        liveState.currentMode === "face-voice";

    const needsVoice =
        liveState.currentMode === "voice" ||
        liveState.currentMode === "face-voice";

    if (needsFace && !liveState.selectedFaceFile) {
        return false;
    }

    if (needsVoice && !liveState.selectedVoiceFile) {
        return false;
    }

    return true;
}

export function updateGoLiveAvailability() {
    const liveButton = $("liveButton");

    if (!liveButton) return;

    if (liveState.isConnecting) {
        setDisabled(liveButton, true);
        return;
    }

    if (liveState.isLive) {
        setDisabled(liveButton, false);
        return;
    }

    if (!hasRequiredReference()) {
        setDisabled(liveButton, true);

        const needsFace =
            (liveState.currentMode === "face" ||
                liveState.currentMode === "face-voice") &&
            !liveState.selectedFaceFile;

        const needsVoice =
            (liveState.currentMode === "voice" ||
                liveState.currentMode === "face-voice") &&
            !liveState.selectedVoiceFile;

        let label = "Go Live";

        if (needsFace && needsVoice) {
            label = "Select Face & Voice";
        } else if (needsFace) {
            label = "Select Reference Image";
        } else if (needsVoice) {
            label = "Select Voice Reference";
        }

        safeText("liveButtonNormal", label);

        return;
    }

    setDisabled(liveButton, false);
    safeText("liveButtonNormal", "Go Live");
}

export function setMode(mode) {
    if (mode !== "face" && mode !== "voice" && mode !== "face-voice") {
        return;
    }

    if (liveState.isLive) {
        showToast(
            "Stop the current live session before changing mode.",
            "warning",
            "Live session active"
        );

        return;
    }

    liveState.currentMode = mode;

    [
        $("faceModeButton"),
        $("voiceModeButton"),
        $("faceVoiceModeButton")
    ].forEach(button => {
        if (!button) return;

        button.classList.toggle("active", button.dataset.mode === mode);
    });

    updateReferencePanels();
    updateUsageRate();
    updateGoLiveAvailability();

    showLiveDiagnostic(`Mode changed to: ${mode}`);
}

export function updateQuality() {
    const select = $("liveQualitySelect");

    if (select) {
        liveState.currentQuality = select.value || "standard";
    }
}

export async function queryPermission(name) {
    if (!navigator.permissions?.query) {
        return "unknown";
    }

    try {
        const result = await navigator.permissions.query({ name });
        return result.state || "unknown";
    } catch (error) {
        return "unknown";
    }
}

export async function refreshPermissionStatus() {
    liveState.lastCameraPermission = await queryPermission("camera");
    liveState.lastMicrophonePermission = await queryPermission("microphone");

    updatePermissionPanel();
}

export function permissionLabel(state) {
    if (state === "granted") return "Allowed";
    if (state === "denied") return "Blocked";
    if (state === "prompt") return "Not granted yet";
    return "Unknown";
}

export function permissionIcon(state) {
    if (state === "granted") return "bi-check-circle-fill";
    if (state === "denied") return "bi-x-circle-fill";
    return "bi-question-circle";
}

export function updatePermissionPanel() {
    const cameraState = $("livePermissionCameraState");
    const microphoneState = $("livePermissionMicrophoneState");

    if (cameraState) {
        cameraState.innerHTML = `<i class="bi ${permissionIcon(liveState.lastCameraPermission)}"></i> ${permissionLabel(liveState.lastCameraPermission)}`;
    }

    if (microphoneState) {
        microphoneState.innerHTML = `<i class="bi ${permissionIcon(liveState.lastMicrophonePermission)}"></i> ${permissionLabel(liveState.lastMicrophonePermission)}`;
    }
}

export async function requestCameraPermission() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false
        });

        stream.getTracks().forEach(track => track.stop());

        liveState.lastCameraPermission = "granted";

        await refreshPermissionStatus();

        showToast("Camera access is allowed.", "success", "Camera ready");

        if (!liveState.cameraStream) {
            await startCamera();
        }
    } catch (error) {
        logDetailedLiveError("Camera permission failed", error);

        liveState.lastCameraPermission =
            error.name === "NotAllowedError" ? "denied" : "unknown";

        await refreshPermissionStatus();

        showToast(
            "Camera access was not allowed. Check your browser permissions.",
            "error",
            "Camera permission denied"
        );
    }
}

export async function requestMicrophonePermission() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: false,
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        });

        stream.getTracks().forEach(track => track.stop());

        liveState.lastMicrophonePermission = "granted";

        await refreshPermissionStatus();
        await updateMicrophoneStatus();

        showToast(
            "Microphone access is allowed.",
            "success",
            "Microphone ready"
        );
    } catch (error) {
        logDetailedLiveError("Microphone permission failed", error);

        liveState.lastMicrophonePermission =
            error.name === "NotAllowedError" ? "denied" : "unknown";

        await refreshPermissionStatus();
        await updateMicrophoneStatus();

        showToast(
            "Microphone access was not allowed. Check your browser permissions.",
            "error",
            "Microphone permission denied"
        );
    }
}

export function openDevicePermissionPanel() {
    let panel = document.getElementById("liveDevicePermissionPanel");

    if (!panel) {
        panel = document.createElement("div");
        panel.id = "liveDevicePermissionPanel";

        Object.assign(panel.style, {
            position: "fixed",
            inset: "0",
            zIndex: "100000",
            background: "rgba(0,0,0,.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px"
        });

        panel.innerHTML = `
            <div id="livePermissionBox"
                style="width:100%;max-width:430px;background:#111827;color:#fff;border-radius:16px;padding:20px;box-shadow:0 20px 60px rgba(0,0,0,.45);">

                <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">

                    <div>
                        <div style="font-size:18px;font-weight:700;">
                            Camera & Microphone
                        </div>

                        <div style="font-size:13px;opacity:.7;margin-top:4px;">
                            Allow access for Live Studio
                        </div>
                    </div>

                    <button type="button"
                        id="closeLivePermissionPanel"
                        style="border:0;background:transparent;color:#fff;font-size:22px;"
                        aria-label="Close">
                        &times;
                    </button>

                </div>

                <div style="margin-top:18px;">

                    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px;border:1px solid rgba(255,255,255,.1);border-radius:10px;margin-bottom:10px;">

                        <div>
                            <div style="font-weight:600;">
                                <i class="bi bi-camera-video"></i>
                                Camera
                            </div>

                            <div id="livePermissionCameraState"
                                style="font-size:12px;opacity:.7;margin-top:4px;">
                                Checking...
                            </div>
                        </div>

                        <button type="button"
                            id="requestLiveCameraPermission"
                            class="btn btn-sm btn-primary">
                            Allow
                        </button>

                    </div>

                    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px;border:1px solid rgba(255,255,255,.1);border-radius:10px;">

                        <div>
                            <div style="font-weight:600;">
                                <i class="bi bi-mic"></i>
                                Microphone
                            </div>

                            <div id="livePermissionMicrophoneState"
                                style="font-size:12px;opacity:.7;margin-top:4px;">
                                Checking...
                            </div>
                        </div>

                        <button type="button"
                            id="requestLiveMicrophonePermission"
                            class="btn btn-sm btn-primary">
                            Allow
                        </button>

                    </div>

                </div>

                <div style="margin-top:16px;font-size:12px;line-height:1.5;opacity:.7;">
                    If access is blocked by the browser, open your browser's site permissions and allow Camera and Microphone for this localhost site.
                </div>

            </div>
        `;

        document.body.appendChild(panel);

        $("closeLivePermissionPanel")?.addEventListener("click", () =>
            hide(panel)
        );

        $("requestLiveCameraPermission")?.addEventListener(
            "click",
            requestCameraPermission
        );

        $("requestLiveMicrophonePermission")?.addEventListener(
            "click",
            requestMicrophonePermission
        );
    }

    show(panel);

    refreshPermissionStatus();
}

export async function openDevicePermissionPanelAndRequestCamera() {
    openDevicePermissionPanel();

    await refreshPermissionStatus();

    if (liveState.lastCameraPermission !== "granted") {
        await requestCameraPermission();
    } else if (!getCameraTrack()) {
        try {
            await startCamera();
        } catch (error) {}
    }
}

export async function createLucyInputStream(model) {
    const cameraTrack = getCameraTrack();
    const microphoneTrack = getMicrophoneTrack();

    if (!cameraTrack) {
        throw new Error("Camera track is unavailable.");
    }

    // Face mode is video-only: the microphone is NOT sent to Lucy.
    // Voice and face+voice modes still need the microphone.
    const needsMicrophone = liveState.currentMode !== "face";

    if (needsMicrophone && !microphoneTrack) {
        throw new Error("Microphone track is unavailable.");
    }

    const tracks = [cameraTrack];

    if (needsMicrophone && microphoneTrack) {
        tracks.push(microphoneTrack);
    }

    liveState.lucyInputStream = new MediaStream(tracks);

    const videoTrack = liveState.lucyInputStream.getVideoTracks()[0];
    const audioTrack = liveState.lucyInputStream.getAudioTracks()[0];

    const settings = videoTrack.getSettings();

    showLiveDiagnostic(
        `Lucy input stream ready: ${settings.width || "unknown"}x${settings.height || "unknown"} @ ${settings.frameRate || "unknown"}fps with camera video${audioTrack ? " and microphone audio" : " only (microphone off)"}.`
    );

    liveDebug("Lucy direct input video:", {
        state: videoTrack.readyState,
        enabled: videoTrack.enabled
    });

    if (audioTrack) {
        liveDebug("Lucy direct input audio:", {
            state: audioTrack.readyState,
            enabled: audioTrack.enabled
        });
    }

    return liveState.lucyInputStream;
}

export function stopLucyInputStream() {
    if (liveState.lucyAnimationFrame) {
        cancelAnimationFrame(liveState.lucyAnimationFrame);
        liveState.lucyAnimationFrame = null;
    }

    if (liveState.lucySourceVideo) {
        try {
            liveState.lucySourceVideo.pause();
        } catch (_) {}

        try {
            liveState.lucySourceVideo.srcObject = null;
        } catch (_) {}

        try {
            liveState.lucySourceVideo.remove();
        } catch (_) {}

        liveState.lucySourceVideo = null;
    }

    if (liveState.lucyInputStream) {
        liveState.lucyInputStream.getTracks().forEach(track => {
            if (track === liveState.lucyCaptureTrack) {
                try {
                    track.stop();
                } catch (_) {}
            }
        });
    }

    liveState.lucyInputStream = null;
    liveState.lucyCanvas = null;
    liveState.lucyCanvasContext = null;
    liveState.lucyCaptureTrack = null;
}

export function formatDuration(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hrs > 0) {
        return [
            String(hrs).padStart(2, "0"),
            String(mins).padStart(2, "0"),
            String(secs).padStart(2, "0")
        ].join(":");
    }

    return [String(mins).padStart(2, "0"), String(secs).padStart(2, "0")].join(
        ":"
    );
}
