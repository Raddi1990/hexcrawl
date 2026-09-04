<?php
require_once __DIR__ . '/api/_auth.php';
?>
<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<title>Hexcrawl</title>
<link rel="stylesheet" href="assets/css/style.css">
</head>
<body class="viewer">
<header>
  <h1>Hexcrawl</h1>
  <select id="map-select"></select>
  <button type="button" id="grid-toggle" class="toggle-btn">Raster: Aus</button>
  <?php if (!empty($_SESSION['is_admin'])): ?>
    <button type="button" id="control-panel-toggle">Steuerung</button>
  <?php endif; ?>
  <a href="admin/index.php"><button type="button">Admin</button></a>
  <?php if (!empty($_SESSION['is_admin'])): ?>
    <a href="logout.php"><button type="button">Admin-Logout</button></a>
  <?php endif; ?>
</header>
<?php if (!empty($_SESSION['is_admin'])): ?>
<div id="control-panel" class="panel control-panel hidden">
  <h2>Steuerung</h2>
  <button type="button" id="fog-reset">Nebel zurücksetzen</button>
  <label class="control-row">Overlay-Transparenz
    <input type="range" id="fog-opacity" min="0" max="100" step="1" value="100">
  </label>
  <button type="button" id="token-visible-toggle" class="toggle-btn">Token für Spieler: Versteckt</button>
  <button type="button" id="paint-mode-toggle" class="toggle-btn">Hex-Malmodus: Aus</button>
  <button type="button" id="paint-undo" disabled>Zurück</button>
</div>
<?php endif; ?>
<div id="viewport" class="map-viewport">
  <div id="world" class="map-world">
    <img id="base-image" alt="Karte">
    <canvas id="fog-canvas"></canvas>
    <canvas id="grid-canvas"></canvas>
    <div id="token" class="token no-pan" title="Spielfigur"></div>
  </div>
</div>
<script src="assets/js/hexgrid.js"></script>
<script src="assets/js/panzoom.js"></script>
<script>
  window.API_BASE = 'api/';
  window.IS_ADMIN = <?= !empty($_SESSION['is_admin']) ? 'true' : 'false' ?>;
</script>
<script src="assets/js/viewer.js"></script>
</body>
</html>
