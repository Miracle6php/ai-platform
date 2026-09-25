<?php

/*
|--------------------------------------------------------------------------
| backend/admin/users-list.php
|--------------------------------------------------------------------------
| GET ?search=&page=&per_page= — returns a paginated, optionally
| filtered list of users. Never returns password_hash.
|--------------------------------------------------------------------------
*/

require_once __DIR__ . '/_guard.php';

header('Content-Type: application/json');

$search = trim($_GET['search'] ?? '');
$page = max(1, (int) ($_GET['page'] ?? 1));
$perPage = min(100, max(1, (int) ($_GET['per_page'] ?? 25)));
$offset = ($page - 1) * $perPage;

// Correlated subquery: each user's most recent SUCCESSFUL purchase's
// plan name. NULL if they've never completed a purchase (still on
// whatever free/starting balance they signed up with).
$lastPlanSelect = "(
    SELECT p.name
    FROM credit_transactions t
    LEFT JOIN credit_plans p ON p.id = t.plan_id
    WHERE t.user_id = users.id AND t.status = 'success'
    ORDER BY t.created_at DESC
    LIMIT 1
) AS last_plan";

if ($search !== '') {
    $like = '%' . $search . '%';

    $countStmt = $conn->prepare(
        "SELECT COUNT(*) AS total FROM users WHERE name LIKE ? OR email LIKE ?"
    );
    $countStmt->bind_param('ss', $like, $like);
    $countStmt->execute();
    $total = (int) $countStmt->get_result()->fetch_assoc()['total'];
    $countStmt->close();

    $stmt = $conn->prepare(
        "SELECT id, name, email, credits_balance, status, role, created_at, {$lastPlanSelect}
         FROM users
         WHERE name LIKE ? OR email LIKE ?
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?"
    );
    $stmt->bind_param('ssii', $like, $like, $perPage, $offset);
} else {
    $total = (int) $conn->query("SELECT COUNT(*) AS total FROM users")
        ->fetch_assoc()['total'];

    $stmt = $conn->prepare(
        "SELECT id, name, email, credits_balance, status, role, created_at, {$lastPlanSelect}
         FROM users
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?"
    );
    $stmt->bind_param('ii', $perPage, $offset);
}

$stmt->execute();
$result = $stmt->get_result();

$users = [];
while ($row = $result->fetch_assoc()) {
    $row['id'] = (int) $row['id'];
    $row['credits_balance'] = (float) $row['credits_balance'];
    $users[] = $row;
}
$stmt->close();
$conn->close();

echo json_encode([
    'success' => true,
    'users' => $users,
    'total' => $total,
    'page' => $page,
    'per_page' => $perPage,
    'total_pages' => (int) ceil($total / $perPage),
]);
