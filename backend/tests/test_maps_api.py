def _create_map(admin_client, name, tiny_png, **form_overrides):
    data = {"name": name, **form_overrides}
    response = admin_client.post(
        "/api/maps",
        data=data,
        files={
            "base_image": ("base.png", tiny_png, "image/png"),
            "fog_image": ("fog.png", tiny_png, "image/png"),
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_list_maps_requires_login(client):
    response = client.get("/api/maps")
    assert response.status_code == 403


def test_list_maps_returns_a_list(player_client):
    response = player_client.get("/api/maps")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_create_map_requires_admin(client, tiny_png):
    response = client.post(
        "/api/maps",
        data={"name": "Verbotene Karte"},
        files={
            "base_image": ("base.png", tiny_png, "image/png"),
            "fog_image": ("fog.png", tiny_png, "image/png"),
        },
    )
    assert response.status_code == 403


def test_create_map_round_trip(admin_client, tiny_png):
    created = _create_map(admin_client, "Testkarte Alpha", tiny_png)
    assert created["id"] == "testkarte-alpha"
    assert created["orientation"] == "pointy"
    assert created["revealed_hex_count"] == 0
    assert created["image_width"] == 8 and created["image_height"] == 8

    fetched = admin_client.get(f"/api/maps/{created['id']}")
    assert fetched.status_code == 200
    assert fetched.json()["name"] == "Testkarte Alpha"


def test_create_map_rejects_missing_name(admin_client, tiny_png):
    response = admin_client.post(
        "/api/maps",
        data={"name": "   "},
        files={
            "base_image": ("base.png", tiny_png, "image/png"),
            "fog_image": ("fog.png", tiny_png, "image/png"),
        },
    )
    assert response.status_code == 400


def test_create_map_rejects_non_image_upload(admin_client):
    response = admin_client.post(
        "/api/maps",
        data={"name": "Kaputte Karte"},
        files={
            "base_image": ("base.txt", b"not an image", "text/plain"),
            "fog_image": ("fog.txt", b"not an image", "text/plain"),
        },
    )
    assert response.status_code == 400


def test_update_map_patches_calibration_fields(admin_client, tiny_png):
    created = _create_map(admin_client, "Kalibrierkarte", tiny_png)

    response = admin_client.patch(
        f"/api/maps/{created['id']}",
        data={"hex_size": "40", "orientation": "flat", "sight_radius": "2"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["hex_size"] == 40
    assert body["orientation"] == "flat"
    assert body["sight_radius"] == 2


def test_duplicate_map_creates_independent_copy(admin_client, tiny_png):
    created = _create_map(admin_client, "Dupliziertekarte", tiny_png)

    response = admin_client.post(f"/api/maps/{created['id']}/duplicate")
    assert response.status_code == 201
    duplicate = response.json()
    assert duplicate["id"] != created["id"]
    assert duplicate["name"] == f"{created['name']} (Kopie)"


def test_delete_map_removes_it(admin_client, tiny_png):
    created = _create_map(admin_client, "Zuloeschendekarte", tiny_png)

    response = admin_client.delete(f"/api/maps/{created['id']}")
    assert response.status_code == 204
    assert admin_client.get(f"/api/maps/{created['id']}").status_code == 404


def test_serve_map_image_rejects_invalid_map_id(player_client):
    response = player_client.get("/maps/NOT_VALID/base.png")
    assert response.status_code == 404


def test_serve_map_image_rejects_disallowed_filename(admin_client, tiny_png):
    created = _create_map(admin_client, "Bildkarte", tiny_png)
    response = admin_client.get(f"/maps/{created['id']}/config.php")
    assert response.status_code == 404


def test_serve_map_image_returns_uploaded_file(admin_client, tiny_png):
    created = _create_map(admin_client, "Bildkarte Zwei", tiny_png)
    response = admin_client.get(created["base_image_url"])
    assert response.status_code == 200
    assert response.headers["content-type"] == "image/png"
