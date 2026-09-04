<?php
// Gemeinsame Grundlagen: Session, Config-Zugriff, JSON-Helfer.
// Wird von jeder Seite/jedem Endpunkt eingebunden, führt selbst aber keine Prüfung aus
// (siehe require_admin_page / require_admin_api).

if (session_status() === PHP_SESSION_NONE) {
    session_name('hexcrawl_session');
    session_start();
}

define('APP_ROOT', realpath(__DIR__ . '/..'));

// $base ist der relative Pfad-Präfix zur Admin-Login-Seite (z.B. '../' aus admin/).
function require_admin_page($base = '') {
    if (empty($_SESSION['is_admin'])) {
        header('Location: ' . $base . 'admin_login.php');
        exit;
    }
}

function require_admin_api() {
    if (empty($_SESSION['is_admin'])) {
        http_response_code(403);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'forbidden']);
        exit;
    }
}

function load_config() {
    $path = APP_ROOT . '/data/config.php';
    if (!file_exists($path)) {
        return ['admin_username' => '', 'admin_password' => ''];
    }
    return require $path;
}

function read_json($path, $default) {
    if (!file_exists($path)) {
        return $default;
    }
    $raw = file_get_contents($path);
    $data = json_decode($raw, true);
    return $data === null ? $default : $data;
}

// Schreibt Daten als JSON, atomar via temp-Datei + rename (vermeidet kaputte Dateien
// bei gleichzeitigem/abgebrochenem Schreiben).
function write_json_atomic($path, $data) {
    $dir = dirname($path);
    if (!is_dir($dir)) {
        mkdir($dir, 0775, true);
    }
    $tmp = $path . '.tmp' . uniqid();
    file_put_contents($tmp, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
    rename($tmp, $path);
}

function json_body() {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    return $data === null ? [] : $data;
}

function slugify($text) {
    $slug = strtolower(trim($text));
    $slug = preg_replace('/[^a-z0-9]+/', '-', $slug);
    $slug = trim($slug, '-');
    return $slug === '' ? 'karte' : $slug;
}

function unique_map_id($baseSlug, $maps) {
    $existingIds = array_column($maps, 'id');
    $id = $baseSlug;
    $i = 2;
    while (in_array($id, $existingIds, true)) {
        $id = $baseSlug . '-' . $i;
        $i++;
    }
    return $id;
}
