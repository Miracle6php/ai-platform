document.addEventListener("DOMContentLoaded", function () {

    /* =========================================================
       ELEMENTS
    ========================================================= */

    const videoInput =
        document.getElementById("videoInput");

    const selectVideoButton =
        document.getElementById("selectVideoButton");

    const videoUploadArea =
        document.getElementById("videoUploadArea");

    const videoPreviewContainer =
        document.getElementById("videoPreviewContainer");

    const sourceVideo =
        document.getElementById("sourceVideo");

    const videoStatus =
        document.getElementById("videoStatus");

    const videoFileName =
        document.getElementById("videoFileName");

    const videoFileSize =
        document.getElementById("videoFileSize");

    const replaceVideoButton =
        document.getElementById("replaceVideoButton");

    const removeVideoButton =
        document.getElementById("removeVideoButton");


    const referenceInput =
        document.getElementById("referenceInput");

    const selectReferenceButton =
        document.getElementById("selectReferenceButton");

    const referenceUploadArea =
        document.getElementById("referenceUploadArea");

    const referencePlaceholder =
        document.getElementById("referencePlaceholder");

    const referencePreview =
        document.getElementById("referencePreview");

    const referenceImage =
        document.getElementById("referenceImage");

    const referenceFileRow =
        document.getElementById("referenceFileRow");

    const referenceStatus =
        document.getElementById("referenceStatus");

    const referenceFileName =
        document.getElementById("referenceFileName");

    const referenceFileSize =
        document.getElementById("referenceFileSize");

    const replaceReferenceButton =
        document.getElementById("replaceReferenceButton");

    const removeReferenceButton =
        document.getElementById("removeReferenceButton");


    const generateButton =
        document.getElementById("generateButton");

    const processingPanel =
        document.getElementById("processingPanel");

    const processingProgressBar =
        document.getElementById("processingProgressBar");

    const processingPercentage =
        document.getElementById("processingPercentage");

    const processingStatus =
        document.getElementById("processingStatus");

    const resultPanel =
        document.getElementById("resultPanel");

    const resultVideo =
        document.getElementById("resultVideo");

    const downloadResultButton =
        document.getElementById("downloadResultButton");

    const newTransformationButton =
        document.getElementById("newTransformationButton");

    const studioToast =
        document.getElementById("studioToast");

    const studioToastMessage =
        document.getElementById("dashboardToastMessage") ||
        document.getElementById("studioToastMessage");


    /* =========================================================
       SETTINGS
    ========================================================= */

    const MAX_VIDEO_SIZE_MB = 10;

    const MAX_REFERENCE_SIZE_MB = 10;

    const MAX_VIDEO_DURATION = 600;

    const PREPARE_TIMEOUT = 30000;

    const STALL_RECOVERY_DELAY = 1500;

    const SEEK_PREPARE_TIMEOUT = 15000;


    /* =========================================================
       PHP ENDPOINT
    ========================================================= */

    const TRANSFORM_ENDPOINT =
        window.location.origin +
        "/backend/face/transform.php";


    console.log(
        "%c[Face Studio] JS loaded successfully.",
        "color: green; font-weight: bold;"
    );

    console.log(
        "[Face Studio] Current page:",
        window.location.href
    );

    console.log(
        "[Face Studio] Current origin:",
        window.location.origin
    );

    console.log(
        "[Face Studio] Transform endpoint:",
        TRANSFORM_ENDPOINT
    );


    /* =========================================================
       STATE
    ========================================================= */

    let selectedVideo = null;

    let selectedReference = null;

    let videoObjectUrl = null;

    let referenceObjectUrl = null;

    let videoPrepared = false;

    let videoPreparing = false;

    let isSeekingRecovery = false;

    let restoringSeekPosition = false;

    let wasPlayingBeforeRecovery = false;

    let pendingSeekTime = null;

    let prepareTimer = null;

    let stallTimer = null;

    let seekPrepareTimer = null;

    let recoveryInProgress = false;

    let lastTime = 0;

    let videoGeneration = 0;


    /* =========================================================
       TOAST
    ========================================================= */

    function showToast(
        message,
        type = "info"
    ) {

        if (!studioToast) {

            alert(message);

            return;
        }

        if (studioToastMessage) {

            studioToastMessage.textContent =
                message;

        } else {

            studioToast.textContent =
                message;
        }

        studioToast.classList.remove(
            "show",
            "success",
            "error",
            "warning",
            "info"
        );

        studioToast.classList.add(
            type
        );

        requestAnimationFrame(
            function () {

                studioToast.classList.add(
                    "show"
                );

            }
        );

        setTimeout(
            function () {

                studioToast.classList.remove(
                    "show"
                );

            },
            5000
        );
    }


    /* =========================================================
       FILE HELPERS
    ========================================================= */

    function formatFileSize(bytes) {

        if (!bytes) {
            return "0 KB";
        }

        const units = [
            "B",
            "KB",
            "MB",
            "GB"
        ];

        let size = bytes;

        let unitIndex = 0;

        while (
            size >= 1024 &&
            unitIndex < units.length - 1
        ) {

            size =
                size / 1024;

            unitIndex++;
        }

        return `${size.toFixed(2)} ${units[unitIndex]}`;
    }


    function formatDuration(seconds) {

        if (!Number.isFinite(seconds)) {
            return "00:00";
        }

        const totalSeconds =
            Math.max(
                0,
                Math.floor(seconds)
            );

        const minutes =
            Math.floor(
                totalSeconds / 60
            );

        const remainingSeconds =
            totalSeconds % 60;

        return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
    }


    /* =========================================================
       BUFFER HELPERS
    ========================================================= */

    function getBufferedSeconds() {

        if (
            !sourceVideo ||
            !sourceVideo.buffered.length
        ) {
            return 0;
        }

        const currentTime =
            sourceVideo.currentTime;

        for (
            let i = 0;
            i < sourceVideo.buffered.length;
            i++
        ) {

            const start =
                sourceVideo.buffered.start(i);

            const end =
                sourceVideo.buffered.end(i);

            if (
                currentTime >= start &&
                currentTime <= end
            ) {

                return Math.max(
                    0,
                    end - currentTime
                );
            }
        }

        return 0;
    }


    function getBufferPercentage() {

        if (
            !sourceVideo ||
            !Number.isFinite(sourceVideo.duration) ||
            sourceVideo.duration <= 0 ||
            !sourceVideo.buffered.length
        ) {
            return 0;
        }

        let bufferedEnd = 0;

        for (
            let i = 0;
            i < sourceVideo.buffered.length;
            i++
        ) {

            bufferedEnd =
                Math.max(
                    bufferedEnd,
                    sourceVideo.buffered.end(i)
                );
        }

        return Math.min(
            100,
            (bufferedEnd / sourceVideo.duration) * 100
        );
    }


    function logBufferState() {

        if (!sourceVideo) {
            return;
        }

        console.log(
            "Face Studio buffer:",
            {
                currentTime:
                    sourceVideo.currentTime,

                bufferedSeconds:
                    getBufferedSeconds(),

                bufferPercentage:
                    getBufferPercentage(),

                readyState:
                    sourceVideo.readyState,

                networkState:
                    sourceVideo.networkState
            }
        );
    }


    /* =========================================================
       STATUS
    ========================================================= */

    function setVideoStatus(
        text,
        type = "waiting"
    ) {

        if (!videoStatus) {
            return;
        }

        videoStatus.textContent =
            text;

        videoStatus.classList.remove(
            "waiting",
            "ready",
            "processing",
            "error",
            "warning"
        );

        videoStatus.classList.add(
            type
        );
    }


    /* =========================================================
       GENERATE BUTTON
    ========================================================= */

    function updateGenerateButton() {

        if (!generateButton) {
            return;
        }

        const ready =
            Boolean(selectedVideo) &&
            Boolean(selectedReference) &&
            videoPrepared;

        generateButton.disabled =
            !ready;

        if (ready) {

            generateButton.classList.add(
                "ready"
            );

        } else {

            generateButton.classList.remove(
                "ready"
            );
        }
    }


    /* =========================================================
       TIMER CLEANUP
    ========================================================= */

    function clearVideoTimers() {

        if (prepareTimer) {

            clearTimeout(
                prepareTimer
            );

            prepareTimer = null;
        }

        if (stallTimer) {

            clearTimeout(
                stallTimer
            );

            stallTimer = null;
        }

        if (seekPrepareTimer) {

            clearTimeout(
                seekPrepareTimer
            );

            seekPrepareTimer = null;
        }
    }


    /* =========================================================
       VIDEO ERROR
    ========================================================= */

    function getVideoErrorMessage(
        error
    ) {

        if (!error) {

            return "The video could not be played.";
        }

        switch (error.code) {

            case 1:
                return "Video playback was aborted.";

            case 2:
                return "A network error interrupted the video.";

            case 3:
                return "The browser could not decode this video.";

            case 4:
                return "This video format or codec is not supported by your browser.";

            default:
                return "The video could not be played.";
        }
    }


    function handleVideoError() {

        if (!sourceVideo) {
            return;
        }

        const error =
            sourceVideo.error;

        console.error(
            "Media element error:",
            error
        );

        videoPrepared =
            false;

        videoPreparing =
            false;

        clearVideoTimers();

        const message =
            getVideoErrorMessage(error);

        setVideoStatus(
            message,
            "error"
        );

        updateGenerateButton();

        showToast(
            message,
            "error"
        );
    }


    /* =========================================================
       VIDEO ELEMENT CLEANUP
    ========================================================= */

    function clearVideoElementSource() {

        if (!sourceVideo) {
            return;
        }

        try {
            sourceVideo.pause();
        } catch (error) {
            console.warn(
                "Unable to pause video:",
                error
            );
        }

        sourceVideo.removeAttribute(
            "src"
        );

        try {
            sourceVideo.load();
        } catch (error) {
            console.warn(
                "Unable to reset video element:",
                error
            );
        }
    }


    /* =========================================================
       COMPLETE TEMPORARY VIDEO CLEANUP
    ========================================================= */

    function clearTemporaryVideoData(
        options = {}
    ) {

        const keepInputFocus =
            options.keepInputFocus === true;

        videoGeneration++;

        clearVideoTimers();

        recoveryInProgress =
            false;

        isSeekingRecovery =
            false;

        restoringSeekPosition =
            false;

        wasPlayingBeforeRecovery =
            false;

        pendingSeekTime =
            null;

        lastTime =
            0;

        videoPrepared =
            false;

        videoPreparing =
            false;

        if (sourceVideo) {

            try {
                sourceVideo.pause();
            } catch (error) {
                console.warn(
                    "Video pause cleanup failed:",
                    error
                );
            }
        }

        if (videoObjectUrl) {

            URL.revokeObjectURL(
                videoObjectUrl
            );

            videoObjectUrl =
                null;
        }

        clearVideoElementSource();

        selectedVideo =
            null;

        if (videoInput) {

            videoInput.value =
                "";

            if (!keepInputFocus) {
                videoInput.blur();
            }
        }

        if (videoPreviewContainer) {

            videoPreviewContainer.classList.add(
                "d-none"
            );

            videoPreviewContainer.classList.remove(
                "active",
                "visible",
                "show"
            );
        }

        if (videoUploadArea) {

            videoUploadArea.classList.remove(
                "d-none"
            );

            videoUploadArea.classList.remove(
                "has-file",
                "active",
                "dragging"
            );
        }

        if (videoFileName) {

            videoFileName.textContent =
                "video.mp4";
        }

        if (videoFileSize) {

            videoFileSize.textContent =
                "0 MB";
        }

        setVideoStatus(
            "Waiting",
            "waiting"
        );

        updateGenerateButton();
    }


    /* =========================================================
       COMPLETE TEMPORARY REFERENCE CLEANUP
    ========================================================= */

    function clearTemporaryReferenceData() {

        if (referenceObjectUrl) {

            URL.revokeObjectURL(
                referenceObjectUrl
            );

            referenceObjectUrl =
                null;
        }

        selectedReference =
            null;

        if (referenceInput) {

            referenceInput.value =
                "";
        }

        if (referenceImage) {

            referenceImage.removeAttribute(
                "src"
            );
        }

        if (referencePreview) {

            referencePreview.classList.add(
                "d-none"
            );

            referencePreview.classList.remove(
                "active",
                "visible",
                "show"
            );
        }

        if (referencePlaceholder) {

            referencePlaceholder.classList.remove(
                "d-none"
            );
        }

        if (referenceFileRow) {

            referenceFileRow.classList.add(
                "d-none"
            );
        }

        if (referenceUploadArea) {

            referenceUploadArea.classList.remove(
                "has-file",
                "active",
                "dragging"
            );
        }

        if (referenceFileName) {

            referenceFileName.textContent =
                "reference.jpg";
        }

        if (referenceFileSize) {

            referenceFileSize.textContent =
                "0 MB";
        }

        if (referenceStatus) {

            referenceStatus.textContent =
                "Waiting";

            referenceStatus.classList.remove(
                "ready",
                "processing",
                "error",
                "warning"
            );

            referenceStatus.classList.add(
                "waiting"
            );
        }

        updateGenerateButton();
    }


    /* =========================================================
       PREPARE VIDEO
    ========================================================= */

    function prepareVideo() {

        if (
            !sourceVideo ||
            !selectedVideo
        ) {
            return;
        }

        clearVideoTimers();

        videoPrepared =
            false;

        videoPreparing =
            true;

        setVideoStatus(
            "Preparing...",
            "processing"
        );

        prepareTimer =
            setTimeout(
                function () {

                    if (
                        selectedVideo &&
                        !videoPrepared
                    ) {

                        videoPreparing =
                            false;

                        setVideoStatus(
                            "Video is taking too long to prepare.",
                            "warning"
                        );

                        showToast(
                            "The video is taking too long to load.",
                            "warning"
                        );

                        updateGenerateButton();
                    }

                },
                PREPARE_TIMEOUT
            );

        try {

            sourceVideo.load();

        } catch (error) {

            console.error(
                "Video preparation failed:",
                error
            );

            handleVideoError();
        }
    }


    /* =========================================================
       VIDEO READY
    ========================================================= */

    function markVideoReady() {

        if (!selectedVideo) {
            return;
        }

        videoPrepared =
            true;

        videoPreparing =
            false;

        clearVideoTimers();

        setVideoStatus(
            sourceVideo && sourceVideo.paused
                ? "Ready"
                : "Playing",
            "ready"
        );

        updateGenerateButton();

        logBufferState();
    }


    /* =========================================================
       VIDEO METADATA
    ========================================================= */

    function handleVideoMetadata(
        file
    ) {

        if (
            !selectedVideo ||
            !sourceVideo
        ) {
            return;
        }

        const duration =
            sourceVideo.duration;

        if (
            !Number.isFinite(duration)
        ) {

            setVideoStatus(
                "Unable to read video duration.",
                "error"
            );

            showToast(
                "The browser could not read this video's duration.",
                "error"
            );

            return;
        }

        if (
            duration >
            MAX_VIDEO_DURATION
        ) {

            showToast(
                `Video must be ${Math.floor(MAX_VIDEO_DURATION / 60)} minutes or shorter.`,
                "error"
            );

            clearTemporaryVideoData();

            return;
        }

        if (videoFileSize) {

            videoFileSize.textContent =
                `${formatFileSize(file.size)} · ${formatDuration(duration)}`;
        }

        prepareVideo();
    }


    /* =========================================================
       HANDLE VIDEO
    ========================================================= */

    function handleVideo(file) {

        console.log(
            "[Face Studio] handleVideo() called:",
            file
        );

        if (!file) {
            return;
        }

        if (
            !file.type ||
            !file.type.startsWith("video/")
        ) {

            showToast(
                "Please select a valid video file.",
                "error"
            );

            if (videoInput) {
                videoInput.value = "";
            }

            return;
        }

        const maxSize =
            MAX_VIDEO_SIZE_MB *
            1024 *
            1024;

        if (file.size > maxSize) {

            showToast(
                `Video must be ${MAX_VIDEO_SIZE_MB} MB or smaller.`,
                "error"
            );

            if (videoInput) {
                videoInput.value = "";
            }

            return;
        }

        clearTemporaryVideoData({
            keepInputFocus: true
        });

        selectedVideo =
            file;

        videoGeneration++;

        if (videoUploadArea) {
            videoUploadArea.classList.add(
                "d-none"
            );
        }

        if (videoPreviewContainer) {

            videoPreviewContainer.classList.remove(
                "d-none"
            );

            videoPreviewContainer.classList.add(
                "active",
                "visible"
            );
        }

        if (videoFileName) {
            videoFileName.textContent =
                file.name;
        }

        if (videoFileSize) {

            videoFileSize.textContent =
                `${formatFileSize(file.size)} · Loading...`;
        }

        setVideoStatus(
            "Loading...",
            "processing"
        );

        videoObjectUrl =
            URL.createObjectURL(file);

        if (sourceVideo) {

            sourceVideo.preload =
                "auto";

            sourceVideo.addEventListener(
                "loadedmetadata",
                function videoMetadataListener() {

                    sourceVideo.removeEventListener(
                        "loadedmetadata",
                        videoMetadataListener
                    );

                    handleVideoMetadata(
                        file
                    );

                }
            );

            sourceVideo.src =
                videoObjectUrl;

            try {
                sourceVideo.load();
            } catch (error) {

                console.error(
                    "Unable to load selected video:",
                    error
                );

                handleVideoError();
            }

        } else {

            showToast(
                "Video player element was not found.",
                "error"
            );
        }
    }


    /* =========================================================
       VIDEO INPUT
    ========================================================= */

    if (videoInput) {

        videoInput.addEventListener(
            "change",
            function (event) {

                const file =
                    event.target.files &&
                    event.target.files[0];

                console.log(
                    "[Face Studio] Video input changed:",
                    file
                );

                if (file) {
                    handleVideo(file);
                }
            }
        );
    }


    /* =========================================================
       CHOOSE VIDEO BUTTON
    ========================================================= */

    if (selectVideoButton) {

        selectVideoButton.addEventListener(
            "click",
            function (event) {

                event.preventDefault();
                event.stopPropagation();

                if (videoInput) {
                    videoInput.click();
                }
            }
        );
    }


    /* =========================================================
       VIDEO UPLOAD AREA
    ========================================================= */

    if (videoUploadArea) {

        videoUploadArea.addEventListener(
            "click",
            function (event) {

                if (
                    event.target.closest(
                        "#selectVideoButton"
                    ) ||
                    event.target.closest("button")
                ) {
                    return;
                }

                if (videoInput) {
                    videoInput.click();
                }
            }
        );
    }


    /* =========================================================
       REFERENCE INPUT
    ========================================================= */

    if (referenceInput) {

        referenceInput.addEventListener(
            "change",
            function (event) {

                const file =
                    event.target.files &&
                    event.target.files[0];

                console.log(
                    "[Face Studio] Reference input changed:",
                    file
                );

                if (file) {
                    handleReference(file);
                }
            }
        );
    }


    /* =========================================================
       CHOOSE REFERENCE BUTTON
    ========================================================= */

    if (selectReferenceButton) {

        selectReferenceButton.addEventListener(
            "click",
            function (event) {

                event.preventDefault();
                event.stopPropagation();

                if (referenceInput) {
                    referenceInput.click();
                }
            }
        );
    }


    /* =========================================================
       REFERENCE UPLOAD AREA
    ========================================================= */

    if (referenceUploadArea) {

        referenceUploadArea.addEventListener(
            "click",
            function (event) {

                if (
                    event.target.closest(
                        "#selectReferenceButton"
                    ) ||
                    event.target.closest("button")
                ) {
                    return;
                }

                if (referenceInput) {
                    referenceInput.click();
                }
            }
        );
    }


    /* =========================================================
       HANDLE REFERENCE
    ========================================================= */

    function handleReference(file) {

        console.log(
            "[Face Studio] handleReference() called:",
            file
        );

        if (!file) {
            return;
        }

        if (
            !file.type ||
            !file.type.startsWith("image/")
        ) {

            showToast(
                "Please select a valid image.",
                "error"
            );

            if (referenceInput) {
                referenceInput.value = "";
            }

            return;
        }

        const maxSize =
            MAX_REFERENCE_SIZE_MB *
            1024 *
            1024;

        if (file.size > maxSize) {

            showToast(
                `Reference image must be ${MAX_REFERENCE_SIZE_MB} MB or smaller.`,
                "error"
            );

            if (referenceInput) {
                referenceInput.value = "";
            }

            return;
        }

        clearTemporaryReferenceData();

        selectedReference =
            file;

        referenceObjectUrl =
            URL.createObjectURL(file);

        if (referenceImage) {
            referenceImage.src =
                referenceObjectUrl;
        }

        if (referenceFileName) {
            referenceFileName.textContent =
                file.name;
        }

        if (referenceFileSize) {
            referenceFileSize.textContent =
                formatFileSize(file.size);
        }

        if (referencePlaceholder) {
            referencePlaceholder.classList.add(
                "d-none"
            );
        }

        if (referencePreview) {

            referencePreview.classList.remove(
                "d-none"
            );

            referencePreview.classList.add(
                "active",
                "visible"
            );
        }

        if (referenceFileRow) {
            referenceFileRow.classList.remove(
                "d-none"
            );
        }

        if (referenceUploadArea) {
            referenceUploadArea.classList.add(
                "has-file"
            );
        }

        if (referenceStatus) {

            referenceStatus.textContent =
                "Ready";

            referenceStatus.classList.remove(
                "waiting",
                "processing",
                "error",
                "warning"
            );

            referenceStatus.classList.add(
                "ready"
            );
        }

        updateGenerateButton();
    }


    /* =========================================================
       REPLACE / REMOVE
    ========================================================= */

    if (replaceVideoButton) {

        replaceVideoButton.addEventListener(
            "click",
            function (event) {

                event.preventDefault();
                event.stopPropagation();

                clearTemporaryVideoData({
                    keepInputFocus: true
                });

                setTimeout(
                    function () {

                        if (videoInput) {
                            videoInput.click();
                        }

                    },
                    50
                );
            }
        );
    }


    if (removeVideoButton) {

        removeVideoButton.addEventListener(
            "click",
            function (event) {

                event.preventDefault();
                event.stopPropagation();

                clearTemporaryVideoData();

                showToast(
                    "Temporary video data cleared.",
                    "success"
                );
            }
        );
    }


    if (replaceReferenceButton) {

        replaceReferenceButton.addEventListener(
            "click",
            function (event) {

                event.preventDefault();
                event.stopPropagation();

                clearTemporaryReferenceData();

                setTimeout(
                    function () {

                        if (referenceInput) {
                            referenceInput.click();
                        }

                    },
                    50
                );
            }
        );
    }


    if (removeReferenceButton) {

        removeReferenceButton.addEventListener(
            "click",
            function (event) {

                event.preventDefault();
                event.stopPropagation();

                clearTemporaryReferenceData();

                showToast(
                    "Temporary reference data cleared.",
                    "success"
                );
            }
        );
    }


    /* =========================================================
       DRAG & DROP
    ========================================================= */

    if (videoUploadArea) {

        videoUploadArea.addEventListener(
            "dragover",
            function (event) {

                event.preventDefault();

                videoUploadArea.classList.add(
                    "dragging"
                );
            }
        );

        videoUploadArea.addEventListener(
            "dragleave",
            function () {

                videoUploadArea.classList.remove(
                    "dragging"
                );
            }
        );

        videoUploadArea.addEventListener(
            "drop",
            function (event) {

                event.preventDefault();

                videoUploadArea.classList.remove(
                    "dragging"
                );

                const file =
                    event.dataTransfer.files &&
                    event.dataTransfer.files[0];

                if (file) {
                    handleVideo(file);
                }
            }
        );
    }


    if (referenceUploadArea) {

        referenceUploadArea.addEventListener(
            "dragover",
            function (event) {

                event.preventDefault();

                referenceUploadArea.classList.add(
                    "dragging"
                );
            }
        );

        referenceUploadArea.addEventListener(
            "dragleave",
            function () {

                referenceUploadArea.classList.remove(
                    "dragging"
                );
            }
        );

        referenceUploadArea.addEventListener(
            "drop",
            function (event) {

                event.preventDefault();

                referenceUploadArea.classList.remove(
                    "dragging"
                );

                const file =
                    event.dataTransfer.files &&
                    event.dataTransfer.files[0];

                if (file) {
                    handleReference(file);
                }
            }
        );
    }


    /* =========================================================
       VIDEO EVENTS
    ========================================================= */

    if (sourceVideo) {

        sourceVideo.addEventListener(
            "loadstart",
            function () {

                if (!selectedVideo) {
                    return;
                }

                videoPrepared =
                    false;

                setVideoStatus(
                    "Loading...",
                    "processing"
                );
            }
        );


        sourceVideo.addEventListener(
            "loadeddata",
            function () {

                if (selectedVideo) {
                    console.log(
                        "Video loaded data."
                    );
                }
            }
        );


        sourceVideo.addEventListener(
            "canplay",
            function () {

                if (!selectedVideo) {
                    return;
                }

                markVideoReady();

                if (
                    pendingSeekTime !== null
                ) {
                    restoreSeekPosition();
                }

                if (isSeekingRecovery) {

                    isSeekingRecovery =
                        false;

                    if (
                        wasPlayingBeforeRecovery
                    ) {

                        sourceVideo.play()
                            .catch(
                                function () {}
                            );
                    }

                    wasPlayingBeforeRecovery =
                        false;
                }
            }
        );


        sourceVideo.addEventListener(
            "canplaythrough",
            function () {

                if (!selectedVideo) {
                    return;
                }

                markVideoReady();
            }
        );


        sourceVideo.addEventListener(
            "play",
            function () {

                if (selectedVideo) {
                    lastTime =
                        sourceVideo.currentTime;
                }
            }
        );


        sourceVideo.addEventListener(
            "playing",
            function () {

                if (!selectedVideo) {
                    return;
                }

                videoPreparing =
                    false;

                setVideoStatus(
                    "Playing",
                    "ready"
                );

                recoveryInProgress =
                    false;
            }
        );


        sourceVideo.addEventListener(
            "pause",
            function () {

                if (
                    selectedVideo &&
                    !isSeekingRecovery &&
                    !recoveryInProgress
                ) {

                    setVideoStatus(
                        "Ready",
                        "ready"
                    );
                }
            }
        );


        sourceVideo.addEventListener(
            "waiting",
            function () {

                if (
                    !selectedVideo ||
                    sourceVideo.paused ||
                    sourceVideo.ended ||
                    recoveryInProgress
                ) {
                    return;
                }

                recoveryInProgress =
                    true;

                wasPlayingBeforeRecovery =
                    true;

                pendingSeekTime =
                    sourceVideo.currentTime;

                videoPrepared =
                    false;

                setVideoStatus(
                    "Buffering...",
                    "processing"
                );

                clearVideoTimers();

                stallTimer =
                    setTimeout(
                        function () {

                            if (
                                selectedVideo &&
                                sourceVideo
                            ) {

                                try {

                                    sourceVideo.currentTime =
                                        pendingSeekTime;

                                } catch (error) {

                                    console.warn(
                                        "Buffer recovery failed:",
                                        error
                                    );
                                }
                            }

                            recoveryInProgress =
                                false;

                        },
                        STALL_RECOVERY_DELAY
                    );
            }
        );


        sourceVideo.addEventListener(
            "stalled",
            function () {

                if (
                    !selectedVideo ||
                    sourceVideo.paused ||
                    sourceVideo.ended ||
                    recoveryInProgress
                ) {
                    return;
                }

                recoveryInProgress =
                    true;

                wasPlayingBeforeRecovery =
                    true;

                pendingSeekTime =
                    sourceVideo.currentTime;

                setVideoStatus(
                    "Buffering...",
                    "processing"
                );

                clearVideoTimers();

                stallTimer =
                    setTimeout(
                        function () {

                            if (selectedVideo) {

                                try {

                                    sourceVideo.currentTime =
                                        pendingSeekTime;

                                } catch (error) {

                                    console.warn(
                                        "Stall recovery failed:",
                                        error
                                    );
                                }
                            }

                            recoveryInProgress =
                                false;

                        },
                        STALL_RECOVERY_DELAY
                    );
            }
        );


        sourceVideo.addEventListener(
            "progress",
            function () {

                if (selectedVideo) {
                    logBufferState();
                }
            }
        );


        sourceVideo.addEventListener(
            "seeking",
            function () {

                if (
                    !selectedVideo ||
                    restoringSeekPosition ||
                    isSeekingRecovery
                ) {
                    return;
                }

                const seekTime =
                    sourceVideo.currentTime;

                if (!Number.isFinite(seekTime)) {
                    return;
                }

                pendingSeekTime =
                    seekTime;

                wasPlayingBeforeRecovery =
                    !sourceVideo.paused;

                videoPrepared =
                    false;

                videoPreparing =
                    true;

                setVideoStatus(
                    "Seeking...",
                    "processing"
                );

                clearVideoTimers();

                seekPrepareTimer =
                    setTimeout(
                        function () {

                            if (
                                !videoPrepared &&
                                selectedVideo
                            ) {

                                videoPreparing =
                                    false;

                                setVideoStatus(
                                    "Seek is taking longer than expected.",
                                    "warning"
                                );
                            }

                        },
                        SEEK_PREPARE_TIMEOUT
                    );
            }
        );


        sourceVideo.addEventListener(
            "seeked",
            function () {

                if (!selectedVideo) {
                    return;
                }

                clearVideoTimers();

                videoPrepared =
                    true;

                videoPreparing =
                    false;

                isSeekingRecovery =
                    false;

                setVideoStatus(
                    sourceVideo.paused
                        ? "Ready"
                        : "Playing",
                    "ready"
                );

                if (
                    wasPlayingBeforeRecovery &&
                    sourceVideo.paused
                ) {

                    sourceVideo.play()
                        .catch(
                            function () {}
                        );
                }

                wasPlayingBeforeRecovery =
                    false;

                updateGenerateButton();

                logBufferState();
            }
        );


        sourceVideo.addEventListener(
            "ended",
            function () {

                if (!selectedVideo) {
                    return;
                }

                setVideoStatus(
                    "Ready",
                    "ready"
                );

                lastTime =
                    sourceVideo.currentTime;
            }
        );


        sourceVideo.addEventListener(
            "timeupdate",
            function () {

                if (selectedVideo) {
                    lastTime =
                        sourceVideo.currentTime;
                }
            }
        );


        sourceVideo.addEventListener(
            "abort",
            function () {

                if (selectedVideo) {

                    console.warn(
                        "Video loading was aborted."
                    );
                }
            }
        );


        sourceVideo.addEventListener(
            "error",
            function () {

                if (selectedVideo) {
                    handleVideoError();
                }
            }
        );
    }


    /* =========================================================
       GENERATE — DEBUG + SEND FILES TO PHP
    ========================================================= */

    if (generateButton) {

        generateButton.addEventListener(
            "click",
            function (event) {

                event.preventDefault();


                /* =================================================
                   DEBUG 1 — BUTTON CLICK
                ================================================= */

                console.group(
                    "%c[Face Studio] GENERATE BUTTON CLICK",
                    "color: blue; font-weight: bold;"
                );

                console.log(
                    "Button element:",
                    generateButton
                );

                console.log(
                    "Button disabled:",
                    generateButton.disabled
                );

                console.log(
                    "Selected video:",
                    selectedVideo
                );

                console.log(
                    "Selected reference:",
                    selectedReference
                );

                console.log(
                    "Video prepared:",
                    videoPrepared
                );

                console.log(
                    "Processing state:",
                    generateButton.dataset.processing
                );

                console.log(
                    "Transform endpoint:",
                    TRANSFORM_ENDPOINT
                );

                console.log(
                    "Current page:",
                    window.location.href
                );

                console.log(
                    "Current origin:",
                    window.location.origin
                );

                console.groupEnd();


                if (
                    !selectedVideo ||
                    !selectedReference
                ) {

                    console.warn(
                        "[Face Studio] Generate stopped: missing video or reference."
                    );

                    showToast(
                        "Upload a video and reference face first.",
                        "warning"
                    );

                    return;
                }


                if (!videoPrepared) {

                    console.warn(
                        "[Face Studio] Generate stopped: video is not prepared."
                    );

                    showToast(
                        "Please wait for the video to finish preparing.",
                        "warning"
                    );

                    return;
                }


                if (
                    generateButton.dataset.processing ===
                    "true"
                ) {

                    console.warn(
                        "[Face Studio] Generate ignored: already processing."
                    );

                    return;
                }


                generateButton.dataset.processing =
                    "true";

                generateButton.disabled =
                    true;


                const normalText =
                    generateButton.querySelector(
                        ".generate-normal"
                    );

                const loadingText =
                    generateButton.querySelector(
                        ".generate-loading"
                    );


                if (normalText) {

                    normalText.classList.add(
                        "d-none"
                    );
                }


                if (loadingText) {

                    loadingText.classList.remove(
                        "d-none"
                    );

                    loadingText.textContent =
                        "Uploading...";
                }


                if (processingPanel) {

                    processingPanel.classList.remove(
                        "d-none"
                    );

                    processingPanel.classList.add(
                        "active",
                        "visible"
                    );
                }


                if (processingProgressBar) {

                    processingProgressBar.style.width =
                        "0%";
                }


                if (processingPercentage) {

                    processingPercentage.textContent =
                        "0%";
                }


                if (processingStatus) {

                    processingStatus.textContent =
                        "Preparing upload...";
                }


                /* =================================================
                   FORM DATA
                ================================================= */

                console.log(
                    "%c[Face Studio] Creating FormData...",
                    "color: purple; font-weight: bold;"
                );


                const formData =
                    new FormData();


                formData.append(
                    "video",
                    selectedVideo,
                    selectedVideo.name
                );


                formData.append(
                    "reference",
                    selectedReference,
                    selectedReference.name
                );


                const qualitySelect =
                    document.getElementById(
                        "qualitySelect"
                    );


                if (qualitySelect) {

                    formData.append(
                        "quality",
                        qualitySelect.value
                    );
                }


                /* =================================================
                   DEBUG 2 — FORMDATA
                ================================================= */

                console.group(
                    "%c[Face Studio] FORMDATA READY",
                    "color: purple; font-weight: bold;"
                );

                console.log(
                    "video:",
                    formData.get("video")
                );

                console.log(
                    "reference:",
                    formData.get("reference")
                );

                console.log(
                    "quality:",
                    formData.get("quality")
                );

                console.log(
                    "Video name:",
                    selectedVideo.name
                );

                console.log(
                    "Video size:",
                    selectedVideo.size,
                    formatFileSize(selectedVideo.size)
                );

                console.log(
                    "Video type:",
                    selectedVideo.type
                );

                console.log(
                    "Reference name:",
                    selectedReference.name
                );

                console.log(
                    "Reference size:",
                    selectedReference.size,
                    formatFileSize(selectedReference.size)
                );

                console.log(
                    "Reference type:",
                    selectedReference.type
                );

                console.groupEnd();


                /* =================================================
                   XHR
                ================================================= */

                console.log(
                    "%c[Face Studio] Creating XMLHttpRequest...",
                    "color: orange; font-weight: bold;"
                );


                const xhr =
                    new XMLHttpRequest();


                xhr.open(
                    "POST",
                    TRANSFORM_ENDPOINT,
                    true
                );


                /* =================================================
                   DEBUG 3 — XHR OPENED
                ================================================= */

                console.group(
                    "%c[Face Studio] XHR OPENED",
                    "color: orange; font-weight: bold;"
                );

                console.log(
                    "Method:",
                    "POST"
                );

                console.log(
                    "URL:",
                    TRANSFORM_ENDPOINT
                );

                console.log(
                    "Ready state:",
                    xhr.readyState
                );

                console.log(
                    "withCredentials will be:",
                    true
                );

                console.groupEnd();


                xhr.withCredentials =
                    true;


                xhr.setRequestHeader(
                    "Accept",
                    "application/json"
                );


                /* =================================================
                   XHR STATE CHANGE
                ================================================= */

                xhr.onreadystatechange =
                    function () {

                        console.log(
                            "[Face Studio] XHR readyState:",
                            xhr.readyState,
                            "status:",
                            xhr.status
                        );

                    };


                /* =================================================
                   UPLOAD PROGRESS
                ================================================= */

                xhr.upload.onprogress =
                    function (event) {

                        if (!event.lengthComputable) {

                            console.log(
                                "[Face Studio] Upload progress event is not computable."
                            );

                            return;
                        }

                        const percent =
                            Math.round(
                                (
                                    event.loaded /
                                    event.total
                                ) * 40
                            );


                        console.log(
                            "[Face Studio] Upload progress:",
                            {
                                loaded:
                                    event.loaded,

                                total:
                                    event.total,

                                percent:
                                    percent
                            }
                        );


                        if (processingProgressBar) {

                            processingProgressBar.style.width =
                                `${percent}%`;
                        }


                        if (processingPercentage) {

                            processingPercentage.textContent =
                                `${percent}%`;
                        }


                        if (processingStatus) {

                            processingStatus.textContent =
                                `Uploading files... ${percent}%`;
                        }


                        if (loadingText) {

                            loadingText.textContent =
                                `Uploading ${percent}%`;
                        }
                    };


                /* =================================================
                   UPLOAD COMPLETE
                ================================================= */

                xhr.upload.onload =
                    function () {

                        console.log(
                            "%c[Face Studio] UPLOAD COMPLETE",
                            "color: green; font-weight: bold;"
                        );


                        if (processingProgressBar) {

                            processingProgressBar.style.width =
                                "45%";
                        }


                        if (processingPercentage) {

                            processingPercentage.textContent =
                                "45%";
                        }


                        if (processingStatus) {

                            processingStatus.textContent =
                                "Files uploaded. Waiting for server...";
                        }


                        if (loadingText) {

                            loadingText.textContent =
                                "Processing...";
                        }
                    };


                /* =================================================
                   RESPONSE
                ================================================= */

                xhr.onload =
                    function () {

                        console.group(
                            "%c[Face Studio] PHP RESPONSE RECEIVED",
                            "color: green; font-weight: bold;"
                        );

                        console.log(
                            "HTTP status:",
                            xhr.status
                        );

                        console.log(
                            "Status text:",
                            xhr.statusText
                        );

                        console.log(
                            "Response URL:",
                            xhr.responseURL
                        );

                        console.log(
                            "Response type:",
                            xhr.responseType
                        );

                        console.log(
                            "Raw response:",
                            xhr.responseText
                        );

                        console.groupEnd();


                        let data = null;


                        try {

                            data =
                                JSON.parse(
                                    xhr.responseText
                                );

                        } catch (error) {

                            console.error(
                                "[Face Studio] PHP returned invalid JSON.",
                                error
                            );

                            console.error(
                                "[Face Studio] Raw PHP response:",
                                xhr.responseText
                            );


                            finishGenerateError(
                                "The server returned an invalid response."
                            );

                            return;
                        }


                        console.log(
                            "[Face Studio] Parsed PHP data:",
                            data
                        );


                        if (
                            xhr.status < 200 ||
                            xhr.status >= 300
                        ) {

                            console.error(
                                "[Face Studio] PHP returned HTTP error:",
                                xhr.status,
                                data
                            );


                            finishGenerateError(
                                data.message ||
                                `Server returned HTTP ${xhr.status}.`
                            );

                            return;
                        }


                        if (!data.success) {

                            console.error(
                                "[Face Studio] PHP rejected request:",
                                data
                            );


                            finishGenerateError(
                                data.message ||
                                "The server rejected the transformation request."
                            );

                            return;
                        }


                        console.log(
                            "%c[Face Studio] SUCCESS — PHP RECEIVED THE FILES",
                            "color: green; font-weight: bold;",
                            data
                        );


                        if (processingProgressBar) {

                            processingProgressBar.style.width =
                                "50%";
                        }


                        if (processingPercentage) {

                            processingPercentage.textContent =
                                "50%";
                        }


                        if (processingStatus) {

                            processingStatus.textContent =
                                "Files received successfully. Ready for AI processing.";
                        }


                        if (loadingText) {

                            loadingText.textContent =
                                "Received";
                        }


                        showToast(
                            "Video and reference image successfully sent to the server.",
                            "success"
                        );


                        /*
                         * Current transform.php only validates
                         * the uploaded files.
                         *
                         * Python + Decart will be connected later.
                         */

                        setTimeout(
                            function () {

                                generateButton.disabled =
                                    false;

                                generateButton.dataset.processing =
                                    "false";

                                if (normalText) {

                                    normalText.classList.remove(
                                        "d-none"
                                    );
                                }

                                if (loadingText) {

                                    loadingText.classList.add(
                                        "d-none"
                                    );
                                }

                            },
                            1000
                        );
                    };


                /* =================================================
                   NETWORK ERROR
                ================================================= */

                xhr.onerror =
                    function (event) {

                        console.group(
                            "%c[Face Studio] XHR NETWORK ERROR",
                            "color: red; font-weight: bold;"
                        );

                        console.error(
                            "Event:",
                            event
                        );

                        console.error(
                            "Endpoint:",
                            TRANSFORM_ENDPOINT
                        );

                        console.error(
                            "Ready state:",
                            xhr.readyState
                        );

                        console.error(
                            "Status:",
                            xhr.status
                        );

                        console.groupEnd();


                        finishGenerateError(
                            "Could not connect to the AIStudio server."
                        );
                    };


                /* =================================================
                   ABORT
                ================================================= */

                xhr.onabort =
                    function (event) {

                        console.warn(
                            "[Face Studio] XHR aborted:",
                            event
                        );


                        finishGenerateError(
                            "The upload was cancelled."
                        );
                    };


                /* =================================================
                   TIMEOUT
                ================================================= */

                xhr.ontimeout =
                    function (event) {

                        console.error(
                            "[Face Studio] XHR timeout:",
                            event
                        );


                        finishGenerateError(
                            "The server took too long to respond."
                        );
                    };


                xhr.timeout =
                    0;


                /* =================================================
                   SEND
                ================================================= */

                try {

                    console.group(
                        "%c[Face Studio] SENDING XHR",
                        "color: blue; font-weight: bold;"
                    );

                    console.log(
                        "About to call xhr.send()."
                    );

                    console.log(
                        "Endpoint:",
                        TRANSFORM_ENDPOINT
                    );

                    console.log(
                        "XHR readyState before send:",
                        xhr.readyState
                    );

                    console.groupEnd();


                    xhr.send(
                        formData
                    );


                    console.log(
                        "%c[Face Studio] xhr.send() CALLED SUCCESSFULLY",
                        "color: green; font-weight: bold;"
                    );

                    console.log(
                        "XHR readyState after send:",
                        xhr.readyState
                    );

                } catch (error) {

                    console.error(
                        "%c[Face Studio] xhr.send() THREW AN ERROR",
                        "color: red; font-weight: bold;",
                        error
                    );


                    finishGenerateError(
                        "Unable to send the files to the server."
                    );
                }


                /* =================================================
                   ERROR HANDLER
                ================================================= */

                function finishGenerateError(
                    message
                ) {

                    console.error(
                        "%c[Face Studio] GENERATE ERROR:",
                        "color: red; font-weight: bold;",
                        message
                    );


                    if (processingStatus) {

                        processingStatus.textContent =
                            message;
                    }


                    if (processingProgressBar) {

                        processingProgressBar.style.width =
                            "0%";
                    }


                    if (processingPercentage) {

                        processingPercentage.textContent =
                            "0%";
                    }


                    showToast(
                        message,
                        "error"
                    );


                    generateButton.disabled =
                        false;

                    generateButton.dataset.processing =
                        "false";


                    if (normalText) {

                        normalText.classList.remove(
                            "d-none"
                        );
                    }


                    if (loadingText) {

                        loadingText.classList.add(
                            "d-none"
                        );

                        loadingText.textContent =
                            "Preparing...";
                    }
                }
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

                if (
                    !resultVideo ||
                    !resultVideo.src
                ) {

                    showToast(
                        "No generated video is available.",
                        "warning"
                    );

                    return;
                }


                const link =
                    document.createElement("a");


                link.href =
                    resultVideo.src;


                link.download =
                    "aistudio-face-transformation.mp4";


                document.body.appendChild(
                    link
                );


                link.click();


                link.remove();
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

                clearTemporaryVideoData();

                clearTemporaryReferenceData();


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


                if (generateButton) {

                    generateButton.disabled =
                        true;

                    generateButton.dataset.processing =
                        "false";


                    const normalText =
                        generateButton.querySelector(
                            ".generate-normal"
                        );

                    const loadingText =
                        generateButton.querySelector(
                            ".generate-loading"
                        );


                    if (normalText) {

                        normalText.classList.remove(
                            "d-none"
                        );
                    }

                    if (loadingText) {

                        loadingText.classList.add(
                            "d-none"
                        );

                        loadingText.textContent =
                            "Preparing...";
                    }
                }


                showToast(
                    "Ready for a new transformation.",
                    "success"
                );
            }
        );
    }


    /* =========================================================
       SEEK RECOVERY
    ========================================================= */

    function restoreSeekPosition() {

        if (
            !sourceVideo ||
            pendingSeekTime === null
        ) {
            return;
        }

        const targetTime =
            pendingSeekTime;

        pendingSeekTime =
            null;

        restoringSeekPosition =
            true;

        try {

            sourceVideo.currentTime =
                targetTime;

        } catch (error) {

            console.warn(
                "Unable to restore seek position:",
                error
            );

        } finally {

            setTimeout(
                function () {

                    restoringSeekPosition =
                        false;

                },
                0
            );
        }
    }


    /* =========================================================
       INITIAL STATE
    ========================================================= */

    clearTemporaryVideoData();

    clearTemporaryReferenceData();

    updateGenerateButton();


    /* =========================================================
       DEBUG API
    ========================================================= */

    window.faceStudioDebug = {

        clearVideo:
            clearTemporaryVideoData,

        clearReference:
            clearTemporaryReferenceData,

        prepareVideo:
            prepareVideo,

        getVideoState:
            function () {

                return {

                    selectedVideo:
                        selectedVideo,

                    selectedReference:
                        selectedReference,

                    videoPrepared:
                        videoPrepared,

                    videoPreparing:
                        videoPreparing,

                    currentTime:
                        sourceVideo
                            ? sourceVideo.currentTime
                            : 0,

                    bufferedSeconds:
                        sourceVideo
                            ? getBufferedSeconds()
                            : 0,

                    bufferPercentage:
                        sourceVideo
                            ? getBufferPercentage()
                            : 0,

                    readyState:
                        sourceVideo
                            ? sourceVideo.readyState
                            : 0
                };
            },

        testEndpoint:
            function () {

                console.log(
                    "%c[Face Studio] Endpoint test:",
                    "color: blue; font-weight: bold;"
                );

                console.log(
                    "Current page:",
                    window.location.href
                );

                console.log(
                    "Origin:",
                    window.location.origin
                );

                console.log(
                    "Transform endpoint:",
                    TRANSFORM_ENDPOINT
                );

                return TRANSFORM_ENDPOINT;
            }
    };


    console.log(
        "%c[Face Studio] Debug system ready.",
        "color: green; font-weight: bold;"
    );

});