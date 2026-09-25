<?php
header('Content-Type: text/plain');
$logPath = __DIR__ . '/transform-test.log';

if (!file_exists($logPath)) {
    echo "Log file does not exist yet.";
    exit;
}

echo file_get_contents($logPath);