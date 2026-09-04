from fastapi.testclient import TestClient

from app.main import app


def _create_map(admin_client, name, tiny_png):
    response = admin_client.post(
        "/api/maps",
        data={"name": name},
        files={
            "base_image": ("base.png", tiny_png, "image/png"),
            "fog_image": ("fog.png", tiny_png, "image/png"),
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_config_reports_require_login_true_by_default(client):
    response = client.get("/api/config")
    assert response.status_code == 200
    assert response.json() == {"require_login": True}


def test_config_reports_require_login_false_when_disabled(client, require_login_disabled):
    response = client.get("/api/config")
    assert response.json() == {"require_login": False}


def test_anonymous_can_list_maps_when_login_not_required(client, require_login_disabled):
    response = client.get("/api/maps")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_anonymous_ws_connects_as_spectator_when_login_not_required(admin_client, require_login_disabled, tiny_png):
    created = _create_map(admin_client, "Offene Karte", tiny_png)

    # A deliberately fresh, never-authenticated client -- `admin_client` mutates the
    # `client` fixture it's built on in place, so reusing that object here wouldn't
    # actually be anonymous.
    with TestClient(app) as anonymous_client, anonymous_client.websocket_connect(f"/ws/maps/{created['id']}") as ws:
        snapshot = ws.receive_json()
        assert snapshot["type"] == "state"
