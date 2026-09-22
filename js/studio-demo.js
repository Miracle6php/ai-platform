// =========================================================
// AISTUDIO — CREATOR STUDIO TRANSFORMATION DEMO
// Powers the #studioDemo section: tab switching between
// Face / Voice / Live, with:
//   - a 3D card-flip transformation between tabs
//   - auto-cycling through Face → Voice → Live, each tab
//     holding for its own duration (see TAB_DURATIONS)
//   - the cycle only runs while the section is scrolled into
//     view, and stops for good once someone manually picks a
//     tab — until the section scrolls out of view and back
//     in, at which point it resumes automatically
//   - the two Live Studio clips (your own mp4 uploads)
//     starting together, automatically, the moment the Live
//     tab becomes active
// =========================================================

(function () {
    "use strict";

    var root = document.getElementById("studioDemo");
    if (!root) return;

    var navItems = root.querySelectorAll(".studio-nav[data-tab]");
    var panels = root.querySelectorAll(".demo-panel[data-panel]");
    var demoLabel = document.getElementById("demoLabel");
    var demoTitle = document.getElementById("demoTitle");
    var actionBtn = document.getElementById("demoActionBtn");
    var studioMain = root.querySelector(".studio-main");

    var TAB_META = {
        face: {
            label: "FACE TRANSFORMATION",
            title: "Original, reference and output — side by side",
            action: '<i class="bi bi-arrow-repeat"></i><span>Replay</span>',
            run: function () {
                playFaceClip();
            }
        },
        voice: {
            label: "VOICE TRANSFORMATION",
            title: "Original, cloned voice and output — three real recordings",
            action: '<i class="bi bi-play-btn-fill"></i><span>Play all three</span>',
            run: function () {
                playAllVoiceClips();
            }
        },
        live: {
            label: "LIVE — TWO CLIPS, SIDE BY SIDE",
            title: "Watch both real clips run together",
            action: '<i class="bi bi-arrow-repeat"></i><span>Restart both</span>',
            run: function () {
                playLiveClips();
            }
        }
    };

    // How long each tab stays on screen during the auto-cycle.
    var TAB_DURATIONS = {
        face: 6000,
        voice: 6000,
        live: 9000
    };

    var activeTab = "face";

    // ---------------------------------------------------
    // CARD TRANSFORMATION — flips .studio-main on a 3D tilt
    // whenever the active tab changes, then applies the new
    // tab's content once the card is "edge-on" to the viewer.
    // ---------------------------------------------------

    var FLIP_MS = 320; // must match the CSS animation duration
    var isFlipping = false;

    function prefersReducedMotion() {
        return (
            window.matchMedia &&
            window.matchMedia("(prefers-reduced-motion: reduce)").matches
        );
    }

    function applyTab(tab) {
        var previousTab = activeTab;
        activeTab = tab;

        navItems.forEach(function (item) {
            item.classList.toggle("active", item.dataset.tab === tab);
        });

        panels.forEach(function (panel) {
            panel.hidden = panel.dataset.panel !== tab;
        });

        var meta = TAB_META[tab];
        if (demoLabel) demoLabel.textContent = meta.label;
        if (demoTitle) demoTitle.textContent = meta.title;
        if (actionBtn) actionBtn.innerHTML = meta.action;

        // Leaving the Face tab: pause its clip so it's not still
        // playing silently in the background.
        if (previousTab === "face" && tab !== "face") {
            pauseFaceClip();
        }

        // Arriving on the Face tab: start its clip automatically.
        if (tab === "face") {
            playFaceClip();
        }

        // Leaving the Voice tab: pause any of the three players that
        // might still be running.
        if (previousTab === "voice" && tab !== "voice") {
            pauseAllVoiceClips();
        }

        // Leaving the Live tab: stop the clips so they don't keep
        // playing silently in the background.
        if (previousTab === "live" && tab !== "live") {
            pauseLiveClips();
        }

        // Arriving on the Live tab (from any trigger — a click,
        // the auto-cycle, or the action button): start both
        // clips together automatically.
        if (tab === "live") {
            playLiveClips();
        }
    }

    function setTab(tab) {
        if (!TAB_META[tab] || tab === activeTab) return;

        if (!studioMain || isFlipping || prefersReducedMotion()) {
            applyTab(tab);
            return;
        }

        isFlipping = true;
        studioMain.classList.add("card-flip-out");

        window.setTimeout(function () {
            applyTab(tab);

            studioMain.classList.remove("card-flip-out");
            studioMain.classList.add("card-flip-in");

            window.setTimeout(function () {
                studioMain.classList.remove("card-flip-in");
                isFlipping = false;
            }, FLIP_MS);
        }, FLIP_MS);
    }

    // ---------------------------------------------------
    // AUTO-CYCLE — rotates Face → Voice → Live → Face, each
    // tab holding for its own duration (TAB_DURATIONS).
    //
    // Rules:
    //   - only runs while #studioDemo is scrolled into view
    //   - stops immediately if someone manually clicks a tab,
    //     and stays stopped even if they scroll away and the
    //     section leaves/re-enters view while still picked...
    //     UNTIL the section leaves view and comes back, which
    //     resumes it (see the IntersectionObserver below)
    // ---------------------------------------------------

    var cycleTimer = null;
    var manuallyPaused = false;
    var isInView = false;

    function nextTab() {
        var order = ["face", "voice", "live"];
        var i = order.indexOf(activeTab);
        return order[(i + 1) % order.length];
    }

    function clearCycleTimer() {
        if (cycleTimer) {
            window.clearTimeout(cycleTimer);
            cycleTimer = null;
        }
    }

    function scheduleTick(forTab) {
        clearCycleTimer();

        if (manuallyPaused || !isInView || prefersReducedMotion()) return;

        var duration = TAB_DURATIONS[forTab] || 6000;

        cycleTimer = window.setTimeout(function () {
            // Compute the target before setTab() runs — setTab defers
            // the actual activeTab update until after its flip
            // animation finishes, so reading activeTab right here
            // (rather than after calling setTab) is what keeps this
            // in sync with what's currently on screen.
            var target = nextTab();
            setTab(target);

            // Schedule using the duration of the tab we just moved
            // INTO, not the one we left — passing it explicitly
            // avoids depending on activeTab, which won't reflect
            // "target" until the flip animation completes.
            scheduleTick(target);
        }, duration);
    }

    navItems.forEach(function (item) {
        item.addEventListener("click", function () {
            setTab(item.dataset.tab);

            // Picking a tab stops the automatic animation for
            // good, until the section scrolls out of view and
            // back in (handled by the observer below).
            manuallyPaused = true;
            clearCycleTimer();
        });
    });

    // Resume (or start) the cycle only while the section is
    // actually visible on screen; pause it the instant it
    // scrolls off, and pick back up — including overriding a
    // prior manual pause — when it scrolls back into view.
    if ("IntersectionObserver" in window) {
        var cycleObserver = new IntersectionObserver(
            function (entries) {
                entries.forEach(function (entry) {
                    isInView = entry.isIntersecting;

                    if (isInView) {
                        manuallyPaused = false;
                        scheduleTick(activeTab);
                    } else {
                        clearCycleTimer();
                    }
                });
            },
            { threshold: 0.35 }
        );

        cycleObserver.observe(root);
    } else {
        // No IntersectionObserver support — just run continuously.
        isInView = true;
        scheduleTick(activeTab);
    }

    document.addEventListener("visibilitychange", function () {
        if (document.hidden) {
            clearCycleTimer();
        } else if (isInView && !manuallyPaused) {
            scheduleTick(activeTab);
        }
    });

    if (actionBtn) {
        actionBtn.addEventListener("click", function () {
            var meta = TAB_META[activeTab];
            if (meta && typeof meta.run === "function") meta.run();
        });
    }


    // ---------------------------------------------------
    // FACE TAB — your composited clip: original clip,
    // reference image and AI output laid out side by side in
    // one video. Always muted, autoplays the moment the Face
    // tab becomes active.
    //
    // File expected at:
    //   media/face-studio-demo.mp4
    // (set in the <source> tag in index.html — swap that path
    // for wherever you actually host the upload)
    // ---------------------------------------------------

    var faceClip = document.getElementById("faceStudioClip");

    if (faceClip) faceClip.muted = true;

    function playFaceClip() {
        if (!faceClip) return;

        faceClip.muted = true;

        try {
            faceClip.currentTime = 0;
        } catch (e) {
            // Metadata may not be loaded yet — play() below will
            // still work, it just won't restart from 0 this time.
        }

        faceClip.play();
    }

    function pauseFaceClip() {
        if (faceClip) faceClip.pause();
    }


    // ---------------------------------------------------
    // VOICE TAB — three independent, real recordings: the
    // original voice, the cloned voice, and the final output.
    // Each has its own native player and is controlled
    // separately — this just adds a "Play all three" convenience
    // that starts them together, and pauses all three when
    // leaving the tab.
    //
    // Files expected at:
    //   media/voice-original.mp3
    //   media/voice-clone.mp3
    //   media/voice-output.mp3
    // (set in the <source> tags in index.html — swap those
    // paths for wherever you actually host the uploads)
    // ---------------------------------------------------

    var voiceOriginal = document.getElementById("voiceOriginal");
    var voiceClone = document.getElementById("voiceClone");
    var voiceOutput = document.getElementById("voiceOutput");
    var voicePlayers = [voiceOriginal, voiceClone, voiceOutput].filter(Boolean);

    function playAllVoiceClips() {
        voicePlayers.forEach(function (player) {
            try {
                player.currentTime = 0;
            } catch (e) {
                // Metadata may not be loaded yet — play() below will
                // still work, it just won't restart from 0 this time.
            }
            player.play();
        });
    }

    function pauseAllVoiceClips() {
        voicePlayers.forEach(function (player) {
            player.pause();
        });
    }


    // ---------------------------------------------------
    // LIVE TAB — your two mp4 clips, started together, always
    // muted (matches a typical silent-preview demo, and also
    // means autoplay is never blocked by the browser).
    //
    // Files expected at:
    //   media/live-clip-a.mp4
    //   media/live-clip-b.mp4
    // (set in the <source> tags in index.html — swap those
    // paths for wherever you actually host the uploads)
    // ---------------------------------------------------

    var clipA = document.getElementById("liveClipA");
    var clipB = document.getElementById("liveClipB");

    if (clipA) clipA.muted = true;
    if (clipB) clipB.muted = true;

    function playLiveClips() {
        if (!clipA || !clipB) return;

        clipA.muted = true;
        clipB.muted = true;

        try {
            clipA.currentTime = 0;
            clipB.currentTime = 0;
        } catch (e) {
            // Metadata may not be loaded yet — play() below will
            // still work, it just won't restart from 0 this time.
        }

        clipA.play();
        clipB.play();
    }

    function pauseLiveClips() {
        if (clipA) clipA.pause();
        if (clipB) clipB.pause();
    }


    // Initialize
    applyTab("face");
})();
