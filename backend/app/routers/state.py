from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import state_service
from app.db import get_session
from app.models import Map
from app.schemas import HexListIn, MapStateOut, TokenMoveIn, VisibilityIn
from app.security import require_admin, require_csrf_header
from app.ws_manager import manager

router = APIRouter(prefix="/api/maps/{map_id}", tags=["state"])


def _get_map_or_404(session: Session, map_id: str) -> Map:
    map_row = session.get(Map, map_id)
    if map_row is None:
        raise HTTPException(status_code=404, detail="map not found")
    return map_row


@router.get("/state", response_model=MapStateOut)
def load_state(map_id: str, session: Session = Depends(get_session)) -> MapStateOut:
    _get_map_or_404(session, map_id)
    snapshot = state_service.get_snapshot(session, map_id)
    return MapStateOut(
        revealed_hexes=snapshot["revealed_hexes"],
        token=snapshot["token"],
        token_visible=snapshot["token_visible"],
    )


@router.post("/reveal", dependencies=[Depends(require_admin), Depends(require_csrf_header)])
async def reveal(map_id: str, payload: HexListIn, session: Session = Depends(get_session)) -> dict:
    _get_map_or_404(session, map_id)
    delta = state_service.reveal_hexes(session, map_id, payload.hexes)
    await manager.broadcast(map_id, delta)
    return {"ok": True}


@router.post("/hide", dependencies=[Depends(require_admin), Depends(require_csrf_header)])
async def hide(map_id: str, payload: HexListIn, session: Session = Depends(get_session)) -> dict:
    _get_map_or_404(session, map_id)
    delta = state_service.hide_hexes(session, map_id, payload.hexes)
    await manager.broadcast(map_id, delta)
    return {"ok": True}


@router.post("/token", dependencies=[Depends(require_admin), Depends(require_csrf_header)])
async def move_token(map_id: str, payload: TokenMoveIn, session: Session = Depends(get_session)) -> dict:
    map_row = _get_map_or_404(session, map_id)
    delta = state_service.move_token(session, map_id, payload.q, payload.r, map_row.sight_radius)
    await manager.broadcast(map_id, delta)
    return {"ok": True}


@router.post("/reset", dependencies=[Depends(require_admin), Depends(require_csrf_header)])
async def reset(map_id: str, session: Session = Depends(get_session)) -> dict:
    _get_map_or_404(session, map_id)
    delta = state_service.reset_fog(session, map_id)
    await manager.broadcast(map_id, delta)
    return {"ok": True}


@router.post("/visibility", dependencies=[Depends(require_admin), Depends(require_csrf_header)])
async def visibility(map_id: str, payload: VisibilityIn, session: Session = Depends(get_session)) -> dict:
    _get_map_or_404(session, map_id)
    delta = state_service.set_visibility(session, map_id, payload.visible)
    await manager.broadcast(map_id, delta)
    return {"ok": True}
