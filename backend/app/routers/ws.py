from __future__ import annotations

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app import state_service
from app.db import SessionLocal
from app.models import Map
from app.security import SESSION_COOKIE_NAME, session_role
from app.ws_manager import manager

router = APIRouter()


@router.websocket("/ws/maps/{map_id}")
async def map_socket(websocket: WebSocket, map_id: str) -> None:
    role = session_role(websocket.cookies.get(SESSION_COOKIE_NAME))
    if role is None:
        await websocket.close(code=4401)
        return
    is_admin = role == "admin"

    with SessionLocal() as session:
        if session.get(Map, map_id) is None:
            await websocket.close(code=4404)
            return
        snapshot = state_service.get_snapshot(session, map_id)

    await manager.connect(map_id, websocket)
    try:
        await websocket.send_json(snapshot)

        while True:
            message = await websocket.receive_json()
            if not is_admin:
                continue  # players are read-only spectators; silently drop any inbound message

            delta = _apply_mutation(map_id, message)
            if delta is not None:
                await manager.broadcast(map_id, delta)
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(map_id, websocket)


def _apply_mutation(map_id: str, message: dict) -> dict | None:
    msg_type = message.get("type")
    with SessionLocal() as session:
        map_row = session.get(Map, map_id)
        if map_row is None:
            return None

        if msg_type == "reveal":
            hexes = [(int(q), int(r)) for q, r in message.get("hexes", [])]
            return state_service.reveal_hexes(session, map_id, hexes)
        if msg_type == "hide":
            hexes = [(int(q), int(r)) for q, r in message.get("hexes", [])]
            return state_service.hide_hexes(session, map_id, hexes)
        if msg_type == "token_move":
            return state_service.move_token(
                session, map_id, int(message["q"]), int(message["r"]), map_row.sight_radius
            )
        if msg_type == "reset":
            return state_service.reset_fog(session, map_id)
        if msg_type == "visibility":
            return state_service.set_visibility(session, map_id, bool(message.get("visible")))
        return None
