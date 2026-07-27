"""REST surface for the project-scoped 3D director desk."""
from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, ConfigDict, Field
from sqlmodel.ext.asyncio.session import AsyncSession

from app.db.session import get_session
from app.services.director_desk import DirectorDeskError, DirectorDeskService
from app.services.node_service import workflow_node_payload


router = APIRouter()


class DirectorSceneRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    scene: dict[str, Any]
    expected_revision: Optional[int] = Field(default=None, ge=0)


class DirectorCaptureRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: Optional[str] = Field(default=None, max_length=120)
    data_url: str
    scene_snapshot: dict[str, Any]
    actor_legend: list[dict[str, Any]] = Field(default_factory=list, max_length=40)
    expected_revision: Optional[int] = Field(default=None, ge=0)


class DirectorCapturePatchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: Optional[str] = Field(default=None, max_length=120)
    expected_revision: Optional[int] = Field(default=None, ge=0)


class DirectorCaptureReorderRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    capture_ids: list[str] = Field(min_length=0, max_length=200)
    expected_revision: Optional[int] = Field(default=None, ge=0)


class DirectorCapturePromoteRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    x: Optional[float] = None
    y: Optional[float] = None


def _raise(error: DirectorDeskError) -> None:
    raise HTTPException(status_code=error.status_code, detail=str(error)) from error


@router.get("/{project_id}/director")
async def get_project_director(
    project_id: str,
    db: AsyncSession = Depends(get_session),
):
    try:
        return {"ok": True, "director": await DirectorDeskService(db).get(project_id)}
    except DirectorDeskError as error:
        _raise(error)


@router.put("/{project_id}/director/scene")
async def save_project_director_scene(
    project_id: str,
    req: DirectorSceneRequest,
    db: AsyncSession = Depends(get_session),
):
    try:
        director = await DirectorDeskService(db).save_scene(
            project_id,
            req.scene,
            expected_revision=req.expected_revision,
        )
        return {"ok": True, "director": director}
    except DirectorDeskError as error:
        _raise(error)


@router.post("/{project_id}/director/models")
async def upload_project_director_model(
    project_id: str,
    file: UploadFile = File(...),
    expected_revision: Optional[int] = Form(default=None),
    db: AsyncSession = Depends(get_session),
):
    try:
        director, asset = await DirectorDeskService(db).add_model(
            project_id,
            file,
            expected_revision=expected_revision,
        )
        return {"ok": True, "director": director, "asset": asset}
    except DirectorDeskError as error:
        _raise(error)


@router.get("/{project_id}/director/models/{model_id}/file")
async def read_project_director_model(
    project_id: str,
    model_id: str,
    db: AsyncSession = Depends(get_session),
):
    try:
        target, asset = await DirectorDeskService(db).model_file(project_id, model_id)
        return FileResponse(
            path=str(target),
            media_type="model/gltf-binary",
            filename=str(asset.get("name") or target.name),
            headers={"Cache-Control": "private, max-age=3600", "Accept-Ranges": "bytes"},
        )
    except DirectorDeskError as error:
        _raise(error)


@router.delete("/{project_id}/director/models/{model_id}")
async def delete_project_director_model(
    project_id: str,
    model_id: str,
    expected_revision: Optional[int] = None,
    db: AsyncSession = Depends(get_session),
):
    try:
        director = await DirectorDeskService(db).delete_model(
            project_id,
            model_id,
            expected_revision=expected_revision,
        )
        return {"ok": True, "director": director}
    except DirectorDeskError as error:
        _raise(error)


@router.post("/{project_id}/director/captures")
async def create_project_director_capture(
    project_id: str,
    req: DirectorCaptureRequest,
    db: AsyncSession = Depends(get_session),
):
    try:
        director, capture = await DirectorDeskService(db).add_capture(
            project_id,
            title=req.title,
            data_url=req.data_url,
            scene_snapshot=req.scene_snapshot,
            actor_legend=req.actor_legend,
            expected_revision=req.expected_revision,
        )
        return {"ok": True, "director": director, "capture": capture}
    except DirectorDeskError as error:
        _raise(error)


@router.post("/{project_id}/director/captures/reorder")
async def reorder_project_director_captures(
    project_id: str,
    req: DirectorCaptureReorderRequest,
    db: AsyncSession = Depends(get_session),
):
    try:
        director = await DirectorDeskService(db).reorder_captures(
            project_id,
            req.capture_ids,
            expected_revision=req.expected_revision,
        )
        return {"ok": True, "director": director}
    except DirectorDeskError as error:
        _raise(error)


@router.patch("/{project_id}/director/captures/{capture_id}")
async def update_project_director_capture(
    project_id: str,
    capture_id: str,
    req: DirectorCapturePatchRequest,
    db: AsyncSession = Depends(get_session),
):
    try:
        director = await DirectorDeskService(db).update_capture(
            project_id,
            capture_id,
            title=req.title,
            expected_revision=req.expected_revision,
        )
        return {"ok": True, "director": director}
    except DirectorDeskError as error:
        _raise(error)


@router.delete("/{project_id}/director/captures/{capture_id}")
async def delete_project_director_capture(
    project_id: str,
    capture_id: str,
    expected_revision: Optional[int] = None,
    db: AsyncSession = Depends(get_session),
):
    try:
        director = await DirectorDeskService(db).remove_capture(
            project_id,
            capture_id,
            expected_revision=expected_revision,
        )
        return {"ok": True, "director": director}
    except DirectorDeskError as error:
        _raise(error)


@router.post("/{project_id}/director/captures/{capture_id}/canvas")
async def promote_project_director_capture(
    project_id: str,
    capture_id: str,
    req: DirectorCapturePromoteRequest,
    db: AsyncSession = Depends(get_session),
):
    if (req.x is None) != (req.y is None):
        raise HTTPException(status_code=400, detail="x 和 y 必须同时提供")
    try:
        director, node, created = await DirectorDeskService(db).promote_capture(
            project_id,
            capture_id,
            x=req.x,
            y=req.y,
        )
        return {
            "ok": True,
            "created": created,
            "director": director,
            "node": workflow_node_payload(node),
        }
    except DirectorDeskError as error:
        _raise(error)
