"""Internal asset persistence used by media generation."""

from __future__ import annotations

import json
import uuid

from app.db.models import Asset
from app.db.session import session_scope


async def register_asset(
    project_id: str,
    asset_type: str,
    name: str,
    path: str | None = None,
    url: str | None = None,
    mime_type: str | None = None,
    metadata: dict | None = None,
    prompt: str | None = None,
    model_name: str | None = None,
    node_id: str | None = None,
) -> dict:
    async with session_scope() as session:
        asset = Asset(
            id=str(uuid.uuid4()),
            project_id=project_id,
            node_id=node_id,
            type=asset_type,
            name=name,
            path=path,
            url=url,
            mime_type=mime_type,
            metadata_json=json.dumps(metadata or {}, ensure_ascii=False),
            prompt=prompt,
            model_name=model_name,
        )
        session.add(asset)
        await session.commit()
        await session.refresh(asset)
        return {"id": asset.id, "type": asset.type, "path": asset.path, "url": asset.url}
