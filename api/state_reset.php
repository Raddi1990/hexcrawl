<?php
require_once __DIR__ . '/_auth.php';
require_admin_api();
header('Content-Type: application/json');

$body = json_body();
$mapId = $body['mapId'] ?? '';
if ($mapId === '' || !preg_match('/^[a-z0-9-]+$/', $mapId)) {
    http_response_code(400);
    echo json_encode(['error' => 'invalid mapId']);
    exit;
}

$maps = read_json(APP_ROOT . '/data/maps.json', []);
$exists = false;
foreach ($maps as $map) {
    if ($map['id'] === $mapId) {
        $exists = true;
        break;
    }
}
if (!$exists) {
    http_response_code(404);
    echo json_encode(['error' => 'map not found']);
    exit;
}

$statePath = APP_ROOT . '/data/state/' . $mapId . '.json';
$state = read_json($statePath, ['revealedHexes' => [], 'token' => null, 'tokenVisible' => false]);
$state['revealedHexes'] = [];
write_json_atomic($statePath, $state);

echo json_encode(['ok' => true]);
