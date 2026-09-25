<?php

/*
|--------------------------------------------------------------------------
| backend/admin/user-update.php
|--------------------------------------------------------------------------
| POST { user_id, action, ...params }
|
| action = "adjust_credits" { amount: float, reason?: string }
|   amount can be negative. Applied as a delta, not an absolute set,
|   so two admins acting near-simultaneously don't clobber each other.
|
| action = "set_status" { status: "active"|"suspended"|"banned" }
|
| action = "set_role" { role: "user"|"admin" }
|
| Every successful change is written to admin_action_log.
|--------------------------------------------------------------------------
*/

require_once __DIR__ . '/_guard.php';

header('Content-Type: application/json');

function respond(bool $success, string $message, int $code = 200, array $extra = []): never
{
    global $conn;
    if (isset($conn) && $conn instanceof mysqli) {
        $conn->close();
    }
    http_response_code($code);
    echo json_encode(array_merge(['success' => $success, 'message' => $message], $extra));
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(false, 'POST required.', 405);
}

$input = json_decode(file_get_contents('php://input'), true) ?? [];

$targetUserId = (int) ($input['user_id'] ?? 0);
$action = $input['action'] ?? '';

if ($targetUserId <= 0) {
    respond(false, 'Missing or invalid user_id.', 400);
}

// Confirm the target actually exists before doing anything.
$checkStmt = $conn->prepare('SELECT id FROM users WHERE id = ? LIMIT 1');
$checkStmt->bind_param('i', $targetUserId);
$checkStmt->execute();
if ($checkStmt->get_result()->num_rows === 0) {
    $checkStmt->close();
    respond(false, 'User not found.', 404);
}
$checkStmt->close();

function log_admin_action(mysqli $conn, int $adminId, int $targetId, string $action, string $details): void
{
    $stmt = $conn->prepare(
        'INSERT INTO admin_action_log (admin_user_id, target_user_id, action, details) VALUES (?, ?, ?, ?)'
    );
    $stmt->bind_param('iiss', $adminId, $targetId, $action, $details);
    $stmt->execute();
    $stmt->close();
}

switch ($action) {

    case 'adjust_credits':
        $amount = isset($input['amount']) ? (float) $input['amount'] : null;
        $reason = trim((string) ($input['reason'] ?? ''));

        if ($amount === null || !is_finite($amount) || $amount == 0.0) {
            respond(false, 'A non-zero numeric amount is required.', 400);
        }

        // Guard against an admin action driving a balance negative by
        // mistake — same defensive pattern used elsewhere in the app
        // (backend/face/status.php's credit deduction).
        $stmt = $conn->prepare(
            'UPDATE users SET credits_balance = credits_balance + ?
             WHERE id = ? AND credits_balance + ? >= 0'
        );
        $stmt->bind_param('did', $amount, $targetUserId, $amount);
        $stmt->execute();
        $ok = $stmt->affected_rows > 0;
        $stmt->close();

        if (!$ok) {
            respond(false, 'That adjustment would take the balance below zero.', 409);
        }

        $details = ($amount > 0 ? '+' : '') . number_format($amount, 2) . ' credits'
            . ($reason !== '' ? " — {$reason}" : '');
        log_admin_action($conn, $adminUserId, $targetUserId, 'adjust_credits', $details);

        $balanceStmt = $conn->prepare('SELECT credits_balance FROM users WHERE id = ?');
        $balanceStmt->bind_param('i', $targetUserId);
        $balanceStmt->execute();
        $newBalance = (float) $balanceStmt->get_result()->fetch_assoc()['credits_balance'];
        $balanceStmt->close();

        respond(true, 'Credits adjusted.', 200, ['credits_balance' => $newBalance]);
        break;

    case 'set_status':
        $status = $input['status'] ?? '';
        if (!in_array($status, ['active', 'suspended', 'banned'], true)) {
            respond(false, 'Invalid status.', 400);
        }

        // Prevent an admin from locking themselves out by accident.
        if ($targetUserId === $adminUserId && $status !== 'active') {
            respond(false, "You can't change your own account's status.", 400);
        }

        $stmt = $conn->prepare('UPDATE users SET status = ? WHERE id = ?');
        $stmt->bind_param('si', $status, $targetUserId);
        $stmt->execute();
        $stmt->close();

        log_admin_action($conn, $adminUserId, $targetUserId, 'set_status', "-> {$status}");
        respond(true, 'Status updated.');
        break;

    case 'set_role':
        $role = $input['role'] ?? '';
        if (!in_array($role, ['user', 'admin'], true)) {
            respond(false, 'Invalid role.', 400);
        }

        if ($targetUserId === $adminUserId && $role !== 'admin') {
            respond(false, "You can't remove your own admin access.", 400);
        }

        $stmt = $conn->prepare('UPDATE users SET role = ? WHERE id = ?');
        $stmt->bind_param('si', $role, $targetUserId);
        $stmt->execute();
        $stmt->close();

        log_admin_action($conn, $adminUserId, $targetUserId, 'set_role', "-> {$role}");
        respond(true, 'Role updated.');
        break;

    default:
        respond(false, 'Unknown action.', 400);
}
