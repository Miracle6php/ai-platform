<?php

session_start();

require_once __DIR__ . '/../config/database.php';


/*
|--------------------------------------------------------------------------
| Request method
|--------------------------------------------------------------------------
*/

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {

    header('Location: ../../login.php?error=invalid_request');
    exit;
}


/*
|--------------------------------------------------------------------------
| Get form data
|--------------------------------------------------------------------------
*/

$email = strtolower(trim($_POST['email'] ?? ''));
$password = $_POST['password'] ?? '';


/*
|--------------------------------------------------------------------------
| Validate required fields
|--------------------------------------------------------------------------
*/

if ($email === '' || $password === '') {

    header('Location: ../../login.php?error=required');
    exit;
}


/*
|--------------------------------------------------------------------------
| Validate Gmail
|--------------------------------------------------------------------------
*/

if (!preg_match('/^[a-zA-Z0-9._%+-]+@gmail\.com$/', $email)) {

    header('Location: ../../login.php?error=email');
    exit;
}


/*
|--------------------------------------------------------------------------
| Find user
|--------------------------------------------------------------------------
*/

$stmt = $conn->prepare(
    "SELECT id, name, email, password_hash, credits_balance, status
     FROM users
     WHERE email = ?
     LIMIT 1"
);

if (!$stmt) {

    $conn->close();

    header('Location: ../../login.php?error=database');
    exit;
}


$stmt->bind_param('s', $email);

$stmt->execute();

$result = $stmt->get_result();


/*
|--------------------------------------------------------------------------
| User not found
|--------------------------------------------------------------------------
*/

if ($result->num_rows === 0) {

    $stmt->close();
    $conn->close();

    header('Location: ../../login.php?error=invalid');
    exit;
}


$user = $result->fetch_assoc();

$stmt->close();


/*
|--------------------------------------------------------------------------
| Check account status
|--------------------------------------------------------------------------
*/

if ($user['status'] !== 'active') {

    $conn->close();

    header('Location: ../../login.php?error=inactive');
    exit;
}


/*
|--------------------------------------------------------------------------
| Verify password
|--------------------------------------------------------------------------
*/

if (!password_verify($password, $user['password_hash'])) {

    $conn->close();

    header('Location: ../../login.php?error=invalid');
    exit;
}


/*
|--------------------------------------------------------------------------
| Create secure login session
|--------------------------------------------------------------------------
*/

session_regenerate_id(true);

$_SESSION['user_id'] = (int) $user['id'];

$_SESSION['user_name'] = $user['name'];

$_SESSION['user_email'] = $user['email'];

$_SESSION['logged_in'] = true;


/*
|--------------------------------------------------------------------------
| Clean up database connection
|--------------------------------------------------------------------------
*/

$conn->close();


/*
|--------------------------------------------------------------------------
| Login successful
|--------------------------------------------------------------------------
*/

header('Location: ../../dashboard.php');

exit;

?>