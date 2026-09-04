// TypeScript twin of the old app's assets/js/hexgrid.js, kept 1:1 with its formulas
// (axial coordinates, https://www.redblobgames.com/grids/hexagons/). A matching
// Python port (hex_range only) lives at backend/app/hexgrid.py for server-side
// sight-radius reveals -- keep both in sync if this ever changes.

const SQRT3 = Math.sqrt(3);

export type Orientation = "pointy" | "flat";

export interface HexGridConfig {
  hexSize: number;
  orientation: Orientation;
  originX: number;
  originY: number;
}

export interface AxialHex {
  q: number;
  r: number;
}

export interface Point {
  x: number;
  y: number;
}

export function hexToPixel(q: number, r: number, cfg: HexGridConfig): Point {
  let x: number;
  let y: number;
  if (cfg.orientation === "flat") {
    x = cfg.hexSize * (1.5 * q);
    y = cfg.hexSize * ((SQRT3 / 2) * q + SQRT3 * r);
  } else {
    x = cfg.hexSize * (SQRT3 * q + (SQRT3 / 2) * r);
    y = cfg.hexSize * (1.5 * r);
  }
  return { x: x + cfg.originX, y: y + cfg.originY };
}

export function pixelToHex(x: number, y: number, cfg: HexGridConfig): AxialHex {
  const px = x - cfg.originX;
  const py = y - cfg.originY;
  let q: number;
  let r: number;
  if (cfg.orientation === "flat") {
    q = ((2 / 3) * px) / cfg.hexSize;
    r = ((-1 / 3) * px + (SQRT3 / 3) * py) / cfg.hexSize;
  } else {
    q = ((SQRT3 / 3) * px - (1 / 3) * py) / cfg.hexSize;
    r = ((2 / 3) * py) / cfg.hexSize;
  }
  return hexRound(q, r);
}

export function hexRound(q: number, r: number): AxialHex {
  const x = q;
  const z = r;
  const y = -x - z;
  let rx = Math.round(x);
  let ry = Math.round(y);
  let rz = Math.round(z);
  const xDiff = Math.abs(rx - x);
  const yDiff = Math.abs(ry - y);
  const zDiff = Math.abs(rz - z);
  if (xDiff > yDiff && xDiff > zDiff) {
    rx = -ry - rz;
  } else if (yDiff > zDiff) {
    ry = -rx - rz;
  } else {
    rz = -rx - ry;
  }
  return { q: rx, r: rz };
}

export function hexCorners(cx: number, cy: number, size: number, orientation: Orientation): Point[] {
  const corners: Point[] = [];
  const startAngle = orientation === "flat" ? 0 : 30;
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (startAngle + 60 * i);
    corners.push({ x: cx + size * Math.cos(angle), y: cy + size * Math.sin(angle) });
  }
  return corners;
}

export function hexPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, orientation: Orientation): void {
  const corners = hexCorners(cx, cy, size, orientation);
  ctx.beginPath();
  ctx.moveTo(corners[0].x, corners[0].y);
  for (let i = 1; i < corners.length; i++) {
    ctx.lineTo(corners[i].x, corners[i].y);
  }
  ctx.closePath();
}

/** All hexes (axial q,r) within `radius` of a center hex; radius 0 = just the hex itself. */
export function hexRange(centerQ: number, centerR: number, radius: number): AxialHex[] {
  const results: AxialHex[] = [];
  for (let dx = -radius; dx <= radius; dx++) {
    const dyMin = Math.max(-radius, -dx - radius);
    const dyMax = Math.min(radius, -dx + radius);
    for (let dy = dyMin; dy <= dyMax; dy++) {
      const dz = -dx - dy;
      results.push({ q: centerQ + dx, r: centerR + dz });
    }
  }
  return results;
}

export function hexKey(q: number, r: number): string {
  return `${q},${r}`;
}
