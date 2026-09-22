<?php

session_start();

header('Content-Type: application/json');


/*
|--------------------------------------------------------------------------
| Decart API configuration
|--------------------------------------------------------------------------
|
| API key is loaded from the project's .env file (see backend/config/env.php).
| Never commit the .env file or hardcode the key here.
|
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
|
| Every generated second of video costs CREDITS_PER_SECOND credits.
| Credits are only deducted AFTER a successful transformation, in
| status.php once the job actually completes.
|
|--------------------------------------------------------------------------
*/

const CREDITS_PER_SECOND = 6;

const MAX_VIDEO_DURATION_SECONDS = 600;


/*
|--------------------------------------------------------------------------
| Database connection
|--------------------------------------------------------------------------
*/

require_once __DIR__ . '/../config/database.php';


/*
|--------------------------------------------------------------------------
| Test logging
|--------------------------------------------------------------------------
*/

$testLog = __DIR__ . '/transform-test.log';

file_put_contents(
    $testLog,
    date('Y-m-d H:i:s') .
    " - transform.php called\n",
    FILE_APPEND
);


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

    file_put_contents(
        __DIR__ . '/transform-test.log',
        date('Y-m-d H:i:s') .
        " - authentication failed\n",
        FILE_APPEND
    );

    jsonResponse(
        false,
        'You must be logged in.',
        401
    );
}


$userId = (int) $_SESSION['user_id'];


/*
|--------------------------------------------------------------------------
| Request method
|--------------------------------------------------------------------------
*/

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {

    file_put_contents(
        $testLog,
        date('Y-m-d H:i:s') .
        " - invalid method: " .
        $_SERVER['REQUEST_METHOD'] .
        "\n",
        FILE_APPEND
    );

    jsonResponse(
        false,
        'Invalid request method.',
        405
    );
}


/*
|--------------------------------------------------------------------------
| Check cURL
|--------------------------------------------------------------------------
*/

if (!function_exists('curl_init')) {

    file_put_contents(
        $testLog,
        date('Y-m-d H:i:s') .
        " - cURL extension is not available\n",
        FILE_APPEND
    );

    jsonResponse(
        false,
        'PHP cURL extension is not available.',
        500
    );
}


/*
|--------------------------------------------------------------------------
| Log received files
|--------------------------------------------------------------------------
*/

$videoReceived =
    isset($_FILES['video']) ? 'YES' : 'NO';

$referenceReceived =
    isset($_FILES['reference']) ? 'YES' : 'NO';


file_put_contents(
    $testLog,
    date('Y-m-d H:i:s') .
    " - video=" .
    $videoReceived .
    " reference=" .
    $referenceReceived .
    "\n",
    FILE_APPEND
);


/*
|--------------------------------------------------------------------------
| Check video
|--------------------------------------------------------------------------
*/

if (!isset($_FILES['video'])) {

    jsonResponse(
        false,
        'No video file was received by PHP.',
        400,
        [
            'video_received' => false
        ]
    );
}


/*
|--------------------------------------------------------------------------
| Check reference image
|--------------------------------------------------------------------------
*/

if (!isset($_FILES['reference'])) {

    jsonResponse(
        false,
        'No reference image was received by PHP.',
        400,
        [
            'reference_received' => false
        ]
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


/*
|--------------------------------------------------------------------------
| Check video upload
|--------------------------------------------------------------------------
*/

if ($video['error'] !== UPLOAD_ERR_OK) {

    $errorCode = (int) $video['error'];

    $message =
        $uploadErrors[$errorCode]
        ?? 'Unknown video upload error.';


    file_put_contents(
        $testLog,
        date('Y-m-d H:i:s') .
        " - VIDEO ERROR CODE: " .
        $errorCode .
        " - " .
        $message .
        "\n",
        FILE_APPEND
    );


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


/*
|--------------------------------------------------------------------------
| Check reference upload
|--------------------------------------------------------------------------
*/

if ($reference['error'] !== UPLOAD_ERR_OK) {

    $errorCode = (int) $reference['error'];

    $message =
        $uploadErrors[$errorCode]
        ?? 'Unknown reference upload error.';


    file_put_contents(
        $testLog,
        date('Y-m-d H:i:s') .
        " - REFERENCE ERROR CODE: " .
        $errorCode .
        " - " .
        $message .
        "\n",
        FILE_APPEND
    );


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


/*
|--------------------------------------------------------------------------
| Maximum file sizes
|--------------------------------------------------------------------------
*/

$maxVideoSize =
    10 * 1024 * 1024;

$maxReferenceSize =
    10 * 1024 * 1024;


/*
|--------------------------------------------------------------------------
| Video size check
|--------------------------------------------------------------------------
*/

if ($video['size'] > $maxVideoSize) {

    file_put_contents(
        $testLog,
        date('Y-m-d H:i:s') .
        " - video too large: " .
        $video['size'] .
        " bytes\n",
        FILE_APPEND
    );


    jsonResponse(
        false,
        'Video must be 10MB or smaller.',
        400
    );
}


/*
|--------------------------------------------------------------------------
| Reference size check
|--------------------------------------------------------------------------
*/

if ($reference['size'] > $maxReferenceSize) {

    file_put_contents(
        $testLog,
        date('Y-m-d H:i:s') .
        " - reference too large: " .
        $reference['size'] .
        " bytes\n",
        FILE_APPEND
    );


    jsonResponse(
        false,
        'Reference image must be 10MB or smaller.',
        400
    );
}


/*
|--------------------------------------------------------------------------
| Allowed video types
|--------------------------------------------------------------------------
*/

$allowedVideoTypes = [

    'video/mp4',

    'video/quicktime',

    'video/webm'
];


/*
|--------------------------------------------------------------------------
| Allowed reference types
|--------------------------------------------------------------------------
*/

$allowedReferenceTypes = [

    'image/jpeg',

    'image/png',

    'image/webp'
];


/*
|--------------------------------------------------------------------------
| Browser-reported MIME types
|--------------------------------------------------------------------------
*/

$videoMime =
    $video['type'] ?? '';

$referenceMime =
    $reference['type'] ?? '';


/*
|--------------------------------------------------------------------------
| Log file information
|--------------------------------------------------------------------------
*/

file_put_contents(
    $testLog,
    date('Y-m-d H:i:s') .
    " - video size=" .
    $video['size'] .
    " bytes, mime=" .
    $videoMime .
    "\n",
    FILE_APPEND
);


file_put_contents(
    $testLog,
    date('Y-m-d H:i:s') .
    " - reference size=" .
    $reference['size'] .
    " bytes, mime=" .
    $referenceMime .
    "\n",
    FILE_APPEND
);


/*
|--------------------------------------------------------------------------
| Validate video MIME
|--------------------------------------------------------------------------
*/

if (!in_array(
    $videoMime,
    $allowedVideoTypes,
    true
)) {

    jsonResponse(
        false,
        'Unsupported video format.',
        400,
        [
            'detected_type' => $videoMime
        ]
    );
}


/*
|--------------------------------------------------------------------------
| Validate reference MIME
|--------------------------------------------------------------------------
*/

if (!in_array(
    $referenceMime,
    $allowedReferenceTypes,
    true
)) {

    jsonResponse(
        false,
        'Unsupported reference image format.',
        400,
        [
            'detected_type' => $referenceMime
        ]
    );
}


/*
|--------------------------------------------------------------------------
| Quality
|--------------------------------------------------------------------------
*/

$quality =
    $_POST['quality'] ?? 'standard';


$allowedQualities = [

    'standard',

    'high',

    'ultra'
];


if (!in_array(
    $quality,
    $allowedQualities,
    true
)) {

    $quality = 'standard';
}


/*
|--------------------------------------------------------------------------
| Video duration (sent by the browser after loadedmetadata)
|--------------------------------------------------------------------------
|
| This drives the credit estimate. We trust it loosely (it only affects
| how many credits get charged to the SAME user who uploaded the video),
| but we still clamp it to a sane range so a bad/missing value can't
| produce a zero or absurd charge.
|
|--------------------------------------------------------------------------
*/

$durationSeconds =
    isset($_POST['duration'])
        ? (float) $_POST['duration']
        : 0.0;

if (
    !is_finite($durationSeconds) ||
    $durationSeconds <= 0
) {

    jsonResponse(
        false,
        'Missing or invalid video duration.',
        400
    );
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
    (int) ceil($durationSeconds) *
    CREDITS_PER_SECOND;


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

    jsonResponse(
        false,
        'Could not verify your account.',
        404
    );
}

$currentBalance = (float) $balanceRow['credits_balance'];


/*
|--------------------------------------------------------------------------
| Reject if the user doesn't have enough credits
|--------------------------------------------------------------------------
*/

if ($currentBalance < $creditsRequired) {

    file_put_contents(
        $testLog,
        date('Y-m-d H:i:s') .
        " - insufficient credits. required=" .
        $creditsRequired .
        " balance=" .
        $currentBalance .
        "\n",
        FILE_APPEND
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

    file_put_contents(
        $testLog,
        date('Y-m-d H:i:s') .
        " - DECART_API_KEY is missing from .env\n",
        FILE_APPEND
    );

    jsonResponse(
        false,
        'Decart API key has not been configured.',
        500
    );
}


/*
|--------------------------------------------------------------------------
| Guard against PHP's own execution timeout
|--------------------------------------------------------------------------
|
| This request should be fast now (just an upload + submission), but if
| CURLOPT_CONNECTTIMEOUT/CURLOPT_TIMEOUT below end up waiting on a slow
| or unreachable network, PHP's default max_execution_time (often 30s)
| can kill the script mid-cURL-call before it ever writes a response.
| That looks to the browser like a dropped connection ("Could not
| connect to the AIStudio server"), not like a normal error reply.
| set_time_limit(0) here just makes sure OUR jsonResponse() calls above
| are what end the request, not PHP's timer.
|
| NOTE: this only protects against PHP's OWN timer. It does NOT protect
| against a reverse proxy / load balancer / browser killing an idle
| connection while cURL is still blocked waiting on Decart -- that is
| why MAX_SUBMIT_ATTEMPTS and the cURL timeouts below were tightened
| (see "FIX" comment further down). set_time_limit(0) plus a long
| retry loop is what was causing "Could not connect to the AIStudio
| server" client-side: PHP itself was happy to keep running for
| several minutes, but nothing in front of it was.
|
|--------------------------------------------------------------------------
*/

set_time_limit(0);


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
|
| Lucy supports:
|
| data              = source video
| prompt            = optional text prompt
| reference_image   = reference image
|
| We intentionally use an empty prompt because
| this Face Studio mode is reference-image based.
|
| IMPORTANT: this call only *submits* the job. It does NOT wait for the
| job to finish, and it does NOT download the result. Waiting/downloading
| happens in status.php, called repeatedly by the browser. Doing the
| whole thing in one request used to hold the HTTP connection open for
| up to ~20 minutes, which timed out at the web server / proxy layer
| (independent of set_time_limit(0) in PHP) and surfaced to the browser
| as a generic network error ("Could not connect to the AIStudio
| server"), even though the Decart job itself was fine.
|
|--------------------------------------------------------------------------
*/

$postFields = [

    'data' =>
        $videoFile,

    'prompt' =>
        '',

    'reference_image' =>
        $referenceFile,

    'resolution' =>
        '720p'
];


file_put_contents(
    $testLog,
    date('Y-m-d H:i:s') .
    " - submitting job to Decart (lucy-2.5), duration=" .
    $durationSeconds .
    "s, credits_required=" .
    $creditsRequired .
    "\n",
    FILE_APPEND
);


/*
|--------------------------------------------------------------------------
| Submit to Decart with a small retry allowance
|--------------------------------------------------------------------------
|
| Unlike status polling (where the browser just calls status.php again
| a few seconds later), this call carries the uploaded files — if it
| fails we can't ask the browser to "just retry," the files are only
| available for this one request. So a transient connection blip here
| gets retried a couple of times server-side, before we give up and
| report failure.
|
| FIX: this loop used to be able to block for up to ~375 seconds
| (6 attempts * 60s CURLOPT_TIMEOUT, plus 1+2+3+4+5s of sleep() backoff
| between attempts) with ZERO bytes sent back to the browser the whole
| time. Any reverse proxy, load balancer, or even the browser itself
| will typically kill a connection that's been silent that long — and
| when that happens the client doesn't get an HTTP response at all, it
| gets a dropped connection, which surfaces as xhr.onerror ->
| "Could not connect to the AIStudio server" (this is what the client
| was showing, with its own "retrying 4/4" client-side retry loop
| layered on top of THIS server-side retry loop, making things worse,
| not better).
|
| set_time_limit(0) above does NOT fix this — it only removes PHP's
| own execution-time limit, it has no effect on a proxy/server/browser
| timing out an idle connection in front of PHP.
|
| The fix: keep this loop short enough that the whole request reliably
| returns well within typical proxy read-timeouts (often ~60s), and
| let the browser's own existing retry loop (in face-studio.js) handle
| resubmission if this single short attempt genuinely fails, instead
| of stacking two long retry loops on top of each other.
|
|--------------------------------------------------------------------------
*/

const MAX_SUBMIT_ATTEMPTS = 2;

$decartResponse = false;
$curlError = '';
$httpCode = 0;

for ($attempt = 1; $attempt <= MAX_SUBMIT_ATTEMPTS; $attempt++) {

    $ch = curl_init(
        $decartEndpoint
    );

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

                    'x-api-key: ' .
                    $decartApiKey,

                    'Accept: application/json'
                ],

            CURLOPT_RETURNTRANSFER =>
                true,

            /*
             * Only bounds the *submission* request now (uploading the
             * files and getting a job_id back) — not the whole
             * transformation. Kept well under typical proxy read
             * timeouts (~60s) so a stuck attempt fails fast instead of
             * silently starving the connection until something in
             * front of PHP kills it.
             */
            CURLOPT_TIMEOUT =>
                20,

            CURLOPT_CONNECTTIMEOUT =>
                10
        ]
    );

    $decartResponse =
        curl_exec($ch);

    $curlError =
        curl_error($ch);

    $httpCode =
        curl_getinfo(
            $ch,
            CURLINFO_HTTP_CODE
        );

    curl_close($ch);

    if ($decartResponse !== false) {
        /* Got a response (even an error HTTP code) — stop retrying,
           there's nothing transient left to retry against. */
        break;
    }

    file_put_contents(
        $testLog,
        date('Y-m-d H:i:s') .
        " - Decart submission cURL error (attempt {$attempt}/" .
        MAX_SUBMIT_ATTEMPTS . "): {$curlError}\n",
        FILE_APPEND
    );

    /* Short, fixed pause — not a growing backoff. Multiple attempts
       here should only ever cover a brief blip, never minutes. */
    if ($attempt < MAX_SUBMIT_ATTEMPTS) {
        usleep(500000); // 0.5s
    }
}


/*
|--------------------------------------------------------------------------
| Check Decart submission cURL error
|--------------------------------------------------------------------------
*/

if ($decartResponse === false) {

    file_put_contents(
        $testLog,
        date('Y-m-d H:i:s') .
        " - Decart submission failed after {$attempt} attempt(s): {$curlError}\n",
        FILE_APPEND
    );

    jsonResponse(
        false,
        'Could not connect to Decart.',
        502,
        [
            'curl_error' =>
                $curlError
        ]
    );
}


/*
|--------------------------------------------------------------------------
| Decode Decart response
|--------------------------------------------------------------------------
*/

$jobData =
    json_decode(
        $decartResponse,
        true
    );


/*
|--------------------------------------------------------------------------
| Log Decart submission response
|--------------------------------------------------------------------------
*/

file_put_contents(
    $testLog,
    date('Y-m-d H:i:s') .
    " - Decart HTTP status: " .
    $httpCode .
    "\n",
    FILE_APPEND
);


/*
|--------------------------------------------------------------------------
| Check Decart HTTP response
|--------------------------------------------------------------------------
*/

if (
    $httpCode < 200 ||
    $httpCode >= 300
) {

    $errorMessage =
        $jobData['detail']
        ??
        $jobData['message']
        ??
        'Decart rejected the transformation request.';


    if (is_array($errorMessage)) {

        $errorMessage =
            json_encode(
                $errorMessage
            );
    }


    file_put_contents(
        $testLog,
        date('Y-m-d H:i:s') .
        " - Decart submission failed: " .
        $decartResponse .
        "\n",
        FILE_APPEND
    );


    jsonResponse(
        false,
        (string) $errorMessage,
        502,
        [
            'decart_http_status' =>
                $httpCode,

            'decart_response' =>
                $jobData
        ]
    );
}


/*
|--------------------------------------------------------------------------
| Get job ID
|--------------------------------------------------------------------------
*/

$jobId =
    $jobData['job_id']
    ?? null;


if (!$jobId) {

    file_put_contents(
        $testLog,
        date('Y-m-d H:i:s') .
        " - Decart response did not contain job_id\n",
        FILE_APPEND
    );


    jsonResponse(
        false,
        'Decart did not return a job ID.',
        502,
        [
            'decart_response' =>
                $jobData
        ]
    );
}


file_put_contents(
    $testLog,
    date('Y-m-d H:i:s') .
    " - Decart job submitted: " .
    $jobId .
    "\n",
    FILE_APPEND
);


/*
|--------------------------------------------------------------------------
| Stash job context in the session
|--------------------------------------------------------------------------
|
| status.php looks this up by job_id + the logged-in user_id, so the
| browser only ever needs to pass back the job_id — it can't spoof
| credits_required or whose job this is.
|
|--------------------------------------------------------------------------
*/

if (!isset($_SESSION['face_jobs']) || !is_array($_SESSION['face_jobs'])) {
    $_SESSION['face_jobs'] = [];
}

$_SESSION['face_jobs'][$jobId] = [
    'user_id' => $userId,
    'credits_required' => $creditsRequired,
    'quality' => $quality,
    'charged' => false,
    'result_url' => null,
];


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
