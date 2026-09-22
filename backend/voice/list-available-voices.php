<?php

/**
 * backend/voice/list-available-voices.php
 *
 * ADMIN/SETUP TOOL — not part of the user-facing app. Run this once
 * (from a browser while logged in, or via CLI php) to see every voice
 * currently available in your ElevenLabs account, with real, current
 * voice_ids you can paste into LIBRARY_VOICE_ELEVEN_IDS in
 * transform.php.
 *
 * Why this exists instead of just handing you IDs: several commonly
 * tutorial-quoted premade voice IDs (Rachel, Antoni, Josh, Arnold,
 * Charlotte, Amelia) are retired on ElevenLabs' side as of recently —
 * they don't error, they silently get remapped to a DIFFERENT voice
 * than the name suggests. Pulling live from your own account avoids
 * that trap entirely.
 *
 * SECURITY: this exposes your voice library, not sensitive data, but
 * it still shouldn't be world-readable in production — either delete
 * it after you've picked your 4 voices, or gate it behind an admin
 * check like the rest of your backend.
 */

session_start();

require_once __DIR__ . '/../config/env.php';
require_once __DIR__ . '/../config/dns_workaround.php';

if (
    !isset($_SESSION['logged_in']) ||
    $_SESSION['logged_in'] !== true
) {
    http_response_code(401);
    exit('Not authenticated.');
}

$apiKey = getenv('ELEVENLABS_API_KEY');

if (!$apiKey) {
    exit('ELEVENLABS_API_KEY is not set in your environment.');
}

$ch = curl_init('https://api.elevenlabs.io/v1/voices');
apply_dns_workaround($ch, 'api.elevenlabs.io');

curl_setopt_array($ch, [
    CURLOPT_HTTPHEADER => ['xi-api-key: ' . $apiKey],
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 30,
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($httpCode !== 200) {
    http_response_code(502);
    exit("Could not fetch voices from ElevenLabs (HTTP $httpCode): " . htmlspecialchars($response));
}

$data = json_decode($response, true);
$voices = $data['voices'] ?? [];

// Group so premade (their curated library) and cloned (yours/your
// users') are easy to tell apart at a glance.
$premade = array_filter($voices, fn($v) => ($v['category'] ?? '') === 'premade');
$cloned = array_filter($voices, fn($v) => ($v['category'] ?? '') === 'cloned');

?>
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>ElevenLabs Voices — AIStudio Setup Tool</title>
    <style>
        body { font-family: -apple-system, sans-serif; max-width: 900px; margin: 2rem auto; padding: 0 1rem; }
        h2 { border-bottom: 2px solid #ddd; padding-bottom: 0.5rem; margin-top: 2rem; }
        table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
        th, td { text-align: left; padding: 0.5rem; border-bottom: 1px solid #eee; }
        code { background: #f4f4f4; padding: 2px 6px; border-radius: 4px; font-size: 0.9em; }
        .warn { background: #fff3cd; padding: 1rem; border-radius: 6px; margin-bottom: 1.5rem; }
        audio { height: 32px; }
    </style>
</head>
<body>

    <h1>ElevenLabs Voices — pick your 4 library voices</h1>

    <div class="warn">
        Copy the <code>voice_id</code> for 4 voices that match your
        Aurora / Atlas / Nova / Orion descriptions, then paste them into
        <code>LIBRARY_VOICE_ELEVEN_IDS</code> in
        <code>backend/voice/transform.php</code>.
        Delete or restrict this file once you're done — it doesn't
        belong in a production deployment long-term.
    </div>

    <h2>Premade voices (<?php echo count($premade); ?>)</h2>
    <table>
        <tr><th>Name</th><th>Labels</th><th>voice_id</th><th>Preview</th></tr>
        <?php foreach ($premade as $voice): ?>
        <tr>
            <td><strong><?php echo htmlspecialchars($voice['name'] ?? ''); ?></strong></td>
            <td>
                <?php
                $labels = $voice['labels'] ?? [];
                echo htmlspecialchars(implode(' · ', array_filter([
                    $labels['gender'] ?? null,
                    $labels['age'] ?? null,
                    $labels['accent'] ?? null,
                    $labels['description'] ?? null,
                ])));
                ?>
            </td>
            <td><code><?php echo htmlspecialchars($voice['voice_id'] ?? ''); ?></code></td>
            <td>
                <?php if (!empty($voice['preview_url'])): ?>
                <audio controls src="<?php echo htmlspecialchars($voice['preview_url']); ?>"></audio>
                <?php endif; ?>
            </td>
        </tr>
        <?php endforeach; ?>
    </table>

    <h2>Your cloned voices (<?php echo count($cloned); ?>)</h2>
    <p>Voices already cloned in your account (via this app's clone.php, or manually).</p>
    <table>
        <tr><th>Name</th><th>voice_id</th><th>Preview</th></tr>
        <?php foreach ($cloned as $voice): ?>
        <tr>
            <td><strong><?php echo htmlspecialchars($voice['name'] ?? ''); ?></strong></td>
            <td><code><?php echo htmlspecialchars($voice['voice_id'] ?? ''); ?></code></td>
            <td>
                <?php if (!empty($voice['preview_url'])): ?>
                <audio controls src="<?php echo htmlspecialchars($voice['preview_url']); ?>"></audio>
                <?php endif; ?>
            </td>
        </tr>
        <?php endforeach; ?>
    </table>

</body>
</html>
