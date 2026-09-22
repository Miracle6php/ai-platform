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

/*
|--------------------------------------------------------------------------
| Credit check
|--------------------------------------------------------------------------
|
| A live session bills per second while it runs (see live-usage.php),
| so there's no fixed "cost" to check against up front the way Face
| Studio checks a video's full duration. Instead this just blocks
| starting a session with (close to) zero credits already — someone
| below the floor shouldn't be able to mint a token at all, even
| though the real, authoritative deduction happens continuously via
| live-usage.php once the session is running.
|
|--------------------------------------------------------------------------
*/

require_once __DIR__ . '/../config/database.php';

const LIVE_MIN_CREDITS_TO_START = 1.0;

$userId = (int) $_SESSION['user_id'];

$balanceStmt = $conn->prepare(
    'SELECT credits_balance FROM users WHERE id = ? LIMIT 1'
);
$balanceStmt->bind_param('i', $userId);
$balanceStmt->execute();
$balanceRow = $balanceStmt->get_result()->fetch_assoc();
$balanceStmt->close();

$currentBalance = $balanceRow ? (float) $balanceRow['credits_balance'] : 0.0;

if ($currentBalance < LIVE_MIN_CREDITS_TO_START) {
    jsonResponse([
        'success' => false,
        'error' => 'You do not have enough credits to start a live session.',
        'credits_balance' => $currentBalance,
    ], 402);
}

function loadDotEnv(string $file): array
{
    if (!is_file($file) || !is_readable($file)) {
        return [];
    }

    $values = [];

    $lines = file(
        $file,
        FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES
    );

    if ($lines === false) {
        return [];
    }

    foreach ($lines as $line) {
        $line = trim($line);

        if ($line === '' || str_starts_with($line, '#')) {
            continue;
        }

        if (!str_contains($line, '=')) {
            continue;
        }

        [$key, $value] = explode('=', $line, 2);

        $key = trim($key);
        $value = trim($value);

        if (
            strlen($value) >= 2 &&
            (
                ($value[0] === '"' && $value[strlen($value) - 1] === '"') ||
                ($value[0] === "'" && $value[strlen($value) - 1] === "'")
            )
        ) {
            $value = substr($value, 1, -1);
        }

        $values[$key] = $value;
    }

    return $values;
}

require_once __DIR__ . '/../config/dns_workaround.php';

$envFile = dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . '.env';

$dotenv = loadDotEnv($envFile);

$decartApiKey =
    getenv('DECART_API_KEY') ?:
    ($dotenv['DECART_API_KEY'] ?? '');

$decartApiKey = trim((string) $decartApiKey);

if ($decartApiKey === '') {
    jsonResponse([
        'success' => false,
        'error' => 'DECART_API_KEY is not configured on the server.'
    ], 500);
}

if (!function_exists('curl_init')) {
    jsonResponse([
        'success' => false,
        'error' => 'PHP cURL extension is not available.'
    ], 500);
}

/*
|--------------------------------------------------------------------------
| Resolve the requested model against an allow-list
|--------------------------------------------------------------------------
*/

const ALLOWED_MODELS = ['lucy-2.5'];
const DEFAULT_MODEL = 'lucy-2.5';

$rawBody = file_get_contents('php://input');
$requestBody = json_decode((string) $rawBody, true);

$requestedModel = '';

if (is_array($requestBody) && isset($requestBody['model'])) {
    $requestedModel = trim((string) $requestBody['model']);
}

$model = in_array($requestedModel, ALLOWED_MODELS, true)
    ? $requestedModel
    : DEFAULT_MODEL;

$payload = [
    'expiresIn' => 300,
    'allowedModels' => [
        $model
    ],
    'metadata' => [
        'userId' => (string) $_SESSION['user_id'],
        'product' => 'AIStudio',
        'feature' => 'live-studio'
    ]
];

/*
|--------------------------------------------------------------------------
| Pass through the real request origin
|--------------------------------------------------------------------------
*/
$origin = '';

if (!empty($_SERVER['HTTP_ORIGIN'])) {
    $origin = trim((string) $_SERVER['HTTP_ORIGIN']);
}

if ($origin !== '') {
    $payload['allowedOrigins'] = [$origin];
}

$jsonPayload = json_encode(
    $payload,
    JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
);

if ($jsonPayload === false) {
    jsonResponse([
        'success' => false,
        'error' => 'Unable to encode Decart token request.'
    ], 500);
}

$response = false;
$curlError = '';
$curlErrno = 0;
$httpCode = 0;

$maxAttempts = 3;

for ($attempt = 1; $attempt <= $maxAttempts; $attempt++) {
    $ch = curl_init(
        'https://api.decart.ai/v1/client/tokens'
    );

    if ($ch !== false) {
        apply_dns_workaround($ch, 'api.decart.ai');
    }

    if ($ch === false) {
        jsonResponse([
            'success' => false,
            'error' => 'Unable to initialize cURL.'
        ], 500);
    }

    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'Accept: application/json',
            // Matches the SDK's own buildAuthHeaders() exactly
            // (header names are case-insensitive over HTTP, but this
            // keeps the request byte-for-byte identical to what the
            // official SDK sends, ruling it out as a variable while
            // debugging the 1005 disconnect).
            'X-API-KEY: ' . $decartApiKey,
            'User-Agent: aistudio-live-studio-php/1.0'
        ],
        CURLOPT_POSTFIELDS => $jsonPayload,
        CURLOPT_CONNECTTIMEOUT => 15,
        CURLOPT_TIMEOUT => 30,
        CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_2TLS
    ]);

    $response = curl_exec($ch);

    $curlError = curl_error($ch);
    $curlErrno = curl_errno($ch);

    $httpCode = (int) curl_getinfo(
        $ch,
        CURLINFO_HTTP_CODE
    );

    curl_close($ch);

    $retryableCurlErrors = [
        CURLE_OPERATION_TIMEDOUT,
        CURLE_COULDNT_CONNECT,
        CURLE_COULDNT_RESOLVE_HOST
    ];

    if (
        $response !== false &&
        $curlErrno === 0
    ) {
        break;
    }

    if (
        !in_array($curlErrno, $retryableCurlErrors, true) ||
        $attempt >= $maxAttempts
    ) {
        break;
    }

    usleep(1000000);
}

if ($response === false || $curlErrno !== 0) {
    jsonResponse([
        'success' => false,
        'error' => 'Unable to contact Decart.',
        'curl_errno' => $curlErrno,
        'curl_error' => $curlError,
        'attempts' => $maxAttempts
    ], 502);
}

$data = json_decode(
    $response,
    true
);

if (!is_array($data)) {
    jsonResponse([
        'success' => false,
        'error' => 'Invalid response received from Decart.',
        'http_status' => $httpCode,
        'raw_response' => $response
    ], 502);
}

if ($httpCode < 200 || $httpCode >= 300) {
    $message = 'Decart token request failed.';

    if (!empty($data['detail'])) {
        if (is_string($data['detail'])) {
            $message = $data['detail'];
        } elseif (is_array($data['detail'])) {
            $message = 'Decart returned a structured error.';
        }
    }

    if (
        !empty($data['message']) &&
        is_string($data['message'])
    ) {
        $message = $data['message'];
    }

    if (
        !empty($data['error']) &&
        is_string($data['error'])
    ) {
        $message = $data['error'];
    }

    jsonResponse([
        'success' => false,
        'error' => $message,
        'http_status' => $httpCode,
        'provider_response' => $data,
        'debug_raw_response' => $response,
        'debug_request_payload' => $payload
    ], 502);
}

$clientApiKey = $data['apiKey'] ?? null;

if (
    !is_string($clientApiKey) ||
    trim($clientApiKey) === ''
) {
    jsonResponse([
        'success' => false,
        'error' => 'Decart did not return a client token.',
        'http_status' => $httpCode,
        'provider_response' => $data
    ], 502);
}

// Also surface what Decart granted the token permission to use, so the
// diagnostics panel can show it if a future WebSocket rejection turns
// out to be a model/origin mismatch rather than an account issue.
$grantedModels = $data['permissions']['models'] ?? null;
$grantedOrigins = $data['permissions']['origins'] ?? null;

jsonResponse([
    'success' => true,
    'apiKey' => $clientApiKey,
    'expiresAt' => $data['expiresAt'] ?? null,
    'model' => $model,
    'debug_origin_sent' => $origin !== '' ? $origin : null,
    'debug_granted_models' => $grantedModels,
    'debug_granted_origins' => $grantedOrigins
]);
