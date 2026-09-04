from __future__ import annotations

import logging
from collections import defaultdict
from typing import Any

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class MapConnectionManager:
    """In-process fan-out registry: one process only.

    If this service is ever run as multiple replicas behind a load balancer, this
    needs to become a shared broker (e.g. Redis pub/sub) — flagged in the plan,
    not something this class handles.
    """

    def __init__(self) -> None:
        self._connections: dict[str, set[WebSocket]] = defaultdict(set)

    async def connect(self, map_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections[map_id].add(websocket)

    def disconnect(self, map_id: str, websocket: WebSocket) -> None:
        connections = self._connections.get(map_id)
        if not connections:
            return
        connections.discard(websocket)
        if not connections:
            self._connections.pop(map_id, None)

    async def broadcast(self, map_id: str, message: dict[str, Any]) -> None:
        for websocket in list(self._connections.get(map_id, ())):
            try:
                await websocket.send_json(message)
            except Exception:
                logger.debug("dropping dead websocket for map %s", map_id, exc_info=True)
                self.disconnect(map_id, websocket)


manager = MapConnectionManager()
