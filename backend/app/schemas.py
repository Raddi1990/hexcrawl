from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class MapOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    base_image_url: str
    fog_image_url: str
    image_width: int
    image_height: int
    hex_size: float
    orientation: str
    origin_x: float
    origin_y: float
    sight_radius: int
    start_q: int
    start_r: int
    revealed_hex_count: int = 0


class MapStateOut(BaseModel):
    revealed_hexes: list[tuple[int, int]]
    token: tuple[int, int] | None
    token_visible: bool


class TokenMoveIn(BaseModel):
    q: int
    r: int


class HexListIn(BaseModel):
    hexes: list[tuple[int, int]]


class VisibilityIn(BaseModel):
    visible: bool


class LoginIn(BaseModel):
    username: str
    password: str


class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)


class MeOut(BaseModel):
    username: str


# --- WebSocket message payloads (server -> client) ---


class WsSnapshot(BaseModel):
    type: str = "state"
    revealed_hexes: list[tuple[int, int]]
    token: tuple[int, int] | None
    token_visible: bool


class WsDelta(BaseModel):
    type: str  # "reveal" | "hide" | "token_move" | "reset" | "visibility"
    hexes: list[tuple[int, int]] | None = None
    token: tuple[int, int] | None = None
    visible: bool | None = None
