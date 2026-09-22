<?php

/**
 * backend/voice/clone.php — ElevenLabs version
 *
 * On upload, registers the voice with ElevenLabs (POST /v1/voices/add)
 * and stores the returned voice_id. transform.php uses that voice_id
 * directly for conversion.
 */

session_start();
header('Content-Type: application/json');

if (
    !isset($_SESSION['logged_in']) ||
    $_SESSION['logged_in'] !== true ||
    !isset($_SESSION['user_id'])
) {
    http_response_code(401);
    echo json_encode(['error' => 'Not authenticated']);
    exit;
}

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/env.php';
require_once __DIR__ . '/../config/dns_workaround.php';

const MAX_AUDIO_SIZE = 5 * 1024 * 1024;
const UPLOAD_DIR = __DIR__ . '/../../storage/voice_clones/';

if (!is_dir(UPLOAD_DIR)) {
    mkdir(UPLOAD_DIR, 0750, true);
}

$userId = (int) $_SESSION['user_id'];
$method = $_SERVER['REQUEST_METHOD'];

function fail(int $code, string $message): void
{
    http_response_code($code);
    echo json_encode(['error' => $message]);
    exit;
}

function elevenLabsApiKey(): string
{
    $key = getenv('ELEVENLABS_API_KEY');
    if (!$key) {
        fail(500, 'Server misconfigured: ELEVENLABS_API_KEY is not set.');
    }
    return $key;
}

/**
 * Registers a voice sample with ElevenLabs, returns their voice_id.
 */
function elevenLabsCloneVoice(string $audioPath, string $label): string
{
    $ch = curl_init('https://api.elevenlabs.io/v1/voices/add');
    apply_dns_workaround($ch, 'api.elevenlabs.io');

    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => [
            'name' => $label,
            'files' => new CURLFile($audioPath, 'audio/mpeg', 'sample.mp3'),
        ],
        CURLOPT_HTTPHEADER => ['xi-api-key: ' . elevenLabsApiKey()],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 60,
    ]);

    $response = curl_exec($ch);

    if ($response === false) {
        $error = curl_error($ch);
        curl_close($ch);
        throw new RuntimeException("Could not reach ElevenLabs: $error");
    }

    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $data = json_decode($response, true);

    if ($httpCode !== 200 || !isset($data['voice_id'])) {
        $detail = $data['detail']['message'] ?? $response;
        throw new RuntimeException("ElevenLabs voice cloning failed: $detail");
    }

    return $data['voice_id'];
}

function elevenLabsDeleteVoice(string $voiceId): void
{
    $ch = curl_init('https://api.elevenlabs.io/v1/voices/' . urlencode($voiceId));
    apply_dns_workaround($ch, 'api.elevenlabs.io');

    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST => 'DELETE',
        CURLOPT_HTTPHEADER => ['xi-api-key: ' . elevenLabsApiKey()],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 30,
    ]);

    curl_exec($ch);
    curl_close($ch);
    // Best-effort — if this fails, the voice is orphaned on ElevenLabs'
    // side but that's not fatal to your app.
}

// ---- GET: list this user's saved clone references -------------------

if ($method === 'GET') {

    $stmt = $conn->prepare("
        SELECT id, label, elevenlabs_voice_id, duration_seconds, created_at
        FROM voice_clone_references
        WHERE user_id = ?
        ORDER BY created_at DESC
    ");
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();
    $conn->close();

    echo json_encode(['references' => $rows]);
    exit;
}

// ---- DELETE: remove a saved reference (both locally and on ElevenLabs) --

if ($method === 'DELETE') {

    parse_str(file_get_contents('php://input'), $body);
    $refId = $body['reference_id'] ?? ($_GET['reference_id'] ?? '');

    if ($refId === '') {
        fail(400, 'reference_id is required.');
    }

    $stmt = $conn->prepare("
        SELECT audio_path, elevenlabs_voice_id FROM voice_clone_references
        WHERE id = ? AND user_id = ? LIMIT 1
    ");
    $stmt->bind_param('si', $refId, $userId);
    $stmt->execute();
    $ref = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if (!$ref) {
        fail(404, 'Reference not found.');
    }

    $del = $conn->prepare("DELETE FROM voice_clone_references WHERE id = ? AND user_id = ?");
    $del->bind_param('si', $refId, $userId);
    $del->execute();
    $del->close();
    $conn->close();

    if ($ref['elevenlabs_voice_id']) {
        elevenLabsDeleteVoice($ref['elevenlabs_voice_id']);
    }

    if (file_exists($ref['audio_path'])) {
        @unlink($ref['audio_path']);
    }

    echo json_encode(['deleted' => true]);
    exit;
}

// ---- POST: upload a new reference sample + clone via ElevenLabs -----

if ($method !== 'POST') {
    fail(405, 'Method not allowed');
}

if (!isset($_FILES['clone_audio'])) {
    fail(400, 'clone_audio file is required.');
}

$file = $_FILES['clone_audio'];

if ($file['error'] !== UPLOAD_ERR_OK) {
    fail(400, 'Upload failed.');
}

if ($file['size'] > MAX_AUDIO_SIZE) {
    fail(400, 'Voice sample must be 5 MB or smaller.');
}

$finfo = finfo_open(FILEINFO_MIME_TYPE);
$mime = finfo_file($finfo, $file['tmp_name']);
finfo_close($finfo);

if ($mime !== 'audio/mpeg') {
    fail(400, 'File must be a valid MP3.');
}

$refId = sprintf(
    '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
    mt_rand(0, 0xffff), mt_rand(0, 0xffff),
    mt_rand(0, 0xffff),
    mt_rand(0, 0x0fff) | 0x4000,
    mt_rand(0, 0x3fff) | 0x8000,
    mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
);

$destination = UPLOAD_DIR . $refId . '.mp3';

if (!move_uploaded_file($file['tmp_name'], $destination)) {
    fail(500, 'Could not store uploaded file.');
}

// FIX: was `: null` here before — null !== '' is TRUE in PHP, so the
// fallback default label below never actually got assigned, and a
// null reached elevenLabsCloneVoice()'s string $label parameter,
// causing a fatal TypeError. Starting from '' instead fixes it.
$label = isset($_POST['label']) ? trim($_POST['label']) : '';
$label = $label !== '' ? $label : ('AIStudio Clone ' . substr($refId, 0, 8));

// ---- clone with ElevenLabs --------------------------------------------

try {
    $elevenVoiceId = elevenLabsCloneVoice($destination, $label);
} catch (RuntimeException $e) {
    @unlink($destination);
    fail(502, $e->getMessage());
}

$stmt = $conn->prepare("
    INSERT INTO voice_clone_references (id, user_id, audio_path, elevenlabs_voice_id, label)
    VALUES (?, ?, ?, ?, ?)
");
$stmt->bind_param('sisss', $refId, $userId, $destination, $elevenVoiceId, $label);
$stmt->execute();
$stmt->close();
$conn->close();

echo json_encode([
    'reference_id' => $refId,
    'label' => $label,
]);
