<?php
// Temporary diagnostic file — safe to delete once the real bug is found.
header('Content-Type: application/json');

$method = $_SERVER['REQUEST_METHOD'] ?? 'UNKNOWN';
$contentLength = $_SERVER['CONTENT_LENGTH'] ?? 'not set';
$postDataSize = isset($_POST) ? count($_POST) : 0;
$filesReceived = isset($_FILES) ? count($_FILES) : 0;

echo json_encode([
    'success' => true,
    'method' => $method,
    'content_length_header' => $contentLength,
    'post_field_count' => $postDataSize,
    'files_received' => $filesReceived,
    'raw_post_body_size' => strlen(file_get_contents('php://input')),
]);
