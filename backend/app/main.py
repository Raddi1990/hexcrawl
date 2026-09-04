from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select

from app.config import get_settings
from app.db import SessionLocal, run_migrations
from app.models import User
from app.routers import auth, maps, state, users, ws
from app.security import hash_password


def _bootstrap_admin() -> None:
    settings = get_settings()
    if not settings.admin_username or not settings.admin_password:
        return
    with SessionLocal() as session:
        if session.scalar(select(User.id).limit(1)) is not None:
            return
        session.add(
            User(
                username=settings.admin_username,
                password_hash=hash_password(settings.admin_password),
                role="admin",
            )
        )
        session.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):  # noqa: ANN201, ARG001
    run_migrations()
    _bootstrap_admin()
    yield


app = FastAPI(title="Hexcrawl", lifespan=lifespan)

_settings = get_settings()
if _settings.cors_allow_origins_list:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_settings.cors_allow_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

app.include_router(auth.router)
app.include_router(maps.router)
app.include_router(state.router)
app.include_router(users.router)
app.include_router(ws.router)


@app.get("/api/health")
def health() -> dict:
    return {"ok": True}


@app.get("/api/config")
def public_config() -> dict:
    """Public, unauthenticated -- the frontend needs this before it knows whether
    it's even allowed to ask who's logged in."""
    settings = get_settings()
    return {
        "require_login": settings.require_login,
        "user_management_url": settings.user_management_url or None,
    }


# The frontend build (see ../frontend, copied here by the root Dockerfile) is served
# as a single-page app: any path that isn't a known static asset falls back to
# index.html so client-side routing (React Router) can take over.
_STATIC_DIR = Path(__file__).parent / "static"
if _STATIC_DIR.is_dir():
    assets_dir = _STATIC_DIR / "assets"
    if assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="spa-assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def serve_spa(full_path: str) -> FileResponse:
        candidate = _STATIC_DIR / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(_STATIC_DIR / "index.html")
