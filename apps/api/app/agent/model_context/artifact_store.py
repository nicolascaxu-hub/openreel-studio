"""Project-scoped diagnostic storage for large tool results."""
from __future__ import annotations

import json
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any


MAX_TOOL_RESULT_FILES_PER_RUN = 100
MAX_TOOL_RESULT_BYTES_PER_RUN = 50 * 1024 * 1024


def tool_results_dir() -> Path:
    from app.config import settings

    path = Path(settings.PROJECT_ROOT) / "data" / "tool_results"
    path.mkdir(parents=True, exist_ok=True)
    return path


def _safe_component(value: str, fallback: str) -> str:
    return "".join(ch if ch.isalnum() or ch in "-_." else "_" for ch in value or fallback)


@dataclass(frozen=True)
class ToolResultArtifact:
    ref: str
    path: Path
    original_bytes: int


def save_tool_result(
    value: Any,
    *,
    project_id: str,
    run_id: str,
    iteration: int,
    tool_name: str,
) -> ToolResultArtifact:
    safe_project = _safe_component(project_id, "project")
    safe_run = _safe_component(run_id, "run")
    safe_tool = _safe_component(tool_name, "tool")
    out_dir = tool_results_dir() / safe_project / safe_run
    out_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{int(time.time() * 1000)}_iter{iteration}_{safe_tool}.json"
    path = out_dir / filename
    rendered = json.dumps(value, ensure_ascii=False, default=str, indent=2)
    path.write_text(rendered, encoding="utf-8")
    _prune_run_artifacts(out_dir, keep=path)
    return ToolResultArtifact(
        ref=f"tool-result:{safe_run}/{filename}",
        path=path,
        original_bytes=len(rendered.encode("utf-8")),
    )


def _prune_run_artifacts(run_dir: Path, *, keep: Path) -> None:
    files = sorted(
        (path for path in run_dir.glob("*.json") if path.is_file()),
        key=lambda path: (path != keep, -path.stat().st_mtime_ns),
    )
    retained_count = 0
    retained_bytes = 0
    for candidate in files:
        size = candidate.stat().st_size
        fits = (
            retained_count < MAX_TOOL_RESULT_FILES_PER_RUN
            and retained_bytes + size <= MAX_TOOL_RESULT_BYTES_PER_RUN
        )
        if candidate == keep or fits:
            retained_count += 1
            retained_bytes += size
            continue
        try:
            candidate.unlink()
        except OSError:
            continue


def list_run_tool_result_artifacts(
    *,
    project_id: str,
    run_id: str,
    limit: int = 20,
) -> list[dict[str, Any]]:
    safe_project = _safe_component(project_id, "project")
    safe_run = _safe_component(run_id, "run")
    project_dir = tool_results_dir() / safe_project
    run_dir = project_dir / safe_run
    if not run_dir.exists():
        return []
    files = sorted(
        (path for path in run_dir.rglob("*") if path.is_file()),
        key=lambda path: path.stat().st_mtime,
        reverse=True,
    )
    artifacts: list[dict[str, Any]] = []
    for path in files[: max(0, int(limit))]:
        stat = path.stat()
        relative = path.relative_to(project_dir).as_posix()
        artifacts.append({
            "name": path.name,
            "artifact_ref": f"tool-result:{relative}",
            "path": f"data/tool_results/{safe_project}/{relative}",
            "relative_path": relative,
            "size_bytes": stat.st_size,
            "mtime": int(stat.st_mtime),
        })
    return artifacts
