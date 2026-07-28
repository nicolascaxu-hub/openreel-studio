from __future__ import annotations

import hashlib
from pathlib import Path

import pytest

from app.services.director_glb import analyze_glb_file


MODEL_DIR = Path(__file__).resolve().parents[3] / "apps/web/public/director/models"


@pytest.mark.parametrize(
    ("file_name", "sha256", "bone_count", "animation_count", "humanoid"),
    [
        ("Fox.glb", "d97044e701822bac5a62696459b27d7b375aada5de8574ed4362edbba94771f7", 24, 3, False),
        ("RiggedFigure.glb", "d6be85417d3e256861ee733eea6916093a7af7c79c16366181fd8abcaeb38cf5", 19, 1, True),
        ("BoxAnimated.glb", "ad0d18d9a21df0d7c2bd3890e60ce69d60d39a55d9b82bacea7e77ac9e583839", 0, 1, False),
        ("ToyCar.glb", "01a60862de55cd4b9f3acfab0b0def86451800f9c42467fcd61052c16cb9838c", 0, 0, False),
    ],
)
def test_bundled_director_model_is_valid_and_parseable(
    file_name: str,
    sha256: str,
    bone_count: int,
    animation_count: int,
    humanoid: bool,
) -> None:
    target = MODEL_DIR / file_name
    assert target.is_file()
    assert hashlib.sha256(target.read_bytes()).hexdigest() == sha256

    analysis = analyze_glb_file(target)
    assert analysis["bone_count"] == bone_count
    assert analysis["animation_count"] == animation_count
    assert analysis["humanoid"]["recognized"] is humanoid


def test_bundled_director_models_include_upstream_license_notices() -> None:
    notice = (MODEL_DIR / "THIRD_PARTY_LICENSES.md").read_text(encoding="utf-8")
    for file_name in ("Fox.glb", "RiggedFigure.glb", "BoxAnimated.glb", "ToyCar.glb"):
        assert f"## {file_name}" in notice
