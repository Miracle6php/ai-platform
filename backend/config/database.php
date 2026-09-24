<?php

/*
|--------------------------------------------------------------------------
| Database connection
|--------------------------------------------------------------------------
|
| Reads Railway's auto-injected MySQL variables when present
| (MYSQLHOST, MYSQLPORT, MYSQLUSER, MYSQLPASSWORD, MYSQLDATABASE — set
| automatically when a MySQL service is added to a Railway project and
| linked to this one). Falls back to the old local dev values so this
| still works unchanged on a local PHP server outside Railway.
|
|--------------------------------------------------------------------------
*/

$host     = getenv('MYSQLHOST')     ?: 'localhost';
$port     = getenv('MYSQLPORT')     ?: 3306;
$dbname   = getenv('MYSQLDATABASE') ?: 'aistudio';
$username = getenv('MYSQLUSER')     ?: 'aistudio_user';
$password = getenv('MYSQLPASSWORD') ?: 'Studio123?';

$conn = new mysqli($host, $username, $password, $dbname, (int) $port);

if ($conn->connect_error) {
    die("Database connection failed.");
}

$conn->set_charset("utf8mb4");
