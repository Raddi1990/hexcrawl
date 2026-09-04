// TypeScript port of the old app's assets/js/panzoom.js, kept as a fully imperative
// class rather than React-state-driven -- this is the most battle-tested, fiddly part
// of the original code (pointer-event pan/zoom math, pinch/double-tap edge cases) and
// deliberately isn't re-derived. Wrapped for React by usePanZoom (see hooks/).

export interface PanZoomOptions {
  initialScale?: number;
  initialX?: number;
  initialY?: number;
  minScale?: number;
  maxScale?: number;
  doubleTapZoomFactor?: number;
  onTap?: (clientX: number, clientY: number) => void;
  /** Return false to exclude a pointer from pan/pinch/tap entirely (e.g. paint-mode shift-drag). */
  shouldPan?: (e: PointerEvent) => boolean;
}

interface PointerPoint {
  x: number;
  y: number;
}

interface PanStart {
  x: number;
  y: number;
  ox: number;
  oy: number;
}

interface TapStart {
  x: number;
  y: number;
  time: number;
}

function dist(a: PointerPoint, b: PointerPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function mid(a: PointerPoint, b: PointerPoint): PointerPoint {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export class PanZoom {
  viewport: HTMLElement;
  world: HTMLElement;
  scale: number;
  x: number;
  y: number;
  minScale: number;
  maxScale: number;

  private pointers = new Map<number, PointerPoint>();
  private panPointerId: number | null = null;
  private panStart: PanStart | null = null;
  private lastPinchDist: number | null = null;

  private baseX: number;
  private baseY: number;
  private baseScale: number;
  private doubleTapZoomFactor: number;
  private wasPinch = false;
  private tapStart: TapStart | null = null;
  private lastTap: TapStart | null = null;
  private onTapCallback: PanZoomOptions["onTap"] | null;
  private shouldPanCallback: PanZoomOptions["shouldPan"] | null;

  private rafId: number | null = null;
  private willChangeTimer: ReturnType<typeof setTimeout> | null = null;

  private onPointerDownBound = this.onPointerDown.bind(this);
  private onPointerMoveBound = this.onPointerMove.bind(this);
  private onPointerUpBound = this.onPointerUp.bind(this);
  private onWheelBound = this.onWheel.bind(this);

  constructor(viewport: HTMLElement, world: HTMLElement, opts: PanZoomOptions = {}) {
    this.viewport = viewport;
    this.world = world;
    this.scale = opts.initialScale ?? 1;
    this.x = opts.initialX ?? 0;
    this.y = opts.initialY ?? 0;
    this.minScale = opts.minScale ?? 0.1;
    this.maxScale = opts.maxScale ?? 5;

    this.baseX = this.x;
    this.baseY = this.y;
    this.baseScale = this.scale;
    this.doubleTapZoomFactor = opts.doubleTapZoomFactor ?? 3;
    this.onTapCallback = opts.onTap ?? null;
    this.shouldPanCallback = opts.shouldPan ?? null;

    this.viewport.style.touchAction = "none";

    this.viewport.addEventListener("pointerdown", this.onPointerDownBound);
    window.addEventListener("pointermove", this.onPointerMoveBound);
    window.addEventListener("pointerup", this.onPointerUpBound);
    window.addEventListener("pointercancel", this.onPointerUpBound);
    this.viewport.addEventListener("wheel", this.onWheelBound, { passive: false });

    this.apply();
  }

  destroy(): void {
    this.viewport.removeEventListener("pointerdown", this.onPointerDownBound);
    window.removeEventListener("pointermove", this.onPointerMoveBound);
    window.removeEventListener("pointerup", this.onPointerUpBound);
    window.removeEventListener("pointercancel", this.onPointerUpBound);
    this.viewport.removeEventListener("wheel", this.onWheelBound);
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    if (this.willChangeTimer !== null) clearTimeout(this.willChangeTimer);
  }

  apply(): void {
    this.world.style.willChange = "transform";
    if (this.willChangeTimer !== null) clearTimeout(this.willChangeTimer);
    this.willChangeTimer = setTimeout(() => {
      this.world.style.willChange = "auto";
    }, 200);

    if (this.rafId !== null) return;
    this.rafId = requestAnimationFrame(() => {
      this.rafId = null;
      this.world.style.transform = `translate(${this.x}px, ${this.y}px) scale(${this.scale})`;
    });
  }

  screenToWorld(clientX: number, clientY: number): PointerPoint {
    const rect = this.viewport.getBoundingClientRect();
    return {
      x: (clientX - rect.left - this.x) / this.scale,
      y: (clientY - rect.top - this.y) / this.scale,
    };
  }

  private onPointerDown(e: PointerEvent): void {
    if ((e.target as HTMLElement).closest?.(".no-pan")) return;
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

  private onPointerMove(e: PointerEvent): void {
    if (!this.pointers.has(e.pointerId)) return;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (this.tapStart && dist(this.tapStart, { x: e.clientX, y: e.clientY }) > 10) {
      this.tapStart = null;
    }

    if (this.pointers.size === 1 && this.panPointerId === e.pointerId && this.panStart) {
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

  private onPointerUp(e: PointerEvent): void {
    const wasSingleTap = !this.wasPinch && this.tapStart !== null && Date.now() - this.tapStart.time < 400;

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
      this.onTapCallback?.(e.clientX, e.clientY);
      if (e.pointerType === "touch") this.handleTap(e.clientX, e.clientY);
    }
  }

  private handleTap(clientX: number, clientY: number): void {
    const now = Date.now();
    if (this.lastTap && now - this.lastTap.time < 350 && dist(this.lastTap, { x: clientX, y: clientY }) < 40) {
      this.lastTap = null;
      this.toggleDoubleTapZoom(clientX, clientY);
    } else {
      this.lastTap = { x: clientX, y: clientY, time: now };
    }
  }

  private toggleDoubleTapZoom(clientX: number, clientY: number): void {
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

  private onWheel(e: WheelEvent): void {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    this.zoomAt(e.clientX, e.clientY, factor);
  }

  zoomAt(clientX: number, clientY: number, factor: number): void {
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

  reset(x = 0, y = 0, scale = 1): void {
    this.x = x;
    this.y = y;
    this.scale = scale;
    this.baseX = x;
    this.baseY = y;
    this.baseScale = scale;
    this.apply();
  }
}
