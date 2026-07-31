import hashlib
from pathlib import Path

import pytest

from app.agent.permission_policy import ToolPermissionContext, decide_tool_permission
from app.mcp_tools import file_tools, tool_meta_tools
from app.mcp_tools.registry import registry


@pytest.mark.asyncio
async def test_workspace_file_tools_cover_read_search_write_patch_delete(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setattr(file_tools.settings, "PROJECT_ROOT", str(tmp_path))
    source = tmp_path / "apps" / "api" / "example.py"
    source.parent.mkdir(parents=True)
    source.write_text("class AgentOrchestrator:\n    pass\n", encoding="utf-8")

    listed = await file_tools.workspace_list(path="apps", recursive=True)
    assert listed["ok"] is True
    assert {entry["path"] for entry in listed["entries"]} >= {"apps/api", "apps/api/example.py"}

    found = await file_tools.workspace_search(query="AgentOrchestrator", glob="*.py")
    assert found["ok"] is True
    assert len(found["matches"]) == 1
    assert found["matches"][0]["path"] == "apps/api/example.py"
    assert found["matches"][0]["match_type"] == "content"
    assert found["matches"][0]["line_number"] == 1
    assert found["matches"][0]["preview"] == "class AgentOrchestrator:"
    assert found["matches"][0]["match"]["mode"] == "query"

    regex_found = await file_tools.workspace_search(regex=r"Agent.*chestrator", glob="*.py")
    assert regex_found["ok"] is True
    assert regex_found["matches"][0]["path"] == "apps/api/example.py"
    assert regex_found["matches"][0]["match"]["matched_patterns"] == [r"Agent.*chestrator"]

    read = await file_tools.workspace_read(path="apps/api/example.py", offset=0, limit=24)
    assert read["ok"] is True
    assert read["content_page"]["content"] == "class AgentOrchestrator:"

    written = await file_tools.workspace_write(path="tmp/notes.txt", content="old value\n")
    assert written["ok"] is True
    assert (tmp_path / "tmp" / "notes.txt").read_text(encoding="utf-8") == "old value\n"

    patched = await file_tools.workspace_patch(
        path="tmp/notes.txt",
        old_text="old",
        new_text="new",
    )
    assert patched["ok"] is True
    assert (tmp_path / "tmp" / "notes.txt").read_text(encoding="utf-8") == "new value\n"

    deleted = await file_tools.workspace_delete(path="tmp/notes.txt")
    assert deleted == {"ok": True, "path": "tmp/notes.txt", "deleted": True, "recursive": False}
    assert not (tmp_path / "tmp" / "notes.txt").exists()


@pytest.mark.asyncio
async def test_workspace_read_pages_large_text_by_exact_character_offset(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setattr(file_tools.settings, "PROJECT_ROOT", str(tmp_path))
    source = tmp_path / "large.txt"
    source.write_text("\n".join(f"line-{idx}" for idx in range(1, 306)), encoding="utf-8")

    first = await file_tools.workspace_read(path="large.txt", limit=37)

    assert first["ok"] is True
    first_page = first["content_page"]
    assert first_page["offset"] == 0
    assert first_page["returned_chars"] == 37
    assert first_page["total_chars"] > 37
    assert first_page["next_offset"] == 37
    assert first_page["content"].startswith("line-1\n")

    second = await file_tools.workspace_read(path="large.txt", offset=first_page["next_offset"], limit=19)

    assert second["ok"] is True
    second_page = second["content_page"]
    full_text = source.read_text(encoding="utf-8")
    assert second_page["content"] == full_text[37:56]
    assert second_page["offset"] == 37
    assert second_page["next_offset"] == 56


def test_text_content_window_uses_bounded_character_pages() -> None:
    content = "甲" * 40_000

    first = file_tools.text_content_window(content)
    second = file_tools.text_content_window(
        content,
        offset=first["next_offset"],
        limit=1_200,
    )
    metadata_only = file_tools.text_content_window(content, limit=0)
    clamped = file_tools.text_content_window(content, limit=100_000)

    assert first == {
        "content": "甲" * 8_000,
        "revision": hashlib.sha256(content.encode("utf-8")).hexdigest()[:16],
        "offset": 0,
        "limit": 8_000,
        "returned_chars": 8_000,
        "total_chars": 40_000,
        "truncated": True,
        "next_offset": 8_000,
        "available": True,
        "included": True,
        "budget_exhausted": False,
        "hint": "Continue with content_offset=next_offset and content_limit when more content is needed.",
    }
    assert second["content"] == "甲" * 1_200
    assert second["offset"] == 8_000
    assert second["next_offset"] == 9_200
    assert metadata_only["content"] == ""
    assert metadata_only["next_offset"] == 0
    assert metadata_only["budget_exhausted"] is True
    assert clamped["limit"] == 8_000
    assert clamped["returned_chars"] == 8_000


@pytest.mark.asyncio
async def test_project_read_text_pages_uploaded_large_file(monkeypatch, tmp_path: Path) -> None:
    storage = tmp_path / "storage"
    monkeypatch.setattr(file_tools.settings, "STORAGE_DIR", str(storage))
    uploaded = storage / "project-1" / "uploads" / "script.txt"
    uploaded.parent.mkdir(parents=True)
    uploaded.write_text("\n".join(f"scene-{idx}" for idx in range(1, 8)), encoding="utf-8")

    page = await file_tools.read_text(project_id="project-1", rel_path="uploads/script.txt", offset=2, limit=13)

    assert page["ok"] is True
    assert page["path"] == "uploads/script.txt"
    expected = uploaded.read_text(encoding="utf-8")
    assert page["content_page"]["content"] == expected[2:15]
    assert page["content_page"]["total_chars"] == len(expected)
    assert page["content_page"]["offset"] == 2
    assert page["content_page"]["next_offset"] == 15


@pytest.mark.asyncio
async def test_extract_text_from_upload_supports_paged_text(monkeypatch, tmp_path: Path) -> None:
    storage = tmp_path / "storage"
    monkeypatch.setattr(file_tools.settings, "STORAGE_DIR", str(storage))
    uploaded = storage / "project-1" / "uploads" / "notes.md"
    uploaded.parent.mkdir(parents=True)
    uploaded.write_text("\n".join(f"note-{idx}" for idx in range(1, 6)), encoding="utf-8")

    extracted = await file_tools.extract_text_from_upload(
        project_id="project-1",
        rel_path="uploads/notes.md",
        offset=3,
        limit=12,
    )

    assert extracted["ok"] is True
    expected = uploaded.read_text(encoding="utf-8")
    assert extracted["content_page"]["content"] == expected[3:15]
    assert extracted["content_page"]["offset"] == 3
    assert extracted["content_page"]["next_offset"] == 15


@pytest.mark.asyncio
async def test_workspace_file_tools_reject_escape_and_git_mutation(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setattr(file_tools.settings, "PROJECT_ROOT", str(tmp_path))

    escaped = await file_tools.workspace_read(path="../outside.txt")
    assert escaped["ok"] is False
    assert escaped["error_kind"] == "workspace_path_denied"

    git_write = await file_tools.workspace_write(path=".git/config", content="[core]\n")
    assert git_write["ok"] is False
    assert git_write["error_kind"] == "workspace_path_denied"

    root_delete = await file_tools.workspace_delete(path=".")
    assert root_delete["ok"] is False
    assert root_delete["error_kind"] == "workspace_path_denied"


@pytest.mark.asyncio
async def test_workspace_file_tools_are_deferred_and_discoverable() -> None:
    visible = registry.core_agent_tool_names()
    workspace_tools = {
        "file.workspace_delete",
        "file.workspace_list",
        "file.workspace_patch",
        "file.workspace_read",
        "file.workspace_search",
        "file.workspace_write",
    }

    assert not workspace_tools & visible
    for name in workspace_tools:
        spec = registry.get(name)
        assert spec is not None, name
        assert registry.tool_exposure(name) == "deferred", name

    result = await tool_meta_tools.tool_search(query="workspace write file", category="file", limit=12)
    names = {item["name"] for item in result["tools"]}
    assert workspace_tools <= names


def test_workspace_file_tools_follow_deferred_file_permission_boundary() -> None:
    direct = decide_tool_permission(ToolPermissionContext(
        tool_name="file.workspace_write",
        state={},
        user_message="写一个文件",
        tool_args={"path": "tmp/notes.txt", "content": "hello"},
    ))
    via_deferred = decide_tool_permission(ToolPermissionContext(
        tool_name="file.workspace_write",
        state={},
        user_message="写一个文件",
        tool_args={"path": "tmp/notes.txt", "content": "hello"},
        via_tool_execute=True,
    ))

    assert direct.allowed is False
    assert direct.result and direct.result["error_kind"] == "deferred_tool_must_use_tool_execute"
    assert via_deferred.allowed is True
