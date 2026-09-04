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

$revealedHexesRaw = $body['revealedHexes'] ?? [];
if (!is_array($revealedHexesRaw)) {
    http_response_code(400);
    echo json_encode(['error' => 'revealedHexes must be an array']);
    exit;
}
$revealedHexes = [];
foreach ($revealedHexesRaw as $hex) {
    if (is_string($hex) && preg_match('/^-?\d+,-?\d+$/', $hex)) {
        $revealedHexes[] = $hex;
    }
}
$revealedHexes = array_values(array_unique($revealedHexes));

$token = null;
if (isset($body['token']) && is_array($body['token'])
    && isset($body['token']['q']) && isset($body['token']['r'])
    && is_numeric($body['token']['q']) && is_numeric($body['token']['r'])) {
    $token = ['q' => (int) $body['token']['q'], 'r' => (int) $body['token']['r']];
}

$statePath = APP_ROOT . '/data/state/' . $mapId . '.json';
$existing = read_json($statePath, ['revealedHexes' => [], 'token' => null, 'tokenVisible' => false]);
write_json_atomic($statePath, [
    'revealedHexes' => $revealedHexes,
    'token' => $token,
    'tokenVisible' => $existing['tokenVisible'] ?? false,
]);

echo json_encode(['ok' => true]);
