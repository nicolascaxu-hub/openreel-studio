"""Media Provider MCP Tools — manage image/video/audio provider configurations.

Users configure one or more providers (base_url + api_key + model_name) per
kind (image / video / audio). Exactly one provider per kind can be 'active' at a time;
generate tools use the active provider by default or accept an explicit model
name to pick a specific one.
"""

from __future__ import annotations

import json
from typing import Any

from sqlmodel import select

from app.db.models import MediaProvider
from app.db.session import session_scope
from app.services.media_provider import test_provider as _test_provider


_MEDIA_KINDS = {"image", "video", "audio"}


def _provider_to_dict(p: MediaProvider) -> dict[str, Any]:
    return {
        "id": p.id,
        "kind": p.kind,
        "name": p.name,
        "base_url": p.base_url,
        "model_name": p.model_name,
        "api_format": p.api_format,
        "is_active": p.is_active,
        "enabled": p.enabled,
        "notes": p.notes,
        "params": json.loads(p.params_json or "{}"),
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }


async def media_list_providers(kind: str | None = None) -> dict[str, Any]:
    """List all configured media providers, optionally filtered by kind (image/video/audio)."""
    async with session_scope() as session:
        q = select(MediaProvider).where(MediaProvider.enabled.is_(True))
        if kind:
            q = q.where(MediaProvider.kind == kind)
        result = await session.exec(q.order_by(MediaProvider.kind, MediaProvider.name))
        providers = result.all()
    return {
        "providers": [_provider_to_dict(p) for p in providers],
        "count": len(providers),
    }


async def media_test_provider(provider_id: str) -> dict[str, Any]:
    """Test a provider by sending a minimal real request. Returns ok/error + sample_url."""
    return await _test_provider(provider_id)
