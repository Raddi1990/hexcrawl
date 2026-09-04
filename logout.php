<?php
require_once __DIR__ . '/api/_auth.php';
$_SESSION = [];
session_destroy();
header('Location: index.php');
