from __future__ import annotations

import datetime as dt

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    PrimaryKeyConstraint,
    String,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def utcnow() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    role: Mapped[str] = mapped_column(String, nullable=False, default="admin")
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )

    __table_args__ = (CheckConstraint("role IN ('admin','player')", name="ck_users_role"),)


class Map(Base):
    __tablename__ = "maps"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    base_image_ext: Mapped[str] = mapped_column(String, nullable=False)
    fog_image_ext: Mapped[str] = mapped_column(String, nullable=False)
    image_width: Mapped[int] = mapped_column(Integer, nullable=False)
    image_height: Mapped[int] = mapped_column(Integer, nullable=False)
    hex_size: Mapped[float] = mapped_column(Float, nullable=False, default=50)
    orientation: Mapped[str] = mapped_column(String, nullable=False, default="pointy")
    origin_x: Mapped[float] = mapped_column(Float, nullable=False, default=25)
    origin_y: Mapped[float] = mapped_column(Float, nullable=False, default=25)
    sight_radius: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    start_q: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    start_r: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )

    state: Mapped["MapState"] = relationship(
        back_populates="map", uselist=False, cascade="all, delete-orphan", passive_deletes=True
    )
    revealed_hexes: Mapped[list["RevealedHex"]] = relationship(
        back_populates="map", cascade="all, delete-orphan", passive_deletes=True
    )

    __table_args__ = (CheckConstraint("orientation IN ('pointy','flat')", name="ck_maps_orientation"),)


class MapState(Base):
    __tablename__ = "map_state"

    map_id: Mapped[str] = mapped_column(ForeignKey("maps.id", ondelete="CASCADE"), primary_key=True)
    token_q: Mapped[int | None] = mapped_column(Integer, nullable=True)
    token_r: Mapped[int | None] = mapped_column(Integer, nullable=True)
    token_visible: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    updated_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )

    map: Mapped["Map"] = relationship(back_populates="state")


class RevealedHex(Base):
    __tablename__ = "revealed_hexes"

    map_id: Mapped[str] = mapped_column(ForeignKey("maps.id", ondelete="CASCADE"))
    q: Mapped[int] = mapped_column(Integer)
    r: Mapped[int] = mapped_column(Integer)

    map: Mapped["Map"] = relationship(back_populates="revealed_hexes")

    __table_args__ = (PrimaryKeyConstraint("map_id", "q", "r"),)


class SchemaMeta(Base):
    __tablename__ = "schema_meta"

    key: Mapped[str] = mapped_column(String, primary_key=True)
    value: Mapped[str] = mapped_column(String, nullable=False)
