<?php

/**
 * backend/voice/process-video-job.php
 *
 * Runs as a detached background process (spawned by transform.php via
 * exec(... "&")), NOT as a normal web request. Does the actual slow
 * work for a video voice-swap job:
 *
 *   1. Extract audio from the uploaded video (ffmpeg)
 *   2. Convert that audio via ElevenLabs Speech-to-Speech
 *   3. Apply pitch shift if requested
 *   4. Re-mux the converted audio onto the original video (ffmpeg)
 *   5. Deduct credits and mark the job completed
 *
 * Progress is written to the voice_jobs row at each stage so
 * transform.php?action=status can report it back to the browser.
 *
 * Usage: php process-video-job.php <job_id>
 */

if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    exit('This script may only be run from the command line.');
}

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/env.php';
require_once __DIR__ . '/../config/dns_workaround.php';
require_once __DIR__ . '/media-helpers.php';

const RESULT_DIR = __DIR__ . '/../../storage/voice_results/';
const WORK_DIR = __DIR__ . '/../../storage/voice_work/';

foreach ([RESULT_DIR, WORK_DIR] as $dir) {
    if (!is_dir($dir)) {
        mkdir($dir, 0750, true);
    }
}

set_time_limit(0);

$jobId = $argv[1] ?? null;

if (!$jobId) {
    error_log('process-video-job.php: no job_id provided');
    exit(1);
}

function updateJob(mysqli $conn, string $jobId, array $fields): void
{
    $sets = [];
    $params = [];
    $types = '';

    foreach ($fields as $column => $value) {
        $sets[] = "$column = ?";
        $params[] = $value;
        $types .= is_int($value) ? 'i' : 's';
    }

    $params[] = $jobId;
    $types .= 's';

    $sql = 'UPDATE voice_jobs SET ' . implode(', ', $sets) . ' WHERE id = ?';
    $stmt = $conn->prepare($sql);
    $stmt->bind_param($types, ...$params);
    $stmt->execute();
    $stmt->close();
}

function failJob(mysqli $conn, string $jobId, string $message): void
{
    updateJob($conn, $jobId, [
        'status' => 'failed',
        'status_message' => $message,
    ]);
    error_log("process-video-job.php: job $jobId failed: $message");
}

// ---- load the job row -------------------------------------------------

$stmt = $conn->prepare("
    SELECT user_id, source_audio_path, voice_mode, voice_id,
           clone_reference_id, quality, pitch, stability, credits_estimated
    FROM voice_jobs
    WHERE id = ?
    LIMIT 1
");
$stmt->bind_param('s', $jobId);
$stmt->execute();
$job = $stmt->get_result()->fetch_assoc();
$stmt->close();

if (!$job) {
    error_log("process-video-job.php: job $jobId not found");
    exit(1);
}

$userId = (int) $job['user_id'];
$sourceVideoPath = $job['source_audio_path'];
$voiceMode = $job['voice_mode'];
$voiceId = $job['voice_id'];
$cloneReferenceId = $job['clone_reference_id'];
$pitch = $job['pitch'];
$stability = $job['stability'];
$estimatedCredits = (int) $job['credits_estimated'];

// ---- resolve the ElevenLabs voice_id -----------------------------------

try {

    if ($voiceMode === 'library') {

        $libraryVoicesConfig = require __DIR__ . '/library-voices-config.php';
        $elevenVoiceId = $libraryVoicesConfig[$voiceId]['elevenlabs_voice_id'] ?? '';

        if ($elevenVoiceId === '' || strpos($elevenVoiceId, 'REPLACE_WITH') === 0) {
            throw new RuntimeException('This library voice is not configured yet.');
        }

    } else {

        $stmt = $conn->prepare("
            SELECT elevenlabs_voice_id FROM voice_clone_references
            WHERE id = ? AND user_id = ? LIMIT 1
        ");
        $stmt->bind_param('si', $cloneReferenceId, $userId);
        $stmt->execute();
        $ref = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        if (!$ref || !$ref['elevenlabs_voice_id']) {
            throw new RuntimeException('Clone reference not found or not yet processed.');
        }

        $elevenVoiceId = $ref['elevenlabs_voice_id'];
    }

} catch (RuntimeException $e) {
    failJob($conn, $jobId, $e->getMessage());
    exit(1);
}

// ---- stage 1: extract audio --------------------------------------------

updateJob($conn, $jobId, [
    'status' => 'processing',
    'progress' => 20,
    'status_message' => 'Extracting audio from video...',
]);

$extractedAudioPath = WORK_DIR . $jobId . '.extracted.mp3';

if (!extractAudioFromVideo($sourceVideoPath, $extractedAudioPath)) {
    failJob($conn, $jobId, 'Could not extract audio from the video. It may have no audio track.');
    exit(1);
}

// ---- stage 2: convert via ElevenLabs ------------------------------------

updateJob($conn, $jobId, [
    'progress' => 45,
    'status_message' => 'Converting voice with AI...',
]);

try {
    $result = elevenLabsSpeechToSpeech($extractedAudioPath, $elevenVoiceId, $stability);
} catch (RuntimeException $e) {
    @unlink($extractedAudioPath);
    failJob($conn, $jobId, $e->getMessage());
    exit(1);
}

$convertedAudioPath = WORK_DIR . $jobId . '.converted.mp3';
file_put_contents($convertedAudioPath, $result['audio_bytes']);

applyPitchShift($convertedAudioPath, $pitch);

// ---- stage 3: re-mux onto original video --------------------------------

updateJob($conn, $jobId, [
    'progress' => 80,
    'status_message' => 'Combining new audio with your video...',
]);

$resultVideoPath = RESULT_DIR . $jobId . '.mp4';

if (!remuxAudioOntoVideo($sourceVideoPath, $convertedAudioPath, $resultVideoPath)) {
    @unlink($extractedAudioPath);
    @unlink($convertedAudioPath);
    failJob($conn, $jobId, 'Could not combine the new audio with the video.');
    exit(1);
}

@unlink($extractedAudioPath);
@unlink($convertedAudioPath);

// ---- deduct credits + mark completed ------------------------------------

$conn->begin_transaction();

$lockStmt = $conn->prepare('SELECT credits_balance FROM users WHERE id = ? FOR UPDATE');
$lockStmt->bind_param('i', $userId);
$lockStmt->execute();
$currentBalance = (float) $lockStmt->get_result()->fetch_assoc()['credits_balance'];
$lockStmt->close();

if ($currentBalance < $estimatedCredits) {
    $conn->rollback();
    @unlink($resultVideoPath);
    failJob($conn, $jobId, 'Not enough credits to complete this transformation.');
    exit(1);
}

$deductStmt = $conn->prepare('UPDATE users SET credits_balance = credits_balance - ? WHERE id = ?');
$deductStmt->bind_param('di', $estimatedCredits, $userId);
$deductStmt->execute();
$deductStmt->close();

$completeStmt = $conn->prepare("
    UPDATE voice_jobs
    SET status = 'completed',
        progress = 100,
        status_message = 'Voice transformation completed.',
        credits_charged = ?,
        result_audio_path = ?,
        completed_at = NOW()
    WHERE id = ?
");
$completeStmt->bind_param('iss', $estimatedCredits, $resultVideoPath, $jobId);
$completeStmt->execute();
$completeStmt->close();

$conn->commit();
$conn->close();

exit(0);
