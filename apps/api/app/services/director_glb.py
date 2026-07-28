"""GLB 2.0 validation, skeleton inventory, animation inventory, and humanoid mapping."""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any


class DirectorGlbError(ValueError):
    """Raised when a director model is not a structurally valid GLB 2.0 file."""


def _list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def _dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


HUMANOID_JOINTS = (
    "pelvis", "spine", "spineMiddle", "chest", "neck", "head",
    "leftClavicle", "leftShoulder", "leftElbow", "leftWrist",
    "rightClavicle", "rightShoulder", "rightElbow", "rightWrist",
    "leftHip", "leftKnee", "leftAnkle", "leftToe",
    "rightHip", "rightKnee", "rightAnkle", "rightToe",
    *(
        f"{side}{finger}{segment}"
        for side in ("left", "right")
        for finger in ("Thumb", "Index", "Middle", "Ring", "Pinky")
        for segment in (1, 2, 3)
    ),
)

CORE_HUMANOID_JOINTS = {
    "pelvis", "spine", "chest", "neck", "head",
    "leftClavicle", "leftShoulder", "leftElbow", "leftWrist",
    "rightClavicle", "rightShoulder", "rightElbow", "rightWrist",
    "leftHip", "leftKnee", "leftAnkle",
    "rightHip", "rightKnee", "rightAnkle",
}


def _normalized_name(value: str) -> str:
    name = str(value or "").strip().lower()
    name = name.rsplit("|", 1)[-1].rsplit(":", 1)[-1]
    name = re.sub(r"^(mixamorig|armature|skeleton|rig|def|org|mch|bip0*1)", "", name)
    return re.sub(r"[^a-z0-9]", "", name)


def _side_aliases(side: str, part: str) -> set[str]:
    short = "l" if side == "left" else "r"
    return {
        f"{side}{part}", f"{part}{side}", f"{part}{short}", f"{short}{part}",
    }


def _humanoid_aliases() -> dict[str, set[str]]:
    aliases: dict[str, set[str]] = {
        "pelvis": {"hips", "hip", "pelvis", "rootpelvis", "cog"},
        "spine": {"spine", "spine0", "spine01", "spine1", "lowerback", "abdomen", "abdomenlower"},
        "spineMiddle": {"spine1", "spine2", "spine02", "spine001", "midspine", "chest", "abdomenupper", "chestlower"},
        "chest": {"spine2", "spine3", "spine03", "spine002", "chest", "upperchest", "chestupper", "thorax"},
        "neck": {"neck", "neck1", "neck01"},
        "head": {"head"},
    }
    for side in ("left", "right"):
        aliases[f"{side}Clavicle"] = (
            _side_aliases(side, "shoulder")
            | _side_aliases(side, "clavicle")
            | _side_aliases(side, "collar")
        )
        aliases[f"{side}Shoulder"] = (
            _side_aliases(side, "arm")
            | _side_aliases(side, "upperarm")
            | _side_aliases(side, "shldr")
            | _side_aliases(side, "shldrbend")
            | _side_aliases(side, "shoulderbend")
        )
        aliases[f"{side}Elbow"] = (
            _side_aliases(side, "forearm")
            | _side_aliases(side, "lowerarm")
            | _side_aliases(side, "forearmbend")
        )
        aliases[f"{side}Wrist"] = _side_aliases(side, "hand") | _side_aliases(side, "wrist")
        aliases[f"{side}Hip"] = (
            _side_aliases(side, "upleg")
            | _side_aliases(side, "upperleg")
            | _side_aliases(side, "thigh")
            | _side_aliases(side, "thighbend")
        )
        aliases[f"{side}Knee"] = (
            _side_aliases(side, "leg")
            | _side_aliases(side, "lowerleg")
            | _side_aliases(side, "calf")
            | _side_aliases(side, "shin")
        )
        aliases[f"{side}Ankle"] = _side_aliases(side, "foot") | _side_aliases(side, "ankle")
        aliases[f"{side}Toe"] = (
            _side_aliases(side, "toebase")
            | _side_aliases(side, "toe")
            | _side_aliases(side, "ball")
        )
        for finger in ("Thumb", "Index", "Middle", "Ring", "Pinky"):
            lower = finger.lower()
            for segment in (1, 2, 3):
                suffixes = {str(segment), f"0{segment}"}
                if segment == 1:
                    suffixes |= {"proximal", "metacarpal"}
                elif segment == 2:
                    suffixes |= {"intermediate", "middle"}
                else:
                    suffixes |= {"distal", "tip"}
                values: set[str] = set()
                for suffix in suffixes:
                    values |= _side_aliases(side, f"hand{lower}{suffix}")
                    values |= _side_aliases(side, f"{lower}{suffix}")
                aliases[f"{side}{finger}{segment}"] = values
    return {joint: {_normalized_name(value) for value in values} for joint, values in aliases.items()}


HUMANOID_ALIASES = _humanoid_aliases()

VRM_HUMANOID_JOINTS = {
    "hips": "pelvis",
    "spine": "spine",
    "neck": "neck",
    "head": "head",
    "leftShoulder": "leftClavicle",
    "leftUpperArm": "leftShoulder",
    "leftLowerArm": "leftElbow",
    "leftHand": "leftWrist",
    "rightShoulder": "rightClavicle",
    "rightUpperArm": "rightShoulder",
    "rightLowerArm": "rightElbow",
    "rightHand": "rightWrist",
    "leftUpperLeg": "leftHip",
    "leftLowerLeg": "leftKnee",
    "leftFoot": "leftAnkle",
    "leftToes": "leftToe",
    "rightUpperLeg": "rightHip",
    "rightLowerLeg": "rightKnee",
    "rightFoot": "rightAnkle",
    "rightToes": "rightToe",
}
for _side in ("left", "right"):
    for _vrm_finger, _director_finger in (
        ("Index", "Index"),
        ("Middle", "Middle"),
        ("Ring", "Ring"),
        ("Little", "Pinky"),
    ):
        for _vrm_segment, _director_segment in (
            ("Metacarpal", 1),
            ("Proximal", 1),
            ("Intermediate", 2),
            ("Distal", 3),
        ):
            VRM_HUMANOID_JOINTS[
                f"{_side}{_vrm_finger}{_vrm_segment}"
            ] = f"{_side}{_director_finger}{_director_segment}"


def read_glb_document(target: Path, size: int | None = None) -> dict[str, Any]:
    resolved_size = target.stat().st_size if size is None else size
    if resolved_size < 20:
        raise DirectorGlbError("文件不是有效的 GLB 2.0 模型")
    document: Any = None
    with target.open("rb") as handle:
        header = handle.read(12)
        if header[:4] != b"glTF" or int.from_bytes(header[4:8], "little") != 2:
            raise DirectorGlbError("文件不是有效的 GLB 2.0 模型")
        if int.from_bytes(header[8:12], "little") != resolved_size:
            raise DirectorGlbError("GLB 文件长度声明无效")
        offset = 12
        while offset < resolved_size:
            chunk_header = handle.read(8)
            if len(chunk_header) != 8:
                raise DirectorGlbError("GLB 数据块头无效")
            chunk_length = int.from_bytes(chunk_header[:4], "little")
            chunk_type = chunk_header[4:8]
            offset += 8
            if chunk_length < 0 or offset + chunk_length > resolved_size:
                raise DirectorGlbError("GLB 数据块长度无效")
            chunk = handle.read(chunk_length)
            offset += chunk_length
            if chunk_type == b"JSON" and document is None:
                try:
                    document = json.loads(chunk.rstrip(b" \t\r\n\x00").decode("utf-8"))
                except (UnicodeDecodeError, json.JSONDecodeError) as exc:
                    raise DirectorGlbError("GLB JSON 场景块无效") from exc
    if not isinstance(document, dict):
        raise DirectorGlbError("GLB 缺少有效 JSON 场景块")
    asset = document.get("asset")
    if not isinstance(asset, dict) or str(asset.get("version") or "") != "2.0":
        raise DirectorGlbError("GLB asset.version 必须是 2.0")
    return document


def _node_name(nodes: list[Any], index: int) -> str:
    if 0 <= index < len(nodes) and isinstance(nodes[index], dict):
        value = str(nodes[index].get("name") or "").strip()
        if value:
            return value
    return f"Node {index}"


def _animation_duration(document: dict[str, Any], animation: dict[str, Any]) -> float | None:
    accessors = document.get("accessors") if isinstance(document.get("accessors"), list) else []
    duration = 0.0
    found = False
    for sampler in _list(animation.get("samplers")):
        if not isinstance(sampler, dict) or not isinstance(sampler.get("input"), int):
            continue
        index = sampler["input"]
        accessor = accessors[index] if 0 <= index < len(accessors) and isinstance(accessors[index], dict) else {}
        maximum = accessor.get("max")
        if isinstance(maximum, list) and maximum and isinstance(maximum[0], (int, float)):
            duration = max(duration, float(maximum[0]))
            found = True
    return round(duration, 4) if found else None


def _profile(names: list[str], document: dict[str, Any]) -> str:
    lowered = " ".join(names).lower()
    extensions = {
        str(extension)
        for extension in (
            _list(document.get("extensionsUsed"))
            + _list(document.get("extensionsRequired"))
        )
    }
    if any(str(extension).lower() in {"vrm", "vrmc_vrm"} for extension in extensions) or "vrm" in lowered:
        return "vrm"
    if "mixamorig" in lowered:
        return "mixamo"
    if re.search(r"\bbip0*1", lowered):
        return "biped"
    if "upperarm_l" in lowered or "thigh_l" in lowered:
        return "unreal"
    if "def-" in lowered or "org-" in lowered:
        return "rigify"
    return "generic"


def _vrm_humanoid_nodes(document: dict[str, Any]) -> dict[str, int]:
    extensions = _dict(document.get("extensions"))
    mapped: dict[str, int] = {}
    vrm1 = extensions.get("VRMC_vrm") if isinstance(extensions.get("VRMC_vrm"), dict) else {}
    humanoid1 = vrm1.get("humanoid") if isinstance(vrm1.get("humanoid"), dict) else {}
    human_bones1 = humanoid1.get("humanBones") if isinstance(humanoid1.get("humanBones"), dict) else {}
    for vrm_joint, value in human_bones1.items():
        node = value.get("node") if isinstance(value, dict) else None
        director_joint = VRM_HUMANOID_JOINTS.get(str(vrm_joint))
        if director_joint and isinstance(node, int):
            mapped[director_joint] = node

    vrm0 = extensions.get("VRM") if isinstance(extensions.get("VRM"), dict) else {}
    humanoid0 = vrm0.get("humanoid") if isinstance(vrm0.get("humanoid"), dict) else {}
    human_bones0 = humanoid0.get("humanBones") if isinstance(humanoid0.get("humanBones"), list) else []
    for value in human_bones0:
        if not isinstance(value, dict):
            continue
        director_joint = VRM_HUMANOID_JOINTS.get(str(value.get("bone") or ""))
        node = value.get("node")
        if director_joint and isinstance(node, int):
            mapped[director_joint] = node

    chest_source = human_bones1 if human_bones1 else {
        str(item.get("bone")): item for item in human_bones0 if isinstance(item, dict)
    }
    for source_joint in ("upperChest", "chest"):
        value = chest_source.get(source_joint)
        node = value.get("node") if isinstance(value, dict) else None
        if not isinstance(node, int):
            continue
        if source_joint == "upperChest":
            mapped["chest"] = node
            chest = chest_source.get("chest")
            chest_node = chest.get("node") if isinstance(chest, dict) else None
            if isinstance(chest_node, int):
                mapped["spineMiddle"] = chest_node
        else:
            mapped.setdefault("chest", node)
    for side in ("left", "right"):
        metacarpal = chest_source.get(f"{side}ThumbMetacarpal")
        has_metacarpal = isinstance(metacarpal, dict) and isinstance(metacarpal.get("node"), int)
        thumb_sources = (
            ("ThumbMetacarpal", 1), ("ThumbProximal", 2), ("ThumbDistal", 3)
        ) if has_metacarpal else (
            ("ThumbProximal", 1), ("ThumbIntermediate", 2), ("ThumbDistal", 3)
        )
        for suffix, segment in thumb_sources:
            value = chest_source.get(f"{side}{suffix}")
            node = value.get("node") if isinstance(value, dict) else None
            if isinstance(node, int):
                mapped[f"{side}Thumb{segment}"] = node
    return mapped


def _map_humanoid(
    nodes: list[Any],
    bone_indices: set[int],
    explicit_nodes: dict[str, int] | None = None,
) -> tuple[dict[str, str], dict[str, int]]:
    candidates = [
        (index, _node_name(nodes, index), _normalized_name(_node_name(nodes, index)))
        for index in sorted(bone_indices)
    ]
    node_map = {
        joint: index
        for joint, index in (explicit_nodes or {}).items()
        if joint in HUMANOID_JOINTS and index in bone_indices and 0 <= index < len(nodes)
    }
    name_map = {joint: _node_name(nodes, index) for joint, index in node_map.items()}
    used: set[int] = set(node_map.values())
    for joint in HUMANOID_JOINTS:
        if joint in node_map:
            continue
        aliases = HUMANOID_ALIASES.get(joint, set())
        best: tuple[int, int, str] | None = None
        for index, raw_name, normalized in candidates:
            if index in used or not normalized:
                continue
            score = 100 if normalized in aliases else 0
            if not score:
                matching = [alias for alias in aliases if len(alias) >= 5 and normalized.endswith(alias)]
                score = 80 + min(15, max((len(alias) for alias in matching), default=0)) if matching else 0
            if score and (best is None or score > best[0]):
                best = (score, index, raw_name)
        if best is None:
            continue
        _, index, raw_name = best
        used.add(index)
        name_map[joint] = raw_name
        node_map[joint] = index
    return name_map, node_map


def analyze_glb_document(document: dict[str, Any]) -> dict[str, Any]:
    nodes = document.get("nodes") if isinstance(document.get("nodes"), list) else []
    skins = document.get("skins") if isinstance(document.get("skins"), list) else []
    animations = document.get("animations") if isinstance(document.get("animations"), list) else []
    parent_by_node: dict[int, int] = {}
    for parent_index, node in enumerate(nodes):
        if not isinstance(node, dict):
            continue
        for child in _list(node.get("children")):
            if isinstance(child, int) and 0 <= child < len(nodes):
                parent_by_node.setdefault(child, parent_index)

    bone_indices: set[int] = set()
    skin_summaries: list[dict[str, Any]] = []
    for skin_index, skin in enumerate(skins):
        if not isinstance(skin, dict):
            continue
        joints = [index for index in _list(skin.get("joints")) if isinstance(index, int) and 0 <= index < len(nodes)]
        bone_indices.update(joints)
        skeleton = skin.get("skeleton") if isinstance(skin.get("skeleton"), int) else None
        if skeleton is not None and 0 <= skeleton < len(nodes):
            bone_indices.add(skeleton)
        skin_summaries.append({
            "index": skin_index,
            "name": str(skin.get("name") or f"Skin {skin_index + 1}"),
            "joint_count": len(joints),
            "skeleton_node": skeleton,
        })

    explicit_humanoid_nodes = _vrm_humanoid_nodes(document)
    bone_indices.update(
        index for index in explicit_humanoid_nodes.values()
        if 0 <= index < len(nodes)
    )

    bone_summaries = []
    for index in sorted(bone_indices):
        parent = parent_by_node.get(index)
        bone_summaries.append({
            "node": index,
            "name": _node_name(nodes, index),
            "parent_node": parent,
            "parent_name": _node_name(nodes, parent) if parent is not None else None,
        })

    animation_summaries: list[dict[str, Any]] = []
    for index, animation in enumerate(animations):
        if not isinstance(animation, dict):
            continue
        targets: set[int] = set()
        properties: set[str] = set()
        for channel in _list(animation.get("channels")):
            target = channel.get("target") if isinstance(channel, dict) else None
            if not isinstance(target, dict):
                continue
            if isinstance(target.get("node"), int):
                targets.add(target["node"])
            if isinstance(target.get("path"), str):
                properties.add(target["path"])
        animation_summaries.append({
            "index": index,
            "name": str(animation.get("name") or f"Animation {index + 1}"),
            "duration": _animation_duration(document, animation),
            "channel_count": len(_list(animation.get("channels"))),
            "target_node_count": len(targets),
            "properties": sorted(properties),
        })

    joint_map, joint_node_map = _map_humanoid(nodes, bone_indices, explicit_humanoid_nodes)
    mapped_core = CORE_HUMANOID_JOINTS.intersection(joint_map)
    required_anchor_groups = (
        {"pelvis", "spine", "head"},
        {"leftShoulder", "leftElbow", "leftWrist"},
        {"rightShoulder", "rightElbow", "rightWrist"},
        {"leftHip", "leftKnee", "leftAnkle"},
        {"rightHip", "rightKnee", "rightAnkle"},
    )
    recognized = bool(skins) and all(len(group.intersection(joint_map)) >= 2 for group in required_anchor_groups)
    confidence = round(len(mapped_core) / len(CORE_HUMANOID_JOINTS), 3)
    bone_names = [_node_name(nodes, index) for index in sorted(bone_indices)]
    return {
        "format": "glb2",
        "generator": str((document.get("asset") or {}).get("generator") or ""),
        "node_count": len(nodes),
        "mesh_count": len(document.get("meshes", [])) if isinstance(document.get("meshes"), list) else 0,
        "material_count": len(document.get("materials", [])) if isinstance(document.get("materials"), list) else 0,
        "skin_count": len(skin_summaries),
        "skins": skin_summaries,
        "bone_count": len(bone_summaries),
        "bones": bone_summaries,
        "animation_count": len(animation_summaries),
        "animations": animation_summaries,
        "humanoid": {
            "recognized": recognized,
            "profile": _profile(bone_names, document),
            "confidence": confidence,
            "mapped_joint_count": len(joint_map),
            "joint_count": len(HUMANOID_JOINTS),
            "joint_map": joint_map,
            "joint_node_map": joint_node_map,
            "missing_joints": [joint for joint in HUMANOID_JOINTS if joint not in joint_map],
        },
    }


def analyze_glb_file(target: Path, size: int | None = None) -> dict[str, Any]:
    return analyze_glb_document(read_glb_document(target, size))
