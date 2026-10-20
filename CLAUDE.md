# Hexcrawl — Hex-Kartentool mit Nebel des Krieges

Webbasiertes Hex-Kartentool für Pen & Paper: Basiskarte + Nebel des Krieges,
Spielfigur per Drag & Drop, aufgedeckter Bereich wird serverseitig gespeichert und
per WebSocket live synchronisiert. Mehrere Karten über einen Admin-Bereich
verwaltbar. Eigenständiges Repo; das [Server](https://github.com/Raddi1990/server)-Repo
betreibt es als fertiges Image.

## CI & Deploy

- `.github/workflows/ci.yml` — bei jedem Push/PR: pytest, `npm run lint`,
  `npm run build`, Docker-Build. Auf `main` danach Push nach
  `ghcr.io/raddi1990/hexcrawl:<sha>` (+ `:main`).
- `.github/workflows/deploy.yml` — nur manuell (Actions → Deploy → "Run
  workflow"), optional mit älterer SHA als Rollback. Ruft per SSH
  `deploy/deploy.sh hexcrawl <sha>` im Server-Repo auf; Backup, Health-Check und
  automatisches Zurückrollen passieren dort, siehe `Server/CLAUDE.md`.
- Secrets: `DEPLOY_SSH_KEY`, `DEPLOY_HOST`, `DEPLOY_KNOWN_HOSTS`.
- Neue `HEXCRAWL_*`-Env-Variablen müssen zusätzlich in
  `Server/docker-compose.yml` + `.env.example` eingetragen und auf dem Server
  gepullt sein, **bevor** die neue Version deployt wird.

**Aktiver Stack: FastAPI + React (Docker, `backend`/`frontend`).** Der alte
PHP/one.com-Code im Repo-Root (`index.php`, `admin/`, `api/*.php`, `assets/`,
`data/`, `maps/`) ist Legacy-Referenz aus einem laufenden Rework und wird nicht
mehr weiterentwickelt — nicht versehentlich dort Änderungen machen.

## Stack

- `backend/app/` — FastAPI, SQLite (SQLAlchemy), WebSocket-Live-Sync
  - `config.py` — `Settings` mit `env_prefix="HEXCRAWL_"`
  - `models.py` — `User`, `Map`, `MapState`, `RevealedHex`, `SchemaMeta`
  - `db.py` — Engine/Session + idempotente Migrationen (`SchemaMeta.schema_version`)
  - `routers/` — `auth.py`, `maps.py`, `state.py`, `users.py`, `ws.py`
  - `hexgrid.py` — Hex-Koordinatenmathematik, `images.py` — Bild-Upload/-Verarbeitung
  - `security.py` — Passwort-Hashing (bcrypt) für Admin-/Spieler-Accounts
- `frontend/src/` — React + TypeScript, React Router, Tailwind, Radix UI
  - `routes/` — `LoginPage.tsx`, `ViewerPage.tsx`, `routes/admin/` (Kartenliste,
    Kalibrierung, Anlegen)
  - `components/viewer/`, `components/ui/` — Karten-Viewer bzw. wiederverwendbare
    UI-Bausteine
  - `lib/` — `api.ts` (typisierter Client), `hexgrid.ts`, `fog.ts`, `panzoom.ts`,
    `ws.ts`, `types.ts`

## Login-Gate

`Settings.require_login` (Property in `config.py`) ist schlicht
`bool(user_management_url.strip())` — kein eigener Boolean-Flag. Der Viewer bleibt
also offen, solange `HEXCRAWL_USER_MANAGEMENT_URL` leer ist (Default), und verlangt
Login, sobald sie gesetzt ist (zeigt dann zusätzlich im Admin-Bereich einen Link
darauf). Accounts (Rolle `admin`/`player`) werden über `/api/users` angelegt, z.B.
vom Schwester-Tool `useradmin` im Server-Repo — nicht hier im Repo.

## Dev-Commands

```
docker compose up --build          # ganzer Stack, http://localhost:8000 — auf diesem Rechner kein lokales Docker, siehe unten
```
Frontend (Node ist lokal installiert, siehe [[local-dev-environment]] in Memory):
```
cd frontend && npm install && npm run dev      # Hot-Reload, proxied API/WS zu :8000, siehe vite.config.ts
cd frontend && npm run build                   # tsc -b && vite build
npm run lint                                   # eslint
```
Backend (venv unter `backend/.venv`, PowerShell-Tool statt Bash — `python`/`pip`
sind auf diesem Rechner nur über den `py`-Launcher erreichbar):
```
cd backend
py -3.12 -m venv .venv                          # einmalig, falls .venv fehlt
.\.venv\Scripts\python.exe -m pip install -e ".[dev]"
.\.venv\Scripts\python.exe -m pytest -q
```
**Docker fehlt weiterhin lokal** (bewusste Entscheidung, siehe
[[local-dev-environment-decisions]] in Memory) — volle Stack-/Container-Tests
laufen wie bisher erst nach Deploy auf dem echten Server.
## Konventionen

- Migrationen in `db.py`: analog zum DungeonMasterTool-Schwesterprojekt eine
  versionierte, idempotente `MIGRATIONS`-Liste + `SchemaMeta`-Zeile, läuft in der
  FastAPI-`lifespan` bei jedem Start.
- `frontend/src/lib/api.ts` kapselt alle Backend-Aufrufe — Seiten rufen nie direkt
  `fetch` auf.
- Test-Fixtures (`tests/conftest.py`): `client` ist anonym, `admin_client` und
  `player_client` sind jeweils eigene `TestClient`-Instanzen. Nie auf `client`
  einloggen, sonst ist er in Tests, die mehrere Fixtures nutzen, nicht mehr anonym.
