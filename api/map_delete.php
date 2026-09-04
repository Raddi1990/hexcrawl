<?php
require_once __DIR__ . '/_auth.php';
require_admin_api();
header('Content-Type: application/json');

$body = json_body();
$id = $body['id'] ?? '';
if ($id === '' || !preg_match('/^[a-z0-9-]+$/', $id)) {
    http_response_code(400);
    echo json_encode(['error' => 'invalid id']);
    exit;
}

$maps = read_json(APP_ROOT . '/data/maps.json', []);
$newMaps = array_values(array_filter($maps, fn($m) => $m['id'] !== $id));
if (count($newMaps) === count($maps)) {
    http_response_code(404);
    echo json_encode(['error' => 'map not found']);
    exit;
}
write_json_atomic(APP_ROOT . '/data/maps.json', $newMaps);

$dir = APP_ROOT . '/maps/' . $id;
if (is_dir($dir)) {
    foreach (glob($dir . '/*') as $f) {
        unlink($f);
    }
    rmdir($dir);
}

$statePath = APP_ROOT . '/data/state/' . $id . '.json';
if (file_exists($statePath)) {
    unlink($statePath);
}

echo json_encode(['ok' => true]);
