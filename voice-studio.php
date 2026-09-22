<?php

session_start();

if (
    !isset($_SESSION['logged_in']) ||
    $_SESSION['logged_in'] !== true ||
    !isset($_SESSION['user_id'])
) {
    header('Location: login.php');
    exit;
}

require_once __DIR__ . '/backend/config/database.php';

$libraryVoices = require __DIR__ . '/backend/voice/library-voices-config.php';

$userId = (int) $_SESSION['user_id'];

$stmt = $conn->prepare("
    SELECT id, name, email, credits_balance, status
    FROM users
    WHERE id = ?
    LIMIT 1
");

$stmt->bind_param("i", $userId);
$stmt->execute();

$result = $stmt->get_result();
$user = $result->fetch_assoc();

$stmt->close();

if (!$user || ($user['status'] ?? '') !== 'active') {
    $conn->close();
    session_destroy();
    header('Location: login.php');
    exit;
}

$conn->close();

$userName = $user['name'] ?? 'Creator';
$userEmail = $user['email'] ?? '';

$userCredits = isset($user['credits_balance'])
    ? (float) $user['credits_balance']
    : 0;

$safeUserName = htmlspecialchars(
    $userName,
    ENT_QUOTES,
    'UTF-8'
);

$safeUserEmail = htmlspecialchars(
    $userEmail,
    ENT_QUOTES,
    'UTF-8'
);

/*
 * IMPORTANT:
 * Only the numeric balance is stored here.
 * Example: 0, 12, 50
 * The word "credits" is NOT included.
 */
$safeCredits = (int) $userCredits;

?>

<!DOCTYPE html>
<html lang="en">

<head>

    <meta charset="UTF-8">

    <meta
        name="viewport"
        content="width=device-width, initial-scale=1.0"
    >

    <meta
        name="description"
        content="Transform voices with AI voice transformation in AIStudio."
    >

    <title>Voice Studio — AIStudio</title>

    <link
        href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css"
        rel="stylesheet"
    >

    <link
        href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css"
        rel="stylesheet"
    >

    <link
        href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
        rel="stylesheet"
    >

    <link
        rel="stylesheet"
        href="css/dashboard.css"
    >

    <link
        rel="stylesheet"
        href="css/voice.css"
    >

</head>

<body
    class="dashboard-page studio-page"
    data-user-id="<?php echo (int) $_SESSION['user_id']; ?>"
    data-user-name="<?php echo $safeUserName; ?>"
    data-user-email="<?php echo $safeUserEmail; ?>"
    data-user-credits="<?php echo $safeCredits; ?>"
>

    <!-- SIDEBAR OVERLAY -->
    <div
        class="sidebar-overlay"
        id="sidebarOverlay"
    ></div>


    <!-- SIDEBAR -->
    <aside class="sidebar" id="sidebar">

        <div class="sidebar-brand">

            <a
                href="dashboard.php"
                class="brand-link"
            >

                <span class="brand-icon">
                    <i class="bi bi-stars"></i>
                </span>

                <span class="brand-text">
                    AIStudio
                </span>

            </a>

        </div>


        <nav class="sidebar-nav">

            <div class="nav-section">

                <div class="nav-section-title">
                    WORKSPACE
                </div>

                <a
                    href="dashboard.php"
                    class="sidebar-link"
                >
                    <i class="bi bi-grid"></i>
                    <span>Dashboard</span>
                </a>

                <a
                    href="face-studio.php"
                    class="sidebar-link"
                >
                    <i class="bi bi-person-bounding-box"></i>
                    <span>Face Studio</span>
                </a>

                <a
                    href="voice-studio.php"
                    class="sidebar-link active"
                >
                    <i class="bi bi-mic"></i>
                    <span>Voice Studio</span>
                </a>

                <a
                    href="live-studio.php"
                    class="sidebar-link"
                >
                    <i class="bi bi-broadcast"></i>
                    <span>Live Studio</span>
                </a>

            </div>


            <div class="nav-section">

                <div class="nav-section-title">
                    MANAGE
                </div>

                <a
                    href="dashboard.php#projects"
                    class="sidebar-link"
                >
                    <i class="bi bi-folder2"></i>
                    <span>Projects</span>
                </a>

                <a
                    href="dashboard.php#analytics"
                    class="sidebar-link"
                >
                    <i class="bi bi-bar-chart"></i>
                    <span>Analytics</span>
                </a>

                <a
                    href="dashboard.php#credits"
                    class="sidebar-link"
                >
                    <i class="bi bi-coin"></i>
                    <span>Credits</span>
                </a>

                <a
                    href="dashboard.php#settings"
                    class="sidebar-link"
                >
                    <i class="bi bi-gear"></i>
                    <span>Settings</span>
                </a>

            </div>

        </nav>


        <div class="sidebar-upgrade">

            <div class="upgrade-icon">
                <i class="bi bi-stars"></i>
            </div>

            <div>
                <strong>Upgrade your plan</strong>
                <span>Get more AI credits</span>
            </div>

            <a
                href="dashboard.php#credits"
                class="upgrade-link"
            >
                Upgrade
            </a>

        </div>


        <div class="sidebar-user">

            <div class="sidebar-user-avatar">
                <i class="bi bi-person"></i>
            </div>

            <div class="sidebar-user-info">

                <strong>
                    <?php echo $safeUserName; ?>
                </strong>

                <span>
                    Creator
                </span>

            </div>

            <button
                type="button"
                class="sidebar-logout"
                id="sidebarLogoutButton"
                title="Sign out"
            >
                <i class="bi bi-box-arrow-right"></i>
            </button>

        </div>

    </aside>


    <!-- MAIN CONTENT -->
    <div class="main-content">

        <!-- TOPBAR -->
        <header class="topbar">

            <div class="topbar-left">

                <button
                    type="button"
                    class="mobile-menu-button"
                    id="mobileMenuButton"
                    aria-label="Open menu"
                >
                    <i class="bi bi-list"></i>
                </button>

                <div class="topbar-page-title">
                    Voice Studio
                </div>

            </div>


            <div class="topbar-actions">

                <div class="system-status">
                    <span class="status-dot"></span>
                    Systems operational
                </div>


                <button
                    type="button"
                    class="topbar-icon-button"
                    id="notificationButton"
                    aria-label="Notifications"
                >
                    <i class="bi bi-bell"></i>
                    <span class="notification-dot"></span>
                </button>


                <!-- CREDITS -->
                <a
                    href="dashboard.php#credits"
                    class="credits-pill"
                    id="topbarCredits"
                >

                    <i class="bi bi-coin"></i>

                    <span>
                        <?php echo $safeCredits; ?>
                    </span>

                    <span class="credits-label">
                        credits
                    </span>

                </a>


                <button
                    type="button"
                    class="topbar-signout"
                    id="topbarSignout"
                >
                    <i class="bi bi-box-arrow-right"></i>
                </button>

            </div>

        </header>


        <!-- VOICE STUDIO -->
        <main class="studio-main">

            <div class="dashboard-container">

                <!-- STUDIO HEADER -->
                <section class="studio-header">

                    <div class="studio-header-content">

                        <div class="studio-eyebrow">
                            AI VOICE TRANSFORMATION
                        </div>

                        <h1>
                            Voice Studio
                        </h1>

                        <p>
                            Transform your voice with AI. Upload your audio, choose a voice, and create a new voice experience.
                        </p>

                    </div>


                    <!-- HEADER CREDITS -->
                    <div class="studio-header-credits">

                        <i class="bi bi-coin"></i>

                        <span id="headerCredits">
                            <?php echo $safeCredits; ?>
                        </span>

                        credits

                    </div>

                </section>


                <!-- VOICE WORKSPACE -->
                <div class="voice-workspace">


                    <!-- STEP 01 -->
                    <section class="studio-panel audio-panel">

                        <div class="panel-header">

                            <div>

                                <div class="panel-kicker">
                                    STEP 01
                                </div>

                                <h2>
                                    Source Audio
                                </h2>

                            </div>

                            <div
                                class="panel-status"
                                id="audioStatus"
                            >
                                Waiting
                            </div>

                        </div>


                        <!-- AUDIO UPLOAD -->
                        <div
                            class="audio-upload-area"
                            id="audioUploadArea"
                        >

                            <input
                                type="file"
                                id="audioInput"
                                accept="audio/mpeg"
                                hidden
                            >

                            <div class="upload-icon">
                                <i class="bi bi-mic"></i>
                            </div>

                            <h3>
                                Upload your voice
                            </h3>

                            <p>
                                Select an MP3 recording to transform with AI.
                            </p>

                            <button
                                type="button"
                                class="studio-primary-btn"
                                id="selectAudioButton"
                            >
                                Choose Audio
                            </button>

                            <small>
                                MP3 · Maximum 5 MB
                            </small>

                        </div>


                        <!-- AUDIO PREVIEW -->
                        <div
                            class="audio-preview-container d-none"
                            id="audioPreviewContainer"
                        >

                            <div class="audio-player-card">

                                <div class="audio-player-icon">
                                    <i class="bi bi-music-note-beamed"></i>
                                </div>

                                <div class="audio-player-content">

                                    <strong>
                                        Source Voice
                                    </strong>

                                    <span id="audioFileMeta">
                                        Audio file
                                    </span>

                                </div>

                            </div>


                            <audio
                                id="sourceAudio"
                                controls
                                playsinline
                                preload="auto"
                            ></audio>


                            <div class="file-information">

                                <div>

                                    <strong id="audioFileName">
                                        audio.mp3
                                    </strong>

                                    <span id="audioFileDetails">
                                        0 MB
                                    </span>

                                </div>

                                <div class="file-actions">

                                    <button
                                        type="button"
                                        class="studio-secondary-btn"
                                        id="replaceAudioButton"
                                    >
                                        Replace
                                    </button>

                                    <button
                                        type="button"
                                        class="studio-danger-btn"
                                        id="removeAudioButton"
                                    >
                                        Remove
                                    </button>

                                </div>

                            </div>

                        </div>

                    </section>


                    <!-- STEP 02 -->
                    <section class="studio-panel voice-model-panel">

                        <div class="panel-header">

                            <div>

                                <div class="panel-kicker">
                                    STEP 02
                                </div>

                                <h2>
                                    Voice Model
                                </h2>

                            </div>

                            <div
                                class="panel-status"
                                id="voiceStatus"
                            >
                                Waiting
                            </div>

                        </div>


                        <!-- VOICE OPTIONS -->
                        <div class="voice-model-options">

                            <button
                                type="button"
                                class="voice-option active"
                                id="libraryVoiceButton"
                                data-voice-mode="library"
                            >

                                <i class="bi bi-collection-play"></i>

                                <span>
                                    <strong>Voice Library</strong>
                                    <small>
                                        Choose an available AI voice
                                    </small>
                                </span>

                            </button>


                            <button
                                type="button"
                                class="voice-option"
                                id="cloneVoiceButton"
                                data-voice-mode="clone"
                            >

                                <i class="bi bi-person-lines-fill"></i>

                                <span>
                                    <strong>Voice Clone</strong>
                                    <small>
                                        Use an authorized voice sample
                                    </small>
                                </span>

                            </button>

                        </div>


                        <!-- VOICE LIBRARY -->
                        <div
                            class="voice-library"
                            id="voiceLibrary"
                        >

                            <div class="voice-library-header">

                                <div>

                                    <strong>
                                        Select a voice
                                    </strong>

                                    <span>
                                        Choose the voice you want to use.
                                    </span>

                                </div>

                                <div class="voice-count">
                                    <?php echo count($libraryVoices); ?> voices
                                </div>

                            </div>


                            <div
                                class="voice-grid"
                                id="voiceGrid"
                            >

                                <?php foreach ($libraryVoices as $voiceId => $voice): ?>

                                <button
                                    type="button"
                                    class="voice-card<?php echo $voiceId === 'voice-01' ? ' active' : ''; ?>"
                                    data-voice-id="<?php echo htmlspecialchars($voiceId, ENT_QUOTES, 'UTF-8'); ?>"
                                    data-preview-url="<?php echo htmlspecialchars($voice['preview_url'], ENT_QUOTES, 'UTF-8'); ?>"
                                >

                                    <span class="voice-card-avatar">
                                        <?php echo htmlspecialchars($voice['avatar_letter'], ENT_QUOTES, 'UTF-8'); ?>
                                    </span>

                                    <span class="voice-card-info">
                                        <strong><?php echo htmlspecialchars($voice['name'], ENT_QUOTES, 'UTF-8'); ?></strong>
                                        <small><?php echo htmlspecialchars($voice['label'], ENT_QUOTES, 'UTF-8'); ?></small>
                                    </span>

                                    <span class="voice-card-play" data-state="idle">
                                        <i class="bi bi-play-fill"></i>
                                    </span>

                                </button>

                                <?php endforeach; ?>

                            </div>

                        </div>


                        <!-- VOICE CLONE -->
                        <div
                            class="voice-clone-area d-none"
                            id="voiceCloneArea"
                        >

                            <input
                                type="file"
                                id="voiceCloneInput"
                                accept="audio/mpeg"
                                hidden
                            >

                            <div class="clone-upload-content">

                                <div class="reference-icon">
                                    <i class="bi bi-person-badge"></i>
                                </div>

                                <h3>
                                    Upload a voice sample
                                </h3>

                                <p>
                                    Upload a clean voice recording you are authorized to use.
                                </p>

                                <button
                                    type="button"
                                    class="studio-secondary-btn"
                                    id="selectVoiceCloneButton"
                                >
                                    Choose Voice Sample
                                </button>

                                <small>
                                    MP3 · Maximum 5 MB
                                </small>

                            </div>


                            <!-- CLONE PREVIEW -->
                            <div
                                class="clone-preview d-none"
                                id="voiceClonePreview"
                            >

                                <div class="clone-audio-icon">
                                    <i class="bi bi-mic-fill"></i>
                                </div>

                                <div class="clone-audio-info">

                                    <strong id="cloneFileName">
                                        voice-sample.mp3
                                    </strong>

                                    <span id="cloneFileMeta">
                                        0 MB · 0:00
                                    </span>

                                </div>

                                <audio
                                    id="cloneAudio"
                                    controls
                                    playsinline
                                    preload="auto"
                                ></audio>

                            </div>


                            <div
                                class="reference-file-row d-none"
                                id="cloneFileRow"
                            >

                                <div>

                                    <strong id="cloneFileRowName">
                                        voice-sample.mp3
                                    </strong>

                                    <span id="cloneFileRowMeta">
                                        0 MB
                                    </span>

                                </div>

                                <div class="file-actions">

                                    <button
                                        type="button"
                                        class="studio-secondary-btn"
                                        id="replaceVoiceCloneButton"
                                    >
                                        Replace
                                    </button>

                                    <button
                                        type="button"
                                        class="studio-danger-btn"
                                        id="removeVoiceCloneButton"
                                    >
                                        Remove
                                    </button>

                                </div>

                            </div>

                        </div>

                    </section>


                    <!-- STEP 03 -->
                    <section class="studio-panel settings-panel">

                        <div class="panel-header">

                            <div>

                                <div class="panel-kicker">
                                    STEP 03
                                </div>

                                <h2>
                                    Transformation Settings
                                </h2>

                            </div>

                            <div class="panel-status">
                                Ready
                            </div>

                        </div>


                        <div class="settings-grid">

                            <div class="setting-group">

                                <label for="qualitySelect">
                                    Output Quality
                                </label>

                                <select
                                    id="qualitySelect"
                                    class="form-select"
                                >

                                    <option value="standard">
                                        Standard
                                    </option>

                                    <option value="high">
                                        High Quality
                                    </option>

                                    <option value="premium">
                                        Premium
                                    </option>

                                </select>

                            </div>


                            <div class="setting-group">

                                <label for="pitchSelect">
                                    Pitch
                                </label>

                                <select
                                    id="pitchSelect"
                                    class="form-select"
                                >

                                    <option value="natural">
                                        Natural
                                    </option>

                                    <option value="lower">
                                        Lower
                                    </option>

                                    <option value="higher">
                                        Higher
                                    </option>

                                </select>

                            </div>


                            <div class="setting-group">

                                <label for="stabilitySelect">
                                    Stability
                                </label>

                                <select
                                    id="stabilitySelect"
                                    class="form-select"
                                >

                                    <option value="balanced">
                                        Balanced
                                    </option>

                                    <option value="stable">
                                        More Stable
                                    </option>

                                    <option value="expressive">
                                        More Expressive
                                    </option>

                                </select>

                            </div>

                        </div>


                        <div class="processing-mode-card">

                            <i class="bi bi-stars"></i>

                            <div>

                                <strong>
                                    AI Voice Transformation
                                </strong>

                                <span>
                                    Optimized for natural results
                                </span>

                            </div>

                        </div>


                        <div class="usage-estimate">

                            <div>

                                <strong>
                                    Estimated usage
                                </strong>

                                <span id="usageEstimateText">
                                    Upload audio to calculate usage.
                                </span>

                            </div>

                            <strong id="estimatedCredits">
                                0 credits
                            </strong>

                        </div>

                    </section>


                    <!-- VALIDATION -->
                    <section
                        class="validation-panel"
                        id="validationPanel"
                    >

                        <div>

                            <strong id="validationTitle">
                                Ready to validate
                            </strong>

                            <p id="validationMessage">
                                Upload your source audio and select a voice to continue.
                            </p>

                        </div>


                        <div class="validation-checks">

                            <div id="checkAudio">
                                <i class="bi bi-circle"></i>
                                Source audio
                            </div>

                            <div id="checkVoice">
                                <i class="bi bi-circle"></i>
                                Voice model
                            </div>

                            <div id="checkReady">
                                <i class="bi bi-circle"></i>
                                Ready
                            </div>

                        </div>

                    </section>


                    <!-- GENERATE -->
                    <section class="studio-action-area">

                        <button
                            type="button"
                            class="studio-primary-btn generate-button"
                            id="generateButton"
                            disabled
                        >

                            <span class="generate-normal">
                                Transform Voice
                            </span>

                            <span class="generate-loading d-none">
                                Preparing...
                            </span>

                        </button>

                        <p>
                            Your credits will only be used when processing begins.
                        </p>

                    </section>


                    <!-- PROCESSING -->
                    <section
                        class="studio-panel processing-panel d-none"
                        id="processingPanel"
                    >

                        <div class="processing-header">

                            <div>

                                <div class="panel-kicker">
                                    PROCESSING
                                </div>

                                <h2 id="processingTitle">
                                    Transforming your voice
                                </h2>

                                <p id="processingMessage">
                                    Preparing your audio for AI processing...
                                </p>

                            </div>

                            <strong id="processingPercentage">
                                0%
                            </strong>

                        </div>


                        <div class="progress">

                            <div
                                class="progress-bar"
                                id="processingProgress"
                                role="progressbar"
                                style="width: 0%"
                            ></div>

                        </div>


                        <div id="processingStatus">
                            Waiting for processing...
                        </div>

                    </section>


                    <!-- RESULT -->
                    <section
                        class="studio-panel result-panel d-none"
                        id="resultPanel"
                    >

                        <div class="result-header">

                            <div>

                                <div class="panel-kicker">
                                    RESULT
                                </div>

                                <h2>
                                    Your transformed voice
                                </h2>

                                <p>
                                    Your AI voice transformation is ready to preview.
                                </p>

                            </div>

                            <div class="panel-status success">
                                Complete
                            </div>

                        </div>


                        <div class="result-audio-card">

                            <div>

                                <strong>
                                    AIStudio Voice Result
                                </strong>

                                <span>
                                    AI transformed audio
                                </span>

                            </div>

                            <audio
                                id="resultAudio"
                                controls
                                playsinline
                            ></audio>

                        </div>


                        <div class="result-actions">

                            <button
                                type="button"
                                class="studio-primary-btn"
                                id="downloadResultButton"
                            >
                                <i class="bi bi-download"></i>
                                Download
                            </button>

                            <button
                                type="button"
                                class="studio-secondary-btn"
                                id="saveProjectButton"
                            >
                                <i class="bi bi-folder-plus"></i>
                                Save to Projects
                            </button>

                            <button
                                type="button"
                                class="studio-secondary-btn"
                                id="newTransformationButton"
                            >
                                New Transformation
                            </button>

                        </div>

                    </section>


                    <!-- HELP -->
                    <section class="studio-help">

                        <div class="help-icon">
                            <i class="bi bi-question-circle"></i>
                        </div>

                        <div>

                            <strong>
                                Need help with Voice Studio?
                            </strong>

                            <p>
                                For the best results, use a clear MP3 recording with minimal background noise.
                            </p>

                        </div>

                    </section>

                </div>

            </div>

        </main>


        <!-- FOOTER -->
        <footer class="dashboard-footer">

            <span>
                © <?php echo date('Y'); ?> AIStudio
            </span>

            <span>
                AI Creator Platform
            </span>

        </footer>

    </div>


    <!-- TOAST -->
    <div
        class="dashboard-toast"
        id="dashboardToast"
    >

        <span id="dashboardToastMessage">
            Ready.
        </span>

    </div>


    <script
        src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"
    ></script>

    <script src="js/dashboard.js"></script>

    <script src="js/voice.js"></script>

</body>

</html>
