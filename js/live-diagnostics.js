export const LIVE_DEBUG = true;

let liveDiagnosticPanel = null;

function $(id) {
    return document.getElementById(id);
}

export function liveDebug(label, data = null) {
    if (!LIVE_DEBUG) return;

    const time = new Date().toLocaleTimeString();

    if (data !== null) {
        console.log(`[AIStudio Live ${time}] ${label}`, data);
    } else {
        console.log(`[AIStudio Live ${time}] ${label}`);
    }
}

export function showLiveDiagnostic(message, type = "info") {
    if (!LIVE_DEBUG) return;

    // Never show temporary Decart tokens in the panel or console.
    message = String(message).replace(/(api_key=)[^&\s"]+/gi, "$1[redacted]");

    if (!liveDiagnosticPanel) {
        liveDiagnosticPanel = document.createElement("div");

        liveDiagnosticPanel.id = "liveDiagnosticPanel";

        Object.assign(liveDiagnosticPanel.style, {
            position: "fixed",
            left: "12px",
            right: "12px",
            bottom: "12px",
            zIndex: "100001",
            background: "rgba(15,23,42,.97)",
            color: "#fff",
            borderRadius: "14px",
            padding: "14px",
            fontSize: "12px",
            lineHeight: "1.5",
            boxShadow: "0 12px 40px rgba(0,0,0,.35)",
            maxHeight: "42vh",
            overflowY: "auto",
            fontFamily: "monospace"
        });

        liveDiagnosticPanel.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px;">
                <strong>AIStudio Live Diagnostics</strong>
                <button type="button" id="closeLiveDiagnostic" style="border:0;background:transparent;color:#fff;font-size:20px;">&times;</button>
            </div>

            <div id="liveDiagnosticStatus"
                style="padding:8px;border-radius:8px;background:rgba(255,255,255,.08);margin-bottom:8px;">
                Waiting...
            </div>

            <pre id="liveDiagnosticLog"
                style="white-space:pre-wrap;margin:0;color:#dbeafe;font-family:inherit;font-size:11px;"></pre>
        `;

        document.body.appendChild(liveDiagnosticPanel);

        $("closeLiveDiagnostic")?.addEventListener(
            "click",
            () => {
                liveDiagnosticPanel?.remove();
                liveDiagnosticPanel = null;
            }
        );
    }

    const status = $("liveDiagnosticStatus");
    const log = $("liveDiagnosticLog");

    const time = new Date().toLocaleTimeString();

    if (status) {
        status.textContent = message;
    }

    if (log) {
        log.textContent += `[${time}] ${message}\n`;
        log.scrollTop = log.scrollHeight;
    }

    if (type === "error") {
        console.error("[AIStudio Live]", message);
    } else {
        console.log("[AIStudio Live]", message);
    }
}

function serializeErrorObject(error) {
    if (error === null || error === undefined) {
        return String(error);
    }

    if (typeof error === "string") {
        return error;
    }

    if (
        typeof error === "number" ||
        typeof error === "boolean"
    ) {
        return String(error);
    }

    const output = {};

    try {
        for (const key of Object.getOwnPropertyNames(error)) {
            try {
                const value = error[key];

                if (typeof value === "function") {
                    output[key] =
                        `[Function ${value.name || "anonymous"}]`;
                } else if (value instanceof Error) {
                    output[key] = {
                        name: value.name,
                        message: value.message,
                        stack: value.stack,
                        ...serializeNestedError(value)
                    };
                } else {
                    output[key] = value;
                }
            } catch (e) {
                output[key] =
                    `[Unreadable property: ${e.message}]`;
            }
        }
    } catch (e) {
        return String(error);
    }

    try {
        return JSON.stringify(
            output,
            null,
            2
        );
    } catch (e) {
        try {
            return String(error);
        } catch (_) {
            return "[Unserializable error]";
        }
    }
}

function serializeNestedError(error) {
    const output = {};

    try {
        for (
            const key of
            Object.getOwnPropertyNames(error)
        ) {
            if (
                key === "name" ||
                key === "message" ||
                key === "stack"
            ) {
                continue;
            }

            try {
                const value = error[key];

                if (
                    value === null ||
                    typeof value === "string" ||
                    typeof value === "number" ||
                    typeof value === "boolean"
                ) {
                    output[key] = value;
                } else if (value instanceof Error) {
                    output[key] = {
                        name: value.name,
                        message: value.message,
                        stack: value.stack
                    };
                } else {
                    output[key] = String(value);
                }
            } catch (_) {
                output[key] = "[Unreadable]";
            }
        }
    } catch (_) {}

    return output;
}

export function formatLiveError(error) {
    if (error instanceof Error) {
        const serialized =
            serializeErrorObject(error);

        return (
            serialized ||
            error.message ||
            String(error)
        );
    }

    if (
        typeof Event !== "undefined" &&
        error instanceof Event
    ) {
        const details = {
            type: error.type || null,
            name:
                error.constructor?.name ||
                "Event",
            isTrusted:
                error.isTrusted ?? null
        };

        if (error.target) {
            details.target = {
                tagName:
                    error.target.tagName ||
                    null,
                id:
                    error.target.id ||
                    null,
                className:
                    typeof error.target.className ===
                    "string"
                        ? error.target.className
                        : null
            };
        }

        if (error.currentTarget) {
            details.currentTarget = {
                tagName:
                    error.currentTarget.tagName ||
                    null,
                id:
                    error.currentTarget.id ||
                    null
            };
        }

        try {
            return JSON.stringify(
                details,
                null,
                2
            );
        } catch (_) {
            return String(error);
        }
    }

    if (
        error &&
        typeof error === "object"
    ) {
        return serializeErrorObject(error);
    }

    return String(error);
}

export function logDetailedLiveError(
    label,
    error
) {
    const formatted =
        formatLiveError(error);

    console.error(
        `[AIStudio Live] ${label}`,
        error
    );

    showLiveDiagnostic(
        `${label}:\n${formatted}`,
        "error"
    );

    if (
        error &&
        typeof error === "object"
    ) {
        try {
            showLiveDiagnostic(
                `ERROR CONSTRUCTOR: ${error.constructor?.name || "Object"}`,
                "error"
            );
        } catch (_) {}

        try {
            const keys =
                Object.getOwnPropertyNames(error);

            if (keys.length) {
                showLiveDiagnostic(
                    `ERROR PROPERTIES:\n${keys.join(", ")}`,
                    "error"
                );
            }
        } catch (_) {}
    }

    if (error?.stack) {
        showLiveDiagnostic(
            `STACK:\n${error.stack}`,
            "error"
        );
    }

    if (error?.cause) {
        showLiveDiagnostic(
            `CAUSE:\n${formatLiveError(error.cause)}`,
            "error"
        );
    }

    if (error?.response) {
        showLiveDiagnostic(
            `RESPONSE:\n${formatLiveError(error.response)}`,
            "error"
        );
    }

    if (error?.data) {
        showLiveDiagnostic(
            `DATA:\n${formatLiveError(error.data)}`,
            "error"
        );
    }

    if (error?.details) {
        showLiveDiagnostic(
            `DETAILS:\n${formatLiveError(error.details)}`,
            "error"
        );
    }

    if (error?.reason) {
        showLiveDiagnostic(
            `REASON:\n${formatLiveError(error.reason)}`,
            "error"
        );
    }

    if (error?.code) {
        showLiveDiagnostic(
            `ERROR CODE: ${error.code}`,
            "error"
        );
    }

    if (error?.status) {
        showLiveDiagnostic(
            `ERROR STATUS: ${error.status}`,
            "error"
        );
    }

    if (error?.statusCode) {
        showLiveDiagnostic(
            `ERROR STATUS CODE: ${error.statusCode}`,
            "error"
        );
    }

    if (
        error?.attemptNumber !==
        undefined
    ) {
        showLiveDiagnostic(
            `SDK retry attempt: ${error.attemptNumber}`
        );
    }

    if (
        error?.retriesLeft !==
        undefined
    ) {
        showLiveDiagnostic(
            `SDK retries remaining: ${error.retriesLeft}`
        );
    }
}

export function getModelFps(model) {
    if (!model) return null;

    const fps = model.fps;

    if (
        typeof fps === "number" &&
        Number.isFinite(fps)
    ) {
        return fps;
    }

    if (
        fps &&
        typeof fps === "object"
    ) {
        for (
            const value of [
                fps.fps,
                fps.value,
                fps.max,
                fps.default,
                fps.ideal
            ]
        ) {
            if (
                typeof value === "number" &&
                Number.isFinite(value)
            ) {
                return value;
            }
        }
    }

    return null;
}

export function describeModel(model) {
    if (!model) {
        return "Lucy model unavailable";
    }

    return `${model.width || "?"}x${model.height || "?"} @ ${getModelFps(model) || "model-defined"}fps`;
}

export function logModelDetails(model) {
    showLiveDiagnostic(
        `Lucy model settings: ${describeModel(model)}`
    );

    if (
        model?.fps &&
        typeof model.fps === "object"
    ) {
        showLiveDiagnostic(
            `Lucy model FPS is an object: ${formatLiveError(model.fps)}`
        );
    }
}

export function describeDecartError(error) {
    let source = error;

    if (error?.lastError) {
        source = error.lastError;
    } else if (error?.originalError) {
        source = error.originalError;
    } else if (error?.cause) {
        source = error.cause;
    } else if (error?.error) {
        source = error.error;
    } else if (error?.reason) {
        source = error.reason;
    }

    if (source instanceof Error) {
        return {
            message:
                source.message ||
                "Unknown Error",
            name:
                source.name ||
                "Error",
            stack:
                source.stack ||
                "",
            details:
                formatLiveError(source)
        };
    }

    if (
        typeof Event !== "undefined" &&
        source instanceof Event
    ) {
        return {
            message:
                source.message ||
                `Decart WebRTC event: ${source.type || "unknown"}`,
            name:
                source.constructor?.name ||
                "Event",
            stack: "",
            details:
                formatLiveError(source)
        };
    }

    if (
        source &&
        typeof source === "object"
    ) {
        let details = null;

        try {
            details =
                formatLiveError(source);
        } catch (_) {
            details =
                String(source);
        }

        return {
            message:
                source.message ||
                source.error ||
                source.detail ||
                source.reason ||
                source.statusText ||
                source.code ||
                "Decart returned an object error.",
            name:
                source.name ||
                source.constructor?.name ||
                "DecartError",
            stack:
                source.stack ||
                "",
            details
        };
    }

    return {
        message: String(source),
        name: "UnknownError",
        stack: "",
        details: null
    };
}

export function installWebRTCDiagnostics(
    realtimeClient,
    callback = null
) {
    if (!realtimeClient) {
        return null;
    }

    const emit = message => {
        if (callback) {
            callback(message);
        } else {
            showLiveDiagnostic(message);
        }
    };

    const connections = [];

    const possiblePeerConnections = [
        realtimeClient.peerConnection,
        realtimeClient.pc,
        realtimeClient.rtcPeerConnection,
        realtimeClient.connection,
        realtimeClient._peerConnection,
        realtimeClient._pc
    ];

    possiblePeerConnections.forEach(
        connection => {
            if (
                connection &&
                typeof connection === "object" &&
                typeof connection.addEventListener ===
                    "function"
            ) {
                if (
                    !connections.includes(
                        connection
                    )
                ) {
                    connections.push(
                        connection
                    );
                }
            }
        }
    );

    if (!connections.length) {
        emit(
            "WebRTC diagnostics: SDK peer connection object is not directly exposed."
        );

        return null;
    }

    connections.forEach(
        (pc, index) => {
            emit(
                `WebRTC peer connection ${index + 1} found.`
            );

            const report = () => {
                try {
                    emit(
                        `WebRTC state ${index + 1}: connection=${pc.connectionState || "unknown"} | ice=${pc.iceConnectionState || "unknown"} | gathering=${pc.iceGatheringState || "unknown"} | signaling=${pc.signalingState || "unknown"}`
                    );
                } catch (_) {}
            };

            [
                "connectionstatechange",
                "iceconnectionstatechange",
                "icegatheringstatechange",
                "signalingstatechange"
            ].forEach(
                eventName => {
                    pc.addEventListener(
                        eventName,
                        report
                    );
                }
            );

            pc.addEventListener(
                "icecandidateerror",
                event => {
                    const address =
                        event.address ||
                        "unknown";

                    const url =
                        event.url ||
                        "unknown";

                    const errorCode =
                        event.errorCode ??
                        "unknown";

                    const errorText =
                        event.errorText ||
                        "unknown";

                    emit(
                        `WEBRTC ICE CANDIDATE ERROR: code=${errorCode} | text=${errorText} | address=${address} | url=${url}`
                    );
                }
            );

            pc.addEventListener(
                "icecandidate",
                event => {
                    if (event.candidate) {
                        emit(
                            `WebRTC ICE candidate gathered: ${event.candidate.candidate || "candidate"}`
                        );
                    }
                }
            );

            report();
        }
    );

    return {
        disconnect() {
            connections.forEach(
                pc => {
                    [
                        "connectionstatechange",
                        "iceconnectionstatechange",
                        "icegatheringstatechange",
                        "signalingstatechange"
                    ].forEach(
                        eventName => {
                            try {
                                pc.removeEventListener(
                                    eventName,
                                    () => {}
                                );
                            } catch (_) {}
                        }
                    );
                }
            );
        }
    };
}

export function startWebSocketTimingWatch() {
    try {
        const observer =
            new PerformanceObserver(
                list => {
                    for (
                        const entry of
                        list.getEntries()
                    ) {
                        if (
                            entry.name &&
                            (
                                entry.name.startsWith(
                                    "wss://"
                                ) ||
                                entry.name.startsWith(
                                    "ws://"
                                )
                            )
                        ) {
                            showLiveDiagnostic(
                                `WS TIMING: ${entry.name}\n` +
                                `duration=${entry.duration.toFixed(1)}ms\n` +
                                `transferSize=${entry.transferSize}\n` +
                                `encodedBodySize=${entry.encodedBodySize}\n` +
                                `responseStatus=${entry.responseStatus ?? "n/a"}\n` +
                                `nextHopProtocol=${entry.nextHopProtocol || "n/a"}`,
                                "error"
                            );
                        }
                    }
                }
            );

        observer.observe({
            type: "resource",
            buffered: true
        });

        return observer;
    } catch (e) {
        showLiveDiagnostic(
            `WS timing watch unavailable: ${formatLiveError(e)}`
        );

        return null;
    }
}

window.addEventListener(
    "error",
    event => {
        const errorMessage =
            `JavaScript Error: ${event.message} | ` +
            `${event.filename || "unknown"}:` +
            `${event.lineno || "?"}:` +
            `${event.colno || "?"}`;

        liveDebug(
            "JavaScript Error",
            {
                message:
                    event.message,
                filename:
                    event.filename,
                line:
                    event.lineno,
                column:
                    event.colno,
                error:
                    event.error
            }
        );

        showLiveDiagnostic(
            errorMessage,
            "error"
        );

        if (event.error) {
            logDetailedLiveError(
                "WINDOW ERROR OBJECT",
                event.error
            );
        }
    }
);

window.addEventListener(
    "unhandledrejection",
    event => {
        const reason =
            formatLiveError(
                event.reason
            );

        liveDebug(
            "Unhandled Promise Rejection",
            event.reason
        );

        showLiveDiagnostic(
            `Unhandled Promise Rejection:\n${reason}`,
            "error"
        );

        if (event.reason) {
            logDetailedLiveError(
                "UNHANDLED REJECTION OBJECT",
                event.reason
            );
        }
    }
);

liveDebug(
    "Live Studio JS loaded"
);

showLiveDiagnostic(
    "Live Studio JS loaded successfully."
);
