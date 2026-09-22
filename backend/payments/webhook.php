<?php

/*
|--------------------------------------------------------------------------
| Paystack webhook
|--------------------------------------------------------------------------
| Set this URL in your Paystack dashboard under Settings → API Keys & Webhooks:
|   https://your-domain.com/backend/payments/webhook.php
|
| This exists as a safety net: if the user closes the browser tab right
| after paying (before verify-payment.php runs), Paystack still calls
| this URL server-to-server, so the credits get added anyway.
|--------------------------------------------------------------------------
*/

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/paystack.php';

$payload = file_get_contents('php://input');
$signature = $_SERVER['HTTP_X_PAYSTACK_SIGNATURE'] ?? '';

if ($payload === '' || $signature === '') {
    http_response_code(400);
    exit;
}


/*
|--------------------------------------------------------------------------
| Verify the request really came from Paystack
|--------------------------------------------------------------------------
*/

$expectedSignature = hash_hmac('sha512', $payload, PAYSTACK_SECRET_KEY);

if (!hash_equals($expectedSignature, $signature)) {
    http_response_code(401);
    exit;
}

$event = json_decode($payload, true);

if (!$event || !isset($event['event'])) {
    http_response_code(400);
    exit;
}

if ($event['event'] !== 'charge.success') {
    http_response_code(200);
    echo 'ok';
    exit;
}

$data = $event['data'] ?? [];
$reference = trim((string) ($data['reference'] ?? ''));
$status = $data['status'] ?? '';

if ($reference === '' || $status !== 'success') {
    http_response_code(200);
    echo 'ok';
    exit;
}


/*
|--------------------------------------------------------------------------
| Find the matching transaction
|--------------------------------------------------------------------------
*/

$stmt = $conn->prepare(
    "SELECT id, user_id, credits, status FROM credit_transactions WHERE reference = ? LIMIT 1"
);
$stmt->bind_param('s', $reference);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows === 0) {
    $stmt->close();
    $conn->close();
    http_response_code(200);
    echo 'ok';
    exit;
}

$transaction = $result->fetch_assoc();
$stmt->close();

if ($transaction['status'] === 'success') {
    // Already credited, likely by verify-payment.php
    $conn->close();
    http_response_code(200);
    echo 'ok';
    exit;
}


/*
|--------------------------------------------------------------------------
| Credit the user — same idempotent pattern as verify-payment.php
|--------------------------------------------------------------------------
*/

$conn->begin_transaction();

try {
    $stmt = $conn->prepare(
        "UPDATE credit_transactions
         SET status = 'success', paystack_response = ?
         WHERE reference = ? AND status = 'pending'"
    );
    $rawResponse = substr($payload, 0, 65000);
    $stmt->bind_param('ss', $rawResponse, $reference);
    $stmt->execute();
    $rowsAffected = $stmt->affected_rows;
    $stmt->close();

    if ($rowsAffected > 0) {
        $stmt = $conn->prepare(
            "UPDATE users SET credits_balance = credits_balance + ? WHERE id = ?"
        );
        $creditsToAdd = (float) $transaction['credits'];
        $userId = (int) $transaction['user_id'];
        $stmt->bind_param('di', $creditsToAdd, $userId);
        $stmt->execute();
        $stmt->close();
    }

    $conn->commit();
} catch (Exception $e) {
    $conn->rollback();
    error_log('[Paystack] webhook failed: ' . $e->getMessage());
    http_response_code(500);
    exit;
}

$conn->close();

http_response_code(200);
echo 'ok';
