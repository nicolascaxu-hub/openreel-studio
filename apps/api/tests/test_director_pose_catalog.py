import re
from collections import Counter
from pathlib import Path

from app.services.director_desk import MANNEQUIN_JOINT_RANGES


ROOT = Path(__file__).resolve().parents[3]
POSE_SOURCE = ROOT / "apps/web/lib/directorShortDramaPoses.ts"
MANNEQUIN_SOURCE = ROOT / "apps/web/lib/directorMannequin.ts"
DIRECTOR_UI_SOURCE = ROOT / "apps/web/components/canvas/DirectorDesk.tsx"


def _pose_source() -> str:
    return POSE_SOURCE.read_text(encoding="utf-8")


def test_short_drama_pose_catalog_has_80_unique_actions_in_seven_categories() -> None:
    source = _pose_source()
    extra_ids = re.findall(r'^    id: "([a-z0-9-]+)",$', source, flags=re.MULTILINE)
    categories = re.findall(r'^    category: "([^\"]+)",$', source, flags=re.MULTILINE)
    mannequin_source = MANNEQUIN_SOURCE.read_text(encoding="utf-8")
    metadata = mannequin_source.split("const CORE_POSE_METADATA:", 1)[1].split(
        "const corePosePresets:", 1,
    )[0]
    core_ids = re.findall(r'^  (?:"([a-z0-9-]+)"|([a-z0-9-]+)):', metadata, flags=re.MULTILINE)
    resolved_core_ids = [quoted or bare for quoted, bare in core_ids]

    assert len(extra_ids) == len(set(extra_ids)) == 61
    assert len(resolved_core_ids) == len(set(resolved_core_ids)) == 19
    assert len(set(extra_ids) | set(resolved_core_ids)) == 80
    assert Counter(categories) == {
        "基础站姿": 6,
        "沟通交流": 15,
        "情绪表演": 17,
        "日常生活": 13,
        "行走运动": 3,
        "冲突动作": 7,
    }
    assert {
        "arms-crossed", "phone-call", "cry", "kneel", "sit-cross-legged",
        "pick-up", "hold-baby", "drive", "punch", "kick", "block", "slap",
    } <= set(extra_ids)


def test_every_extra_pose_uses_known_bases_and_safe_joint_ranges() -> None:
    source = _pose_source()
    extra_ids = re.findall(r'^    id: "([a-z0-9-]+)",$', source, flags=re.MULTILINE)
    bases = re.findall(r'^    base: "([a-z0-9-]+)",$', source, flags=re.MULTILINE)
    mannequin_source = MANNEQUIN_SOURCE.read_text(encoding="utf-8")
    metadata = mannequin_source.split("const CORE_POSE_METADATA:", 1)[1].split(
        "const corePosePresets:", 1,
    )[0]
    core_ids = {
        quoted or bare
        for quoted, bare in re.findall(
            r'^  (?:"([a-z0-9-]+)"|([a-z0-9-]+)):', metadata, flags=re.MULTILINE,
        )
    }
    available = set(core_ids)
    for pose_id, base in zip(extra_ids, bases, strict=True):
        assert base in available, f"{pose_id} references unknown or later base {base}"
        available.add(pose_id)

    rotations = re.findall(
        r'\b([a-z]+(?:[A-Z][A-Za-z0-9]+)*)\s*:\s*\[(-?\d+),\s*(-?\d+),\s*(-?\d+)\]',
        source,
    )
    assert rotations
    for joint, *raw_values in rotations:
        assert joint in MANNEQUIN_JOINT_RANGES, f"unknown pose joint {joint}"
        values = [int(value) for value in raw_values]
        for value, (minimum, maximum) in zip(
            values, MANNEQUIN_JOINT_RANGES[joint], strict=True,
        ):
            assert minimum <= value <= maximum, (joint, values)


def test_ground_actions_and_pose_picker_are_explicit() -> None:
    pose_source = _pose_source()
    ui_source = DIRECTOR_UI_SOURCE.read_text(encoding="utf-8")

    assert 'ground_contact: "knees"' in pose_source
    assert pose_source.count('ground_contact: "pelvis"') == 2
    assert 'aria-label="搜索人物动作"' in ui_source
    assert 'aria-label="动作分类"' in ui_source
    assert "data-director-pose={preset.id}" in ui_source
    assert "单帧定格动作" in ui_source
