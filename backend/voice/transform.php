<?php

/**
 * backend/voice/transform.php — ElevenLabs Speech-to-Speech version
 *
 * No Python service, no job queue. Flow:
 *   1. Receive source audio upload
 *   2. Resolve the chosen voice to an ElevenLabs voice_id
 *        - library mode -> from library-voices-config.php
 *        - clone mode   -> the elevenlabs_voice_id stored when the
 *                          user's sample was cloned in clone.php
 *   3. POST the source audio to ElevenLabs' /speech-to-speech/{voice_id}
 *   4. Get converted audio back in the same response
 *   5. Apply local pitch shift via ffmpeg if requested (ElevenLabs has
 *      no pitch parameter of its own)
 *   6. Save, charge credits, return the result URL
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
const UPLOAD_DIR = __DIR__ . '/../../storage/voice_uploads/';
const RESULT_DIR = __DIR__ . '/../../storage/voice_results/';
const ALLOWED_VOICE_IDS = ['voice-01', 'voice-02', 'voice-03', 'voice-04'];

/**
 * Shared with voice-studio.php via library-voices-config.php — fill in
 * real elevenlabs_voice_id values there (run list-available-voices.php
 * first to get them).
 */
$libraryVoicesConfig = require __DIR__ . '/library-voices-config.php';

foreach ([UPLOAD_DIR, RESULT_DIR] as $dir) {
    if (!is_dir($dir)) {
        mkdir($dir, 0750, true);
    }
}

$userId = (int) $_SESSION['user_id'];
$action = $_GET['action'] ?? $_POST['action'] ?? 'submit';

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

function estimateVoiceCredits(float $durationSeconds, string $quality): int
{
    $credits = max(5, (int) ceil($durationSeconds / 10));
    if ($quality === 'high') {
        $credits = (int) ceil($credits * 1.5);
    } elseif ($quality === 'premium') {
        $credits = (int) ceil($credits * 2);
    }
    return $credits;
}

function newUuid(): string
{
    return sprintf(
        '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
        mt_rand(0, 0xffff), mt_rand(0, 0xffff),
        mt_rand(0, 0xffff),
        mt_rand(0, 0x0fff) | 0x4000,
        mt_rand(0, 0x3fff) | 0x8000,
        mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
    );
}

/**
 * Applies a pitch shift to an existing audio file in place, using
 * ffmpeg's asetrate/atempo trick (changes pitch while correcting
 * playback speed back to normal). Requires ffmpeg on the server.
 *
 * 'lower'/'higher' map to roughly a minor third (-3/+3 semitones).
 */
function applyPitchShift(string $path, string $pitch): void
{
    if ($pitch === 'natural') {
        return;
    }

    $semitoneShift = $pitch === 'higher' ? 3 : -3;
    $rateFactor = pow(2, $semitoneShift / 12);
    $atempoFactor = 1 / $rateFactor;

    $filter = sprintf(
        'asetrate=44100*%F,aresample=44100,atempo=%F',
        $rateFactor,
        $atempoFactor
    );

    $tempPath = $path . '.pitched.mp3';
    $escapedInput = escapeshellarg($path);
    $escapedOutput = escapeshellarg($tempPath);
    $escapedFilter = escapeshellarg($filter);

    $command = "ffmpeg -y -i $escapedInput -af $escapedFilter -codec:a libmp3lame -q:a 2 $escapedOutput 2>&1";
    exec($command, $output, $exitCode);

    if ($exitCode === 0 && file_exists($tempPath)) {
        rename($tempPath, $path);
    } else {
        // Non-fatal — ship the unshifted result rather than fail the
        // whole job over a cosmetic setting.
        @unlink($tempPath);
    }
}

/**
 * Calls ElevenLabs Speech-to-Speech: your audio in, converted audio out.
 * Returns ['audio_bytes' => string].
 */
function elevenLabsSpeechToSpeech(string $sourcePath, string $voiceId, string $stability): array
{
    $stabilityMap = [
        'stable' => 0.75,
        'balanced' => 0.5,
        'expressive' => 0.25,
    ];
    $stabilityValue = $stabilityMap[$stability] ?? 0.5;

    $voiceSettings = json_encode([
        'stability' => $stabilityValue,
        'similarity_boost' => 0.75,
    ]);

    $ch = curl_init(
        'https://api.elevenlabs.io/v1/speech-to-speech/' . urlencode($voiceId)
        . '?output_format=mp3_44100_128'
    );
    apply_dns_workaround($ch, 'api.elevenlabs.io');

    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => [
            'audio' => new CURLFile($sourcePath, 'audio/mpeg', 'source.mp3'),
            'model_id' => 'eleven_multilingual_sts_v2',
            'voice_settings' => $voiceSettings,
        ],
        CURLOPT_HTTPHEADER => ['xi-api-key: ' . elevenLabsApiKey()],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 120,
        CURLOPT_HEADER => false,
    ]);

    $response = curl_exec($ch);

    if ($response === false) {
        $error = curl_error($ch);
        curl_close($ch);
        throw new RuntimeException("Could not reach ElevenLabs: $error");
    }

    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $contentType = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
    curl_close($ch);

    if ($httpCode !== 200) {
        $data = json_decode($response, true);
        $detail = $data['detail']['message'] ?? $response;
        throw new RuntimeException("ElevenLabs conversion failed (HTTP $httpCode): $detail");
    }

    if (strpos((string) $contentType, 'audio') === false) {
        throw new RuntimeException('Unexpected response from ElevenLabs (not audio).');
    }

    return ['audio_bytes' => $response];
}

// =======================================================================
// ACTION: submit
// =======================================================================

if ($action === 'submit') {

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        fail(405, 'Method not allowed');
    }

    if (!isset($_FILES['source_audio'])) {
        fail(400, 'Source audio is required.');
    }

    $voiceMode = $_POST['voice_mode'] ?? '';
    if (!in_array($voiceMode, ['library', 'clone'], true)) {
        fail(400, 'Invalid voice mode.');
    }

    $elevenVoiceId = null;
    $voiceId = null;
    $cloneReferenceId = null;

    if ($voiceMode === 'library') {

        $voiceId = $_POST['voice_id'] ?? '';
        if (!in_array($voiceId, ALLOWED_VOICE_IDS, true)) {
            fail(400, 'Invalid voice selection.');
        }

        $elevenVoiceId = $libraryVoicesConfig[$voiceId]['elevenlabs_voice_id'] ?? '';

        if ($elevenVoiceId === '' || strpos($elevenVoiceId, 'REPLACE_WITH') === 0) {
            fail(500, 'This library voice is not configured yet — set a real ElevenLabs voice_id for ' . $voiceId . ' in library-voices-config.php.');
        }

    } else {

        $cloneReferenceId = $_POST['clone_reference_id'] ?? '';
        if ($cloneReferenceId === '') {
            fail(400, 'clone_reference_id is required for clone mode. Upload a sample via clone.php first.');
        }

        $stmt = $conn->prepare("
            SELECT elevenlabs_voice_id FROM voice_clone_references
            WHERE id = ? AND user_id = ? LIMIT 1
        ");
        $stmt->bind_param('si', $cloneReferenceId, $userId);
        $stmt->execute();
        $ref = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        if (!$ref || !$ref['elevenlabs_voice_id']) {
            fail(404, 'Clone reference not found or not yet processed.');
        }

        $elevenVoiceId = $ref['elevenlabs_voice_id'];
    }

    $quality = $_POST['quality'] ?? 'standard';
    $pitch = $_POST['pitch'] ?? 'natural';
    $stability = $_POST['stability'] ?? 'balanced';

    if (!in_array($quality, ['standard', 'high', 'premium'], true)) {
        fail(400, 'Invalid quality setting.');
    }
    if (!in_array($pitch, ['natural', 'lower', 'higher'], true)) {
        fail(400, 'Invalid pitch setting.');
    }
    if (!in_array($stability, ['balanced', 'stable', 'expressive'], true)) {
        fail(400, 'Invalid stability setting.');
    }

    $file = $_FILES['source_audio'];

    if ($file['error'] !== UPLOAD_ERR_OK) {
        fail(400, 'Upload failed.');
    }
    if ($file['size'] > MAX_AUDIO_SIZE) {
        fail(400, 'Source audio must be 5 MB or smaller.');
    }

    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mime = finfo_file($finfo, $file['tmp_name']);
    finfo_close($finfo);

    if ($mime !== 'audio/mpeg') {
        fail(400, 'Source file must be a valid MP3.');
    }

    $jobId = newUuid();
    $sourcePath = UPLOAD_DIR . $jobId . '.mp3';

    if (!move_uploaded_file($file['tmp_name'], $sourcePath)) {
        fail(500, 'Could not store uploaded file.');
    }

    $roughDuration = max(1.0, $file['size'] / (128 * 1024 / 8));
    $estimatedCredits = estimateVoiceCredits($roughDuration, $quality);

    $stmt = $conn->prepare('SELECT credits_balance FROM users WHERE id = ? LIMIT 1');
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $balance = (float) ($stmt->get_result()->fetch_assoc()['credits_balance'] ?? 0);
    $stmt->close();

    if ($balance < $estimatedCredits) {
        fail(402, 'Not enough credits for this transformation.');
    }

    // ---- call ElevenLabs --------------------------------------------

    try {
        $result = elevenLabsSpeechToSpeech($sourcePath, $elevenVoiceId, $stability);
    } catch (RuntimeException $e) {
        fail(502, $e->getMessage());
    }

    $resultPath = RESULT_DIR . $jobId . '.mp3';
    file_put_contents($resultPath, $result['audio_bytes']);

    applyPitchShift($resultPath, $pitch);

    // ElevenLabs doesn't hand back exact output duration in headers for
    // this endpoint, so credits are computed from the source estimate.
    $credits = $estimatedCredits;

    // ---- deduct credits + record the job -----------------------------

    $conn->begin_transaction();

    $lockStmt = $conn->prepare('SELECT credits_balance FROM users WHERE id = ? FOR UPDATE');
    $lockStmt->bind_param('i', $userId);
    $lockStmt->execute();
    $currentBalance = (float) $lockStmt->get_result()->fetch_assoc()['credits_balance'];
    $lockStmt->close();

    if ($currentBalance < $credits) {
        $conn->rollback();
        @unlink($resultPath);
        fail(402, 'Not enough credits to complete this transformation.');
    }

    $deductStmt = $conn->prepare('UPDATE users SET credits_balance = credits_balance - ? WHERE id = ?');
    $deductStmt->bind_param('di', $credits, $userId);
    $deductStmt->execute();
    $deductStmt->close();

    $insertStmt = $conn->prepare("
        INSERT INTO voice_jobs (
            id, user_id, status, progress, status_message,
            source_audio_path, voice_mode, voice_id, clone_reference_id,
            quality, pitch, stability, credits_estimated, credits_charged,
            result_audio_path, completed_at
        ) VALUES (?, ?, 'completed', 100, 'Voice transformation completed.',
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    ");

    $insertStmt->bind_param(
        'sisssssssiis',
        $jobId, $userId, $sourcePath, $voiceMode, $voiceId,
        $cloneReferenceId, $quality, $pitch, $stability,
        $estimatedCredits, $credits, $resultPath
    );
    $insertStmt->execute();
    $insertStmt->close();

    $conn->commit();

    $newBalance = $currentBalance - $credits;
    $conn->close();

    echo json_encode([
        'job_id' => $jobId,
        'status' => 'completed',
        'progress' => 100,
        'message' => 'Voice transformation completed.',
        'result_url' => '/backend/voice/transform.php?action=download&job_id=' . urlencode($jobId),
        'credits_charged' => $credits,
        'credits_balance' => $newBalance,
    ]);
    exit;
}

// =======================================================================
// ACTION: download
// =======================================================================

if ($action === 'download') {

    $jobId = $_GET['job_id'] ?? '';

    $stmt = $conn->prepare("
        SELECT result_audio_path
        FROM voice_jobs
        WHERE id = ? AND user_id = ? AND status = 'completed'
        LIMIT 1
    ");
    $stmt->bind_param('si', $jobId, $userId);
    $stmt->execute();
    $job = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    $conn->close();

    if (!$job || !$job['result_audio_path'] || !file_exists($job['result_audio_path'])) {
        http_response_code(404);
        exit;
    }

    header('Content-Type: audio/mpeg');
    header('Content-Disposition: inline; filename="aistudio-voice-result.mp3"');
    header('Content-Length: ' . filesize($job['result_audio_path']));
    readfile($job['result_audio_path']);
    exit;
}

fail(400, 'Unknown action.');
