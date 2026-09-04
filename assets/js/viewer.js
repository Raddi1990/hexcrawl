(function () {
  const IS_ADMIN = window.IS_ADMIN === true;

  const mapSelect = document.getElementById('map-select');
  const viewport = document.getElementById('viewport');
  const world = document.getElementById('world');
  const baseImage = document.getElementById('base-image');
  const fogCanvas = document.getElementById('fog-canvas');
  const gridCanvas = document.getElementById('grid-canvas');
  const gridToggle = document.getElementById('grid-toggle');
  const fogResetBtn = document.getElementById('fog-reset');
  const fogOpacityInput = document.getElementById('fog-opacity');
  const controlPanelToggle = document.getElementById('control-panel-toggle');
  const controlPanel = document.getElementById('control-panel');
  const tokenVisibleToggle = document.getElementById('token-visible-toggle');
  const paintModeToggle = document.getElementById('paint-mode-toggle');
  const paintUndoBtn = document.getElementById('paint-undo');
  const tokenEl = document.getElementById('token');

  let maps = [];
  let currentMap = null;
  let revealedHexes = new Set();
  let tokenHex = null;
  let tokenVisibleForPlayers = false;
  let panzoom = null;
  let saveTimer = null;
  let pollTimer = null;
  let currentFogImg = null;
  let suppressPollUntil = 0;
  let paintMode = false;
  let paintUndoStack = [];
  let gridWasOnBeforePaint = false;
  let gridVisible = false;
  let brushActive = false;
  let brushPointerId = null;
  let brushRevealing = false;
  let brushLastHexKey = null;
  let brushChanges = [];

  function mapCfg() {
    return {
      hexSize: currentMap.hexSize,
      orientation: currentMap.orientation,
      originX: currentMap.originX,
      originY: currentMap.originY,
    };
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  async function loadMaps() {
    const res = await fetch(API_BASE + 'maps_list.php');
    maps = await res.json();
    mapSelect.innerHTML = '';
    if (maps.length === 0) {
      const opt = document.createElement('option');
      opt.textContent = 'Keine Karten vorhanden – im Admin-Bereich anlegen';
      mapSelect.appendChild(opt);
      return;
    }
    for (const m of maps) {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = m.name;
      mapSelect.appendChild(opt);
    }
    await selectMap(maps[0].id);
  }

  async function selectMap(id) {
    stopPolling();
    resetBrushState();
    paintUndoStack = [];
    paintMode = false;
    updatePaintModeButton();
    viewport.classList.remove('paint-mode');
    updatePaintUndoButton();
    currentMap = maps.find((m) => m.id === id);
    if (!currentMap) return;
    mapSelect.value = id;

    const [baseImg, fogImg] = await Promise.all([
      loadImage(currentMap.baseImage),
      loadImage(currentMap.fogImage),
    ]);
    baseImage.src = baseImg.src;

    const w = currentMap.imageWidth;
    const h = currentMap.imageHeight;
    baseImage.width = w;
    baseImage.height = h;
    fogCanvas.width = w;
    fogCanvas.height = h;
    gridCanvas.width = w;
    gridCanvas.height = h;
    world.style.width = w + 'px';
    world.style.height = h + 'px';

    const state = await loadState(id);
    revealedHexes = new Set(state.revealedHexes);
    tokenHex = state.token;
    tokenVisibleForPlayers = !!state.tokenVisible;
    if (IS_ADMIN) updateTokenVisibleButton();
    currentFogImg = fogImg;

    drawFog(fogImg);
    drawGrid();
    placeToken();
    applyTokenVisibility();

    if (!panzoom) {
      panzoom = new PanZoom(viewport, world, {
        minScale: 0.1, maxScale: 6, onTap: handlePaintTap,
        shouldPan: (e) => !(paintMode && e.shiftKey),
      });
    }
    fitToViewport(w, h);
    startPolling();
  }

  function fitToViewport(w, h) {
    const rect = viewport.getBoundingClientRect();
    const scale = Math.min(rect.width / w, rect.height / h, 1);
    const x = (rect.width - w * scale) / 2;
    const y = (rect.height - h * scale) / 2;
    panzoom.reset(x, y, scale);
  }

  function drawFog(fogImg) {
    const ctx = fogCanvas.getContext('2d');
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, fogCanvas.width, fogCanvas.height);
    ctx.drawImage(fogImg, 0, 0, fogCanvas.width, fogCanvas.height);
    ctx.globalCompositeOperation = 'destination-out';
    for (const key of revealedHexes) {
      const [q, r] = key.split(',').map(Number);
      cutHex(ctx, q, r);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function cutHex(ctx, q, r) {
    const cfg = mapCfg();
    const { x, y } = HexGrid.hexToPixel(q, r, cfg);
    HexGrid.hexPath(ctx, x, y, cfg.hexSize + 1, cfg.orientation);
    ctx.fill();
  }

  function drawGrid() {
    const ctx = gridCanvas.getContext('2d');
    ctx.clearRect(0, 0, gridCanvas.width, gridCanvas.height);
    if (!gridVisible || !currentMap) return;
    const cfg = mapCfg();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    const corner1 = HexGrid.pixelToHex(0, 0, cfg);
    const corner2 = HexGrid.pixelToHex(currentMap.imageWidth, currentMap.imageHeight, cfg);
    const qMin = Math.min(corner1.q, corner2.q) - 2;
    const qMax = Math.max(corner1.q, corner2.q) + 2;
    const rMin = Math.min(corner1.r, corner2.r) - 2;
    const rMax = Math.max(corner1.r, corner2.r) + 2;
    for (let r = rMin; r <= rMax; r++) {
      for (let q = qMin; q <= qMax; q++) {
        const { x, y } = HexGrid.hexToPixel(q, r, cfg);
        if (x < -cfg.hexSize || x > currentMap.imageWidth + cfg.hexSize) continue;
        if (y < -cfg.hexSize || y > currentMap.imageHeight + cfg.hexSize) continue;
        HexGrid.hexPath(ctx, x, y, cfg.hexSize, cfg.orientation);
        ctx.stroke();
      }
    }
  }

  function placeToken() {
    const cfg = mapCfg();
    if (!tokenHex) {
      tokenHex = { q: currentMap.startQ ?? 0, r: currentMap.startR ?? 0 };
    }
    const { x, y } = HexGrid.hexToPixel(tokenHex.q, tokenHex.r, cfg);
    tokenEl.style.left = x + 'px';
    tokenEl.style.top = y + 'px';
  }

  function applyTokenVisibility() {
    if (!tokenEl) return;
    tokenEl.style.display = (IS_ADMIN || tokenVisibleForPlayers) ? '' : 'none';
  }

  async function loadState(id) {
    const res = await fetch(API_BASE + 'state_load.php?mapId=' + encodeURIComponent(id));
    return res.json();
  }

  function startPolling() {
    stopPolling();
    pollTimer = setInterval(pollState, 3000);
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  function setsEqual(a, b) {
    if (a.size !== b.size) return false;
    for (const v of a) if (!b.has(v)) return false;
    return true;
  }

  async function pollState() {
    if (!currentMap || dragging || Date.now() < suppressPollUntil) return;
    let state;
    try {
      state = await loadState(currentMap.id);
    } catch (e) {
      return;
    }

    const newRevealed = new Set(state.revealedHexes);
    if (!setsEqual(newRevealed, revealedHexes)) {
      revealedHexes = newRevealed;
      drawFog(currentFogImg);
    }

    if (state.token && (!tokenHex || state.token.q !== tokenHex.q || state.token.r !== tokenHex.r)) {
      tokenHex = state.token;
      placeToken();
    }

    const newVisible = !!state.tokenVisible;
    if (newVisible !== tokenVisibleForPlayers) {
      tokenVisibleForPlayers = newVisible;
      applyTokenVisibility();
      if (IS_ADMIN) updateTokenVisibleButton();
    }
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveState, 300);
  }

  async function saveState() {
    await fetch(API_BASE + 'state_save.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mapId: currentMap.id,
        revealedHexes: [...revealedHexes],
        token: tokenHex,
      }),
    });
  }

  function moveTokenTo(q, r) {
    suppressPollUntil = Date.now() + 1500;
    tokenHex = { q, r };
    const radius = currentMap.sightRadius || 0;
    const cells = HexGrid.hexRange(q, r, radius);
    const ctx = fogCanvas.getContext('2d');
    ctx.globalCompositeOperation = 'destination-out';
    for (const c of cells) {
      const key = HexGrid.key(c.q, c.r);
      if (!revealedHexes.has(key)) {
        revealedHexes.add(key);
        cutHex(ctx, c.q, c.r);
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    placeToken();
    scheduleSave();
  }

  function handlePaintTap(clientX, clientY) {
    if (!IS_ADMIN || !paintMode || !currentMap) return;
    const pt = panzoom.screenToWorld(clientX, clientY);
    const hex = HexGrid.pixelToHex(pt.x, pt.y, mapCfg());
    paintClickHex(hex.q, hex.r);
  }

  // Reine Set-Mutation: schaltet ein Hex um. Für Einzelklick & Undo.
  function toggleHexState(q, r) {
    const key = HexGrid.key(q, r);
    if (revealedHexes.has(key)) revealedHexes.delete(key); else revealedHexes.add(key);
  }

  // Reine Set-Mutation: setzt ein Hex auf einen Zielzustand (für Brush-Züge).
  // Gibt zurück, ob sich der Zustand tatsächlich geändert hat.
  function setHexRevealed(q, r, revealed) {
    const key = HexGrid.key(q, r);
    if (revealedHexes.has(key) === revealed) return false;
    if (revealed) revealedHexes.add(key); else revealedHexes.delete(key);
    return true;
  }

  // Gemeinsamer Folge-Schritt nach jeder Änderung.
  function commitPaintChange() {
    suppressPollUntil = Date.now() + 1500;
    drawFog(currentFogImg);
    scheduleSave();
  }

  // Äußerer Wrapper für einen echten Einzelklick: merkt sich die Aktion für Undo.
  function paintClickHex(q, r) {
    if (!currentMap) return;
    toggleHexState(q, r);
    paintUndoStack.push([{ q, r }]);
    updatePaintUndoButton();
    commitPaintChange();
  }

  // Undo: nimmt die letzte Aktion (ein Klick oder ein ganzer Brush-Zug) vom Stack
  // und schaltet jedes darin enthaltene Hex erneut um (Toggle ist selbstinvers)
  // -- OHNE die Aktion erneut auf den Stack zu legen. Genau das sorgt dafür, dass
  // wiederholtes Drücken rückwärts durch die Historie geht.
  function undoPaint() {
    if (paintUndoStack.length === 0) return;
    const action = paintUndoStack.pop();
    for (const { q, r } of action) toggleHexState(q, r);
    updatePaintUndoButton();
    commitPaintChange();
  }

  function updatePaintUndoButton() {
    if (paintUndoBtn) paintUndoBtn.disabled = paintUndoStack.length === 0;
  }

  // --- Shift-Drag: mehrere Hexe in einem Zug auf denselben Zielzustand setzen ---
  function resetBrushState() {
    brushActive = false;
    brushPointerId = null;
    brushLastHexKey = null;
    brushChanges = [];
  }

  function resolveHexAt(clientX, clientY) {
    const pt = panzoom.screenToWorld(clientX, clientY);
    return HexGrid.pixelToHex(pt.x, pt.y, mapCfg());
  }

  function processBrushHex(q, r) {
    const key = HexGrid.key(q, r);
    if (key === brushLastHexKey) return;
    brushLastHexKey = key;
    if (setHexRevealed(q, r, brushRevealing)) {
      brushChanges.push({ q, r });
      commitPaintChange();
    }
  }

  function startBrushStroke(e) {
    const hex = resolveHexAt(e.clientX, e.clientY);
    brushRevealing = !revealedHexes.has(HexGrid.key(hex.q, hex.r));
    brushActive = true;
    brushPointerId = e.pointerId;
    brushLastHexKey = null;
    brushChanges = [];
    processBrushHex(hex.q, hex.r);
  }

  function endBrushStroke(flush) {
    if (!brushActive) return;
    if (flush && brushChanges.length > 0) {
      paintUndoStack.push(brushChanges);
      updatePaintUndoButton();
    }
    resetBrushState();
  }

  // --- Token Drag & Drop (nur Admin) ---
  let dragging = false;
  if (IS_ADMIN) {
    tokenEl.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      dragging = true;
      tokenEl.setPointerCapture(e.pointerId);
      tokenEl.classList.add('dragging');
    });
    tokenEl.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      e.stopPropagation();
      const pt = panzoom.screenToWorld(e.clientX, e.clientY);
      tokenEl.style.left = pt.x + 'px';
      tokenEl.style.top = pt.y + 'px';
    });
    tokenEl.addEventListener('pointerup', (e) => {
      if (!dragging) return;
      e.stopPropagation();
      dragging = false;
      tokenEl.classList.remove('dragging');
      const pt = panzoom.screenToWorld(e.clientX, e.clientY);
      const hex = HexGrid.pixelToHex(pt.x, pt.y, mapCfg());
      moveTokenTo(hex.q, hex.r);
    });
  } else {
    tokenEl.classList.add('token-locked');
    tokenEl.classList.remove('no-pan');
  }

  async function resetFog() {
    if (!currentMap || !currentFogImg) return;
    if (!confirm('Wirklich den gesamten aufgedeckten Bereich dieser Karte zurücksetzen? Das kann nicht rückgängig gemacht werden.')) return;
    suppressPollUntil = Date.now() + 1500;
    const res = await fetch(API_BASE + 'state_reset.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mapId: currentMap.id }),
    });
    if (!res.ok) {
      alert('Zurücksetzen fehlgeschlagen.');
      return;
    }
    revealedHexes.clear();
    resetBrushState();
    paintUndoStack = [];
    updatePaintUndoButton();
    drawFog(currentFogImg);
  }

  // Overlay-Transparenz: rein lokale Anzeige-Einstellung für den Admin (GM-Blick durch
  // den Nebel), ändert nichts am gespeicherten Nebelstatus und wirkt sich nicht auf
  // andere Mitspieler aus. Wird nur pro Browser gemerkt.
  if (fogOpacityInput) {
    const stored = localStorage.getItem('hexcrawl_fogOpacity');
    if (stored !== null) {
      fogOpacityInput.value = stored;
      fogCanvas.style.opacity = Number(stored) / 100;
    }
    fogOpacityInput.addEventListener('input', () => {
      fogCanvas.style.opacity = Number(fogOpacityInput.value) / 100;
      localStorage.setItem('hexcrawl_fogOpacity', fogOpacityInput.value);
    });
  }

  function updateTokenVisibleButton() {
    if (!tokenVisibleToggle) return;
    tokenVisibleToggle.textContent = 'Token für Spieler: ' + (tokenVisibleForPlayers ? 'Sichtbar' : 'Versteckt');
    tokenVisibleToggle.classList.toggle('active', tokenVisibleForPlayers);
  }

  function updatePaintModeButton() {
    if (!paintModeToggle) return;
    paintModeToggle.textContent = 'Hex-Malmodus: ' + (paintMode ? 'An' : 'Aus');
    paintModeToggle.classList.toggle('active', paintMode);
  }

  function setGridVisible(on) {
    gridVisible = on;
    if (gridToggle) {
      gridToggle.textContent = 'Raster: ' + (gridVisible ? 'An' : 'Aus');
      gridToggle.classList.toggle('active', gridVisible);
    }
    drawGrid();
  }

  function setPaintMode(on) {
    paintMode = on;
    updatePaintModeButton();
    viewport.classList.toggle('paint-mode', paintMode);
    if (paintMode) {
      gridWasOnBeforePaint = gridVisible;
      if (!gridVisible) setGridVisible(true);
    } else {
      endBrushStroke(true);
      if (gridVisible !== gridWasOnBeforePaint) setGridVisible(gridWasOnBeforePaint);
    }
  }

  if (tokenVisibleToggle) {
    tokenVisibleToggle.addEventListener('click', async () => {
      suppressPollUntil = Date.now() + 1500;
      tokenVisibleForPlayers = !tokenVisibleForPlayers;
      updateTokenVisibleButton();
      applyTokenVisibility();
      await fetch(API_BASE + 'state_set_visibility.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mapId: currentMap.id, visible: tokenVisibleForPlayers }),
      });
    });
  }

  if (paintModeToggle) {
    paintModeToggle.addEventListener('click', () => setPaintMode(!paintMode));
  }
  if (paintUndoBtn) paintUndoBtn.addEventListener('click', undoPaint);

  viewport.addEventListener('pointerdown', (e) => {
    if (!IS_ADMIN || !paintMode || !currentMap || !e.shiftKey) return;
    if (e.target.closest('.no-pan')) return;
    startBrushStroke(e);
  });
  window.addEventListener('pointermove', (e) => {
    if (!brushActive || e.pointerId !== brushPointerId) return;
    const hex = resolveHexAt(e.clientX, e.clientY);
    processBrushHex(hex.q, hex.r);
  });
  window.addEventListener('pointerup', (e) => {
    if (brushActive && e.pointerId === brushPointerId) endBrushStroke(true);
  });
  window.addEventListener('pointercancel', (e) => {
    if (brushActive && e.pointerId === brushPointerId) endBrushStroke(true);
  });

  if (controlPanelToggle && controlPanel) {
    controlPanelToggle.addEventListener('click', () => {
      controlPanel.classList.toggle('hidden');
    });
  }

  viewport.addEventListener('contextmenu', (e) => e.preventDefault());

  mapSelect.addEventListener('change', () => selectMap(mapSelect.value));
  gridToggle.addEventListener('click', () => setGridVisible(!gridVisible));
  if (fogResetBtn) fogResetBtn.addEventListener('click', resetFog);
  window.addEventListener('resize', () => {
    if (currentMap && panzoom) fitToViewport(currentMap.imageWidth, currentMap.imageHeight);
  });

  loadMaps();
})();
