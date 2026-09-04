from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_session
from app.models import AdminUser
from app.schemas import ChangePasswordIn, LoginIn, MeOut
from app.security import (
    clear_session_cookie,
    create_session_cookie,
    hash_password,
    require_admin,
    require_csrf_header,
    verify_password,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=MeOut)
def login(payload: LoginIn, response: Response, session: Session = Depends(get_session)) -> MeOut:
    admin = session.scalar(select(AdminUser).where(AdminUser.username == payload.username))
    if admin is None or not verify_password(payload.password, admin.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid credentials")
    create_session_cookie(response, admin.id)
    return MeOut(username=admin.username)


@router.post("/logout", dependencies=[Depends(require_csrf_header)])
def logout(response: Response) -> dict:
    clear_session_cookie(response)
    return {"ok": True}


@router.get("/me", response_model=MeOut)
def me(admin: AdminUser = Depends(require_admin)) -> MeOut:
    return MeOut(username=admin.username)


@router.post("/change-password", dependencies=[Depends(require_csrf_header)])
def change_password(
    payload: ChangePasswordIn,
    admin: AdminUser = Depends(require_admin),
    session: Session = Depends(get_session),
) -> dict:
    if not verify_password(payload.current_password, admin.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="current password incorrect")
    admin.password_hash = hash_password(payload.new_password)
    session.commit()
    return {"ok": True}
