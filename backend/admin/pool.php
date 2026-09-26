<?php

/*
|--------------------------------------------------------------------------
| backend/admin/pool.php
|--------------------------------------------------------------------------
| GET  — returns { available_credits, total_sold }
| POST { action: "topup", amount: float, note?: string }
|   Manually adds to available_credits. Use this after actually
|   paying Decart for more credits. Logged to credit_pool_topups.
|--------------------------------------------------------------------------
*/

require_once __DIR__ . '/_guard.php';

header('Content-Type: application/json');

function pool_respond(bool $success, string $message, int $code = 200, array $extra = []): never
{
    global $conn;
    if (isset($conn) && $conn instanceof mysqli) {
        $conn->close();
    }
    http_response_code($code);
    echo json_encode(array_merge(['success' => $success, 'message' => $message], $extra));
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $result = $conn->query(
        "SELECT available_credits, total_sold FROM platform_credit_pool WHERE id = 1 LIMIT 1"
    );
    $row = $result->fetch_assoc();
    $conn->close();

    if (!$row) {
        echo json_encode([
            'success' => true,
            'available_credits' => 0,
            'total_sold' => 0,
        ]);
        exit;
    }

    echo json_encode([
        'success' => true,
        'available_credits' => (float) $row['available_credits'],
        'total_sold' => (float) $row['total_sold'],
    ]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true) ?? [];

    if (($input['action'] ?? '') !== 'topup') {
        pool_respond(false, 'Unknown action.', 400);
    }

    $amount = isset($input['amount']) ? (float) $input['amount'] : null;
    $note = trim((string) ($input['note'] ?? ''));

    if ($amount === null || !is_finite($amount) || $amount <= 0) {
        pool_respond(false, 'A positive numeric amount is required.', 400);
    }

    $stmt = $conn->prepare(
        "UPDATE platform_credit_pool SET available_credits = available_credits + ? WHERE id = 1"
    );
    $stmt->bind_param('d', $amount);
    $stmt->execute();
    $stmt->close();

    $logStmt = $conn->prepare(
        "INSERT INTO credit_pool_topups (admin_user_id, amount, note) VALUES (?, ?, ?)"
    );
    $logStmt->bind_param('ids', $adminUserId, $amount, $note);
    $logStmt->execute();
    $logStmt->close();

    $result = $conn->query(
        "SELECT available_credits FROM platform_credit_pool WHERE id = 1 LIMIT 1"
    );
    $newAvailable = (float) $result->fetch_assoc()['available_credits'];

    pool_respond(true, 'Pool topped up.', 200, ['available_credits' => $newAvailable]);
}

pool_respond(false, 'Method not allowed.', 405);