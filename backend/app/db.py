from __future__ import annotations

import logging
from collections.abc import Callable, Generator

from sqlalchemy import create_engine, event, inspect, text
from sqlalchemy.orm import Session, sessionmaker

from app.config import get_settings
from app.models import Base, SchemaMeta

logger = logging.getLogger(__name__)

settings = get_settings()
settings.resolved_db_path.parent.mkdir(parents=True, exist_ok=True)

engine = create_engine(
    f"sqlite:///{settings.resolved_db_path}",
    connect_args={"check_same_thread": False},
    future=True,
)


@event.listens_for(engine, "connect")
def _set_sqlite_pragma(dbapi_connection, connection_record) -> None:  # noqa: ANN001, ARG001
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


def get_session() -> Generator[Session, None, None]:
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def _upgrade_0001_initial(session: Session) -> None:
    Base.metadata.create_all(bind=session.get_bind())


def _upgrade_0002_add_user_roles(session: Session) -> None:
    bind = session.get_bind()
    existing_tables = inspect(bind).get_table_names()
    if "admin_users" in existing_tables and "users" not in existing_tables:
        session.execute(text("ALTER TABLE admin_users RENAME TO users"))
    # Safe to run against a fresh DB too: Base.metadata.create_all() (0001) already
    # created "users" with the "role" column via the current model definition, so
    # this ALTER only ever fires for a pre-existing "admin_users" table without it.
    columns = {col["name"] for col in inspect(bind).get_columns("users")}
    if "role" not in columns:
        session.execute(text("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'admin'"))


# Ordered, idempotent schema upgrades. Each entry must be safe to run against a
# database already at or past its own version (in practice: create-if-missing only).
MIGRATIONS: list[tuple[int, str, Callable[[Session], None]]] = [
    (1, "0001_initial", _upgrade_0001_initial),
    (2, "0002_add_user_roles", _upgrade_0002_add_user_roles),
]


def run_migrations() -> None:
    Base.metadata.create_all(bind=engine, tables=[SchemaMeta.__table__])
    with SessionLocal() as session:
        current = session.get(SchemaMeta, "schema_version")
        current_version = int(current.value) if current else 0

        for version, name, upgrade in MIGRATIONS:
            if version <= current_version:
                continue
            logger.info("Applying migration %s (v%s)", name, version)
            upgrade(session)
            if current is None:
                current = SchemaMeta(key="schema_version", value=str(version))
                session.add(current)
            else:
                current.value = str(version)
            session.commit()
            current_version = version
