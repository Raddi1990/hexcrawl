// TypeScript port of viewer.js's drawFog/cutHex/drawGrid (the destination-out
// fog-punching canvas algorithm). Kept as plain functions operating on a
// CanvasRenderingContext2D so the same code drives both the player viewer and the
// admin calibration preview.
import { type HexGridConfig, hexPath, hexToPixel, pixelToHex } from "./hexgrid";

export function drawFog(
  ctx: CanvasRenderingContext2D,
  fogImage: CanvasImageSource,
  revealedHexKeys: Iterable<string>,
  cfg: HexGridConfig,
): void {
  const { width, height } = ctx.canvas;
  ctx.globalCompositeOperation = "source-over";
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(fogImage, 0, 0, width, height);
  ctx.globalCompositeOperation = "destination-out";
  for (const key of revealedHexKeys) {
    const [q, r] = key.split(",").map(Number);
    cutHex(ctx, q, r, cfg);
  }
  ctx.globalCompositeOperation = "source-over";
}

export function cutHex(ctx: CanvasRenderingContext2D, q: number, r: number, cfg: HexGridConfig): void {
  const { x, y } = hexToPixel(q, r, cfg);
  hexPath(ctx, x, y, cfg.hexSize + 1, cfg.orientation);
  ctx.fill();
}

export function drawGrid(ctx: CanvasRenderingContext2D, cfg: HexGridConfig, imageWidth: number, imageHeight: number): void {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 1;
  const corner1 = pixelToHex(0, 0, cfg);
  const corner2 = pixelToHex(imageWidth, imageHeight, cfg);
  const qMin = Math.min(corner1.q, corner2.q) - 2;
  const qMax = Math.max(corner1.q, corner2.q) + 2;
  const rMin = Math.min(corner1.r, corner2.r) - 2;
  const rMax = Math.max(corner1.r, corner2.r) + 2;
  for (let r = rMin; r <= rMax; r++) {
    for (let q = qMin; q <= qMax; q++) {
      const { x, y } = hexToPixel(q, r, cfg);
      if (x < -cfg.hexSize || x > imageWidth + cfg.hexSize) continue;
      if (y < -cfg.hexSize || y > imageHeight + cfg.hexSize) continue;
      hexPath(ctx, x, y, cfg.hexSize, cfg.orientation);
      ctx.stroke();
    }
  }
}
