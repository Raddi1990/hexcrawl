<?php
require_once __DIR__ . '/_auth.php';
header('Content-Type: application/json');

$maps = read_json(APP_ROOT . '/data/maps.json', []);
echo json_encode($maps);
