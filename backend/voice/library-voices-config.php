<?php

/**
 * backend/voice/library-voices-config.php
 *
 * Single source of truth for your 4 library voices. Both
 * transform.php (which voice to convert TOWARD) and voice-studio.php
 * (which preview URL to play) read from here.
 *
 * Real elevenlabs_voice_id values are filled in below. preview_url is
 * NOT hardcoded — it's fetched from ElevenLabs on first use and cached
 * to storage/voice_preview_cache.json so we're not calling their API
 * on every single page load, just once ever (or whenever the cache
 * file is deleted).
 */

require_once __DIR__ . '/../config/env.php';
require_once __DIR__ . '/../config/dns_workaround.php';

const VOICE_PREVIEW_CACHE_PATH = __DIR__ . '/../../storage/voice_preview_cache.json';

$libraryVoicesRaw = [
    'voice-01' => [
        'name' => 'Aurora',
        'label' => 'Female · Natural',
        'avatar_letter' => 'A',
        'elevenlabs_voice_id' => 'SAz9YHcvj6GT2YYXdXww',
    ],
    'voice-02' => [
        'name' => 'Atlas',
        'label' => 'Male · Deep',
        'avatar_letter' => 'A',
        'elevenlabs_voice_id' => 'cgSgspJ2msm6clMCkdW9',
    ],
    'voice-03' => [
        'name' => 'Nova',
        'label' => 'Female · Clear',
        'avatar_letter' => 'N',
        'elevenlabs_voice_id' => 'iP95p4xoKVk53GoZ742B',
    ],
    'voice-04' => [
        'name' => 'Orion',
        'label' => 'Male · Smooth',
        'avatar_letter' => 'O',
        'elevenlabs_voice_id' => 'TX3LPaxmHKxFdv7VOQHJ',
    ],
];

/**
 * Loads the preview URL cache from disk, or an empty array if it
 * doesn't exist yet.
 */
function loadPreviewCache(): array
{
    if (!file_exists(VOICE_PREVIEW_CACHE_PATH)) {
        return [];
    }

    $content = file_get_contents(VOICE_PREVIEW_CACHE_PATH);
    $data = json_decode($content, true);

    return is_array($data) ? $data : [];
}

function savePreviewCache(array $cache): void
{
    $dir = dirname(VOICE_PREVIEW_CACHE_PATH);
    if (!is_dir($dir)) {
        mkdir($dir, 0750, true);
    }

    file_put_contents(VOICE_PREVIEW_CACHE_PATH, json_encode($cache));
}

/**
 * Fetches a single voice's preview_url from ElevenLabs.
 * Returns '' on any failure — callers should treat that as
 * "no preview available yet" rather than a fatal error.
 */
function fetchElevenLabsPreviewUrl(string $voiceId): string
{
    $apiKey = getenv('ELEVENLABS_API_KEY');
    if (!$apiKey) {
        return '';
    }

    $ch = curl_init('https://api.elevenlabs.io/v1/voices/' . urlencode($voiceId));
    apply_dns_workaround($ch, 'api.elevenlabs.io');

    curl_setopt_array($ch, [
        CURLOPT_HTTPHEADER => ['xi-api-key: ' . $apiKey],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 15,
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200 || $response === false) {
        return '';
    }

    $data = json_decode($response, true);

    return $data['preview_url'] ?? '';
}

// ---- resolve preview URLs, using cache where possible -----------------

$previewCache = loadPreviewCache();
$cacheChanged = false;

foreach ($libraryVoicesRaw as $voiceId => &$voice) {

    $elevenId = $voice['elevenlabs_voice_id'];

    if (isset($previewCache[$elevenId]) && $previewCache[$elevenId] !== '') {
        $voice['preview_url'] = $previewCache[$elevenId];
        continue;
    }

    $previewUrl = fetchElevenLabsPreviewUrl($elevenId);

    $voice['preview_url'] = $previewUrl;

    if ($previewUrl !== '') {
        $previewCache[$elevenId] = $previewUrl;
        $cacheChanged = true;
    }
}
unset($voice);

if ($cacheChanged) {
    savePreviewCache($previewCache);
}

return $libraryVoicesRaw;
