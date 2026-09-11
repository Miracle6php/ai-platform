<?php

session_start();

require_once __DIR__ . '/../config/database.php';

/*
|--------------------------------------------------------------------------
| Only allow POST requests
|--------------------------------------------------------------------------
*/

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Location: ../../get-started.php?error=invalid_request');
    exit;
}

/*
|--------------------------------------------------------------------------
| Get form data
|--------------------------------------------------------------------------
*/

$name = trim($_POST['name'] ?? '');
$email = strtolower(trim($_POST['email'] ?? ''));
$password = $_POST['password'] ?? '';
$confirmPassword = $_POST['confirmPassword'] ?? '';

/*
|--------------------------------------------------------------------------
| Validate required fields
|--------------------------------------------------------------------------
*/

if ($name === '' || $email === '' || $password === '') {
    header('Location: ../../get-started.php?error=required');
    exit;
}

/*
|--------------------------------------------------------------------------
| Validate name
|--------------------------------------------------------------------------
*/

if (strlen($name) < 2) {
    header('Location: ../../get-started.php?error=name');
    exit;
}

/*
|--------------------------------------------------------------------------
| Validate Gmail address
|--------------------------------------------------------------------------
*/

if (!preg_match('/^[a-zA-Z0-9._%+-]+@gmail\.com$/', $email)) {
    header('Location: ../../get-started.php?error=email');
    exit;
}

/*
|--------------------------------------------------------------------------
| Validate password
|--------------------------------------------------------------------------
*/

if (strlen($password) < 8) {
    header('Location: ../../get-started.php?error=password');
    exit;
}

/*
|--------------------------------------------------------------------------
| Confirm password
|--------------------------------------------------------------------------
*/

if ($confirmPassword !== $password) {
    header('Location: ../../get-started.php?error=match');
    exit;
}

/*
|--------------------------------------------------------------------------
| Check if email already exists
|--------------------------------------------------------------------------
*/

$stmt = $conn->prepare(
    "SELECT id
     FROM users
     WHERE email = ?
     LIMIT 1"
);

if (!$stmt) {
    header('Location: ../../get-started.php?error=database');
    exit;
}

$stmt->bind_param('s', $email);
$stmt->execute();

$result = $stmt->get_result();

if ($result->num_rows > 0) {

    $stmt->close();
    $conn->close();

    header('Location: ../../get-started.php?error=exists');
    exit;
}

$stmt->close();

/*
|--------------------------------------------------------------------------
| Hash password
|--------------------------------------------------------------------------
*/

$passwordHash = password_hash($password, PASSWORD_DEFAULT);

/*
|--------------------------------------------------------------------------
| Create user
|--------------------------------------------------------------------------
*/

$stmt = $conn->prepare(
    "INSERT INTO users
    (name, email, password_hash, credits_balance, status)
    VALUES (?, ?, ?, 0.00, 'active')"
);

if (!$stmt) {
    $conn->close();

    header('Location: ../../get-started.php?error=database');
    exit;
}

$stmt->bind_param(
    'sss',
    $name,
    $email,
    $passwordHash
);

/*
|--------------------------------------------------------------------------
| Insert account
|--------------------------------------------------------------------------
*/

if (!$stmt->execute()) {

    if ($conn->errno === 1062) {

        $stmt->close();
        $conn->close();

        header('Location: ../../get-started.php?error=exists');
        exit;
    }

    $stmt->close();
    $conn->close();

    header('Location: ../../get-started.php?error=create');
    exit;
}

/*
|--------------------------------------------------------------------------
| Get newly created user ID
|--------------------------------------------------------------------------
*/

$userId = $stmt->insert_id;

/*
|--------------------------------------------------------------------------
| Log the user in
|--------------------------------------------------------------------------
*/

session_regenerate_id(true);

$_SESSION['user_id'] = (int) $userId;
$_SESSION['user_name'] = $name;
$_SESSION['user_email'] = $email;
$_SESSION['logged_in'] = true;

/*
|--------------------------------------------------------------------------
| Clean up
|--------------------------------------------------------------------------
*/

$stmt->close();
$conn->close();

/*
|--------------------------------------------------------------------------
| Send user to dashboard
|--------------------------------------------------------------------------
*/

header('Location: ../../dashboard.php');
exit;

?>