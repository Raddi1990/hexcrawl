// Hex-Koordinaten-Mathematik (axial coords), nach den Standardformeln von
// https://www.redblobgames.com/grids/hexagons/ . Unterstützt "pointy" (Spitze oben)
// und "flat" (Kante oben) Ausrichtung.

const HexGrid = (() => {
  const SQRT3 = Math.sqrt(3);

  function hexToPixel(q, r, cfg) {
    let x, y;
    if (cfg.orientation === 'flat') {
      x = cfg.hexSize * (1.5 * q);
      y = cfg.hexSize * (SQRT3 / 2 * q + SQRT3 * r);
    } else {
      x = cfg.hexSize * (SQRT3 * q + SQRT3 / 2 * r);
      y = cfg.hexSize * (1.5 * r);
    }
    return { x: x + cfg.originX, y: y + cfg.originY };
  }

  function pixelToHex(x, y, cfg) {
    const px = x - cfg.originX;
    const py = y - cfg.originY;
    let q, r;
    if (cfg.orientation === 'flat') {
      q = (2 / 3 * px) / cfg.hexSize;
      r = (-1 / 3 * px + SQRT3 / 3 * py) / cfg.hexSize;
    } else {
      q = (SQRT3 / 3 * px - 1 / 3 * py) / cfg.hexSize;
      r = (2 / 3 * py) / cfg.hexSize;
    }
    return hexRound(q, r);
  }

  function hexRound(q, r) {
    let x = q, z = r, y = -x - z;
    let rx = Math.round(x), ry = Math.round(y), rz = Math.round(z);
    const xDiff = Math.abs(rx - x), yDiff = Math.abs(ry - y), zDiff = Math.abs(rz - z);
    if (xDiff > yDiff && xDiff > zDiff) {
      rx = -ry - rz;
    } else if (yDiff > zDiff) {
      ry = -rx - rz;
    } else {
      rz = -rx - ry;
    }
    return { q: rx, r: rz };
  }

  function hexCorners(cx, cy, size, orientation) {
    const corners = [];
    const startAngle = orientation === 'flat' ? 0 : 30;
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 180) * (startAngle + 60 * i);
      corners.push({ x: cx + size * Math.cos(angle), y: cy + size * Math.sin(angle) });
    }
    return corners;
  }

  function hexPath(ctx, cx, cy, size, orientation) {
    const corners = hexCorners(cx, cy, size, orientation);
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < corners.length; i++) {
      ctx.lineTo(corners[i].x, corners[i].y);
    }
    ctx.closePath();
  }

  // Alle Hexe (axial q,r) im Umkreis `radius` um ein Zentrum-Hex, radius 0 = nur das Hex selbst.
  function hexRange(centerQ, centerR, radius) {
    const results = [];
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

  function key(q, r) {
    return q + ',' + r;
  }

  return { hexToPixel, pixelToHex, hexRound, hexCorners, hexPath, hexRange, key };
})();
