document.addEventListener("DOMContentLoaded", function () {

    /* =========================================
       NAVBAR SCROLL EFFECT
    ========================================= */

    const navbar = document.querySelector(".navbar");

    function handleNavbarScroll() {
        if (!navbar) return;

        if (window.scrollY > 30) {
            navbar.classList.add("scrolled");
        } else {
            navbar.classList.remove("scrolled");
        }
    }

    window.addEventListener("scroll", handleNavbarScroll);
    handleNavbarScroll();


    /* =========================================
       SMOOTH MOBILE NAVBAR
    ========================================= */

    const navbarCollapse = document.querySelector(".navbar-collapse");
    const navbarToggler = document.querySelector(".navbar-toggler");

    if (navbarCollapse && navbarToggler) {

        // Smooth opening
        navbarCollapse.addEventListener("show.bs.collapse", function () {
            navbarCollapse.style.maxHeight = "0px";
            navbarCollapse.style.opacity = "0";
            navbarCollapse.style.overflow = "hidden";

            requestAnimationFrame(() => {
                navbarCollapse.style.transition =
                    "max-height 0.4s ease, opacity 0.3s ease";

                navbarCollapse.style.maxHeight =
                    navbarCollapse.scrollHeight + "px";

                navbarCollapse.style.opacity = "1";
            });
        });

        // Smooth closing
        navbarCollapse.addEventListener("hide.bs.collapse", function () {

            navbarCollapse.style.maxHeight =
                navbarCollapse.scrollHeight + "px";

            navbarCollapse.style.opacity = "1";

            requestAnimationFrame(() => {
                navbarCollapse.style.transition =
                    "max-height 0.35s ease, opacity 0.25s ease";

                navbarCollapse.style.maxHeight = "0px";
                navbarCollapse.style.opacity = "0";
            });
        });

        // Reset styles after opening
        navbarCollapse.addEventListener("shown.bs.collapse", function () {
            navbarCollapse.style.maxHeight = "none";
            navbarCollapse.style.overflow = "visible";
        });

        // Reset styles after closing
        navbarCollapse.addEventListener("hidden.bs.collapse", function () {
            navbarCollapse.style.maxHeight = "";
            navbarCollapse.style.opacity = "";
            navbarCollapse.style.overflow = "";
            navbarCollapse.style.transition = "";
        });
    }


    /* =========================================
       CLOSE NAVBAR WHEN LINK IS CLICKED
    ========================================= */

    const navLinks = document.querySelectorAll(
        ".navbar-nav .nav-link, .navbar .btn"
    );

    navLinks.forEach(function (link) {

        link.addEventListener("click", function () {

            if (
                navbarCollapse &&
                navbarCollapse.classList.contains("show")
            ) {
                const bsCollapse =
                    bootstrap.Collapse.getInstance(navbarCollapse) ||
                    new bootstrap.Collapse(navbarCollapse, {
                        toggle: false
                    });

                bsCollapse.hide();
            }

        });

    });


    /* =========================================
       SMOOTH SCROLLING
    ========================================= */

    document.querySelectorAll('a[href^="#"]').forEach(function (link) {

        link.addEventListener("click", function (event) {

            const targetId = this.getAttribute("href");

            if (!targetId || targetId === "#") {
                event.preventDefault();
                return;
            }

            const target = document.querySelector(targetId);

            if (target) {
                event.preventDefault();

                const navbarHeight =
                    navbar ? navbar.offsetHeight : 0;

                const targetPosition =
                    target.getBoundingClientRect().top +
                    window.pageYOffset -
                    navbarHeight -
                    15;

                window.scrollTo({
                    top: targetPosition,
                    behavior: "smooth"
                });
            }

        });

    });


    /* =========================================
       CURRENT YEAR
    ========================================= */

    document.querySelectorAll("[data-current-year]").forEach(function (element) {
        element.textContent = new Date().getFullYear();
    });


    /* =========================================
       ESC KEY CLOSES MOBILE NAVBAR
    ========================================= */

    document.addEventListener("keydown", function (event) {

        if (event.key === "Escape" && navbarCollapse) {

            if (navbarCollapse.classList.contains("show")) {

                const bsCollapse =
                    bootstrap.Collapse.getInstance(navbarCollapse) ||
                    new bootstrap.Collapse(navbarCollapse, {
                        toggle: false
                    });

                bsCollapse.hide();
            }
        }

    });

});