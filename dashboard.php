<?php

session_start();

/*
|--------------------------------------------------------------------------
| AIStudio — Protected User Dashboard
|--------------------------------------------------------------------------
| The dashboard is tied to the exact user ID stored in the session.
| No user ID is taken from the URL.
|--------------------------------------------------------------------------
*/


/*
|--------------------------------------------------------------------------
| Prevent browser caching
|--------------------------------------------------------------------------
*/

header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Cache-Control: post-check=0, pre-check=0', false);
header('Pragma: no-cache');
header('Expires: 0');


/*
|--------------------------------------------------------------------------
| Check login session
|--------------------------------------------------------------------------
*/

if (
    !isset($_SESSION['logged_in']) ||
    $_SESSION['logged_in'] !== true ||
    !isset($_SESSION['user_id'])
) {
    header('Location: login.php');
    exit;
}


/*
|--------------------------------------------------------------------------
| Database connection
|--------------------------------------------------------------------------
*/

require_once __DIR__ . '/backend/config/database.php';


/*
|--------------------------------------------------------------------------
| Get the exact logged-in user's ID
|--------------------------------------------------------------------------
*/

$userId = (int) $_SESSION['user_id'];

if ($userId <= 0) {
    session_unset();
    session_destroy();

    header('Location: login.php');
    exit;
}


/*
|--------------------------------------------------------------------------
| Get the specific user from the database
|--------------------------------------------------------------------------
*/

$stmt = $conn->prepare(
    "SELECT
        id,
        name,
        email,
        credits_balance,
        status
     FROM users
     WHERE id = ?
     LIMIT 1"
);


/*
|--------------------------------------------------------------------------
| Database query failed
|--------------------------------------------------------------------------
*/

if (!$stmt) {

    $conn->close();

    session_unset();
    session_destroy();

    header('Location: login.php?error=database');
    exit;
}


/*
|--------------------------------------------------------------------------
| Bind the logged-in user's ID
|--------------------------------------------------------------------------
*/

$stmt->bind_param('i', $userId);

$stmt->execute();

$result = $stmt->get_result();


/*
|--------------------------------------------------------------------------
| User no longer exists
|--------------------------------------------------------------------------
*/

if ($result->num_rows === 0) {

    $stmt->close();
    $conn->close();

    session_unset();
    session_destroy();

    header('Location: login.php?error=invalid');
    exit;
}


/*
|--------------------------------------------------------------------------
| Get exact user record
|--------------------------------------------------------------------------
*/

$user = $result->fetch_assoc();

$stmt->close();


/*
|--------------------------------------------------------------------------
| Check account status
|--------------------------------------------------------------------------
*/

if ($user['status'] !== 'active') {

    $conn->close();

    session_unset();
    session_destroy();

    header('Location: login.php?error=inactive');
    exit;
}


/*
|--------------------------------------------------------------------------
| Close database connection
|--------------------------------------------------------------------------
*/

$conn->close();


/*
|--------------------------------------------------------------------------
| Prepare safe display values
|--------------------------------------------------------------------------
*/

$fullName = trim($user['name']);

$nameParts = preg_split('/\s+/', $fullName);

$firstName = $nameParts[0] ?? 'Creator';

if ($firstName === '') {
    $firstName = 'Creator';
}

$userName = htmlspecialchars(
    $fullName,
    ENT_QUOTES,
    'UTF-8'
);

$userFirstName = htmlspecialchars(
    $firstName,
    ENT_QUOTES,
    'UTF-8'
);

$userEmail = htmlspecialchars(
    $user['email'],
    ENT_QUOTES,
    'UTF-8'
);


/*
|--------------------------------------------------------------------------
| Credits
|--------------------------------------------------------------------------
*/

$userCredits = (float) $user['credits_balance'];

$userCreditsDisplay = number_format(
    $userCredits,
    2
);


/*
|--------------------------------------------------------------------------
| User initial
|--------------------------------------------------------------------------
*/

$userInitial = strtoupper(
    substr($firstName, 0, 1)
);

if ($userInitial === '') {
    $userInitial = 'C';
}


/*
|--------------------------------------------------------------------------
| Current account status
|--------------------------------------------------------------------------
*/

$userStatus = htmlspecialchars(
    $user['status'],
    ENT_QUOTES,
    'UTF-8'
);


/*
|--------------------------------------------------------------------------
| Payment result (returning from Paystack via verify-payment.php)
|--------------------------------------------------------------------------
*/

$paymentStatus = null;
$paymentMessage = null;

if (isset($_GET['payment'])) {

    if ($_GET['payment'] === 'success') {
        $paymentStatus = 'success';
        $paymentMessage = 'Payment successful! Your credits have been added.';
    } elseif ($_GET['payment'] === 'failed') {
        $paymentStatus = 'failed';
        $paymentMessage = 'Payment could not be completed. Please try again.';
    }
}

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
        content="AIStudio creator dashboard."
    >

    <title>Dashboard — AIStudio</title>


    <!-- Bootstrap -->
    <link
        href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css"
        rel="stylesheet"
    >

    <!-- Bootstrap Icons -->
    <link
        href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css"
        rel="stylesheet"
    >

    <!-- Google Font -->
    <link
        rel="preconnect"
        href="https://fonts.googleapis.com"
    >

    <link
        rel="preconnect"
        href="https://fonts.gstatic.com"
        crossorigin
    >

    <link
        href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
        rel="stylesheet"
    >

    <!-- Dashboard CSS -->
    <link
        rel="stylesheet"
        href="css/dashboard.css"
    >

</head>


<body
    data-user-name="<?php echo $userName; ?>"
    data-user-email="<?php echo $userEmail; ?>"
    data-user-credits="<?php echo $userCredits; ?>"
    <?php if ($paymentStatus): ?>
    data-payment-status="<?php echo htmlspecialchars($paymentStatus, ENT_QUOTES, 'UTF-8'); ?>"
    data-payment-message="<?php echo htmlspecialchars($paymentMessage, ENT_QUOTES, 'UTF-8'); ?>"
    <?php endif; ?>
>


<!-- =========================================================
     AIStudio Dashboard
========================================================= -->

<div class="dashboard-layout">


    <!-- =====================================================
         SIDEBAR
    ====================================================== -->

    <aside class="sidebar">


        <!-- Brand -->

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


        <!-- Navigation -->

        <nav class="sidebar-nav">


            <div class="nav-section">

                <span class="nav-section-title">
                    Workspace
                </span>


                <a
                    href="dashboard.php"
                    class="sidebar-link active"
                >

                    <i class="bi bi-grid-1x2-fill"></i>

                    <span>
                        Dashboard
                    </span>

                </a>


                <a
                    href="face-studio.php"
                    class="sidebar-link"
                >

                    <i class="bi bi-person-bounding-box"></i>

                    <span>
                        Face Studio
                    </span>

                </a>


                <a
                    href="voice-studio.php"
                    class="sidebar-link"
                >

                    <i class="bi bi-mic-fill"></i>

                    <span>
                        Voice Studio
                    </span>

                </a>


                <a
                    href="live-studio.php"
                    class="sidebar-link"
                >

                    <i class="bi bi-broadcast-pin"></i>

                    <span>
                        Live Studio
                    </span>

                </a>

            </div>


            <div class="nav-section">

                <span class="nav-section-title">
                    Manage
                </span>


                <a
                    href="#projects"
                    class="sidebar-link"
                >

                    <i class="bi bi-folder2-open"></i>

                    <span>
                        Projects
                    </span>

                </a>


                <a
                    href="#analytics"
                    class="sidebar-link"
                >

                    <i class="bi bi-bar-chart-line"></i>

                    <span>
                        Analytics
                    </span>

                </a>


                <a
                    href="#credits"
                    class="sidebar-link"
                >

                    <i class="bi bi-coin"></i>

                    <span>
                        Credits
                    </span>

                </a>


                <a
                    href="#settings"
                    class="sidebar-link"
                >

                    <i class="bi bi-gear"></i>

                    <span>
                        Settings
                    </span>

                </a>

            </div>

        </nav>


        <!-- Sidebar Upgrade -->

        <div class="sidebar-upgrade">

            <div class="upgrade-icon">
                <i class="bi bi-stars"></i>
            </div>

            <h6>
                Unlock more AI
            </h6>

            <p>
                Get more credits and unlock
                powerful creator tools.
            </p>

            <a
                href="buy-credits.php"
                class="upgrade-link"
            >
                Upgrade
                <i class="bi bi-arrow-right"></i>
            </a>

        </div>


        <!-- Sidebar User -->

        <div class="sidebar-user">

            <div class="sidebar-user-avatar">
                <?php echo $userInitial; ?>
            </div>


            <div class="sidebar-user-info">

                <strong>
                    <?php echo $userName; ?>
                </strong>

                <span>
                    <?php echo $userEmail; ?>
                </span>

            </div>


            <a
                href="backend/auth/logout.php"
                class="sidebar-logout"
                aria-label="Sign out"
                title="Sign out"
            >

                <i class="bi bi-box-arrow-right"></i>

            </a>

        </div>

    </aside>



    <!-- =====================================================
         MAIN CONTENT
    ====================================================== -->

    <main class="main-content">


        <!-- =================================================
             TOPBAR
        ================================================== -->

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

                    <span>
                        Dashboard
                    </span>

                </div>

            </div>


            <div class="topbar-actions">


                <!-- System status -->

                <div class="system-status">

                    <span class="status-dot"></span>

                    <span>
                        All systems operational
                    </span>

                </div>


                <!-- Notifications -->

                <button
                    type="button"
                    class="topbar-icon-button"
                    id="notificationButton"
                    aria-label="Notifications"
                    title="Notifications"
                >

                    <i class="bi bi-bell"></i>

                    <span class="notification-dot"></span>

                </button>


                <!-- Credits -->

                <a
                    href="buy-credits.php"
                    class="credits-pill"
                    id="topbarCredits"
                >

                    <i class="bi bi-coin"></i>

                    <span>
                        <?php echo $userCreditsDisplay; ?>
                    </span>

                </a>


                <!-- Sign out -->

                <a
                    href="backend/auth/logout.php"
                    class="topbar-signout"
                    aria-label="Sign out"
                    title="Sign out"
                >
                    Sign Out
                </a>

            </div>

        </header>



        <!-- =================================================
             PAGE BODY
        ================================================== -->

        <div class="dashboard-container">


            <!-- =================================================
                 WELCOME
            ================================================== -->

            <section class="welcome-section">


                <div class="welcome-content">

                    <span class="welcome-label">
                        Creator Dashboard
                    </span>

                    <h1>
                        Welcome back,
                        <span id="welcomeUserName"><?php echo $userFirstName; ?></span>.
                    </h1>

                    <p>
                        Create, transform and go live
                        with your AI-powered creator tools.
                    </p>

                </div>


                <div class="welcome-actions">

                    <a
                        href="face-studio.php"
                        class="btn btn-primary"
                    >

                        <i class="bi bi-plus-lg"></i>

                        New Creation

                    </a>

                </div>

            </section>



            <!-- =================================================
                 ACCOUNT INFO
            ================================================== -->

            <section class="account-summary">


                <div class="account-summary-card">


                    <div class="account-summary-avatar">
                        <?php echo $userInitial; ?>
                    </div>


                    <div class="account-summary-info">

                        <span class="account-summary-label">
                            Signed in as
                        </span>

                        <strong>
                            <?php echo $userName; ?>
                        </strong>

                        <small>
                            <?php echo $userEmail; ?>
                        </small>

                    </div>


                    <div class="account-summary-status">

                        <span class="status-badge">
                            <span class="status-dot"></span>
                            <?php echo ucfirst($userStatus); ?>
                        </span>

                    </div>

                </div>

            </section>



            <!-- =================================================
                 STATS
            ================================================== -->

            <section class="stats-grid">


                <!-- Projects -->

                <div class="stat-card">

                    <div class="stat-card-top">

                        <div class="stat-icon">
                            <i class="bi bi-folder2-open"></i>
                        </div>

                        <span class="stat-label">
                            Projects
                        </span>

                    </div>

                    <div class="stat-value" id="projectsCount">
                        0
                    </div>

                    <div class="stat-description">
                        Total creations
                    </div>

                </div>


                <!-- AI Usage -->

                <div class="stat-card">

                    <div class="stat-card-top">

                        <div class="stat-icon">
                            <i class="bi bi-lightning-charge"></i>
                        </div>

                        <span class="stat-label">
                            AI Usage
                        </span>

                    </div>

                    <div class="stat-value" id="usageMinutes">
                        0
                    </div>

                    <div class="stat-description">
                        Minutes used
                    </div>

                </div>


                <!-- Credits -->

                <div class="stat-card">

                    <div class="stat-card-top">

                        <div class="stat-icon">
                            <i class="bi bi-coin"></i>
                        </div>

                        <span class="stat-label">
                            Credits
                        </span>

                    </div>

                    <div class="stat-value" id="creditsBalance">
                        <?php echo $userCreditsDisplay; ?>
                    </div>

                    <div class="stat-description">
                        Available credits
                    </div>

                </div>


                <!-- Plan -->

                <div class="stat-card">

                    <div class="stat-card-top">

                        <div class="stat-icon">
                            <i class="bi bi-gem"></i>
                        </div>

                        <span class="stat-label">
                            Current Plan
                        </span>

                    </div>

                    <div class="stat-value stat-value-small" id="currentPlan">
                        Free
                    </div>

                    <div class="stat-description">
                        Upgrade anytime
                    </div>

                </div>

            </section>



            <!-- =================================================
                 CREATOR STUDIOS
            ================================================== -->

            <section class="dashboard-section">


                <div class="section-heading">

                    <div>

                        <span class="section-eyebrow">
                            AI TOOLS
                        </span>

                        <h2>
                            Creator Studios
                        </h2>

                    </div>

                    <span class="section-description">
                        Choose a studio to start creating.
                    </span>

                </div>



                <div class="studio-grid">


                    <!-- Face Studio -->

                    <a
                        href="face-studio.php"
                        class="studio-card studio-card-face"
                    >

                        <div class="studio-card-icon">

                            <i class="bi bi-person-bounding-box"></i>

                        </div>


                        <div class="studio-card-content">

                            <span class="studio-card-label">
                                FACE AI
                            </span>

                            <h3>
                                Face Studio
                            </h3>

                            <p>
                                Transform your appearance
                                with real-time AI face effects.
                            </p>

                        </div>


                        <div class="studio-card-arrow">

                            <i class="bi bi-arrow-up-right"></i>

                        </div>

                    </a>



                    <!-- Voice Studio -->

                    <a
                        href="voice-studio.php"
                        class="studio-card studio-card-voice"
                    >

                        <div class="studio-card-icon">

                            <i class="bi bi-mic-fill"></i>

                        </div>


                        <div class="studio-card-content">

                            <span class="studio-card-label">
                                VOICE AI
                            </span>

                            <h3>
                                Voice Studio
                            </h3>

                            <p>
                                Change or transform your voice
                                with AI-powered voice technology.
                            </p>

                        </div>


                        <div class="studio-card-arrow">

                            <i class="bi bi-arrow-up-right"></i>

                        </div>

                    </a>



                    <!-- Live Studio -->

                    <a
                        href="live-studio.php"
                        class="studio-card studio-card-live"
                    >

                        <div class="studio-card-icon">

                            <i class="bi bi-broadcast-pin"></i>

                        </div>


                        <div class="studio-card-content">

                            <span class="studio-card-label">
                                LIVE AI
                            </span>

                            <h3>
                                Live Studio
                            </h3>

                            <p>
                                Create professional live streams
                                directly from your browser.
                            </p>

                        </div>


                        <div class="studio-card-arrow">

                            <i class="bi bi-arrow-up-right"></i>

                        </div>

                    </a>

                </div>

            </section>



            <!-- =================================================
                 QUICK ACTIONS
            ================================================== -->

            <section class="dashboard-section">


                <div class="section-heading">

                    <div>

                        <span class="section-eyebrow">
                            QUICK ACCESS
                        </span>

                        <h2>
                            Start Creating
                        </h2>

                    </div>

                </div>


                <div class="quick-actions-grid">


                    <a
                        href="face-studio.php"
                        class="quick-action"
                    >

                        <span class="quick-action-icon">
                            <i class="bi bi-camera-video"></i>
                        </span>

                        <span class="quick-action-text">

                            <strong>
                                Create with Face AI
                            </strong>

                            <small>
                                Open Face Studio
                            </small>

                        </span>

                        <i class="bi bi-chevron-right"></i>

                    </a>


                    <a
                        href="voice-studio.php"
                        class="quick-action"
                    >

                        <span class="quick-action-icon">
                            <i class="bi bi-soundwave"></i>
                        </span>

                        <span class="quick-action-text">

                            <strong>
                                Transform Your Voice
                            </strong>

                            <small>
                                Open Voice Studio
                            </small>

                        </span>

                        <i class="bi bi-chevron-right"></i>

                    </a>


                    <a
                        href="live-studio.php"
                        class="quick-action"
                    >

                        <span class="quick-action-icon">
                            <i class="bi bi-broadcast"></i>
                        </span>

                        <span class="quick-action-text">

                            <strong>
                                Go Live
                            </strong>

                            <small>
                                Open Live Studio
                            </small>

                        </span>

                        <i class="bi bi-chevron-right"></i>

                    </a>

                </div>

            </section>



            <!-- =================================================
                 PROJECTS
            ================================================== -->

            <section
                class="dashboard-section"
                id="projects"
            >


                <div class="section-heading">

                    <div>

                        <span class="section-eyebrow">
                            WORKSPACE
                        </span>

                        <h2>
                            Recent Projects
                        </h2>

                    </div>

                </div>


                <div class="empty-state" id="emptyProjects">


                    <div class="empty-state-icon">

                        <i class="bi bi-folder-plus"></i>

                    </div>


                    <h3>
                        No projects yet
                    </h3>


                    <p>
                        Your AI creations will appear here
                        when you start a new project.
                    </p>


                    <a
                        href="face-studio.php"
                        class="btn btn-primary"
                    >

                        <i class="bi bi-plus-lg"></i>

                        Create Your First Project

                    </a>

                </div>

                <div id="projectsList"></div>

            </section>



            <!-- =================================================
                 ANALYTICS
            ================================================== -->

            <section
                class="dashboard-section"
                id="analytics"
            >


                <div class="section-heading">

                    <div>

                        <span class="section-eyebrow">
                            OVERVIEW
                        </span>

                        <h2>
                            Analytics
                        </h2>

                    </div>

                    <span class="section-description">
                        Your AI activity overview.
                    </span>

                </div>


                <div class="analytics-card">


                    <div class="analytics-header">

                        <div>

                            <span>
                                AI Usage
                            </span>

                            <strong>
                                0 min
                            </strong>

                        </div>


                        <div class="analytics-period">
                            Last 30 days
                        </div>

                    </div>


                    <div class="analytics-chart">


                        <div class="chart-placeholder">

                            <div class="chart-line"></div>

                            <div class="chart-message">

                                <i class="bi bi-bar-chart"></i>

                                <span>
                                    Analytics will appear
                                    once you start creating.
                                </span>

                            </div>

                        </div>


                        <div class="chart-labels">

                            <span>
                                1
                            </span>

                            <span>
                                7
                            </span>

                            <span>
                                14
                            </span>

                            <span>
                                21
                            </span>

                            <span>
                                30
                            </span>

                        </div>

                    </div>

                </div>

            </section>



            <!-- =================================================
                 CREDITS
            ================================================== -->

            <section
                class="dashboard-section"
                id="credits"
            >


                <div class="credits-banner">


                    <div class="credits-banner-icon">

                        <i class="bi bi-stars"></i>

                    </div>


                    <div class="credits-banner-content">

                        <span>
                            YOUR AI CREDITS
                        </span>

                        <h2>
                            <?php echo $userCreditsDisplay; ?>
                            credits available
                        </h2>

                        <p>
                            Credits are used when you use
                            AI-powered creator features.
                        </p>

                    </div>


                    <div class="credits-banner-action">

                        <a
                            href="buy-credits.php"
                            class="btn btn-primary"
                        >

                            <i class="bi bi-plus-lg"></i>

                            Buy Credits

                        </a>

                    </div>

                </div>

            </section>



            <!-- =================================================
                 SETTINGS
            ================================================== -->

            <section
                class="dashboard-section"
                id="settings"
            >


                <div class="section-heading">

                    <div>

                        <span class="section-eyebrow">
                            ACCOUNT
                        </span>

                        <h2>
                            Settings
                        </h2>

                    </div>

                </div>


                <div class="settings-card">


                    <!-- Name -->

                    <div class="settings-row">

                        <div class="settings-row-icon">

                            <i class="bi bi-person"></i>

                        </div>


                        <div class="settings-row-content">

                            <span>
                                Full Name
                            </span>

                            <strong>
                                <?php echo $userName; ?>
                            </strong>

                        </div>

                    </div>


                    <!-- Email -->

                    <div class="settings-row">

                        <div class="settings-row-icon">

                            <i class="bi bi-envelope"></i>

                        </div>


                        <div class="settings-row-content">

                            <span>
                                Email Address
                            </span>

                            <strong>
                                <?php echo $userEmail; ?>
                            </strong>

                        </div>

                    </div>


                    <!-- Credits -->

                    <div class="settings-row">

                        <div class="settings-row-icon">

                            <i class="bi bi-coin"></i>

                        </div>


                        <div class="settings-row-content">

                            <span>
                                Credit Balance
                            </span>

                            <strong>
                                <?php echo $userCreditsDisplay; ?>
                            </strong>

                        </div>

                    </div>


                    <!-- Account status -->

                    <div class="settings-row">

                        <div class="settings-row-icon">

                            <i class="bi bi-shield-check"></i>

                        </div>


                        <div class="settings-row-content">

                            <span>
                                Account Status
                            </span>

                            <strong>
                                <?php echo ucfirst($userStatus); ?>
                            </strong>

                        </div>

                    </div>


                    <!-- Sign out -->

                    <div class="settings-row settings-row-danger">

                        <div class="settings-row-icon">

                            <i class="bi bi-box-arrow-right"></i>

                        </div>


                        <div class="settings-row-content">

                            <span>
                                Session
                            </span>

                            <strong>
                                Sign out of AIStudio
                            </strong>

                        </div>


                        <a
                            href="backend/auth/logout.php"
                            class="btn btn-outline-danger"
                        >

                            <i class="bi bi-box-arrow-right"></i>

                            Sign Out

                        </a>

                    </div>

                </div>

            </section>


        </div>



        <!-- =================================================
             FOOTER
        ================================================== -->

        <footer class="dashboard-footer">

            <div>

                <strong>
                    AIStudio
                </strong>

                <span>
                    Create. Transform. Go Live.
                </span>

            </div>


            <div>

                &copy;
                <?php echo date('Y'); ?>
                AIStudio.
                All rights reserved.

            </div>

        </footer>


    </main>

</div>



<!-- =========================================================
     MOBILE SIDEBAR OVERLAY
========================================================= -->

<div
    class="sidebar-overlay"
    id="sidebarOverlay"
></div>


<!-- =========================================================
     TOAST (used by dashboard.js showToast(), incl. payment result)
========================================================= -->

<div class="dashboard-toast" id="dashboardToast">
    <span id="dashboardToastMessage"></span>
</div>



<!-- Bootstrap JS -->

<script
    src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"
></script>


<!-- Dashboard JS -->

<script
    src="js/dashboard.js"
></script>


<!-- =========================================================
     MOBILE SIDEBAR
========================================================= -->

<script>

document.addEventListener("DOMContentLoaded", function () {

    const menuButton =
        document.getElementById("mobileMenuButton");

    const sidebar =
        document.querySelector(".sidebar");

    const overlay =
        document.getElementById("sidebarOverlay");


    function openSidebar() {

        if (sidebar) {
            sidebar.classList.add("mobile-open");
        }

        if (overlay) {
            overlay.classList.add("active");
        }

        document.body.classList.add("sidebar-open");
    }


    function closeSidebar() {

        if (sidebar) {
            sidebar.classList.remove("mobile-open");
        }

        if (overlay) {
            overlay.classList.remove("active");
        }

        document.body.classList.remove("sidebar-open");
    }


    if (menuButton) {

        menuButton.addEventListener(
            "click",
            openSidebar
        );

    }


    if (overlay) {

        overlay.addEventListener(
            "click",
            closeSidebar
        );

    }


    /*
    |--------------------------------------------------------------------------
    | Close mobile sidebar after clicking a navigation link
    |--------------------------------------------------------------------------
    */

    const sidebarLinks =
        document.querySelectorAll(".sidebar-link");


    sidebarLinks.forEach(function (link) {

        link.addEventListener(
            "click",
            closeSidebar
        );

    });


    /*
    |--------------------------------------------------------------------------
    | Keep sidebar closed when screen becomes desktop
    |--------------------------------------------------------------------------
    */

    window.addEventListener(
        "resize",
        function () {

            if (window.innerWidth >= 992) {
                closeSidebar();
            }

        }
    );

});

</script>


</body>

</html>
