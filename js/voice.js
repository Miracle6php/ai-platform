document.addEventListener("DOMContentLoaded", function () {

    "use strict";


    /* =========================================================
       ELEMENTS
       ========================================================= */

    const mediaTypeSwitch =
        document.getElementById("mediaTypeSwitch");

    const audioInput =
        document.getElementById("audioInput");

    const selectAudioButton =
        document.getElementById("selectAudioButton");

    const replaceAudioButton =
        document.getElementById("replaceAudioButton");

    const removeAudioButton =
        document.getElementById("removeAudioButton");

    const audioUploadArea =
        document.getElementById("audioUploadArea");

    const audioPreviewContainer =
        document.getElementById("audioPreviewContainer");

    const sourceAudio =
        document.getElementById("sourceAudio");

    const sourceVideo =
        document.getElementById("sourceVideo");

    const audioStatus =
        document.getElementById("audioStatus");

    const audioFileName =
        document.getElementById("audioFileName");

    const audioFileMeta =
        document.getElementById("audioFileMeta");

    const audioFileDetails =
        document.getElementById("audioFileDetails");


    const libraryVoiceButton =
        document.getElementById("libraryVoiceButton");

    const cloneVoiceButton =
        document.getElementById("cloneVoiceButton");

    const voiceLibrary =
        document.getElementById("voiceLibrary");

    const voiceCloneArea =
        document.getElementById("voiceCloneArea");

    const voiceStatus =
        document.getElementById("voiceStatus");

    const voiceCards =
        document.querySelectorAll(".voice-card");


    const voiceCloneInput =
        document.getElementById("voiceCloneInput");

    const selectVoiceCloneButton =
        document.getElementById("selectVoiceCloneButton");

    const replaceVoiceCloneButton =
        document.getElementById("replaceVoiceCloneButton");

    const removeVoiceCloneButton =
        document.getElementById("removeVoiceCloneButton");

    const voiceClonePreview =
        document.getElementById("voiceClonePreview");

    const cloneAudio =
        document.getElementById("cloneAudio");

    const cloneFileName =
        document.getElementById("cloneFileName");

    const cloneFileMeta =
        document.getElementById("cloneFileMeta");

    const cloneFileRow =
        document.getElementById("cloneFileRow");

    const cloneFileRowName =
        document.getElementById("cloneFileRowName");

    const cloneFileRowMeta =
        document.getElementById("cloneFileRowMeta");


    const qualitySelect =
        document.getElementById("qualitySelect");

    const pitchSelect =
        document.getElementById("pitchSelect");

    const stabilitySelect =
        document.getElementById("stabilitySelect");


    const estimatedCredits =
        document.getElementById("estimatedCredits");

    const usageEstimateText =
        document.getElementById("usageEstimateText");

    const headerCredits =
        document.getElementById("headerCredits");


    const validationTitle =
        document.getElementById("validationTitle");

    const validationMessage =
        document.getElementById("validationMessage");

    const checkAudio =
        document.getElementById("checkAudio");

    const checkVoice =
        document.getElementById("checkVoice");

    const checkReady =
        document.getElementById("checkReady");


    const generateButton =
        document.getElementById("generateButton");

    const generateNormal =
        document.querySelector(".generate-normal");

    const generateLoading =
        document.querySelector(".generate-loading");


    const processingPanel =
        document.getElementById("processingPanel");

    const processingTitle =
        document.getElementById("processingTitle");

    const processingMessage =
        document.getElementById("processingMessage");

    const processingProgress =
        document.getElementById("processingProgress");

    const processingStatus =
        document.getElementById("processingStatus");

    const processingPercentage =
        document.getElementById("processingPercentage");


    const resultPanel =
        document.getElementById("resultPanel");

    const resultAudio =
        document.getElementById("resultAudio");

    const resultVideo =
        document.getElementById("resultVideo");

    const downloadResultButton =
        document.getElementById("downloadResultButton");

    const saveProjectButton =
        document.getElementById("saveProjectButton");

    const newTransformationButton =
        document.getElementById("newTransformationButton");


    const toast =
        document.getElementById("dashboardToast");

    const toastMessage =
        document.getElementById("dashboardToastMessage");


    /* =========================================================
       CONSTANTS
       ========================================================= */

    const MAX_AUDIO_SIZE_MB = 5;
    const MAX_AUDIO_SIZE = MAX_AUDIO_SIZE_MB * 1024 * 1024;

    const MAX_VIDEO_SIZE_MB = 25;
    const MAX_VIDEO_SIZE = MAX_VIDEO_SIZE_MB * 1024 * 1024;

    const MAX_VIDEO_DURATION_SECONDS = 120;

    const VIDEO_EXTENSIONS = [".mp4", ".mov", ".webm"];
    const VIDEO_MIME_TYPES = ["video/mp4", "video/quicktime", "video/webm"];


    /* =========================================================
       STATE
       ========================================================= */

    let selectedMedia = null; // File object — audio OR video, whichever mode is active

    let selectedVoice = null;

    let selectedVoiceMode = "library";

    let selectedClone = null;

    let mediaObjectUrl = null;

    let cloneObjectUrl = null;

    let processingValue = 0;

    let currentCloneReferenceId = null;

    let indeterminateTimer = null;


    /* =========================================================
       MEDIA MODE HELPERS
       ========================================================= */

    function getMediaMode() {

        if (!mediaTypeSwitch) {
            return "audio";
        }

        return mediaTypeSwitch.getAttribute("data-media-mode") || "audio";

    }


    /* =========================================================
       TOAST
       ========================================================= */

    function showToast(message) {

        if (!toast || !toastMessage) {
            return;
        }

        toastMessage.textContent = message;

        toast.classList.add("show");

        clearTimeout(showToast.timer);

        showToast.timer = setTimeout(function () {

            toast.classList.remove("show");

        }, 3000);

    }


    /* =========================================================
       HELPERS
       ========================================================= */

    function formatFileSize(bytes) {

        if (!bytes) {
            return "0 KB";
        }

        if (bytes < 1024 * 1024) {

            return (
                Math.round(bytes / 1024) +
                " KB"
            );

        }

        return (
            (bytes / (1024 * 1024))
                .toFixed(2) +
            " MB"
        );

    }


    function formatDuration(seconds) {

        if (!Number.isFinite(seconds)) {
            return "0:00";
        }

        seconds = Math.max(0, Math.floor(seconds));

        const minutes =
            Math.floor(seconds / 60);

        const remainingSeconds =
            seconds % 60;

        return (
            minutes +
            ":" +
            String(remainingSeconds).padStart(2, "0")
        );

    }


    function isMp3(file) {

        if (!file) {
            return false;
        }

        const name =
            file.name.toLowerCase();

        return (
            file.type === "audio/mpeg" ||
            name.endsWith(".mp3")
        );

    }


    function isVideoFile(file) {

        if (!file) {
            return false;
        }

        const name = file.name.toLowerCase();

        return (
            VIDEO_MIME_TYPES.indexOf(file.type) !== -1 ||
            VIDEO_EXTENSIONS.some(function (ext) {
                return name.endsWith(ext);
            })
        );

    }


    function clearMediaUrl() {

        if (mediaObjectUrl) {

            URL.revokeObjectURL(
                mediaObjectUrl
            );

            mediaObjectUrl = null;

        }

    }


    function clearCloneUrl() {

        if (cloneObjectUrl) {

            URL.revokeObjectURL(
                cloneObjectUrl
            );

            cloneObjectUrl = null;

        }

    }


    /* =========================================================
       STATUS SETTERS
       ========================================================= */

    function setAudioStatus(text) {

        if (audioStatus) {
            audioStatus.textContent = text;
        }

    }


    function setVoiceStatus(text) {

        if (voiceStatus) {
            voiceStatus.textContent = text;
        }

    }


    /* =========================================================
       VALIDATION
       ========================================================= */

    function updateValidation() {

        const hasMedia =
            !!selectedMedia;

        const hasVoice =
            selectedVoiceMode === "library"
                ? !!selectedVoice
                : !!selectedClone;


        if (checkAudio) {

            checkAudio.innerHTML =
                hasMedia
                    ? '<i class="bi bi-check-circle-fill"></i> Source media'
                    : '<i class="bi bi-circle"></i> Source media';

        }


        if (checkVoice) {

            checkVoice.innerHTML =
                hasVoice
                    ? '<i class="bi bi-check-circle-fill"></i> Voice model'
                    : '<i class="bi bi-circle"></i> Voice model';

        }


        const ready =
            hasMedia &&
            hasVoice;


        if (checkReady) {

            checkReady.innerHTML =
                ready
                    ? '<i class="bi bi-check-circle-fill"></i> Ready'
                    : '<i class="bi bi-circle"></i> Ready';

        }


        if (validationTitle) {

            validationTitle.textContent =
                ready
                    ? "Ready to transform"
                    : "Ready to validate";

        }


        if (validationMessage) {

            if (!hasMedia) {

                validationMessage.textContent =
                    getMediaMode() === "video"
                        ? "Upload a video file to continue."
                        : "Upload an MP3 audio file to continue.";

            } else if (!hasVoice) {

                validationMessage.textContent =
                    "Choose a voice model to continue.";

            } else {

                validationMessage.textContent =
                    "Your media and voice model are ready.";

            }

        }


        if (generateButton) {
            generateButton.disabled = !ready;
        }

    }


    /* =========================================================
       CREDIT ESTIMATE
       ========================================================= */

    function updateCreditEstimate() {

        if (!selectedMedia) {

            if (estimatedCredits) {
                estimatedCredits.textContent =
                    "0 credits";
            }

            if (usageEstimateText) {
                usageEstimateText.textContent =
                    "Upload audio or video to calculate usage.";
            }

            return;

        }


        const activePlayer =
            getMediaMode() === "video"
                ? sourceVideo
                : sourceAudio;

        const duration =
            activePlayer && Number.isFinite(activePlayer.duration)
                ? activePlayer.duration
                : 0;


        let credits =
            Math.max(
                5,
                Math.ceil(duration / 10)
            );


        if (
            qualitySelect &&
            qualitySelect.value === "high"
        ) {

            credits *= 1.5;

        }


        if (
            qualitySelect &&
            qualitySelect.value === "premium"
        ) {

            credits *= 2;

        }


        credits =
            Math.ceil(credits);


        if (estimatedCredits) {

            estimatedCredits.textContent =
                credits +
                " credits";

        }


        if (usageEstimateText) {

            usageEstimateText.textContent =
                "Estimated from media duration and output quality.";

        }

    }


    /* =========================================================
       UPDATE HEADER CREDITS
       ========================================================= */

    function updateHeaderCredits() {

        // Header already renders the real server-side balance via PHP
        // on page load, so this no longer zeroes it out — kept only as
        // a hook, actual updates happen in handleJobCompleted().

    }


    /* =========================================================
       MEDIA CLEANUP (audio OR video, whichever was active)
       ========================================================= */

    function clearMedia() {

        selectedMedia = null;

        clearMediaUrl();


        if (sourceAudio) {

            sourceAudio.pause();
            sourceAudio.removeAttribute("src");
            sourceAudio.load();
            sourceAudio.classList.add("d-none");

        }


        if (sourceVideo) {

            sourceVideo.pause();
            sourceVideo.removeAttribute("src");
            sourceVideo.load();
            sourceVideo.classList.add("d-none");

        }


        if (audioInput) {
            audioInput.value = "";
        }


        if (audioUploadArea) {
            audioUploadArea.classList.remove("d-none");
        }


        if (audioPreviewContainer) {
            audioPreviewContainer.classList.add("d-none");
        }


        if (audioFileName) {
            audioFileName.textContent =
                "media file";
        }


        if (audioFileMeta) {
            audioFileMeta.textContent =
                "0 MB · 0:00";
        }


        if (audioFileDetails) {
            audioFileDetails.textContent =
                "0 MB · 0:00";
        }


        setAudioStatus("Waiting");

        updateCreditEstimate();

        updateValidation();

    }


    /* =========================================================
       HANDLE MEDIA (branches on current toggle mode)
       ========================================================= */

    function handleMedia(file) {

        if (!file) {
            return;
        }

        const mode = getMediaMode();


        if (mode === "video") {

            if (!isVideoFile(file)) {

                showToast(
                    "Only MP4, MOV, or WEBM video files are supported."
                );

                return;

            }

            if (file.size > MAX_VIDEO_SIZE) {

                showToast(
                    "Video must be " + MAX_VIDEO_SIZE_MB + " MB or smaller."
                );

                return;

            }

        } else {

            if (!isMp3(file)) {

                showToast(
                    "Only MP3 audio files are supported."
                );

                return;

            }

            if (file.size > MAX_AUDIO_SIZE) {

                showToast(
                    "Audio must be " + MAX_AUDIO_SIZE_MB + " MB or smaller."
                );

                return;

            }

        }


        clearMedia();


        selectedMedia = file;


        clearMediaUrl();

        mediaObjectUrl =
            URL.createObjectURL(file);


        if (audioUploadArea) {
            audioUploadArea.classList.add("d-none");
        }


        if (audioPreviewContainer) {
            audioPreviewContainer.classList.remove("d-none");
        }


        if (audioFileName) {

            audioFileName.textContent =
                file.name;

        }


        const fileSize =
            formatFileSize(file.size);


        if (audioFileMeta) {

            audioFileMeta.textContent =
                fileSize +
                " · Loading...";

        }


        if (audioFileDetails) {

            audioFileDetails.textContent =
                fileSize +
                " · Loading...";

        }


        setAudioStatus("Loading");


        const activePlayer =
            mode === "video" ? sourceVideo : sourceAudio;

        const inactivePlayer =
            mode === "video" ? sourceAudio : sourceVideo;


        if (inactivePlayer) {
            inactivePlayer.classList.add("d-none");
        }

        if (activePlayer) {

            activePlayer.classList.remove("d-none");

            activePlayer.src = mediaObjectUrl;
            activePlayer.load();

            activePlayer.addEventListener(
                "loadedmetadata",
                function handleMetadata() {

                    const duration =
                        formatDuration(
                            activePlayer.duration
                        );


                    if (mode === "video" && activePlayer.duration > MAX_VIDEO_DURATION_SECONDS) {

                        showToast(
                            "Video must be " +
                            Math.floor(MAX_VIDEO_DURATION_SECONDS / 60) +
                            " minutes or shorter."
                        );

                        clearMedia();

                        return;

                    }


                    if (audioFileMeta) {

                        audioFileMeta.textContent =
                            fileSize +
                            " · " +
                            duration;

                    }


                    if (audioFileDetails) {

                        audioFileDetails.textContent =
                            fileSize +
                            " · " +
                            duration;

                    }


                    setAudioStatus("Ready");

                    updateCreditEstimate();

                    updateValidation();

                },
                {
                    once: true
                }
            );


            activePlayer.addEventListener(
                "error",
                function () {

                    setAudioStatus("Error");

                    showToast(
                        mode === "video"
                            ? "This video could not be played by your browser."
                            : "This MP3 could not be played by your browser."
                    );

                },
                {
                    once: true
                }
            );

        }


        showToast(
            mode === "video"
                ? "Video loaded successfully."
                : "MP3 audio loaded successfully."
        );

        updateValidation();

    }


    /* =========================================================
       MEDIA INPUT
       ========================================================= */

    if (selectAudioButton) {

        selectAudioButton.addEventListener(
            "click",
            function () {

                if (audioInput) {
                    audioInput.click();
                }

            }
        );

    }


    if (audioInput) {

        audioInput.addEventListener(
            "change",
            function () {

                const file =
                    audioInput.files &&
                    audioInput.files[0];

                handleMedia(file);

            }
        );

    }


    if (replaceAudioButton) {

        replaceAudioButton.addEventListener(
            "click",
            function () {

                if (sourceAudio) sourceAudio.pause();
                if (sourceVideo) sourceVideo.pause();

                if (audioInput) {
                    audioInput.value = "";
                    audioInput.click();
                }

            }
        );

    }


    if (removeAudioButton) {

        removeAudioButton.addEventListener(
            "click",
            function () {

                clearMedia();

                showToast(
                    "Source media removed."
                );

            }
        );

    }


    /* =========================================================
       MEDIA MODE CHANGE — clear whatever was loaded under the old mode
       ========================================================= */

    if (mediaTypeSwitch) {

        mediaTypeSwitch.addEventListener(
            "mediamodechange",
            function () {

                if (selectedMedia) {

                    clearMedia();

                    showToast(
                        "Switched mode — please upload again."
                    );

                }

            }
        );

    }


    /* =========================================================
       DRAG AND DROP
       ========================================================= */

    if (audioUploadArea) {

        audioUploadArea.addEventListener(
            "dragover",
            function (event) {

                event.preventDefault();

                audioUploadArea.classList.add(
                    "drag-over"
                );

            }
        );


        audioUploadArea.addEventListener(
            "dragleave",
            function () {

                audioUploadArea.classList.remove(
                    "drag-over"
                );

            }
        );


        audioUploadArea.addEventListener(
            "drop",
            function (event) {

                event.preventDefault();

                audioUploadArea.classList.remove(
                    "drag-over"
                );


                const file =
                    event.dataTransfer.files &&
                    event.dataTransfer.files[0];


                handleMedia(file);

            }
        );

    }


    /* =========================================================
       VOICE MODE
       ========================================================= */

    function setVoiceMode(mode) {

        selectedVoiceMode =
            mode;


        if (mode === "library") {

            if (libraryVoiceButton) libraryVoiceButton.classList.add("active");
            if (cloneVoiceButton) cloneVoiceButton.classList.remove("active");
            if (voiceLibrary) voiceLibrary.classList.remove("d-none");
            if (voiceCloneArea) voiceCloneArea.classList.add("d-none");

            setVoiceStatus(
                selectedVoice ? "Selected" : "Waiting"
            );

        } else {

            if (libraryVoiceButton) libraryVoiceButton.classList.remove("active");
            if (cloneVoiceButton) cloneVoiceButton.classList.add("active");
            if (voiceLibrary) voiceLibrary.classList.add("d-none");
            if (voiceCloneArea) voiceCloneArea.classList.remove("d-none");

            setVoiceStatus(
                selectedClone ? "Selected" : "Waiting"
            );

        }


        updateValidation();

    }


    if (libraryVoiceButton) {

        libraryVoiceButton.addEventListener("click", function () {
            setVoiceMode("library");
        });

    }


    if (cloneVoiceButton) {

        cloneVoiceButton.addEventListener("click", function () {
            setVoiceMode("clone");
        });

    }


    /* =========================================================
       VOICE LIBRARY — selection
       ========================================================= */

    voiceCards.forEach(
        function (card) {

            card.addEventListener(
                "click",
                function () {

                    voiceCards.forEach(function (item) {
                        item.classList.remove("selected");
                    });

                    card.classList.add("selected");

                    selectedVoice =
                        card.dataset.voiceId || null;

                    const nameElement =
                        card.querySelector(".voice-card-info strong");

                    const voiceName =
                        nameElement ? nameElement.textContent.trim() : "Voice";

                    setVoiceStatus(voiceName);

                    showToast(voiceName + " selected.");

                    updateValidation();

                }
            );

        }
    );


    /* =========================================================
       VOICE LIBRARY — preview playback
       ========================================================= */

    const voicePreviewAudio = new Audio();
    let currentPreviewButton = null;

    function setPlayIcon(playButton, state) {
        if (!playButton) return;

        playButton.dataset.state = state;

        const icon = playButton.querySelector("i");
        if (!icon) return;

        icon.className =
            state === "playing" ? "bi bi-pause-fill" :
            state === "loading" ? "bi bi-hourglass-split" :
            "bi bi-play-fill";
    }

    function stopCurrentPreview() {
        voicePreviewAudio.pause();
        voicePreviewAudio.currentTime = 0;

        if (currentPreviewButton) {
            setPlayIcon(currentPreviewButton, "idle");
            currentPreviewButton = null;
        }
    }

    function playPreview(card, playButton) {
        const previewUrl = card.dataset.previewUrl;

        if (!previewUrl || previewUrl.indexOf("REPLACE_WITH") === 0) {
            showToast("Preview not available for this voice yet.");
            return;
        }

        if (currentPreviewButton === playButton && !voicePreviewAudio.paused) {
            stopCurrentPreview();
            return;
        }

        stopCurrentPreview();

        currentPreviewButton = playButton;
        setPlayIcon(playButton, "loading");

        voicePreviewAudio.src = previewUrl;
        voicePreviewAudio.play()
            .then(function () {
                setPlayIcon(playButton, "playing");
            })
            .catch(function () {
                setPlayIcon(playButton, "idle");
                currentPreviewButton = null;
                showToast("Could not play this preview.");
            });
    }

    voicePreviewAudio.addEventListener("ended", stopCurrentPreview);
    voicePreviewAudio.addEventListener("error", stopCurrentPreview);

    voiceCards.forEach(function (card) {

        const playButton = card.querySelector(".voice-card-play");
        if (!playButton) return;

        playButton.addEventListener("click", function (event) {
            event.stopPropagation();
            playPreview(card, playButton);
        });

    });

    window.addEventListener("beforeunload", stopCurrentPreview);


    /* =========================================================
       CLONE CLEANUP
       ========================================================= */

    function clearClone() {

        selectedClone = null;

        currentCloneReferenceId = null;

        clearCloneUrl();


        if (cloneAudio) {

            cloneAudio.pause();
            cloneAudio.removeAttribute("src");
            cloneAudio.load();

        }


        if (voiceCloneInput) {
            voiceCloneInput.value = "";
        }


        if (voiceClonePreview) {
            voiceClonePreview.classList.add("d-none");
        }


        if (cloneFileRow) {
            cloneFileRow.classList.add("d-none");
        }


        if (cloneFileName) {
            cloneFileName.textContent = "voice-sample.mp3";
        }


        if (cloneFileMeta) {
            cloneFileMeta.textContent = "0 MB · 0:00";
        }


        if (cloneFileRowName) {
            cloneFileRowName.textContent = "voice-sample.mp3";
        }


        if (cloneFileRowMeta) {
            cloneFileRowMeta.textContent = "0 MB";
        }


        setVoiceStatus("Waiting");

        updateValidation();

    }


    /* =========================================================
       HANDLE CLONE
       ========================================================= */

    function handleClone(file) {

        if (!file) {
            return;
        }


        if (!isMp3(file)) {

            showToast(
                "Only MP3 voice samples are supported."
            );

            return;

        }


        if (file.size > MAX_AUDIO_SIZE) {

            showToast(
                "Voice sample must be " + MAX_AUDIO_SIZE_MB + " MB or smaller."
            );

            return;

        }


        clearClone();


        selectedClone = file;


        clearCloneUrl();

        cloneObjectUrl =
            URL.createObjectURL(file);


        const fileSize =
            formatFileSize(file.size);


        if (cloneFileName) {
            cloneFileName.textContent = file.name;
        }


        if (cloneFileMeta) {
            cloneFileMeta.textContent = fileSize + " · Loading...";
        }


        if (cloneFileRowName) {
            cloneFileRowName.textContent = file.name;
        }


        if (cloneFileRowMeta) {
            cloneFileRowMeta.textContent = fileSize;
        }


        if (voiceClonePreview) {
            voiceClonePreview.classList.remove("d-none");
        }


        if (cloneFileRow) {
            cloneFileRow.classList.remove("d-none");
        }


        cloneAudio.src = cloneObjectUrl;
        cloneAudio.load();


        cloneAudio.addEventListener(
            "loadedmetadata",
            function () {

                if (cloneFileMeta) {

                    cloneFileMeta.textContent =
                        fileSize +
                        " · " +
                        formatDuration(cloneAudio.duration);

                }

                setVoiceStatus("Selected");

                updateValidation();

            },
            { once: true }
        );


        cloneAudio.addEventListener(
            "error",
            function () {

                setVoiceStatus("Error");

                showToast(
                    "This voice sample could not be played."
                );

            },
            { once: true }
        );


        showToast("Voice sample loaded.");

        updateValidation();

    }


    /* =========================================================
       CLONE INPUT
       ========================================================= */

    if (selectVoiceCloneButton) {

        selectVoiceCloneButton.addEventListener("click", function () {
            if (voiceCloneInput) voiceCloneInput.click();
        });

    }


    if (voiceCloneInput) {

        voiceCloneInput.addEventListener("change", function () {

            const file =
                voiceCloneInput.files &&
                voiceCloneInput.files[0];

            handleClone(file);

        });

    }


    if (replaceVoiceCloneButton) {

        replaceVoiceCloneButton.addEventListener("click", function () {

            if (cloneAudio) cloneAudio.pause();

            if (voiceCloneInput) {
                voiceCloneInput.value = "";
                voiceCloneInput.click();
            }

        });

    }


    if (removeVoiceCloneButton) {

        removeVoiceCloneButton.addEventListener("click", function () {

            clearClone();

            showToast("Voice sample removed.");

        });

    }


    /* =========================================================
       SETTINGS
       ========================================================= */

    if (qualitySelect) {
        qualitySelect.addEventListener("change", updateCreditEstimate);
    }

    if (pitchSelect) {
        pitchSelect.addEventListener("change", updateValidation);
    }

    if (stabilitySelect) {
        stabilitySelect.addEventListener("change", updateValidation);
    }


    /* =========================================================
       PROCESSING (synchronous API call — no polling)
       ========================================================= */

    function updateProcessing(value, message) {

        processingValue =
            Math.min(100, Math.max(0, value));

        if (processingProgress) {
            processingProgress.style.width = processingValue + "%";
        }

        if (processingPercentage) {
            processingPercentage.textContent = processingValue + "%";
        }

        if (message && processingStatus) {
            processingStatus.textContent = message;
        }

    }


    function startIndeterminateProgress() {

        stopIndeterminateProgress();

        let value = 5;

        updateProcessing(
            value,
            getMediaMode() === "video"
                ? "Uploading and converting your video..."
                : "Uploading and converting..."
        );

        indeterminateTimer = setInterval(function () {
            value = Math.min(90, value + Math.random() * 4);
            updateProcessing(Math.round(value));
        }, 800);

    }


    function stopIndeterminateProgress() {
        if (indeterminateTimer) {
            clearInterval(indeterminateTimer);
            indeterminateTimer = null;
        }
    }


    function resetToIdleAfterError() {
        stopIndeterminateProgress();
        if (processingPanel) processingPanel.classList.add("d-none");
        if (generateButton) generateButton.disabled = false;
        if (generateLoading) generateLoading.classList.add("d-none");
        if (generateNormal) generateNormal.classList.remove("d-none");
    }


    async function ensureCloneReference() {

        if (currentCloneReferenceId) {
            return currentCloneReferenceId;
        }

        const formData = new FormData();
        formData.append("clone_audio", selectedClone);

        const response = await fetch("backend/voice/clone.php", {
            method: "POST",
            body: formData,
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Could not upload voice sample.");
        }

        currentCloneReferenceId = data.reference_id;
        return currentCloneReferenceId;

    }


    async function buildSubmitFormData() {

        const formData = new FormData();

        const mode = getMediaMode();

        formData.append("media_mode", mode);

        if (mode === "video") {
            formData.append("source_video", selectedMedia);
        } else {
            formData.append("source_audio", selectedMedia);
        }

        formData.append("voice_mode", selectedVoiceMode);

        if (selectedVoiceMode === "library") {
            formData.append("voice_id", selectedVoice);
        } else {
            const referenceId = await ensureCloneReference();
            formData.append("clone_reference_id", referenceId);
        }

        formData.append("quality", qualitySelect ? qualitySelect.value : "standard");
        formData.append("pitch", pitchSelect ? pitchSelect.value : "natural");
        formData.append("stability", stabilitySelect ? stabilitySelect.value : "balanced");

        return formData;

    }


    async function submitVoiceJob() {

        processingValue = 0;
        updateProcessing(0);

        if (processingPanel) processingPanel.classList.remove("d-none");
        if (resultPanel) resultPanel.classList.add("d-none");
        if (generateButton) generateButton.disabled = true;
        if (generateNormal) generateNormal.classList.add("d-none");
        if (generateLoading) generateLoading.classList.remove("d-none");

        const mode = getMediaMode();

        if (processingTitle) {
            processingTitle.textContent =
                mode === "video" ? "Transforming your video's voice" : "Transforming your voice";
        }

        if (processingMessage) {
            processingMessage.textContent =
                mode === "video"
                    ? "This can take a moment — extracting, converting, and re-combining audio..."
                    : "This can take a moment — converting your audio...";
        }

        startIndeterminateProgress();

        try {

            const formData = await buildSubmitFormData();

            const response = await fetch("backend/voice/transform.php?action=submit", {
                method: "POST",
                body: formData,
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Could not complete transformation.");
            }

            stopIndeterminateProgress();
            updateProcessing(100, "Voice transformation completed.");
            handleJobCompleted(data);

        } catch (err) {

            showToast(err.message || "Something went wrong during transformation.");
            resetToIdleAfterError();

        }

    }


    /* =========================================================
       RESULT
       ========================================================= */

    function handleJobCompleted(data) {

        if (processingTitle) processingTitle.textContent = "Transformation complete";
        if (processingMessage) processingMessage.textContent = "Your transformed result is ready.";
        if (generateLoading) generateLoading.classList.add("d-none");
        if (generateNormal) generateNormal.classList.remove("d-none");

        const isVideoResult = data.media_mode === "video";

        if (isVideoResult) {

            if (resultVideo && data.result_url) {
                resultVideo.classList.remove("d-none");
                resultVideo.src = data.result_url;
                resultVideo.load();
            }

            if (resultAudio) {
                resultAudio.classList.add("d-none");
            }

        } else {

            if (resultAudio && data.result_url) {
                resultAudio.classList.remove("d-none");
                resultAudio.src = data.result_url;
                resultAudio.load();
            }

            if (resultVideo) {
                resultVideo.classList.add("d-none");
            }

        }

        if (typeof data.credits_balance === "number") {
            const creditsText = Math.floor(data.credits_balance) + "";
            if (headerCredits) headerCredits.textContent = creditsText;

            const topbarCreditsValue = document.querySelector("#topbarCredits span");
            if (topbarCreditsValue) topbarCreditsValue.textContent = creditsText;
        }

        setTimeout(function () {
            if (processingPanel) processingPanel.classList.add("d-none");
            if (resultPanel) resultPanel.classList.remove("d-none");
            showToast(isVideoResult ? "Video voice transformation complete." : "Voice transformation complete.");
            updateValidation();
        }, 500);

    }


    /* =========================================================
       GENERATE
       ========================================================= */

    if (generateButton) {

        generateButton.addEventListener(
            "click",
            function () {

                if (!selectedMedia) {

                    showToast(
                        getMediaMode() === "video"
                            ? "Upload a video file first."
                            : "Upload an MP3 audio file first."
                    );

                    return;

                }

                const hasVoice =
                    selectedVoiceMode === "library"
                        ? !!selectedVoice
                        : !!selectedClone;

                if (!hasVoice) {
                    showToast("Choose a voice model first.");
                    return;
                }

                showToast("Starting voice transformation...");
                submitVoiceJob();

            }
        );

    }


    /* =========================================================
       DOWNLOAD RESULT
       ========================================================= */

    if (downloadResultButton) {

        downloadResultButton.addEventListener(
            "click",
            function () {

                const activeResult =
                    resultVideo && !resultVideo.classList.contains("d-none")
                        ? resultVideo
                        : resultAudio;

                if (!activeResult || !activeResult.src) {

                    showToast(
                        "No result is available yet."
                    );

                    return;

                }

                const isVideo = activeResult === resultVideo;

                const link =
                    document.createElement("a");

                link.href = activeResult.src;

                link.download =
                    isVideo
                        ? "aistudio-voice-result.mp4"
                        : "aistudio-voice-result.mp3";

                document.body.appendChild(link);

                link.click();

                link.remove();

                showToast("Download started.");

            }
        );

    }


    /* =========================================================
       SAVE PROJECT
       ========================================================= */

    if (saveProjectButton) {

        saveProjectButton.addEventListener(
            "click",
            function () {

                showToast(
                    "Project saving will be connected to the backend later."
                );

            }
        );

    }


    /* =========================================================
       NEW TRANSFORMATION
       ========================================================= */

    if (newTransformationButton) {

        newTransformationButton.addEventListener(
            "click",
            function () {

                stopIndeterminateProgress();

                clearMedia();

                clearClone();


                selectedVoice = null;


                voiceCards.forEach(function (card) {
                    card.classList.remove("selected");
                });


                setVoiceMode("library");


                if (resultAudio) {
                    resultAudio.pause();
                    resultAudio.removeAttribute("src");
                    resultAudio.load();
                }

                if (resultVideo) {
                    resultVideo.pause();
                    resultVideo.removeAttribute("src");
                    resultVideo.load();
                }


                if (processingPanel) processingPanel.classList.add("d-none");
                if (resultPanel) resultPanel.classList.add("d-none");
                if (generateNormal) generateNormal.classList.remove("d-none");
                if (generateLoading) generateLoading.classList.add("d-none");


                showToast("Ready for a new transformation.");


                updateValidation();

            }
        );

    }


    /* =========================================================
       MEDIA PLAYER STATUS (audio + video)
       ========================================================= */

    [sourceAudio, sourceVideo].forEach(function (player) {

        if (!player) return;

        player.addEventListener("waiting", function () {
            setAudioStatus("Buffering");
        });

        player.addEventListener("playing", function () {
            setAudioStatus("Playing");
        });

        player.addEventListener("pause", function () {
            if (selectedMedia) setAudioStatus("Ready");
        });

        player.addEventListener("ended", function () {
            setAudioStatus("Ready");
        });

    });


    /* =========================================================
       INITIAL STATE
       ========================================================= */

    setVoiceMode("library");

    clearMedia();

    clearClone();

    updateHeaderCredits();

    updateValidation();


    /* =========================================================
       DEBUG
       ========================================================= */

    window.voiceStudioDebug = {

        getSelectedMedia: function () {
            return selectedMedia;
        },

        getSelectedVoice: function () {
            return selectedVoice;
        },

        getSelectedClone: function () {
            return selectedClone;
        },

        getVoiceMode: function () {
            return selectedVoiceMode;
        },

        getMediaMode: getMediaMode,

        clearMedia: clearMedia,

        clearClone: clearClone,

        updateValidation: updateValidation

    };

});
