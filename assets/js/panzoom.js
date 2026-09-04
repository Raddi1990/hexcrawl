// Leichte Pan/Zoom-Komponente auf Basis von Pointer Events.
// Funktioniert einheitlich für Maus (Drag + Wheel), Touch (1-Finger-Pan,
// 2-Finger-Pinch-Zoom) und Stift. Elemente mit der Klasse "no-pan" (z.B. die
// Spielfigur) lösen kein Panning aus, sofern sie selbst stopPropagation() rufen.

class PanZoom {
  constructor(viewport, world, opts = {}) {
    this.viewport = viewport;
    this.world = world;
    this.scale = opts.initialScale || 1;
    this.x = opts.initialX || 0;
    this.y = opts.initialY || 0;
    this.minScale = opts.minScale || 0.1;
    this.maxScale = opts.maxScale || 5;

    this.pointers = new Map();
    this.panPointerId = null;
    this.panStart = null;
    this.lastPinchDist = null;

    // Basiswerte der aktuellen "Fit"-Ansicht (siehe reset()), Ziel für Doppel-Tap-Zoom-out.
    this.baseX = this.x;
    this.baseY = this.y;
    this.baseScale = this.scale;
    this.doubleTapZoomFactor = opts.doubleTapZoomFactor || 3;
    this.wasPinch = false;
    this.tapStart = null;
    this.lastTap = null;
    this.onTapCallback = typeof opts.onTap === 'function' ? opts.onTap : null;
    this.shouldPanCallback = typeof opts.shouldPan === 'function' ? opts.shouldPan : null;

    this._rafId = null;
    this._willChangeTimer = null;

    this.viewport.style.touchAction = 'none';

    this._onPointerDown = this.onPointerDown.bind(this);
    this._onPointerMove = this.onPointerMove.bind(this);
    this._onPointerUp = this.onPointerUp.bind(this);
    this._onWheel = this.onWheel.bind(this);

    this.viewport.addEventListener('pointerdown', this._onPointerDown);
    window.addEventListener('pointermove', this._onPointerMove);
    window.addEventListener('pointerup', this._onPointerUp);
    window.addEventListener('pointercancel', this._onPointerUp);
    this.viewport.addEventListener('wheel', this._onWheel, { passive: false });

    this.apply();
  }

  apply() {
    this.world.style.willChange = 'transform';
    clearTimeout(this._willChangeTimer);
    this._willChangeTimer = setTimeout(() => { this.world.style.willChange = 'auto'; }, 200);

    if (this._rafId !== null) return;
    this._rafId = requestAnimationFrame(() => {
      this._rafId = null;
      this.world.style.transform = `translate(${this.x}px, ${this.y}px) scale(${this.scale})`;
    });
  }

  // Rechnet Bildschirmkoordinaten (clientX/Y) in Weltkoordinaten (z.B. Bild-Pixel) um.
  screenToWorld(clientX, clientY) {
    const rect = this.viewport.getBoundingClientRect();
    return {
      x: (clientX - rect.left - this.x) / this.scale,
      y: (clientY - rect.top - this.y) / this.scale,
    };
  }

  onPointerDown(e) {
    if (e.target.closest('.no-pan')) return;
    // Erlaubt Aufrufern (Shift-Brush im Malmodus), einen Pointer komplett aus
    // Pan/Pinch/Tap auszuklammern. tapStart MUSS hier zurückgesetzt werden, sonst
    // kann ein späteres onPointerUp für diesen Pointer einen alten tapStart-Wert
    // aus einer früheren Geste lesen und fälschlich onTapCallback auslösen.
    if (this.shouldPanCallback && !this.shouldPanCallback(e)) {
      this.tapStart = null;
      return;
    }
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size === 1) {
      this.panPointerId = e.pointerId;
      this.panStart = { x: e.clientX, y: e.clientY, ox: this.x, oy: this.y };
      this.wasPinch = false;
      this.tapStart = { x: e.clientX, y: e.clientY, time: Date.now() };
    } else if (this.pointers.size === 2) {
      this.panPointerId = null;
      this.wasPinch = true;
      this.tapStart = null;
      const pts = [...this.pointers.values()];
      this.lastPinchDist = dist(pts[0], pts[1]);
    }
  }

  onPointerMove(e) {
    if (!this.pointers.has(e.pointerId)) return;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (this.tapStart && dist(this.tapStart, { x: e.clientX, y: e.clientY }) > 10) {
      this.tapStart = null;
    }

    if (this.pointers.size === 1 && this.panPointerId === e.pointerId) {
      this.x = this.panStart.ox + (e.clientX - this.panStart.x);
      this.y = this.panStart.oy + (e.clientY - this.panStart.y);
      this.apply();
    } else if (this.pointers.size === 2) {
      const pts = [...this.pointers.values()];
      const newDist = dist(pts[0], pts[1]);
      const newMid = mid(pts[0], pts[1]);
      if (this.lastPinchDist) {
        this.zoomAt(newMid.x, newMid.y, newDist / this.lastPinchDist);
      }
      this.lastPinchDist = newDist;
    }
  }

  onPointerUp(e) {
    const wasSingleTap = !this.wasPinch
      && this.tapStart
      && Date.now() - this.tapStart.time < 400;

    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) {
      this.lastPinchDist = null;
    }
    if (this.pointers.size === 1) {
      const [id, pt] = [...this.pointers.entries()][0];
      this.panPointerId = id;
      this.panStart = { x: pt.x, y: pt.y, ox: this.x, oy: this.y };
    } else {
      this.panPointerId = null;
    }

    if (wasSingleTap && this.pointers.size === 0) {
      if (this.onTapCallback) this.onTapCallback(e.clientX, e.clientY);
      if (e.pointerType === 'touch') this.handleTap(e.clientX, e.clientY);
    }
  }

  handleTap(clientX, clientY) {
    const now = Date.now();
    if (this.lastTap
      && now - this.lastTap.time < 350
      && dist(this.lastTap, { x: clientX, y: clientY }) < 40) {
      this.lastTap = null;
      this.toggleDoubleTapZoom(clientX, clientY);
    } else {
      this.lastTap = { x: clientX, y: clientY, time: now };
    }
  }

  // Doppel-Tap: zoomt rein, sofern gerade die "Fit"-Ansicht aktiv ist, sonst
  // wieder zurück auf diese Fit-Ansicht.
  toggleDoubleTapZoom(clientX, clientY) {
    const zoomedIn = this.scale > this.baseScale * 1.15;
    if (zoomedIn) {
      this.x = this.baseX;
      this.y = this.baseY;
      this.scale = this.baseScale;
      this.apply();
    } else {
      const targetScale = clamp(this.baseScale * this.doubleTapZoomFactor, this.minScale, this.maxScale);
      this.zoomAt(clientX, clientY, targetScale / this.scale);
    }
  }

  onWheel(e) {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    this.zoomAt(e.clientX, e.clientY, factor);
  }

  zoomAt(clientX, clientY, factor) {
    const rect = this.viewport.getBoundingClientRect();
    const newScale = clamp(this.scale * factor, this.minScale, this.maxScale);
    const actualFactor = newScale / this.scale;
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    this.x = localX - (localX - this.x) * actualFactor;
    this.y = localY - (localY - this.y) * actualFactor;
    this.scale = newScale;
    this.apply();
  }

  reset(x = 0, y = 0, scale = 1) {
    this.x = x;
    this.y = y;
    this.scale = scale;
    this.baseX = x;
    this.baseY = y;
    this.baseScale = scale;
    this.apply();
  }
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
function mid(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}
function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
