<?php

session_start();

header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Cache-Control: post-check=0, pre-check=0', false);
header('Pragma: no-cache');
header('Expires: 0');

if (
    !isset($_SESSION['logged_in']) ||
    $_SESSION['logged_in'] !== true ||
    !isset($_SESSION['user_id'])
) {
    header('Location: login.php');
    exit;
}

require_once __DIR__ . '/backend/config/database.php';

$adminUserId = (int) $_SESSION['user_id'];

$roleStmt = $conn->prepare('SELECT name, email, role FROM users WHERE id = ? LIMIT 1');
$roleStmt->bind_param('i', $adminUserId);
$roleStmt->execute();
$adminRow = $roleStmt->get_result()->fetch_assoc();
$roleStmt->close();

// Not an admin — bounce to the normal dashboard rather than exposing
// this page's existence with a bare 403.
if (!$adminRow || $adminRow['role'] !== 'admin') {
    $conn->close();
    header('Location: dashboard.php');
    exit;
}

$safeAdminName = htmlspecialchars($adminRow['name'], ENT_QUOTES, 'UTF-8');
$conn->close();

?><!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">

<meta name="viewport" content="width=device-width, initial-scale=1.0">

<title>Admin — AIStudio</title>

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

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link
    href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
    rel="stylesheet"
>

<!-- Shared Dashboard CSS -->
<link rel="stylesheet" href="css/dashboard.css">

<style>
    /* Admin-page-specific additions — layered on top of dashboard.css
       rather than duplicating its variables, so this stays in sync
       with the rest of the app's look automatically. */

    .admin-stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 16px;
        margin-bottom: 28px;
    }

    .admin-stat-card {
        background: var(--panel-bg, #14141c);
        border: 1px solid var(--border-color, #262633);
        border-radius: 14px;
        padding: 18px;
    }

    .admin-stat-card span {
        display: block;
        font-size: 13px;
        color: var(--text-muted, #8b8b9e);
        margin-bottom: 6px;
    }

    .admin-stat-card strong {
        font-size: 26px;
        font-weight: 700;
    }

    .admin-panel {
        background: var(--panel-bg, #14141c);
        border: 1px solid var(--border-color, #262633);
        border-radius: 16px;
        padding: 20px;
    }

    .admin-search-row {
        display: flex;
        gap: 10px;
        margin-bottom: 16px;
        flex-wrap: wrap;
    }

    .admin-search-row input[type="text"] {
        flex: 1;
        min-width: 200px;
        background: #0e0e14;
        border: 1px solid var(--border-color, #262633);
        border-radius: 10px;
        padding: 10px 14px;
        color: #fff;
    }

    .admin-table-wrap {
        overflow-x: auto;
    }

    table.admin-users {
        width: 100%;
        border-collapse: collapse;
        font-size: 14px;
        min-width: 720px;
    }

    table.admin-users th {
        text-align: left;
        padding: 10px 12px;
        color: var(--text-muted, #8b8b9e);
        font-weight: 600;
        border-bottom: 1px solid var(--border-color, #262633);
        white-space: nowrap;
    }

    table.admin-users td {
        padding: 12px;
        border-bottom: 1px solid rgba(255,255,255,0.05);
        vertical-align: middle;
    }

    .admin-badge {
        display: inline-block;
        padding: 3px 10px;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 600;
    }

    .admin-badge.active { background: rgba(40,200,120,0.15); color: #34d399; }
    .admin-badge.suspended { background: rgba(250,180,40,0.15); color: #fbbf24; }
    .admin-badge.banned { background: rgba(240,60,60,0.15); color: #f87171; }
    .admin-badge.role-admin { background: rgba(130,110,255,0.18); color: #a78bfa; }
    .admin-badge.role-user { background: rgba(255,255,255,0.08); color: #cfcfe0; }

    .admin-row-actions {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
    }

    .admin-btn {
        border: 1px solid var(--border-color, #262633);
        background: #1b1b26;
        color: #fff;
        border-radius: 8px;
        padding: 6px 10px;
        font-size: 12.5px;
        cursor: pointer;
        white-space: nowrap;
    }

    .admin-btn:hover { background: #24242f; }
    .admin-btn.danger { border-color: rgba(240,60,60,0.4); color: #f87171; }
    .admin-btn.ok { border-color: rgba(40,200,120,0.4); color: #34d399; }

    .admin-credit-form {
        display: flex;
        gap: 4px;
        align-items: center;
    }

    .admin-credit-form input {
        width: 76px;
        background: #0e0e14;
        border: 1px solid var(--border-color, #262633);
        border-radius: 6px;
        padding: 5px 6px;
        color: #fff;
        font-size: 12.5px;
    }

    .admin-pagination {
        display: flex;
        gap: 8px;
        justify-content: center;
        margin-top: 18px;
    }

    .admin-empty {
        text-align: center;
        padding: 40px;
        color: var(--text-muted, #8b8b9e);
    }
</style>

</head><body class="dashboard-page" data-admin-id="<?php echo $adminUserId; ?>">

<div class="dashboard-layout">

<aside class="sidebar">

    <div class="sidebar-brand">
        <a class="brand-link" href="admin.php">
            <span class="brand-icon"><i class="bi bi-shield-lock-fill"></i></span>
            <span class="brand-text">AIStudio Admin</span>
        </a>
    </div>

    <nav class="sidebar-nav">
        <div class="nav-section">
            <span class="nav-section-title">Admin</span>

            <a href="admin.php" class="sidebar-link active" data-tab-link="users">
                <i class="bi bi-people-fill"></i>
                <span>Users</span>
            </a>

            <a href="admin.php" class="sidebar-link" data-tab-link="purchases">
                <i class="bi bi-credit-card-fill"></i>
                <span>Purchases</span>
            </a>

            <a href="https://platform.decart.ai" target="_blank" rel="noopener" class="sidebar-link">
                <i class="bi bi-box-arrow-up-right"></i>
                <span>Decart usage &amp; billing</span>
            </a>

            <a href="dashboard.php" class="sidebar-link">
                <i class="bi bi-arrow-left-circle"></i>
                <span>Back to my dashboard</span>
            </a>
        </div>
    </nav>

    <div class="sidebar-user">
        <div class="sidebar-user-avatar">
            <?php echo strtoupper(substr($safeAdminName, 0, 1)); ?>
        </div>
        <div class="sidebar-user-info">
            <strong><?php echo $safeAdminName; ?></strong>
            <span>Administrator</span>
        </div>
        <a href="backend/auth/logout.php" class="sidebar-logout" aria-label="Sign out">
            <i class="bi bi-box-arrow-right"></i>
        </a>
    </div>

</aside>

<main class="main-content">

    <header class="topbar">
        <div class="topbar-page-title"><span>Admin — User Management</span></div>
    </header>

    <div class="dashboard-container">

        <div class="admin-stats-grid" id="statsGrid">
            <div class="admin-stat-card"><span>Total Users</span><strong id="statTotalUsers">—</strong></div>
            <div class="admin-stat-card"><span>Active</span><strong id="statActive">—</strong></div>
            <div class="admin-stat-card"><span>Suspended / Banned</span><strong id="statBlocked">—</strong></div>
            <div class="admin-stat-card"><span>Credits Outstanding</span><strong id="statCredits">—</strong></div>
            <div class="admin-stat-card"><span>Revenue (success)</span><strong id="statRevenue">—</strong></div>
            <div class="admin-stat-card"><span>New (7 days)</span><strong id="statNewUsers">—</strong></div>
        </div>

        <section class="admin-panel" id="usersPanel">

            <div class="admin-search-row">
                <input type="text" id="searchInput" placeholder="Search by name or email...">
                <button class="admin-btn" id="searchButton">Search</button>
                <button class="admin-btn" id="clearSearchButton">Clear</button>
            </div>

            <div class="admin-table-wrap">
                <table class="admin-users">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Credits</th>
                            <th>Last Plan</th>
                            <th>Status</th>
                            <th>Role</th>
                            <th>Joined</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="usersTableBody">
                        <tr><td colspan="8" class="admin-empty">Loading...</td></tr>
                    </tbody>
                </table>
            </div>

            <div class="admin-pagination" id="paginationRow"></div>

        </section>

        <section class="admin-panel d-none" id="purchasesPanel">

            <div class="admin-search-row">
                <select id="statusFilter" class="admin-btn">
                    <option value="">All statuses</option>
                    <option value="success">Success</option>
                    <option value="pending">Pending</option>
                    <option value="failed">Failed</option>
                </select>
            </div>

            <div class="admin-table-wrap">
                <table class="admin-users">
                    <thead>
                        <tr>
                            <th>Buyer</th>
                            <th>Plan</th>
                            <th>Amount</th>
                            <th>Credits</th>
                            <th>Status</th>
                            <th>Reference</th>
                            <th>Date</th>
                        </tr>
                    </thead>
                    <tbody id="purchasesTableBody">
                        <tr><td colspan="7" class="admin-empty">Loading...</td></tr>
                    </tbody>
                </table>
            </div>

            <div class="admin-pagination" id="purchasesPaginationRow"></div>

        </section>

    </div>

</main>

</div>

<script>
(function () {
    const state = { search: "", page: 1, perPage: 25 };

    const el = (id) => document.getElementById(id);

    async function api(path, options = {}) {
        const response = await fetch(path, {
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            ...options,
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.success === false) {
            throw new Error(data.message || data.error || `Request failed (${response.status})`);
        }
        return data;
    }

    function fmtCredits(n) {
        return Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 });
    }

    async function loadStats() {
        try {
            const { stats } = await api("backend/admin/stats.php");
            el("statTotalUsers").textContent = stats.total_users;
            el("statActive").textContent = stats.users_by_status.active;
            el("statBlocked").textContent =
                stats.users_by_status.suspended + stats.users_by_status.banned;
            el("statCredits").textContent = fmtCredits(stats.total_credits_outstanding);
            el("statRevenue").textContent = "$" + fmtCredits(stats.total_revenue);
            el("statNewUsers").textContent = stats.new_users_last_7_days;
        } catch (err) {
            console.error("Failed to load stats:", err);
        }
    }

    // Must match PROTECTED_ADMIN_EMAIL in backend/admin/user-update.php —
    // the server enforces this regardless, this is just so the UI
    // doesn't offer buttons that will fail anyway.
    const PROTECTED_ADMIN_EMAIL = "adminyes1@gmail.com";

    function userRow(user) {
        const joined = new Date(user.created_at).toLocaleDateString();
        const statusBadge = `<span class="admin-badge ${user.status}">${user.status}</span>`;
        const roleBadge = `<span class="admin-badge role-${user.role}">${user.role}</span>`;
        const isProtected = user.email.toLowerCase() === PROTECTED_ADMIN_EMAIL;

        const blockButton = user.status === "active"
            ? `<button class="admin-btn danger" data-action="suspend" data-id="${user.id}">Suspend</button>`
            : `<button class="admin-btn ok" data-action="activate" data-id="${user.id}">Unblock</button>`;

        const banButton = user.status !== "banned"
            ? `<button class="admin-btn danger" data-action="ban" data-id="${user.id}">Ban</button>`
            : "";

        const roleButton = user.role === "admin"
            ? `<button class="admin-btn" data-action="demote" data-id="${user.id}">Remove admin</button>`
            : `<button class="admin-btn" data-action="promote" data-id="${user.id}">Make admin</button>`;

        const actionsCell = isProtected
            ? `<span style="opacity:.6"><i class="bi bi-shield-lock-fill"></i> Protected account</span>`
            : `<div class="admin-row-actions">${blockButton}${banButton}${roleButton}</div>`;

        const lastPlan = user.last_plan
            ? escapeHtml(user.last_plan)
            : `<span style="opacity:.5">— none yet —</span>`;

        return `
            <tr data-row-id="${user.id}">
                <td>${escapeHtml(user.name)}</td>
                <td>${escapeHtml(user.email)}</td>
                <td>
                    <div>${fmtCredits(user.credits_balance)}</div>
                    <form class="admin-credit-form" data-credit-form="${user.id}">
                        <input type="number" step="any" placeholder="±amount" required>
                        <button type="submit" class="admin-btn">Apply</button>
                    </form>
                </td>
                <td>${lastPlan}</td>
                <td>${statusBadge}</td>
                <td>${roleBadge}</td>
                <td>${joined}</td>
                <td>${actionsCell}</td>
            </tr>
        `;
    }

    function escapeHtml(str) {
        const div = document.createElement("div");
        div.textContent = str;
        return div.innerHTML;
    }

    async function loadUsers() {
        const tbody = el("usersTableBody");
        tbody.innerHTML = `<tr><td colspan="8" class="admin-empty">Loading...</td></tr>`;

        try {
            const params = new URLSearchParams({
                search: state.search,
                page: state.page,
                per_page: state.perPage,
            });

            const data = await api(`backend/admin/users-list.php?${params}`);

            if (data.users.length === 0) {
                tbody.innerHTML = `<tr><td colspan="8" class="admin-empty">No users found.</td></tr>`;
            } else {
                tbody.innerHTML = data.users.map(userRow).join("");
            }

            renderPagination(data.page, data.total_pages);
            attachRowHandlers();
        } catch (err) {
            tbody.innerHTML = `<tr><td colspan="8" class="admin-empty">${escapeHtml(err.message)}</td></tr>`;
        }
    }

    function renderPagination(page, totalPages) {
        const row = el("paginationRow");
        if (totalPages <= 1) {
            row.innerHTML = "";
            return;
        }

        let html = "";
        for (let p = 1; p <= totalPages; p++) {
            html += `<button class="admin-btn${p === page ? " ok" : ""}" data-page="${p}">${p}</button>`;
        }
        row.innerHTML = html;

        row.querySelectorAll("[data-page]").forEach((btn) => {
            btn.addEventListener("click", () => {
                state.page = parseInt(btn.dataset.page, 10);
                loadUsers();
            });
        });
    }

    async function performAction(userId, action, extra = {}) {
        const actionMap = {
            suspend: { action: "set_status", status: "suspended" },
            activate: { action: "set_status", status: "active" },
            ban: { action: "set_status", status: "banned" },
            promote: { action: "set_role", role: "admin" },
            demote: { action: "set_role", role: "user" },
        };

        const payload = actionMap[action] ? { ...actionMap[action], ...extra } : extra;

        try {
            await api("backend/admin/user-update.php", {
                method: "POST",
                body: JSON.stringify({ user_id: userId, ...payload }),
            });
            loadUsers();
            loadStats();
        } catch (err) {
            alert(err.message);
        }
    }

    function attachRowHandlers() {
        document.querySelectorAll("[data-action]").forEach((btn) => {
            btn.addEventListener("click", () => {
                const id = parseInt(btn.dataset.id, 10);
                const action = btn.dataset.action;

                if (action === "ban" && !confirm("Ban this user? They will not be able to log in.")) {
                    return;
                }

                performAction(id, action);
            });
        });

        document.querySelectorAll("[data-credit-form]").forEach((form) => {
            form.addEventListener("submit", (e) => {
                e.preventDefault();
                const id = parseInt(form.dataset.creditForm, 10);
                const input = form.querySelector("input");
                const amount = parseFloat(input.value);

                if (!amount || Number.isNaN(amount)) return;

                performAction(id, "adjust_credits", {
                    action: "adjust_credits",
                    amount: amount,
                });
            });
        });
    }

    el("searchButton").addEventListener("click", () => {
        state.search = el("searchInput").value.trim();
        state.page = 1;
        loadUsers();
    });

    el("clearSearchButton").addEventListener("click", () => {
        el("searchInput").value = "";
        state.search = "";
        state.page = 1;
        loadUsers();
    });

    el("searchInput").addEventListener("keydown", (e) => {
        if (e.key === "Enter") el("searchButton").click();
    });

    // ---------------------------------------------------------------
    // TAB SWITCHING (Users / Purchases)
    // ---------------------------------------------------------------

    const purchasesState = { status: "", page: 1, perPage: 25 };

    function switchTab(tab) {
        document.querySelectorAll("[data-tab-link]").forEach((link) => {
            link.classList.toggle("active", link.dataset.tabLink === tab);
        });
        el("usersPanel").classList.toggle("d-none", tab !== "users");
        el("purchasesPanel").classList.toggle("d-none", tab !== "purchases");

        if (tab === "purchases") {
            loadPurchases();
        }
    }

    document.querySelectorAll("[data-tab-link]").forEach((link) => {
        link.addEventListener("click", (e) => {
            e.preventDefault();
            switchTab(link.dataset.tabLink);
        });
    });

    function fmtMoney(n) {
        return "$" + Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function purchaseRow(t) {
        const date = new Date(t.created_at).toLocaleString();
        return `
            <tr>
                <td>${escapeHtml(t.user_name)}<br><small style="opacity:.6">${escapeHtml(t.user_email)}</small></td>
                <td>${escapeHtml(t.plan_name || "Custom")}</td>
                <td>${fmtMoney(t.amount)}</td>
                <td>${fmtCredits(t.credits)}</td>
                <td><span class="admin-badge ${t.status === "success" ? "active" : t.status === "pending" ? "suspended" : "banned"}">${t.status}</span></td>
                <td><code style="font-size:11px">${escapeHtml(t.reference)}</code></td>
                <td>${date}</td>
            </tr>
        `;
    }

    async function loadPurchases() {
        const tbody = el("purchasesTableBody");
        tbody.innerHTML = `<tr><td colspan="7" class="admin-empty">Loading...</td></tr>`;

        try {
            const params = new URLSearchParams({
                status: purchasesState.status,
                page: purchasesState.page,
                per_page: purchasesState.perPage,
            });

            const data = await api(`backend/admin/transactions-list.php?${params}`);

            if (data.transactions.length === 0) {
                tbody.innerHTML = `<tr><td colspan="7" class="admin-empty">No transactions found.</td></tr>`;
            } else {
                tbody.innerHTML = data.transactions.map(purchaseRow).join("");
            }

            renderPurchasesPagination(data.page, data.total_pages);
        } catch (err) {
            tbody.innerHTML = `<tr><td colspan="7" class="admin-empty">${escapeHtml(err.message)}</td></tr>`;
        }
    }

    function renderPurchasesPagination(page, totalPages) {
        const row = el("purchasesPaginationRow");
        if (totalPages <= 1) {
            row.innerHTML = "";
            return;
        }
        let html = "";
        for (let p = 1; p <= totalPages; p++) {
            html += `<button class="admin-btn${p === page ? " ok" : ""}" data-ppage="${p}">${p}</button>`;
        }
        row.innerHTML = html;
        row.querySelectorAll("[data-ppage]").forEach((btn) => {
            btn.addEventListener("click", () => {
                purchasesState.page = parseInt(btn.dataset.ppage, 10);
                loadPurchases();
            });
        });
    }

    el("statusFilter").addEventListener("change", (e) => {
        purchasesState.status = e.target.value;
        purchasesState.page = 1;
        loadPurchases();
    });

    loadStats();
    loadUsers();
})();
</script>

</body>
</html>
