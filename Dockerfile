# --- stage 1: build the React SPA ---
FROM node:22-slim AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# --- stage 2: python runtime ---
FROM python:3.12-slim AS runtime
WORKDIR /app/backend

COPY backend/pyproject.toml ./pyproject.toml
COPY backend/app ./app
# Editable install: registers ./app as the importable "app" package without copying
# it elsewhere, so app/main.py's `Path(__file__).parent / "static"` keeps resolving
# to this same directory after the frontend build is copied into app/static below.
RUN pip install --no-cache-dir -e .

COPY --from=frontend-build /app/frontend/dist ./app/static

ENV HEXCRAWL_DATA_DIR=/data
VOLUME ["/data"]
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health')" || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
