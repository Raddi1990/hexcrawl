from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="HEXCRAWL_")

    data_dir: Path = Path("/data")
    db_path: Path | None = None
    maps_dir: Path | None = None

    admin_username: str = ""
    admin_password: str = ""

    cookie_secret: str = "dev-only-change-me"
    cookie_secure: bool = False
    session_max_age_seconds: int = 60 * 60 * 24 * 7  # 7 days

    # Empty by default: the map viewer stays open to anyone with the link, matching
    # the original behavior. Point this at an external user-management tool's URL
    # (e.g. the optional useradmin tool) to both require a login for the viewer AND
    # surface a "manage users" link for it in the admin area -- leaving this empty
    # with require_login forced on some other way would lock everyone out with no
    # way to create accounts, so the login gate is deliberately tied to it.
    user_management_url: str = ""

    @property
    def require_login(self) -> bool:
        return bool(self.user_management_url.strip())

    max_image_dimension: int = 4096

    # Comma-separated list of allowed origins for cross-origin requests, e.g. the Vite
    # dev server during local frontend development. Empty = no CORS middleware at all,
    # which is fine for the single-container production setup (same-origin SPA + API).
    cors_allow_origins: str = ""

    @property
    def cors_allow_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_allow_origins.split(",") if origin.strip()]

    @property
    def resolved_db_path(self) -> Path:
        return self.db_path or (self.data_dir / "hexcrawl.db")

    @property
    def resolved_maps_dir(self) -> Path:
        return self.maps_dir or (self.data_dir / "maps")


@lru_cache
def get_settings() -> Settings:
    return Settings()
