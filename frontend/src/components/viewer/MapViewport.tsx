import { useEffect, useRef, useState } from "react";
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
  onPaintHex?: (hex: AxialHex) => void;
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
  onMoveToken,
}: MapViewportProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const fogCanvasRef = useRef<HTMLCanvasElement>(null);
  const gridCanvasRef = useRef<HTMLCanvasElement>(null);
  const tokenRef = useRef<HTMLDivElement>(null);
  const [fogImage, setFogImage] = useState<HTMLImageElement | null>(null);
  const draggingRef = useRef(false);

  const handleTap = (clientX: number, clientY: number) => {
    if (!isAdmin || !paintMode || !onPaintHex) return;
    const panZoom = panZoomRef.current;
    if (!panZoom) return;
    const world = panZoom.screenToWorld(clientX, clientY);
    onPaintHex(pixelToHex(world.x, world.y, mapConfig(map)));
  };

  const panZoomRef = usePanZoom(viewportRef, worldRef, {
    minScale: 0.1,
    maxScale: 6,
    onTap: handleTap,
  });

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
