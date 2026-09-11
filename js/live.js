/* ============================================================
   AIStudio — Live Studio
   Frontend-only real-time camera, microphone and live session

   TEST MODE:
   Phone microphone → browser audio monitor → phone speaker

   Actual Decart/Lucy and Voice.ai integrations will be added
   later during the backend/API phase.
   ============================================================ */


/* ============================================================
   CONFIGURATION
   ============================================================ */

const MAX_FACE_SIZE_MB = 10;
const MAX_VOICE_SIZE_MB = 5;

const CREDIT_RATES = {
    face: 1.5,
    voice: 0.8,
    "face-voice": 2.3
};

let availableCredits = 200;


/*
   ============================================================
   PHONE MIC + PHONE SPEAKER TEST MODE
   ============================================================

   true:
   - Use browser default microphone input
   - Do not force a selected external microphone
   - Use browser default audio output
   - Do not automatically route output to an earbud

   This is temporary for testing.
*/
const PHONE_AUDIO_TEST_MODE = true;


/* ============================================================
   STATE
   ============================================================ */

let cameraStream = null;
let microphoneStream = null;

let selectedFaceFile = null;
let selectedVoiceFile = null;

let selectedMode = "face";

let liveSessionActive = false;
let connectionInProgress = false;

let sessionStartTime = null;
let sessionTimerInterval = null;
let usageTimerInterval = null;

let creditsUsed = 0;

let aiOutputStream = null;

let cameraEnabled = false;
let microphoneEnabled = false;

let cameraPermissionGranted = false;
let microphonePermissionGranted = false;

let cameraStarting = false;

let permissionPanel = null;


/* ============================================================
   AUDIO OUTPUT STATE
   ============================================================ */

let selectedAudioInputId = "";
let selectedAudioOutputId = "";

let externalMicrophoneAvailable = false;
let earbudMicrophoneAvailable = false;
let earbudOutputAvailable = false;

let audioContext = null;
let microphoneSourceNode = null;
let microphoneGainNode = null;
let microphoneDestinationNode = null;


/* ============================================================
   DOM ELEMENTS
   ============================================================ */

const cameraPreview = document.getElementById("cameraPreview");
const cameraPlaceholder = document.getElementById("cameraPlaceholder");
const cameraLiveBadge = document.getElementById("cameraLiveBadge");
const cameraStatus = document.getElementById("cameraStatus");
const cameraToggleButton = document.getElementById("cameraToggleButton");
const cameraSettingsButton = document.getElementById("cameraSettingsButton");

const aiOutputPreview = document.getElementById("aiOutputPreview");
const aiOutputPlaceholder = document.getElementById("aiOutputPlaceholder");
const aiProcessingOverlay = document.getElementById("aiProcessingOverlay");
const aiProcessingText = document.getElementById("aiProcessingText");
const aiLiveBadge = document.getElementById("aiLiveBadge");
const aiStatus = document.getElementById("aiStatus");
const outputConnectionText = document.getElementById("outputConnectionText");
const outputLatency = document.getElementById("outputLatency");

const faceModeButton = document.getElementById("faceModeButton");
const voiceModeButton = document.getElementById("voiceModeButton");
const faceVoiceModeButton = document.getElementById("faceVoiceModeButton");

const liveFaceInput = document.getElementById("liveFaceInput");
const faceReferenceUpload = document.getElementById("faceReferenceUpload");
const selectLiveFaceButton = document.getElementById("selectLiveFaceButton");
const selectedFaceReference = document.getElementById("selectedFaceReference");
const liveFaceFileName = document.getElementById("liveFaceFileName");
const liveFaceFileMeta = document.getElementById("liveFaceFileMeta");
const replaceLiveFaceButton = document.getElementById("replaceLiveFaceButton");
const removeLiveFaceButton = document.getElementById("removeLiveFaceButton");

const liveVoiceInput = document.getElementById("liveVoiceInput");
const voiceReferenceUpload = document.getElementById("voiceReferenceUpload");
const selectLiveVoiceButton = document.getElementById("selectLiveVoiceButton");
const selectedVoiceReference = document.getElementById("selectedVoiceReference");
const liveVoiceFileName = document.getElementById("liveVoiceFileName");
const liveVoiceFileMeta = document.getElementById("liveVoiceFileMeta");
const replaceLiveVoiceButton = document.getElementById("replaceLiveVoiceButton");
const removeLiveVoiceButton = document.getElementById("removeLiveVoiceButton");

const liveQualitySelect = document.getElementById("liveQualitySelect");
const liveUsageRate = document.getElementById("liveUsageRate");
const liveSessionTime = document.getElementById("liveSessionTime");
const liveCreditsUsed = document.getElementById("liveCreditsUsed");
const liveCreditsRemaining = document.getElementById("liveCreditsRemaining");
const liveUsageEstimateText = document.getElementById("liveUsageEstimateText");

const cameraDeviceStatus = document.getElementById("cameraDeviceStatus");
const cameraDeviceText = document.getElementById("cameraDeviceText");

const microphoneDeviceStatus = document.getElementById("microphoneDeviceStatus");
const microphoneDeviceText = document.getElementById("microphoneDeviceText");

const aiServiceStatus = document.getElementById("aiServiceStatus");
const aiServiceText = document.getElementById("aiServiceText");

const liveButton = document.getElementById("liveButton");
const liveButtonNormal = document.getElementById("liveButtonNormal");
const liveButtonLoading = document.getElementById("liveButtonLoading");
const liveButtonStop = document.getElementById("liveButtonStop");

const liveSessionPanel = document.getElementById("liveSessionPanel");
const liveSessionMessage = document.getElementById("liveSessionMessage");
const sessionTimer = document.getElementById("sessionTimer");
const sessionCredits = document.getElementById("sessionCredits");
const sessionMode = document.getElementById("sessionMode");
const liveConnectionLatency = document.getElementById("liveConnectionLatency");

const browserStreamButton = document.getElementById("browserStreamButton");
const obsButton = document.getElementById("obsButton");

const headerCredits = document.getElementById("headerCredits");


/* ============================================================
   INITIALIZE
   ============================================================ */

initialize();


function initialize() {

    setupModeButtons();

    setupFaceReference();

    setupVoiceReference();

    setupCameraControls();

    setupLiveButton();

    setupStreamingButtons();

    setupQualityControl();

    createPermissionPanel();

    updateModeUI();

    updateUsageUI();

    checkAvailableDevices();

    updateDeviceStatus();

    updateCameraButton();

    updateLiveButton();

    setupAudioDeviceListener();

    prepareAudioOutput();

}


/* ============================================================
   MODE BUTTONS
   ============================================================ */

function setupModeButtons() {

    if (faceModeButton) {

        faceModeButton.addEventListener("click", function () {

            selectedMode = "face";

            updateModeUI();

            updateUsageUI();

            updateLiveButton();

        });

    }


    if (voiceModeButton) {

        voiceModeButton.addEventListener("click", function () {

            selectedMode = "voice";

            updateModeUI();

            updateUsageUI();

            updateLiveButton();

        });

    }


    if (faceVoiceModeButton) {

        faceVoiceModeButton.addEventListener("click", function () {

            selectedMode = "face-voice";

            updateModeUI();

            updateUsageUI();

            updateLiveButton();

        });

    }

}


function updateModeUI() {

    const buttons = [
        faceModeButton,
        voiceModeButton,
        faceVoiceModeButton
    ];

    buttons.forEach(function (button) {

        if (button) {
            button.classList.remove("active");
        }

    });


    if (selectedMode === "face" && faceModeButton) {
        faceModeButton.classList.add("active");
    }


    if (selectedMode === "voice" && voiceModeButton) {
        voiceModeButton.classList.add("active");
    }


    if (
        selectedMode === "face-voice" &&
        faceVoiceModeButton
    ) {
        faceVoiceModeButton.classList.add("active");
    }

}


/* ============================================================
   FACE REFERENCE
   ============================================================ */

function setupFaceReference() {

    if (selectLiveFaceButton && liveFaceInput) {

        selectLiveFaceButton.addEventListener(
            "click",
            function () {
                liveFaceInput.click();
            }
        );

    }


    if (faceReferenceUpload && liveFaceInput) {

        faceReferenceUpload.addEventListener(
            "click",
            function (event) {

                if (
                    event.target ===
                    selectLiveFaceButton
                ) {
                    return;
                }

                liveFaceInput.click();

            }
        );

    }


    if (liveFaceInput) {

        liveFaceInput.addEventListener(
            "change",
            function () {

                const file =
                    liveFaceInput.files &&
                    liveFaceInput.files[0];

                if (!file) {
                    return;
                }

                handleFaceReference(file);

            }
        );

    }


    if (replaceLiveFaceButton) {

        replaceLiveFaceButton.addEventListener(
            "click",
            function () {

                if (liveFaceInput) {
                    liveFaceInput.click();
                }

            }
        );

    }


    if (removeLiveFaceButton) {

        removeLiveFaceButton.addEventListener(
            "click",
            function () {

                clearFaceReference();

            }
        );

    }

}


function handleFaceReference(file) {

    const maxBytes =
        MAX_FACE_SIZE_MB *
        1024 *
        1024;


    if (file.size > maxBytes) {

        showToast(
            "Face reference is too large. Maximum size is 10 MB.",
            "error"
        );

        clearFaceReference();

        return;
    }


    const validTypes = [
        "image/jpeg",
        "image/png",
        "image/webp"
    ];


    if (
        file.type &&
        !validTypes.includes(file.type)
    ) {

        showToast(
            "Use a JPG, PNG or WebP face reference.",
            "error"
        );

        clearFaceReference();

        return;
    }


    selectedFaceFile = file;


    if (liveFaceFileName) {
        liveFaceFileName.textContent =
            file.name;
    }


    if (liveFaceFileMeta) {
        liveFaceFileMeta.textContent =
            formatFileSize(file.size);
    }


    if (selectedFaceReference) {
        selectedFaceReference.classList.remove(
            "d-none"
        );
    }


    updateLiveButton();

}


/* ============================================================
   CLEAR FACE REFERENCE
   ============================================================ */

function clearFaceReference() {

    selectedFaceFile = null;


    if (liveFaceInput) {
        liveFaceInput.value = "";
    }


    if (selectedFaceReference) {
        selectedFaceReference.classList.add(
            "d-none"
        );
    }


    if (liveFaceFileName) {
        liveFaceFileName.textContent = "";
    }


    if (liveFaceFileMeta) {
        liveFaceFileMeta.textContent = "";
    }


    updateLiveButton();

}


/* ============================================================
   VOICE REFERENCE
   ============================================================ */

function setupVoiceReference() {

    if (
        selectLiveVoiceButton &&
        liveVoiceInput
    ) {

        selectLiveVoiceButton.addEventListener(
            "click",
            function () {

                liveVoiceInput.click();

            }
        );

    }


    if (
        voiceReferenceUpload &&
        liveVoiceInput
    ) {

        voiceReferenceUpload.addEventListener(
            "click",
            function (event) {

                if (
                    event.target ===
                    selectLiveVoiceButton
                ) {
                    return;
                }

                liveVoiceInput.click();

            }
        );

    }


    if (liveVoiceInput) {

        liveVoiceInput.addEventListener(
            "change",
            function () {

                const file =
                    liveVoiceInput.files &&
                    liveVoiceInput.files[0];

                if (!file) {
                    return;
                }

                handleVoiceReference(file);

            }
        );

    }


    if (replaceLiveVoiceButton) {

        replaceLiveVoiceButton.addEventListener(
            "click",
            function () {

                if (liveVoiceInput) {
                    liveVoiceInput.click();
                }

            }
        );

    }


    if (removeLiveVoiceButton) {

        removeLiveVoiceButton.addEventListener(
            "click",
            function () {

                clearVoiceReference();

            }
        );

    }

}


function handleVoiceReference(file) {

    const maxBytes =
        MAX_VOICE_SIZE_MB *
        1024 *
        1024;


    if (file.size > maxBytes) {

        showToast(
            "Voice reference is too large. Maximum size is 5 MB.",
            "error"
        );

        clearVoiceReference();

        return;
    }


    if (
        file.type &&
        file.type !== "audio/mpeg"
    ) {

        showToast(
            "Use an MP3 voice reference.",
            "error"
        );

        clearVoiceReference();

        return;
    }


    selectedVoiceFile = file;


    if (liveVoiceFileName) {
        liveVoiceFileName.textContent =
            file.name;
    }


    if (liveVoiceFileMeta) {
        liveVoiceFileMeta.textContent =
            formatFileSize(file.size);
    }


    if (selectedVoiceReference) {
        selectedVoiceReference.classList.remove(
            "d-none"
        );
    }


    updateLiveButton();

}


/* ============================================================
   CLEAR VOICE REFERENCE
   ============================================================ */

function clearVoiceReference() {

    selectedVoiceFile = null;


    if (liveVoiceInput) {
        liveVoiceInput.value = "";
    }


    if (selectedVoiceReference) {
        selectedVoiceReference.classList.add(
            "d-none"
        );
    }


    if (liveVoiceFileName) {
        liveVoiceFileName.textContent = "";
    }


    if (liveVoiceFileMeta) {
        liveVoiceFileMeta.textContent = "";
    }


    updateLiveButton();

}


/* ============================================================
   CAMERA CONTROLS
   ============================================================ */

function setupCameraControls() {

    if (cameraToggleButton) {

        cameraToggleButton.addEventListener(
            "click",
            async function () {

                if (cameraStream) {

                    stopCamera();

                } else {

                    await startCamera();

                }

            }
        );

    }


    if (cameraSettingsButton) {

        cameraSettingsButton.addEventListener(
            "click",
            function () {

                openPermissionPanel();

            }
        );

    }

}


/* ============================================================
   CAMERA ORIENTATION
   ============================================================ */

function setNormalCameraOrientation() {

    if (!cameraPreview) {
        return;
    }


    cameraPreview.style.transform =
        "scaleX(1)";


    cameraPreview.style.webkitTransform =
        "scaleX(1)";


    cameraPreview.style.objectFit =
        "cover";

}


function setNormalAIOutputOrientation() {

    if (!aiOutputPreview) {
        return;
    }


    aiOutputPreview.style.transform =
        "scaleX(1)";


    aiOutputPreview.style.webkitTransform =
        "scaleX(1)";


    aiOutputPreview.style.objectFit =
        "cover";

}


/* ============================================================
   START CAMERA
   ============================================================ */

async function startCamera() {

    if (cameraStarting) {
        return;
    }


    if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
    ) {

        showToast(
            "Your browser does not support camera access.",
            "error"
        );

        return;
    }


    if (!window.isSecureContext) {

        showToast(
            "Camera access requires HTTPS or localhost.",
            "error"
        );

        return;
    }


    cameraStarting = true;

    updateCameraStatus(
        "Connecting..."
    );


    try {

        if (cameraStream) {
            stopCamera();
        }


        let stream = null;


        try {

            stream =
                await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: {
                            ideal: "user"
                        },
                        width: {
                            ideal: 1280
                        },
                        height: {
                            ideal: 720
                        }
                    },
                    audio: false
                });

        } catch (firstError) {

            stream =
                await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: false
                });

        }


        const videoTrack =
            stream.getVideoTracks()[0];


        if (
            !videoTrack ||
            videoTrack.readyState !== "live"
        ) {

            stream.getTracks().forEach(
                function (track) {
                    track.stop();
                }
            );

            throw new Error(
                "Camera track is not active."
            );
        }


        cameraStream = stream;

        cameraPermissionGranted = true;
        cameraEnabled = true;


        if (cameraPreview) {

            cameraPreview.autoplay = true;
            cameraPreview.muted = true;
            cameraPreview.playsInline = true;

            cameraPreview.setAttribute(
                "autoplay",
                ""
            );

            cameraPreview.setAttribute(
                "muted",
                ""
            );

            cameraPreview.setAttribute(
                "playsinline",
                ""
            );

            cameraPreview.srcObject =
                cameraStream;


            /*
               Force normal left-to-right camera
               preview instead of selfie mirroring.
            */
            setNormalCameraOrientation();

        }


        updateCameraStatus(
            "Camera ready"
        );

        updateCameraButton();

        updateDeviceStatus();


        if (cameraPreview) {

            try {

                await cameraPreview.play();

            } catch (playError) {

                console.warn(
                    "Camera preview play failed:",
                    playError
                );

            }

        }


        showCameraPreview();

        updateLiveButton();

    } catch (error) {

        console.error(
            "Camera start error:",
            error
        );

        cameraStream = null;
        cameraEnabled = false;


        handleCameraError(error);

        updateCameraButton();

        updateLiveButton();

    } finally {

        cameraStarting = false;

    }

}


/* ============================================================
   STOP CAMERA
   ============================================================ */

function stopCamera() {

    if (cameraStream) {

        cameraStream
            .getTracks()
            .forEach(function (track) {

                track.stop();

            });

    }


    cameraStream = null;

    cameraEnabled = false;


    if (cameraPreview) {

        cameraPreview.pause();

        cameraPreview.srcObject = null;

    }


    hideCameraPreview();

    updateCameraStatus(
        "Camera off"
    );

    updateCameraButton();

    updateLiveButton();

}


/* ============================================================
   CAMERA PREVIEW
   ============================================================ */

function showCameraPreview() {

    if (cameraPlaceholder) {
        cameraPlaceholder.classList.add(
            "d-none"
        );
    }


    if (cameraLiveBadge) {
        cameraLiveBadge.classList.remove(
            "d-none"
        );
    }


    if (cameraPreview) {

        cameraPreview.style.opacity =
            "1";

        setNormalCameraOrientation();

    }

}


function hideCameraPreview() {

    if (cameraPlaceholder) {
        cameraPlaceholder.classList.remove(
            "d-none"
        );
    }


    if (cameraLiveBadge) {
        cameraLiveBadge.classList.add(
            "d-none"
        );
    }

}


/* ============================================================
   CAMERA STATUS
   ============================================================ */

function updateCameraStatus(message) {

    if (cameraStatus) {
        cameraStatus.textContent = message;
    }

}


/* ============================================================
   CAMERA BUTTON
   ============================================================ */

function updateCameraButton() {

    if (!cameraToggleButton) {
        return;
    }


    if (cameraStream) {

        cameraToggleButton.innerHTML =
            '<i class="bi bi-camera-video-off"></i> Turn Off';

        cameraToggleButton.classList.add(
            "active"
        );

    } else {

        cameraToggleButton.innerHTML =
            '<i class="bi bi-camera-video"></i> Camera';

        cameraToggleButton.classList.remove(
            "active"
        );

    }

}


/* ============================================================
   CAMERA ERRORS
   ============================================================ */

function handleCameraError(error) {

    let message =
        "Unable to access the camera.";


    if (
        error &&
        error.name === "NotAllowedError"
    ) {

        message =
            "Camera permission was denied. Allow camera access in your browser settings.";

    } else if (
        error &&
        error.name === "NotFoundError"
    ) {

        message =
            "No camera was found on this device.";

    } else if (
        error &&
        error.name === "NotReadableError"
    ) {

        message =
            "The camera is already being used by another application.";

    } else if (
        error &&
        error.name === "SecurityError"
    ) {

        message =
            "Camera access was blocked by browser security settings.";

    }


    updateCameraStatus(
        "Camera unavailable"
    );


    showToast(
        message,
        "error"
    );

}


/* ============================================================
   MICROPHONE
   ============================================================ */

async function startMicrophone() {

    if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
    ) {

        showToast(
            "Your browser does not support microphone access.",
            "error"
        );

        return false;
    }


    if (!window.isSecureContext) {

        showToast(
            "Microphone access requires HTTPS or localhost.",
            "error"
        );

        return false;
    }


    try {

        if (microphoneStream) {
            stopMicrophone();
        }


        let audioConstraints = {

            echoCancellation: true,

            noiseSuppression: true,

            autoGainControl: true

        };


        /*
           TEST MODE:
           Do not force selectedAudioInputId.

           This allows the browser/device to use its
           default microphone. On the phone without an
           external microphone connected, this will be
           the phone's built-in microphone.
        */

        if (
            !PHONE_AUDIO_TEST_MODE &&
            selectedAudioInputId
        ) {

            audioConstraints.deviceId = {
                exact: selectedAudioInputId
            };

        }


        microphoneStream =
            await navigator.mediaDevices.getUserMedia({

                audio: audioConstraints,

                video: false

            });


        const track =
            microphoneStream.getAudioTracks()[0];


        if (
            !track ||
            track.readyState !== "live"
        ) {

            stopMicrophone();

            throw new Error(
                "Microphone track is not active."
            );
        }


        microphonePermissionGranted = true;
        microphoneEnabled = true;


        const settings =
            track.getSettings
                ? track.getSettings()
                : {};


        /*
           Keep the actual device ID when the browser
           exposes it, but do not force it in test mode.
        */

        if (settings.deviceId) {

            selectedAudioInputId =
                settings.deviceId;

        }


        updateMicrophoneStatus(
            "Microphone available"
        );

        updateDeviceStatus();

        updateLiveButton();


        return true;

    } catch (error) {

        console.error(
            "Microphone start error:",
            error
        );

        microphoneStream = null;
        microphoneEnabled = false;


        handleMicrophoneError(error);

        updateDeviceStatus();

        updateLiveButton();


        return false;

    }

}


/* ============================================================
   STOP MICROPHONE
   ============================================================ */

function stopMicrophone() {

    stopAudioMonitor();


    if (microphoneStream) {

        microphoneStream
            .getTracks()
            .forEach(function (track) {

                track.stop();

            });

    }


    microphoneStream = null;

    microphoneEnabled = false;


    updateMicrophoneStatus(
        "Microphone off"
    );

    updateDeviceStatus();

    updateLiveButton();

}


/* ============================================================
   MICROPHONE ERROR
   ============================================================ */

function handleMicrophoneError(error) {

    let message =
        "Unable to access the microphone.";


    if (
        error &&
        error.name === "NotAllowedError"
    ) {

        message =
            "Microphone permission was denied.";

    } else if (
        error &&
        error.name === "NotFoundError"
    ) {

        message =
            "No microphone was found.";

    } else if (
        error &&
        error.name === "NotReadableError"
    ) {

        message =
            "The microphone is already being used by another application.";

    }


    updateMicrophoneStatus(
        "Microphone unavailable"
    );


    showToast(
        message,
        "error"
    );

}


/* ============================================================
   MICROPHONE STATUS
   ============================================================ */

function updateMicrophoneStatus(message) {

    if (microphoneDeviceText) {
        microphoneDeviceText.textContent =
            message;
    }

}


/* ============================================================
   DEVICE DETECTION
   ============================================================ */

async function checkAvailableDevices() {

    if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.enumerateDevices
    ) {

        return;

    }


    try {

        const devices =
            await navigator.mediaDevices.enumerateDevices();


        const cameras =
            devices.filter(function (device) {

                return device.kind === "videoinput";

            });


        const microphones =
            devices.filter(function (device) {

                return device.kind === "audioinput";

            });


        const outputs =
            devices.filter(function (device) {

                return device.kind === "audiooutput";

            });


        analyzeMicrophones(
            microphones
        );


        analyzeAudioOutputs(
            outputs
        );


        if (cameraDeviceText) {

            cameraDeviceText.textContent =
                cameras.length > 0
                    ? "Camera available"
                    : "No camera detected";

        }


        if (cameraDeviceStatus) {

            cameraDeviceStatus.classList.toggle(
                "active",
                cameras.length > 0
            );

        }


        updateDeviceStatus();

    } catch (error) {

        console.warn(
            "Device detection failed:",
            error
        );

    }

}


/* ============================================================
   MICROPHONE ANALYSIS
   ============================================================ */

function analyzeMicrophones(
    microphones
) {

    externalMicrophoneAvailable = false;

    earbudMicrophoneAvailable = false;


    const usableMicrophones =
        microphones.filter(function (device) {

            return device.kind === "audioinput";

        });


    usableMicrophones.forEach(
        function (device) {

            const label =
                (device.label || "")
                    .toLowerCase();


            if (
                label.includes("bluetooth") ||
                label.includes("headset") ||
                label.includes("headphone") ||
                label.includes("earbud") ||
                label.includes("earpiece") ||
                label.includes("airpod") ||
                label.includes("wireless") ||
                label.includes("hands-free")
            ) {

                externalMicrophoneAvailable =
                    true;

                earbudMicrophoneAvailable =
                    true;

            }

        }
    );


    /*
       Browser device labels can be hidden until
       microphone permission is granted.

       If the browser exposes more than one
       audio input, treat the additional input
       as an available external microphone.
    */

    if (
        usableMicrophones.length > 1
    ) {

        externalMicrophoneAvailable =
            true;

    }


    /*
       REQUIRED DEVICE MESSAGE
    */

    if (
        !externalMicrophoneAvailable
    ) {

        if (microphoneDeviceText) {

            microphoneDeviceText.textContent =
                "Earbud or earpiece is needed";

        }

    } else {

        if (microphoneDeviceText) {

            microphoneDeviceText.textContent =
                "Microphone is available";

        }

    }


    if (microphoneDeviceStatus) {

        microphoneDeviceStatus.classList.toggle(
            "active",
            usableMicrophones.length > 0
        );

    }

}


/* ============================================================
   AUDIO OUTPUT ANALYSIS
   ============================================================ */

function analyzeAudioOutputs(
    outputs
) {

    earbudOutputAvailable = false;


    outputs.forEach(
        function (device) {

            const label =
                (device.label || "")
                    .toLowerCase();


            if (
                label.includes("bluetooth") ||
                label.includes("headset") ||
                label.includes("headphone") ||
                label.includes("earbud") ||
                label.includes("earpiece") ||
                label.includes("airpod") ||
                label.includes("wireless")
            ) {

                earbudOutputAvailable =
                    true;

            }

        }
    );

}


/* ============================================================
   DEVICE STATUS
   ============================================================ */

function updateDeviceStatus() {

    if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.enumerateDevices
    ) {

        return;

    }


    checkAvailableDevices();

}


/* ============================================================
   AUDIO DEVICE LISTENER
   ============================================================ */

function setupAudioDeviceListener() {

    if (
        navigator.mediaDevices &&
        "ondevicechange" in navigator.mediaDevices
    ) {

        navigator.mediaDevices.addEventListener(
            "devicechange",
            async function () {

                await checkAvailableDevices();

                await prepareAudioOutput();

            }
        );

    }

}


/* ============================================================
   AUDIO OUTPUT
   ============================================================ */

async function prepareAudioOutput() {

    if (!aiOutputPreview) {
        return;
    }


    /*
       TEST MODE:
       Always use the browser/device default audio
       output instead of automatically selecting an earbud.

       setSinkId("") means use the default output
       device where supported.
    */

    if (
        PHONE_AUDIO_TEST_MODE
    ) {

        selectedAudioOutputId = "";

        try {

            if (
                typeof aiOutputPreview.setSinkId ===
                "function"
            ) {

                await aiOutputPreview.setSinkId("");

            }

        } catch (error) {

            console.warn(
                "Unable to reset audio output to default:",
                error
            );

        }


        /*
           Make sure the audio is actually audible.
        */

        aiOutputPreview.muted = false;
        aiOutputPreview.volume = 1;


        return;

    }


    if (
        typeof aiOutputPreview.setSinkId !==
        "function"
    ) {

        return;

    }


    try {

        const devices =
            await navigator.mediaDevices.enumerateDevices();


        const outputs =
            devices.filter(function (device) {

                return device.kind === "audiooutput";

            });


        const preferredOutput =
            outputs.find(function (device) {

                const label =
                    (device.label || "")
                        .toLowerCase();


                return (
                    label.includes("bluetooth") ||
                    label.includes("earbud") ||
                    label.includes("earpiece") ||
                    label.includes("headset") ||
                    label.includes("headphone") ||
                    label.includes("airpod") ||
                    label.includes("wireless")
                );

            });


        if (preferredOutput) {

            selectedAudioOutputId =
                preferredOutput.deviceId;

            earbudOutputAvailable = true;

            await aiOutputPreview.setSinkId(
                preferredOutput.deviceId
            );

        }

    } catch (error) {

        console.warn(
            "Unable to select audio output:",
            error
        );

    }

}


/* ============================================================
   VOICE MONITOR
   ============================================================ */

async function startAudioMonitor() {

    if (!microphoneStream) {
        return;
    }


    stopAudioMonitor();


    if (
        typeof AudioContext === "undefined" &&
        typeof webkitAudioContext === "undefined"
    ) {

        showToast(
            "Your browser does not support live audio monitoring.",
            "error"
        );

        return;

    }


    try {

        const AudioContextClass =
            window.AudioContext ||
            window.webkitAudioContext;


        audioContext =
            new AudioContextClass();


        microphoneSourceNode =
            audioContext.createMediaStreamSource(
                microphoneStream
            );


        microphoneGainNode =
            audioContext.createGain();


        microphoneGainNode.gain.value =
            1;


        microphoneDestinationNode =
            audioContext.createMediaStreamDestination();


        microphoneSourceNode.connect(
            microphoneGainNode
        );


        microphoneGainNode.connect(
            microphoneDestinationNode
        );


        /*
           IMPORTANT:

           The microphone destination stream is sent
           into the AI output video element.

           In PHONE_AUDIO_TEST_MODE the video element
           uses the phone's default speaker.
        */

        if (aiOutputPreview) {

            aiOutputPreview.srcObject =
                microphoneDestinationNode.stream;

            aiOutputPreview.autoplay = true;

            aiOutputPreview.muted = false;

            aiOutputPreview.volume = 1;

            aiOutputPreview.playsInline = true;

            aiOutputPreview.setAttribute(
                "autoplay",
                ""
            );

            aiOutputPreview.removeAttribute(
                "muted"
            );

            aiOutputPreview.setAttribute(
                "playsinline",
                ""
            );


            /*
               Keep the AI output display normal too.
            */

            setNormalAIOutputOrientation();


            /*
               Make sure the output goes to the
               phone's default speaker in test mode.
            */

            await prepareAudioOutput();

        }


        if (
            audioContext.state ===
            "suspended"
        ) {

            await audioContext.resume();

        }


        if (aiOutputPreview) {

            try {

                await aiOutputPreview.play();

            } catch (error) {

                console.warn(
                    "Audio monitor play failed:",
                    error
                );

                /*
                   On some mobile browsers, audio
                   playback can require a user gesture.
                   Since Live is normally started from
                   a button click, pressing Live again
                   should provide that gesture.
                */

            }

        }

    } catch (error) {

        console.warn(
            "Audio monitor failed:",
            error
        );

        stopAudioMonitor();

        showToast(
            "Unable to start microphone audio monitor.",
            "error"
        );

    }

}


/* ============================================================
   STOP VOICE MONITOR
   ============================================================ */

function stopAudioMonitor() {

    if (microphoneSourceNode) {

        try {
            microphoneSourceNode.disconnect();
        } catch (error) {}

    }


    if (microphoneGainNode) {

        try {
            microphoneGainNode.disconnect();
        } catch (error) {}

    }


    if (audioContext) {

        try {
            audioContext.close();
        } catch (error) {}

    }


    microphoneSourceNode = null;
    microphoneGainNode = null;
    microphoneDestinationNode = null;
    audioContext = null;

}


/* ============================================================
   LIVE BUTTON
   ============================================================ */

function setupLiveButton() {

    if (!liveButton) {
        return;
    }


    liveButton.addEventListener(
        "click",
        async function () {

            if (liveSessionActive) {

                stopLiveSession();

                return;

            }


            await startLiveSession();

        }
    );

}


/* ============================================================
   VALIDATE LIVE SETUP
   ============================================================ */

function validateLiveSetup() {

    if (!cameraStream) {

        return {
            valid: false,
            message:
                "Turn on your camera before starting Live."
        };

    }


    if (
        (
            selectedMode === "voice" ||
            selectedMode === "face-voice"
        ) &&
        !microphoneStream
    ) {

        return {
            valid: false,
            message:
                "Turn on your microphone before starting Voice mode."
        };

    }


    /*
       Current prototype uses your own face and
       your own voice.

       Face and voice reference uploads are therefore
       optional for now. They remain available for
       future target transformation.
    */


    if (
        availableCredits <= 0
    ) {

        return {
            valid: false,
            message:
                "You do not have enough credits."
        };

    }


    return {
        valid: true,
        message: ""
    };

}


/* ============================================================
   START LIVE SESSION
   ============================================================ */

async function startLiveSession() {

    if (
        liveSessionActive ||
        connectionInProgress
    ) {

        return;

    }


    /*
       For the phone-mic test, automatically start
       the microphone when Voice mode is selected.

       This makes testing easier from the Live button.
    */

    if (
        selectedMode === "voice" ||
        selectedMode === "face-voice"
    ) {

        if (!microphoneStream) {

            const microphoneStarted =
                await startMicrophone();


            if (!microphoneStarted) {

                showToast(
                    "Unable to start your phone microphone.",
                    "error"
                );

                return;

            }

        }

    }


    const validation =
        validateLiveSetup();


    if (!validation.valid) {

        showToast(
            validation.message,
            "error"
        );

        return;

    }


    connectionInProgress = true;

    updateLiveButtonState(
        "loading"
    );


    try {

        /*
           For Voice and Face + Voice, make sure
           the microphone is active.
        */

        if (
            selectedMode === "voice" ||
            selectedMode === "face-voice"
        ) {

            if (!microphoneStream) {

                const microphoneStarted =
                    await startMicrophone();


                if (!microphoneStarted) {

                    throw new Error(
                        "Microphone could not be started."
                    );

                }

            }

        }


        await connectToAISimulation();


        liveSessionActive = true;

        connectionInProgress = false;

        sessionStartTime =
            Date.now();

        creditsUsed = 0;


        if (liveSessionPanel) {
            liveSessionPanel.classList.remove(
                "d-none"
            );
        }


        if (liveSessionMessage) {

            liveSessionMessage.textContent =
                "Live transformation is active.";

        }


        if (sessionMode) {

            sessionMode.textContent =
                getModeLabel();

        }


        startSessionTimer();

        startUsageTimer();


        updateLiveButtonState(
            "active"
        );


        updateUsageUI();


    } catch (error) {

        console.error(
            "Live session failed:",
            error
        );


        connectionInProgress = false;

        liveSessionActive = false;


        stopAISimulation();


        updateLiveButtonState(
            "normal"
        );


        showToast(
            error.message ||
                "Unable to start Live.",
            "error"
        );

    }

}


/* ============================================================
   CONNECT TO AI SIMULATION
   ============================================================ */

async function connectToAISimulation() {

    if (aiProcessingOverlay) {

        aiProcessingOverlay.classList.remove(
            "d-none"
        );

    }


    if (aiProcessingText) {

        aiProcessingText.textContent =
            "Connecting to AI service...";

    }


    if (aiStatus) {
        aiStatus.textContent =
            "Connecting...";
    }


    await wait(900);


    if (!navigator.onLine) {

        throw new Error(
            "You are offline."
        );

    }


    /*
       Frontend prototype:

       Face mode:
       Camera → AI output simulation

       Voice mode:
       Phone microphone → browser audio monitor
       → phone speaker

       Face + Voice:
       Camera → AI video simulation
       Phone microphone → browser audio monitor
       → phone speaker

       Actual Decart/Lucy and Voice.ai
       integration will be added later.
    */


    if (
        selectedMode === "face" ||
        selectedMode === "face-voice"
    ) {

        if (
            cameraStream &&
            aiOutputPreview
        ) {

            aiOutputStream =
                cameraStream;

            aiOutputPreview.srcObject =
                aiOutputStream;

            aiOutputPreview.autoplay = true;
            aiOutputPreview.playsInline = true;

            aiOutputPreview.muted = true;

            setNormalAIOutputOrientation();


            try {

                await aiOutputPreview.play();

            } catch (error) {

                console.warn(
                    "AI preview play failed:",
                    error
                );

            }

        }

    }


    if (
        selectedMode === "voice" ||
        selectedMode === "face-voice"
    ) {

        await startAudioMonitor();

    }


    if (aiProcessingOverlay) {

        aiProcessingOverlay.classList.add(
            "d-none"
        );

    }


    if (aiLiveBadge) {

        aiLiveBadge.classList.remove(
            "d-none"
        );

    }


    if (aiOutputPlaceholder) {

        aiOutputPlaceholder.classList.add(
            "d-none"
        );

    }


    if (aiStatus) {

        aiStatus.textContent =
            "Connected";

    }


    if (outputConnectionText) {

        outputConnectionText.textContent =
            PHONE_AUDIO_TEST_MODE
                ? "Phone audio test"
                : "Live connection";

    }


    if (outputLatency) {

        outputLatency.textContent =
            "Low latency";

    }


    if (liveConnectionLatency) {

        liveConnectionLatency.textContent =
            "Connected";

    }

}


/* ============================================================
   STOP AI SIMULATION
   ============================================================ */

function stopAISimulation() {

    stopAudioMonitor();


    if (aiOutputPreview) {

        aiOutputPreview.pause();

        aiOutputPreview.srcObject = null;

        aiOutputPreview.muted = true;

    }


    aiOutputStream = null;


    if (aiLiveBadge) {

        aiLiveBadge.classList.add(
            "d-none"
        );

    }


    if (aiOutputPlaceholder) {

        aiOutputPlaceholder.classList.remove(
            "d-none"
        );

    }


    if (aiProcessingOverlay) {

        aiProcessingOverlay.classList.add(
            "d-none"
        );

    }


    if (aiStatus) {

        aiStatus.textContent =
            "Ready";

    }


    if (outputConnectionText) {

        outputConnectionText.textContent =
            "Not connected";

    }


    if (liveConnectionLatency) {

        liveConnectionLatency.textContent =
            "Not connected";

    }

}


/* ============================================================
   STOP LIVE SESSION
   ============================================================ */

function stopLiveSession() {

    if (!liveSessionActive) {

        stopAISimulation();

        updateLiveButtonState(
            "normal"
        );

        return;

    }


    liveSessionActive = false;

    connectionInProgress = false;


    stopSessionTimer();

    stopUsageTimer();

    stopAISimulation();


    if (liveSessionMessage) {

        liveSessionMessage.textContent =
            "Live session ended.";

    }


    if (sessionTimer) {
        sessionTimer.textContent =
            formatDuration(
                sessionStartTime
                    ? Date.now() - sessionStartTime
                    : 0
            );
    }


    if (sessionCredits) {

        sessionCredits.textContent =
            formatCredits(creditsUsed);

    }


    updateLiveButtonState(
        "normal"
    );

    updateUsageUI();

}


/* ============================================================
   SESSION TIMER
   ============================================================ */

function startSessionTimer() {

    stopSessionTimer();


    sessionTimerInterval =
        setInterval(
            function () {

                if (
                    !liveSessionActive ||
                    !sessionStartTime
                ) {
                    return;
                }


                const elapsed =
                    Date.now() -
                    sessionStartTime;


                if (sessionTimer) {

                    sessionTimer.textContent =
                        formatDuration(
                            elapsed
                        );

                }

            },
            1000
        );

}


function stopSessionTimer() {

    if (sessionTimerInterval) {

        clearInterval(
            sessionTimerInterval
        );

        sessionTimerInterval = null;

    }

}


/* ============================================================
   CREDIT USAGE TIMER
   ============================================================ */

function startUsageTimer() {

    stopUsageTimer();


    usageTimerInterval =
        setInterval(
            function () {

                if (
                    !liveSessionActive ||
                    !sessionStartTime
                ) {
                    return;
                }


                const elapsedSeconds =
                    (
                        Date.now() -
                        sessionStartTime
                    ) / 1000;


                creditsUsed =
                    Math.min(
                        availableCredits,
                        (
                            elapsedSeconds / 60
                        ) *
                        CREDIT_RATES[selectedMode]
                    );


                const remaining =
                    Math.max(
                        0,
                        availableCredits -
                        creditsUsed
                    );


                updateCreditsDisplay(
                    remaining
                );


                if (sessionCredits) {

                    sessionCredits.textContent =
                        formatCredits(
                            creditsUsed
                        );

                }


                if (
                    remaining <= 0
                ) {

                    showToast(
                        "Your credits have run out. Live has stopped.",
                        "error"
                    );

                    stopLiveSession();

                }

            },
            1000
        );

}


function stopUsageTimer() {

    if (usageTimerInterval) {

        clearInterval(
            usageTimerInterval
        );

        usageTimerInterval = null;

    }

}


/* ============================================================
   USAGE UI
   ============================================================ */

function updateUsageUI() {

    const rate =
        CREDIT_RATES[selectedMode];


    if (liveUsageRate) {

        liveUsageRate.textContent =
            formatCredits(rate) +
            " credits/min";

    }


    if (liveUsageEstimateText) {

        liveUsageEstimateText.textContent =
            "Estimated usage: " +
            formatCredits(rate) +
            " credits per minute.";

    }


    if (liveCreditsUsed) {

        liveCreditsUsed.textContent =
            formatCredits(
                creditsUsed
            );

    }


    updateCreditsDisplay(
        Math.max(
            0,
            availableCredits -
            creditsUsed
        )
    );


    if (headerCredits) {

        headerCredits.textContent =
            formatCredits(
                Math.max(
                    0,
                    availableCredits -
                    creditsUsed
                )
            );

    }

}


/* ============================================================
   CREDIT DISPLAY
   ============================================================ */

function updateCreditsDisplay(
    remaining
) {

    const value =
        formatCredits(remaining);


    if (liveCreditsRemaining) {

        liveCreditsRemaining.textContent =
            value;

    }


    if (headerCredits) {

        headerCredits.textContent =
            value;

    }


    if (window.AIStudioDashboard) {

        if (
            typeof window.AIStudioDashboard
                .updateCredits ===
            "function"
        ) {

            window.AIStudioDashboard
                .updateCredits(value);

        }

    }

}


/* ============================================================
   LIVE BUTTON STATE
   ============================================================ */

function updateLiveButtonState(
    state
) {

    if (!liveButton) {
        return;
    }


    if (state === "loading") {

        liveButton.disabled = true;


        if (liveButtonNormal) {
            liveButtonNormal.classList.add(
                "d-none"
            );
        }


        if (liveButtonLoading) {
            liveButtonLoading.classList.remove(
                "d-none"
            );
        }


        if (liveButtonStop) {
            liveButtonStop.classList.add(
                "d-none"
            );
        }


        return;

    }


    if (state === "active") {

        liveButton.disabled = false;


        if (liveButtonNormal) {
            liveButtonNormal.classList.add(
                "d-none"
            );
        }


        if (liveButtonLoading) {
            liveButtonLoading.classList.add(
                "d-none"
            );
        }


        if (liveButtonStop) {
            liveButtonStop.classList.remove(
                "d-none"
            );
        }


        liveButton.classList.add(
            "active"
        );


        return;

    }


    liveButton.classList.remove(
        "active"
    );


    if (liveButtonNormal) {
        liveButtonNormal.classList.remove(
            "d-none"
        );
    }


    if (liveButtonLoading) {
        liveButtonLoading.classList.add(
            "d-none"
        );
    }


    if (liveButtonStop) {
        liveButtonStop.classList.add(
            "d-none"
        );
    }


    updateLiveButton();

}


/* ============================================================
   UPDATE LIVE BUTTON
   ============================================================ */

function updateLiveButton() {

    if (!liveButton) {
        return;
    }


    if (liveSessionActive) {

        liveButton.disabled = false;

        return;

    }


    if (connectionInProgress) {

        liveButton.disabled = true;

        return;

    }


    const validation =
        validateLiveSetup();


    liveButton.disabled =
        !validation.valid;

}


/* ============================================================
   QUALITY CONTROL
   ============================================================ */

function setupQualityControl() {

    if (!liveQualitySelect) {
        return;
    }


    liveQualitySelect.addEventListener(
        "change",
        function () {

            updateUsageUI();

        }
    );

}


/* ============================================================
   STREAMING BUTTONS
   ============================================================ */

function setupStreamingButtons() {

    if (browserStreamButton) {

        browserStreamButton.addEventListener(
            "click",
            function () {

                showToast(
                    "Browser streaming will be connected during the backend phase.",
                    "info"
                );

            }
        );

    }


    if (obsButton) {

        obsButton.addEventListener(
            "click",
            function () {

                showToast(
                    "OBS streaming will be connected during the backend phase.",
                    "info"
                );

            }
        );

    }

}


/* ============================================================
   PERMISSION PANEL
   ============================================================ */

function createPermissionPanel() {

    if (
        document.getElementById(
            "livePermissionPanel"
        )
    ) {

        permissionPanel =
            document.getElementById(
                "livePermissionPanel"
            );

        return;

    }


    permissionPanel =
        document.createElement(
            "div"
        );


    permissionPanel.id =
        "livePermissionPanel";


    permissionPanel.innerHTML = `

        <div
            class="live-permission-backdrop"
            id="permissionBackdrop"
        ></div>

        <div
            class="live-permission-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="livePermissionTitle"
        >

            <div class="live-permission-header">

                <div>

                    <div class="live-permission-eyebrow">
                        DEVICE SETTINGS
                    </div>

                    <h3 id="livePermissionTitle">
                        Camera & Microphone
                    </h3>

                </div>

                <button
                    type="button"
                    class="live-permission-close"
                    id="permissionCloseButton"
                    aria-label="Close settings"
                >
                    <i class="bi bi-x-lg"></i>
                </button>

            </div>


            <div class="live-permission-devices">

                <div
                    class="live-permission-device"
                    id="permissionCameraRow"
                >

                    <div class="live-permission-device-icon">
                        <i class="bi bi-camera-video"></i>
                    </div>

                    <div class="live-permission-device-info">

                        <strong>
                            Camera
                        </strong>

                        <span
                            id="permissionCameraStatus"
                        >
                            Checking...
                        </span>

                    </div>

                    <button
                        type="button"
                        class="live-permission-action"
                        id="permissionCameraButton"
                    >
                        Allow
                    </button>

                </div>


                <div
                    class="live-permission-device"
                    id="permissionMicrophoneRow"
                >

                    <div class="live-permission-device-icon">
                        <i class="bi bi-mic"></i>
                    </div>

                    <div class="live-permission-device-info">

                        <strong>
                            Microphone
                        </strong>

                        <span
                            id="permissionMicrophoneStatus"
                        >
                            Checking...
                        </span>

                    </div>

                    <button
                        type="button"
                        class="live-permission-action"
                        id="permissionMicrophoneButton"
                    >
                        Allow
                    </button>

                </div>

            </div>


            <div class="live-permission-divider"></div>


            <div class="live-permission-footer">

                <div>

                    <strong>
                        Audio output
                    </strong>

                    <div
                        class="live-permission-note"
                        id="permissionOutputStatus"
                    >
                        Phone speaker will be used for this test.
                    </div>

                </div>

                <button
                    type="button"
                    class="live-permission-refresh"
                    id="permissionRefreshButton"
                >
                    <i class="bi bi-arrow-clockwise"></i>
                    Refresh
                </button>

            </div>

        </div>
    `;


    document.body.appendChild(
        permissionPanel
    );


    addPermissionPanelStyles();


    const backdrop =
        document.getElementById(
            "permissionBackdrop"
        );


    const closeButton =
        document.getElementById(
            "permissionCloseButton"
        );


    const refreshButton =
        document.getElementById(
            "permissionRefreshButton"
        );


    const cameraButton =
        document.getElementById(
            "permissionCameraButton"
        );


    const microphoneButton =
        document.getElementById(
            "permissionMicrophoneButton"
        );


    if (backdrop) {

        backdrop.addEventListener(
            "click",
            closePermissionPanel
        );

    }


    if (closeButton) {

        closeButton.addEventListener(
            "click",
            closePermissionPanel
        );

    }


    if (refreshButton) {

        refreshButton.addEventListener(
            "click",
            async function () {

                await checkAvailableDevices();

                updatePermissionPanel();

            }
        );

    }


    if (cameraButton) {

        cameraButton.addEventListener(
            "click",
            async function () {

                await requestCameraPermission();

                updatePermissionPanel();

            }
        );

    }


    if (microphoneButton) {

        microphoneButton.addEventListener(
            "click",
            async function () {

                await requestMicrophonePermission();

                updatePermissionPanel();

            }
        );

    }

}


/* ============================================================
   OPEN SETTINGS
   ============================================================ */

function openPermissionPanel() {

    if (!permissionPanel) {

        createPermissionPanel();

    }


    permissionPanel.classList.add(
        "open"
    );


    document.body.style.overflow =
        "hidden";


    updatePermissionPanel();

}


/* ============================================================
   CLOSE SETTINGS
   ============================================================ */

function closePermissionPanel() {

    if (!permissionPanel) {
        return;
    }


    permissionPanel.classList.remove(
        "open"
    );


    document.body.style.overflow =
        "";

}


/* ============================================================
   PERMISSION PANEL UPDATE
   ============================================================ */

async function updatePermissionPanel() {

    if (!permissionPanel) {
        return;
    }


    const cameraStatusElement =
        document.getElementById(
            "permissionCameraStatus"
        );


    const microphoneStatusElement =
        document.getElementById(
            "permissionMicrophoneStatus"
        );


    const cameraButton =
        document.getElementById(
            "permissionCameraButton"
        );


    const microphoneButton =
        document.getElementById(
            "permissionMicrophoneButton"
        );


    const outputStatus =
        document.getElementById(
            "permissionOutputStatus"
        );


    const cameraState =
        await getPermissionState(
            "camera"
        );


    const microphoneState =
        await getPermissionState(
            "microphone"
        );


    if (cameraStatusElement) {

        cameraStatusElement.textContent =
            cameraState.text;

    }


    if (microphoneStatusElement) {

        /*
           Important requirement:

           If there is no microphone other than
           the phone's built-in microphone, show:

           "Earbud or earpiece is needed"

           If the browser detects another mic,
           show:

           "Microphone is available"
        */

        if (
            externalMicrophoneAvailable
        ) {

            microphoneStatusElement.textContent =
                "Microphone is available";

        } else {

            microphoneStatusElement.textContent =
                "Earbud or earpiece is needed";

        }

    }


    if (cameraButton) {

        updatePermissionActionButton(
            cameraButton,
            cameraState
        );

    }


    if (microphoneButton) {

        updatePermissionActionButton(
            microphoneButton,
            microphoneState
        );

    }


    if (outputStatus) {

        if (PHONE_AUDIO_TEST_MODE) {

            outputStatus.textContent =
                "Phone speaker is being used for this test.";

        } else if (earbudOutputAvailable) {

            outputStatus.textContent =
                "Earbud output detected. Earbud speaker is preferred.";

        } else {

            outputStatus.textContent =
                "No earbud detected. Phone speaker will be used.";

        }

    }

}


/* ============================================================
   PERMISSION STATE
   ============================================================ */

async function getPermissionState(
    type
) {

    if (
        navigator.permissions &&
        navigator.permissions.query
    ) {

        try {

            const permission =
                await navigator.permissions.query({
                    name: type
                });


            if (
                permission.state ===
                "granted"
            ) {

                return {
                    state: "granted",
                    text: "Permission granted"
                };

            }


            if (
                permission.state ===
                "denied"
            ) {

                return {
                    state: "denied",
                    text: "Permission denied"
                };

            }

        } catch (error) {

            console.warn(
                "Permission query failed:",
                error
            );

        }

    }


    if (
        type === "camera" &&
        cameraPermissionGranted
    ) {

        return {
            state: "granted",
            text: "Permission granted"
        };

    }


    if (
        type === "microphone" &&
        microphonePermissionGranted
    ) {

        return {
            state: "granted",
            text: "Permission granted"
        };

    }


    return {
        state: "unknown",
        text: "Permission not requested"
    };

}


/* ============================================================
   PERMISSION BUTTON
   ============================================================ */

function updatePermissionActionButton(
    button,
    state
) {

    button.classList.remove(
        "granted",
        "denied"
    );


    if (state.state === "granted") {

        button.textContent =
            "Granted";

        button.classList.add(
            "granted"
        );

        return;

    }


    if (state.state === "denied") {

        button.textContent =
            "Blocked";

        button.classList.add(
            "denied"
        );

        return;

    }


    button.textContent =
        "Allow";

}


/* ============================================================
   REQUEST CAMERA PERMISSION
   ============================================================ */

async function requestCameraPermission() {

    await startCamera();

}


/* ============================================================
   REQUEST MICROPHONE PERMISSION
   ============================================================ */

async function requestMicrophonePermission() {

    const success =
        await startMicrophone();


    if (success) {

        /*
           Enumerating devices after permission
           reveals more useful device labels on
           browsers that hide them before permission.
        */

        await checkAvailableDevices();

    }

}


/* ============================================================
   PERMISSION PANEL STYLES
   ============================================================ */

function addPermissionPanelStyles() {

    if (
        document.getElementById(
            "livePermissionPanelStyles"
        )
    ) {

        return;

    }


    const style =
        document.createElement(
            "style"
        );


    style.id =
        "livePermissionPanelStyles";


    style.textContent = `

        #livePermissionPanel {
            position: fixed;
            inset: 0;
            z-index: 9999;
            visibility: hidden;
            pointer-events: none;
        }


        #livePermissionPanel.open {
            visibility: visible;
            pointer-events: auto;
        }


        .live-permission-backdrop {
            position: absolute;
            inset: 0;
            background: rgba(0, 0, 0, 0.72);
            backdrop-filter: blur(8px);
            opacity: 0;
            transition: opacity 0.25s ease;
        }


        #livePermissionPanel.open
        .live-permission-backdrop {
            opacity: 1;
        }


        .live-permission-modal {
            position: absolute;
            top: 50%;
            left: 50%;
            width: min(92vw, 520px);
            max-height: 90vh;
            overflow-y: auto;
            transform: translate(-50%, -46%);
            background: #0d0d12;
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 22px;
            box-shadow: 0 30px 80px rgba(0, 0, 0, 0.55);
            opacity: 0;
            transition:
                opacity 0.25s ease,
                transform 0.25s ease;
        }


        #livePermissionPanel.open
        .live-permission-modal {
            opacity: 1;
            transform: translate(-50%, -50%);
        }


        .live-permission-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 20px;
            padding: 24px;
        }


        .live-permission-eyebrow {
            margin-bottom: 7px;
            color: #8f8f9c;
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 0.14em;
        }


        .live-permission-header h3 {
            margin: 0;
            color: #ffffff;
            font-size: 20px;
            font-weight: 700;
        }


        .live-permission-close {
            width: 38px;
            height: 38px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 11px;
            background: rgba(255,255,255,0.04);
            color: #ffffff;
            cursor: pointer;
        }


        .live-permission-devices {
            padding: 0 24px 8px;
        }


        .live-permission-device {
            display: flex;
            align-items: center;
            gap: 14px;
            padding: 16px 0;
        }


        .live-permission-device-icon {
            width: 44px;
            height: 44px;
            flex: 0 0 44px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            border-radius: 13px;
            background: rgba(255,255,255,0.06);
            color: #ffffff;
            font-size: 18px;
        }


        .live-permission-device-info {
            min-width: 0;
            flex: 1;
        }


        .live-permission-device-info strong {
            display: block;
            color: #ffffff;
            font-size: 14px;
        }


        .live-permission-device-info span {
            display: block;
            margin-top: 3px;
            color: #858592;
            font-size: 12px;
        }


        .live-permission-action {
            border: 1px solid rgba(255,255,255,0.12);
            border-radius: 10px;
            padding: 8px 13px;
            background: rgba(255,255,255,0.05);
            color: #ffffff;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
        }


        .live-permission-action.granted {
            border-color: rgba(75, 220, 140, 0.25);
            color: #6ee7a1;
        }


        .live-permission-action.denied {
            border-color: rgba(255, 90, 90, 0.25);
            color: #ff8585;
        }


        .live-permission-divider {
            height: 1px;
            margin: 0 24px;
            background: rgba(255,255,255,0.08);
        }


        .live-permission-footer {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 18px;
            padding: 20px 24px 24px;
        }


        .live-permission-footer strong {
            color: #ffffff;
            font-size: 13px;
        }


        .live-permission-note {
            max-width: 300px;
            margin-top: 5px;
            color: #858592;
            font-size: 11px;
            line-height: 1.5;
        }


        .live-permission-refresh {
            display: inline-flex;
            align-items: center;
            gap: 7px;
            white-space: nowrap;
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 10px;
            padding: 9px 12px;
            background: rgba(255,255,255,0.04);
            color: #ffffff;
            font-size: 12px;
            cursor: pointer;
        }


        @media (max-width: 480px) {

            .live-permission-modal {
                width: calc(100vw - 24px);
                border-radius: 18px;
            }


            .live-permission-header {
                padding: 20px;
            }


            .live-permission-devices {
                padding: 0 20px 8px;
            }


            .live-permission-divider {
                margin: 0 20px;
            }


            .live-permission-footer {
                align-items: flex-start;
                flex-direction: column;
                padding: 18px 20px 20px;
            }


            .live-permission-note {
                max-width: none;
            }

        }

    `;


    document.head.appendChild(
        style
    );

}


/* ============================================================
   TOAST
   ============================================================ */

function showToast(
    message,
    type = "info"
) {

    let toast =
        document.querySelector(
            ".dashboard-toast"
        );


    if (!toast) {

        toast =
            document.createElement(
                "div"
            );

        toast.className =
            "dashboard-toast";

        document.body.appendChild(
            toast
        );

    }


    toast.textContent =
        message;


    toast.classList.remove(
        "show",
        "error",
        "success",
        "info"
    );


    toast.classList.add(
        type
    );


    requestAnimationFrame(
        function () {

            toast.classList.add(
                "show"
            );

        }
    );


    clearTimeout(
        toast._hideTimer
    );


    toast._hideTimer =
        setTimeout(
            function () {

                toast.classList.remove(
                    "show"
                );

            },
            3500
        );

}


/* ============================================================
   HELPERS
   ============================================================ */

function wait(
    milliseconds
) {

    return new Promise(
        function (resolve) {

            setTimeout(
                resolve,
                milliseconds
            );

        }
    );

}


function formatFileSize(
    bytes
) {

    if (!bytes) {
        return "0 KB";
    }


    const megabytes =
        bytes /
        (
            1024 *
            1024
        );


    if (megabytes >= 1) {

        return (
            megabytes.toFixed(2) +
            " MB"
        );

    }


    return (
        Math.max(
            1,
            Math.round(
                bytes / 1024
            )
        ) +
        " KB"
    );

}


function formatCredits(
    value
) {

    return Number(
        value || 0
    ).toFixed(1);

}


function formatDuration(
    milliseconds
) {

    const totalSeconds =
        Math.floor(
            milliseconds / 1000
        );


    const hours =
        Math.floor(
            totalSeconds / 3600
        );


    const minutes =
        Math.floor(
            (
                totalSeconds % 3600
            ) / 60
        );


    const seconds =
        totalSeconds % 60;


    return [
        String(hours).padStart(2, "0"),
        String(minutes).padStart(2, "0"),
        String(seconds).padStart(2, "0")
    ].join(":");

}


function getModeLabel() {

    if (selectedMode === "face") {
        return "Face";
    }


    if (selectedMode === "voice") {
        return "Voice";
    }


    return "Face + Voice";

}


/* ============================================================
   KEYBOARD
   ============================================================ */

document.addEventListener(
    "keydown",
    function (event) {

        if (
            event.key === "Escape" &&
            permissionPanel &&
            permissionPanel.classList.contains(
                "open"
            )
        ) {

            closePermissionPanel();

        }

    }
);


/* ============================================================
   PUBLIC API
   ============================================================ */

window.AIStudioLive = {

    getMode: function () {

        return selectedMode;

    },


    getSessionState: function () {

        return {

            active:
                liveSessionActive,

            connecting:
                connectionInProgress,

            mode:
                selectedMode,

            creditsUsed:
                creditsUsed,

            creditsRemaining:
                Math.max(
                    0,
                    availableCredits -
                    creditsUsed
                )

        };

    },


    getReferences: function () {

        return {

            face:
                selectedFaceFile,

            voice:
                selectedVoiceFile

        };

    },


    getMediaStreams: function () {

        return {

            camera:
                cameraStream,

            microphone:
                microphoneStream,

            aiOutput:
                aiOutputStream

        };

    },


    getAudioDevices: function () {

        return {

            externalMicrophoneAvailable:
                externalMicrophoneAvailable,

            earbudMicrophoneAvailable:
                earbudMicrophoneAvailable,

            earbudOutputAvailable:
                earbudOutputAvailable,

            inputDeviceId:
                selectedAudioInputId,

            outputDeviceId:
                selectedAudioOutputId

        };

    },


    startCamera:
        startCamera,


    stopCamera:
        stopCamera,


    startMicrophone:
        startMicrophone,


    stopMicrophone:
        stopMicrophone,


    startLive:
        startLiveSession,


    stopLive:
        stopLiveSession,


    openSettings:
        openPermissionPanel

};