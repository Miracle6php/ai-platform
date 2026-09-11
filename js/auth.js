/* =========================================
AIStudio Authentication JavaScript
PHP Authentication Compatible
========================================= */

document.addEventListener("DOMContentLoaded", function () {

/* =========================================
   FLOATING ALERT
========================================= */

let alertTimer = null;

function showAlert(message, type = "danger") {

    const oldAlert = document.getElementById("authAlert");

    if (oldAlert) {
        oldAlert.remove();
    }

    const alertBox = document.createElement("div");

    alertBox.id = "authAlert";

    alertBox.className =
        `alert alert-${type} alert-dismissible fade show auth-floating-alert`;

    alertBox.setAttribute("role", "alert");

    alertBox.innerHTML = `
        <div class="d-flex align-items-center gap-2">
            <i class="bi bi-exclamation-circle-fill"></i>
            <span>${message}</span>
        </div>

        <button
            type="button"
            class="btn-close"
            aria-label="Close">
        </button>
    `;

    document.body.appendChild(alertBox);

    const closeButton =
        alertBox.querySelector(".btn-close");

    if (closeButton) {

        closeButton.addEventListener("click", function () {
            hideAlert(alertBox);
        });

    }

    if (alertTimer) {
        clearTimeout(alertTimer);
    }

    alertTimer = setTimeout(function () {

        if (alertBox && alertBox.parentElement) {
            hideAlert(alertBox);
        }

    }, 4000);
}


/* =========================================
   HIDE ALERT
========================================= */

function hideAlert(alertBox) {

    if (!alertBox) return;

    alertBox.classList.remove("show");

    setTimeout(function () {

        if (alertBox && alertBox.parentElement) {
            alertBox.remove();
        }

    }, 300);
}


/* =========================================
   PASSWORD SHOW / HIDE
========================================= */

const passwordToggles =
    document.querySelectorAll(".password-toggle");

passwordToggles.forEach(function (toggle) {

    toggle.addEventListener("click", function () {

        const targetId =
            this.getAttribute("data-target");

        const input =
            document.getElementById(targetId);

        if (!input) return;


        if (input.type === "password") {

            input.type = "text";

            this.innerHTML =
                '<i class="bi bi-eye-slash"></i>';

            this.setAttribute(
                "aria-label",
                "Hide password"
            );

        } else {

            input.type = "password";

            this.innerHTML =
                '<i class="bi bi-eye"></i>';

            this.setAttribute(
                "aria-label",
                "Show password"
            );

        }

    });

});


/* =========================================
   LOGIN FORM
========================================= */

const loginForm =
    document.getElementById("loginForm");

if (loginForm) {

    loginForm.addEventListener("submit", function (event) {

        const email =
            document.getElementById("loginEmail");

        const password =
            document.getElementById("loginPassword");


        /* -----------------------------------------
           CHECK EMAIL
        ----------------------------------------- */

        if (!email || email.value.trim() === "") {

            event.preventDefault();

            showAlert(
                "Please enter your email address.",
                "danger"
            );

            if (email) {
                email.focus();
            }

            return;
        }


        /* -----------------------------------------
           CHECK PASSWORD
        ----------------------------------------- */

        if (!password || password.value.trim() === "") {

            event.preventDefault();

            showAlert(
                "Please enter your password.",
                "danger"
            );

            if (password) {
                password.focus();
            }

            return;
        }


        /* -----------------------------------------
           VALIDATION PASSED
           Allow normal PHP form submission
        ----------------------------------------- */

        const submitButton =
            loginForm.querySelector(
                'button[type="submit"]'
            );

        if (submitButton) {

            submitButton.disabled = true;

            const buttonText =
                submitButton.querySelector(
                    ".button-text"
                );

            const buttonLoading =
                submitButton.querySelector(
                    ".button-loading"
                );


            if (buttonText) {
                buttonText.style.display = "none";
            }


            if (buttonLoading) {
                buttonLoading.style.display =
                    "inline-flex";
            }

        }

        /*
         * IMPORTANT:
         *
         * Do NOT use event.preventDefault()
         * here.
         *
         * The browser must submit the form to:
         *
         * backend/auth/login.php
         *
         * PHP will then create the session
         * and redirect to dashboard.php.
         */

    });

}


/* =========================================
   REGISTER FORM
========================================= */

const registerForm =
    document.getElementById("registerForm");

if (registerForm) {

    registerForm.addEventListener("submit", function (event) {

        const name =
            document.getElementById("registerName");

        const email =
            document.getElementById("registerEmail");

        const password =
            document.getElementById("registerPassword");

        const confirmPassword =
            document.getElementById("confirmPassword");

        const terms =
            document.getElementById("termsCheck");


        /* =====================================
           FULL NAME
        ===================================== */

        if (!name || name.value.trim() === "") {

            event.preventDefault();

            showAlert(
                "Please enter your full name.",
                "danger"
            );

            if (name) {
                name.focus();
            }

            return;
        }


        /* =====================================
           EMAIL
        ===================================== */

        if (!email || email.value.trim() === "") {

            event.preventDefault();

            showAlert(
                "Please enter your email address.",
                "danger"
            );

            if (email) {
                email.focus();
            }

            return;
        }


        /* =====================================
           PASSWORD
        ===================================== */

        if (!password || password.value.trim() === "") {

            event.preventDefault();

            showAlert(
                "Please enter a password.",
                "danger"
            );

            if (password) {
                password.focus();
            }

            return;
        }


        /* =====================================
           CONFIRM PASSWORD
        ===================================== */

        if (
            !confirmPassword ||
            confirmPassword.value.trim() === ""
        ) {

            event.preventDefault();

            showAlert(
                "Please confirm your password.",
                "danger"
            );

            if (confirmPassword) {
                confirmPassword.focus();
            }

            return;
        }


        /* =====================================
           PASSWORD MATCH
        ===================================== */

        if (
            password.value !==
            confirmPassword.value
        ) {

            event.preventDefault();

            showAlert(
                "Passwords do not match.",
                "danger"
            );

            confirmPassword.focus();

            return;
        }


        /* =====================================
           TERMS
        ===================================== */

        if (!terms || !terms.checked) {

            event.preventDefault();

            showAlert(
                "Please accept the Terms and Conditions.",
                "danger"
            );

            if (terms) {
                terms.focus();
            }

            return;
        }


        /* =====================================
           VALIDATION PASSED
           Allow PHP registration
        ===================================== */

        const registerButton =
            document.getElementById("registerButton");

        if (registerButton) {

            registerButton.disabled = true;


            const buttonText =
                registerButton.querySelector(
                    ".button-text"
                );

            const buttonLoading =
                registerButton.querySelector(
                    ".button-loading"
                );


            if (buttonText) {
                buttonText.style.display =
                    "none";
            }


            if (buttonLoading) {
                buttonLoading.style.display =
                    "inline-flex";
            }

        }

        /*
         * IMPORTANT:
         *
         * Do NOT prevent the form here.
         *
         * The browser will submit to:
         *
         * backend/auth/register.php
         */

    });

}


/* =========================================
   PASSWORD STRENGTH
========================================= */

const registerPassword =
    document.getElementById("registerPassword");

const passwordStrengthBar =
    document.getElementById(
        "passwordStrengthBar"
    );

const passwordStrengthText =
    document.getElementById(
        "passwordStrengthText"
    );


if (
    registerPassword &&
    passwordStrengthBar &&
    passwordStrengthText
) {

    registerPassword.addEventListener(
        "input",
        function () {

            const value = this.value;


            /* ---------------------------------
               EMPTY
            --------------------------------- */

            if (value.length === 0) {

                passwordStrengthBar.style.width =
                    "0%";

                passwordStrengthBar.className =
                    "strength-bar";

                passwordStrengthText.textContent =
                    "Password strength";

                return;
            }


            let strength = 0;


            if (value.length >= 4) {
                strength++;
            }

            if (value.length >= 8) {
                strength++;
            }

            if (/[A-Z]/.test(value)) {
                strength++;
            }

            if (/[0-9]/.test(value)) {
                strength++;
            }

            if (/[^A-Za-z0-9]/.test(value)) {
                strength++;
            }


            /* ---------------------------------
               WEAK
            --------------------------------- */

            if (strength <= 1) {

                passwordStrengthBar.style.width =
                    "25%";

                passwordStrengthBar.className =
                    "strength-bar weak";

                passwordStrengthText.textContent =
                    "Weak";
            }


            /* ---------------------------------
               FAIR
            --------------------------------- */

            else if (strength === 2) {

                passwordStrengthBar.style.width =
                    "50%";

                passwordStrengthBar.className =
                    "strength-bar fair";

                passwordStrengthText.textContent =
                    "Fair";
            }


            /* ---------------------------------
               GOOD
            --------------------------------- */

            else if (
                strength === 3 ||
                strength === 4
            ) {

                passwordStrengthBar.style.width =
                    "75%";

                passwordStrengthBar.className =
                    "strength-bar good";

                passwordStrengthText.textContent =
                    "Good";
            }


            /* ---------------------------------
               STRONG
            --------------------------------- */

            else {

                passwordStrengthBar.style.width =
                    "100%";

                passwordStrengthBar.className =
                    "strength-bar strong";

                passwordStrengthText.textContent =
                    "Strong";
            }

        }
    );

}


/* =========================================
   CURRENT YEAR
========================================= */

document
    .querySelectorAll("[data-current-year]")
    .forEach(function (element) {

        element.textContent =
            new Date().getFullYear();

    });

});