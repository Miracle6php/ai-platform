/* =========================================
   AIStudio Dashboard JavaScript
   Shared Dashboard / Face / Voice / Live
========================================= */

document.addEventListener("DOMContentLoaded", function () {

    /* =========================================
       USER DATA
       PHP provides the real values through
       the body data attributes.
    ========================================= */

    const body = document.body;

    const dashboardData = {
        user: {
            name: body.dataset.userName || "Creator",
            email: body.dataset.userEmail || "",
            initial: (
                body.dataset.userName || "Creator"
            ).trim().charAt(0).toUpperCase() || "C"
        },

        credits: parseFloat(
            body.dataset.userCredits || "0"
        ) || 0,

        projects: [],

        usage: {
            minutes: 0,
            face: 0,
            voice: 0,
            live: 0
        },

        notifications: 0
    };


    /* =========================================
       ELEMENTS
    ========================================= */

    const sidebar =
        document.querySelector(".sidebar");

    const sidebarOverlay =
        document.getElementById("sidebarOverlay");

    const mobileMenuButton =
        document.getElementById("mobileMenuButton");

    const notificationButton =
        document.getElementById("notificationButton");

    const topbarCredits =
        document.getElementById("topbarCredits");

    const dashboardToast =
        document.getElementById("dashboardToast");

    const dashboardToastMessage =
        document.getElementById("dashboardToastMessage");


    /* =========================================
       OPTIONAL DASHBOARD ELEMENTS
       These exist only on dashboard.php.
       ========================================= */

    const creditsBalance =
        document.getElementById("creditsBalance");

    const projectsCount =
        document.getElementById("projectsCount");

    const usageMinutes =
        document.getElementById("usageMinutes");

    const currentPlan =
        document.getElementById("currentPlan");

    const welcomeUserName =
        document.getElementById("welcomeUserName");

    const sidebarUserInitial =
        document.querySelector(".sidebar-user-avatar");

    const sidebarUserName =
        document.querySelector(".sidebar-user-info strong");

    const sidebarUserPlan =
        document.querySelector(".sidebar-user-info span");


    /* =========================================
       LOAD USER DATA
    ========================================= */

    function loadDashboardData() {

        const user =
            dashboardData.user;

        if (welcomeUserName) {
            welcomeUserName.textContent =
                user.name;
        }

        if (sidebarUserName) {
            sidebarUserName.textContent =
                user.name;
        }

        if (sidebarUserPlan) {
            /*
             * Only change this if the existing
             * dashboard actually uses a plan label.
             */
            if (
                sidebarUserPlan.textContent.trim() === "" ||
                sidebarUserPlan.dataset.dynamic === "true"
            ) {
                sidebarUserPlan.textContent =
                    "Free Plan";
            }
        }

        if (sidebarUserInitial) {
            sidebarUserInitial.textContent =
                user.initial;
        }

        if (currentPlan) {
            currentPlan.textContent =
                "Free";
        }

        updateCredits();
        updateProjects();
        updateUsage();
        updateNotifications();
    }


    /* =========================================
       CREDITS
    ========================================= */

    function updateCredits() {

        const credits =
            dashboardData.credits;

        /*
         * IMPORTANT:
         *
         * Do NOT use:
         *
         * topbarCredits.textContent = ...
         *
         * because that removes the coin icon.
         */

        if (topbarCredits) {

            const creditText =
                topbarCredits.querySelector("span");

            if (creditText) {

                creditText.textContent =
                    formatNumber(credits);

            }

        }


        if (creditsBalance) {

            creditsBalance.textContent =
                formatNumber(credits);

        }


        /*
         * Voice Studio header credits
         */

        const headerCredits =
            document.getElementById(
                "headerCredits"
            );

        if (headerCredits) {

            headerCredits.textContent =
                formatNumber(credits);

        }


        /*
         * Face / Voice / Live pages may use
         * different credit displays.
         */

        document
            .querySelectorAll("[data-credits-value]")
            .forEach(function (element) {

                element.textContent =
                    formatNumber(credits);

            });

    }


    /* =========================================
       PROJECTS
    ========================================= */

    function updateProjects() {

        const projects =
            dashboardData.projects;

        if (projectsCount) {

            projectsCount.textContent =
                projects.length;

        }

        const projectsList =
            document.getElementById(
                "projectsList"
            );

        const emptyProjects =
            document.getElementById(
                "emptyProjects"
            );

        if (!projectsList) {
            return;
        }

        if (projects.length === 0) {

            if (emptyProjects) {

                emptyProjects.style.display =
                    "flex";

            }

            return;
        }

        if (emptyProjects) {

            emptyProjects.style.display =
                "none";

        }

        projects.forEach(function (project) {

            const projectCard =
                createProjectCard(project);

            projectsList.appendChild(
                projectCard
            );

        });

    }


    /* =========================================
       CREATE PROJECT CARD
    ========================================= */

    function createProjectCard(project) {

        const card =
            document.createElement("div");

        card.className =
            "project-card";

        card.innerHTML = `
            <div class="project-thumbnail">
                <i class="bi bi-folder2"></i>
            </div>

            <div class="project-info">
                <strong>${escapeHtml(project.name || "Project")}</strong>
                <small>${escapeHtml(project.type || "Project")}</small>
            </div>
        `;

        return card;
    }


    /* =========================================
       USAGE
    ========================================= */

    function updateUsage() {

        const usage =
            dashboardData.usage;

        if (usageMinutes) {

            usageMinutes.textContent =
                formatNumber(
                    usage.minutes
                );

        }

        const usageItems =
            document.querySelectorAll(
                ".usage-item"
            );

        if (usageItems.length >= 3) {

            updateUsageItem(
                usageItems[0],
                usage.face
            );

            updateUsageItem(
                usageItems[1],
                usage.voice
            );

            updateUsageItem(
                usageItems[2],
                usage.live
            );

        }

    }


    /* =========================================
       USAGE ITEM
    ========================================= */

    function updateUsageItem(
        item,
        minutes
    ) {

        if (!item) {
            return;
        }

        const value =
            item.querySelector(
                ".usage-item-top strong"
            );

        const progress =
            item.querySelector(
                ".usage-progress span"
            );

        if (value) {

            value.textContent =
                `${minutes} min`;

        }

        if (progress) {

            const percentage =
                Math.min(
                    Math.max(minutes, 0),
                    100
                );

            progress.style.width =
                `${percentage}%`;

        }

    }


    /* =========================================
       NOTIFICATIONS
    ========================================= */

    function updateNotifications() {

        const count =
            dashboardData.notifications;

        /*
         * Current dashboard uses
         * .notification-dot instead of
         * notificationBadge.
         */

        const notificationDot =
            document.querySelector(
                ".notification-dot"
            );

        if (!notificationDot) {
            return;
        }

        if (count > 0) {

            notificationDot.style.display =
                "block";

        } else {

            notificationDot.style.display =
                "none";

        }

    }


    /* =========================================
       MOBILE SIDEBAR
    ========================================= */

    function openSidebar() {

        if (!sidebar) {
            return;
        }

        sidebar.classList.add(
            "mobile-open"
        );

        if (sidebarOverlay) {

            sidebarOverlay.classList.add(
                "active"
            );

        }

        document.body.classList.add(
            "sidebar-open"
        );

        if (mobileMenuButton) {

            mobileMenuButton.setAttribute(
                "aria-expanded",
                "true"
            );

        }

    }


    function closeSidebar() {

        if (sidebar) {

            sidebar.classList.remove(
                "mobile-open"
            );

        }

        if (sidebarOverlay) {

            sidebarOverlay.classList.remove(
                "active"
            );

        }

        document.body.classList.remove(
            "sidebar-open"
        );

        if (mobileMenuButton) {

            mobileMenuButton.setAttribute(
                "aria-expanded",
                "false"
            );

        }

    }


    /* =========================================
       MENU BUTTON
    ========================================= */

    if (mobileMenuButton) {

        mobileMenuButton.addEventListener(
            "click",
            function () {

                if (
                    sidebar &&
                    sidebar.classList.contains(
                        "mobile-open"
                    )
                ) {

                    closeSidebar();

                } else {

                    openSidebar();

                }

            }
        );

    }


    /* =========================================
       OVERLAY
    ========================================= */

    if (sidebarOverlay) {

        sidebarOverlay.addEventListener(
            "click",
            closeSidebar
        );

    }


    /* =========================================
       SIDEBAR LINKS
    ========================================= */

    document
        .querySelectorAll(".sidebar-link")
        .forEach(function (link) {

            link.addEventListener(
                "click",
                function () {

                    /*
                     * Close the mobile menu
                     * after selecting a page.
                     */

                    if (
                        window.innerWidth <
                        992
                    ) {

                        closeSidebar();

                    }

                }
            );

        });


    /* =========================================
       ESC KEY
    ========================================= */

    document.addEventListener(
        "keydown",
        function (event) {

            if (event.key === "Escape") {

                closeSidebar();

            }

        }
    );


    /* =========================================
       RESPONSIVE SIDEBAR
    ========================================= */

    window.addEventListener(
        "resize",
        function () {

            if (window.innerWidth >= 992) {

                closeSidebar();

            }

        }
    );


    /* =========================================
       SMOOTH SCROLL
    ========================================= */

    document
        .querySelectorAll(
            "[data-scroll-target]"
        )
        .forEach(function (element) {

            element.addEventListener(
                "click",
                function (event) {

                    const targetId =
                        this.getAttribute(
                            "data-scroll-target"
                        );

                    if (!targetId) {
                        return;
                    }

                    const target =
                        document.getElementById(
                            targetId
                        );

                    if (!target) {
                        return;
                    }

                    event.preventDefault();

                    const topbar =
                        document.querySelector(
                            ".topbar"
                        );

                    const offset =
                        topbar
                            ? topbar.offsetHeight + 15
                            : 15;

                    const position =
                        target.getBoundingClientRect()
                            .top +
                        window.scrollY -
                        offset;

                    window.scrollTo({
                        top: position,
                        behavior: "smooth"
                    });

                    closeSidebar();

                }
            );

        });


    /* =========================================
       ACTIONS
    ========================================= */

    document
        .querySelectorAll("[data-action]")
        .forEach(function (element) {

            element.addEventListener(
                "click",
                function () {

                    const action =
                        this.getAttribute(
                            "data-action"
                        );

                    handleAction(action);

                }
            );

        });


    /* =========================================
       ACTION HANDLER
    ========================================= */

    function handleAction(action) {

        switch (action) {

            case "upgrade":

                showToast(
                    "Upgrade plans will be available soon."
                );

                break;

            case "buy-credits":

                showToast(
                    "Credit purchasing will be available soon."
                );

                break;

            case "new-project":

                showToast(
                    "Choose a studio to create your first project."
                );

                break;

            case "profile":

                showToast(
                    "Profile settings will be connected later."
                );

                break;

            case "security":

                showToast(
                    "Security settings will be connected later."
                );

                break;

            default:

                showToast(
                    "This feature is coming soon."
                );

        }

    }


    /* =========================================
       NOTIFICATION BUTTON
    ========================================= */

    if (notificationButton) {

        notificationButton.addEventListener(
            "click",
            function () {

                if (
                    dashboardData.notifications === 0
                ) {

                    showToast(
                        "You have no new notifications."
                    );

                } else {

                    showToast(
                        `You have ${dashboardData.notifications} notifications.`
                    );

                }

            }
        );

    }


    /* =========================================
       TOAST
    ========================================= */

    let toastTimer = null;


    function showToast(message) {

        if (!dashboardToast) {
            return;
        }

        if (dashboardToastMessage) {

            dashboardToastMessage.textContent =
                message;

        }

        dashboardToast.classList.add(
            "show"
        );

        if (toastTimer) {

            clearTimeout(toastTimer);

        }

        toastTimer = setTimeout(
            function () {

                dashboardToast.classList.remove(
                    "show"
                );

            },
            3000
        );

    }


    /* =========================================
       FORMAT NUMBERS
    ========================================= */

    function formatNumber(number) {

        return new Intl.NumberFormat(
            "en-US"
        ).format(
            Number(number) || 0
        );

    }


    /* =========================================
       HTML ESCAPE
    ========================================= */

    function escapeHtml(value) {

        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");

    }


    /* =========================================
       CURRENT YEAR
    ========================================= */

    document
        .querySelectorAll(
            "[data-current-year]"
        )
        .forEach(function (element) {

            element.textContent =
                new Date().getFullYear();

        });


    /* =========================================
       INITIALIZE
    ========================================= */

    loadDashboardData();

});