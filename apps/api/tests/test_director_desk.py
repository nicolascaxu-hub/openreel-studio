import base64
import io
import json
from pathlib import Path

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from starlette.datastructures import UploadFile

from app.config import settings
from app.db import session as db_session
from app.db.models import Project, WorkflowNode
from app.services.director_desk import (
    DirectorDeskError,
    DirectorDeskService,
    MANNEQUIN_JOINTS,
    MANNEQUIN_JOINT_RANGES,
    default_director_scene,
    normalize_director_state,
)
from app.services.director_glb import analyze_glb_document


async def _setup_db(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    database_url = f"sqlite+aiosqlite:///{tmp_path / 'director-desk.db'}"
    engine = create_async_engine(database_url, echo=False, future=True, connect_args={"timeout": 30})
    session_local = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False, autoflush=False)
    monkeypatch.setattr(db_session, "engine", engine)
    monkeypatch.setattr(db_session, "AsyncSessionLocal", session_local)
    monkeypatch.setattr(settings, "PROJECT_ROOT", str(tmp_path))
    monkeypatch.setattr(settings, "STORAGE_PATH", str(tmp_path / "storage"))
    monkeypatch.setattr(settings, "STORAGE_DIR", str(tmp_path / "storage"))
    await db_session.init_db()
    async with db_session.session_scope() as session:
        session.add(Project(id="director-project", title="Director Test", state_json="{}"))
        session.add(Project(id="other-project", title="Other", state_json="{}"))
        await session.commit()


def _scene() -> dict:
    scene = default_director_scene()
    scene["objects"] = [{
        "id": "character-1",
        "asset_id": "builtin:mannequin",
        "name": "人物 1",
        "color": "#ef4444",
        "position": [0, 0, 0],
        "rotation": [0, 0, 0],
        "scale": [1, 1, 1],
        "visible": True,
        "locked": False,
    }]
    return scene


def _fake_glb(document: dict | None = None) -> bytes:
    document = json.dumps(
        document or {"asset": {"version": "2.0"}, "scene": 0, "scenes": [{}]},
        separators=(",", ":"),
    ).encode("utf-8")
    padding = (4 - len(document) % 4) % 4
    document += b" " * padding
    length = 12 + 8 + len(document)
    return (
        b"glTF"
        + (2).to_bytes(4, "little")
        + length.to_bytes(4, "little")
        + len(document).to_bytes(4, "little")
        + b"JSON"
        + document
    )


def _rigged_glb() -> bytes:
    names = [
        "mixamorig:Hips", "mixamorig:Spine", "mixamorig:Spine1", "mixamorig:Spine2",
        "mixamorig:Neck", "mixamorig:Head",
        "mixamorig:LeftShoulder", "mixamorig:LeftArm", "mixamorig:LeftForeArm", "mixamorig:LeftHand",
        "mixamorig:RightShoulder", "mixamorig:RightArm", "mixamorig:RightForeArm", "mixamorig:RightHand",
        "mixamorig:LeftUpLeg", "mixamorig:LeftLeg", "mixamorig:LeftFoot", "mixamorig:LeftToeBase",
        "mixamorig:RightUpLeg", "mixamorig:RightLeg", "mixamorig:RightFoot", "mixamorig:RightToeBase",
    ]
    for side in ("Left", "Right"):
        for finger in ("Thumb", "Index", "Middle", "Ring", "Pinky"):
            names.extend(f"mixamorig:{side}Hand{finger}{segment}" for segment in (1, 2, 3))
    nodes = [
        {"name": name, **({"children": [index + 1]} if index + 1 < len(names) else {})}
        for index, name in enumerate(names)
    ]
    return _fake_glb({
        "asset": {"version": "2.0", "generator": "Director rig test"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": nodes,
        "skins": [{"name": "CharacterSkin", "joints": list(range(len(nodes))), "skeleton": 0}],
        "accessors": [{"min": [0], "max": [1.25], "count": 38}],
        "animations": [{
            "name": "Walk",
            "samplers": [{"input": 0, "output": 0}],
            "channels": [
                {"sampler": 0, "target": {"node": 0, "path": "translation"}},
                {"sampler": 0, "target": {"node": 14, "path": "rotation"}},
            ],
        }],
    })


def test_director_routes_are_registered() -> None:
    from app.main import app

    routes = {(method, route.path) for route in app.routes for method in getattr(route, "methods", set())}
    assert ("GET", "/api/projects/{project_id}/director") in routes
    assert ("POST", "/api/projects/{project_id}/director/models") in routes
    assert ("POST", "/api/projects/{project_id}/director/captures") in routes
    assert ("POST", "/api/projects/{project_id}/director/captures/{capture_id}/canvas") in routes


def test_director_normalizes_legacy_joint_angles_into_standard_rig_limits() -> None:
    scene = _scene()
    scene["objects"][0]["mannequin"] = {
        "joints": {
            "leftKnee": [-30, 80, -90],
            "rightShoulder": [170, -120, 175],
            "leftIndex2": [130, -20, 25],
        },
    }

    normalized = normalize_director_state({"scene": scene})
    joints = normalized["scene"]["objects"][0]["mannequin"]["joints"]

    assert joints["leftKnee"] == [-5.0, 15.0, -15.0]
    assert joints["rightShoulder"] == [120.0, -90.0, 150.0]
    assert joints["leftIndex2"] == [110.0, -12.0, 12.0]
    assert scene["objects"][0]["mannequin"]["joints"]["leftKnee"] == [-30, 80, -90]


def test_director_exposes_every_deforming_standard_rig_joint() -> None:
    assert len(MANNEQUIN_JOINTS) == 52
    assert set(MANNEQUIN_JOINT_RANGES) == MANNEQUIN_JOINTS
    assert {
        "pelvis", "spineMiddle", "leftClavicle", "rightClavicle",
        "leftThumb1", "leftIndex3", "rightRing2", "rightPinky3",
        "leftToe", "rightToe",
    } <= MANNEQUIN_JOINTS


def test_director_uses_explicit_vrm_humanoid_mapping_before_name_guessing() -> None:
    vrm_bones = {
        "hips": 0, "spine": 1, "chest": 2, "upperChest": 3, "neck": 4, "head": 5,
        "leftUpperArm": 6, "leftLowerArm": 7, "leftHand": 8,
        "rightUpperArm": 9, "rightLowerArm": 10, "rightHand": 11,
        "leftUpperLeg": 12, "leftLowerLeg": 13, "leftFoot": 14,
        "rightUpperLeg": 15, "rightLowerLeg": 16, "rightFoot": 17,
        "leftThumbMetacarpal": 18, "leftThumbProximal": 19, "leftThumbDistal": 20,
    }
    document = {
        "asset": {"version": "2.0"},
        "extensionsUsed": ["VRMC_vrm"],
        "extensions": {"VRMC_vrm": {"humanoid": {"humanBones": {
            joint: {"node": node} for joint, node in vrm_bones.items()
        }}}},
        "nodes": [{"name": f"opaque-{index}"} for index in range(21)],
        "skins": [{"joints": list(range(21))}],
    }

    humanoid = analyze_glb_document(document)["humanoid"]

    assert humanoid["profile"] == "vrm"
    assert humanoid["recognized"] is True
    assert humanoid["joint_node_map"]["spineMiddle"] == 2
    assert humanoid["joint_node_map"]["chest"] == 3
    assert humanoid["joint_node_map"]["leftShoulder"] == 6
    assert humanoid["joint_node_map"]["leftThumb1"] == 18
    assert humanoid["joint_node_map"]["leftThumb2"] == 19
    assert humanoid["joint_node_map"]["leftThumb3"] == 20


def test_director_recognizes_numbered_generic_humanoid_joint_chains() -> None:
    names = [
        "Skeleton_torso_joint_1",
        "leg_joint_R_1", "leg_joint_R_2", "leg_joint_R_3", "leg_joint_R_5",
        "leg_joint_L_1", "leg_joint_L_2", "leg_joint_L_3", "leg_joint_L_5",
        "Skeleton_torso_joint_2", "torso_joint_3",
        "Skeleton_arm_joint_R", "Skeleton_arm_joint_R__2_", "Skeleton_arm_joint_R__3_",
        "Skeleton_arm_joint_L__4_", "Skeleton_arm_joint_L__3_", "Skeleton_arm_joint_L__2_",
        "Skeleton_neck_joint_1", "Skeleton_neck_joint_2",
    ]
    children = {
        0: [1, 5, 9],
        1: [2], 2: [3], 3: [4],
        5: [6], 6: [7], 7: [8],
        9: [10],
        10: [11, 14, 17],
        11: [12], 12: [13],
        14: [15], 15: [16],
        17: [18],
    }
    document = {
        "asset": {"version": "2.0", "generator": "numbered generic rig"},
        "nodes": [
            {"name": name, **({"children": children[index]} if index in children else {})}
            for index, name in enumerate(names)
        ],
        "skins": [{"joints": list(range(len(names))), "skeleton": 0}],
    }

    humanoid = analyze_glb_document(document)["humanoid"]

    assert humanoid["profile"] == "generic"
    assert humanoid["recognized"] is True
    assert humanoid["joint_node_map"]["pelvis"] == 0
    assert humanoid["joint_node_map"]["spine"] == 9
    assert humanoid["joint_node_map"]["head"] == 18
    assert humanoid["joint_node_map"]["rightShoulder"] == 11
    assert humanoid["joint_node_map"]["rightWrist"] == 13
    assert humanoid["joint_node_map"]["leftHip"] == 5
    assert humanoid["joint_node_map"]["leftToe"] == 8


def test_director_distinguishes_native_pose_clips_from_continuous_animations() -> None:
    document = {
        "asset": {"version": "2.0"},
        "accessors": [
            {"min": [0], "max": [0.0333], "count": 2},
            {"min": [0], "max": [0.0667], "count": 3},
            {"min": [0], "max": [1.0], "count": 31},
        ],
        "animations": [
            {"name": "TPose", "samplers": [{"input": 0}], "channels": []},
            {"name": "Sad Pose", "samplers": [{"input": 1}], "channels": []},
            {"name": "Walk", "samplers": [{"input": 2}], "channels": []},
        ],
    }

    analysis = analyze_glb_document(document)

    assert analysis["analysis_version"] == 2
    assert [(item["name"], item["kind"], item["keyframe_count"]) for item in analysis["animations"]] == [
        ("TPose", "pose", 2),
        ("Sad Pose", "pose", 3),
        ("Walk", "animation", 31),
    ]


@pytest.mark.asyncio
async def test_director_capture_stays_in_timeline_until_explicit_promotion(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    await _setup_db(monkeypatch, tmp_path)
    async with db_session.session_scope() as session:
        service = DirectorDeskService(session)
        initial = await service.get("director-project")
        assert initial["revision"] == 0
        assert initial["captures"] == []

        saved_scene = await service.save_scene("director-project", _scene(), expected_revision=0)
        assert saved_scene["revision"] == 1

        png = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=")
        png_data = "data:image/png;base64," + base64.b64encode(png).decode("ascii")
        director, capture = await service.add_capture(
            "director-project",
            title="双人对话",
            data_url=png_data,
            scene_snapshot=_scene(),
            actor_legend=[{"label": "人物 1", "color": "#ef4444"}],
            expected_revision=1,
        )
        assert director["revision"] == 2
        assert capture["promoted_node_id"] is None

        nodes_before = list((await session.exec(select(WorkflowNode))).all())
        assert nodes_before == []

        promoted, node, created = await service.promote_capture(
            "director-project",
            capture["id"],
            x=320,
            y=180,
        )
        assert created is True
        assert node.type == "image"
        assert node.status == "completed"
        assert (node.position_x, node.position_y) == (320, 180)
        node_input = json.loads(node.input_json or "{}")
        assert node_input["fields"]["director_capture"] is True
        assert node_input["fields"]["director_capture_id"] == capture["id"]
        assert node_input["fields"]["reference_usage"] == "composition_only"
        assert promoted["captures"][0]["promoted_node_id"] == node.id

        second_state, second_node, second_created = await service.promote_capture(
            "director-project",
            capture["id"],
            x=900,
            y=900,
        )
        assert second_created is False
        assert second_node.id == node.id
        assert second_state["captures"][0]["promoted_node_id"] == node.id
        project_nodes = list((await session.exec(select(WorkflowNode))).all())
        assert len(project_nodes) == 1
    await db_session.engine.dispose()


@pytest.mark.asyncio
async def test_director_glb_is_project_scoped_and_referenced_models_cannot_be_deleted(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    await _setup_db(monkeypatch, tmp_path)
    async with db_session.session_scope() as session:
        service = DirectorDeskService(session)
        upload = UploadFile(file=io.BytesIO(_fake_glb()), filename="room.glb")
        director, asset = await service.add_model("director-project", upload, expected_revision=0)
        assert director["revision"] == 1
        assert asset["url"].startswith("/api/projects/director-project/director/models/")
        assert asset["analysis"]["bone_count"] == 0
        assert asset["analysis"]["animation_count"] == 0
        assert asset["analysis"]["humanoid"]["recognized"] is False
        target, resolved = await service.model_file("director-project", asset["id"])
        assert target.read_bytes() == _fake_glb()
        assert resolved["id"] == asset["id"]

        scene = _scene()
        scene["objects"].append({
            "id": "custom-1",
            "asset_id": asset["id"],
            "name": "房间",
            "color": "#a1a1aa",
            "position": [0, 0, 0],
            "rotation": [0, 0, 0],
            "scale": [1, 1, 1],
            "visible": True,
            "locked": False,
        })
        await service.save_scene("director-project", scene, expected_revision=1)
        with pytest.raises(DirectorDeskError, match="仍被场景或截图引用") as error:
            await service.delete_model("director-project", asset["id"], expected_revision=2)
        assert error.value.status_code == 409

        with pytest.raises(DirectorDeskError, match="模型不存在") as other_error:
            await service.model_file("other-project", asset["id"])
        assert other_error.value.status_code == 404
    await db_session.engine.dispose()


@pytest.mark.asyncio
async def test_director_import_inventories_full_rig_and_embedded_animations(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    await _setup_db(monkeypatch, tmp_path)
    async with db_session.session_scope() as session:
        service = DirectorDeskService(session)
        upload = UploadFile(file=io.BytesIO(_rigged_glb()), filename="animated-character.glb")
        director, asset = await service.add_model("director-project", upload, expected_revision=0)

        analysis = asset["analysis"]
        assert director["model_assets"][0]["analysis"] == analysis
        assert analysis["skin_count"] == 1
        assert analysis["bone_count"] == 52
        assert len(analysis["bones"]) == 52
        assert analysis["animation_count"] == 1
        assert analysis["animations"] == [{
            "index": 0,
            "name": "Walk",
            "duration": 1.25,
            "keyframe_count": 38,
            "kind": "animation",
            "channel_count": 2,
            "target_node_count": 2,
            "properties": ["rotation", "translation"],
        }]
        humanoid = analysis["humanoid"]
        assert humanoid["recognized"] is True
        assert humanoid["profile"] == "mixamo"
        assert humanoid["mapped_joint_count"] == 52
        assert humanoid["missing_joints"] == []
        assert humanoid["joint_map"]["leftIndex3"] == "mixamorig:LeftHandIndex3"
        assert humanoid["joint_node_map"]["rightToe"] == 21

        scene = _scene()
        scene["objects"].append({
            "id": "animated-1",
            "asset_id": asset["id"],
            "name": "动画人物",
            "color": "#a1a1aa",
            "position": [0, 0, 0],
            "rotation": [0, 0, 0],
            "scale": [1, 1, 1],
            "visible": True,
            "locked": False,
            "rig": {
                "mode": "animation",
                "pose_preset": "relaxed",
                "joints": {"leftWrist": [5, 0, 0]},
                "animation_name": "Walk",
                "animation_index": 0,
                "animation_playing": True,
                "animation_loop": True,
                "animation_speed": 1.25,
            },
        })
        saved = await service.save_scene("director-project", scene, expected_revision=1)
        assert saved["scene"]["objects"][1]["rig"]["animation_name"] == "Walk"
    await db_session.engine.dispose()


@pytest.mark.asyncio
async def test_director_rejects_invalid_glb_and_stale_revision(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    await _setup_db(monkeypatch, tmp_path)
    async with db_session.session_scope() as session:
        service = DirectorDeskService(session)
        invalid = UploadFile(file=io.BytesIO(b"not-a-model"), filename="broken.glb")
        with pytest.raises(DirectorDeskError, match="有效的 GLB"):
            await service.add_model("director-project", invalid, expected_revision=0)
        model_dir = settings.storage_path_resolved / "director-project" / "director_models"
        assert not list(model_dir.glob("*.glb"))

        await service.save_scene("director-project", _scene(), expected_revision=0)
        with pytest.raises(DirectorDeskError, match="其他窗口更新") as conflict:
            await service.save_scene("director-project", _scene(), expected_revision=0)
        assert conflict.value.status_code == 409
    await db_session.engine.dispose()


@pytest.mark.asyncio
async def test_director_persists_mannequin_proportions_and_rejects_invalid_joint(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    await _setup_db(monkeypatch, tmp_path)
    async with db_session.session_scope() as session:
        service = DirectorDeskService(session)
        scene = _scene()
        scene["objects"][0]["mannequin"] = {
            "anatomy": "feminine",
            "body_preset": "custom",
            "pose_preset": "custom",
            "proportions": {
                "height": 1.88,
                "build": 1.12,
                "shoulder_width": 1.08,
                "hip_width": 0.98,
                "torso_length": 1.02,
                "arm_length": 1.06,
                "leg_length": 1.04,
                "head_scale": 0.96,
            },
            "joints": {
                "rightShoulder": [-88, 0, 5],
                "rightElbow": [-8, 0, 0],
            },
        }
        saved = await service.save_scene("director-project", scene, expected_revision=0)
        mannequin = saved["scene"]["objects"][0]["mannequin"]
        assert mannequin["anatomy"] == "feminine"
        assert mannequin["proportions"]["height"] == 1.88
        assert mannequin["joints"]["rightShoulder"] == [-88, 0, 5]

        invalid = _scene()
        invalid["objects"][0]["mannequin"] = {
            "proportions": {"height": 1.72},
            "joints": {"rightShoulder": [181, 0, 0]},
        }
        with pytest.raises(DirectorDeskError, match="超出旋转范围"):
            await service.save_scene("director-project", invalid, expected_revision=1)

        invalid_knee = _scene()
        invalid_knee["objects"][0]["mannequin"] = {
            "joints": {"leftKnee": [-30, 0, 0]},
        }
        with pytest.raises(DirectorDeskError, match="超出旋转范围"):
            await service.save_scene("director-project", invalid_knee, expected_revision=1)

        invalid_anatomy = _scene()
        invalid_anatomy["objects"][0]["mannequin"] = {"anatomy": "robot"}
        with pytest.raises(DirectorDeskError, match="anatomy"):
            await service.save_scene("director-project", invalid_anatomy, expected_revision=1)
    await db_session.engine.dispose()
