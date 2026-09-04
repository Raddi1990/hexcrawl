<?php
require_once __DIR__ . '/_auth.php';
header('Content-Type: application/json');

$mapId = $_GET['mapId'] ?? '';
if ($mapId === '' || !preg_match('/^[a-z0-9-]+$/', $mapId)) {
    http_response_code(400);
    echo json_encode(['error' => 'invalid mapId']);
    exit;
}

$state = read_json(APP_ROOT . '/data/state/' . $mapId . '.json', [
    'revealedHexes' => [],
    'token' => null,
    'tokenVisible' => false,
]);
if (!array_key_exists('tokenVisible', $state)) {
    $state['tokenVisible'] = false;
}
echo json_encode($state);
