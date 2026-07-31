"""MCP-style project tools."""

from __future__ import annotations

from typing import Any

from sqlalchemy import func
from sqlmodel import select

from app.db.models import WorkflowEdge, WorkflowNode
from app.db.session import session_scope
from app.services.project_service import ProjectService


async def project_get_state(project_id: str) -> dict[str, Any]:
    async with session_scope() as session:
        svc = ProjectService(session)
        state = await svc.get_project_state(project_id)
        if state is None:
            return {"error": f"Project {project_id} not found"}
        result = _project_state_for_status_display(state)
        result["workflow"] = await _load_canvas_state_summary(session, project_id)
        result["agent_token_usage_summary"] = _agent_token_usage_summary(state)
        result.pop("agent_token_usage", None)
        return result


def _project_state_for_status_display(state: dict[str, Any]) -> dict[str, Any]:
    """Return a detached state mapping for project/status queries."""
    result = dict(state)
    memory = result.pop("memory", None)
    if isinstance(memory, dict):
        facts = memory.get("facts") if isinstance(memory.get("facts"), list) else []
        result["memory_summary"] = {
            "fact_count": len(facts),
            "pinned_count": sum(
                1 for fact in facts if isinstance(fact, dict) and fact.get("pinned")
            ),
            "detail_tool": "memory.recall",
        }

    active = result.get("active_workflow")
    if isinstance(active, dict):
        workflow = active.get("workflow") if isinstance(active.get("workflow"), dict) else {}
        result["active_workflow"] = {
            key: active.get(key)
            for key in (
                "kind",
                "template_id",
                "workflow_id",
                "artifact_ref",
                "name",
                "description",
                "updated_at",
            )
            if active.get(key) not in (None, "", [], {})
        }
        if workflow:
            result["active_workflow"].setdefault("workflow_id", workflow.get("id"))
            result["active_workflow"]["step_count"] = len(workflow.get("steps") or [])
        result["active_workflow"]["detail_tool"] = "workflow.runtime_status"

    runtime = result.pop("workflow_runtime", None)
    if isinstance(runtime, dict):
        instances = runtime.get("instances") if isinstance(runtime.get("instances"), dict) else {}
        statuses: dict[str, int] = {}
        for instance in instances.values():
            if not isinstance(instance, dict):
                continue
            status = str(instance.get("status") or "unknown")
            statuses[status] = statuses.get(status, 0) + 1
        result["workflow_runtime_summary"] = {
            "instance_count": len(instances),
            "by_status": statuses,
            "updated_at": runtime.get("updated_at") or "",
            "detail_tool": "workflow.runtime_status",
        }

    input_values = result.pop("workflow_input_values", None)
    if isinstance(input_values, dict):
        by_workflow = input_values.get("by_workflow")
        by_instance = input_values.get("by_instance")
        result["workflow_input_values_summary"] = {
            "workflow_count": len(by_workflow) if isinstance(by_workflow, dict) else 0,
            "instance_count": len(by_instance) if isinstance(by_instance, dict) else 0,
            "updated_at": input_values.get("updated_at") or "",
            "detail_tool": "workflow.runtime_status",
        }

    director_desk = result.pop("director_desk", None)
    if isinstance(director_desk, dict):
        captures = director_desk.get("captures")
        model_assets = director_desk.get("model_assets")
        result["director_desk_summary"] = {
            "version": director_desk.get("version"),
            "revision": director_desk.get("revision"),
            "capture_count": len(captures) if isinstance(captures, list) else 0,
            "model_asset_count": len(model_assets) if isinstance(model_assets, list) else 0,
            "managed_by": "director_desk_ui",
        }

    for legacy_key in (
        "episodes",
        "characters",
        "scenes",
        "segments",
        "shots",
        "relationships",
        "assets",
        "locked_fields",
    ):
        legacy_value = result.pop(legacy_key, None)
        if isinstance(legacy_value, (list, dict)) and legacy_value:
            result[f"{legacy_key}_summary"] = {
                "count": len(legacy_value),
                "detail_tool": "assets.list_project" if legacy_key == "assets" else "node.list",
            }
    for legacy_key in ("story_bible", "outline"):
        legacy_value = result.pop(legacy_key, None)
        if isinstance(legacy_value, (list, dict)) and legacy_value:
            result[f"{legacy_key}_summary"] = {
                "entries": len(legacy_value),
                "detail_tool": "node.list",
            }
    return result


async def _load_canvas_state_summary(session: Any, project_id: str) -> dict[str, Any]:
    grouped = await session.exec(
        select(WorkflowNode.type, WorkflowNode.status, func.count(WorkflowNode.id))
        .where(WorkflowNode.project_id == project_id)
        .group_by(WorkflowNode.type, WorkflowNode.status)
    )
    edge_result = await session.exec(
        select(func.count(WorkflowEdge.id)).where(WorkflowEdge.project_id == project_id)
    )
    by_type: dict[str, int] = {}
    by_status: dict[str, int] = {}
    node_count = 0
    for node_type_value, status_value, count_value in grouped.all():
        node_type = str(node_type_value or "unknown")
        status = str(status_value or "unknown")
        count = int(count_value or 0)
        node_count += count
        by_type[node_type] = by_type.get(node_type, 0) + count
        by_status[status] = by_status.get(status, 0) + count
    return {
        "node_count": node_count,
        "edge_count": int(edge_result.one() or 0),
        "by_type": by_type,
        "by_status": by_status,
        "detail_tool": "node.list",
        "hint": "Use node.list for a bounded node index page and node.get for selected details.",
    }


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
