<?php

session_start();

header('Content-Type: application/json');

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/paystack.php';
require_once __DIR__ . '/../config/dns_workaround.php';


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
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Not authenticated.']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Invalid request method.']);
    exit;
}

$userId = (int) $_SESSION['user_id'];

$planId = isset($_POST['plan_id']) ? (int) $_POST['plan_id'] : 0;
$customAmount = isset($_POST['amount_usd']) ? trim((string) $_POST['amount_usd']) : '';


/*
|--------------------------------------------------------------------------
| Look up the user's email (Paystack requires it)
|--------------------------------------------------------------------------
*/

$stmt = $conn->prepare("SELECT email FROM users WHERE id = ? LIMIT 1");
$stmt->bind_param('i', $userId);
$stmt->execute();
$userResult = $stmt->get_result();

if ($userResult->num_rows === 0) {
    $stmt->close();
    $conn->close();
    echo json_encode(['success' => false, 'message' => 'User not found.']);
    exit;
}

$userEmail = $userResult->fetch_assoc()['email'];
$stmt->close();


/*
|--------------------------------------------------------------------------
| Work out what's being purchased: a fixed plan, or a custom amount
|--------------------------------------------------------------------------
| $priceCents / $amountUsd below are always USD -- that is what is
| stored in the DB and shown to the user. Conversion to NGN/kobo for
| the actual Paystack charge happens later, right before the API call.
|--------------------------------------------------------------------------
*/

$planName = null;
$priceCents = null;
$credits = null;
$isCustom = false;

if ($planId > 0) {

    // ----- Fixed plan -----

    $stmt = $conn->prepare(
        "SELECT id, name, credits, price_cents
         FROM credit_plans
         WHERE id = ? AND is_active = 1
         LIMIT 1"
    );
    $stmt->bind_param('i', $planId);
    $stmt->execute();
    $planResult = $stmt->get_result();

    if ($planResult->num_rows === 0) {
        $stmt->close();
        $conn->close();
        echo json_encode(['success' => false, 'message' => 'Plan not found or inactive.']);
        exit;
    }

    $plan = $planResult->fetch_assoc();
    $stmt->close();

    $planName = $plan['name'];
    $priceCents = (int) $plan['price_cents']; // USD cents -- see note above CREDIT_PLANS in paystack.php
    $credits = (float) $plan['credits'];

} elseif ($customAmount !== '') {

    // ----- Custom "buy any amount" -----

    if (!is_numeric($customAmount)) {
        $conn->close();
        echo json_encode(['success' => false, 'message' => 'Enter a valid dollar amount.']);
        exit;
    }

    $amountUsdInput = round((float) $customAmount, 2);

    if ($amountUsdInput < CUSTOM_PURCHASE_MIN_USD || $amountUsdInput > CUSTOM_PURCHASE_MAX_USD) {
        $conn->close();
        echo json_encode([
            'success' => false,
            'message' => 'Amount must be between $' . CUSTOM_PURCHASE_MIN_USD . ' and $' . CUSTOM_PURCHASE_MAX_USD . '.',
        ]);
        exit;
    }

    $isCustom = true;
    $planId = null;
    $priceCents = (int) round($amountUsdInput * 100);
    $credits = round($amountUsdInput * CREDITS_PER_USD, 2);

} else {
    $conn->close();
    echo json_encode(['success' => false, 'message' => 'Choose a plan or enter an amount.']);
    exit;
}


/*
|--------------------------------------------------------------------------
| Create a pending transaction record with a unique reference
|--------------------------------------------------------------------------
| `amount` stored here is USD, matching price_cents / CREDIT_PLANS.
| The NGN/kobo amount actually charged by Paystack is derived from
| this right below and is never persisted separately -- it's fully
| reproducible from `amount` and USD_TO_NGN_RATE.
|--------------------------------------------------------------------------
*/

$reference = 'AISTUDIO_' . strtoupper(bin2hex(random_bytes(10)));
$amountUsd = $priceCents / 100;

if ($isCustom) {
    // $planId is NULL for a custom purchase. Some mysqli versions don't
    // reliably bind NULL through the 'i' type, so build the statement
    // dynamically rather than always binding plan_id as an integer.
    $stmt = $conn->prepare(
        "INSERT INTO credit_transactions (user_id, plan_id, reference, amount, credits, status)
         VALUES (?, NULL, ?, ?, ?, 'pending')"
    );
    $stmt->bind_param(
        'isdd',
        $userId,
        $reference,
        $amountUsd,
        $credits
    );
} else {
    $stmt = $conn->prepare(
        "INSERT INTO credit_transactions (user_id, plan_id, reference, amount, credits, status)
         VALUES (?, ?, ?, ?, ?, 'pending')"
    );
    $stmt->bind_param(
        'iisdd',
        $userId,
        $planId,
        $reference,
        $amountUsd,
        $credits
    );
}

if (!$stmt->execute()) {
    $stmt->close();
    $conn->close();
    echo json_encode(['success' => false, 'message' => 'Could not create transaction.']);
    exit;
}

$stmt->close();
$conn->close();


/*
|--------------------------------------------------------------------------
| Convert USD -> NGN -> kobo for the actual Paystack charge
|--------------------------------------------------------------------------
| PAYSTACK_CURRENCY is NGN, and Paystack expects `amount` in the
| smallest unit of that currency -- kobo, not USD cents. The USD
| price must go through USD_TO_NGN_RATE first, or the customer is
| charged roughly 1/1500th of what they should be.
|--------------------------------------------------------------------------
*/

$amountNgn = $amountUsd * USD_TO_NGN_RATE;
$amountKobo = (int) round($amountNgn * 100);


/*
|--------------------------------------------------------------------------
| Ask Paystack to initialize the transaction
|--------------------------------------------------------------------------
*/

$callbackUrl = app_base_url() . '/backend/payments/verify-payment.php';

$paystackPayload = [
    'email' => $userEmail,
    'amount' => $amountKobo, // smallest unit of PAYSTACK_CURRENCY (kobo for NGN)
    'currency' => PAYSTACK_CURRENCY,
    'reference' => $reference,
    'callback_url' => $callbackUrl,
    'metadata' => [
        'user_id' => $userId,
        'plan_id' => $planId,
        'plan_name' => $planName ?? 'Custom amount',
        'amount_usd' => $amountUsd,
    ],
];

$ch = curl_init('https://api.paystack.co/transaction/initialize');
apply_dns_workaround($ch, 'api.paystack.co');

curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => json_encode($paystackPayload),
    CURLOPT_HTTPHEADER => [
        'Authorization: Bearer ' . PAYSTACK_SECRET_KEY,
        'Content-Type: application/json',
    ],
    CURLOPT_TIMEOUT => 20,
]);

$response = curl_exec($ch);
$curlError = curl_error($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($response === false) {
    echo json_encode(['success' => false, 'message' => 'Could not reach Paystack: ' . $curlError]);
    exit;
}

$paystackData = json_decode($response, true);

if ($httpCode !== 200 || empty($paystackData['status'])) {
    $errorMessage = $paystackData['message'] ?? 'Paystack initialization failed.';
    echo json_encode(['success' => false, 'message' => $errorMessage]);
    exit;
}

echo json_encode([
    'success' => true,
    'authorization_url' => $paystackData['data']['authorization_url'],
    'reference' => $reference,
]);
