<?php

session_start();

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/paystack.php';
require_once __DIR__ . '/../config/dns_workaround.php';
require_once __DIR__ . '/../config/credit_pool.php';


/*
|--------------------------------------------------------------------------
| Must be logged in
|--------------------------------------------------------------------------
*/

if (
    !isset($_SESSION['logged_in']) ||
    $_SESSION['logged_in'] !== true ||
    !isset($_SESSION['user_id'])
) {
    header('Location: ../../login.php');
    exit;
}

$userId = (int) $_SESSION['user_id'];

$reference = $_GET['reference'] ?? ($_GET['trxref'] ?? '');
$reference = trim((string) $reference);

if ($reference === '') {
    header('Location: ../../dashboard.php?payment=failed');
    exit;
}


/*
|--------------------------------------------------------------------------
| Find the matching pending transaction
|--------------------------------------------------------------------------
*/

$stmt = $conn->prepare(
    "SELECT id, user_id, credits, status FROM credit_transactions WHERE reference = ? LIMIT 1"
);
$stmt->bind_param('s', $reference);
$stmt->execute();
$txResult = $stmt->get_result();

if ($txResult->num_rows === 0) {
    $stmt->close();
    $conn->close();
    header('Location: ../../dashboard.php?payment=failed');
    exit;
}

$transaction = $txResult->fetch_assoc();
$stmt->close();

if ((int) $transaction['user_id'] !== $userId) {
    $conn->close();
    header('Location: ../../dashboard.php?payment=failed');
    exit;
}

// Already credited — either by a page refresh here, or by the webhook beating us to it
if ($transaction['status'] === 'success') {
    $conn->close();
    header('Location: ../../dashboard.php?payment=success');
    exit;
}


/*
|--------------------------------------------------------------------------
| Verify the transaction directly with Paystack
|--------------------------------------------------------------------------
*/

$ch = curl_init('https://api.paystack.co/transaction/verify/' . rawurlencode($reference));
apply_dns_workaround($ch, 'api.paystack.co');

curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        'Authorization: Bearer ' . PAYSTACK_SECRET_KEY,
    ],
    CURLOPT_TIMEOUT => 20,
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($response === false) {
    $conn->close();
    header('Location: ../../dashboard.php?payment=failed');
    exit;
}

$paystackData = json_decode($response, true);

$isSuccessful = (
    $httpCode === 200 &&
    !empty($paystackData['status']) &&
    isset($paystackData['data']['status']) &&
    $paystackData['data']['status'] === 'success'
);

if (!$isSuccessful) {
    $stmt = $conn->prepare(
        "UPDATE credit_transactions SET status = 'failed' WHERE reference = ? AND status = 'pending'"
    );
    $stmt->bind_param('s', $reference);
    $stmt->execute();
    $stmt->close();
    $conn->close();

    header('Location: ../../dashboard.php?payment=failed');
    exit;
}


/*
|--------------------------------------------------------------------------
| Credit the user's balance
|--------------------------------------------------------------------------
| The status = 'pending' check in the UPDATE is what prevents double
| crediting if this page is reloaded, or if the webhook already handled it.
|--------------------------------------------------------------------------
*/

$conn->begin_transaction();

try {
    $stmt = $conn->prepare(
        "UPDATE credit_transactions
         SET status = 'success', paystack_response = ?
         WHERE reference = ? AND status = 'pending'"
    );
    $rawResponse = substr($response, 0, 65000);
    $stmt->bind_param('ss', $rawResponse, $reference);
    $stmt->execute();
    $rowsAffected = $stmt->affected_rows;
    $stmt->close();

    if ($rowsAffected === 0) {
        // Someone else (e.g. the webhook) already processed this reference
        $conn->rollback();
        $conn->close();
        header('Location: ../../dashboard.php?payment=success');
        exit;
    }

    $stmt = $conn->prepare(
        "UPDATE users SET credits_balance = credits_balance + ? WHERE id = ?"
    );
    $creditsToAdd = (float) $transaction['credits'];
    $stmt->bind_param('di', $creditsToAdd, $userId);
    $stmt->execute();
    $stmt->close();

    record_platform_credit_sale($conn, $creditsToAdd);

    $conn->commit();
} catch (Exception $e) {
    $conn->rollback();
    $conn->close();
    error_log('[Paystack] verify-payment failed: ' . $e->getMessage());
    header('Location: ../../dashboard.php?payment=failed');
    exit;
}

$conn->close();

header('Location: ../../dashboard.php?payment=success');
exit;
