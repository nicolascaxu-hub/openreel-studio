"""MCP-style project tools."""

from __future__ import annotations

from typing import Any

from app.db.session import session_scope
from app.mcp_tools import canvas_tools
from app.services.node_public_ids import (
    internal_to_public_id_map,
    model_visible_edge_payload,
    model_visible_node_payload,
)
from app.services.project_service import ProjectService


async def project_get_state(project_id: str) -> dict[str, Any]:
    async with session_scope() as session:
        svc = ProjectService(session)
        state = await svc.get_project_state(project_id)
        if state is None:
            return {"error": f"Project {project_id} not found"}
        id_map = await internal_to_public_id_map(session, project_id)
        result = _project_state_for_status_display(state)
        result["workflow"] = {
            "nodes": [
                model_visible_node_payload(node, id_map)
                for node in await canvas_tools.list_nodes(project_id)
            ],
            "edges": [
                model_visible_edge_payload(edge, id_map)
                for edge in await canvas_tools.list_edges(project_id)
            ],
        }
        result["agent_token_usage_summary"] = _agent_token_usage_summary(result)
        return result


def _project_state_for_status_display(state: dict[str, Any]) -> dict[str, Any]:
    """Return a detached state mapping for project/status queries."""
    return dict(state)


def _percent(value: Any) -> float | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return round(float(value) * 100, 2)
    return None


def _agent_token_usage_summary(state: dict[str, Any]) -> dict[str, Any]:
    usage = state.get("agent_token_usage")
    if not isinstance(usage, dict):
        return {
            "available": False,
            "note": "当前项目尚未记录模型 token/cache usage。",
        }
    cache_hit_rate = usage.get("cache_hit_rate")
    latest_call_context = (
        usage.get("latest_call_context")
        if isinstance(usage.get("latest_call_context"), dict)
        else {}
    )
    latest_context_map = latest_call_context if isinstance(latest_call_context, dict) else {}
    context_peak = usage.get("context_peak") if isinstance(usage.get("context_peak"), dict) else {}
    context_peak_map = context_peak if isinstance(context_peak, dict) else {}
    context_available_rate = latest_context_map.get(
        "context_available_rate", usage.get("context_available_rate")
    )
    context_used_rate = latest_context_map.get("context_used_rate", usage.get("context_used_rate"))
    context_peak_available_rate = context_peak_map.get(
        "context_available_rate", usage.get("context_peak_available_rate")
    )
    context_peak_used_rate = context_peak_map.get(
        "context_used_rate", usage.get("context_peak_used_rate")
    )
    summary = {
        "available": True,
        "llm_calls": usage.get("llm_calls", 0),
        "prompt_tokens": usage.get("prompt_tokens", 0),
        "completion_tokens": usage.get("completion_tokens", 0),
        "total_tokens": usage.get("total_tokens", 0),
        "cached_prompt_tokens": usage.get("cached_prompt_tokens", 0),
        "cache_read_tokens": usage.get("cache_read_tokens", 0),
        "cache_creation_tokens": usage.get("cache_creation_tokens", 0),
        "cache_hit_rate": cache_hit_rate,
        "cache_hit_percent": _percent(cache_hit_rate),
    }
    for key in (
        "cumulative_tokens",
        "latest_call_tokens",
        "latest_call_context",
        "context_peak",
    ):
        if isinstance(usage.get(key), dict):
            summary[key] = usage.get(key)
    for key in (
        "estimated_input_tokens",
        "active_input_tokens",
        "active_input_tokens_source",
        "context_limit_tokens",
        "context_limit_source",
        "context_remaining_tokens",
        "context_usage_scope",
        "context_peak_active_input_tokens",
        "context_peak_active_input_tokens_source",
        "context_peak_limit_tokens",
        "context_peak_limit_source",
        "context_peak_remaining_tokens",
        "context_peak_model",
        "context_peak_usage_scope",
    ):
        if usage.get(key) is not None:
            summary[key] = usage.get(key)
    if context_used_rate is not None:
        summary["context_used_rate"] = context_used_rate
        summary["context_used_percent"] = _percent(context_used_rate)
    if context_available_rate is not None:
        summary["context_available_rate"] = context_available_rate
        summary["context_available_percent"] = _percent(context_available_rate)
    if context_peak_used_rate is not None:
        summary["context_peak_used_rate"] = context_peak_used_rate
        summary["context_peak_used_percent"] = _percent(context_peak_used_rate)
    if context_peak_available_rate is not None:
        summary["context_peak_available_rate"] = context_peak_available_rate
        summary["context_peak_available_percent"] = _percent(context_peak_available_rate)
    return summary
