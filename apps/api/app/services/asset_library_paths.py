from __future__ import annotations

from pathlib import Path
from typing import Any

from app.config import settings


def default_asset_library_roots() -> dict[str, str]:
    base = Path(settings.PROJECT_ROOT).expanduser().resolve() / "assets"
    return {"root": str(base)}


def effective_asset_library(config: Any, *, ensure_dirs: bool = False) -> dict[str, Any]:
    lib = dict(config) if isinstance(config, dict) else {}
    defaults = default_asset_library_roots()
    root = lib.get("root") or defaults["root"]
    lib["root"] = str(Path(str(root)).expanduser().resolve())
    if ensure_dirs:
        Path(str(lib["root"])).expanduser().resolve().mkdir(parents=True, exist_ok=True)
    return lib


def asset_library_roots(config: Any) -> list[Path]:
    lib = effective_asset_library(config)
    return [Path(str(lib["root"])).expanduser().resolve()]
