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
 * Credits balance only.
 * PHP outputs: 0, 12, 50, etc.
 * The word "credits" is NOT included here.
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
        content="Transform faces with AI face transformation in AIStudio."
    >

    <title>Face Studio — AIStudio</title>

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
        href="css/studio.css"
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
    <aside class="sidebar">

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
                    class="sidebar-link active"
                >
                    <i class="bi bi-person-bounding-box"></i>
                    <span>Face Studio</span>
                </a>

                <a
                    href="voice-studio.php"
                    class="sidebar-link"
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


        <!-- UPGRADE -->
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


        <!-- SIDEBAR USER -->
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
                    Face Studio
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


        <!-- FACE STUDIO -->
        <main class="studio-main">

            <div class="dashboard-container">


                <!-- STUDIO HEADER -->
                <section class="studio-header">

                    <div class="studio-header-content">

                        <div class="studio-eyebrow">
                            AI CREATOR TOOL
                        </div>

                        <h1>
                            Face Studio
                        </h1>

                        <p>
                            Transform the face in your video using AI. Upload your source video and a reference face to create a new result.
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


                <!-- FACE WORKSPACE -->
                <div class="studio-workspace">


                    <!-- STEP 01 SOURCE VIDEO -->
                    <section class="studio-panel">

                        <div class="panel-header">

                            <div>

                                <div class="panel-kicker">
                                    STEP 01
                                </div>

                                <h2>
                                    Source Video
                                </h2>

                            </div>

                            <div class="panel-status">
                                Required
                            </div>

                        </div>


                        <div
                            class="video-upload-area"
                            id="videoUploadArea"
                        >

                            <input
                                type="file"
                                id="videoInput"
                                accept="video/mp4,video/quicktime,video/webm"
                                hidden
                            >


                            <div class="upload-icon">

                                <i class="bi bi-camera-video"></i>

                            </div>


                            <h3>
                                Upload your video
                            </h3>


                            <p>
                                Choose the video you want to transform.
                            </p>


                            <button
                                type="button"
                                class="studio-primary-btn"
                                id="selectVideoButton"
                            >
                                Choose Video
                            </button>


                            <small>
                                MP4, MOV, WEBM · Max 10MB
                            </small>

                        </div>


                        <!-- VIDEO PREVIEW -->
                        <div
                            class="video-preview-container d-none"
                            id="videoPreviewContainer"
                        >

                            <video
                                id="sourceVideo"
                                controls
                                playsinline
                                preload="metadata"
                            ></video>


                            <div class="file-information">

                                <div>

                                    <strong id="videoFileName">
                                        video.mp4
                                    </strong>

                                    <span id="videoFileSize">
                                        0 MB
                                    </span>

                                </div>


                                <div class="file-actions">

                                    <button
                                        type="button"
                                        class="studio-secondary-btn"
                                        id="replaceVideoButton"
                                    >
                                        Replace
                                    </button>


                                    <button
                                        type="button"
                                        class="studio-danger-btn"
                                        id="removeVideoButton"
                                    >
                                        Remove
                                    </button>

                                </div>

                            </div>

                        </div>

                    </section>


                    <!-- STEP 02 REFERENCE FACE -->
                    <section class="studio-panel">

                        <div class="panel-header">

                            <div>

                                <div class="panel-kicker">
                                    STEP 02
                                </div>

                                <h2>
                                    Reference Face
                                </h2>

                            </div>

                            <div class="panel-status">
                                Required
                            </div>

                        </div>


                        <div
                            class="reference-upload-area"
                            id="referenceUploadArea"
                        >

                            <input
                                type="file"
                                id="referenceInput"
                                accept="image/jpeg,image/png,image/webp"
                                hidden
                            >


                            <div
                                class="reference-placeholder"
                                id="referencePlaceholder"
                            >

                                <div class="reference-icon">

                                    <i class="bi bi-person-square"></i>

                                </div>


                                <h3>
                                    Upload a reference face
                                </h3>


                                <p>
                                    Use a clear image containing the face you want to use.
                                </p>


                                <button
                                    type="button"
                                    class="studio-primary-btn"
                                    id="selectReferenceButton"
                                >
                                    Choose Image
                                </button>


                                <small>
                                    JPG, PNG, WEBP · Clear face recommended
                                </small>

                            </div>


                            <!-- REFERENCE PREVIEW -->
                            <div
                                class="reference-preview d-none"
                                id="referencePreview"
                            >

                                <img
                                    id="referenceImage"
                                    src=""
                                    alt="Reference face preview"
                                >

                            </div>


                            <div
                                class="reference-file-row d-none"
                                id="referenceFileRow"
                            >

                                <div>

                                    <strong id="referenceFileName">
                                        reference.jpg
                                    </strong>

                                    <span id="referenceFileSize">
                                        0 MB
                                    </span>

                                </div>


                                <div class="file-actions">

                                    <button
                                        type="button"
                                        class="studio-secondary-btn"
                                        id="replaceReferenceButton"
                                    >
                                        Replace
                                    </button>


                                    <button
                                        type="button"
                                        class="studio-danger-btn"
                                        id="removeReferenceButton"
                                    >
                                        Remove
                                    </button>

                                </div>

                            </div>

                        </div>

                    </section>


                    <!-- STEP 03 SETTINGS -->
                    <section class="studio-panel">

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
                                AI Mode
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

                                    <option value="ultra">
                                        Ultra Quality
                                    </option>

                                </select>

                            </div>

                        </div>


                        <div class="processing-mode-card">

                            <i class="bi bi-stars"></i>

                            <div>

                                <strong>
                                    AI Face Transformation
                                </strong>

                                <span>
                                    AIStudio will transform the source face using your reference.
                                </span>

                            </div>

                        </div>


                        <div class="usage-estimate">

                            <div>

                                <strong>
                                    Estimated usage
                                </strong>

                                <span>
                                    Credits required for this transformation
                                </span>

                            </div>


                            <strong id="estimatedCredits">
                                0 credits
                            </strong>

                        </div>


                        <div class="security-note">

                            <i class="bi bi-shield-check"></i>

                            <span>
                                Your files are securely processed
                            </span>

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
                                Upload your source video and reference face to continue.
                            </p>

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
                                Generate Transformation
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

                                <h2>
                                    Transforming your video
                                </h2>

                            </div>


                            <strong id="processingPercentage">
                                0%
                            </strong>

                        </div>


                        <div class="progress">

                            <div
                                class="progress-bar"
                                id="processingProgressBar"
                                role="progressbar"
                                style="width: 0%"
                            ></div>

                        </div>


                        <div id="processingStatus">
                            Preparing your video...
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
                                    Transformation completed successfully
                                </h2>

                            </div>


                            <div class="panel-status success">
                                Complete
                            </div>

                        </div>


                        <video
                            id="resultVideo"
                            controls
                            playsinline
                        ></video>


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
                                Need help with Face Studio?
                            </strong>

                            <p>
                                Use a clear source video and a high-quality reference face for the best results.
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
        id="studioToast"
    >

        <span id="dashboardToastMessage">
            Ready.
        </span>

    </div>


    <script
        src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"
    ></script>

    <script src="js/dashboard.js"></script>

    <script src="js/face.js"></script>

</body>

</html>