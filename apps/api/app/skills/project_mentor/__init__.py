"""skill.project_mentor - project-specific mentor and docs navigator."""
from __future__ import annotations

from app.mcp_tools.registry import register


_REFERENCES = {
    "overview": [
        "README.md",
        "README.en.md",
        "docs/README.md",
        "docs/README.en.md",
        "apps/api/README.md",
        "apps/api/app/skills/video_production/SKILL.md",
    ],
    "agent_loop": [
        "apps/api/app/agent/orchestrator.py",
        "apps/api/app/agent/lifecycle_hooks.py",
        "apps/api/app/agent/reset_flow.py",
        "apps/api/app/agent/trace_store.py",
        "apps/api/app/agent/video_mode.py",
        "apps/api/app/mcp_tools/registry.py",
    ],
    "production_audit_guide": [
        "apps/api/app/skills/video_production/SKILL.md",
        "apps/api/app/mcp_tools/agent_tools.py",
        "apps/api/app/mcp_tools/node_universal.py",
        "apps/api/app/api/routes_agent_debug.py",
    ],
    "node_repair_guide": [
        "apps/api/app/skills/video_production/SKILL.md",
        "apps/api/app/mcp_tools/node_universal.py",
        "apps/api/app/agent/permission_policy.py",
    ],
    "slash_commands": [
        "apps/api/app/agent/slash_commands.py",
        "apps/api/app/api/routes_chat.py",
    ],
    "debugging": [
        "apps/api/app/agent/trace_store.py",
        "apps/api/app/agent/context_compact.py",
        "apps/api/app/api/routes_agent_debug.py",
    ],
    "prompt_compaction": [
        "apps/api/app/agent/prompt_assembler.py",
        "apps/api/app/agent/prompts/",
        "apps/api/app/agent/context_compact.py",
        "apps/api/app/agent/permission_policy.py",
        "apps/api/app/agent/collaboration_mode.py",
        "apps/api/app/mcp_tools/node_universal.py",
    ],
}

_GUIDANCE = {
    "overview": (
        "OpenReel Studio is a monorepo with a Next.js web app, FastAPI API, "
        "SQLite state, SSE chat streams, and a single visible canvas of workflow "
        "nodes. Start from README.md or README.en.md, then use the matching "
        "docs/README language index and skill files for setup and production rules."
    ),
    "agent_loop": (
        "Keep the Agent loop small. Core production tools are project.get_state, "
        "interaction.request_input, skill.search and skill.get, task.create/list/"
        "update/complete, agent.review, node.list/get/create/update/run, canvas.delete, "
        "and tool.search/describe/execute for deferred capabilities. Natural-language "
        "tasks enter the Agent loop; backend preprocessing may clean input and "
        "stale state but must not decide business actions for the model."
    ),
    "production_audit_guide": (
        "Before declaring work done, read node statuses and outputs, check failed/"
        "pending/running nodes, verify references resolve, confirm generated media "
        "URLs/files exist, and make sure the final answer names only completed or "
        "explicitly blocked work. Use trace/tool result files when behavior is unclear."
    ),
    "node_repair_guide": (
        "Repair the original node first. Read node.get and nearby node.list. For "
        "dependency_missing, missing prompt, missing reference images, or empty "
        "upstream output, fix or run upstream nodes before retrying the target. "
        "Patch local fields with node.update; rerun with node.run. Do not delete "
        "and recreate unless the latest user message asks for replacement."
    ),
    "slash_commands": (
        "Slash commands are deterministic control-plane operations handled before "
        "LLM routing: mode, plan, reset, and doctor."
    ),
    "debugging": (
        "Use SSE events, persisted message metadata, queryable agent trace events, "
        "tool result files, node status summaries, and artifacts before changing prompts."
    ),
    "prompt_compaction": (
        "Keep prompt sections as short constraint indexes. Move examples and "
        "maintenance guidance to skills, validators, tests, or README-facing docs, "
        "and enforce stable behavior with backend state, permission policy, validators, and tests."
    ),
}

@register(
    "skill.project_mentor",
    description="Official OpenReel project mentor for architecture, debugging, repair, and delivery audit",
    tags=["project", "mentor", "debugging", "repair", "guide"],
    metadata={"source": "skill"},
    search_hint=(
        "project architecture agent loop node-first permission trace debugging prompt compaction "
        "production audit node repair failed node rerun dependency_missing "
        "项目架构 Agent循环 制作审查 失败节点 原地修复 节点修复 重跑 排障"
    ),
    usage_hints=[
        "Use topic='production_audit_guide' before final delivery or when checking video production consistency.",
        "Use topic='node_repair_guide' before complex failed-node repair or rerun recovery.",
        "Use topic='debugging' when trace or agent behavior is unclear.",
        "Use topic='prompt_compaction' for prompt cache and fixed-prefix maintenance.",
    ],
)
async def project_mentor(topic: str = "overview") -> dict:
    key = (topic or "overview").strip().lower()
    if key not in _GUIDANCE:
        key = "overview"
    return {
        "topic": key,
        "guidance": _GUIDANCE[key],
        "references_count": len(_REFERENCES[key]),
        "reference_policy": "源码参考仅用于诊断计数；当前 guidance 已包含可执行规则，不要把源码路径当作 file.read_text 目标。",
        "available_topics": sorted(_GUIDANCE),
    }
