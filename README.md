# Hexcrawl-Kartentool

Webbasiertes Hex-Kartentool für Pen & Paper: Basiskarte + Nebel des Krieges, Spielfigur
per Drag & Drop, aufgedeckter Bereich wird serverseitig gespeichert und per WebSocket
live synchronisiert. Mehrere Karten verwaltbar über einen kleinen Admin-Bereich.

## Starten (Docker, FastAPI + React)

```
docker compose up --build
```

startet den Stack unter `http://localhost:8000` (siehe `docker-compose.yml`
für Umgebungsvariablen wie Admin-Zugangsdaten). Für Frontend-Entwicklung mit
Hot-Reload zusätzlich `npm install && npm run dev` in `frontend/` starten (proxied
API/WS-Aufrufe automatisch zu Port 8000, siehe `frontend/vite.config.ts`). Backend-
Tests: `pip install -e ".[dev]"` und `pytest` in `backend/`.

### Nutzer-Login (optional)

Standardmäßig (`HEXCRAWL_USER_MANAGEMENT_URL` ungesetzt bzw. leer) bleibt die
Kartenansicht frei zugänglich — kein Login nötig, jeder mit dem Link kann
zuschauen. Wird `HEXCRAWL_USER_MANAGEMENT_URL` auf die URL
eines Verwaltungs-Tools gesetzt (z.B. [Server/useradmin](https://github.com/Raddi1990/server)),
verlangt die Kartenansicht einen Login (Admin- oder Spieler-Account über
`/api/users`) und der Admin-Bereich zeigt einen Link auf dieses Tool. Ohne ein
Tool/einen Weg, Accounts anzulegen, sollte diese Variable **nicht** gesetzt
werden, sonst kommt niemand mehr rein.

## Herkunft

Ursprünglich eine PHP-Variante für Webspace (one.com). Die wurde durch den
FastAPI/React-Stack ersetzt und aus dem Repo entfernt; sie ist bei Bedarf noch in der
Git-Historie zu finden.
