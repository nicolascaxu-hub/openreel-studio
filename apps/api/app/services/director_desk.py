"""Project-scoped persistence and canvas promotion for the 3D director desk."""
from __future__ import annotations

import base64
import binascii
import json
import math
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import UploadFile
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.config import settings
from app.db.models import WorkflowNode
from app.services.node_service import NodeService
from app.services.project_service import ProjectService


DIRECTOR_STATE_KEY = "director_desk"
DIRECTOR_VERSION = 1
MAX_DIRECTOR_STATE_BYTES = 5 * 1024 * 1024
MAX_DIRECTOR_OBJECTS = 100
MAX_DIRECTOR_CAPTURES = 200
MAX_DIRECTOR_MODELS = 100
MAX_MODEL_BYTES = 50 * 1024 * 1024
MAX_CAPTURE_BYTES = 20 * 1024 * 1024


class DirectorDeskError(RuntimeError):
    def __init__(self, message: str, *, status_code: int = 400):
        super().__init__(message)
        self.status_code = status_code


def default_director_scene() -> dict[str, Any]:
    return {
        "aspect_ratio": "16:9",
        "camera": {
            "position": [4.8, 3.0, 6.8],
            "target": [0.0, 1.0, 0.0],
            "fov": 45.0,
        },
        "objects": [],
    }


def default_director_state() -> dict[str, Any]:
    return {
        "version": DIRECTOR_VERSION,
        "revision": 0,
        "scene": default_director_scene(),
        "model_assets": [],
        "captures": [],
    }


def normalize_director_state(raw: Any) -> dict[str, Any]:
    source = raw if isinstance(raw, dict) else {}
    state = default_director_state()
    try:
        state["revision"] = max(0, int(source.get("revision", 0)))
    except (TypeError, ValueError):
        state["revision"] = 0
    state["version"] = DIRECTOR_VERSION
    if isinstance(source.get("scene"), dict):
        state["scene"] = source["scene"]
    if isinstance(source.get("model_assets"), list):
        state["model_assets"] = source["model_assets"]
    if isinstance(source.get("captures"), list):
        state["captures"] = source["captures"]
    return state


def _json_size(value: Any) -> int:
    try:
        return len(json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode("utf-8"))
    except (TypeError, ValueError) as exc:
        raise DirectorDeskError("导演台状态必须是有效 JSON") from exc


def _finite_vector(value: Any, *, length: int, name: str) -> None:
    if not isinstance(value, list) or len(value) != length:
        raise DirectorDeskError(f"{name} 必须包含 {length} 个数值")
    for item in value:
        if not isinstance(item, (int, float)) or isinstance(item, bool) or not math.isfinite(float(item)):
            raise DirectorDeskError(f"{name} 包含无效数值")


def validate_director_scene(scene: Any) -> dict[str, Any]:
    if not isinstance(scene, dict):
        raise DirectorDeskError("scene 必须是对象")
    if _json_size(scene) > MAX_DIRECTOR_STATE_BYTES:
        raise DirectorDeskError("导演台场景过大", status_code=413)
    aspect_ratio = str(scene.get("aspect_ratio") or "16:9")
    if aspect_ratio not in {"16:9", "9:16", "1:1", "4:3"}:
        raise DirectorDeskError("不支持的导演台画幅")
    camera = scene.get("camera")
    if not isinstance(camera, dict):
        raise DirectorDeskError("导演台缺少相机状态")
    _finite_vector(camera.get("position"), length=3, name="camera.position")
    _finite_vector(camera.get("target"), length=3, name="camera.target")
    fov = camera.get("fov", 45)
    if not isinstance(fov, (int, float)) or isinstance(fov, bool) or not 10 <= float(fov) <= 120:
        raise DirectorDeskError("camera.fov 必须在 10 到 120 之间")
    objects = scene.get("objects")
    if not isinstance(objects, list) or len(objects) > MAX_DIRECTOR_OBJECTS:
        raise DirectorDeskError("导演台物体数量超出限制")
    seen: set[str] = set()
    for index, item in enumerate(objects):
        if not isinstance(item, dict):
            raise DirectorDeskError(f"objects[{index}] 必须是对象")
        object_id = str(item.get("id") or "").strip()
        asset_id = str(item.get("asset_id") or "").strip()
        if not object_id or object_id in seen or not asset_id:
            raise DirectorDeskError("导演台物体 ID 或资产 ID 无效")
        seen.add(object_id)
        _finite_vector(item.get("position"), length=3, name=f"objects[{index}].position")
        _finite_vector(item.get("rotation"), length=3, name=f"objects[{index}].rotation")
        _finite_vector(item.get("scale"), length=3, name=f"objects[{index}].scale")
    return scene


def validate_director_state(state: dict[str, Any]) -> None:
    validate_director_scene(state.get("scene"))
    models = state.get("model_assets")
    captures = state.get("captures")
    if not isinstance(models, list) or len(models) > MAX_DIRECTOR_MODELS:
        raise DirectorDeskError("自定义模型数量超出限制")
    if not isinstance(captures, list) or len(captures) > MAX_DIRECTOR_CAPTURES:
        raise DirectorDeskError("导演台截图数量超出限制")
    if _json_size(state) > MAX_DIRECTOR_STATE_BYTES:
        raise DirectorDeskError("导演台状态过大", status_code=413)


def _project_root(project_id: str) -> Path:
    if not project_id or Path(project_id).name != project_id or project_id in {".", ".."}:
        raise DirectorDeskError("无效项目 ID")
    root = (settings.storage_path_resolved / project_id).resolve()
    storage_root = settings.storage_path_resolved.resolve()
    try:
        root.relative_to(storage_root)
    except ValueError as exc:
        raise DirectorDeskError("项目路径超出存储目录") from exc
    return root


def _capture_file(project_id: str, file_name: str) -> Path:
    if not file_name or Path(file_name).name != file_name:
        raise DirectorDeskError("无效截图文件名")
    root = _project_root(project_id) / "generated_images" / "director_captures"
    target = (root / file_name).resolve()
    try:
        target.relative_to(root.resolve())
    except ValueError as exc:
        raise DirectorDeskError("截图路径超出项目目录") from exc
    return target


def _model_file(project_id: str, file_name: str) -> Path:
    if not file_name or Path(file_name).name != file_name:
        raise DirectorDeskError("无效模型文件名")
    root = _project_root(project_id) / "director_models"
    target = (root / file_name).resolve()
    try:
        target.relative_to(root.resolve())
    except ValueError as exc:
        raise DirectorDeskError("模型路径超出项目目录") from exc
    return target


def _decode_capture_data_url(data_url: str) -> tuple[bytes, str]:
    header, sep, encoded = str(data_url or "").partition(",")
    if sep != "," or not header.startswith("data:image/"):
        raise DirectorDeskError("截图必须是图片 data URL")
    media_type = header[5:].split(";", 1)[0].lower()
    ext = {"image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp"}.get(media_type)
    if not ext:
        raise DirectorDeskError("截图格式只支持 PNG、JPEG 或 WebP")
    try:
        raw = base64.b64decode(encoded, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise DirectorDeskError("截图 data URL 无效") from exc
    if not raw or len(raw) > MAX_CAPTURE_BYTES:
        raise DirectorDeskError("截图为空或超过大小限制", status_code=413)
    signature_ok = (
        (ext == ".png" and raw.startswith(b"\x89PNG\r\n\x1a\n"))
        or (ext == ".jpg" and raw.startswith(b"\xff\xd8"))
        or (ext == ".webp" and raw.startswith(b"RIFF") and raw[8:12] == b"WEBP")
    )
    if not signature_ok:
        raise DirectorDeskError("截图内容与声明格式不匹配")
    return raw, ext


def _validate_glb2(target: Path, size: int) -> None:
    if size < 20:
        raise DirectorDeskError("文件不是有效的 GLB 2.0 模型")
    with target.open("rb") as handle:
        header = handle.read(12)
        if header[:4] != b"glTF" or int.from_bytes(header[4:8], "little") != 2:
            raise DirectorDeskError("文件不是有效的 GLB 2.0 模型")
        if int.from_bytes(header[8:12], "little") != size:
            raise DirectorDeskError("GLB 文件长度声明无效")
        chunk_header = handle.read(8)
        chunk_length = int.from_bytes(chunk_header[:4], "little")
        if chunk_header[4:8] != b"JSON" or chunk_length <= 0 or 20 + chunk_length > size:
            raise DirectorDeskError("GLB 缺少有效 JSON 场景块")
        try:
            document = json.loads(handle.read(chunk_length).rstrip(b" \t\r\n\x00").decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise DirectorDeskError("GLB JSON 场景块无效") from exc
    asset = document.get("asset") if isinstance(document, dict) else None
    if not isinstance(asset, dict) or str(asset.get("version") or "") != "2.0":
        raise DirectorDeskError("GLB asset.version 必须是 2.0")


def _parse_node_input(node: WorkflowNode) -> dict[str, Any]:
    if isinstance(node.input_json, str) and node.input_json.strip():
        try:
            payload = json.loads(node.input_json)
        except (json.JSONDecodeError, TypeError):
            return {}
        return payload if isinstance(payload, dict) else {}
    return {}


def _node_capture_id(node: WorkflowNode) -> str:
    payload = _parse_node_input(node)
    fields = payload.get("fields") if isinstance(payload.get("fields"), dict) else {}
    return str(fields.get("director_capture_id") or "").strip()


class DirectorDeskService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.projects = ProjectService(db)

    async def get(self, project_id: str) -> dict[str, Any]:
        state = await self.projects.get_project_state(project_id)
        if state is None:
            raise DirectorDeskError("项目不存在", status_code=404)
        director = normalize_director_state(state.get(DIRECTOR_STATE_KEY))
        validate_director_state(director)
        return director

    async def _write(
        self,
        project_id: str,
        director: dict[str, Any],
        *,
        expected_revision: int | None = None,
    ) -> dict[str, Any]:
        current = await self.get(project_id)
        current_revision = int(current.get("revision", 0))
        if expected_revision is not None and int(expected_revision) != current_revision:
            raise DirectorDeskError("导演台已在其他窗口更新，请重新载入", status_code=409)
        next_state = normalize_director_state(director)
        next_state["revision"] = current_revision + 1
        validate_director_state(next_state)
        project = await self.projects.update_project_state(project_id, {DIRECTOR_STATE_KEY: next_state})
        if project is None:
            raise DirectorDeskError("项目不存在", status_code=404)
        return next_state

    async def save_scene(
        self,
        project_id: str,
        scene: dict[str, Any],
        *,
        expected_revision: int | None = None,
    ) -> dict[str, Any]:
        validate_director_scene(scene)
        director = await self.get(project_id)
        director["scene"] = scene
        return await self._write(project_id, director, expected_revision=expected_revision)

    async def add_model(
        self,
        project_id: str,
        file: UploadFile,
        *,
        expected_revision: int | None = None,
    ) -> tuple[dict[str, Any], dict[str, Any]]:
        director = await self.get(project_id)
        raw_name = Path(file.filename or "model.glb").name
        if Path(raw_name).suffix.lower() != ".glb":
            raise DirectorDeskError("首期只支持 GLB 模型")
        model_id = uuid.uuid4().hex
        file_name = f"director-model-{model_id}.glb"
        target = _model_file(project_id, file_name)
        target.parent.mkdir(parents=True, exist_ok=True)
        size = 0
        try:
            with target.open("wb") as handle:
                while True:
                    chunk = await file.read(1 << 20)
                    if not chunk:
                        break
                    size += len(chunk)
                    if size > MAX_MODEL_BYTES:
                        raise DirectorDeskError("GLB 模型超过 50 MB", status_code=413)
                    handle.write(chunk)
            _validate_glb2(target, size)
            asset = {
                "id": model_id,
                "name": raw_name,
                "file_name": file_name,
                "url": f"/api/projects/{project_id}/director/models/{model_id}/file",
                "size": size,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            director["model_assets"] = [*director.get("model_assets", []), asset]
            saved = await self._write(project_id, director, expected_revision=expected_revision)
            return saved, asset
        except Exception:
            target.unlink(missing_ok=True)
            raise

    async def model_file(self, project_id: str, model_id: str) -> tuple[Path, dict[str, Any]]:
        director = await self.get(project_id)
        asset = next(
            (item for item in director.get("model_assets", []) if isinstance(item, dict) and item.get("id") == model_id),
            None,
        )
        if not asset:
            raise DirectorDeskError("模型不存在", status_code=404)
        target = _model_file(project_id, str(asset.get("file_name") or ""))
        if not target.exists() or not target.is_file():
            raise DirectorDeskError("模型文件不存在", status_code=404)
        return target, asset

    async def delete_model(
        self,
        project_id: str,
        model_id: str,
        *,
        expected_revision: int | None = None,
    ) -> dict[str, Any]:
        director = await self.get(project_id)
        assets = [item for item in director.get("model_assets", []) if isinstance(item, dict)]
        asset = next((item for item in assets if item.get("id") == model_id), None)
        if not asset:
            raise DirectorDeskError("模型不存在", status_code=404)
        snapshots: list[dict[str, Any]] = [director.get("scene", {})]
        snapshots.extend(
            item.get("scene_snapshot", {})
            for item in director.get("captures", [])
            if isinstance(item, dict)
        )
        for snapshot in snapshots:
            objects = snapshot.get("objects", []) if isinstance(snapshot, dict) else []
            if any(isinstance(item, dict) and item.get("asset_id") == model_id for item in objects):
                raise DirectorDeskError("模型仍被场景或截图引用，不能删除", status_code=409)
        director["model_assets"] = [item for item in assets if item.get("id") != model_id]
        saved = await self._write(project_id, director, expected_revision=expected_revision)
        _model_file(project_id, str(asset.get("file_name") or "")).unlink(missing_ok=True)
        return saved

    async def add_capture(
        self,
        project_id: str,
        *,
        title: str | None,
        data_url: str,
        scene_snapshot: dict[str, Any],
        actor_legend: list[dict[str, Any]] | None = None,
        expected_revision: int | None = None,
    ) -> tuple[dict[str, Any], dict[str, Any]]:
        validate_director_scene(scene_snapshot)
        director = await self.get(project_id)
        captures = [item for item in director.get("captures", []) if isinstance(item, dict)]
        if len(captures) >= MAX_DIRECTOR_CAPTURES:
            raise DirectorDeskError("导演台截图已达到上限")
        raw, ext = _decode_capture_data_url(data_url)
        capture_id = uuid.uuid4().hex
        file_name = f"director-capture-{capture_id}{ext}"
        target = _capture_file(project_id, file_name)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(raw)
        clean_legend = [item for item in (actor_legend or []) if isinstance(item, dict)][:40]
        capture = {
            "id": capture_id,
            "order": len(captures),
            "title": str(title or "").strip() or f"镜头 {len(captures) + 1}",
            "file_name": file_name,
            "image_url": f"/api/media/{project_id}/director_captures/{file_name}",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "aspect_ratio": scene_snapshot.get("aspect_ratio", "16:9"),
            "scene_snapshot": scene_snapshot,
            "actor_legend": clean_legend,
            "promoted_node_id": None,
        }
        try:
            director["scene"] = scene_snapshot
            director["captures"] = [*captures, capture]
            saved = await self._write(project_id, director, expected_revision=expected_revision)
            return saved, capture
        except Exception:
            target.unlink(missing_ok=True)
            raise

    async def update_capture(
        self,
        project_id: str,
        capture_id: str,
        *,
        title: str | None = None,
        expected_revision: int | None = None,
    ) -> dict[str, Any]:
        director = await self.get(project_id)
        found = False
        for capture in director.get("captures", []):
            if isinstance(capture, dict) and capture.get("id") == capture_id:
                if title is not None:
                    clean_title = title.strip()
                    if not clean_title:
                        raise DirectorDeskError("截图标题不能为空")
                    capture["title"] = clean_title[:120]
                found = True
                break
        if not found:
            raise DirectorDeskError("截图不存在", status_code=404)
        return await self._write(project_id, director, expected_revision=expected_revision)

    async def reorder_captures(
        self,
        project_id: str,
        capture_ids: list[str],
        *,
        expected_revision: int | None = None,
    ) -> dict[str, Any]:
        director = await self.get(project_id)
        captures = [item for item in director.get("captures", []) if isinstance(item, dict)]
        existing_ids = [str(item.get("id") or "") for item in captures]
        if len(capture_ids) != len(existing_ids) or set(capture_ids) != set(existing_ids):
            raise DirectorDeskError("截图排序必须包含当前时间线的全部截图")
        by_id = {str(item.get("id")): item for item in captures}
        director["captures"] = []
        for order, capture_id in enumerate(capture_ids):
            item = by_id[capture_id]
            item["order"] = order
            director["captures"].append(item)
        return await self._write(project_id, director, expected_revision=expected_revision)

    async def _find_capture_node(self, project_id: str, capture_id: str) -> WorkflowNode | None:
        result = await self.db.exec(
            select(WorkflowNode).where(WorkflowNode.project_id == project_id, WorkflowNode.type == "image")
        )
        for node in result.all():
            if _node_capture_id(node) == capture_id:
                return node
        return None

    async def remove_capture(
        self,
        project_id: str,
        capture_id: str,
        *,
        expected_revision: int | None = None,
    ) -> dict[str, Any]:
        director = await self.get(project_id)
        captures = [item for item in director.get("captures", []) if isinstance(item, dict)]
        capture = next((item for item in captures if item.get("id") == capture_id), None)
        if not capture:
            raise DirectorDeskError("截图不存在", status_code=404)
        remaining = [item for item in captures if item.get("id") != capture_id]
        for order, item in enumerate(remaining):
            item["order"] = order
        director["captures"] = remaining
        saved = await self._write(project_id, director, expected_revision=expected_revision)
        if await self._find_capture_node(project_id, capture_id) is None:
            _capture_file(project_id, str(capture.get("file_name") or "")).unlink(missing_ok=True)
        return saved

    async def promote_capture(
        self,
        project_id: str,
        capture_id: str,
        *,
        x: float | None = None,
        y: float | None = None,
    ) -> tuple[dict[str, Any], WorkflowNode, bool]:
        director = await self.get(project_id)
        capture = next(
            (item for item in director.get("captures", []) if isinstance(item, dict) and item.get("id") == capture_id),
            None,
        )
        if not capture:
            raise DirectorDeskError("截图不存在", status_code=404)
        existing = None
        promoted_id = str(capture.get("promoted_node_id") or "")
        if promoted_id:
            candidate = await self.db.get(WorkflowNode, promoted_id)
            if candidate and candidate.project_id == project_id and candidate.type == "image":
                existing = candidate
        existing = existing or await self._find_capture_node(project_id, capture_id)
        if existing is not None:
            existing_id = existing.id
            if capture.get("promoted_node_id") != existing.id:
                capture["promoted_node_id"] = existing.id
                director = await self._write(project_id, director)
                existing = await self.db.get(WorkflowNode, existing_id)
                if existing is None:
                    raise DirectorDeskError("构图参考节点不存在", status_code=404)
            return director, existing, False

        target = _capture_file(project_id, str(capture.get("file_name") or ""))
        if not target.exists() or not target.is_file():
            raise DirectorDeskError("截图文件不存在", status_code=404)
        title = str(capture.get("title") or "").strip() or "导演台构图参考"
        guide = (
            "3D 导演台构图参考：仅参考人物与物体的站位、朝向、姿态、比例、遮挡关系、景别和机位；"
            "生成正式分镜时结合人物与场景参考重绘，不保留白模、色块、网格或编辑器外观。"
        )
        fields = {
            "director_capture": True,
            "director_capture_id": capture_id,
            "purpose": "storyboard_composition_reference",
            "stage": "layout",
            "reference_role": "composition",
            "reference_usage": "composition_only",
            "actor_legend": capture.get("actor_legend", []),
            "director_camera": (capture.get("scene_snapshot") or {}).get("camera", {}),
            "aspect_ratio": capture.get("aspect_ratio", "16:9"),
        }
        input_data = {
            "surface": "draft_canvas",
            "title": title,
            "prompt": guide,
            "fields": fields,
            "render_state": "fresh",
        }
        output = {
            "ok": True,
            "type": "image",
            "operation": "director_capture",
            "status": "completed",
            "url": capture.get("image_url"),
            "local_url": capture.get("image_url"),
            "director_capture": True,
        }
        payload: dict[str, Any] = {
            "type": "image",
            "title": title,
            "status": "completed",
            "input_json": input_data,
            "output_json": output,
            "prompt": guide,
            "model_config_json": {"surface": "draft_canvas", "_ui_creator": "user"},
            "avoid_position_overlap": True,
        }
        if x is not None and y is not None:
            payload["position_x"] = float(x)
            payload["position_y"] = float(y)
        node = await NodeService(self.db).create_node(project_id, payload)
        node_id = node.id
        latest = await self.get(project_id)
        for item in latest.get("captures", []):
            if isinstance(item, dict) and item.get("id") == capture_id:
                item["promoted_node_id"] = node.id
                break
        latest = await self._write(project_id, latest)
        node = await self.db.get(WorkflowNode, node_id)
        if node is None:
            raise DirectorDeskError("构图参考节点不存在", status_code=404)
        return latest, node, True
