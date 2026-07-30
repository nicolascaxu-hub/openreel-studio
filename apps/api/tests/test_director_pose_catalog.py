import re
from collections import Counter
from pathlib import Path

from app.services.director_desk import MANNEQUIN_JOINT_RANGES


ROOT = Path(__file__).resolve().parents[3]
POSE_SOURCE = ROOT / "apps/web/lib/directorShortDramaPoses.ts"
REFINEMENT_SOURCE = ROOT / "apps/web/lib/directorPoseRefinements.ts"
MANNEQUIN_SOURCE = ROOT / "apps/web/lib/directorMannequin.ts"
DIRECTOR_UI_SOURCE = ROOT / "apps/web/components/canvas/DirectorDesk.tsx"
WORKFLOW_CANVAS_SOURCE = ROOT / "apps/web/components/canvas/WorkflowCanvas.tsx"
MANNEQUIN_MODEL_SOURCE = ROOT / "apps/web/components/canvas/directorMannequinModel.ts"
DIRECTOR_STYLE_SOURCE = ROOT / "apps/web/app/globals.css"


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

    assert 'ground_contact: "right_knee"' in pose_source
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
    assert "folding toward the toes" in refinement_source
    assert "captureWristFrame" in model_source
    assert "constrainedDirectionAlignment" in model_source
    assert "unconstrained 180° roll" in model_source


def test_pose_solver_stabilizes_side_and_rear_limb_planes() -> None:
    refinement_source = REFINEMENT_SOURCE.read_text(encoding="utf-8")
    ui_source = DIRECTOR_UI_SOURCE.read_text(encoding="utf-8")

    assert "stableLimbFacing" in refinement_source
    assert "stableLimbQuaternion" in refinement_source
    assert "shoulder surface, elbow crease and kneecap" in refinement_source
    assert "directorReadableSymmetricArms" in refinement_source
    assert "Perfectly\n * twinned limbs collapse into one silhouette" in refinement_source
    assert 'applyOverviewPreset("back")' in ui_source
    assert '["Ctrl/⌘ 小键盘 1", "背面"]' in ui_source


def test_one_leg_actions_use_anatomical_role_modules_and_one_knee_anchor() -> None:
    refinement_source = REFINEMENT_SOURCE.read_text(encoding="utf-8")
    pose_source = _pose_source()
    model_source = MANNEQUIN_MODEL_SOURCE.read_text(encoding="utf-8")

    for module in (
        "plantedLeg", "runLegs", "kneelingLegs", "kickLegs",
        "sneakStepLegs", "recoveryStepLegs",
    ):
        assert module in refinement_source
    assert 'ground_contact: "right_knee"' in pose_source
    assert 'preset?.ground_contact === "right_knee"' in model_source
    assert "[jointBones.rightKnee]" in model_source
    assert "[JOINT_BONES.rightKnee]" in model_source
    assert "assertDirectorLegRole" in refinement_source
    for role in (
        "lead-step", "trailing-step", "running-swing", "running-drive",
        "raised-knee", "kneeling-front", "kneeling-rear", "forward-kick",
    ):
        assert f'"{role}"' in refinement_source


def test_joint_editor_exposes_every_deforming_joint_and_precise_axes() -> None:
    ui_source = DIRECTOR_UI_SOURCE.read_text(encoding="utf-8")

    assert 'aria-label="搜索人物关节"' in ui_source
    assert "data-director-joint={joint.id}" in ui_source
    assert "支持 0.1° 数字精调" in ui_source
    assert "原版 66 骨架" in ui_source


def test_director_ui_uses_flat_panels_clear_type_and_one_primary_accent() -> None:
    ui_source = DIRECTOR_UI_SOURCE.read_text(encoding="utf-8")
    style_source = DIRECTOR_STYLE_SOURCE.read_text(encoding="utf-8")

    assert "grid-rows-[52px_minmax(0,1fr)_164px]" in ui_source
    assert "grid-rows-[52px_minmax(0,1fr)_86px]" in ui_source
    assert 'aria-label="导演台视角"' in ui_source
    assert "openreel-director-sidebar" in ui_source
    assert "openreel-director-inspector" in ui_source
    assert "openreel-director-toolbar" in ui_source
    assert "openreel-director-timeline" in ui_source
    assert "--director-accent: #4f8ef7" in style_source
    assert '[class^="text-cyan-"]' in style_source
    assert '[class^="bg-violet-"]' in style_source
    assert '.openreel-director-desk [class*="text-[7px]"]' in style_source
    assert ".openreel-director-inspector section" in style_source
    assert ".openreel-director-toolbar" in style_source


def test_director_ui_maps_canvas_panorama_nodes_into_spatial_environment() -> None:
    ui_source = DIRECTOR_UI_SOURCE.read_text(encoding="utf-8")
    canvas_source = WORKFLOW_CANVAS_SOURCE.read_text(encoding="utf-8")

    assert "空间全景" in ui_source
    assert "new THREE.SphereGeometry(360, 96, 48)" in ui_source
    assert "side: THREE.BackSide" in ui_source
    assert 'data-director-panorama-status={panoramaStatus}' in ui_source
    assert "data-director-panorama-import" in ui_source
    assert '"导入全景图"' in ui_source
    assert "importProjectCanvasImage" in ui_source
    assert "const [showCaptureLegend, setShowCaptureLegend] = useState(false)" in ui_source
    assert "showCaptureLegend && legend.length > 0" in ui_source
    assert "截图角色图例" in ui_source
    assert "isDirectorPanoramaNode" in canvas_source
    assert "panoramaImages={directorPanoramaImages}" in canvas_source


def test_director_runtime_avoids_idle_redraws_and_duplicate_model_parsing() -> None:
    ui_source = DIRECTOR_UI_SOURCE.read_text(encoding="utf-8")
    model_source = MANNEQUIN_MODEL_SOURCE.read_text(encoding="utf-8")

    assert "directorGltfTemplateCache" in ui_source
    assert "cloneDirectorGltf" in ui_source
    assert "SkeletonUtils.clone" in ui_source
    assert "directorSharedModelResources" in ui_source
    assert "reconcileRuntimeSceneRef" in ui_source
    assert "playingMixerIds" in ui_source
    assert "requestAnimationFrame(renderDirectorFrame)" in ui_source
    assert 'document.addEventListener("visibilitychange"' in ui_source
    assert "setAnimationLoop" not in ui_source
    assert "preserveDrawingBuffer: true" not in ui_source
    assert 'onPointerEnter={() => setShouldLoad(true)}' not in ui_source
    assert "IntersectionObserver" in ui_source
    assert 'rootMargin: "320px 0px"' in ui_source
    assert "directorSharedModelGeometry" in model_source


def test_all_pose_filter_is_batched_and_standard_pose_updates_reuse_the_loaded_rig() -> None:
    ui_source = DIRECTOR_UI_SOURCE.read_text(encoding="utf-8")
    model_source = MANNEQUIN_MODEL_SOURCE.read_text(encoding="utf-8")

    assert "DIRECTOR_POSE_RESULT_BATCH_SIZE = 24" in ui_source
    assert "filteredPosePresets.slice(0, poseResultLimit)" in ui_source
    assert "data-director-pose-more" in ui_source
    assert "updateDirectorMannequinPose(root, nextMannequin)" in ui_source
    assert "directorMannequinLoading" in ui_source
    assert "mannequinRuntimeCache" in model_source
    assert "restBoneQuaternions" in model_source
    assert "export function updateDirectorMannequinPose" in model_source


def test_default_white_model_uses_same_skeleton_professional_motion_library() -> None:
    ui_source = DIRECTOR_UI_SOURCE.read_text(encoding="utf-8")
    desk_source = (ROOT / "apps/web/lib/directorDesk.ts").read_text(encoding="utf-8")
    bundled_source = (ROOT / "apps/web/lib/directorBundledModels.ts").read_text(encoding="utf-8")
    motion_source = (ROOT / "apps/web/lib/directorHumanMotions.ts").read_text(encoding="utf-8")
    universal_source = (ROOT / "apps/web/lib/directorUniversalMannequin.ts").read_text(encoding="utf-8")

    assert "DIRECTOR_UNIVERSAL_ACTION_MANNEQUIN_ASSET_ID = DIRECTOR_UNIVERSAL_MANNEQUIN.id" in desk_source
    assert 'id: "bundled:mesh2motion:universal-human-actions"' in universal_source
    assert 'label: "通用动作白模"' in desk_source
    assert 'animationFiles: ["human-base-animations.glb", "human-addon-animations.glb"]' in universal_source
    assert "DIRECTOR_UNIVERSAL_MANNEQUIN.animationFiles.map(mannequinUrl)" in bundled_source
    assert "animationCount: DIRECTOR_UNIVERSAL_HUMAN_MOTIONS.length" in universal_source
    assert "BASE_MOTION_NAMES.length + index" in motion_source
    assert "DIRECTOR_HUMAN_MOTION_CATEGORIES" in motion_source
    assert "directorHumanMotionCategory" in ui_source
    assert "directorSupplementalAnimationCache" in ui_source
    assert "cloneDirectorGltf(asset, true, object.color)" in ui_source
    assert 'white.name = `${source.name || "Main"} · white mannequin`' in ui_source
    assert "applyRuntimeNativeAnimation" in ui_source
    assert "applyRuntimeAnimationJointOffsets" in ui_source
    assert "asset.id !== DIRECTOR_UNIVERSAL_ACTION_MANNEQUIN_ASSET_ID" in ui_source
    assert "customRigUpdatedInPlace" in ui_source
    assert "data-director-universal-actions" in ui_source
    assert "data-director-motion={animation.name}" in ui_source
    assert "DIRECTOR_UNIVERSAL_MAJOR_JOINTS" in universal_source
    assert "data-director-major-joint={joint.id}" in ui_source
    assert "data-director-universal-color" in ui_source
    assert "不展示手指细节" in ui_source
    assert "替换为通用动作白模" in ui_source
    assert "手调姿势库已退出默认流程" in ui_source


def test_universal_mannequin_starts_paused_with_zero_animation_offsets() -> None:
    ui_source = DIRECTOR_UI_SOURCE.read_text(encoding="utf-8")
    desk_source = (ROOT / "apps/web/lib/directorDesk.ts").read_text(encoding="utf-8")

    assert "function neutralDirectorRigJoints()" in desk_source
    assert "joints: firstAnimation ? neutralDirectorRigJoints() : mannequin.joints" in desk_source
    assert 'mode === "animation" && raw.pose_preset !== "custom"' in desk_source
    assert "animation_playing: false" in desk_source
    assert "animation_playing: raw.animation_playing === true" in desk_source
    assert "rig: { ...object.rig, animation_playing: false }" in ui_source
