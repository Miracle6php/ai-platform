<?php

/**
 * backend/voice/transform.php — ElevenLabs Speech-to-Speech version
 *
 * Two source modes now:
 *
 *   AUDIO mode (unchanged):
 *     1. Receive source audio upload (MP3, max 5MB)
 *     2. Resolve chosen voice -> ElevenLabs voice_id
 *     3. POST straight to ElevenLabs /speech-to-speech/{voice_id}
 *     4. Apply local pitch shift via ffmpeg if requested
 *     5. Save, charge credits, return the result URL
 *
 *   VIDEO mode (new):
 *     1. Receive source video upload (MP4/MOV/WEBM, max 25MB, max 2 min)
 *     2. Extract the audio track with ffmpeg
 *     3. Run that extracted audio through the SAME ElevenLabs call as
 *        audio mode
 *     4. Re-mux the converted audio back onto the ORIGINAL video track
 *        with ffmpeg (video untouched, only the audio track is swapped)
 *     5. Save, charge credits, return the result URL (a video this time)
 *
 *   NOTE: this does NOT lip-sync the video — Speech-to-Speech keeps
 *   roughly the same timing/words as the original recording, so mouth
 *   movements should stay close, but they will not be regenerated to
 *   match the new audio frame-by-frame. That's a separate feature
 *   (Sync Labs) to be added later.
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

/**
 * Shared with voice-studio.php via library-voices-config.php — fill in
 * real elevenlabs_voice_id values there (run list-available-voices.php
 * first to get them).
 */
$libraryVoicesConfig = require __DIR__ . '/library-voices-config.php';

foreach ([UPLOAD_DIR, RESULT_DIR, WORK_DIR] as $dir) {
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
 * Runs an ffmpeg command, returns true on success. Logs stderr to the
 * PHP error log on failure so problems are visible without exposing
 * ffmpeg internals to the client.
 */
function runFfmpeg(string $command): bool
{
    exec($command, $output, $exitCode);

    if ($exitCode !== 0) {
        error_log('ffmpeg failed: ' . $command . "\n" . implode("\n", $output));
    }

    return $exitCode === 0;
}

/**
 * Reads duration in seconds for a media file via ffprobe.
 * Returns 0.0 if it can't be determined.
 */
function probeDurationSeconds(string $path): float
{
    $escapedPath = escapeshellarg($path);

    $command = "ffprobe -v error -show_entries format=duration "
        . "-of default=noprint_wrappers=1:nokey=1 $escapedPath";

    exec($command, $output, $exitCode);

    if ($exitCode !== 0 || empty($output)) {
        return 0.0;
    }

    return (float) trim($output[0]);
}

/**
 * Extracts the audio track from a video into a standalone MP3.
 * Returns true on success.
 */
function extractAudioFromVideo(string $videoPath, string $outputMp3Path): bool
{
    $escapedInput = escapeshellarg($videoPath);
    $escapedOutput = escapeshellarg($outputMp3Path);

    // -vn: drop video. -acodec libmp3lame: encode to mp3 so it matches
    // what elevenLabsSpeechToSpeech() already expects to upload.
    $command = "ffmpeg -y -i $escapedInput -vn -acodec libmp3lame "
        . "-q:a 2 $escapedOutput 2>&1";

    return runFfmpeg($command);
}

/**
 * Re-muxes a new audio track onto the original video's video stream.
 * Video is copied without re-encoding (fast, no quality loss); audio
 * is re-encoded to AAC for broad video-container compatibility.
 * If the new audio is shorter than the video, -shortest trims output
 * to the shorter of the two rather than leaving trailing silence/video
 * mismatch.
 */
function remuxAudioOntoVideo(string $videoPath, string $audioPath, string $outputPath): bool
{
    $escapedVideo = escapeshellarg($videoPath);
    $escapedAudio = escapeshellarg($audioPath);
    $escapedOutput = escapeshellarg($outputPath);

    $command = "ffmpeg -y -i $escapedVideo -i $escapedAudio "
        . "-map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 192k "
        . "-shortest $escapedOutput 2>&1";

    return runFfmpeg($command);
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

    // -------------------------------------------------------------
    // Determine media mode: 'audio' (existing) or 'video' (new).
    // Defaults to 'audio' so old clients that never send this field
    // keep working exactly as before.
    // -------------------------------------------------------------

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
    // VIDEO MODE
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

        // ---- duration check (real, via ffprobe — not client-trusted) ---

        $videoDuration = probeDurationSeconds($sourceVideoPath);

        if ($videoDuration <= 0) {
            @unlink($sourceVideoPath);
            fail(400, 'Could not read video duration. The file may be corrupt.');
        }

        if ($videoDuration > MAX_VIDEO_DURATION_SECONDS) {
            @unlink($sourceVideoPath);
            fail(400, 'Video must be ' . (int) (MAX_VIDEO_DURATION_SECONDS / 60) . ' minutes or shorter.');
        }

        // ---- credits check up front, before spending time on ffmpeg ---

        $estimatedCredits = estimateVoiceCredits($videoDuration, $quality);

        $stmt = $conn->prepare('SELECT credits_balance FROM users WHERE id = ? LIMIT 1');
        $stmt->bind_param('i', $userId);
        $stmt->execute();
        $balance = (float) ($stmt->get_result()->fetch_assoc()['credits_balance'] ?? 0);
        $stmt->close();

        if ($balance < $estimatedCredits) {
            @unlink($sourceVideoPath);
            fail(402, 'Not enough credits for this transformation.');
        }

        // ---- extract audio track ---------------------------------------

        $extractedAudioPath = WORK_DIR . $jobId . '.extracted.mp3';

        if (!extractAudioFromVideo($sourceVideoPath, $extractedAudioPath)) {
            @unlink($sourceVideoPath);
            fail(500, 'Could not extract audio from the video. It may have no audio track.');
        }

        // ---- convert extracted audio via ElevenLabs ----------------------

        try {
            $result = elevenLabsSpeechToSpeech($extractedAudioPath, $elevenVoiceId, $stability);
        } catch (RuntimeException $e) {
            @unlink($sourceVideoPath);
            @unlink($extractedAudioPath);
            fail(502, $e->getMessage());
        }

        $convertedAudioPath = WORK_DIR . $jobId . '.converted.mp3';
        file_put_contents($convertedAudioPath, $result['audio_bytes']);

        applyPitchShift($convertedAudioPath, $pitch);

        // ---- re-mux converted audio back onto the original video --------

        $resultVideoPath = RESULT_DIR . $jobId . '.mp4';

        if (!remuxAudioOntoVideo($sourceVideoPath, $convertedAudioPath, $resultVideoPath)) {
            @unlink($sourceVideoPath);
            @unlink($extractedAudioPath);
            @unlink($convertedAudioPath);
            fail(500, 'Could not combine the new audio with the video.');
        }

        // ---- cleanup work files (keep original upload + final result) ---

        @unlink($extractedAudioPath);
        @unlink($convertedAudioPath);

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
            @unlink($resultVideoPath);
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
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'video', NOW())
        ");

        $insertStmt->bind_param(
            'sisssssssiis',
            $jobId, $userId, $sourceVideoPath, $voiceMode, $voiceId,
            $cloneReferenceId, $quality, $pitch, $stability,
            $estimatedCredits, $credits, $resultVideoPath
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
            'media_mode' => 'video',
            'result_url' => '/backend/voice/transform.php?action=download&job_id=' . urlencode($jobId),
            'credits_charged' => $credits,
            'credits_balance' => $newBalance,
        ]);
        exit;
    }

    // ===================================================================
    // AUDIO MODE (unchanged from before)
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

    // ---- call ElevenLabs --------------------------------------------

    try {
        $result = elevenLabsSpeechToSpeech($sourcePath, $elevenVoiceId, $stability);
    } catch (RuntimeException $e) {
        fail(502, $e->getMessage());
    }

    $resultPath = RESULT_DIR . $jobId . '.mp3';
    file_put_contents($resultPath, $result['audio_bytes']);

    applyPitchShift($resultPath, $pitch);

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
