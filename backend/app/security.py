from __future__ import annotations

from typing import Annotated

from fastapi import Cookie, Depends, Header, HTTPException, Response, status
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_session
from app.models import AdminUser

SESSION_COOKIE_NAME = "hexcrawl_session"
CSRF_HEADER_NAME = "x-hexcrawl-client"

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)


def _serializer() -> URLSafeTimedSerializer:
    settings = get_settings()
    return URLSafeTimedSerializer(settings.cookie_secret, salt="hexcrawl-session")


def create_session_cookie(response: Response, admin_id: int) -> None:
    settings = get_settings()
    token = _serializer().dumps({"admin_id": admin_id})
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        max_age=settings.session_max_age_seconds,
        httponly=True,
        samesite="lax",
        secure=settings.cookie_secure,
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(key=SESSION_COOKIE_NAME, path="/")


def read_session_admin_id(token: str | None) -> int | None:
    if not token:
        return None
    settings = get_settings()
    try:
        data = _serializer().loads(token, max_age=settings.session_max_age_seconds)
    except (BadSignature, SignatureExpired):
        return None
    admin_id = data.get("admin_id")
    return int(admin_id) if isinstance(admin_id, int) else None


def get_current_admin(
    session: Annotated[Session, Depends(get_session)],
    hexcrawl_session: Annotated[str | None, Cookie()] = None,
) -> AdminUser | None:
    admin_id = read_session_admin_id(hexcrawl_session)
    if admin_id is None:
        return None
    return session.get(AdminUser, admin_id)


def require_admin(
    admin: Annotated[AdminUser | None, Depends(get_current_admin)],
) -> AdminUser:
    if admin is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="forbidden")
    return admin


def require_csrf_header(
    x_hexcrawl_client: Annotated[str | None, Header()] = None,
) -> None:
    if x_hexcrawl_client != "1":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="missing csrf header")


def is_admin_session_token(token: str | None) -> bool:
    """Used by the WebSocket handshake, which reads the cookie manually rather than via Depends()."""
    return read_session_admin_id(token) is not None
