from tests.conftest import ADMIN_PASSWORD, ADMIN_USERNAME


def test_login_rejects_wrong_password(client):
    response = client.post("/api/auth/login", json={"username": ADMIN_USERNAME, "password": "wrong"})
    assert response.status_code == 401


def test_login_sets_session_cookie(client):
    response = client.post("/api/auth/login", json={"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD})
    assert response.status_code == 200
    assert "hexcrawl_session" in response.cookies


def test_me_requires_admin_session(client):
    assert client.get("/api/auth/me").status_code == 403


def test_me_returns_username_when_logged_in(admin_client):
    response = admin_client.get("/api/auth/me")
    assert response.status_code == 200
    assert response.json()["username"] == ADMIN_USERNAME


def test_change_password_requires_csrf_header(client):
    client.post("/api/auth/login", json={"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD})
    response = client.post(
        "/api/auth/change-password",
        json={"current_password": ADMIN_PASSWORD, "new_password": "irrelevant-new-pass"},
    )
    assert response.status_code == 403


def test_change_password_round_trip(admin_client):
    # Restores the original password at the end since the DB is shared across the
    # whole test session (see conftest) and other tests' admin_client fixture logs
    # in with ADMIN_PASSWORD.
    changed = admin_client.post(
        "/api/auth/change-password",
        json={"current_password": ADMIN_PASSWORD, "new_password": "a-temporary-password-1"},
    )
    assert changed.status_code == 200

    admin_client.cookies.clear()
    relogin = admin_client.post(
        "/api/auth/login", json={"username": ADMIN_USERNAME, "password": "a-temporary-password-1"}
    )
    assert relogin.status_code == 200

    admin_client.headers.update({"X-Hexcrawl-Client": "1"})
    restored = admin_client.post(
        "/api/auth/change-password",
        json={"current_password": "a-temporary-password-1", "new_password": ADMIN_PASSWORD},
    )
    assert restored.status_code == 200


def test_logout_clears_session(admin_client):
    assert admin_client.get("/api/auth/me").status_code == 200
    response = admin_client.post("/api/auth/logout")
    assert response.status_code == 200
    admin_client.cookies.clear()
    assert admin_client.get("/api/auth/me").status_code == 403
