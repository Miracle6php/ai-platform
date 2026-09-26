<?php

/*
|--------------------------------------------------------------------------
| backend/admin/user-transactions.php
|--------------------------------------------------------------------------
| GET ?user_id= — every credit_transactions row for one user, newest
| first. Used by the "History" button on each user row.
|--------------------------------------------------------------------------
*/

require_once __DIR__ . '/_guard.php';

header('Content-Type: application/json');

$targetUserId = (int) ($_GET['user_id'] ?? 0);

if ($targetUserId <= 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing or invalid user_id.']);
    exit;
}

$stmt = $conn->prepare(
    "SELECT t.reference, t.amount, t.credits, t.status, t.created_at, p.name AS plan_name
     FROM credit_transactions t
     LEFT JOIN credit_plans p ON p.id = t.plan_id
     WHERE t.user_id = ?
     ORDER BY t.created_at DESC"
);
$stmt->bind_param('i', $targetUserId);
$stmt->execute();
$result = $stmt->get_result();

$transactions = [];
while ($row = $result->fetch_assoc()) {
    $row['amount'] = (float) $row['amount'];
    $row['credits'] = (float) $row['credits'];
    $transactions[] = $row;
}
$stmt->close();
$conn->close();

echo json_encode(['success' => true, 'transactions' => $transactions]);