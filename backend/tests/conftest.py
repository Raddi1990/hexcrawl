# NOTE: env vars must be set before `app.db` is imported anywhere, since it builds the
# SQLAlchemy engine at module import time from `get_settings()`. Doing this at conftest
# module level (not inside a fixture) guarantees it runs before any test module's
# `from app... import ...` executes.
import io
import os
import tempfile
from pathlib import Path

_tmp_dir = Path(tempfile.mkdtemp(prefix="hexcrawl-test-"))
os.environ["HEXCRAWL_DATA_DIR"] = str(_tmp_dir)
os.environ["HEXCRAWL_COOKIE_SECRET"] = "test-secret"
os.environ["HEXCRAWL_ADMIN_USERNAME"] = "admin"
os.environ["HEXCRAWL_ADMIN_PASSWORD"] = "test-password-123"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from PIL import Image  # noqa: E402

from app.main import app  # noqa: E402

ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "test-password-123"


@pytest.fixture()
def client():
    """A fresh TestClient per test. All tests share one SQLite file for the whole
    session (see _tmp_dir above) -- there's no per-test DB reset, so tests use
    unique map names to avoid colliding with each other's data."""
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture()
def admin_client(client: TestClient) -> TestClient:
    response = client.post("/api/auth/login", json={"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD})
    assert response.status_code == 200, response.text
    client.headers.update({"X-Hexcrawl-Client": "1"})
    return client


@pytest.fixture()
def tiny_png() -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (8, 8), (10, 20, 30)).save(buf, format="PNG")
    return buf.getvalue()
