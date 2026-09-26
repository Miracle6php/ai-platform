<?php

/**
 * TEMPORARY DIAGNOSTIC — delete this file once the ffmpeg issue is
 * resolved. It reveals server paths/config, so it should not stay
 * live in production.
 *
 * Visit this file directly in your browser (e.g.
 * https://your-app.up.railway.app/ffmpeg-check.php) to see whether
 * ffmpeg/ffprobe are actually installed and executable by PHP.
 */

header('Content-Type: text/plain');

echo "=== exec() availability ===\n";
$disabled = ini_get('disable_functions');
echo "disable_functions: " . ($disabled ?: '(none)') . "\n";
echo "exec() exists: " . (function_exists('exec') ? 'yes' : 'NO') . "\n\n";

echo "=== PATH seen by PHP ===\n";
echo (getenv('PATH') ?: '(empty)') . "\n\n";

echo "=== which ffmpeg ===\n";
exec('which ffmpeg 2>&1', $out1, $code1);
echo "exit code: $code1\n";
echo implode("\n", $out1) . "\n\n";

echo "=== which ffprobe ===\n";
exec('which ffprobe 2>&1', $out2, $code2);
echo "exit code: $code2\n";
echo implode("\n", $out2) . "\n\n";

echo "=== ffmpeg -version ===\n";
exec('ffmpeg -version 2>&1', $out3, $code3);
echo "exit code: $code3\n";
echo implode("\n", array_slice($out3, 0, 3)) . "\n\n";

echo "=== memory / limits ===\n";
echo "memory_limit: " . ini_get('memory_limit') . "\n";
echo "max_execution_time: " . ini_get('max_execution_time') . "\n";
