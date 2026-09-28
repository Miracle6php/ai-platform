<?php

/**
 * backend/voice/media-helpers.php
 *
 * Shared functions used by both transform.php (the web-facing
 * request handler) and process-video-job.php (the background CLI
 * worker). No HTTP-specific code lives here (no http_response_code,
 * no echo json_encode) so these are safe to call from a CLI script.
 */

function elevenLabsApiKeyOrThrow(): string
{
    $key = getenv('ELEVENLABS_API_KEY');
    if (!$key) {
        throw new RuntimeException('Server misconfigured: ELEVENLABS_API_KEY is not set.');
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
 * Runs an ffmpeg/ffprobe command, returns true on success. Logs
 * stderr to the PHP error log on failure.
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
 */
function extractAudioFromVideo(string $videoPath, string $outputMp3Path): bool
{
    $escapedInput = escapeshellarg($videoPath);
    $escapedOutput = escapeshellarg($outputMp3Path);

    $command = "ffmpeg -y -i $escapedInput -vn -acodec libmp3lame "
        . "-q:a 2 $escapedOutput 2>&1";

    return runFfmpeg($command);
}

/**
 * Re-muxes a new audio track onto the original video's video stream.
 * Video is copied without re-encoding (fast, no quality loss); audio
 * is re-encoded to AAC for broad video-container compatibility.
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
 * ffmpeg's asetrate/atempo trick. Non-fatal on failure -- ships the
 * unshifted result rather than fail the whole job over a cosmetic
 * setting.
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
        @unlink($tempPath);
    }
}

/**
 * Calls ElevenLabs Speech-to-Speech: your audio in, converted audio
 * out. Returns ['audio_bytes' => string]. Throws RuntimeException on
 * any failure.
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
        CURLOPT_HTTPHEADER => ['xi-api-key: ' . elevenLabsApiKeyOrThrow()],
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
