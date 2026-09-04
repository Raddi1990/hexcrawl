from __future__ import annotations

import shutil
import uuid
from pathlib import Path

from fastapi import UploadFile
from PIL import Image, UnidentifiedImageError

# Pillow's format name -> our stored extension / re-encode format. Re-encoding on every
# upload (not just when downscaling, unlike the old GD-based PHP code) keeps this simple
# and guarantees the stored extension always matches the actual encoded bytes.
_ALLOWED_FORMATS = {"JPEG": "jpg", "PNG": "png", "WEBP": "webp"}
_PILLOW_FORMAT_BY_EXT = {"jpg": "JPEG", "png": "PNG", "webp": "WEBP"}
_SAVE_KWARGS_BY_EXT = {"jpg": {"quality": 85}, "png": {}, "webp": {"quality": 85}}


class InvalidImageError(ValueError):
    pass


def save_uploaded_image(
    upload_file: UploadFile, dest_dir: Path, dest_name: str, max_dimension: int
) -> tuple[str, int, int]:
    """Validate and persist an uploaded map/fog image, downscaling if oversized.

    Returns (extension, width, height). Raises InvalidImageError on anything that
    isn't a decodable jpg/png/webp image.
    """
    dest_dir.mkdir(parents=True, exist_ok=True)
    tmp_path = dest_dir / f".{dest_name}-{uuid.uuid4().hex}.tmp"

    try:
        with tmp_path.open("wb") as tmp_file:
            shutil.copyfileobj(upload_file.file, tmp_file)

        try:
            with Image.open(tmp_path) as probe:
                probe.verify()
        except UnidentifiedImageError as exc:
            raise InvalidImageError("not a valid image") from exc

        with Image.open(tmp_path) as image:
            ext = _ALLOWED_FORMATS.get(image.format or "")
            if ext is None:
                raise InvalidImageError(f"unsupported image format: {image.format}")

            image = image.convert("RGB") if ext == "jpg" else image.convert("RGBA")

            width, height = image.size
            if max(width, height) > max_dimension:
                ratio = max_dimension / max(width, height)
                new_size = (max(1, round(width * ratio)), max(1, round(height * ratio)))
                image = image.resize(new_size, Image.LANCZOS)
                width, height = image.size

            dest_path = dest_dir / f"{dest_name}.{ext}"
            image.save(dest_path, format=_PILLOW_FORMAT_BY_EXT[ext], **_SAVE_KWARGS_BY_EXT[ext])
    finally:
        tmp_path.unlink(missing_ok=True)

    return ext, width, height
