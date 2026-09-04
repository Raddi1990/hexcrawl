(function () {
  const mapListEl = document.getElementById('map-list');
  const createForm = document.getElementById('create-form');
  const calPanel = document.getElementById('calibrate-panel');
  const calNameInput = document.getElementById('cal-name');
  const calImage = document.getElementById('cal-image');
  const calFogImage = document.getElementById('cal-fog-image');
  const calOverlayToggle = document.getElementById('cal-overlay-toggle');
  const calToken = document.getElementById('cal-token');
  const calCanvas = document.getElementById('cal-canvas');
  const calibrateWrap = document.getElementById('calibrate-wrap');
  const hexSizeInput = document.getElementById('cal-hexsize');
  const originXInput = document.getElementById('cal-originx');
  const originYInput = document.getElementById('cal-originy');
  const orientationInput = document.getElementById('cal-orientation');
  const sightInput = document.getElementById('cal-sight');
  const baseReplaceInput = document.getElementById('cal-base-replace');
  const fogReplaceInput = document.getElementById('cal-fog-replace');

  let maps = [];
  let editingMap = null;
  let startHex = { q: 0, r: 0 };
  let overlayVisible = false;

  function updateCalOverlayButton() {
    calOverlayToggle.textContent = 'Nebel-Overlay: ' + (overlayVisible ? 'An' : 'Aus');
    calOverlayToggle.classList.toggle('active', overlayVisible);
  }

  async function loadMaps() {
    const res = await fetch(API_BASE + 'maps_list.php');
    maps = await res.json();
    renderList();
  }

  function renderList() {
    mapListEl.innerHTML = '';
    if (maps.length === 0) {
      const li = document.createElement('li');
      li.textContent = 'Noch keine Karten angelegt.';
      mapListEl.appendChild(li);
      return;
    }
    for (const m of maps) {
      const li = document.createElement('li');
      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = m.name;
      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.textContent = 'Kalibrieren';
      editBtn.onclick = () => openCalibration(m);
      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.textContent = 'Löschen';
      delBtn.className = 'danger';
      delBtn.onclick = () => deleteMap(m);
      li.append(name, editBtn, delBtn);
      mapListEl.appendChild(li);
    }
  }

  createForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('new-name').value.trim();
    const baseFile = document.getElementById('new-base').files[0];
    const fogFile = document.getElementById('new-fog').files[0];
    if (!name || !baseFile || !fogFile) return;

    const fd = new FormData();
    fd.append('action', 'create');
    fd.append('name', name);
    fd.append('baseImage', baseFile);
    fd.append('fogImage', fogFile);

    const res = await fetch(API_BASE + 'map_save.php', { method: 'POST', body: fd });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert('Fehler beim Anlegen der Karte: ' + (err.error || res.status));
      return;
    }
    const newMap = await res.json();
    createForm.reset();
    await loadMaps();
    const fresh = maps.find((m) => m.id === newMap.id) || newMap;
    openCalibration(fresh);
  });

  async function deleteMap(m) {
    if (!confirm(`Karte "${m.name}" wirklich löschen? Das kann nicht rückgängig gemacht werden.`)) return;
    await fetch(API_BASE + 'map_delete.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: m.id }),
    });
    if (editingMap && editingMap.id === m.id) closeCalibration();
    await loadMaps();
  }

  function openCalibration(m) {
    editingMap = m;
    calPanel.hidden = false;
    calNameInput.value = m.name;
    hexSizeInput.value = m.hexSize;
    originXInput.value = m.originX;
    originYInput.value = m.originY;
    orientationInput.value = m.orientation;
    sightInput.value = m.sightRadius;
    baseReplaceInput.value = '';
    fogReplaceInput.value = '';

    startHex = { q: m.startQ ?? 0, r: m.startR ?? 0 };
    overlayVisible = false;
    updateCalOverlayButton();
    calFogImage.hidden = true;
    calFogImage.src = IMG_BASE + m.fogImage + '?t=' + Date.now();

    calImage.onload = () => {
      calCanvas.width = calImage.naturalWidth;
      calCanvas.height = calImage.naturalHeight;
      calFogImage.width = calImage.naturalWidth;
      calFogImage.height = calImage.naturalHeight;
      drawCalibrationGrid();
      placeCalToken();
    };
    calImage.src = IMG_BASE + m.baseImage + '?t=' + Date.now();

    calPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function closeCalibration() {
    editingMap = null;
    calPanel.hidden = true;
  }
  document.getElementById('cal-close').addEventListener('click', closeCalibration);

  calOverlayToggle.addEventListener('click', () => {
    overlayVisible = !overlayVisible;
    updateCalOverlayButton();
    calFogImage.hidden = !overlayVisible;
  });

  calibrateWrap.addEventListener('contextmenu', (e) => e.preventDefault());

  function currentCfg() {
    return {
      hexSize: Math.max(5, Number(hexSizeInput.value) || 50),
      orientation: orientationInput.value,
      originX: Number(originXInput.value) || 0,
      originY: Number(originYInput.value) || 0,
    };
  }

  function drawCalibrationGrid() {
    if (!editingMap) return;
    const ctx = calCanvas.getContext('2d');
    ctx.clearRect(0, 0, calCanvas.width, calCanvas.height);
    const cfg = currentCfg();
    ctx.strokeStyle = 'rgba(255,80,40,0.9)';
    ctx.lineWidth = 2;
    const corner1 = HexGrid.pixelToHex(0, 0, cfg);
    const corner2 = HexGrid.pixelToHex(calCanvas.width, calCanvas.height, cfg);
    const qMin = Math.min(corner1.q, corner2.q) - 2;
    const qMax = Math.max(corner1.q, corner2.q) + 2;
    const rMin = Math.min(corner1.r, corner2.r) - 2;
    const rMax = Math.max(corner1.r, corner2.r) + 2;
    for (let r = rMin; r <= rMax; r++) {
      for (let q = qMin; q <= qMax; q++) {
        const { x, y } = HexGrid.hexToPixel(q, r, cfg);
        if (x < -cfg.hexSize || x > calCanvas.width + cfg.hexSize) continue;
        if (y < -cfg.hexSize || y > calCanvas.height + cfg.hexSize) continue;
        HexGrid.hexPath(ctx, x, y, cfg.hexSize, cfg.orientation);
        ctx.stroke();
      }
    }
    ctx.fillStyle = 'rgba(255,80,40,0.9)';
    ctx.beginPath();
    ctx.arc(cfg.originX, cfg.originY, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  function placeCalToken() {
    if (!editingMap) return;
    const cfg = currentCfg();
    const { x, y } = HexGrid.hexToPixel(startHex.q, startHex.r, cfg);
    calToken.style.left = x + 'px';
    calToken.style.top = y + 'px';
  }

  for (const input of [hexSizeInput, originXInput, originYInput, orientationInput]) {
    input.addEventListener('input', () => {
      drawCalibrationGrid();
      placeCalToken();
    });
  }

  // --- Startposition Spielfigur per Drag & Drop ---
  let draggingToken = false;
  calToken.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    draggingToken = true;
    calToken.setPointerCapture(e.pointerId);
    calToken.classList.add('dragging');
  });
  calToken.addEventListener('pointermove', (e) => {
    if (!draggingToken) return;
    e.stopPropagation();
    const rect = calImage.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    calToken.style.left = x + 'px';
    calToken.style.top = y + 'px';
  });
  calToken.addEventListener('pointerup', (e) => {
    if (!draggingToken) return;
    e.stopPropagation();
    draggingToken = false;
    calToken.classList.remove('dragging');
    const rect = calImage.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    startHex = HexGrid.pixelToHex(x, y, currentCfg());
    placeCalToken();
  });

  document.getElementById('cal-save').addEventListener('click', async () => {
    if (!editingMap) return;
    const fd = new FormData();
    fd.append('action', 'update');
    fd.append('id', editingMap.id);
    fd.append('name', calNameInput.value.trim() || editingMap.name);
    fd.append('hexSize', hexSizeInput.value);
    fd.append('originX', originXInput.value);
    fd.append('originY', originYInput.value);
    fd.append('orientation', orientationInput.value);
    fd.append('sightRadius', sightInput.value);
    fd.append('startQ', startHex.q);
    fd.append('startR', startHex.r);
    if (baseReplaceInput.files[0]) fd.append('baseImage', baseReplaceInput.files[0]);
    if (fogReplaceInput.files[0]) fd.append('fogImage', fogReplaceInput.files[0]);

    const res = await fetch(API_BASE + 'map_save.php', { method: 'POST', body: fd });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert('Fehler beim Speichern: ' + (err.error || res.status));
      return;
    }
    await loadMaps();
    alert('Gespeichert.');
  });

  loadMaps();
})();
