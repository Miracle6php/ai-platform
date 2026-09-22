document.addEventListener("DOMContentLoaded", function () {

    "use strict";


    /* =========================================================
       ELEMENTS
       ========================================================= */

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

    const voiceCloneAreaElement =
        document.getElementById("voiceCloneArea");

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


    const validationPanel =
        document.getElementById("validationPanel");

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

    const MAX_AUDIO_SIZE =
        MAX_AUDIO_SIZE_MB * 1024 * 1024;


    /* =========================================================
       STATE
       ========================================================= */

    let selectedAudio = null;

    let selectedVoice = null;

    let selectedVoiceMode = "library";

    let selectedClone = null;

    let audioObjectUrl = null;

    let cloneObjectUrl = null;

    let processingValue = 0;

    let currentCloneReferenceId = null;

    let indeterminateTimer = null;


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


    function clearAudioUrl() {

        if (audioObjectUrl) {

            URL.revokeObjectURL(
                audioObjectUrl
            );

            audioObjectUrl = null;

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
       AUDIO STATUS
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

        const hasAudio =
            !!selectedAudio;

        const hasVoice =
            selectedVoiceMode === "library"
                ? !!selectedVoice
                : !!selectedClone;


        if (checkAudio) {

            checkAudio.innerHTML =
                hasAudio
                    ? '<i class="bi bi-check-circle-fill"></i> Source audio'
                    : '<i class="bi bi-circle"></i> Source audio';

        }


        if (checkVoice) {

            checkVoice.innerHTML =
                hasVoice
                    ? '<i class="bi bi-check-circle-fill"></i> Voice model'
                    : '<i class="bi bi-circle"></i> Voice model';

        }


        const ready =
            hasAudio &&
            hasVoice;


        if (checkReady) {

            checkReady.innerHTML =
                ready
                    ? '<i class="bi bi-check-circle-fill"></i> Ready'
                    : '<i class="bi bi-circle"></i> Ready';

        }


        if (validationTitle) {

            if (ready) {

                validationTitle.textContent =
                    "Ready to transform";

            } else {

                validationTitle.textContent =
                    "Ready to validate";

            }

        }


        if (validationMessage) {

            if (!hasAudio) {

                validationMessage.textContent =
                    "Upload an MP3 audio file to continue.";

            } else if (!hasVoice) {

                validationMessage.textContent =
                    "Choose a voice model to continue.";

            } else {

                validationMessage.textContent =
                    "Your audio and voice model are ready.";

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

        if (!selectedAudio) {

            if (estimatedCredits) {
                estimatedCredits.textContent =
                    "0 credits";
            }

            if (usageEstimateText) {
                usageEstimateText.textContent =
                    "Upload audio to calculate usage.";
            }

            return;

        }


        const duration =
            Number.isFinite(
                sourceAudio.duration
            )
                ? sourceAudio.duration
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
                "Estimated from audio duration and output quality.";

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
       AUDIO CLEANUP
       ========================================================= */

    function clearAudio() {

        selectedAudio = null;

        clearAudioUrl();


        if (sourceAudio) {

            sourceAudio.pause();

            sourceAudio.removeAttribute("src");

            sourceAudio.load();

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
                "voice.mp3";
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
       HANDLE AUDIO
       ========================================================= */

    function handleAudio(file) {

        if (!file) {
            return;
        }


        if (!isMp3(file)) {

            showToast(
                "Only MP3 audio files are supported."
            );

            return;

        }


        if (file.size > MAX_AUDIO_SIZE) {

            showToast(
                "Audio must be 5 MB or smaller."
            );

            return;

        }


        clearAudio();


        selectedAudio = file;


        clearAudioUrl();

        audioObjectUrl =
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


        sourceAudio.src =
            audioObjectUrl;

        sourceAudio.load();


        sourceAudio.addEventListener(
            "loadedmetadata",
            function handleMetadata() {

                const duration =
                    formatDuration(
                        sourceAudio.duration
                    );


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


        sourceAudio.addEventListener(
            "error",
            function () {

                setAudioStatus("Error");

                showToast(
                    "This MP3 could not be played by your browser."
                );

            },
            {
                once: true
            }
        );


        showToast(
            "MP3 audio loaded successfully."
        );

        updateValidation();

    }


    /* =========================================================
       AUDIO INPUT
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

                handleAudio(file);

            }
        );

    }


    if (replaceAudioButton) {

        replaceAudioButton.addEventListener(
            "click",
            function () {

                if (sourceAudio) {
                    sourceAudio.pause();
                }

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

                clearAudio();

                showToast(
                    "Source audio removed."
                );

            }
        );

    }


    /* =========================================================
       AUDIO DRAG AND DROP
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


                handleAudio(file);

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

            if (libraryVoiceButton) {

                libraryVoiceButton.classList.add(
                    "active"
                );

            }


            if (cloneVoiceButton) {

                cloneVoiceButton.classList.remove(
                    "active"
                );

            }


            if (voiceLibrary) {

                voiceLibrary.classList.remove(
                    "d-none"
                );

            }


            if (voiceCloneArea) {

                voiceCloneArea.classList.add(
                    "d-none"
                );

            }


            setVoiceStatus(
                selectedVoice
                    ? "Selected"
                    : "Waiting"
            );

        } else {

            if (libraryVoiceButton) {

                libraryVoiceButton.classList.remove(
                    "active"
                );

            }


            if (cloneVoiceButton) {

                cloneVoiceButton.classList.add(
                    "active"
                );

            }


            if (voiceLibrary) {

                voiceLibrary.classList.add(
                    "d-none"
                );

            }


            if (voiceCloneArea) {

                voiceCloneArea.classList.remove(
                    "d-none"
                );

            }


            setVoiceStatus(
                selectedClone
                    ? "Selected"
                    : "Waiting"
            );

        }


        updateValidation();

    }


    if (libraryVoiceButton) {

        libraryVoiceButton.addEventListener(
            "click",
            function () {

                setVoiceMode("library");

            }
        );

    }


    if (cloneVoiceButton) {

        cloneVoiceButton.addEventListener(
            "click",
            function () {

                setVoiceMode("clone");

            }
        );

    }


    /* =========================================================
       VOICE LIBRARY — selection
       ========================================================= */

    voiceCards.forEach(
        function (card) {

            card.addEventListener(
                "click",
                function () {

                    voiceCards.forEach(
                        function (item) {

                            item.classList.remove(
                                "selected"
                            );

                        }
                    );


                    card.classList.add(
                        "selected"
                    );


                    selectedVoice =
                        card.dataset.voiceId ||
                        null;


                    const nameElement =
                        card.querySelector(
                            ".voice-card-info strong"
                        );


                    const voiceName =
                        nameElement
                            ? nameElement.textContent.trim()
                            : "Voice";


                    setVoiceStatus(
                        voiceName
                    );


                    showToast(
                        voiceName +
                        " selected."
                    );


                    updateValidation();

                }
            );

        }
    );


    /* =========================================================
       VOICE LIBRARY — preview playback
       ========================================================= */

    // One shared <audio> element reused for every preview, so starting
    // a new preview automatically stops whatever was playing before.
    const voicePreviewAudio = new Audio();
    let currentPreviewButton = null;

    function setPlayIcon(playButton, state) {
        // state: "idle" | "loading" | "playing"
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

        // Clicking the currently-playing voice's play button again = stop.
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

            // Don't also trigger the card's own selection handler —
            // preview and select are separate actions.
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

        // A new sample means any previously uploaded reference on the
        // server is stale — force a fresh upload via
        // ensureCloneReference() next time.
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

            voiceClonePreview.classList.add(
                "d-none"
            );

        }


        if (cloneFileRow) {

            cloneFileRow.classList.add(
                "d-none"
            );

        }


        if (cloneFileName) {

            cloneFileName.textContent =
                "voice-sample.mp3";

        }


        if (cloneFileMeta) {

            cloneFileMeta.textContent =
                "0 MB · 0:00";

        }


        if (cloneFileRowName) {

            cloneFileRowName.textContent =
                "voice-sample.mp3";

        }


        if (cloneFileRowMeta) {

            cloneFileRowMeta.textContent =
                "0 MB";

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
                "Voice sample must be 5 MB or smaller."
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

            cloneFileName.textContent =
                file.name;

        }


        if (cloneFileMeta) {

            cloneFileMeta.textContent =
                fileSize +
                " · Loading...";

        }


        if (cloneFileRowName) {

            cloneFileRowName.textContent =
                file.name;

        }


        if (cloneFileRowMeta) {

            cloneFileRowMeta.textContent =
                fileSize;

        }


        if (voiceClonePreview) {

            voiceClonePreview.classList.remove(
                "d-none"
            );

        }


        if (cloneFileRow) {

            cloneFileRow.classList.remove(
                "d-none"
            );

        }


        cloneAudio.src =
            cloneObjectUrl;

        cloneAudio.load();


        cloneAudio.addEventListener(
            "loadedmetadata",
            function () {

                if (cloneFileMeta) {

                    cloneFileMeta.textContent =
                        fileSize +
                        " · " +
                        formatDuration(
                            cloneAudio.duration
                        );

                }

                setVoiceStatus("Selected");

                updateValidation();

            },
            {
                once: true
            }
        );


        cloneAudio.addEventListener(
            "error",
            function () {

                setVoiceStatus("Error");

                showToast(
                    "This voice sample could not be played."
                );

            },
            {
                once: true
            }
        );


        showToast(
            "Voice sample loaded."
        );


        updateValidation();

    }


    /* =========================================================
       CLONE INPUT
       ========================================================= */

    if (selectVoiceCloneButton) {

        selectVoiceCloneButton.addEventListener(
            "click",
            function () {

                if (voiceCloneInput) {
                    voiceCloneInput.click();
                }

            }
        );

    }


    if (voiceCloneInput) {

        voiceCloneInput.addEventListener(
            "change",
            function () {

                const file =
                    voiceCloneInput.files &&
                    voiceCloneInput.files[0];

                handleClone(file);

            }
        );

    }


    if (replaceVoiceCloneButton) {

        replaceVoiceCloneButton.addEventListener(
            "click",
            function () {

                if (cloneAudio) {
                    cloneAudio.pause();
                }

                if (voiceCloneInput) {

                    voiceCloneInput.value = "";

                    voiceCloneInput.click();

                }

            }
        );

    }


    if (removeVoiceCloneButton) {

        removeVoiceCloneButton.addEventListener(
            "click",
            function () {

                clearClone();

                showToast(
                    "Voice sample removed."
                );

            }
        );

    }


    /* =========================================================
       SETTINGS
       ========================================================= */

    if (qualitySelect) {

        qualitySelect.addEventListener(
            "change",
            updateCreditEstimate
        );

    }


    if (pitchSelect) {

        pitchSelect.addEventListener(
            "change",
            updateValidation
        );

    }


    if (stabilitySelect) {

        stabilitySelect.addEventListener(
            "change",
            updateValidation
        );

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

        // No real progress updates come back from a single blocking
        // fetch() — this fakes gradual movement so the bar doesn't sit
        // frozen at 0% for however long conversion takes. It never
        // claims 100% until the real response lands.
        stopIndeterminateProgress();

        let value = 5;
        updateProcessing(value, "Uploading and converting...");

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

        formData.append("source_audio", selectedAudio);
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
        if (processingTitle) processingTitle.textContent = "Transforming your voice";
        if (processingMessage) processingMessage.textContent = "This can take a moment — converting your audio...";

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
        if (processingMessage) processingMessage.textContent = "Your transformed voice is ready.";
        if (generateLoading) generateLoading.classList.add("d-none");
        if (generateNormal) generateNormal.classList.remove("d-none");

        if (resultAudio && data.result_url) {
            resultAudio.src = data.result_url;
            resultAudio.load();
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
            showToast("Voice transformation complete.");
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

                if (!selectedAudio) {
                    showToast("Upload an MP3 audio file first.");
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

                if (!resultAudio || !resultAudio.src) {

                    showToast(
                        "No result is available yet."
                    );

                    return;

                }


                const link =
                    document.createElement("a");


                link.href =
                    resultAudio.src;

                link.download =
                    "aistudio-voice-result.mp3";


                document.body.appendChild(
                    link
                );


                link.click();

                link.remove();


                showToast(
                    "Download started."
                );

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

                clearAudio();

                clearClone();


                selectedVoice = null;


                voiceCards.forEach(
                    function (card) {

                        card.classList.remove(
                            "selected"
                        );

                    }
                );


                setVoiceMode("library");


                if (resultAudio) {

                    resultAudio.pause();

                    resultAudio.removeAttribute(
                        "src"
                    );

                    resultAudio.load();

                }


                if (processingPanel) {

                    processingPanel.classList.add(
                        "d-none"
                    );

                }


                if (resultPanel) {

                    resultPanel.classList.add(
                        "d-none"
                    );

                }


                if (generateNormal) {

                    generateNormal.classList.remove(
                        "d-none"
                    );

                }


                if (generateLoading) {

                    generateLoading.classList.add(
                        "d-none"
                    );

                }


                showToast(
                    "Ready for a new transformation."
                );


                updateValidation();

            }
        );

    }


    /* =========================================================
       AUDIO SEEKING
       ========================================================= */

    sourceAudio.addEventListener(
        "waiting",
        function () {

            setAudioStatus("Buffering");

        }
    );


    sourceAudio.addEventListener(
        "playing",
        function () {

            setAudioStatus("Playing");

        }
    );


    sourceAudio.addEventListener(
        "pause",
        function () {

            if (selectedAudio) {

                setAudioStatus("Ready");

            }

        }
    );


    sourceAudio.addEventListener(
        "ended",
        function () {

            setAudioStatus("Ready");

        }
    );


    /* =========================================================
       INITIAL STATE
       ========================================================= */

    setVoiceMode("library");

    clearAudio();

    clearClone();

    updateHeaderCredits();

    updateValidation();


    /* =========================================================
       DEBUG
       ========================================================= */

    window.voiceStudioDebug = {

        getSelectedAudio: function () {
            return selectedAudio;
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

        clearAudio: clearAudio,

        clearClone: clearClone,

        updateValidation: updateValidation

    };

});
