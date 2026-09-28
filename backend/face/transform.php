<?php

/*
|--------------------------------------------------------------------------
| Error display
|--------------------------------------------------------------------------
| Never show raw PHP errors to users: they leak paths and any warning
| printed before the JSON body breaks the browser's JSON.parse().
| Errors still go to the server error log.
|--------------------------------------------------------------------------
*/
error_reporting(E_ALL);
ini_set('display_errors', '0');
ini_set('log_errors', '1');

session_start();

header('Content-Type: application/json');


/*
|--------------------------------------------------------------------------
| Decart API configuration
|--------------------------------------------------------------------------
| API key is loaded from the project's .env file (see backend/config/env.php).
| Never commit the .env file or hardcode the key here.
|--------------------------------------------------------------------------
*/

require_once __DIR__ . '/../config/env.php';
require_once __DIR__ . '/../config/dns_workaround.php';

$decartApiKey = getenv('DECART_API_KEY') ?: '';

$decartEndpoint =
    'https://api.decart.ai/v1/jobs/lucy-2.5';


/*
|--------------------------------------------------------------------------
| Credits configuration
|--------------------------------------------------------------------------
| Every generated second of video costs CREDITS_PER_SECOND credits.
| Credits are deducted AFTER a successful transformation, in status.php.
| Must match CREDITS_PER_SECOND in assets/js/face-studio.js.
|--------------------------------------------------------------------------
*/

const CREDITS_PER_SECOND = 6;

const MAX_VIDEO_DURATION_SECONDS = 600;

const MAX_VIDEO_BYTES = 10 * 1024 * 1024;

const MAX_REFERENCE_BYTES = 10 * 1024 * 1024;


/*
|--------------------------------------------------------------------------
| Database connection
|--------------------------------------------------------------------------
*/

require_once __DIR__ . '/../config/database.php';


/*
|--------------------------------------------------------------------------
| Logging
|--------------------------------------------------------------------------
| TIP: move this file outside the web root (or use error_log()) so it
| cannot be downloaded, and rotate it so it doesn't grow forever.
|--------------------------------------------------------------------------
*/

$testLog = __DIR__ . '/transform-test.log';

function logLine(string $message): void
{
    global $testLog;

    file_put_contents(
        $testLog,
        date('Y-m-d H:i:s') . ' - ' . $message . "\n",
        FILE_APPEND
    );
}

logLine('transform.php called');


/*
|--------------------------------------------------------------------------
| JSON response helper
|--------------------------------------------------------------------------
*/

function jsonResponse(
    bool $success,
    string $message,
    int $statusCode = 200,
    array $extra = []
): void {

    global $conn;

    if (isset($conn) && $conn instanceof mysqli) {
        $conn->close();
    }

    http_response_code($statusCode);

    echo json_encode(
        array_merge(
            [
                'success' => $success,
                'message' => $message
            ],
            $extra
        )
    );

    exit;
}


/*
|--------------------------------------------------------------------------
| Authentication
|--------------------------------------------------------------------------
*/

if (
    !isset($_SESSION['logged_in']) ||
    $_SESSION['logged_in'] !== true ||
    !isset($_SESSION['user_id'])
) {

    logLine('authentication failed');

    jsonResponse(false, 'You must be logged in.', 401);
}

$userId = (int) $_SESSION['user_id'];


/*
|--------------------------------------------------------------------------
| Release the session lock
|--------------------------------------------------------------------------
| session_start() locks the session file until the script ends. This
| request uploads files to Decart and can be slow, which would block the
| user's status.php polls. We only need the session again at the very end
| (to store the job), so release it now and reopen it later.
|--------------------------------------------------------------------------
*/

session_write_close();


/*
|--------------------------------------------------------------------------
| Request method
|--------------------------------------------------------------------------
*/

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {

    logLine('invalid method: ' . $_SERVER['REQUEST_METHOD']);

    jsonResponse(false, 'Invalid request method.', 405);
}


/*
|--------------------------------------------------------------------------
| Check cURL
|--------------------------------------------------------------------------
*/

if (!function_exists('curl_init')) {

    logLine('cURL extension is not available');

    jsonResponse(false, 'PHP cURL extension is not available.', 500);
}


/*
|--------------------------------------------------------------------------
| Check files were received
|--------------------------------------------------------------------------
*/

logLine(
    'video=' . (isset($_FILES['video']) ? 'YES' : 'NO') .
    ' reference=' . (isset($_FILES['reference']) ? 'YES' : 'NO')
);

if (!isset($_FILES['video'])) {

    jsonResponse(
        false,
        'No video file was received by PHP.',
        400,
        ['video_received' => false]
    );
}

if (!isset($_FILES['reference'])) {

    jsonResponse(
        false,
        'No reference image was received by PHP.',
        400,
        ['reference_received' => false]
    );
}

$video = $_FILES['video'];

$reference = $_FILES['reference'];


/*
|--------------------------------------------------------------------------
| PHP upload errors
|--------------------------------------------------------------------------
*/

$uploadErrors = [

    UPLOAD_ERR_OK =>
        'Upload successful.',

    UPLOAD_ERR_INI_SIZE =>
        'The file exceeds the PHP upload_max_filesize limit.',

    UPLOAD_ERR_FORM_SIZE =>
        'The file exceeds the form upload limit.',

    UPLOAD_ERR_PARTIAL =>
        'The file was only partially uploaded.',

    UPLOAD_ERR_NO_FILE =>
        'No file was received by PHP.',

    UPLOAD_ERR_NO_TMP_DIR =>
        'PHP temporary upload directory is missing.',

    UPLOAD_ERR_CANT_WRITE =>
        'PHP could not write the uploaded file.',

    UPLOAD_ERR_EXTENSION =>
        'A PHP extension stopped the upload.'
];

if ($video['error'] !== UPLOAD_ERR_OK) {

    $errorCode = (int) $video['error'];

    $message =
        $uploadErrors[$errorCode] ?? 'Unknown video upload error.';

    logLine("VIDEO ERROR CODE: {$errorCode} - {$message}");

    jsonResponse(
        false,
        $message,
        400,
        [
            'upload_error_code' => $errorCode,
            'video_received' => true
        ]
    );
}

if ($reference['error'] !== UPLOAD_ERR_OK) {

    $errorCode = (int) $reference['error'];

    $message =
        $uploadErrors[$errorCode] ?? 'Unknown reference upload error.';

    logLine("REFERENCE ERROR CODE: {$errorCode} - {$message}");

    jsonResponse(
        false,
        $message,
        400,
        [
            'upload_error_code' => $errorCode,
            'reference_received' => true
        ]
    );
}

if (
    !is_uploaded_file($video['tmp_name']) ||
    !is_uploaded_file($reference['tmp_name'])
) {

    logLine('is_uploaded_file() check failed');

    jsonResponse(false, 'Invalid upload.', 400);
}


/*
|--------------------------------------------------------------------------
| File size checks
|--------------------------------------------------------------------------
*/

if ($video['size'] > MAX_VIDEO_BYTES) {

    logLine('video too large: ' . $video['size'] . ' bytes');

    jsonResponse(false, 'Video must be 10MB or smaller.', 400);
}

if ($reference['size'] > MAX_REFERENCE_BYTES) {

    logLine('reference too large: ' . $reference['size'] . ' bytes');

    jsonResponse(false, 'Reference image must be 10MB or smaller.', 400);
}


/*
|--------------------------------------------------------------------------
| MIME validation (detected from file contents, not the browser)
|--------------------------------------------------------------------------
*/

$allowedVideoTypes = [
    'video/mp4',
    'video/quicktime',
    'video/webm'
];

$allowedReferenceTypes = [
    'image/jpeg',
    'image/png',
    'image/webp'
];

$finfo = new finfo(FILEINFO_MIME_TYPE);

$videoMime =
    (string) $finfo->file($video['tmp_name']);

$referenceMime =
    (string) $finfo->file($reference['tmp_name']);

logLine(
    "video size={$video['size']} bytes, detected mime={$videoMime}"
);

logLine(
    "reference size={$reference['size']} bytes, detected mime={$referenceMime}"
);

if (!in_array($videoMime, $allowedVideoTypes, true)) {

    jsonResponse(false, 'Unsupported video format.', 400);
}

if (!in_array($referenceMime, $allowedReferenceTypes, true)) {

    jsonResponse(false, 'Unsupported reference image format.', 400);
}

if (@getimagesize($reference['tmp_name']) === false) {

    jsonResponse(false, 'The reference image could not be read.', 400);
}


/*
|--------------------------------------------------------------------------
| Quality
|--------------------------------------------------------------------------
| NOTE: currently validated but not sent to Decart. Resolution is fixed
| at 720p below. Map $quality to a resolution here if you want the
| dropdown to have an effect.
|--------------------------------------------------------------------------
*/

$quality =
    $_POST['quality'] ?? 'standard';

$allowedQualities = [
    'standard',
    'high',
    'ultra'
];

if (!in_array($quality, $allowedQualities, true)) {

    $quality = 'standard';
}


/*
|--------------------------------------------------------------------------
| Video duration — measured on the server
|--------------------------------------------------------------------------
| The browser-supplied duration can be faked to pay less, so we measure
| it with ffprobe. If ffprobe is not installed we fall back to the
| browser value (logged) — install ffprobe to close that gap.
|--------------------------------------------------------------------------
*/

function probeVideoDuration(string $path): ?float
{
    if (!function_exists('shell_exec')) {
        return null;
    }

    $command =
        'ffprobe -v error -show_entries format=duration ' .
        '-of default=noprint_wrappers=1:nokey=1 ' .
        escapeshellarg($path) .
        ' 2>/dev/null';

    $output = @shell_exec($command);

    if ($output === null || $output === false) {
        return null;
    }

    $value = trim($output);

    if ($value === '' || !is_numeric($value)) {
        return null;
    }

    $seconds = (float) $value;

    return ($seconds > 0 && is_finite($seconds))
        ? $seconds
        : null;
}

$durationSeconds =
    probeVideoDuration($video['tmp_name']);

if ($durationSeconds === null) {

    logLine(
        'WARNING: ffprobe unavailable, using browser-supplied duration'
    );

    $durationSeconds =
        isset($_POST['duration'])
            ? (float) $_POST['duration']
            : 0.0;
}

if (
    !is_finite($durationSeconds) ||
    $durationSeconds <= 0
) {

    jsonResponse(false, 'Missing or invalid video duration.', 400);
}

if ($durationSeconds > MAX_VIDEO_DURATION_SECONDS) {

    jsonResponse(
        false,
        'Video must be ' .
        (int) (MAX_VIDEO_DURATION_SECONDS / 60) .
        ' minutes or shorter.',
        400
    );
}


/*
|--------------------------------------------------------------------------
| Calculate required credits
|--------------------------------------------------------------------------
*/

$creditsRequired =
    (int) ceil($durationSeconds) * CREDITS_PER_SECOND;


/*
|--------------------------------------------------------------------------
| Look up the user's current credit balance
|--------------------------------------------------------------------------
*/

$balanceStmt = $conn->prepare(
    "SELECT credits_balance FROM users WHERE id = ? LIMIT 1"
);

$balanceStmt->bind_param("i", $userId);

$balanceStmt->execute();

$balanceResult = $balanceStmt->get_result();

$balanceRow = $balanceResult->fetch_assoc();

$balanceStmt->close();

if (!$balanceRow) {

    jsonResponse(false, 'Could not verify your account.', 404);
}

$currentBalance = (float) $balanceRow['credits_balance'];

if ($currentBalance < $creditsRequired) {

    logLine(
        "insufficient credits. required={$creditsRequired} balance={$currentBalance}"
    );

    jsonResponse(
        false,
        'You do not have enough credits for this transformation.',
        402,
        [
            'credits_required' => $creditsRequired,
            'credits_balance' => $currentBalance
        ]
    );
}


/*
|--------------------------------------------------------------------------
| Check Decart API key
|--------------------------------------------------------------------------
*/

if (trim($decartApiKey) === '') {

    logLine('DECART_API_KEY is missing from .env');

    jsonResponse(false, 'Decart API key has not been configured.', 500);
}


/*
|--------------------------------------------------------------------------
| Create CURL files
|--------------------------------------------------------------------------
*/

$videoFile = new CURLFile(
    $video['tmp_name'],
    $videoMime,
    $video['name']
);

$referenceFile = new CURLFile(
    $reference['tmp_name'],
    $referenceMime,
    $reference['name']
);


/*
|--------------------------------------------------------------------------
| Submit job to Decart (Lucy 2.5)
|--------------------------------------------------------------------------
| This call only SUBMITS the job. Waiting/downloading happens in
| status.php, called repeatedly by the browser.
|
| Prompt: replace face, hair, skin and expression with the reference;
| keep the original clothing and all other objects (phones, props).
|--------------------------------------------------------------------------
*/

$postFields = [

    'data' =>
        $videoFile,

    'prompt' =>
        'Replace only the person\'s face, hair, and skin with those of the person in the reference image, and keep this identical in every frame from the first to the last, with no drift, flicker, or change in appearance at any point. Keep the person\'s clothing, accessories, jewelry, and every other item and object in the original video exactly as they appear in the source, identical in every frame. Do not copy any clothing, pattern, accessories, or jewelry from the reference image. Preserve the original body pose, hand movement, background, and lighting, and match the original lip movement, blinking, and head motion.',

    'reference_image' =>
        $referenceFile,

    'resolution' =>
        '720p'
];

logLine(
    "submitting job to Decart (lucy-2.5), duration={$durationSeconds}s, credits_required={$creditsRequired}"
);


/*
|--------------------------------------------------------------------------
| Submit to Decart
|--------------------------------------------------------------------------
| Retries ONLY when the connection could not be established at all
| (nothing was sent, so no duplicate job can exist). A timeout after the
| upload started is NOT retried: Decart may already have created the job,
| and a retry would create a second one.
|--------------------------------------------------------------------------
*/

const MAX_SUBMIT_ATTEMPTS = 2;

$decartResponse = false;
$curlError = '';
$curlErrno = 0;
$httpCode = 0;
$attempt = 0;

for ($attempt = 1; $attempt <= MAX_SUBMIT_ATTEMPTS; $attempt++) {

    $ch = curl_init($decartEndpoint);

    apply_dns_workaround($ch, 'api.decart.ai');

    curl_setopt_array(
        $ch,
        [
            CURLOPT_POST =>
                true,

            CURLOPT_POSTFIELDS =>
                $postFields,

            CURLOPT_HTTPHEADER =>
                [
                    'x-api-key: ' . $decartApiKey,
                    'Accept: application/json'
                ],

            CURLOPT_RETURNTRANSFER =>
                true,

            /* 10MB video + image upload needs more than 20s on a
               slow link. */
            CURLOPT_TIMEOUT =>
                90,

            CURLOPT_CONNECTTIMEOUT =>
                10
        ]
    );

    $decartResponse = curl_exec($ch);

    $curlError = curl_error($ch);

    $curlErrno = curl_errno($ch);

    $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);

    curl_close($ch);

    if ($decartResponse !== false) {
        break;
    }

    logLine(
        "Decart submission cURL error (attempt {$attempt}/" .
        MAX_SUBMIT_ATTEMPTS . "), errno={$curlErrno}: {$curlError}"
    );

    $safeToRetry = in_array(
        $curlErrno,
        [CURLE_COULDNT_RESOLVE_HOST, CURLE_COULDNT_CONNECT],
        true
    );

    if (!$safeToRetry) {
        break;
    }

    if ($attempt < MAX_SUBMIT_ATTEMPTS) {
        usleep(500000);
    }
}

if ($decartResponse === false) {

    logLine("Decart submission failed after {$attempt} attempt(s): {$curlError}");

    /* Details stay in the log; don't expose them to the browser. */
    jsonResponse(false, 'Could not connect to Decart.', 502);
}


/*
|--------------------------------------------------------------------------
| Decode and check Decart response
|--------------------------------------------------------------------------
*/

$jobData = json_decode($decartResponse, true);

logLine('Decart HTTP status: ' . $httpCode);

if ($httpCode < 200 || $httpCode >= 300) {

    $errorMessage =
        $jobData['detail']
        ?? $jobData['message']
        ?? 'Decart rejected the transformation request.';

    if (is_array($errorMessage)) {

        $errorMessage = json_encode($errorMessage);
    }

    logLine('Decart submission failed: ' . $decartResponse);

    jsonResponse(
        false,
        (string) $errorMessage,
        502,
        ['decart_http_status' => $httpCode]
    );
}

$jobId = $jobData['job_id'] ?? null;

if (!$jobId) {

    logLine('Decart response did not contain job_id');

    jsonResponse(false, 'Decart did not return a job ID.', 502);
}

logLine('Decart job submitted: ' . $jobId);


/*
|--------------------------------------------------------------------------
| Stash job context in the session (reopened after the earlier close)
|--------------------------------------------------------------------------
| For stronger guarantees (parallel jobs, double-charge protection),
| store jobs in a database table instead: unique job_id, user_id,
| credits_required, charged flag, and charge with
| UPDATE ... WHERE job_id = ? AND charged = 0 (check affected rows).
|--------------------------------------------------------------------------
*/

session_start();

if (
    !isset($_SESSION['face_jobs']) ||
    !is_array($_SESSION['face_jobs'])
) {
    $_SESSION['face_jobs'] = [];
}

$_SESSION['face_jobs'][$jobId] = [
    'user_id' => $userId,
    'credits_required' => $creditsRequired,
    'quality' => $quality,
    'charged' => false,
    'result_url' => null,
];

session_write_close();


/*
|--------------------------------------------------------------------------
| Respond immediately — the browser will poll status.php from here
|--------------------------------------------------------------------------
*/

jsonResponse(
    true,
    'Transformation started.',
    200,
    [
        'job_id' => $jobId,
        'status' => 'processing',
        'quality' => $quality,
        'credits_required' => $creditsRequired,
    ]
);
