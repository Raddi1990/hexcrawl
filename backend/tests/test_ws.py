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


def test_ws_sends_snapshot_on_connect(admin_client, tiny_png):
    created = _create_map(admin_client, "WebSocketkarte", tiny_png)

    with admin_client.websocket_connect(f"/ws/maps/{created['id']}") as ws:
        snapshot = ws.receive_json()
        assert snapshot["type"] == "state"
        assert snapshot["revealed_hexes"] == []


def test_ws_unknown_map_closes_connection(client):
    import pytest
    from starlette.websockets import WebSocketDisconnect

    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect("/ws/maps/does-not-exist"):
            pass


def test_ws_admin_mutation_broadcasts_to_player(admin_client, client, tiny_png):
    created = _create_map(admin_client, "Broadcastkarte", tiny_png)
    map_id = created["id"]

    with admin_client.websocket_connect(f"/ws/maps/{map_id}") as admin_ws:
        with client.websocket_connect(f"/ws/maps/{map_id}") as player_ws:
            admin_ws.receive_json()  # initial snapshot
            player_ws.receive_json()  # initial snapshot

            admin_ws.send_json({"type": "reveal", "hexes": [[3, 3]]})

            admin_delta = admin_ws.receive_json()
            player_delta = player_ws.receive_json()
            assert admin_delta == {"type": "reveal", "hexes": [[3, 3]]}
            assert player_delta == admin_delta


def test_ws_player_writes_are_silently_ignored(admin_client, client, tiny_png):
    created = _create_map(admin_client, "Spielerkarte", tiny_png)
    map_id = created["id"]

    with admin_client.websocket_connect(f"/ws/maps/{map_id}") as admin_ws:
        with client.websocket_connect(f"/ws/maps/{map_id}") as player_ws:
            admin_ws.receive_json()
            player_ws.receive_json()

            player_ws.send_json({"type": "reveal", "hexes": [[9, 9]]})
            # A real admin mutation afterwards must still be the next thing both
            # sides see -- confirms the player's message above was never applied.
            admin_ws.send_json({"type": "reveal", "hexes": [[4, 4]]})
            assert admin_ws.receive_json()["hexes"] == [[4, 4]]
            assert player_ws.receive_json()["hexes"] == [[4, 4]]

    state = admin_client.get(f"/api/maps/{map_id}/state").json()
    assert [9, 9] not in state["revealed_hexes"]
