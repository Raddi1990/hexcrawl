from tests.conftest import ADMIN_USERNAME


def test_list_users_requires_admin(client, player_client):
    assert client.get("/api/users").status_code == 403
    assert player_client.get("/api/users").status_code == 403


def test_list_users_includes_bootstrapped_admin(admin_client):
    response = admin_client.get("/api/users")
    assert response.status_code == 200
    usernames = [u["username"] for u in response.json()]
    assert ADMIN_USERNAME in usernames


def test_create_user_round_trip(admin_client):
    response = admin_client.post(
        "/api/users", json={"username": "created-via-test", "password": "a-decent-password", "role": "player"}
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["username"] == "created-via-test"
    assert body["role"] == "player"
    assert "password" not in body and "password_hash" not in body

    login = admin_client.post("/api/auth/login", json={"username": "created-via-test", "password": "a-decent-password"})
    assert login.status_code == 200
    assert login.json()["role"] == "player"


def test_create_user_rejects_duplicate_username(admin_client):
    first = admin_client.post(
        "/api/users", json={"username": "duplicate-user", "password": "a-decent-password", "role": "player"}
    )
    assert first.status_code == 201

    second = admin_client.post(
        "/api/users", json={"username": "duplicate-user", "password": "another-password", "role": "player"}
    )
    assert second.status_code == 409


def test_create_user_requires_admin(client, player_client):
    payload = {"username": "should-not-exist", "password": "a-decent-password", "role": "player"}
    assert client.post("/api/users", json=payload).status_code == 403
    assert player_client.post("/api/users", json=payload).status_code == 403


def test_cannot_delete_last_admin(admin_client):
    response = admin_client.get("/api/users")
    admin_id = next(u["id"] for u in response.json() if u["username"] == ADMIN_USERNAME)

    response = admin_client.delete(f"/api/users/{admin_id}")
    assert response.status_code == 400


def test_delete_user_removes_it(admin_client):
    created = admin_client.post(
        "/api/users", json={"username": "to-delete", "password": "a-decent-password", "role": "player"}
    )
    user_id = created.json()["id"]

    response = admin_client.delete(f"/api/users/{user_id}")
    assert response.status_code == 204

    remaining = [u["id"] for u in admin_client.get("/api/users").json()]
    assert user_id not in remaining
