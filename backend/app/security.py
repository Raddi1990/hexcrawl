from __future__ import annotations

from typing import Annotated

from fastapi import Cookie, Depends, Header, HTTPException, Response, status
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_session
from app.models import User

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


def create_session_cookie(response: Response, user_id: int, role: str) -> None:
    settings = get_settings()
    token = _serializer().dumps({"user_id": user_id, "role": role})
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


def read_session_user(token: str | None) -> tuple[int, str] | None:
    """Returns (user_id, role) from a signed session token, or None if absent/invalid."""
    if not token:
        return None
    settings = get_settings()
    try:
        data = _serializer().loads(token, max_age=settings.session_max_age_seconds)
    except (BadSignature, SignatureExpired):
        return None
    user_id = data.get("user_id")
    role = data.get("role")
    if not isinstance(user_id, int) or not isinstance(role, str):
        return None
    return user_id, role


def get_current_user(
    session: Annotated[Session, Depends(get_session)],
    hexcrawl_session: Annotated[str | None, Cookie()] = None,
) -> User | None:
    parsed = read_session_user(hexcrawl_session)
    if parsed is None:
        return None
    user_id, _role = parsed
    return session.get(User, user_id)


def require_any_user(
    user: Annotated[User | None, Depends(get_current_user)],
) -> User:
    if user is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="forbidden")
    return user


def require_admin(
    user: Annotated[User, Depends(require_any_user)],
) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="forbidden")
    return user


def require_csrf_header(
    x_hexcrawl_client: Annotated[str | None, Header()] = None,
) -> None:
    if x_hexcrawl_client != "1":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="missing csrf header")


def session_role(token: str | None) -> str | None:
    """Used by the WebSocket handshake, which reads the cookie manually rather than via Depends()."""
    parsed = read_session_user(token)
    return parsed[1] if parsed is not None else None
