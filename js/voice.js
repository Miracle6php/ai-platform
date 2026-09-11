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

    let processingTimer = null;

    let processingValue = 0;

    let resultObjectUrl = null;


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

        if (!headerCredits) {
            return;
        }

        headerCredits.textContent =
            "0 credits";

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
       VOICE LIBRARY
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
       CLONE CLEANUP
       ========================================================= */

    function clearClone() {

        selectedClone = null;

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
       PROCESSING
       ========================================================= */

    function stopProcessing() {

        if (processingTimer) {

            clearInterval(
                processingTimer
            );

            processingTimer = null;

        }

    }


    function updateProcessing(value) {

        processingValue =
            Math.min(
                100,
                Math.max(0, value)
            );


        if (processingProgress) {

            processingProgress.style.width =
                processingValue +
                "%";

        }


        if (processingPercentage) {

            processingPercentage.textContent =
                processingValue +
                "%";

        }

    }


    function startDemoProcessing() {

        stopProcessing();


        processingValue = 0;

        updateProcessing(0);


        if (processingPanel) {

            processingPanel.classList.remove(
                "d-none"
            );

        }


        if (resultPanel) {

            resultPanel.classList.add(
                "d-none"
            );

        }


        if (generateButton) {

            generateButton.disabled =
                true;

        }


        if (generateNormal) {

            generateNormal.classList.add(
                "d-none"
            );

        }


        if (generateLoading) {

            generateLoading.classList.remove(
                "d-none"
            );

        }


        if (processingTitle) {

            processingTitle.textContent =
                "Transforming your voice";

        }


        if (processingMessage) {

            processingMessage.textContent =
                "AI is preparing your transformed voice...";

        }


        if (processingStatus) {

            processingStatus.textContent =
                "Starting AI processing...";

        }


        processingTimer =
            setInterval(
                function () {

                    processingValue +=
                        Math.floor(
                            Math.random() * 8
                        ) + 4;


                    if (processingValue >= 100) {

                        processingValue = 100;

                        updateProcessing(
                            processingValue
                        );

                        stopProcessing();

                        finishDemoProcessing();

                        return;

                    }


                    updateProcessing(
                        processingValue
                    );


                    if (
                        processingValue < 30
                    ) {

                        if (processingStatus) {

                            processingStatus.textContent =
                                "Uploading audio...";

                        }

                    } else if (
                        processingValue < 65
                    ) {

                        if (processingStatus) {

                            processingStatus.textContent =
                                "AI is transforming the voice...";

                        }

                    } else if (
                        processingValue < 90
                    ) {

                        if (processingStatus) {

                            processingStatus.textContent =
                                "Optimizing the final result...";

                        }

                    } else {

                        if (processingStatus) {

                            processingStatus.textContent =
                                "Finishing transformation...";

                        }

                    }

                },
                500
            );

    }


    /* =========================================================
       DEMO RESULT
       ========================================================= */

    function finishDemoProcessing() {

        if (processingTitle) {

            processingTitle.textContent =
                "Transformation complete";

        }


        if (processingMessage) {

            processingMessage.textContent =
                "Your transformed voice is ready.";

        }


        if (processingStatus) {

            processingStatus.textContent =
                "Voice transformation completed.";

        }


        if (generateLoading) {

            generateLoading.classList.add(
                "d-none"
            );

        }


        if (generateNormal) {

            generateNormal.classList.remove(
                "d-none"
            );

        }


        /*
         * Frontend demo:
         * The real API result will replace this
         * object URL later.
         */
        if (
            resultAudio &&
            selectedAudio
        ) {

            if (resultObjectUrl) {

                URL.revokeObjectURL(
                    resultObjectUrl
                );

                resultObjectUrl = null;

            }


            resultObjectUrl =
                URL.createObjectURL(
                    selectedAudio
                );


            resultAudio.src =
                resultObjectUrl;

            resultAudio.load();

        }


        setTimeout(
            function () {

                if (processingPanel) {

                    processingPanel.classList.add(
                        "d-none"
                    );

                }


                if (resultPanel) {

                    resultPanel.classList.remove(
                        "d-none"
                    );

                }


                showToast(
                    "Voice transformation complete."
                );


                updateValidation();

            },
            500
        );

    }


    /* =========================================================
       GENERATE
       ========================================================= */

    if (generateButton) {

        generateButton.addEventListener(
            "click",
            function () {

                if (
                    !selectedAudio
                ) {

                    showToast(
                        "Upload an MP3 audio file first."
                    );

                    return;

                }


                const hasVoice =
                    selectedVoiceMode === "library"
                        ? !!selectedVoice
                        : !!selectedClone;


                if (!hasVoice) {

                    showToast(
                        "Choose a voice model first."
                    );

                    return;

                }


                showToast(
                    "Preparing voice transformation..."
                );


                startDemoProcessing();

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

                if (!resultObjectUrl) {

                    showToast(
                        "No result is available yet."
                    );

                    return;

                }


                const link =
                    document.createElement("a");


                link.href =
                    resultObjectUrl;

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

                stopProcessing();

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


                if (resultObjectUrl) {

                    URL.revokeObjectURL(
                        resultObjectUrl
                    );

                    resultObjectUrl = null;

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