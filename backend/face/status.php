<?php

session_start();

header('Content-Type: application/json');


/*
|--------------------------------------------------------------------------
| Decart API configuration
|--------------------------------------------------------------------------
*/

require_once __DIR__ . '/../config/env.php';
require_once __DIR__ . '/../config/dns_workaround.php';

$decartApiKey = getenv('DECART_API_KEY') ?: '';


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

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {

    jsonResponse(
        false,
        'Invalid request method.',
        405
    );
}


/*
|--------------------------------------------------------------------------
| Job ID
|--------------------------------------------------------------------------
*/

$jobId = isset($_GET['job_id']) ? (string) $_GET['job_id'] : '';

if ($jobId === '') {

    jsonResponse(
        false,
        'Missing job_id.',
        400
    );
}


/*
|--------------------------------------------------------------------------
| Look up the job in the session
|--------------------------------------------------------------------------
|
| The job was created by transform.php in the SAME session, keyed by
| job_id and tagged with the user_id that started it. This means the
| browser only ever has to pass back the job_id — it can never spoof
| whose job it is or how many credits are owed for it.
|
|--------------------------------------------------------------------------
*/

if (
    !isset($_SESSION['face_jobs']) ||
    !is_array($_SESSION['face_jobs']) ||
    !isset($_SESSION['face_jobs'][$jobId])
) {

    jsonResponse(
        false,
        'Unknown or expired job.',
        404
    );
}

$job = $_SESSION['face_jobs'][$jobId];

if ((int) $job['user_id'] !== $userId) {

    jsonResponse(
        false,
        'Unknown or expired job.',
        404
    );
}


/*
|--------------------------------------------------------------------------
| If this job already finished and was charged, just replay the result
|--------------------------------------------------------------------------
|
| Handles the browser polling one extra time after it already got the
| "completed" response (e.g. a duplicate tab, a retried request).
|
|--------------------------------------------------------------------------
*/

if (!empty($job['charged']) && !empty($job['result_url'])) {

    jsonResponse(
        true,
        'Video transformation completed successfully.',
        200,
        [
            'status' => 'completed',
            'job_id' => $jobId,
            'quality' => $job['quality'] ?? 'standard',
            'result_url' => $job['result_url'],
            'download_url' => $job['result_url'],
            'credits_charged' => $job['credits_required'],
        ]
    );
}


/*
|--------------------------------------------------------------------------
| Check Decart API key
|--------------------------------------------------------------------------
*/

if (trim($decartApiKey) === '') {

    jsonResponse(
        false,
        'Decart API key has not been configured.',
        500
    );
}


/*
|--------------------------------------------------------------------------
| Poll Decart ONCE per call
|--------------------------------------------------------------------------
|
| The browser is responsible for calling this endpoint again a few
| seconds later if status comes back "processing". This keeps every
| single HTTP request short (well under any reverse-proxy / PHP-FPM
| timeout), which is the whole point of the fix: the old code polled
| in a `while` loop with `sleep(2)` inside ONE request for up to 10
| minutes, and that connection kept getting killed by the web server
| before PHP ever got a chance to respond — which is what the browser
| was seeing as "Could not connect to the AIStudio server".
|
|--------------------------------------------------------------------------
*/

/*
 * A single dropped connection to Decart's status endpoint (timeout,
 * transient DNS blip, etc.) is not itself proof the job failed — the
 * job is still running fine on Decart's side. So a transient cURL
 * failure here should NOT kill the whole transformation on its first
 * occurrence; only if it keeps happening across several polls in a
 * row is something actually wrong. We track that count in the
 * session, per job.
 */

const MAX_CONSECUTIVE_POLL_ERRORS = 10;

$pollErrors = (int) ($job['poll_errors'] ?? 0);


$statusEndpoint =
    'https://api.decart.ai/v1/jobs/' .
    rawurlencode($jobId);


$ch = curl_init($statusEndpoint);
apply_dns_workaround($ch, 'api.decart.ai');

curl_setopt_array(
    $ch,
    [
        CURLOPT_HTTPGET => true,

        CURLOPT_HTTPHEADER => [
            'x-api-key: ' . $decartApiKey,
            'Accept: application/json'
        ],

        CURLOPT_RETURNTRANSFER => true,

        CURLOPT_TIMEOUT => 20,

        CURLOPT_CONNECTTIMEOUT => 10,
    ]
);

$statusResponse = curl_exec($ch);
$curlError = curl_error($ch);
$statusHttpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

curl_close($ch);

if ($statusResponse === false) {

    $pollErrors++;

    $_SESSION['face_jobs'][$jobId]['poll_errors'] = $pollErrors;

    file_put_contents(
        $testLog,
        date('Y-m-d H:i:s') .
        " - status cURL error for job {$jobId} (attempt {$pollErrors}/" .
        MAX_CONSECUTIVE_POLL_ERRORS . "): {$curlError}\n",
        FILE_APPEND
    );

    if ($pollErrors >= MAX_CONSECUTIVE_POLL_ERRORS) {

        jsonResponse(
            false,
            'Lost connection to Decart while checking the job status.',
            502,
            [
                'curl_error' => $curlError
            ]
        );
    }

    /* Tell the browser to just try again shortly — this single miss
       is not treated as a failure. */
    jsonResponse(
        true,
        'Temporarily unable to reach Decart, retrying...',
        200,
        [
            'status' => 'processing',
            'job_id' => $jobId,
        ]
    );
}

/* A successful poll resets the consecutive-error count. */
if ($pollErrors > 0) {
    $_SESSION['face_jobs'][$jobId]['poll_errors'] = 0;
}

$statusData = json_decode($statusResponse, true);
$jobStatus = $statusData['status'] ?? null;

file_put_contents(
    $testLog,
    date('Y-m-d H:i:s') .
    " - status poll job={$jobId} status=" . (string) $jobStatus . "\n",
    FILE_APPEND
);

if ($statusHttpCode < 200 || $statusHttpCode >= 300) {

    jsonResponse(
        false,
        'Decart returned an error while checking the job.',
        502,
        [
            'decart_http_status' => $statusHttpCode,
            'decart_response' => $statusData
        ]
    );
}


/*
|--------------------------------------------------------------------------
| Job failed
|--------------------------------------------------------------------------
*/

if ($jobStatus === 'failed' || $jobStatus === 'error') {

    unset($_SESSION['face_jobs'][$jobId]);

    $failureMessage =
        $statusData['error']
        ?? $statusData['message']
        ?? 'Decart transformation failed.';

    if (is_array($failureMessage)) {
        $failureMessage = json_encode($failureMessage);
    }

    file_put_contents(
        $testLog,
        date('Y-m-d H:i:s') . " - Decart job failed: {$jobId}\n",
        FILE_APPEND
    );

    jsonResponse(
        false,
        (string) $failureMessage,
        502,
        [
            'status' => 'failed',
            'job_id' => $jobId,
        ]
    );
}


/*
|--------------------------------------------------------------------------
| Still processing — tell the browser to poll again shortly
|--------------------------------------------------------------------------
*/

if ($jobStatus !== 'completed') {

    jsonResponse(
        true,
        'Still processing.',
        200,
        [
            'status' => 'processing',
            'job_id' => $jobId,
        ]
    );
}


/*
|--------------------------------------------------------------------------
| Completed — download the result video
|--------------------------------------------------------------------------
*/

$resultDirectory = __DIR__ . '/results';

if (!is_dir($resultDirectory)) {

    if (!mkdir($resultDirectory, 0755, true)) {

        jsonResponse(
            false,
            'Could not create result directory.',
            500
        );
    }
}

$resultFilename =
    'face-' . $userId . '-' . date('Ymd-His') . '-' .
    bin2hex(random_bytes(4)) . '.mp4';

$resultPath = $resultDirectory . '/' . $resultFilename;

$contentEndpoint =
    'https://api.decart.ai/v1/jobs/' . rawurlencode($jobId) . '/content';

/*
|--------------------------------------------------------------------------
| Retry the download itself a few times within this single request
|--------------------------------------------------------------------------
|
| FIX: this used to allow 3 attempts * 120s CURLOPT_TIMEOUT, plus
| 2 * 2s sleep() between attempts -- up to ~364 seconds in a SINGLE
| request with nothing sent back to the browser the whole time. Any
| reverse proxy, load balancer, or the browser's own XHR timeout will
| typically kill a connection sitting silent that long, which surfaces
| client-side as pollXhr.onerror -> "Lost connection while checking
| the transformation status." even though the download might well have
| succeeded on the very next attempt.
|
| The result is already-completed video, so it's still worth spending
| a couple of extra seconds per poll trying to actually get it before
| falling back to "try again on the next poll" -- but the in-request
| retry budget now has to stay small enough that the whole request
| reliably returns well inside typical proxy read-timeouts (~60s). The
| cross-poll tolerance below (download_errors / MAX_CONSECUTIVE_
| DOWNLOAD_ERRORS) is what actually absorbs anything slower than that,
| across separate 3-second polls from the browser -- it does not need
| this in-request loop to be long to do its job.
|
|--------------------------------------------------------------------------
*/
const MAX_DOWNLOAD_ATTEMPTS_PER_CALL = 2;

$contentSuccess = false;
$contentCurlError = '';
$contentHttpCode = 0;

for ($downloadAttempt = 1; $downloadAttempt <= MAX_DOWNLOAD_ATTEMPTS_PER_CALL; $downloadAttempt++) {

    $contentFile = fopen($resultPath, 'wb');

    if ($contentFile === false) {

        jsonResponse(
            false,
            'Could not create the result video file.',
            500
        );
    }

    $contentCh = curl_init($contentEndpoint);
    apply_dns_workaround($contentCh, 'api.decart.ai');

    curl_setopt_array(
        $contentCh,
        [
            CURLOPT_HTTPGET => true,

            CURLOPT_HTTPHEADER => [
                'x-api-key: ' . $decartApiKey
            ],

            CURLOPT_FILE => $contentFile,

            /*
             * Kept well under typical proxy read timeouts (~60s) so a
             * stuck attempt fails fast instead of silently starving
             * the connection until something in front of PHP kills
             * it. See the FIX note above the loop.
             */
            CURLOPT_TIMEOUT => 25,

            CURLOPT_CONNECTTIMEOUT => 10,
        ]
    );

    $contentSuccess = curl_exec($contentCh);
    $contentCurlError = curl_error($contentCh);
    $contentHttpCode = curl_getinfo($contentCh, CURLINFO_HTTP_CODE);

    curl_close($contentCh);
    fclose($contentFile);

    if (
        $contentSuccess !== false &&
        $contentHttpCode >= 200 &&
        $contentHttpCode < 300
    ) {
        break;
    }

    if (file_exists($resultPath)) {
        unlink($resultPath);
    }

    file_put_contents(
        $testLog,
        date('Y-m-d H:i:s') .
        " - download attempt {$downloadAttempt}/" . MAX_DOWNLOAD_ATTEMPTS_PER_CALL .
        " failed for job {$jobId}. HTTP={$contentHttpCode} error={$contentCurlError}\n",
        FILE_APPEND
    );

    /* Short, fixed pause -- not a multi-second sleep. Whatever this
       in-request loop can't recover from in a couple hundred ms gets
       handed off to the cross-poll retry below instead. */
    if ($downloadAttempt < MAX_DOWNLOAD_ATTEMPTS_PER_CALL) {
        usleep(300000); // 0.3s
    }
}

/*
 * The job succeeded on Decart's side — losing the download here is a
 * transient network problem, not a real failure. On top of the
 * internal retries just above, also tolerate this across separate
 * polls (the browser calls status.php again a few seconds later),
 * only giving up for real after several consecutive misses.
 */

const MAX_CONSECUTIVE_DOWNLOAD_ERRORS = 10;

$downloadErrors = (int) ($job['download_errors'] ?? 0);

if (
    $contentSuccess === false ||
    $contentHttpCode < 200 ||
    $contentHttpCode >= 300
) {

    $downloadErrors++;

    $_SESSION['face_jobs'][$jobId]['download_errors'] = $downloadErrors;

    file_put_contents(
        $testLog,
        date('Y-m-d H:i:s') .
        " - result download failed for job {$jobId} after {$downloadAttempt} in-call attempts (poll attempt {$downloadErrors}/" .
        MAX_CONSECUTIVE_DOWNLOAD_ERRORS .
        "). HTTP={$contentHttpCode} error={$contentCurlError}\n",
        FILE_APPEND
    );

    if ($downloadErrors >= MAX_CONSECUTIVE_DOWNLOAD_ERRORS) {

        jsonResponse(
            false,
            'Could not download the processed video from Decart.',
            502,
            [
                'decart_http_status' => $contentHttpCode,
                'curl_error' => $contentCurlError,
            ]
        );
    }

    /* Tell the browser to keep polling — the next poll will see
       status=completed again and simply retry the download. */
    jsonResponse(
        true,
        'Finishing up, retrying download...',
        200,
        [
            'status' => 'processing',
            'job_id' => $jobId,
        ]
    );
}

/* A successful download resets the consecutive-error count. */
if ($downloadErrors > 0) {
    $_SESSION['face_jobs'][$jobId]['download_errors'] = 0;
}

$resultUrl = '/backend/face/results/' . rawurlencode($resultFilename);


/*
|--------------------------------------------------------------------------
| Deduct credits now that the transformation has actually succeeded
|--------------------------------------------------------------------------
|
| Guarded with "credits_balance >= ?" so a concurrent request can't push
| the balance negative (defends against double-submits / race conditions).
| `charged` in the session flag prevents charging twice if the browser
| happens to poll again after this succeeds.
|
|--------------------------------------------------------------------------
*/

$creditsRequired = (int) $job['credits_required'];

$deductStmt = $conn->prepare(
    "UPDATE users
     SET credits_balance = credits_balance - ?
     WHERE id = ? AND credits_balance >= ?"
);

$deductStmt->bind_param(
    "dii",
    $creditsRequired,
    $userId,
    $creditsRequired
);

$deductStmt->execute();

$deductionSucceeded = $deductStmt->affected_rows > 0;

$deductStmt->close();

if (!$deductionSucceeded) {

    file_put_contents(
        $testLog,
        date('Y-m-d H:i:s') .
        " - WARNING: credit deduction did not apply (balance may have changed) for user {$userId}, job {$jobId}\n",
        FILE_APPEND
    );
}


/*
|--------------------------------------------------------------------------
| Fetch updated balance to return to the frontend
|--------------------------------------------------------------------------
*/

$newBalance = null;

$refreshStmt = $conn->prepare(
    "SELECT credits_balance FROM users WHERE id = ? LIMIT 1"
);

$refreshStmt->bind_param("i", $userId);
$refreshStmt->execute();

$refreshResult = $refreshStmt->get_result();
$refreshRow = $refreshResult->fetch_assoc();

$refreshStmt->close();

if ($refreshRow) {
    $newBalance = (float) $refreshRow['credits_balance'];
}


/*
|--------------------------------------------------------------------------
| Mark job as charged/completed in the session so re-polls just replay it
|--------------------------------------------------------------------------
*/

$_SESSION['face_jobs'][$jobId]['charged'] = true;
$_SESSION['face_jobs'][$jobId]['result_url'] = $resultUrl;


/*
|--------------------------------------------------------------------------
| Success
|--------------------------------------------------------------------------
*/

file_put_contents(
    $testLog,
    date('Y-m-d H:i:s') .
    " - TRANSFORMATION COMPLETED SUCCESSFULLY for job {$jobId}. credits_charged={$creditsRequired} new_balance=" .
    (string) $newBalance . "\n",
    FILE_APPEND
);

jsonResponse(
    true,
    'Video transformation completed successfully.',
    200,
    [
        'status' => 'completed',
        'job_id' => $jobId,
        'quality' => $job['quality'] ?? 'standard',
        'result_url' => $resultUrl,
        'download_url' => $resultUrl,
        'result_filename' => $resultFilename,
        'credits_charged' => $creditsRequired,
        'credits_balance' => $newBalance,
    ]
);
