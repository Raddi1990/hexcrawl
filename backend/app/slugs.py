import re
from collections.abc import Iterable

_SLUG_INVALID_CHARS = re.compile(r"[^a-z0-9]+")
MAP_ID_PATTERN = re.compile(r"^[a-z0-9-]+$")


def slugify(text: str) -> str:
    slug = _SLUG_INVALID_CHARS.sub("-", text.strip().lower()).strip("-")
    return slug or "karte"


def unique_map_id(base_slug: str, existing_ids: Iterable[str]) -> str:
    existing = set(existing_ids)
    map_id = base_slug
    i = 2
    while map_id in existing:
        map_id = f"{base_slug}-{i}"
        i += 1
    return map_id


def is_valid_map_id(value: str) -> bool:
    return bool(MAP_ID_PATTERN.match(value))
