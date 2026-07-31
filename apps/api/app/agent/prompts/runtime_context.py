"""Factory prompt section with the small cache-friendly runtime summary."""
from __future__ import annotations

import json

NAME = "runtime_context"
TRIGGER = "factory"
ORDER = 900


def _project_title(state: dict) -> str:
    metadata = state.get("metadata")
    if not isinstance(metadata, dict):
        return "未命名项目"
    title = " ".join(str(metadata.get("title") or "").split())[:120]
    return title or "未命名项目"


def build(
    state: dict,
    model_configs: list[dict] | None = None,
    user_facts: list[dict] | None = None,
    project_facts: list[dict] | None = None,
    latest_user_message: str = "",
    **_: object,
) -> str:
    parts = [
        "## 运行时上下文",
        f"项目标题:{json.dumps(_project_title(state), ensure_ascii=False)}",
    ]

    loaded_skills = state.get("_skills_loaded")
    if isinstance(loaded_skills, dict) and loaded_skills:
        cached_skills = [
            {
                "skill": skill,
                "tool": payload.get("tool"),
                "detail": payload.get("detail"),
                "guidance_hash": payload.get("guidance_hash"),
                "guidance_chars": payload.get("guidance_chars"),
            }
            for skill, payload in sorted(loaded_skills.items())
            if isinstance(payload, dict)
        ]
        if cached_skills:
            limit = 8
            skill_payload: dict[str, object] = {
                "available_count": len(cached_skills),
                "items": cached_skills[:limit],
                "reuse_policy": "仅提示已读 skill；需要流程细节时重新调用对应 skill。",
            }
            if len(cached_skills) > limit:
                skill_payload["omitted_count"] = len(cached_skills) - limit
            parts.append("\n### Skill 复用提醒\n" + json.dumps(skill_payload, ensure_ascii=False))

    return "\n".join(parts)
