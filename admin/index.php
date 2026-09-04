<?php
require_once __DIR__ . '/../api/_auth.php';
require_admin_page('../');
?>
<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Hexcrawl – Admin</title>
<link rel="stylesheet" href="../assets/css/style.css">
</head>
<body class="admin-page">
<div class="admin-header">
  <h1>Karten verwalten</h1>
  <div>
    <a href="../index.php"><button type="button">Zur Karte</button></a>
    <a href="../logout.php"><button type="button">Logout</button></a>
  </div>
</div>

<ul id="map-list" class="map-list"></ul>

<div class="panel">
  <h2>Neue Karte anlegen</h2>
  <form id="create-form">
    <div class="field-row">
      <div class="field">
        <label for="new-name">Name</label>
        <input type="text" id="new-name" required>
      </div>
      <div class="field">
        <label for="new-base">Basiskarte (Bild)</label>
        <input type="file" id="new-base" accept="image/*" required>
      </div>
      <div class="field">
        <label for="new-fog">Nebelbild</label>
        <input type="file" id="new-fog" accept="image/*" required>
      </div>
    </div>
    <button type="submit" class="primary">Anlegen &amp; kalibrieren</button>
  </form>
</div>

<div class="panel" id="calibrate-panel" hidden>
  <h2>Kalibrierung</h2>
  <div class="field-row">
    <div class="field">
      <label for="cal-name">Name</label>
      <input type="text" id="cal-name">
    </div>
    <div class="field">
      <label for="cal-hexsize">Hexgröße (px)</label>
      <input type="number" id="cal-hexsize" min="5" max="500" step="1">
    </div>
    <div class="field">
      <label for="cal-originx">Ursprung X (px)</label>
      <input type="number" id="cal-originx" step="1">
    </div>
    <div class="field">
      <label for="cal-originy">Ursprung Y (px)</label>
      <input type="number" id="cal-originy" step="1">
    </div>
    <div class="field">
      <label for="cal-orientation">Ausrichtung</label>
      <select id="cal-orientation">
        <option value="pointy">Spitze oben</option>
        <option value="flat">Kante oben</option>
      </select>
    </div>
    <div class="field">
      <label for="cal-sight">Sichtradius (Hexe)</label>
      <input type="number" id="cal-sight" min="0" max="10" step="1">
    </div>
  </div>
  <div class="field-row">
    <div class="field">
      <label for="cal-base-replace">Basiskarte ersetzen (optional)</label>
      <input type="file" id="cal-base-replace" accept="image/*">
    </div>
    <div class="field">
      <label for="cal-fog-replace">Nebelbild ersetzen (optional)</label>
      <input type="file" id="cal-fog-replace" accept="image/*">
    </div>
  </div>
  <p style="color:var(--muted); margin-top:0;">
    Rotes Raster über das Kartenbild ziehen, bis es zu den echten Hex-Feldern passt.
    Der rote Punkt markiert den Ursprung (Zentrum des Hex q=0, r=0). Der orangene Pin
    ist die Startposition der Spielfigur – per Drag&amp;Drop platzieren.
  </p>
  <div class="field-row">
    <div class="field">
      <button type="button" id="cal-overlay-toggle" class="toggle-btn">Nebel-Overlay: Aus</button>
    </div>
  </div>
  <div class="calibrate-wrap" id="calibrate-wrap">
    <div style="position:relative; width:max-content;">
      <img id="cal-image" style="display:block; max-width:none;" alt="Kartenbild">
      <img id="cal-fog-image" style="position:absolute; top:0; left:0; max-width:none; display:block; opacity:0.7; pointer-events:none;" alt="Nebelbild" hidden>
      <canvas id="cal-canvas" style="position:absolute; top:0; left:0;"></canvas>
      <div id="cal-token" class="token" title="Startposition Spielfigur"></div>
    </div>
  </div>
  <p style="margin-top:0.75rem;">
    <button type="button" id="cal-save" class="primary">Speichern</button>
    <button type="button" id="cal-close">Schließen</button>
  </p>
</div>

<script src="../assets/js/hexgrid.js"></script>
<script>window.API_BASE = '../api/'; window.IMG_BASE = '../';</script>
<script src="../assets/js/admin.js"></script>
</body>
</html>
