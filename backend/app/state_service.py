from __future__ import annotations

from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.hexgrid import hex_range
from app.models import MapState, RevealedHex


def _ensure_state(session: Session, map_id: str) -> MapState:
    state = session.get(MapState, map_id)
    if state is None:
        state = MapState(map_id=map_id)
        session.add(state)
        session.flush()
    return state


def _add_hex_if_missing(session: Session, map_id: str, q: int, r: int) -> None:
    exists = session.get(RevealedHex, {"map_id": map_id, "q": q, "r": r})
    if exists is None:
        session.add(RevealedHex(map_id=map_id, q=q, r=r))


def get_snapshot(session: Session, map_id: str) -> dict[str, Any]:
    state = _ensure_state(session, map_id)
    hexes = session.scalars(select(RevealedHex).where(RevealedHex.map_id == map_id)).all()
    return {
        "type": "state",
        "revealed_hexes": [(h.q, h.r) for h in hexes],
        "token": (state.token_q, state.token_r) if state.token_q is not None else None,
        "token_visible": state.token_visible,
    }


def reveal_hexes(session: Session, map_id: str, hexes: list[tuple[int, int]]) -> dict[str, Any]:
    _ensure_state(session, map_id)
    for q, r in hexes:
        _add_hex_if_missing(session, map_id, q, r)
    session.commit()
    return {"type": "reveal", "hexes": hexes}


def hide_hexes(session: Session, map_id: str, hexes: list[tuple[int, int]]) -> dict[str, Any]:
    for q, r in hexes:
        session.execute(
            delete(RevealedHex).where(RevealedHex.map_id == map_id, RevealedHex.q == q, RevealedHex.r == r)
        )
    session.commit()
    return {"type": "hide", "hexes": hexes}


def move_token(session: Session, map_id: str, q: int, r: int, sight_radius: int) -> dict[str, Any]:
    state = _ensure_state(session, map_id)
    state.token_q = q
    state.token_r = r

    newly_revealed = hex_range(q, r, sight_radius)
    for hq, hr in newly_revealed:
        _add_hex_if_missing(session, map_id, hq, hr)
    session.commit()
    return {"type": "token_move", "token": (q, r), "hexes": newly_revealed}


def reset_fog(session: Session, map_id: str) -> dict[str, Any]:
    session.execute(delete(RevealedHex).where(RevealedHex.map_id == map_id))
    session.commit()
    return {"type": "reset"}


def set_visibility(session: Session, map_id: str, visible: bool) -> dict[str, Any]:
    state = _ensure_state(session, map_id)
    state.token_visible = visible
    session.commit()
    return {"type": "visibility", "visible": visible}
