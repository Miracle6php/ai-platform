<?php

/*
|--------------------------------------------------------------------------
| backend/admin/stats.php
|--------------------------------------------------------------------------
| GET — returns platform-wide summary numbers for the admin dashboard.
|--------------------------------------------------------------------------
*/

require_once __DIR__ . '/_guard.php';

header('Content-Type: application/json');

$stats = [];

// Total users, split by status
$result = $conn->query(
    "SELECT status, COUNT(*) AS count FROM users GROUP BY status"
);
$stats['users_by_status'] = ['active' => 0, 'suspended' => 0, 'banned' => 0];
while ($row = $result->fetch_assoc()) {
    $stats['users_by_status'][$row['status']] = (int) $row['count'];
}
$stats['total_users'] = array_sum($stats['users_by_status']);

// Total credits currently outstanding across all users
$result = $conn->query(
    "SELECT COALESCE(SUM(credits_balance), 0) AS total FROM users"
);
$stats['total_credits_outstanding'] = (float) $result->fetch_assoc()['total'];

// Revenue — successful payments only
$result = $conn->query(
    "SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count
     FROM credit_transactions WHERE status = 'success'"
);
$row = $result->fetch_assoc();
$stats['total_revenue'] = (float) $row['total'];
$stats['successful_transactions'] = (int) $row['count'];

// Voice jobs, split by status
$result = $conn->query(
    "SELECT status, COUNT(*) AS count FROM voice_jobs GROUP BY status"
);
$stats['voice_jobs_by_status'] = [
    'queued' => 0, 'processing' => 0, 'completed' => 0, 'failed' => 0,
];
while ($row = $result->fetch_assoc()) {
    $stats['voice_jobs_by_status'][$row['status']] = (int) $row['count'];
}

// New users in the last 7 days
$result = $conn->query(
    "SELECT COUNT(*) AS count FROM users
     WHERE created_at >= (NOW() - INTERVAL 7 DAY)"
);
$stats['new_users_last_7_days'] = (int) $result->fetch_assoc()['count'];

$conn->close();

echo json_encode(['success' => true, 'stats' => $stats]);
