# Python twin of assets/js/hexgrid.js's hexRange, kept in sync deliberately so that
# server-side sight-radius reveals match the client's axial hex math exactly.
# See https://www.redblobgames.com/grids/hexagons/ for the underlying formulas.


def hex_range(center_q: int, center_r: int, radius: int) -> list[tuple[int, int]]:
    """All axial (q, r) hexes within `radius` of a center hex (radius 0 = just the center)."""
    results: list[tuple[int, int]] = []
    for dx in range(-radius, radius + 1):
        dy_min = max(-radius, -dx - radius)
        dy_max = min(radius, -dx + radius)
        for dy in range(dy_min, dy_max + 1):
            dz = -dx - dy
            results.append((center_q + dx, center_r + dz))
    return results
