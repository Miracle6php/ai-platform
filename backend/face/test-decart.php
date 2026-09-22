<?php

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../config/dns_workaround.php';

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

$envFile = dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . '.env';

$dotenv = loadDotEnv($envFile);

$decartApiKey =
    getenv('DECART_API_KEY') ?:
    ($dotenv['DECART_API_KEY'] ?? '');

$decartApiKey = trim((string) $decartApiKey);

if ($decartApiKey === '') {
    echo json_encode([
        'success' => false,
        'error' => 'DECART_API_KEY not found'
    ], JSON_PRETTY_PRINT);

    exit;
}

$payload = [
    'expiresIn' => 300,
    'allowedModels' => [
        'lucy-2.1'
    ],
    'metadata' => [
        'product' => 'AIStudio',
        'feature' => 'live-studio',
        'test' => true
    ]
];

$jsonPayload = json_encode(
    $payload,
    JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
);

$ch = curl_init(
    'https://api.decart.ai/v1/client/tokens'
);

apply_dns_workaround($ch, 'api.decart.ai');

curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        'Content-Type: application/json',
        'Accept: application/json',
        'x-api-key: ' . $decartApiKey
    ],
    CURLOPT_POSTFIELDS => $jsonPayload,
    CURLOPT_CONNECTTIMEOUT => 15,
    CURLOPT_TIMEOUT => 30,
    CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_2TLS
]);

$response = curl_exec($ch);

$result = [
    'curl_errno' => curl_errno($ch),
    'curl_error' => curl_error($ch),
    'http_status' => curl_getinfo($ch, CURLINFO_HTTP_CODE),
    'primary_ip' => curl_getinfo($ch, CURLINFO_PRIMARY_IP),
    'local_ip' => curl_getinfo($ch, CURLINFO_LOCAL_IP),
    'connect_time' => curl_getinfo($ch, CURLINFO_CONNECT_TIME),
    'total_time' => curl_getinfo($ch, CURLINFO_TOTAL_TIME),
    'response_received' => $response !== false,
    'response_length' => is_string($response) ? strlen($response) : 0
];

curl_close($ch);

echo json_encode(
    $result,
    JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES
);