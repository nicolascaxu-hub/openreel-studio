import json

import pytest
from pydantic import ValidationError

from app.api.chat_events import event_to_sse, normalize_chat_event, validate_chat_event
from app.api.routes_chat import _to_sse


def test_proposed_plan_event_is_typed() -> None:
    event = normalize_chat_event(
        {
            "type": "proposed_plan",
            "project_id": "project-1",
            "plan": {"id": "plan-1", "sections": [{"type": "markdown", "content": "检查节点"}]},
        }
    )

    assert event == {
        "type": "proposed_plan",
        "project_id": "project-1",
        "plan": {"id": "plan-1", "sections": [{"type": "markdown", "content": "检查节点"}]},
    }


def test_proposed_plan_rejects_missing_plan() -> None:
    with pytest.raises(ValidationError):
        validate_chat_event(
            {
                "type": "proposed_plan",
                "project_id": "project-1",
            }
        )


def test_unknown_chat_event_remains_compatible() -> None:
    event = normalize_chat_event({"type": "custom_event", "value": 1})

    assert event == {"type": "custom_event", "value": 1}


def test_project_and_store_events_are_typed() -> None:
    assert normalize_chat_event({"type": "subscribed", "project_id": "project-1"}) == {
        "type": "subscribed",
        "project_id": "project-1",
    }
    assert normalize_chat_event({"type": "merged_messages", "count": 2}) == {
        "type": "merged_messages",
        "count": 2,
    }
    assert normalize_chat_event({"type": "queued", "queued_count": 1, "error": "busy"}) == {
        "type": "queued",
        "queued_count": 1,
        "error": "busy",
    }
    assert normalize_chat_event({
        "type": "queued_turn_started",
        "client_user_message_id": "client-1",
        "message": "补充一句",
        "queued_remaining": 0,
    }) == {
        "type": "queued_turn_started",
        "client_user_message_id": "client-1",
        "message": "补充一句",
        "queued_remaining": 0,
    }
    assert normalize_chat_event(
        {
            "type": "project_reset",
            "project_id": "project-1",
            "scope": "full",
            "title": "未命名项目",
            "cleared_all": True,
            "message": "已重置",
        }
    ) == {
        "type": "project_reset",
        "project_id": "project-1",
        "scope": "full",
        "title": "未命名项目",
        "cleared_all": True,
        "message": "已重置",
    }
    assert normalize_chat_event(
        {
            "type": "doctor_result",
            "ok": True,
            "project_id": "project-1",
            "feature_flags": {"total": 2, "enabled": 1},
        }
    ) == {
        "type": "doctor_result",
        "ok": True,
        "project_id": "project-1",
        "feature_flags": {"total": 2, "enabled": 1},
    }


def test_token_usage_event_is_typed() -> None:
    event = normalize_chat_event(
        {
            "type": "token_usage",
            "project_id": "project-1",
            "run_id": "run-1",
            "round": 2,
            "phase": "agent_loop",
            "usage": {
                "prompt_tokens": 100,
                "completion_tokens": 20,
                "total_tokens": 120,
                "cached_prompt_tokens": 25,
                "cache_hit_rate": 0.25,
                "latest_call_tokens": {"total_tokens": 120},
                "latest_call_context": {"context_remaining_tokens": 90_000},
            },
            "run_totals": {"total_tokens": 120, "llm_calls": 1},
            "session_totals": {"total_tokens": 240, "llm_calls": 2},
            "latest_call_tokens": {"total_tokens": 120},
            "latest_call_context": {"context_remaining_tokens": 90_000},
            "run_cumulative_tokens": {"total_tokens": 120, "llm_calls": 1},
            "session_cumulative_tokens": {"total_tokens": 240, "llm_calls": 2},
            "run_context_peak": {"context_remaining_tokens": 90_000},
            "session_context_peak": {"context_remaining_tokens": 80_000},
        }
    )

    assert event == {
        "type": "token_usage",
        "project_id": "project-1",
        "run_id": "run-1",
        "round": 2,
        "phase": "agent_loop",
        "usage": {
            "prompt_tokens": 100,
            "completion_tokens": 20,
            "total_tokens": 120,
            "cached_prompt_tokens": 25,
            "cache_hit_rate": 0.25,
            "latest_call_tokens": {"total_tokens": 120},
            "latest_call_context": {"context_remaining_tokens": 90_000},
        },
        "run_totals": {"total_tokens": 120, "llm_calls": 1},
        "session_totals": {"total_tokens": 240, "llm_calls": 2},
        "latest_call_tokens": {"total_tokens": 120},
        "latest_call_context": {"context_remaining_tokens": 90_000},
        "run_cumulative_tokens": {"total_tokens": 120, "llm_calls": 1},
        "session_cumulative_tokens": {"total_tokens": 240, "llm_calls": 2},
        "run_context_peak": {"context_remaining_tokens": 90_000},
        "session_context_peak": {"context_remaining_tokens": 80_000},
    }


def test_subagent_round_event_is_typed() -> None:
    event = normalize_chat_event(
        {
            "type": "subagent_round",
            "agent": "image_editor",
            "step": 2,
            "content": "正在查看裁剪候选图。",
            "tool": "vision.view_image",
            "status": "running",
            "source": "model",
        }
    )

    assert event == {
        "type": "subagent_round",
        "agent": "image_editor",
        "step": 2,
        "content": "正在查看裁剪候选图。",
        "tool": "vision.view_image",
        "status": "running",
        "source": "model",
    }


def test_tool_done_event_keeps_tool_output_envelope() -> None:
    event = normalize_chat_event(
        {
            "type": "tool_done",
            "tool": "node.run",
            "round": 1,
            "result": {"ok": True, "node_id": "node-1"},
            "tool_output": {
                "version": "tool_output_v2",
                "success": True,
                "outcome": "success",
                "handler_ok": True,
                "summary": {"ok": True},
                "compacted": False,
                "artifact_ref": None,
                "raw_result_tokens": 8,
                "model_visible_tokens": 8,
            },
        }
    )

    assert event["tool_output"]["version"] == "tool_output_v2"
    assert event["tool_output"]["compacted"] is False
    assert event["result"]["node_id"] == "node-1"


def test_interaction_input_event_preserves_structured_payload() -> None:
    event = normalize_chat_event(
        {
            "type": "interaction_input_requested",
            "project_id": "project-1",
            "status": "awaiting_user",
            "summary_text": "请补充视频主题、风格和类型。",
            "intake": {
                "purpose": "video_intake",
                "stage": "basic",
                "title": "补充视频基础信息",
                "questions": [
                    {
                        "id": "topic",
                        "header": "主题",
                        "question": "视频主题或核心事件？",
                        "options": [
                            {"label": "模型发挥", "description": "由模型规划"},
                            {"label": "沿用当前描述", "description": "使用本轮描述"},
                        ],
                    }
                ],
            },
        }
    )

    assert event["type"] == "interaction_input_requested"
    assert event["intake"]["purpose"] == "video_intake"
    assert event["intake"]["stage"] == "basic"
    assert "presentation" not in event["intake"]
    assert event["intake"]["questions"][0]["id"] == "topic"


def test_event_to_sse_serializes_normalized_json() -> None:
    chunk = event_to_sse({"type": "text_delta", "content": "你好"})

    assert chunk.startswith("data: ")
    assert chunk.endswith("\n\n")
    payload = json.loads(chunk.removeprefix("data: ").strip())
    assert payload == {"type": "text_delta", "content": "你好"}


@pytest.mark.asyncio
async def test_to_sse_converts_contract_errors_to_error_event() -> None:
    async def source():
        yield {
            "type": "proposed_plan",
            "project_id": "project-1",
        }

    chunks = [chunk async for chunk in _to_sse(source())]
    payload = json.loads(chunks[0].removeprefix("data: ").strip())

    assert payload["type"] == "error"
    assert "SSE event contract error: proposed_plan" in payload["message"]


@pytest.mark.asyncio
async def test_to_sse_splits_large_text_delta(monkeypatch) -> None:
    monkeypatch.setattr("app.api.routes_chat.SSE_TEXT_DELTA_DELAY_SECONDS", 0)
    content = "x" * 180

    async def source():
        yield {"type": "text_delta", "content": content}

    chunks = [chunk async for chunk in _to_sse(source())]
    payloads = [json.loads(chunk.removeprefix("data: ").strip()) for chunk in chunks]

    assert len(payloads) > 1
    assert all(payload["type"] == "text_delta" for payload in payloads)
    assert all(len(payload["content"]) <= 56 for payload in payloads)
    assert "".join(payload["content"] for payload in payloads) == content


@pytest.mark.asyncio
async def test_to_sse_mirrors_sanitized_event_summaries(monkeypatch) -> None:
    emitted = []

    class FakeEventStream:
        def emit(self, event_type: str, **kwargs):
            emitted.append((event_type, kwargs))
            return {"type": event_type, **kwargs}

    monkeypatch.setattr("app.api.routes_chat.event_stream", FakeEventStream())

    async def source():
        yield {"type": "text_delta", "content": "不要把这段正文写入生命周期事件"}
        yield {
            "type": "tool_done",
            "tool": "node.run",
            "round": 1,
            "result": {"large": "SECRET_RESULT_BODY"},
        }

    chunks = [
        chunk
        async for chunk in _to_sse(source(), project_id="project-1", stream_kind="chat")
    ]

    assert len(chunks) == 2
    mirrors = [kwargs for event_type, kwargs in emitted if event_type == "sse_event"]
    assert len(mirrors) == 2
    first = mirrors[0]["data"]
    assert first["protocol"] == "chat_sse"
    assert first["protocol_reason"] == "normalized SSE event emitted to frontend"
    assert first["stream_kind"] == "chat"
    assert first["type"] == "text_delta"
    assert first["content_len"] == len("不要把这段正文写入生命周期事件")
    assert "content" not in first
    second = mirrors[1]["data"]
    assert second == {
        "protocol": "chat_sse",
        "protocol_reason": "normalized SSE event emitted to frontend",
        "stream_kind": "chat",
        "type": "tool_done",
        "round": 1,
        "tool": "node.run",
    }
    assert "SECRET_RESULT_BODY" not in json.dumps(mirrors, ensure_ascii=False)
