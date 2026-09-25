<?php

/*
|--------------------------------------------------------------------------
| backend/admin/_guard.php
|--------------------------------------------------------------------------
|
| Include this at the very top of every admin backend file. Confirms
| the visitor is logged in AND has role = 'admin' on the users table.
| Not just "logged in" — a regular user hitting these URLs directly
| must be rejected, since these endpoints can view every user's data
| and adjust anyone's credit balance.
|
|--------------------------------------------------------------------------
*/

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

require_once __DIR__ . '/../config/database.php';

function admin_deny(int $code, string $message): never
{
    global $conn;
    if (isset($conn) && $conn instanceof mysqli) {
        $conn->close();
    }
    http_response_code($code);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'error' => $message]);
    exit;
}

if (
    !isset($_SESSION['logged_in']) ||
    $_SESSION['logged_in'] !== true ||
    !isset($_SESSION['user_id'])
) {
    admin_deny(401, 'You must be logged in.');
}

$adminUserId = (int) $_SESSION['user_id'];

$roleStmt = $conn->prepare('SELECT role FROM users WHERE id = ? LIMIT 1');
$roleStmt->bind_param('i', $adminUserId);
$roleStmt->execute();
$roleRow = $roleStmt->get_result()->fetch_assoc();
$roleStmt->close();

if (!$roleRow || $roleRow['role'] !== 'admin') {
    admin_deny(403, 'Admin access required.');
}

// $conn and $adminUserId are now available to whatever file included this.
