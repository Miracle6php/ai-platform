<?php

/**
 * backend/voice/transform.php — ElevenLabs Speech-to-Speech
 *
 * AUDIO mode (synchronous, unchanged): upload MP3 -> ElevenLabs ->
 * result returned in the same response.
 *
 * VIDEO mode (asynchronous): the slow work (extract audio, ElevenLabs,
 * re-mux) can exceed the hosting proxy's request timeout, so it now
 * follows the same pattern as Face Studio:
 *
 *   action=submit  -> validates, saves the upload, creates a job row,
 *                     starts process-video-job.php in the background,
 *                     and returns a job_id immediately.
 *   action=status  -> polled by the browser; reports progress and, when
 *                     finished, the result URL.
 *   action=download-> serves the finished file.
 *
 * NOTE: this does not lip-sync the video. Speech-to-Speech keeps the
 * original words/timing, so mouth movement stays close but is not
 * regenerated. Lip-sync (Sync Labs) is a later feature.
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

$userId = (int) $_SESSION['user_id'];

// Release the session lock so polling requests are never blocked
// behind a long-running request from the same user.
session_write_close();

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/env.php';
require_once __DIR__ . '/../config/dns_workaround.php';
require_once __DIR__ . '/media-helpers.php';

const MAX_AUDIO_SIZE = 5 * 1024 * 1024;
const MAX_VIDEO_SIZE = 25 * 1024 * 1024;
const MAX_VIDEO_DURATION_SECONDS = 120;

const UPLOAD_DIR = __DIR__ . '/../../storage/voice_uploads/';
const RESULT_DIR = __DIR__ . '/../../storage/voice_results/';
const WORK_DIR = __DIR__ . '/../../storage/voice_work/';

const ALLOWED_VOICE_IDS = ['voice-01', 'voice-02', 'voice-03', 'voice-04'];

const ALLOWED_VIDEO_MIMES = [
    'video/mp4',
    'video/quicktime',
    'video/webm',
];

$libraryVoicesConfig = require __DIR__ . '/library-voices-config.php';

foreach ([UPLOAD_DIR, RESULT_DIR, WORK_DIR] as $dir) {
    if (!is_dir($dir)) {
        mkdir($dir, 0750, true);
    }
}

$action = $_GET['action'] ?? $_POST['action'] ?? 'submit';

function fail(int $code, string $message): void
{
    http_response_code($code);
    echo json_encode(['error' => $message]);
    exit;
}

// =======================================================================
// ACTION: submit
// =======================================================================

if ($action === 'submit') {

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        fail(405, 'Method not allowed');
    }

    $mediaMode = $_POST['media_mode'] ?? 'audio';

    if (!in_array($mediaMode, ['audio', 'video'], true)) {
        fail(400, 'Invalid media mode.');
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

    $jobId = newUuid();

    // ===================================================================
    // VIDEO MODE — validate fast, queue the job, return immediately
    // ===================================================================

    if ($mediaMode === 'video') {

        if (!isset($_FILES['source_video'])) {
            fail(400, 'Source video is required.');
        }

        $file = $_FILES['source_video'];

        if ($file['error'] !== UPLOAD_ERR_OK) {
            fail(400, 'Upload failed.');
        }

        if ($file['size'] > MAX_VIDEO_SIZE) {
            fail(400, 'Source video must be 25 MB or smaller.');
        }

        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $videoMime = finfo_file($finfo, $file['tmp_name']);
        finfo_close($finfo);

        if (!in_array($videoMime, ALLOWED_VIDEO_MIMES, true)) {
            fail(400, 'Unsupported video format. Use MP4, MOV, or WEBM.');
        }

        $videoExtension = match ($videoMime) {
            'video/mp4' => 'mp4',
            'video/quicktime' => 'mov',
            'video/webm' => 'webm',
            default => 'mp4',
        };

        $sourceVideoPath = UPLOAD_DIR . $jobId . '.' . $videoExtension;

        if (!move_uploaded_file($file['tmp_name'], $sourceVideoPath)) {
            fail(500, 'Could not store uploaded file.');
        }

        // ffprobe only reads the file header — fast, safe to do here.
        $videoDuration = probeDurationSeconds($sourceVideoPath);

        if ($videoDuration <= 0) {
            @unlink($sourceVideoPath);
            fail(400, 'Could not read video duration. The file may be corrupt.');
        }

        if ($videoDuration > MAX_VIDEO_DURATION_SECONDS) {
            @unlink($sourceVideoPath);
            fail(400, 'Video must be ' . (int) (MAX_VIDEO_DURATION_SECONDS / 60) . ' minutes or shorter.');
        }

        $estimatedCredits = estimateVoiceCredits($videoDuration, $quality);

        // Early balance check for fast feedback. Credits are only
        // actually deducted by the worker once the job succeeds.
        $stmt = $conn->prepare('SELECT credits_balance FROM users WHERE id = ? LIMIT 1');
        $stmt->bind_param('i', $userId);
        $stmt->execute();
        $balance = (float) ($stmt->get_result()->fetch_assoc()['credits_balance'] ?? 0);
        $stmt->close();

        if ($balance < $estimatedCredits) {
            @unlink($sourceVideoPath);
            fail(402, 'Not enough credits for this transformation.');
        }

        // ---- create the job row in 'processing' state ------------------

        $insertStmt = $conn->prepare("
            INSERT INTO voice_jobs (
                id, user_id, status, progress, status_message,
                source_audio_path, voice_mode, voice_id, clone_reference_id,
                quality, pitch, stability, credits_estimated, credits_charged,
                result_audio_path, media_mode
            ) VALUES (?, ?, 'processing', 5, 'Starting...',
                ?, ?, ?, ?, ?, ?, ?, ?, 0, '', 'video')
        ");

        $insertStmt->bind_param(
            'sisssssssi',
            $jobId, $userId, $sourceVideoPath, $voiceMode, $voiceId,
            $cloneReferenceId, $quality, $pitch, $stability,
            $estimatedCredits
        );

        if (!$insertStmt->execute()) {
            $insertStmt->close();
            @unlink($sourceVideoPath);
            fail(500, 'Could not create the job.');
        }

        $insertStmt->close();
        $conn->close();

        // ---- start the background worker --------------------------------

        $command = 'nohup '
            . escapeshellarg(PHP_BINARY) . ' '
            . escapeshellarg(__DIR__ . '/process-video-job.php') . ' '
            . escapeshellarg($jobId)
            . ' > /dev/null 2>&1 &';

        exec($command);

        echo json_encode([
            'job_id' => $jobId,
            'status' => 'processing',
            'progress' => 5,
            'message' => 'Starting...',
            'media_mode' => 'video',
        ]);
        exit;
    }

    // ===================================================================
    // AUDIO MODE (synchronous, unchanged)
    // ===================================================================

    if (!isset($_FILES['source_audio'])) {
        fail(400, 'Source audio is required.');
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

    try {
        $result = elevenLabsSpeechToSpeech($sourcePath, $elevenVoiceId, $stability);
    } catch (RuntimeException $e) {
        fail(502, $e->getMessage());
    }

    $resultPath = RESULT_DIR . $jobId . '.mp3';
    file_put_contents($resultPath, $result['audio_bytes']);

    applyPitchShift($resultPath, $pitch);

    $credits = $estimatedCredits;

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
            result_audio_path, media_mode, completed_at
        ) VALUES (?, ?, 'completed', 100, 'Voice transformation completed.',
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'audio', NOW())
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
        'media_mode' => 'audio',
        'result_url' => '/backend/voice/transform.php?action=download&job_id=' . urlencode($jobId),
        'credits_charged' => $credits,
        'credits_balance' => $newBalance,
    ]);
    exit;
}

// =======================================================================
// ACTION: status (polled by the browser for video jobs)
// =======================================================================

if ($action === 'status') {

    $jobId = $_GET['job_id'] ?? '';

    $stmt = $conn->prepare("
        SELECT status, progress, status_message, media_mode, credits_charged
        FROM voice_jobs
        WHERE id = ? AND user_id = ?
        LIMIT 1
    ");
    $stmt->bind_param('si', $jobId, $userId);
    $stmt->execute();
    $job = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if (!$job) {
        $conn->close();
        fail(404, 'Job not found.');
    }

    $response = [
        'job_id' => $jobId,
        'status' => $job['status'],
        'progress' => (int) $job['progress'],
        'message' => $job['status_message'],
        'media_mode' => $job['media_mode'],
    ];

    if ($job['status'] === 'completed') {

        $balStmt = $conn->prepare('SELECT credits_balance FROM users WHERE id = ? LIMIT 1');
        $balStmt->bind_param('i', $userId);
        $balStmt->execute();
        $balance = (float) ($balStmt->get_result()->fetch_assoc()['credits_balance'] ?? 0);
        $balStmt->close();

        $response['result_url'] = '/backend/voice/transform.php?action=download&job_id=' . urlencode($jobId);
        $response['credits_charged'] = (int) $job['credits_charged'];
        $response['credits_balance'] = $balance;
    }

    $conn->close();

    echo json_encode($response);
    exit;
}

// =======================================================================
// ACTION: download
// =======================================================================

if ($action === 'download') {

    $jobId = $_GET['job_id'] ?? '';

    $stmt = $conn->prepare("
        SELECT result_audio_path, media_mode
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

    $isVideo = ($job['media_mode'] ?? 'audio') === 'video';

    if ($isVideo) {
        header('Content-Type: video/mp4');
        header('Content-Disposition: inline; filename="aistudio-voice-result.mp4"');
    } else {
        header('Content-Type: audio/mpeg');
        header('Content-Disposition: inline; filename="aistudio-voice-result.mp3"');
    }

    header('Content-Length: ' . filesize($job['result_audio_path']));
    readfile($job['result_audio_path']);
    exit;
}

fail(400, 'Unknown action.');
