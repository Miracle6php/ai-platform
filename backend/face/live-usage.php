<?php
declare(strict_types=1);

session_start();

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

function jsonResponse(array $data, int $status = 200): never
{
    http_response_code($status);

    echo json_encode(
        $data,
        JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
    );

    exit;
}

if (empty($_SESSION['user_id'])) {
    jsonResponse([
        'success' => false,
        'error' => 'Authentication required.'
    ], 401);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse([
        'success' => false,
        'error' => 'POST request required.'
    ], 405);
}

require_once __DIR__ . '/../config/database.php';

$userId = (int) $_SESSION['user_id'];


/*
|--------------------------------------------------------------------------
| Rates — MUST match CREDIT_RATES in js/live-part1.js
|--------------------------------------------------------------------------
|
| Deliberately not trusting a client-supplied rate: the browser sends
| only which mode was active, and this endpoint looks up the price
| itself. Otherwise a modified client could bill itself $0/sec.
|
|--------------------------------------------------------------------------
*/

const LIVE_CREDIT_RATES = [
    'face' => 6,
    'voice' => 2,
    'face-voice' => 8,
];


/*
|--------------------------------------------------------------------------
| Read + validate input
|--------------------------------------------------------------------------
|
| elapsedSeconds is how many NEW seconds have passed since the last
| heartbeat this session sent — not total session time — so repeated
| calls accumulate correctly. Clamped to a small range: this is meant
| to be called roughly every 5-15s while live, so a single call
| claiming, say, 300s would either be a bug or a manipulated client;
| capping it bounds the damage either way to one short interval.
|
|--------------------------------------------------------------------------
*/

$input = json_decode(file_get_contents('php://input'), true) ?? [];

$mode = $input['mode'] ?? '';
$elapsedSeconds = isset($input['elapsed_seconds'])
    ? (float) $input['elapsed_seconds']
    : 0.0;

if (!isset(LIVE_CREDIT_RATES[$mode])) {
    jsonResponse([
        'success' => false,
        'error' => 'Invalid or missing mode.'
    ], 400);
}

if (!is_finite($elapsedSeconds) || $elapsedSeconds <= 0) {
    jsonResponse([
        'success' => false,
        'error' => 'Invalid elapsed_seconds.'
    ], 400);
}

// Hard ceiling per heartbeat call — see note above.
const MAX_SECONDS_PER_HEARTBEAT = 30;
$elapsedSeconds = min($elapsedSeconds, MAX_SECONDS_PER_HEARTBEAT);

$rate = LIVE_CREDIT_RATES[$mode];
$creditsToCharge = $elapsedSeconds * $rate;


/*
|--------------------------------------------------------------------------
| Deduct — same guarded pattern as backend/face/status.php
|--------------------------------------------------------------------------
|
| Try to charge the full amount first. If the balance doesn't cover it
| (this heartbeat pushed them past zero), charge whatever is left and
| report back "exhausted" so the frontend ends the session — instead
| of silently charging nothing and letting the session run for free.
|
|--------------------------------------------------------------------------
*/

$deductStmt = $conn->prepare(
    "UPDATE users
     SET credits_balance = credits_balance - ?
     WHERE id = ? AND credits_balance >= ?"
);
$deductStmt->bind_param('dii', $creditsToCharge, $userId, $creditsToCharge);
$deductStmt->execute();
$fullyCharged = $deductStmt->affected_rows > 0;
$deductStmt->close();

$exhausted = false;
$actuallyCharged = $creditsToCharge;

if (!$fullyCharged) {

    // Balance couldn't cover the full heartbeat — sweep whatever is
    // left (if any) down to zero instead, and flag the session as done.
    $sweepStmt = $conn->prepare(
        "UPDATE users
         SET credits_balance = 0
         WHERE id = ? AND credits_balance > 0"
    );
    $sweepStmt->bind_param('i', $userId);
    $sweepStmt->execute();
    $sweepStmt->close();

    $exhausted = true;
}


/*
|--------------------------------------------------------------------------
| Return updated balance
|--------------------------------------------------------------------------
*/

$refreshStmt = $conn->prepare(
    'SELECT credits_balance FROM users WHERE id = ? LIMIT 1'
);
$refreshStmt->bind_param('i', $userId);
$refreshStmt->execute();
$refreshRow = $refreshStmt->get_result()->fetch_assoc();
$refreshStmt->close();

$newBalance = $refreshRow ? (float) $refreshRow['credits_balance'] : 0.0;

if ($exhausted) {
    // We don't know the exact partial amount actually swept (a
    // concurrent request could interleave) — report what we can.
    $actuallyCharged = null;
}

jsonResponse([
    'success' => true,
    'exhausted' => $exhausted,
    'credits_charged' => $actuallyCharged,
    'credits_balance' => $newBalance,
]);
