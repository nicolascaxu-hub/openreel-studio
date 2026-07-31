"""Runtime config helpers — runtime.jsonc 文件即真相源。

Agent-facing registry only keeps read/validate helpers. Writes go through
REST/control-plane paths that call these Python helpers directly.
"""
from __future__ import annotations

import json
from typing import Any

from app.config_store import get_store
from app.mcp_tools.file_tools import text_content_window


async def config_read(*, mask_secrets: bool = True) -> dict[str, Any]:
    """读取当前 runtime 配置（结构化）。

    默认 mask api_key（Agent 视角）。UI 拉密文要显式传 mask_secrets=False。
    返回: {$schema_version, llm_providers, media_providers, model_tier_defaults, model_assignments, app_settings}
    """
    store = get_store()
    return await store.read(mask_secrets=mask_secrets)


async def config_read_for_agent() -> dict[str, Any]:
    """Return the structured runtime config with secrets unconditionally masked."""

    return await config_read(mask_secrets=True)


async def config_read_file(*, mask_secrets: bool = True) -> dict[str, Any]:
    """返回原始 JSONC 文本 + 解析后结构 + 校验状态。

    UI 的"原始文件"Tab 用这个一次拉到所有需要的视图。
    """
    store = get_store()
    raw = await store.get_raw_text()
    parsed = await store.read(mask_secrets=mask_secrets)
    ok, errors = await store.validate_text(raw)
    return {
        "raw_text": raw,
        "parsed": parsed,
        "valid": ok,
        "errors": errors,
        "file_path": str(store.file_path),
    }


async def config_read_file_for_agent(
    *,
    content_offset: int = 0,
    content_limit: int | None = None,
) -> dict[str, Any]:
    """Return one masked config page while the REST control plane keeps its full view."""

    store = get_store()
    raw = await store.get_raw_text()
    masked = await store.read(mask_secrets=True)
    rendered = json.dumps(masked, ensure_ascii=False, indent=2)
    ok, errors = await store.validate_text(raw)
    page = text_content_window(rendered, offset=content_offset, limit=content_limit)
    page["source"] = "runtime.masked.json"
    return {
        "ok": True,
        "raw_text_page": page,
        "valid": ok,
        "errors": errors,
        "file_name": store.file_path.name,
        "mask_secrets": True,
        "hint": "Use config.read for the masked structured view; continue raw text with raw_text_page.next_offset.",
    }


async def config_validate(content: str) -> dict[str, Any]:
    """干跑校验，不写入。用于"应用前预览错误"场景。"""
    store = get_store()
    ok, errors = await store.validate_text(content)
    return {"ok": ok, "errors": errors}


async def config_write_file(content: str) -> dict[str, Any]:
    """整段覆盖写入文件（UI 原始编辑器 / 命令行手改场景）。

    流程: parse → schema 校验 → 临时文件 → 原子 replace → 同步 DB → 更新缓存。
    校验失败时文件和 DB 都不动。
    """
    store = get_store()
    ok, errors = await store.write_raw_text(content)
    return {
        "ok": ok,
        "errors": errors,
        "config": (await store.read(mask_secrets=True)) if ok else None,
    }


async def config_patch(patch: dict) -> dict[str, Any]:
    """局部更新当前配置（推荐 Agent / 表单按钮用）。

    语义: deep merge — dict 递归合并，list/标量整体替换，None 表示删除该键。

    REST patch body 示例:
        # 加一个 LLM provider（注意 list 是整体替换，要带上现有所有项）
        {"patch": {"llm_providers": [...完整新数组...]}}

        # 改某个 task 的 provider 引用
        {"patch": {"model_assignments": {"text_generation": "gpt-4o-aihubmix"}}}

        # 改 Agent 偏好
        {"patch": {"app_settings": {"agent.max_iterations": 120}}}

    校验失败返回 {"ok": false, "errors": [...]}; 文件和 DB 不动。
    """
    store = get_store()
    ok, errors = await store.patch(patch)
    return {
        "ok": ok,
        "errors": errors,
        "config": (await store.read(mask_secrets=True)) if ok else None,
    }


async def config_reload() -> dict[str, Any]:
    """强制从文件重读（用户在 IDE 改完手动触发的场景）。"""
    store = get_store()
    ok, errors = await store.reload()
    return {"ok": ok, "errors": errors}
