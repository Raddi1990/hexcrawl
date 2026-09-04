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


def test_state_defaults_to_empty(admin_client, tiny_png):
    created = _create_map(admin_client, "Statuskarte", tiny_png)

    response = admin_client.get(f"/api/maps/{created['id']}/state")
    assert response.status_code == 200
    body = response.json()
    assert body["revealed_hexes"] == []
    assert body["token"] is None
    assert body["token_visible"] is False


def test_state_mutations_require_admin(client, admin_client, tiny_png):
    created = _create_map(admin_client, "Rechtekarte", tiny_png)

    response = client.post(f"/api/maps/{created['id']}/reveal", json={"hexes": [[0, 0]]})
    assert response.status_code == 403


def test_token_move_reveals_sight_radius(admin_client, tiny_png):
    created = _create_map(admin_client, "Sichtradiuskarte", tiny_png)
    admin_client.patch(f"/api/maps/{created['id']}", data={"sight_radius": "1"})

    response = admin_client.post(f"/api/maps/{created['id']}/token", json={"q": 0, "r": 0})
    assert response.status_code == 200

    state = admin_client.get(f"/api/maps/{created['id']}/state").json()
    assert state["token"] == [0, 0]
    # center hex + 6 neighbours at radius 1
    assert len(state["revealed_hexes"]) == 7


def test_reveal_hide_reset_round_trip(admin_client, tiny_png):
    created = _create_map(admin_client, "Aufdeckkarte", tiny_png)
    map_id = created["id"]

    admin_client.post(f"/api/maps/{map_id}/reveal", json={"hexes": [[1, 1], [2, 2]]})
    state = admin_client.get(f"/api/maps/{map_id}/state").json()
    assert sorted(state["revealed_hexes"]) == [[1, 1], [2, 2]]

    admin_client.post(f"/api/maps/{map_id}/hide", json={"hexes": [[1, 1]]})
    state = admin_client.get(f"/api/maps/{map_id}/state").json()
    assert state["revealed_hexes"] == [[2, 2]]

    admin_client.post(f"/api/maps/{map_id}/reset")
    state = admin_client.get(f"/api/maps/{map_id}/state").json()
    assert state["revealed_hexes"] == []


def test_visibility_toggle(admin_client, tiny_png):
    created = _create_map(admin_client, "Sichtbarkeitskarte", tiny_png)

    response = admin_client.post(f"/api/maps/{created['id']}/visibility", json={"visible": True})
    assert response.status_code == 200
    state = admin_client.get(f"/api/maps/{created['id']}/state").json()
    assert state["token_visible"] is True
