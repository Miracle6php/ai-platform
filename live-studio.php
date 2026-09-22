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


/* =========================================================
   LOAD USER DATA
   ========================================================= */

require_once __DIR__ . '/backend/config/database.php';

$userId = (int) $_SESSION['user_id'];

$userName = $_SESSION['user_name'] ?? 'Creator';
$userEmail = $_SESSION['user_email'] ?? '';

$userCredits = 0.0;

$stmt = $conn->prepare(
    "SELECT credits_balance
     FROM users
     WHERE id = ?
     LIMIT 1"
);

if ($stmt) {

    $stmt->bind_param('i', $userId);

    $stmt->execute();

    $result = $stmt->get_result();

    if ($row = $result->fetch_assoc()) {
        $userCredits = (float) $row['credits_balance'];
    }

    $stmt->close();
}

$conn->close();

$userInitial = strtoupper(substr(trim($userName), 0, 1));
if ($userInitial === '') {
    $userInitial = 'C';
}

$safeUserName = htmlspecialchars($userName, ENT_QUOTES, 'UTF-8');
$safeUserEmail = htmlspecialchars($userEmail, ENT_QUOTES, 'UTF-8');
$safeUserCredits = htmlspecialchars((string) $userCredits, ENT_QUOTES, 'UTF-8');

?><!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Live Studio — AIStudio</title>
<meta name="description" content="Transform your face and voice in real time with AIStudio Live Studio.">
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="css/dashboard.css">
<link rel="stylesheet" href="css/live.css">
</head><body
    class="dashboard-page studio-page"
    data-user-id="<?php echo $userId; ?>"
    data-user-name="<?php echo $safeUserName; ?>"
    data-user-email="<?php echo $safeUserEmail; ?>"
    data-user-credits="<?php echo $safeUserCredits; ?>"
>

<div class="dashboard-layout">

<aside class="sidebar">
    <div class="sidebar-brand">
        <a class="brand-link" href="dashboard.php">
            <span class="brand-icon"><i class="bi bi-stars"></i></span>
            <span class="brand-text">AIStudio</span>
        </a>
    </div>

    <nav class="sidebar-nav">
        <div class="nav-section">
            <span class="nav-section-title">Workspace</span>
            <a href="dashboard.php" class="sidebar-link"><i class="bi bi-grid-1x2-fill"></i><span>Dashboard</span></a>
            <a href="face-studio.php" class="sidebar-link"><i class="bi bi-person-bounding-box"></i><span>Face Studio</span></a>
            <a href="voice-studio.php" class="sidebar-link"><i class="bi bi-mic-fill"></i><span>Voice Studio</span></a>
            <a href="live-studio.php" class="sidebar-link active" aria-current="page"><i class="bi bi-broadcast-pin"></i><span>Live Studio</span></a>
        </div>
        <div class="nav-section">
            <span class="nav-section-title">Manage</span>
            <a href="dashboard.php#projects" class="sidebar-link" data-scroll-target="projects"><i class="bi bi-folder2-open"></i><span>Projects</span></a>
            <a href="dashboard.php#analytics" class="sidebar-link" data-scroll-target="analytics"><i class="bi bi-bar-chart-line"></i><span>Analytics</span></a>
            <a href="dashboard.php#credits" class="sidebar-link" data-scroll-target="credits"><i class="bi bi-coin"></i><span>Credits</span></a>
            <a href="dashboard.php#settings" class="sidebar-link" data-scroll-target="settings"><i class="bi bi-gear"></i><span>Settings</span></a>
        </div>
    </nav>

    <div class="sidebar-upgrade">
        <div class="upgrade-icon"><i class="bi bi-stars"></i></div>
        <h6>Unlock more AI</h6>
        <p>Get more credits and unlock powerful creator tools.</p>
        <a href="dashboard.php#credits" class="upgrade-link">Upgrade</a>
    </div>

    <div class="sidebar-user">
        <div class="sidebar-user-avatar"><?php echo $userInitial; ?></div>
        <div class="sidebar-user-info">
            <strong><?php echo $safeUserName; ?></strong>
            <span><?php echo $safeUserEmail; ?></span>
        </div>
        <a href="backend/auth/logout.php" class="sidebar-logout" aria-label="Sign out"><i class="bi bi-box-arrow-right"></i></a>
    </div>
</aside>

<main class="main-content">

    <header class="topbar">
        <div class="topbar-left">
            <button type="button" class="mobile-menu-button" id="mobileMenuButton" aria-label="Open menu"><i class="bi bi-list"></i></button>
            <div class="topbar-page-title"><span>Live Studio</span></div>
        </div>
        <div class="topbar-actions">
            <div class="system-status"><span class="status-dot"></span><span>All systems operational</span></div>
            <button type="button" class="topbar-icon-button" id="notificationButton" aria-label="Notifications"><i class="bi bi-bell"></i><span class="notification-dot"></span></button>
            <a href="dashboard.php#credits" class="credits-pill">
                <i class="bi bi-coin"></i>
                <span id="topbarCredits"><?php echo number_format($userCredits, 0); ?></span>
                <span>credits</span>
            </a>
            <a href="backend/auth/logout.php" class="topbar-signout">Sign Out</a>
        </div>
    </header>

    <div class="dashboard-container">

        <section class="studio-page-header">
            <div>
                <span class="studio-eyebrow"><span></span>REAL-TIME AI TRANSFORMATION</span>
                <h1>Live Studio</h1>
                <p>Transform your face and voice in real time while streaming directly from your browser.</p>
            </div>
            <div class="studio-header-actions">
                <div class="studio-credit-badge">
                    <i class="bi bi-coin"></i>
                    <strong id="headerCredits"><?php echo number_format($userCredits, 0); ?></strong>
                    credits
                </div>
            </div>
        </section>

        <section class="live-preview-workspace">

            <div class="studio-panel live-preview-panel">
                <div class="live-preview-header">
                    <div class="live-preview-title">
                        <div class="live-preview-title-icon"><i class="bi bi-camera-video-fill"></i></div>
                        <div><strong>Your Camera</strong><span>Live camera input</span></div>
                    </div>
                    <span class="preview-status" id="cameraStatus"><span class="preview-status-dot"></span>Camera off</span>
                </div>
                <div class="live-video-stage">
                    <video id="cameraPreview" autoplay muted playsinline></video>
                    <div class="live-video-placeholder" id="cameraPlaceholder">
                        <div class="live-video-placeholder-icon"><i class="bi bi-camera-video"></i></div>
                        <strong>Camera preview</strong>
                        <span>Allow camera access to see your live video here.</span>
                    </div>
                    <div class="live-video-badge" id="cameraLiveBadge">CAMERA</div>
                </div>
                <div class="live-preview-controls">
                    <div class="preview-control-group">
                        <button type="button" class="preview-control-button" id="cameraToggleButton"><i class="bi bi-camera-video"></i>Camera</button>
                        <button type="button" class="preview-control-button" id="cameraSettingsButton"><i class="bi bi-sliders"></i>Settings</button>
                    </div>
                    <div class="live-output-info"><span><strong>Input</strong></span></div>
                </div>
            </div>

            <div class="studio-panel live-preview-panel ai-panel">
                <div class="live-preview-header">
                    <div class="live-preview-title">
                        <div class="live-preview-title-icon"><i class="bi bi-stars"></i></div>
                        <div><strong>AI Transformation</strong><span>Real-time AI output</span></div>
                    </div>
                    <span class="preview-status" id="aiStatus"><span class="preview-status-dot"></span>Waiting</span>
                </div>
                <div class="live-video-stage">
                    <video id="aiOutputPreview" autoplay playsinline></video>
                    <div class="live-video-placeholder" id="aiOutputPlaceholder">
                        <div class="live-video-placeholder-icon"><i class="bi bi-stars"></i></div>
                        <strong>AI output</strong>
                        <span>Start a live session to see your transformed video.</span>
                    </div>
                    <div class="ai-processing-overlay d-none" id="aiProcessingOverlay">
                        <div class="ai-processing-card">
                            <div class="ai-processing-spinner"></div>
                            <strong>AI processing</strong>
                            <span id="aiProcessingText">Connecting to transformation service...</span>
                        </div>
                    </div>
                    <div class="live-video-badge" id="aiLiveBadge">AI OUTPUT</div>
                </div>
                <div class="live-preview-controls">
                    <div class="live-output-info">
                        <div class="live-output-latency"><i class="bi bi-circle-fill"></i><span id="outputConnectionText">Waiting for live session</span></div>
                    </div>
                    <div class="live-output-info"><span>Latency<strong id="outputLatency">—</strong></span></div>
                </div>
            </div>

        </section>

        <section class="studio-panel transformation-panel">
            <div class="panel-header">
                <div class="panel-title-area">
                    <span class="panel-step">01</span>
                    <div><h2>Transformation Mode</h2><p>Choose what you want to transform during your live session.</p></div>
                </div>
                <span class="panel-status ready"><span></span>Real-time</span>
            </div>
            <div class="live-mode-grid">
                <button type="button" class="live-mode-card active" data-mode="face" id="faceModeButton">
                    <div class="live-mode-icon"><i class="bi bi-person-bounding-box"></i></div>
                    <strong>Face</strong><p>Transform your face in real time.</p>
                    <span class="live-mode-check"><i class="bi bi-check-lg"></i></span>
                </button>
                <button type="button" class="live-mode-card" data-mode="voice" id="voiceModeButton">
                    <div class="live-mode-icon"><i class="bi bi-mic-fill"></i></div>
                    <strong>Voice</strong><p>Transform your voice in real time.</p>
                    <span class="live-mode-check"><i class="bi bi-check-lg"></i></span>
                </button>
                <button type="button" class="live-mode-card" data-mode="face-voice" id="faceVoiceModeButton">
                    <div class="live-mode-icon"><i class="bi bi-stars"></i></div>
                    <strong>Face + Voice</strong><p>Transform your face and voice together.</p>
                    <span class="live-mode-check"><i class="bi bi-check-lg"></i></span>
                </button>
            </div>
        </section>

        <section class="live-reference-grid">

            <div class="studio-panel live-reference-panel" id="faceReferencePanel">
                <div class="panel-header">
                    <div class="panel-title-area">
                        <span class="panel-step">02</span>
                        <div><h2>Face Reference</h2><p>Upload the target face for real-time transformation.</p></div>
                    </div>
                    <span class="panel-status" id="faceReferenceStatus"><span></span>Required</span>
                </div>
                <div class="live-reference-upload" id="faceReferenceUpload">
                    <input type="file" id="liveFaceInput" accept="image/jpeg,image/png,image/webp" hidden>
                    <div class="live-reference-upload-icon"><i class="bi bi-person-bounding-box"></i></div>
                    <strong>Upload target face</strong>
                    <span>Use a clear front-facing image for best results.</span>
                    <button type="button" class="btn studio-secondary-btn" id="selectLiveFaceButton"><i class="bi bi-upload"></i>Upload Face</button>
                    <small>JPG, PNG or WebP · Maximum 10 MB</small>
                </div>
                <div class="selected-reference d-none" id="selectedFaceReference">
                    <div class="selected-reference-icon"><i class="bi bi-person-check-fill"></i></div>
                    <div class="selected-reference-info">
                        <strong id="liveFaceFileName">face.png</strong>
                        <span id="liveFaceFileMeta">Reference ready</span>
                    </div>
                    <div class="reference-actions">
                        <button type="button" class="reference-action-button" id="replaceLiveFaceButton" aria-label="Replace face reference"><i class="bi bi-arrow-repeat"></i></button>
                        <button type="button" class="reference-action-button" id="removeLiveFaceButton" aria-label="Remove face reference"><i class="bi bi-trash3"></i></button>
                    </div>
                </div>
            </div>

            <div class="studio-panel live-reference-panel" id="voiceReferencePanel">
                <div class="panel-header">
                    <div class="panel-title-area">
                        <span class="panel-step">03</span>
                        <div><h2>Voice Reference</h2><p>Upload the target voice for real-time transformation.</p></div>
                    </div>
                    <span class="panel-status" id="voiceReferenceStatus"><span></span>Required</span>
                </div>
                <div class="live-reference-upload" id="voiceReferenceUpload">
                    <input type="file" id="liveVoiceInput" accept="audio/mpeg" hidden>
                    <div class="live-reference-upload-icon"><i class="bi bi-mic-fill"></i></div>
                    <strong>Upload target voice</strong>
                    <span>Use a clean voice recording for better transformation.</span>
                    <button type="button" class="btn studio-secondary-btn" id="selectLiveVoiceButton"><i class="bi bi-upload"></i>Upload Voice</button>
                    <small>MP3 · Maximum 5 MB</small>
                </div>
                <div class="selected-reference d-none" id="selectedVoiceReference">
                    <div class="selected-reference-icon"><i class="bi bi-mic-fill"></i></div>
                    <div class="selected-reference-info">
                        <strong id="liveVoiceFileName">voice.mp3</strong>
                        <span id="liveVoiceFileMeta">Reference ready</span>
                    </div>
                    <div class="reference-actions">
                        <button type="button" class="reference-action-button" id="replaceLiveVoiceButton" aria-label="Replace voice reference"><i class="bi bi-arrow-repeat"></i></button>
                        <button type="button" class="reference-action-button" id="removeLiveVoiceButton" aria-label="Remove voice reference"><i class="bi bi-trash3"></i></button>
                    </div>
                </div>
            </div>

        </section>

        <section class="studio-panel live-settings-panel">
            <div class="panel-header">
                <div class="panel-title-area">
                    <span class="panel-step">04</span>
                    <div><h2>Live Settings</h2><p>Configure the quality and monitor your real-time credit usage.</p></div>
                </div>
                <span class="panel-status ready"><span></span>Secure session</span>
            </div>
            <div class="live-settings-content">
                <div class="setting-block">
                    <label for="liveQualitySelect">Transformation quality</label>
                    <select id="liveQualitySelect" class="form-select studio-select">
                        <option value="standard">Standard</option>
                        <option value="high">High quality</option>
                        <option value="premium">Premium</option>
                    </select>
                </div>
                <div class="setting-block">
                    <label>Processing mode</label>
                    <div class="mode-card active">
                        <div class="mode-icon"><i class="bi bi-broadcast"></i></div>
                        <div><strong>Real-Time AI</strong><span>Process your selected transformation continuously during the live session.</span></div>
                        <i class="bi bi-check-circle-fill mode-check"></i>
                    </div>
                </div>
                <div class="live-usage-card">
                    <div class="live-usage-header">
                        <div class="usage-estimate-icon"><i class="bi bi-lightning-charge-fill"></i></div>
                        <div><span>Estimated usage</span><strong id="liveUsageRate">0 credits / min</strong></div>
                    </div>
                    <div class="live-usage-stats">
                        <div class="live-usage-stat"><span>Session time</span><strong id="liveSessionTime">00:00</strong></div>
                        <div class="live-usage-stat"><span>Credits used</span><strong id="liveCreditsUsed">0.0</strong></div>
                        <div class="live-usage-stat"><span>Remaining</span><strong id="liveCreditsRemaining"><?php echo number_format($userCredits, 0); ?></strong></div>
                    </div>
                    <p id="liveUsageEstimateText">Start a live session to begin tracking real-time credit usage.</p>
                </div>
            </div>
        </section>

        <section class="live-device-status">
            <div class="device-status-card">
                <span class="device-status-indicator" id="cameraDeviceStatus"></span>
                <div class="device-status-info"><strong>Camera</strong><span id="cameraDeviceText">Not connected</span></div>
            </div>
            <div class="device-status-card">
                <span class="device-status-indicator" id="microphoneDeviceStatus"></span>
                <div class="device-status-info"><strong>Microphone</strong><span id="microphoneDeviceText">Not connected</span></div>
            </div>
            <div class="device-status-card">
                <span class="device-status-indicator" id="aiServiceStatus"></span>
                <div class="device-status-info"><strong>AI Service</strong><span id="aiServiceText">Waiting</span></div>
            </div>
        </section>

        <section class="live-action-area">
            <div class="live-security-text">
                <i class="bi bi-shield-check"></i>
                <span>Your camera and microphone stay active only during your live session.</span>
            </div>
            <button type="button" class="btn live-button" id="liveButton" disabled>
                <span class="live-button-normal" id="liveButtonNormal"><i class="bi bi-broadcast-pin"></i>Go Live</span>
                <span class="live-button-loading d-none" id="liveButtonLoading"><span class="spinner-border spinner-border-sm" aria-hidden="true"></span>Connecting...</span>
                <span class="live-button-stop d-none" id="liveButtonStop"><i class="bi bi-stop-circle-fill"></i>Stop Live</span>
            </button>
        </section>

        <section class="live-session-panel d-none" id="liveSessionPanel">
            <div class="live-session-header">
                <div class="live-session-title">
                    <div>
                        <span class="studio-eyebrow"><span></span>LIVE SESSION</span>
                        <strong>You are live</strong>
                        <span id="liveSessionMessage">Your AI transformation is running in real time.</span>
                    </div>
                </div>
                <div class="live-session-indicator"><span></span>LIVE</div>
            </div>
            <div class="live-session-stats">
                <div class="live-session-stat"><span>Session time</span><strong id="sessionTimer">00:00</strong></div>
                <div class="live-session-stat"><span>Credits used</span><strong id="sessionCredits">0.0</strong></div>
                <div class="live-session-stat"><span>Processing</span><strong id="sessionMode">Face</strong></div>
                <div class="live-session-stat"><span>Connection</span><strong id="liveConnectionLatency">—</strong></div>
            </div>
        </section>

        <section class="studio-panel streaming-panel">
            <div class="panel-header">
                <div class="panel-title-area">
                    <span class="panel-step">05</span>
                    <div><h2>Streaming</h2><p>Send your transformed output to your preferred streaming setup.</p></div>
                </div>
                <span class="panel-status">Available after setup</span>
            </div>
            <div class="streaming-options">
                <div class="streaming-option">
                    <div class="streaming-option-icon"><i class="bi bi-broadcast-pin"></i></div>
                    <div class="streaming-option-info"><strong>Browser Streaming</strong><span>Use the transformed output directly for your live broadcast.</span></div>
                    <button type="button" class="streaming-option-button" id="browserStreamButton">Configure</button>
                </div>
                <div class="streaming-option">
                    <div class="streaming-option-icon"><i class="bi bi-display"></i></div>
                    <div class="streaming-option-info"><strong>OBS Studio</strong><span>Connect AIStudio to OBS using your streaming output.</span></div>
                    <button type="button" class="streaming-option-button" id="obsButton">Configure</button>
                </div>
            </div>
        </section>

        <section class="studio-help">
            <div class="studio-help-icon"><i class="bi bi-info-circle"></i></div>
            <div>
                <strong>Before you go live</strong>
                <p>Allow camera and microphone access, choose your transformation mode, upload the required reference files, then start your live session.</p>
            </div>
        </section>

        <footer class="dashboard-footer">
            <span>© <?php echo date('Y'); ?> AIStudio. All rights reserved.</span>
            <div><a href="#">Privacy</a><a href="#">Terms</a><a href="#">Help</a></div>
        </footer>

    </div>

</main>

</div>

<div class="sidebar-overlay" id="sidebarOverlay"></div>

<div class="studio-toast" id="studioToast" role="alert" aria-live="polite">
    <i class="bi bi-info-circle-fill"></i>
    <span id="studioToastMessage"></span>
</div>

<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>

<script src="js/dashboard.js"></script>

<!--
    UPDATED: this now loads the built bundle (js/live.bundle.js), not the
    raw source file. The old tag pointed at js/live-part2.js directly,
    which the browser cannot resolve on its own (it imports
    "@decartai/sdk" as a bare specifier, which only esbuild can bundle).
    The old <script type="importmap"> block that tried to patch some of
    the SDK's sub-dependencies has been removed since the bundle no
    longer needs it -- esbuild already inlines everything.

    Rebuild after any change to live-part1.js / live-part2.js /
    live-diagnostics.js with:

        npx esbuild js/live-part2.js --bundle --format=esm --minify=false --outfile=js/live.bundle.js
        cp node_modules/@decartai/sdk/dist/realtime/browser/frame-metadata-worker.js js/frame-metadata-worker.js
-->
<script type="module" src="js/live.bundle.js"></script>

<script>
document.addEventListener("DOMContentLoaded", function () {
    const menuButton = document.getElementById("mobileMenuButton");
    const sidebar = document.querySelector(".sidebar");
    const overlay = document.getElementById("sidebarOverlay");

    function openSidebar() {
        if (sidebar) sidebar.classList.add("mobile-open");
        if (overlay) overlay.classList.add("active");
        document.body.classList.add("sidebar-open");
    }

    function closeSidebar() {
        if (sidebar) sidebar.classList.remove("mobile-open");
        if (overlay) overlay.classList.remove("active");
        document.body.classList.remove("sidebar-open");
    }

    if (menuButton) menuButton.addEventListener("click", openSidebar);
    if (overlay) overlay.addEventListener("click", closeSidebar);

    document.querySelectorAll(".sidebar-link").forEach(function (link) {
        link.addEventListener("click", closeSidebar);
    });

    window.addEventListener("resize", function () {
        if (window.innerWidth >= 992) closeSidebar();
    });
});
</script>

</body>
</html>
