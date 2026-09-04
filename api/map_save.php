<?php
require_once __DIR__ . '/_auth.php';
require_admin_api();
header('Content-Type: application/json');

define('MAP_IMAGE_MAX_DIMENSION', 4096);

$action = $_POST['action'] ?? '';
$maps = read_json(APP_ROOT . '/data/maps.json', []);

function find_map_index(&$maps, $id) {
    foreach ($maps as $i => $m) {
        if ($m['id'] === $id) {
            return $i;
        }
    }
    return -1;
}

// Wandelt einen php.ini-Größenwert ("128M", "1G", "-1") in Bytes um. 0 = kein Limit.
function parse_php_size($val) {
    $val = trim((string) $val);
    if ($val === '' || $val === '-1') return 0;
    $unit = strtolower(substr($val, -1));
    $num = (int) $val;
    switch ($unit) {
        case 'g': return $num * 1024 * 1024 * 1024;
        case 'm': return $num * 1024 * 1024;
        case 'k': return $num * 1024;
        default:  return (int) $val;
    }
}

// Skaliert $destPath bei Bedarf auf MAP_IMAGE_MAX_DIMENSION herunter (längste Kante).
// Rückgabe: ['width'=>.., 'height'=>..] bei Erfolg, sonst null -- Original bleibt dann
// unverändert liegen (kein Fehler nach außen, nur kein Resize).
function resize_image_if_needed($destPath, $mime, $origWidth, $origHeight) {
    if (!extension_loaded('gd')) return null;
    if (max($origWidth, $origHeight) <= MAP_IMAGE_MAX_DIMENSION) return null;

    // Grobe Schätzung des GD-Decode-Speicherbedarfs, BEVOR imagecreatefrom* läuft --
    // "Allowed memory size exhausted" ist in PHP nicht catchable, daher lieber vorher
    // abschätzen und im Zweifel den Resize-Versuch überspringen.
    $estimatedBytes = (int) ($origWidth * $origHeight * 4 * 1.8);
    $limit = parse_php_size(ini_get('memory_limit'));
    if ($limit > 0 && $limit < $estimatedBytes) {
        @ini_set('memory_limit', (ceil($estimatedBytes / 1048576) + 32) . 'M');
        $limit = parse_php_size(ini_get('memory_limit'));
    }
    if ($limit > 0 && $limit < $estimatedBytes) return null;

    $src = null;
    switch ($mime) {
        case 'image/jpeg': $src = @imagecreatefromjpeg($destPath); break;
        case 'image/png':  $src = @imagecreatefrompng($destPath); break;
        case 'image/webp': $src = @imagecreatefromwebp($destPath); break;
    }
    if (!$src) return null;

    $ratio = min(MAP_IMAGE_MAX_DIMENSION / $origWidth, MAP_IMAGE_MAX_DIMENSION / $origHeight);
    $newWidth = max(1, (int) round($origWidth * $ratio));
    $newHeight = max(1, (int) round($origHeight * $ratio));

    $dst = @imagecreatetruecolor($newWidth, $newHeight);
    if (!$dst) { imagedestroy($src); return null; }
    if ($mime === 'image/png' || $mime === 'image/webp') {
        imagealphablending($dst, false);
        imagesavealpha($dst, true);
        $transparent = imagecolorallocatealpha($dst, 0, 0, 0, 127);
        imagefilledrectangle($dst, 0, 0, $newWidth, $newHeight, $transparent);
    }

    $ok = @imagecopyresampled($dst, $src, 0, 0, 0, 0, $newWidth, $newHeight, $origWidth, $origHeight);
    imagedestroy($src);
    if (!$ok) { imagedestroy($dst); return null; }

    $tmpOut = $destPath . '.tmp' . uniqid();
    $written = false;
    switch ($mime) {
        case 'image/jpeg': $written = @imagejpeg($dst, $tmpOut, 85); break;
        case 'image/png':  $written = @imagepng($dst, $tmpOut, 6); break;
        case 'image/webp': $written = @imagewebp($dst, $tmpOut, 85); break;
    }
    imagedestroy($dst);
    if (!$written || !@rename($tmpOut, $destPath)) { @unlink($tmpOut); return null; }

    return ['width' => $newWidth, 'height' => $newHeight];
}

function save_uploaded_image($fileField, $destDir, $destName) {
    if (!isset($_FILES[$fileField]) || $_FILES[$fileField]['error'] !== UPLOAD_ERR_OK) {
        return null;
    }
    $tmpPath = $_FILES[$fileField]['tmp_name'];
    $info = @getimagesize($tmpPath);
    if ($info === false) {
        return null;
    }
    $allowed = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
    $ext = $allowed[$info['mime']] ?? null;
    if ($ext === null) {
        return null;
    }
    if (!is_dir($destDir)) {
        mkdir($destDir, 0775, true);
    }
    $filename = $destName . '.' . $ext;
    $destPath = $destDir . '/' . $filename;
    if (!move_uploaded_file($tmpPath, $destPath)) {
        return null;
    }

    $width = $info[0];
    $height = $info[1];
    $resized = resize_image_if_needed($destPath, $info['mime'], $width, $height);
    if ($resized !== null) {
        $width = $resized['width'];
        $height = $resized['height'];
    }

    return ['filename' => $filename, 'width' => $width, 'height' => $height];
}

if ($action === 'create') {
    $name = trim($_POST['name'] ?? '');
    if ($name === '') {
        http_response_code(400);
        echo json_encode(['error' => 'name required']);
        exit;
    }
    $id = unique_map_id(slugify($name), $maps);
    $dir = APP_ROOT . '/maps/' . $id;

    $base = save_uploaded_image('baseImage', $dir, 'base');
    if ($base === null) {
        http_response_code(400);
        echo json_encode(['error' => 'baseImage missing or invalid (jpg/png/webp only)']);
        exit;
    }
    $fog = save_uploaded_image('fogImage', $dir, 'fog');
    if ($fog === null) {
        http_response_code(400);
        echo json_encode(['error' => 'fogImage missing or invalid (jpg/png/webp only)']);
        exit;
    }

    $map = [
        'id' => $id,
        'name' => $name,
        'baseImage' => 'maps/' . $id . '/' . $base['filename'],
        'fogImage' => 'maps/' . $id . '/' . $fog['filename'],
        'imageWidth' => $base['width'],
        'imageHeight' => $base['height'],
        'hexSize' => 50,
        'orientation' => 'pointy',
        'originX' => 25,
        'originY' => 25,
        'sightRadius' => 0,
        'startQ' => 0,
        'startR' => 0,
    ];
    $maps[] = $map;
    write_json_atomic(APP_ROOT . '/data/maps.json', $maps);
    echo json_encode($map);
    exit;
}

if ($action === 'update') {
    $id = $_POST['id'] ?? '';
    $i = find_map_index($maps, $id);
    if ($i === -1) {
        http_response_code(404);
        echo json_encode(['error' => 'map not found']);
        exit;
    }

    if (isset($_POST['name']) && trim($_POST['name']) !== '') {
        $maps[$i]['name'] = trim($_POST['name']);
    }
    $intFields = ['sightRadius', 'startQ', 'startR'];
    foreach (['hexSize', 'originX', 'originY', 'sightRadius', 'startQ', 'startR'] as $field) {
        if (isset($_POST[$field]) && is_numeric($_POST[$field])) {
            $maps[$i][$field] = in_array($field, $intFields, true) ? (int) $_POST[$field] : (float) $_POST[$field];
        }
    }
    if (isset($_POST['orientation']) && in_array($_POST['orientation'], ['pointy', 'flat'], true)) {
        $maps[$i]['orientation'] = $_POST['orientation'];
    }

    $dir = APP_ROOT . '/maps/' . $id;
    $base = save_uploaded_image('baseImage', $dir, 'base');
    if ($base !== null) {
        $maps[$i]['baseImage'] = 'maps/' . $id . '/' . $base['filename'];
        $maps[$i]['imageWidth'] = $base['width'];
        $maps[$i]['imageHeight'] = $base['height'];
    }
    $fog = save_uploaded_image('fogImage', $dir, 'fog');
    if ($fog !== null) {
        $maps[$i]['fogImage'] = 'maps/' . $id . '/' . $fog['filename'];
    }

    write_json_atomic(APP_ROOT . '/data/maps.json', $maps);
    echo json_encode($maps[$i]);
    exit;
}

http_response_code(400);
echo json_encode(['error' => 'unknown action']);
