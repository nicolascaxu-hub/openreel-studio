from __future__ import annotations

import hashlib
import json
from pathlib import Path

import pytest

from app.services.director_glb import analyze_glb_file, read_glb_document


MODEL_DIR = Path(__file__).resolve().parents[3] / "apps/web/public/director/models"
MANNEQUIN_DIR = Path(__file__).resolve().parents[3] / "apps/web/public/director/mannequins"
COMMON_CATALOG = Path(__file__).resolve().parents[3] / "apps/web/lib/directorCommonModels.json"


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


@pytest.mark.parametrize(
    ("file_name", "sha256", "animation_count"),
    [
        (
            "human-base-animations.glb",
            "406eb0a8dc4ab366e623b79b6e3005a4951392e1bda78ae39c1099d31147733c",
            87,
        ),
        (
            "human-addon-animations.glb",
            "a0d64d555e0d492026b72d58bf8e16c5e86779295f9093e376dcc001915c2c95",
            75,
        ),
    ],
)
def test_universal_human_motion_bundle_matches_upstream_and_white_model_skeleton(
    file_name: str,
    sha256: str,
    animation_count: int,
) -> None:
    target = MANNEQUIN_DIR / file_name
    assert target.is_file()
    assert hashlib.sha256(target.read_bytes()).hexdigest() == sha256

    analysis = analyze_glb_file(target)
    assert analysis["bone_count"] == 66
    assert analysis["animation_count"] == animation_count
    assert analysis["humanoid"]["recognized"] is True

    white_model = read_glb_document(MANNEQUIN_DIR / "human-base.glb")
    white_model_nodes = {
        node.get("name")
        for node in white_model.get("nodes", [])
        if isinstance(node, dict) and isinstance(node.get("name"), str)
    }
    motion_document = read_glb_document(target)
    motion_nodes = motion_document.get("nodes", [])
    target_names = {
        motion_nodes[target_node].get("name")
        for animation in motion_document.get("animations", [])
        if isinstance(animation, dict)
        for channel in animation.get("channels", [])
        if isinstance(channel, dict)
        for channel_target in [channel.get("target")]
        if isinstance(channel_target, dict)
        for target_node in [channel_target.get("node")]
        if isinstance(target_node, int)
        and 0 <= target_node < len(motion_nodes)
        and isinstance(motion_nodes[target_node], dict)
    }
    assert 66 <= len(target_names) <= 67
    assert target_names <= white_model_nodes


def test_universal_human_motion_library_bundles_cc0_notice() -> None:
    notice = (MANNEQUIN_DIR / "LICENSE.md").read_text(encoding="utf-8")
    assert "human-base-animations.glb" in notice
    assert "human-addon-animations.glb" in notice
    assert "162" in notice
    assert "CC0" in notice


def test_common_director_catalog_is_complete_and_unique() -> None:
    catalog = json.loads(COMMON_CATALOG.read_text(encoding="utf-8"))
    models = catalog["models"]
    assert len(models) == 158
    assert len({item["id"] for item in models}) == len(models)
    assert {item["category"] for item in models} == {
        "家居家具", "厨卫家电", "办公电子", "餐饮食物",
        "交通车辆", "道路设施", "自然户外", "建筑场景",
    }


def test_every_common_director_glb_matches_catalog_and_parser() -> None:
    catalog = json.loads(COMMON_CATALOG.read_text(encoding="utf-8"))
    for item in catalog["models"]:
        target = MODEL_DIR / item["file_path"]
        assert target.is_file(), item["id"]
        content = target.read_bytes()
        assert len(content) == item["size"], item["id"]
        assert hashlib.sha256(content).hexdigest() == item["sha256"], item["id"]
        analysis = analyze_glb_file(target)
        for key in ("node_count", "mesh_count", "material_count", "bone_count", "animation_count"):
            assert analysis[key] == item["stats"][key], f'{item["id"]}: {key}'
        document = read_glb_document(target)
        for image in document.get("images", []):
            uri = image.get("uri") if isinstance(image, dict) else None
            if isinstance(uri, str) and not uri.startswith("data:"):
                assert (target.parent / uri).is_file(), f'{item["id"]}: missing {uri}'


def test_short_drama_model_inventory_and_kenney_license_are_bundled() -> None:
    inventory = (MODEL_DIR / "CATALOG.md").read_text(encoding="utf-8")
    assert "当前总数：**194**" in inventory
    for heading in ("家居家具", "医疗教育", "拍摄器材", "交通车辆", "餐饮食物"):
        assert f"### {heading}" in inventory
    assert "Creative Commons Zero" in (MODEL_DIR / "kenney/LICENSE.txt").read_text(encoding="utf-8")
