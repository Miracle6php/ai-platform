<?php

session_start();

/*
|--------------------------------------------------------------------------
| If already logged in, go directly to dashboard
|--------------------------------------------------------------------------
*/

if (
    isset($_SESSION['logged_in']) &&
    $_SESSION['logged_in'] === true &&
    isset($_SESSION['user_id'])
) {
    header('Location: dashboard.php');
    exit;
}

/*
|--------------------------------------------------------------------------
| Login error messages
|--------------------------------------------------------------------------
*/

$error = $_GET['error'] ?? '';

$errorMessage = '';

switch ($error) {

    case 'required':
        $errorMessage = 'Please enter your email and password.';
        break;

    case 'email':
        $errorMessage = 'Please use a valid Gmail address.';
        break;

    case 'invalid':
        $errorMessage = 'Invalid email or password.';
        break;

    case 'inactive':
        $errorMessage = 'Your account is not active. Please contact support.';
        break;

    case 'database':
        $errorMessage = 'A database error occurred. Please try again.';
        break;

    default:
        $errorMessage = '';
        break;
}

?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <title>Log In — AIStudio</title>

    <meta
        name="description"
        content="Log in to your AIStudio creator workspace."
    >

    <!-- Bootstrap -->
    <link
        href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css"
        rel="stylesheet"
    >

    <!-- Bootstrap Icons -->
    <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css"
    >

    <!-- Google Font -->
    <link
        href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
        rel="stylesheet"
    >

    <!-- Auth CSS -->
    <link rel="stylesheet" href="css/auth.css">
</head>

<body class="auth-page">

    <!-- Background -->
    <div class="auth-background">
        <div class="auth-glow auth-glow-1"></div>
        <div class="auth-glow auth-glow-2"></div>
        <div class="auth-grid"></div>
    </div>


    <!-- Navigation -->
    <nav class="auth-navbar">
        <div class="container">

            <a href="index.html" class="auth-brand">

                <span class="brand-mark">
                    <i class="bi bi-stars"></i>
                </span>

                <span>AIStudio</span>

            </a>

            <div class="auth-nav-right">

                <span>Don't have an account?</span>

                <a href="get-started.php" class="auth-nav-link">
                    Get Started
                </a>

            </div>

        </div>
    </nav>


    <!-- Main -->
    <main class="auth-main">

        <div class="auth-card">

            <!-- Header -->
            <div class="auth-header">

                <div class="auth-icon">
                    <i class="bi bi-person-fill"></i>
                </div>

                <h1>Welcome back</h1>

                <p>
                    Log in to your AIStudio creator workspace.
                </p>

            </div>


            <!-- Server Error -->
            <?php if ($errorMessage !== ''): ?>

                <div
                    class="alert alert-danger"
                    role="alert"
                    style="border-radius: 12px;"
                >
                    <i class="bi bi-exclamation-circle me-2"></i>
                    <?= htmlspecialchars($errorMessage, ENT_QUOTES, 'UTF-8') ?>
                </div>

            <?php endif; ?>


            <!-- Login Form -->
            <form
                id="loginForm"
                action="backend/auth/login.php"
                method="POST"
                novalidate
            >

                <!-- Email -->
                <div class="auth-field">

                    <label for="loginEmail">
                        Email address
                    </label>

                    <div class="auth-input-wrap">

                        <i class="bi bi-envelope"></i>

                        <input
                            type="email"
                            id="loginEmail"
                            name="email"
                            placeholder="you@gmail.com"
                            autocomplete="email"
                            required
                        >

                    </div>

                    <small
                        class="auth-error"
                        id="loginEmailError"
                    ></small>

                </div>


                <!-- Password -->
                <div class="auth-field">

                    <div class="auth-label-row">

                        <label for="loginPassword">
                            Password
                        </label>

                        <a href="#" id="forgotPassword">
                            Forgot password?
                        </a>

                    </div>

                    <div class="auth-input-wrap">

                        <i class="bi bi-lock"></i>

                        <input
                            type="password"
                            id="loginPassword"
                            name="password"
                            placeholder="Enter your password"
                            autocomplete="current-password"
                            required
                        >

                        <button
                            type="button"
                            class="password-toggle"
                            data-target="loginPassword"
                            aria-label="Show password"
                        >
                            <i class="bi bi-eye"></i>
                        </button>

                    </div>

                    <small
                        class="auth-error"
                        id="loginPasswordError"
                    ></small>

                </div>


                <!-- Remember -->
                <div class="auth-options">

                    <label class="custom-check">

                        <input
                            type="checkbox"
                            id="rememberMe"
                        >

                        <span class="checkmark"></span>

                        <span>Remember me</span>

                    </label>

                </div>


                <!-- Submit -->
                <button
                    type="submit"
                    class="auth-submit"
                    id="loginButton"
                >

                    <span class="button-text">
                        Log In
                    </span>

                    <span class="button-loading">
                        <span class="spinner-border spinner-border-sm"></span>
                        Logging in...
                    </span>

                    <i class="bi bi-arrow-right"></i>

                </button>

            </form>


            <!-- Divider -->
            <div class="auth-divider">
                <span>Secure access</span>
            </div>


            <!-- Security -->
            <div class="auth-security">

                <i class="bi bi-shield-check"></i>

                <div>

                    <strong>Your account is protected</strong>

                    <p>
                        Your creator workspace and account information
                        are kept secure.
                    </p>

                </div>

            </div>


            <!-- Bottom -->
            <div class="auth-bottom">

                <span>Don't have an account?</span>

                <a href="get-started.php">
                    Create one
                </a>

            </div>

        </div>

    </main>


    <!-- Footer -->
    <footer class="auth-footer">

        <div>
            © <span data-current-year></span> AIStudio.
            All rights reserved.
        </div>

        <div class="auth-footer-links">

            <a href="#">
                Privacy
            </a>

            <a href="#">
                Terms
            </a>

        </div>

    </footer>


    <!-- Bootstrap JS -->
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>

    <!-- Auth JS -->
    <script src="js/auth.js"></script>

</body>
</html>