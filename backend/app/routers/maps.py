from __future__ import annotations

import shutil

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_session
from app.images import InvalidImageError, save_uploaded_image
from app.models import Map, MapState, RevealedHex
from app.schemas import MapOut
from app.security import require_admin, require_any_user, require_csrf_header
from app.slugs import is_valid_map_id, slugify, unique_map_id

router = APIRouter(tags=["maps"])

_ALLOWED_IMAGE_FILENAMES = {
    f"{name}.{ext}" for name in ("base", "fog") for ext in ("jpg", "png", "webp")
}


def _map_to_out(session: Session, map_row: Map) -> MapOut:
    revealed_count = (
        session.scalar(select(func.count()).select_from(RevealedHex).where(RevealedHex.map_id == map_row.id)) or 0
    )
    return MapOut(
        id=map_row.id,
        name=map_row.name,
        base_image_url=f"/maps/{map_row.id}/base.{map_row.base_image_ext}",
        fog_image_url=f"/maps/{map_row.id}/fog.{map_row.fog_image_ext}",
        image_width=map_row.image_width,
        image_height=map_row.image_height,
        hex_size=map_row.hex_size,
        orientation=map_row.orientation,
        origin_x=map_row.origin_x,
        origin_y=map_row.origin_y,
        sight_radius=map_row.sight_radius,
        start_q=map_row.start_q,
        start_r=map_row.start_r,
        revealed_hex_count=revealed_count,
    )


@router.get("/api/maps", response_model=list[MapOut], dependencies=[Depends(require_any_user)])
def list_maps(session: Session = Depends(get_session)) -> list[MapOut]:
    maps = session.scalars(select(Map).order_by(Map.created_at)).all()
    return [_map_to_out(session, m) for m in maps]


@router.get("/api/maps/{map_id}", response_model=MapOut, dependencies=[Depends(require_any_user)])
def get_map(map_id: str, session: Session = Depends(get_session)) -> MapOut:
    map_row = session.get(Map, map_id)
    if map_row is None:
        raise HTTPException(status_code=404, detail="map not found")
    return _map_to_out(session, map_row)


@router.post(
    "/api/maps",
    response_model=MapOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin), Depends(require_csrf_header)],
)
def create_map(
    name: str = Form(...),
    base_image: UploadFile = File(...),
    fog_image: UploadFile = File(...),
    session: Session = Depends(get_session),
) -> MapOut:
    name = name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="name required")

    settings = get_settings()
    existing_ids = session.scalars(select(Map.id)).all()
    map_id = unique_map_id(slugify(name), existing_ids)
    dest_dir = settings.resolved_maps_dir / map_id

    try:
        base_ext, width, height = save_uploaded_image(base_image, dest_dir, "base", settings.max_image_dimension)
        fog_ext, _fog_w, _fog_h = save_uploaded_image(fog_image, dest_dir, "fog", settings.max_image_dimension)
    except InvalidImageError as exc:
        shutil.rmtree(dest_dir, ignore_errors=True)
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    map_row = Map(
        id=map_id,
        name=name,
        base_image_ext=base_ext,
        fog_image_ext=fog_ext,
        image_width=width,
        image_height=height,
    )
    session.add(map_row)
    session.add(MapState(map_id=map_id))
    session.commit()
    return _map_to_out(session, map_row)


@router.patch(
    "/api/maps/{map_id}",
    response_model=MapOut,
    dependencies=[Depends(require_admin), Depends(require_csrf_header)],
)
def update_map(
    map_id: str,
    name: str | None = Form(None),
    hex_size: float | None = Form(None),
    orientation: str | None = Form(None),
    origin_x: float | None = Form(None),
    origin_y: float | None = Form(None),
    sight_radius: int | None = Form(None),
    start_q: int | None = Form(None),
    start_r: int | None = Form(None),
    base_image: UploadFile | None = File(None),
    fog_image: UploadFile | None = File(None),
    session: Session = Depends(get_session),
) -> MapOut:
    map_row = session.get(Map, map_id)
    if map_row is None:
        raise HTTPException(status_code=404, detail="map not found")

    if name is not None and name.strip():
        map_row.name = name.strip()
    if hex_size is not None:
        map_row.hex_size = hex_size
    if origin_x is not None:
        map_row.origin_x = origin_x
    if origin_y is not None:
        map_row.origin_y = origin_y
    if sight_radius is not None:
        map_row.sight_radius = sight_radius
    if start_q is not None:
        map_row.start_q = start_q
    if start_r is not None:
        map_row.start_r = start_r
    if orientation is not None and orientation in ("pointy", "flat"):
        map_row.orientation = orientation

    settings = get_settings()
    dest_dir = settings.resolved_maps_dir / map_id
    try:
        if base_image is not None:
            ext, width, height = save_uploaded_image(base_image, dest_dir, "base", settings.max_image_dimension)
            map_row.base_image_ext = ext
            map_row.image_width = width
            map_row.image_height = height
        if fog_image is not None:
            ext, _fog_w, _fog_h = save_uploaded_image(fog_image, dest_dir, "fog", settings.max_image_dimension)
            map_row.fog_image_ext = ext
    except InvalidImageError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    session.commit()
    return _map_to_out(session, map_row)


@router.post(
    "/api/maps/{map_id}/duplicate",
    response_model=MapOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin), Depends(require_csrf_header)],
)
def duplicate_map(map_id: str, session: Session = Depends(get_session)) -> MapOut:
    source = session.get(Map, map_id)
    if source is None:
        raise HTTPException(status_code=404, detail="map not found")

    settings = get_settings()
    existing_ids = session.scalars(select(Map.id)).all()
    new_id = unique_map_id(slugify(source.name), existing_ids)

    shutil.copytree(settings.resolved_maps_dir / source.id, settings.resolved_maps_dir / new_id)

    new_map = Map(
        id=new_id,
        name=f"{source.name} (Kopie)",
        base_image_ext=source.base_image_ext,
        fog_image_ext=source.fog_image_ext,
        image_width=source.image_width,
        image_height=source.image_height,
        hex_size=source.hex_size,
        orientation=source.orientation,
        origin_x=source.origin_x,
        origin_y=source.origin_y,
        sight_radius=source.sight_radius,
        start_q=source.start_q,
        start_r=source.start_r,
    )
    session.add(new_map)
    session.add(MapState(map_id=new_id))
    session.commit()
    return _map_to_out(session, new_map)


@router.delete(
    "/api/maps/{map_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_admin), Depends(require_csrf_header)],
)
def delete_map(map_id: str, session: Session = Depends(get_session)) -> None:
    map_row = session.get(Map, map_id)
    if map_row is None:
        raise HTTPException(status_code=404, detail="map not found")
    settings = get_settings()
    session.delete(map_row)
    session.commit()
    shutil.rmtree(settings.resolved_maps_dir / map_id, ignore_errors=True)


@router.get("/maps/{map_id}/{filename}", dependencies=[Depends(require_any_user)])
def serve_map_image(map_id: str, filename: str) -> FileResponse:
    if not is_valid_map_id(map_id) or filename not in _ALLOWED_IMAGE_FILENAMES:
        raise HTTPException(status_code=404, detail="not found")

    settings = get_settings()
    maps_root = settings.resolved_maps_dir.resolve()
    path = (maps_root / map_id / filename).resolve()
    if maps_root not in path.parents or not path.is_file():
        raise HTTPException(status_code=404, detail="not found")
    return FileResponse(path)
