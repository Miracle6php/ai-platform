<?php

session_start();

header('Content-Type: application/json');


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
        __DIR__ . '/transform-test.log',
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
| Log received POST information
|--------------------------------------------------------------------------
*/

file_put_contents(
    $testLog,
    date('Y-m-d H:i:s') .
    " - POST request received\n",
    FILE_APPEND
);


/*
|--------------------------------------------------------------------------
| Log received files
|--------------------------------------------------------------------------
*/

$videoReceived = isset($_FILES['video']) ? 'YES' : 'NO';
$referenceReceived = isset($_FILES['reference']) ? 'YES' : 'NO';

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
| PHP upload error messages
|--------------------------------------------------------------------------
*/

$uploadErrors = [

    UPLOAD_ERR_OK =>
        'Upload successful.',

    UPLOAD_ERR_INI_SIZE =>
        'The video exceeds the PHP upload_max_filesize limit.',

    UPLOAD_ERR_FORM_SIZE =>
        'The video exceeds the form upload limit.',

    UPLOAD_ERR_PARTIAL =>
        'The video was only partially uploaded.',

    UPLOAD_ERR_NO_FILE =>
        'No video file was received by PHP.',

    UPLOAD_ERR_NO_TMP_DIR =>
        'PHP temporary upload directory is missing.',

    UPLOAD_ERR_CANT_WRITE =>
        'PHP could not write the uploaded video to its temporary location.',

    UPLOAD_ERR_EXTENSION =>
        'A PHP extension stopped the video upload.'
];


/*
|--------------------------------------------------------------------------
| Check video upload error
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
| Check reference upload error
|--------------------------------------------------------------------------
*/

if ($reference['error'] !== UPLOAD_ERR_OK) {

    $errorCode = (int) $reference['error'];

    $message =
        $uploadErrors[$errorCode]
        ?? 'Unknown reference image upload error.';


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

$maxVideoSize = 10 * 1024 * 1024;

$maxReferenceSize = 10 * 1024 * 1024;


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
| Detect uploaded MIME types
|--------------------------------------------------------------------------
|
| Fileinfo is not available in this PHP installation.
| PHP already provides the browser-reported MIME type
| through the $_FILES array.
|
|--------------------------------------------------------------------------
*/

$videoMime = $video['type'] ?? '';

$referenceMime = $reference['type'] ?? '';


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

if (!in_array($videoMime, $allowedVideoTypes, true)) {

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

if (!in_array($referenceMime, $allowedReferenceTypes, true)) {

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

$quality = $_POST['quality'] ?? 'standard';

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
| TEMPORARY TEST ONLY
|--------------------------------------------------------------------------
|
| At this stage we are testing that PHP receives both files correctly.
|
| We are NOT calling Python yet.
| We are NOT calling Decart yet.
|
|--------------------------------------------------------------------------
*/

file_put_contents(
    $testLog,
    date('Y-m-d H:i:s') .
    " - BOTH FILES RECEIVED SUCCESSFULLY\n",
    FILE_APPEND
);


/*
|--------------------------------------------------------------------------
| Temporary response
|--------------------------------------------------------------------------
*/

jsonResponse(
    true,
    'Video and reference image received successfully.',
    200,
    [
        'video_received' => true,
        'reference_received' => true,
        'video_size' => $video['size'],
        'video_type' => $videoMime,
        'reference_size' => $reference['size'],
        'reference_type' => $referenceMime,
        'quality' => $quality
    ]
);