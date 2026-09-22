// =========================================================
// AISTUDIO — BASE SITE JS
// If you already have a js/main.js on your server, merge this
// in rather than overwriting it — this only covers the navbar
// scroll state and the footer year that the markup expects.
// =========================================================

(function () {
    "use strict";

    // Navbar background on scroll
    var navbar = document.getElementById("mainNavbar");

    function updateNavbar() {
        if (!navbar) return;

        if (window.scrollY > 12) {
            navbar.classList.add("scrolled");
        } else {
            navbar.classList.remove("scrolled");
        }
    }

    window.addEventListener("scroll", updateNavbar, { passive: true });
    updateNavbar();

    // Footer year
    document.querySelectorAll("[data-current-year]").forEach(function (el) {
        el.textContent = new Date().getFullYear();
    });

    // Hero "AI Transform" toggle — crossfades the camera-preview
    // between the real-camera layer and the AI layer instead of
    // an abrupt show/hide.
    var aiToggle = document.getElementById("aiTransformToggle");
    var cameraTag = document.getElementById("cameraTag");
    var aiLayer = document.querySelector('.camera-layer[data-layer="ai"]');
    var AUTO_CYCLE_MS = 3500;
    var autoTimer = null;

    function setAiPreview(showAI) {
        aiToggle.classList.toggle("active", showAI);
        aiToggle.setAttribute("aria-pressed", showAI ? "true" : "false");
        aiLayer.classList.toggle("is-active", showAI);

        if (cameraTag) {
            cameraTag.textContent = showAI ? "AI · Live Transform" : "Real Camera";
        }
    }

    function prefersReducedMotion() {
        return (
            window.matchMedia &&
            window.matchMedia("(prefers-reduced-motion: reduce)").matches
        );
    }

    function startAutoCycle() {
        stopAutoCycle();

        if (prefersReducedMotion()) return;

        autoTimer = setInterval(function () {
            setAiPreview(!aiLayer.classList.contains("is-active"));
        }, AUTO_CYCLE_MS);
    }

    function stopAutoCycle() {
        if (autoTimer) {
            clearInterval(autoTimer);
            autoTimer = null;
        }
    }

    if (aiToggle && aiLayer) {
        // Manual click still works — it just also resets the
        // auto-cycle timer so it doesn't flip again right away.
        aiToggle.addEventListener("click", function () {
            setAiPreview(!aiLayer.classList.contains("is-active"));
            startAutoCycle();
        });

        // Pause the cycle while the tab isn't visible, resume when it is.
        document.addEventListener("visibilitychange", function () {
            if (document.hidden) {
                stopAutoCycle();
            } else {
                startAutoCycle();
            }
        });

        startAutoCycle();
    }


    // ---------------------------------------------------
    // Scroll reveal — slides content up into view once as it
    // enters the viewport (features, pricing cards, FAQ, etc).
    // ---------------------------------------------------

    var revealEls = document.querySelectorAll(".reveal");

    if (!revealEls.length) {
        // nothing to reveal
    } else if (!("IntersectionObserver" in window)) {
        // No IntersectionObserver support — just show everything.
        revealEls.forEach(function (el) {
            el.classList.add("is-visible");
        });
    } else {
        var revealObserver = new IntersectionObserver(
            function (entries) {
                entries.forEach(function (entry) {
                    if (entry.isIntersecting) {
                        entry.target.classList.add("is-visible");
                        revealObserver.unobserve(entry.target);
                    }
                });
            },
            { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
        );

        revealEls.forEach(function (el) {
            revealObserver.observe(el);
        });
    }
})();
