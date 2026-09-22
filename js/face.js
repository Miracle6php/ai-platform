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

    const estimatedCreditsLabel =
        document.getElementById("estimatedCredits");

    const topbarCreditsPill =
        document.getElementById("topbarCredits");

    const topbarCreditsValue =
        topbarCreditsPill
            ? topbarCreditsPill.querySelector("span:not(.credits-label)")
            : null;

    const headerCreditsValue =
        document.getElementById("headerCredits");


    /* =========================================================
       SETTINGS
    ========================================================= */

    const MAX_VIDEO_SIZE_MB = 10;

    const MAX_REFERENCE_SIZE_MB = 10;

    const MAX_VIDEO_DURATION = 600;

    const PREPARE_TIMEOUT = 30000;

    const STALL_RECOVERY_DELAY = 1500;

    const SEEK_PREPARE_TIMEOUT = 15000;

    /* Credits charged per second of generated video. Must match
       CREDITS_PER_SECOND in backend/face/transform.php. */
    const CREDITS_PER_SECOND = 6;

    /* How often to re-check job status while it's processing. */
    const STATUS_POLL_INTERVAL_MS = 3000;


    /* =========================================================
       PHP ENDPOINTS
    ========================================================= */

    const TRANSFORM_ENDPOINT =
        window.location.origin +
        "/backend/face/transform.php";

    const STATUS_ENDPOINT =
        window.location.origin +
        "/backend/face/status.php";


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

    console.log(
        "[Face Studio] Status endpoint:",
        STATUS_ENDPOINT
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

    let videoDurationSeconds = 0;

    /* Guards against a stray poll continuing after the user starts a
       new transformation (or hits "New Transformation" mid-poll). */
    let activePollToken = 0;


    /* =========================================================
       FILE SIZE LIMIT MODAL
       Self-contained (styles + markup injected here) so this pop-up
       doesn't depend on anything in studio.css / the PHP markup.
    ========================================================= */

    let sizeLimitModalEl = null;

    function injectSizeLimitModalStyles() {

        if (document.getElementById("sizeLimitModalStyles")) {
            return;
        }

        const style =
            document.createElement("style");

        style.id =
            "sizeLimitModalStyles";

        style.textContent = `
            .size-limit-backdrop {
                position: fixed;
                inset: 0;
                background: rgba(15, 15, 25, 0.55);
                backdrop-filter: blur(6px);
                -webkit-backdrop-filter: blur(6px);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 99999;
                opacity: 0;
                transition: opacity 0.25s ease;
                padding: 20px;
            }

            .size-limit-backdrop.show {
                opacity: 1;
            }

            .size-limit-card {
                background: linear-gradient(160deg, #ffffff 0%, #f6f7fb 100%);
                border-radius: 20px;
                width: 100%;
                max-width: 380px;
                padding: 32px 28px 24px;
                text-align: center;
                box-shadow: 0 24px 60px rgba(0, 0, 0, 0.28);
                transform: translateY(18px) scale(0.96);
                opacity: 0;
                transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.25s ease;
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            }

            .size-limit-backdrop.show .size-limit-card {
                transform: translateY(0) scale(1);
                opacity: 1;
            }

            .size-limit-icon {
                width: 68px;
                height: 68px;
                margin: 0 auto 18px;
                border-radius: 50%;
                background: linear-gradient(135deg, #ff5f6d 0%, #ff9966 100%);
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 10px 24px rgba(255, 95, 109, 0.35);
                animation: sizeLimitPop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
            }

            @keyframes sizeLimitPop {
                0% { transform: scale(0.4); opacity: 0; }
                60% { transform: scale(1.08); opacity: 1; }
                100% { transform: scale(1); }
            }

            .size-limit-icon svg {
                width: 32px;
                height: 32px;
                stroke: #fff;
                fill: none;
                stroke-width: 2.4;
                stroke-linecap: round;
                stroke-linejoin: round;
            }

            .size-limit-title {
                font-size: 19px;
                font-weight: 700;
                color: #1a1a2e;
                margin: 0 0 8px;
            }

            .size-limit-message {
                font-size: 14.5px;
                color: #6b6f7d;
                line-height: 1.5;
                margin: 0 0 6px;
            }

            .size-limit-limit-pill {
                display: inline-block;
                margin: 12px 0 22px;
                padding: 6px 16px;
                border-radius: 999px;
                background: #fff1ef;
                color: #ff5f6d;
                font-weight: 700;
                font-size: 13px;
                letter-spacing: 0.3px;
            }

            .size-limit-button {
                width: 100%;
                border: none;
                border-radius: 12px;
                padding: 13px 20px;
                font-size: 15px;
                font-weight: 600;
                color: #fff;
                background: linear-gradient(135deg, #6a5cff 0%, #8a6cff 100%);
                cursor: pointer;
                transition: transform 0.15s ease, box-shadow 0.15s ease;
                box-shadow: 0 8px 20px rgba(106, 92, 255, 0.35);
            }

            .size-limit-button:hover {
                transform: translateY(-1px);
                box-shadow: 0 12px 26px rgba(106, 92, 255, 0.4);
            }

            .size-limit-button:active {
                transform: translateY(0);
            }
        `;

        document.head.appendChild(
            style
        );
    }

    function buildSizeLimitModal() {

        if (sizeLimitModalEl) {
            return sizeLimitModalEl;
        }

        injectSizeLimitModalStyles();

        const backdrop =
            document.createElement("div");

        backdrop.className =
            "size-limit-backdrop";

        backdrop.innerHTML = `
            <div class="size-limit-card" role="alertdialog" aria-modal="true" aria-labelledby="sizeLimitTitle">
                <div class="size-limit-icon">
                    <svg viewBox="0 0 24 24">
                        <path d="M12 9v4"></path>
                        <path d="M12 17h.01"></path>
                        <path d="M10.29 3.86l-8.49 14.7A1 1 0 0 0 2.66 20h18.68a1 1 0 0 0 .86-1.44l-8.49-14.7a1 1 0 0 0-1.72 0z"></path>
                    </svg>
                </div>
                <h3 class="size-limit-title" id="sizeLimitTitle">File size not supported</h3>
                <p class="size-limit-message" id="sizeLimitMessage">This file is too large to upload.</p>
                <span class="size-limit-limit-pill" id="sizeLimitPill">10MB max</span>
                <button type="button" class="size-limit-button" id="sizeLimitOkButton">Got it</button>
            </div>
        `;

        document.body.appendChild(
            backdrop
        );

        backdrop.addEventListener(
            "click",
            function (event) {

                if (event.target === backdrop) {
                    hideSizeLimitModal();
                }
            }
        );

        backdrop.querySelector(
            "#sizeLimitOkButton"
        ).addEventListener(
            "click",
            function () {

                window.location.reload();
            }
        );

        document.addEventListener(
            "keydown",
            function (event) {

                if (
                    event.key === "Escape" &&
                    backdrop.classList.contains("show")
                ) {
                    hideSizeLimitModal();
                }
            }
        );

        sizeLimitModalEl =
            backdrop;

        return backdrop;
    }

    function showSizeLimitModal(fileLabel, maxMb) {

        const modal =
            buildSizeLimitModal();

        modal.querySelector(
            "#sizeLimitMessage"
        ).textContent =
            `Your ${fileLabel} is larger than we can accept. Please choose a smaller file.`;

        modal.querySelector(
            "#sizeLimitPill"
        ).textContent =
            `${maxMb}MB max`;

        modal.classList.add(
            "show"
        );
    }

    function hideSizeLimitModal() {

        if (!sizeLimitModalEl) {
            return;
        }

        sizeLimitModalEl.classList.remove(
            "show"
        );
    }


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
       CREDITS ESTIMATE
    ========================================================= */

    function calculateEstimatedCredits(durationSeconds) {

        if (
            !Number.isFinite(durationSeconds) ||
            durationSeconds <= 0
        ) {
            return 0;
        }

        return Math.ceil(durationSeconds) * CREDITS_PER_SECOND;
    }


    function updateEstimatedCredits() {

        if (!estimatedCreditsLabel) {
            return;
        }

        const credits =
            calculateEstimatedCredits(videoDurationSeconds);

        estimatedCreditsLabel.textContent =
            `${credits} credits`;
    }


    function updateCreditsDisplay(newBalance) {

        if (!Number.isFinite(newBalance)) {
            return;
        }

        const displayValue =
            Number.isInteger(newBalance)
                ? String(newBalance)
                : newBalance.toFixed(2);

        if (topbarCreditsValue) {

            topbarCreditsValue.textContent =
                displayValue;
        }

        if (headerCreditsValue) {

            headerCreditsValue.textContent =
                displayValue;
        }
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

        videoDurationSeconds =
            0;

        updateEstimatedCredits();

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

       NOTE: this used to call sourceVideo.load() again here. That was
       a bug: handleVideo() already sets sourceVideo.src and calls
       load() once to kick off loading, and prepareVideo() runs from
       the "loadedmetadata" handler fired by *that same* load(). Calling
       load() a second time here aborts/resets the in-flight resource
       fetch and restarts the whole pipeline (loadstart -> ... ->
       loadedmetadata again) — but the "loadedmetadata" listener in
       handleVideo() is one-shot (it removes itself after firing), so
       nothing calls handleVideoMetadata() the second time around. The
       element can end up stuck mid-reload, or the preview flashes and
       goes blank instead of settling into "Ready". prepareVideo() now
       only arms the "taking too long" watchdog and waits for the
       existing load to reach canplay/canplaythrough.
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

        /* Intentionally no sourceVideo.load() here — see note above.
           The load already in progress from handleVideo() will fire
           canplay/canplaythrough, which is what marks the video ready. */

        /* If the video is already ready by the time we get here (some
           browsers can reach canplay before this listener runs), catch
           up immediately instead of waiting on an event that already
           fired. */
        if (sourceVideo.readyState >= 3) {
            markVideoReady();
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

        videoDurationSeconds =
            duration;

        updateEstimatedCredits();

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

            showSizeLimitModal(
                "video",
                MAX_VIDEO_SIZE_MB
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

            showSizeLimitModal(
                "reference image",
                MAX_REFERENCE_SIZE_MB
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


        /*
         * NOTE: the preview plays from a local blob URL
         * (URL.createObjectURL), not a network stream. A "waiting" or
         * "stalled" event here just means the decoder needs a brief
         * moment — there is nothing to "recover" from, and forcing a
         * seek back to the same currentTime (the old behavior) actually
         * causes a visible freeze/jump of its own, since seeking makes
         * the browser flush and re-locate a keyframe. So we only reflect
         * this in the status text and let playback resume on its own;
         * we deliberately do NOT touch videoPrepared/generateButton or
         * force a seek.
         */

        sourceVideo.addEventListener(
            "waiting",
            function () {

                if (
                    !selectedVideo ||
                    sourceVideo.paused ||
                    sourceVideo.ended
                ) {
                    return;
                }

                setVideoStatus(
                    "Buffering...",
                    "processing"
                );
            }
        );


        sourceVideo.addEventListener(
            "stalled",
            function () {

                if (
                    !selectedVideo ||
                    sourceVideo.paused ||
                    sourceVideo.ended
                ) {
                    return;
                }

                setVideoStatus(
                    "Buffering...",
                    "processing"
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
       GENERATE STATE HELPERS
    ========================================================= */

    function setGenerateButtonProcessing(isProcessing, loadingLabel) {

        if (!generateButton) {
            return;
        }

        generateButton.dataset.processing =
            isProcessing ? "true" : "false";

        generateButton.disabled =
            isProcessing;

        const normalText =
            generateButton.querySelector(".generate-normal");

        const loadingText =
            generateButton.querySelector(".generate-loading");

        if (normalText) {

            normalText.classList.toggle(
                "d-none",
                isProcessing
            );
        }

        if (loadingText) {

            loadingText.classList.toggle(
                "d-none",
                !isProcessing
            );

            if (isProcessing && loadingLabel) {
                loadingText.textContent = loadingLabel;
            }

            if (!isProcessing) {
                loadingText.textContent = "Preparing...";
            }
        }
    }


    function setProcessingProgress(percent, statusText) {

        const clamped =
            Math.max(0, Math.min(100, percent));

        if (processingProgressBar) {

            processingProgressBar.style.width =
                `${clamped}%`;
        }

        if (processingPercentage) {

            processingPercentage.textContent =
                `${clamped}%`;
        }

        if (processingStatus && statusText) {

            processingStatus.textContent =
                statusText;
        }
    }


    function finishGenerateError(message) {

        console.error(
            "%c[Face Studio] GENERATE ERROR:",
            "color: red; font-weight: bold;",
            message
        );

        activePollToken++;

        setProcessingProgress(
            0,
            message
        );

        showToast(
            message,
            "error"
        );

        setGenerateButtonProcessing(false);

        updateGenerateButton();
    }


    /* =========================================================
       GENERATE — SUBMIT JOB, THEN POLL FOR RESULT
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
                    "Video duration (s):",
                    videoDurationSeconds
                );

                console.log(
                    "Estimated credits:",
                    calculateEstimatedCredits(videoDurationSeconds)
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
                    "Status endpoint:",
                    STATUS_ENDPOINT
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


                setGenerateButtonProcessing(
                    true,
                    "Uploading..."
                );


                if (processingPanel) {

                    processingPanel.classList.remove(
                        "d-none"
                    );

                    processingPanel.classList.add(
                        "active",
                        "visible"
                    );
                }


                if (resultPanel) {

                    resultPanel.classList.add(
                        "d-none"
                    );

                    resultPanel.classList.remove(
                        "active",
                        "visible",
                        "show"
                    );
                }


                if (resultVideo) {

                    resultVideo.pause();

                    resultVideo.removeAttribute(
                        "src"
                    );

                    try {
                        resultVideo.load();
                    } catch (error) {
                        console.warn(
                            "Unable to clear previous result video:",
                            error
                        );
                    }
                }


                setProcessingProgress(
                    0,
                    "Preparing upload..."
                );


                /* Invalidate any poll loop from a previous run. */
                const pollToken =
                    ++activePollToken;

                /* Retries the submission itself (not just polling) if
                   the browser can't reach transform.php at all — a
                   true network-level failure, distinct from Decart
                   rejecting the request with a normal error reply. */
                let submitAttempt = 1;
                const MAX_CLIENT_SUBMIT_ATTEMPTS = 4;


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


                formData.append(
                    "duration",
                    videoDurationSeconds
                );


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
                    "duration:",
                    formData.get("duration")
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
                   XHR — SUBMIT ONLY (short-lived request)
                ================================================= */
                /*
                 * This request now only uploads the files and gets a
                 * job_id back — it does NOT wait for Decart to finish.
                 * The old code kept ONE XHR open for the entire job
                 * (potentially 10+ minutes of polling and downloading
                 * inside transform.php), which meant it got killed by
                 * the web server / reverse proxy long before PHP could
                 * respond. That killed connection surfaced here as
                 * xhr.onerror -> "Could not connect to the AIStudio
                 * server", even though nothing was actually wrong with
                 * connectivity. Splitting submit + poll keeps every
                 * single request short.
                 */

                function sendTransformRequest() {

                    console.log(
                        "%c[Face Studio] Creating XMLHttpRequest...",
                        "color: orange; font-weight: bold;",
                        `(attempt ${submitAttempt}/${MAX_CLIENT_SUBMIT_ATTEMPTS})`
                    );


                const xhr =
                    new XMLHttpRequest();


                xhr.open(
                    "POST",
                    TRANSFORM_ENDPOINT,
                    true
                );


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


                xhr.onreadystatechange =
                    function () {

                        console.log(
                            "[Face Studio] XHR readyState:",
                            xhr.readyState,
                            "status:",
                            xhr.status
                        );

                    };


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

                        setProcessingProgress(
                            percent,
                            `Uploading files... ${percent}%`
                        );

                        setGenerateButtonProcessing(
                            true,
                            `Uploading ${percent}%`
                        );
                    };


                xhr.upload.onload =
                    function () {

                        console.log(
                            "%c[Face Studio] UPLOAD COMPLETE",
                            "color: green; font-weight: bold;"
                        );

                        setProcessingProgress(
                            45,
                            "Lucy AI is processing your video..."
                        );

                        setGenerateButtonProcessing(
                            true,
                            "Processing..."
                        );
                    };


                /* =================================================
                   SUBMISSION RESPONSE — job_id, then start polling
                ================================================= */

                xhr.onload =
                    function () {

                        console.group(
                            "%c[Face Studio] PHP RESPONSE RECEIVED (submit)",
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

                            if (
                                xhr.status === 402 &&
                                data &&
                                typeof data.credits_balance !== "undefined"
                            ) {

                                updateCreditsDisplay(
                                    Number(data.credits_balance)
                                );
                            }


                            finishGenerateError(
                                (data && data.message) ||
                                `Server returned HTTP ${xhr.status}.`
                            );

                            return;
                        }


                        if (!data.success || !data.job_id) {

                            console.error(
                                "[Face Studio] PHP rejected request:",
                                data
                            );


                            finishGenerateError(
                                (data && data.message) ||
                                "The server rejected the transformation request."
                            );

                            return;
                        }


                        console.log(
                            "%c[Face Studio] JOB SUBMITTED, POLLING FOR RESULT",
                            "color: green; font-weight: bold;",
                            data
                        );


                        pollJobStatus(
                            data.job_id,
                            45,
                            pollToken
                        );
                    };


                function retryOrFailSubmission(failureMessage) {

                    if (submitAttempt < MAX_CLIENT_SUBMIT_ATTEMPTS) {

                        submitAttempt++;

                        console.warn(
                            `[Face Studio] Submission failed, retrying (attempt ${submitAttempt}/${MAX_CLIENT_SUBMIT_ATTEMPTS})...`,
                            failureMessage
                        );

                        setProcessingProgress(
                            0,
                            `Connection dropped, retrying (${submitAttempt}/${MAX_CLIENT_SUBMIT_ATTEMPTS})...`
                        );

                        setGenerateButtonProcessing(
                            true,
                            `Retrying ${submitAttempt}/${MAX_CLIENT_SUBMIT_ATTEMPTS}...`
                        );

                        setTimeout(
                            sendTransformRequest,
                            1500 * submitAttempt
                        );

                        return;
                    }

                    finishGenerateError(failureMessage);
                }


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


                        retryOrFailSubmission(
                            "Could not connect to the AIStudio server."
                        );
                    };


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


                xhr.ontimeout =
                    function (event) {

                        console.error(
                            "[Face Studio] XHR timeout:",
                            event
                        );


                        retryOrFailSubmission(
                            "The server took too long to respond."
                        );
                    };


                /*
                 * This now only bounds the upload/submission — a
                 * generous but finite value, since submission should
                 * always be fast. It is NOT bounding the whole job
                 * anymore, so 0 (unbounded) is no longer needed here.
                 */
                xhr.timeout =
                    120000;


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

                } /* end sendTransformRequest */

                sendTransformRequest();
            }
        );
    }


    /* =========================================================
       POLL JOB STATUS — repeatedly called until completed/failed
    ========================================================= */

    function pollJobStatus(jobId, progress, pollToken) {

        /* A newer generate click (or "New Transformation") has
           happened since this poll loop started — stop silently. */
        if (pollToken !== activePollToken) {
            return;
        }

        const pollXhr =
            new XMLHttpRequest();

        pollXhr.open(
            "GET",
            `${STATUS_ENDPOINT}?job_id=${encodeURIComponent(jobId)}`,
            true
        );

        pollXhr.withCredentials =
            true;

        pollXhr.setRequestHeader(
            "Accept",
            "application/json"
        );

        pollXhr.timeout =
            30000;

        pollXhr.onload =
            function () {

                if (pollToken !== activePollToken) {
                    return;
                }

                console.log(
                    "[Face Studio] Status poll response:",
                    pollXhr.status,
                    pollXhr.responseText
                );

                let data = null;

                try {

                    data =
                        JSON.parse(
                            pollXhr.responseText
                        );

                } catch (error) {

                    finishGenerateError(
                        "The server returned an invalid status response."
                    );

                    return;
                }

                if (
                    pollXhr.status < 200 ||
                    pollXhr.status >= 300 ||
                    !data.success
                ) {

                    finishGenerateError(
                        (data && data.message) ||
                        "The transformation failed."
                    );

                    return;
                }

                if (data.status === "processing") {

                    const nextProgress =
                        Math.min(progress + 3, 90);

                    setProcessingProgress(
                        nextProgress,
                        "Lucy AI is processing your video..."
                    );

                    setTimeout(
                        function () {

                            pollJobStatus(
                                jobId,
                                nextProgress,
                                pollToken
                            );

                        },
                        STATUS_POLL_INTERVAL_MS
                    );

                    return;
                }

                if (data.status === "completed") {

                    handleTransformationComplete(data);

                    return;
                }

                /* Unexpected status value — treat as an error rather
                   than polling forever. */
                finishGenerateError(
                    "The transformation returned an unexpected status."
                );
            };

        pollXhr.onerror =
            function () {

                if (pollToken !== activePollToken) {
                    return;
                }

                console.error(
                    "[Face Studio] Status poll network error for job:",
                    jobId
                );

                finishGenerateError(
                    "Lost connection while checking the transformation status."
                );
            };

        pollXhr.ontimeout =
            function () {

                if (pollToken !== activePollToken) {
                    return;
                }

                console.warn(
                    "[Face Studio] Status poll timed out, retrying:",
                    jobId
                );

                /* A single slow poll isn't fatal — try again rather
                   than failing the whole transformation. */
                setTimeout(
                    function () {

                        pollJobStatus(
                            jobId,
                            progress,
                            pollToken
                        );

                    },
                    STATUS_POLL_INTERVAL_MS
                );
            };

        pollXhr.send();
    }


    /* =========================================================
       TRANSFORMATION COMPLETE
    ========================================================= */

    function handleTransformationComplete(data) {

        const resultUrl =
            data.result_url ||
            data.download_url ||
            "";

        console.log(
            "[Face Studio] Result URL:",
            resultUrl
        );

        if (!resultUrl) {

            finishGenerateError(
                "The AI transformation completed, but no result video was returned."
            );

            return;
        }

        if (
            typeof data.credits_balance !== "undefined" &&
            data.credits_balance !== null
        ) {

            updateCreditsDisplay(
                Number(data.credits_balance)
            );
        }

        setProcessingProgress(
            100,
            "Transformation complete."
        );

        setGenerateButtonProcessing(
            true,
            "Completed"
        );

        if (!resultVideo) {

            finishGenerateError(
                "The transformation completed, but the result video player was not found."
            );

            return;
        }

        resultVideo.pause();

        resultVideo.src =
            resultUrl;

        resultVideo.preload =
            "metadata";

        try {

            resultVideo.load();

        } catch (error) {

            console.warn(
                "[Face Studio] Unable to load result video:",
                error
            );
        }

        if (processingPanel) {

            processingPanel.classList.add(
                "d-none"
            );

            processingPanel.classList.remove(
                "active",
                "visible",
                "show"
            );
        }

        if (resultPanel) {

            resultPanel.classList.remove(
                "d-none"
            );

            resultPanel.classList.add(
                "active",
                "visible"
            );
        }

        /* Stays disabled/processing-looking until "New Transformation"
           is clicked, matching the previous end state. */
        generateButton.disabled =
            true;

        generateButton.dataset.processing =
            "false";

        const normalText =
            generateButton.querySelector(".generate-normal");

        const loadingText =
            generateButton.querySelector(".generate-loading");

        if (normalText) {
            normalText.classList.remove("d-none");
        }

        if (loadingText) {
            loadingText.classList.add("d-none");
            loadingText.textContent = "Preparing...";
        }

        showToast(
            typeof data.credits_charged !== "undefined"
                ? `Face transformation completed successfully. ${data.credits_charged} credits used.`
                : "Face transformation completed successfully.",
            "success"
        );

        console.log(
            "%c[Face Studio] RESULT VIDEO READY",
            "color: green; font-weight: bold;"
        );

        console.log(
            "[Face Studio] Result URL:",
            resultUrl
        );

        console.log(
            "[Face Studio] Result filename:",
            data.result_filename
        );

        console.log(
            "[Face Studio] Decart job ID:",
            data.job_id
        );

        console.log(
            "[Face Studio] Credits charged:",
            data.credits_charged
        );

        console.log(
            "[Face Studio] New credits balance:",
            data.credits_balance
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


                console.log(
                    "[Face Studio] Downloading result:",
                    resultVideo.src
                );


                const link =
                    document.createElement("a");


                link.href =
                    resultVideo.src;


                link.download =
                    "aistudio-face-transformation.mp4";


                link.target =
                    "_blank";


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

                /* Invalidate any in-flight poll loop. */
                activePollToken++;

                clearTemporaryVideoData();

                clearTemporaryReferenceData();


                if (processingPanel) {

                    processingPanel.classList.add(
                        "d-none"
                    );

                    processingPanel.classList.remove(
                        "active",
                        "visible",
                        "show"
                    );
                }


                if (resultPanel) {

                    resultPanel.classList.add(
                        "d-none"
                    );

                    resultPanel.classList.remove(
                        "active",
                        "visible",
                        "show"
                    );
                }


                if (resultVideo) {

                    resultVideo.pause();

                    resultVideo.removeAttribute(
                        "src"
                    );

                    try {

                        resultVideo.load();

                    } catch (error) {

                        console.warn(
                            "Unable to clear result video:",
                            error
                        );
                    }
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

    if (resultPanel) {

        resultPanel.classList.add(
            "d-none"
        );

        resultPanel.classList.remove(
            "active",
            "visible",
            "show"
        );
    }

    if (processingPanel) {

        processingPanel.classList.add(
            "d-none"
        );

        processingPanel.classList.remove(
            "active",
            "visible",
            "show"
        );
    }

    if (resultVideo) {

        resultVideo.removeAttribute(
            "src"
        );

        try {
            resultVideo.load();
        } catch (error) {
            console.warn(
                "Unable to initialize result video:",
                error
            );
        }
    }

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

                    videoDurationSeconds:
                        videoDurationSeconds,

                    estimatedCredits:
                        calculateEstimatedCredits(videoDurationSeconds),

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

                console.log(
                    "Status endpoint:",
                    STATUS_ENDPOINT
                );

                return {
                    transform: TRANSFORM_ENDPOINT,
                    status: STATUS_ENDPOINT
                };
            }
    };


    console.log(
        "%c[Face Studio] Debug system ready.",
        "color: green; font-weight: bold;"
    );

});
