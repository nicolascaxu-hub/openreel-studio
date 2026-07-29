import re
from collections import Counter
from pathlib import Path

from app.services.director_desk import MANNEQUIN_JOINT_RANGES


ROOT = Path(__file__).resolve().parents[3]
POSE_SOURCE = ROOT / "apps/web/lib/directorShortDramaPoses.ts"
REFINEMENT_SOURCE = ROOT / "apps/web/lib/directorPoseRefinements.ts"
MANNEQUIN_SOURCE = ROOT / "apps/web/lib/directorMannequin.ts"
DIRECTOR_UI_SOURCE = ROOT / "apps/web/components/canvas/DirectorDesk.tsx"
MANNEQUIN_MODEL_SOURCE = ROOT / "apps/web/components/canvas/directorMannequinModel.ts"


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


def test_every_action_has_a_modular_kinematic_refinement() -> None:
    pose_source = _pose_source()
    mannequin_source = MANNEQUIN_SOURCE.read_text(encoding="utf-8")
    refinement_source = REFINEMENT_SOURCE.read_text(encoding="utf-8")
    extra_ids = set(re.findall(r'^    id: "([a-z0-9-]+)",$', pose_source, flags=re.MULTILINE))
    metadata = mannequin_source.split("const CORE_POSE_METADATA:", 1)[1].split(
        "const corePosePresets:", 1,
    )[0]
    core_ids = {
        quoted or bare
        for quoted, bare in re.findall(
            r'^  (?:"([a-z0-9-]+)"|([a-z0-9-]+)):', metadata, flags=re.MULTILINE,
        )
    }
    refinement_ids = set(re.findall(
        r'^  "([a-z0-9-]+)":', refinement_source, flags=re.MULTILINE,
    ))

    assert len(refinement_ids) == 80
    assert refinement_ids == extra_ids | core_ids
    assert "composeDirectorPoseModules" in refinement_source
    assert "DIRECTOR_POSE_MODULES" in refinement_source
    assert 'assertModuleKeys("torso"' in refinement_source
    assert 'assertModuleKeys("head"' in refinement_source
    assert 'assertModuleKeys("arms"' in refinement_source
    assert 'assertModuleKeys("legs"' in refinement_source
    assert "必须且只能输出 15 根指骨" in refinement_source
    assert "必须物化为完整" in mannequin_source


def test_pose_solver_constrains_palm_roll_and_grounded_lunges() -> None:
    refinement_source = REFINEMENT_SOURCE.read_text(encoding="utf-8")
    model_source = MANNEQUIN_MODEL_SOURCE.read_text(encoding="utf-8")

    assert "palmFacing?: DirectorPoseDirection" in refinement_source
    assert "orientationQuaternion" in refinement_source
    assert "rightDrink" in refinement_source
    assert "rightWhisper" in refinement_source
    assert "deepCrouchedLegs" in refinement_source
    assert "same vertical reach" in refinement_source
    assert "captureWristFrame" in model_source
    assert "constrainedDirectionAlignment" in model_source
    assert "unconstrained 180° roll" in model_source


def test_joint_editor_exposes_every_deforming_joint_and_precise_axes() -> None:
    ui_source = DIRECTOR_UI_SOURCE.read_text(encoding="utf-8")

    assert 'aria-label="搜索人物关节"' in ui_source
    assert "data-director-joint={joint.id}" in ui_source
    assert "支持 0.1° 数字精调" in ui_source
    assert "原版 66 骨架" in ui_source
