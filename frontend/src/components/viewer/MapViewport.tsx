import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { cn } from "@/lib/utils";
import { type AxialHex, type HexGridConfig, pixelToHex, hexToPixel } from "@/lib/hexgrid";
import { drawFog, drawGrid } from "@/lib/fog";
import { usePanZoom } from "@/hooks/usePanZoom";
import type { MapSummary } from "@/lib/types";

interface MapViewportProps {
  map: MapSummary;
  revealedHexes: Set<string>;
  token: AxialHex | null;
  tokenVisible: boolean;
  isAdmin: boolean;
  gridVisible: boolean;
  fogOpacity: number; // 0-100, local-only display setting
  paintMode: boolean;
  /** Single click/tap while paintMode is on: toggle one hex. */
  onPaintHex?: (hex: AxialHex) => void;
  /** Shift+drag while paintMode is on: paint/erase a whole stroke of hexes. */
  onBrushStart?: (pointerId: number, hex: AxialHex) => void;
  onBrushMove?: (hex: AxialHex) => void;
  onBrushEnd?: () => void;
  /** Drag the token dot, or (outside paint mode) Ctrl+click / double-tap anywhere to place it there directly. */
  onMoveToken?: (q: number, r: number) => void;
}

function mapConfig(map: MapSummary): HexGridConfig {
  return { hexSize: map.hex_size, orientation: map.orientation, originX: map.origin_x, originY: map.origin_y };
}

export function MapViewport({
  map,
  revealedHexes,
  token,
  tokenVisible,
  isAdmin,
  gridVisible,
  fogOpacity,
  paintMode,
  onPaintHex,
  onBrushStart,
  onBrushMove,
  onBrushEnd,
  onMoveToken,
}: MapViewportProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const fogCanvasRef = useRef<HTMLCanvasElement>(null);
  const gridCanvasRef = useRef<HTMLCanvasElement>(null);
  const tokenRef = useRef<HTMLDivElement>(null);
  const [fogImage, setFogImage] = useState<HTMLImageElement | null>(null);
  const draggingRef = useRef(false);
  const brushPointerIdRef = useRef<number | null>(null);
  const mapRef = useRef(map);
  mapRef.current = map;

  const handleTap = (clientX: number, clientY: number, sourceEvent: PointerEvent) => {
    if (!isAdmin) return;
    const panZoom = panZoomRef.current;
    if (!panZoom) return;
    const world = panZoom.screenToWorld(clientX, clientY);
    const hex = pixelToHex(world.x, world.y, mapConfig(map));
    if (paintMode) {
      onPaintHex?.(hex);
    } else if (sourceEvent.ctrlKey || sourceEvent.metaKey) {
      // Ctrl+click (Cmd+click on Mac) places the token directly on desktop.
      // Plain clicks stay reserved for panning/selecting, so they can't misfire this.
      onMoveToken?.(hex.q, hex.r);
    }
  };

  // Touch has no Ctrl key, so a double-tap on the map is the touch equivalent for
  // placing the token -- this intentionally overrides the default double-tap-zoom
  // for admins outside paint mode; players and paint mode keep the default zoom.
  const handleDoubleTap = (clientX: number, clientY: number): boolean => {
    if (!isAdmin || paintMode || !onMoveToken) return false;
    const panZoom = panZoomRef.current;
    if (!panZoom) return false;
    const world = panZoom.screenToWorld(clientX, clientY);
    const hex = pixelToHex(world.x, world.y, mapConfig(map));
    onMoveToken(hex.q, hex.r);
    return true;
  };

  const panZoomRef = usePanZoom(viewportRef, worldRef, {
    minScale: 0.1,
    maxScale: 6,
    onTap: handleTap,
    onDoubleTap: handleDoubleTap,
    // While shift-painting, PanZoom must not also interpret the drag as a pan.
    shouldPan: (e) => !(paintMode && e.shiftKey),
  });

  function resolveHexAtClient(clientX: number, clientY: number): AxialHex | null {
    const panZoom = panZoomRef.current;
    if (!panZoom) return null;
    const world = panZoom.screenToWorld(clientX, clientY);
    return pixelToHex(world.x, world.y, mapConfig(mapRef.current));
  }

  function handleViewportPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (!isAdmin || !paintMode || !e.shiftKey || !onBrushStart) return;
    if ((e.target as HTMLElement).closest?.(".no-pan")) return;
    const hex = resolveHexAtClient(e.clientX, e.clientY);
    if (!hex) return;
    brushPointerIdRef.current = e.pointerId;
    onBrushStart(e.pointerId, hex);
  }

  // Window-level brush move/end listeners (a drag can leave the viewport element),
  // wired once via a ref trampoline so callbacks never go stale without needing to
  // tear down and re-add these on every render.
  const brushCallbacksRef = useRef({ onBrushMove, onBrushEnd });
  brushCallbacksRef.current = { onBrushMove, onBrushEnd };

  useEffect(() => {
    function handleMove(e: PointerEvent) {
      if (brushPointerIdRef.current === null || e.pointerId !== brushPointerIdRef.current) return;
      const panZoom = panZoomRef.current;
      if (!panZoom) return;
      const world = panZoom.screenToWorld(e.clientX, e.clientY);
      const hex = pixelToHex(world.x, world.y, mapConfig(mapRef.current));
      brushCallbacksRef.current.onBrushMove?.(hex);
    }
    function handleUp(e: PointerEvent) {
      if (brushPointerIdRef.current === null || e.pointerId !== brushPointerIdRef.current) return;
      brushPointerIdRef.current = null;
      brushCallbacksRef.current.onBrushEnd?.();
    }
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load the fog image once per map (used only as a canvas draw source, never shown directly).
  useEffect(() => {
    setFogImage(null);
    const img = new Image();
    img.onload = () => setFogImage(img);
    img.src = map.fog_image_url;
  }, [map.fog_image_url]);

  // Fit-to-viewport whenever the map (and therefore its pixel dimensions) changes.
  useEffect(() => {
    const panZoom = panZoomRef.current;
    const viewport = viewportRef.current;
    if (!panZoom || !viewport) return;
    const rect = viewport.getBoundingClientRect();
    const scale = Math.min(rect.width / map.image_width, rect.height / map.image_height, 1);
    const x = (rect.width - map.image_width * scale) / 2;
    const y = (rect.height - map.image_height * scale) / 2;
    panZoom.reset(x, y, scale);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map.id, map.image_width, map.image_height]);

  useEffect(() => {
    const canvas = fogCanvasRef.current;
    if (!canvas || !fogImage) return;
    canvas.width = map.image_width;
    canvas.height = map.image_height;
    drawFog(canvas.getContext("2d")!, fogImage, revealedHexes, mapConfig(map));
  }, [fogImage, revealedHexes, map]);

  useEffect(() => {
    const canvas = gridCanvasRef.current;
    if (!canvas) return;
    canvas.width = map.image_width;
    canvas.height = map.image_height;
    const ctx = canvas.getContext("2d")!;
    if (gridVisible) {
      drawGrid(ctx, mapConfig(map), map.image_width, map.image_height);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, [gridVisible, map]);

  const tokenPixel = token ? hexToPixel(token.q, token.r, mapConfig(map)) : null;
  const tokenShown = tokenPixel && (isAdmin || tokenVisible);

  return (
    <div
      ref={viewportRef}
      className="relative h-full w-full overflow-hidden bg-black"
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={handleViewportPointerDown}
    >
      <div
        ref={worldRef}
        className="absolute left-0 top-0 origin-top-left"
        style={{ width: map.image_width, height: map.image_height }}
      >
        <img
          src={map.base_image_url}
          alt={map.name}
          width={map.image_width}
          height={map.image_height}
          className="absolute left-0 top-0 select-none"
          draggable={false}
        />
        <canvas
          ref={fogCanvasRef}
          className="absolute left-0 top-0"
          style={{ opacity: fogOpacity / 100 }}
        />
        <canvas ref={gridCanvasRef} className="pointer-events-none absolute left-0 top-0" />
        {tokenShown && tokenPixel && (
          <div
            ref={tokenRef}
            className={cn(
              "no-pan absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-red-600 shadow-md",
              isAdmin && "cursor-grab active:cursor-grabbing",
            )}
            style={{ left: tokenPixel.x, top: tokenPixel.y }}
            onPointerDown={(e) => {
              if (!isAdmin) return;
              e.stopPropagation();
              draggingRef.current = true;
              (e.target as HTMLElement).setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (!draggingRef.current || !isAdmin) return;
              e.stopPropagation();
              const panZoom = panZoomRef.current;
              if (!panZoom) return;
              const world = panZoom.screenToWorld(e.clientX, e.clientY);
              const el = tokenRef.current;
              if (el) {
                el.style.left = `${world.x}px`;
                el.style.top = `${world.y}px`;
              }
            }}
            onPointerUp={(e) => {
              if (!draggingRef.current || !isAdmin) return;
              e.stopPropagation();
              draggingRef.current = false;
              const panZoom = panZoomRef.current;
              if (!panZoom || !onMoveToken) return;
              const world = panZoom.screenToWorld(e.clientX, e.clientY);
              const hex = pixelToHex(world.x, world.y, mapConfig(map));
              onMoveToken(hex.q, hex.r);
            }}
          />
        )}
      </div>
    </div>
  );
}
