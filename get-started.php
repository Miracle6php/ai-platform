<?php
// AIStudio — Get Started / Registration Page
?><!DOCTYPE html><html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Get Started — AIStudio</title>

<meta
    name="description"
    content="Create your AIStudio creator account."
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

</head><body class="auth-page"><!-- Background -->
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

            <span>Already have an account?</span>

            <a href="login.php" class="auth-nav-link">
                Log In
            </a>

        </div>

    </div>
</nav>

<!-- Main -->
<main class="auth-main signup-main">

    <div class="auth-card signup-card">

        <!-- Header -->
        <div class="auth-header">

            <div class="auth-icon">
                <i class="bi bi-stars"></i>
            </div>

            <h1>Create your account</h1>

            <p>
                Start creating with AIStudio today.
            </p>

        </div>

        <!-- Registration Form -->
        <form
            action="backend/auth/register.php"
            method="POST"
        >

            <!-- Full Name -->
            <div class="auth-field">

                <label for="registerName">
                    Full name
                </label>

                <div class="auth-input-wrap">

                    <i class="bi bi-person"></i>

                    <input
                        type="text"
                        id="registerName"
                        name="name"
                        placeholder="Your full name"
                        autocomplete="name"
                        required
                    >

                </div>

                <small class="auth-error"></small>

            </div>

            <!-- Email -->
            <div class="auth-field">

                <label for="registerEmail">
                    Email address
                </label>

                <div class="auth-input-wrap">

                    <i class="bi bi-envelope"></i>

                    <input
                        type="email"
                        id="registerEmail"
                        name="email"
                        placeholder="you@gmail.com"
                        autocomplete="email"
                        required
                    >

                </div>

                <small class="auth-error"></small>

            </div>

            <!-- Password -->
            <div class="auth-field">

                <label for="registerPassword">
                    Password
                </label>

                <div class="auth-input-wrap">

                    <i class="bi bi-lock"></i>

                    <input
                        type="password"
                        id="registerPassword"
                        name="password"
                        placeholder="Create a password"
                        autocomplete="new-password"
                        required
                    >

                    <button
                        type="button"
                        class="password-toggle"
                        data-target="registerPassword"
                        aria-label="Show password"
                    >
                        <i class="bi bi-eye"></i>
                    </button>

                </div>

                <!-- Password Strength -->
                <div class="password-strength">

                    <div class="strength-track">
                        <div
                            class="strength-bar"
                            id="passwordStrengthBar"
                        ></div>
                    </div>

                    <span id="passwordStrengthText">
                        Password strength
                    </span>

                </div>

                <small class="auth-error"></small>

            </div>

            <!-- Confirm Password -->
            <div class="auth-field">

                <label for="confirmPassword">
                    Confirm password
                </label>

                <div class="auth-input-wrap">

                    <i class="bi bi-shield-lock"></i>

                    <input
                        type="password"
                        id="confirmPassword"
                        name="confirmPassword"
                        placeholder="Repeat your password"
                        autocomplete="new-password"
                        required
                    >

                    <button
                        type="button"
                        class="password-toggle"
                        data-target="confirmPassword"
                        aria-label="Show password"
                    >
                        <i class="bi bi-eye"></i>
                    </button>

                </div>

                <small class="auth-error"></small>

            </div>

            <!-- Terms -->
            <div class="terms-check">

                <label class="custom-check">

                    <input
                        type="checkbox"
                        id="termsCheck"
                        name="terms"
                        value="1"
                        required
                    >

                    <span class="checkmark"></span>

                    <span>
                        I agree to the
                        <a href="#">Terms of Service</a>
                        and
                        <a href="#">Privacy Policy</a>.
                    </span>

                </label>

                <small class="auth-error"></small>

            </div>

            <!-- Submit -->
            <button
                type="submit"
                class="auth-submit"
                id="registerButton"
            >

                <span class="button-text">
                    Create Account
                </span>

                <span class="button-loading">
                    <span class="spinner-border spinner-border-sm"></span>
                    Creating account...
                </span>

                <i class="bi bi-arrow-right"></i>

            </button>

        </form>

        <!-- Divider -->
        <div class="auth-divider">
            <span>Built for creators</span>
        </div>

        <!-- Benefits -->
        <div class="signup-benefits">

            <div class="benefit-item">

                <div class="benefit-icon">
                    <i class="bi bi-camera-video"></i>
                </div>

                <div>
                    <strong>AI Face Studio</strong>
                    <span>Transform your live video.</span>
                </div>

            </div>

            <div class="benefit-item">

                <div class="benefit-icon">
                    <i class="bi bi-mic"></i>
                </div>

                <div>
                    <strong>AI Voice Studio</strong>
                    <span>Transform your voice in real time.</span>
                </div>

            </div>

            <div class="benefit-item">

                <div class="benefit-icon">
                    <i class="bi bi-broadcast"></i>
                </div>

                <div>
                    <strong>Live Studio</strong>
                    <span>Create and stream your content.</span>
                </div>

            </div>

        </div>

        <!-- Bottom -->
        <div class="auth-bottom">

            <span>Already have an account?</span>

            <a href="login.php">
                Log in
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

        <a href="#">Privacy</a>

        <a href="#">Terms</a>

    </div>

</footer>

<!-- Bootstrap JS -->
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>

<!-- Auth JS -->
<script src="js/auth.js"></script>

</body>
</html>