<?php

/*
|--------------------------------------------------------------------------
| backend/admin/transactions-list.php
|--------------------------------------------------------------------------
| GET ?status=&page=&per_page= — paginated purchase history, joined
| with the buyer's name/email so the admin doesn't need a separate
| lookup per row.
|--------------------------------------------------------------------------
*/

require_once __DIR__ . '/_guard.php';

header('Content-Type: application/json');

$statusFilter = $_GET['status'] ?? '';
$validStatuses = ['pending', 'success', 'failed'];
$page = max(1, (int) ($_GET['page'] ?? 1));
$perPage = min(100, max(1, (int) ($_GET['per_page'] ?? 25)));
$offset = ($page - 1) * $perPage;

$whereClause = '';
$bindTypes = '';
$bindValues = [];

if (in_array($statusFilter, $validStatuses, true)) {
    $whereClause = 'WHERE t.status = ?';
    $bindTypes = 's';
    $bindValues[] = $statusFilter;
}

$countSql = "SELECT COUNT(*) AS total FROM credit_transactions t {$whereClause}";
$countStmt = $conn->prepare($countSql);
if ($bindTypes) {
    $countStmt->bind_param($bindTypes, ...$bindValues);
}
$countStmt->execute();
$total = (int) $countStmt->get_result()->fetch_assoc()['total'];
$countStmt->close();

$sql = "SELECT
            t.id, t.reference, t.amount, t.credits, t.status,
            t.created_at, t.updated_at,
            u.id AS user_id, u.name AS user_name, u.email AS user_email,
            p.name AS plan_name
        FROM credit_transactions t
        JOIN users u ON u.id = t.user_id
        LEFT JOIN credit_plans p ON p.id = t.plan_id
        {$whereClause}
        ORDER BY t.created_at DESC
        LIMIT ? OFFSET ?";

$stmt = $conn->prepare($sql);
$allTypes = $bindTypes . 'ii';
$allValues = array_merge($bindValues, [$perPage, $offset]);
$stmt->bind_param($allTypes, ...$allValues);
$stmt->execute();
$result = $stmt->get_result();

$transactions = [];
while ($row = $result->fetch_assoc()) {
    $row['id'] = (int) $row['id'];
    $row['user_id'] = (int) $row['user_id'];
    $row['amount'] = (float) $row['amount'];
    $row['credits'] = (float) $row['credits'];
    $transactions[] = $row;
}
$stmt->close();
$conn->close();

echo json_encode([
    'success' => true,
    'transactions' => $transactions,
    'total' => $total,
    'page' => $page,
    'per_page' => $perPage,
    'total_pages' => (int) ceil($total / $perPage),
]);
