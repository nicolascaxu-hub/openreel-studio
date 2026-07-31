"""Event stream — append-only lifecycle log for auditing, debugging, and recovery.

All significant operations (task state changes, tool calls, agent spawns,
plan approvals) emit events to a JSONL file. The stream is:
- Append-only (never edited, only appended)
- Per-project (data/events/<project_id>.jsonl) + global (data/events/global.jsonl)
- Queryable by type, time range, or correlation ID
- Used for: debugging, crash recovery, monitoring dashboard, training data
"""
from __future__ import annotations

import json
import time
from collections.abc import Iterator
from pathlib import Path
from typing import Any

from app.config import settings


class EventStream:
    """Append-only JSONL event log."""

    def __init__(self, events_dir: Path | str | None = None):
        if events_dir is None:
            events_dir = Path(settings.PROJECT_ROOT) / "data" / "events"
        self.dir = Path(events_dir)
        self.dir.mkdir(parents=True, exist_ok=True)

    def _file(self, project_id: str | None) -> Path:
        if project_id:
            return self.dir / f"{project_id}.jsonl"
        return self.dir / "global.jsonl"

    def emit(
        self,
        event_type: str,
        *,
        project_id: str | None = None,
        data: dict[str, Any] | None = None,
        correlation_id: str | None = None,
    ) -> dict[str, Any]:
        """Append an event. Returns the event dict."""
        event = {
            "type": event_type,
            "ts": time.time(),
            "project_id": project_id,
        }
        if correlation_id:
            event["correlation_id"] = correlation_id
        if data:
            event["data"] = data

        line = json.dumps(event, ensure_ascii=False, default=str)

        # Write to project-specific log
        if project_id:
            with open(self._file(project_id), "a", encoding="utf-8") as f:
                f.write(line + "\n")

        # Always write to global log
        with open(self._file(None), "a", encoding="utf-8") as f:
            f.write(line + "\n")

        return event

    def query(
        self,
        project_id: str | None = None,
        event_type: str | None = None,
        since: float | None = None,
        offset: int = 0,
        limit: int = 50,
    ) -> list[dict[str, Any]]:
        """Read events from the log, newest first."""
        start = max(0, int(offset or 0))
        size = max(1, min(int(limit or 50), 100))
        events: list[dict[str, Any]] = []
        for index, event in enumerate(
            self.iter_newest(project_id=project_id, event_type=event_type, since=since)
        ):
            if index < start:
                continue
            events.append(event)
            if len(events) >= size:
                break
        return events

    def iter_newest(
        self,
        project_id: str | None = None,
        event_type: str | None = None,
        since: float | None = None,
    ) -> Iterator[dict[str, Any]]:
        """Stream matching events newest-first without loading the whole log."""

        path = self._file(project_id)
        if not path.exists():
            return
        for line in self._iter_lines_newest(path):
            try:
                event = json.loads(line)
            except (json.JSONDecodeError, UnicodeDecodeError):
                continue
            if not isinstance(event, dict):
                continue
            if event_type and event.get("type") != event_type:
                continue
            if since and event.get("ts", 0) < since:
                continue
            yield event

    @staticmethod
    def _iter_lines_newest(path: Path, block_bytes: int = 64 * 1024) -> Iterator[str]:
        with path.open("rb") as handle:
            handle.seek(0, 2)
            position = handle.tell()
            remainder = b""
            while position > 0:
                read_size = min(block_bytes, position)
                position -= read_size
                handle.seek(position)
                chunk = handle.read(read_size)
                parts = (chunk + remainder).split(b"\n")
                remainder = parts[0]
                for raw in reversed(parts[1:]):
                    if raw:
                        yield raw.decode("utf-8", errors="replace")
            if remainder:
                yield remainder.decode("utf-8", errors="replace")

    def tail(
        self,
        project_id: str | None = None,
        n: int = 20,
        offset: int = 0,
    ) -> list[dict[str, Any]]:
        """Get the last N events."""
        return self.query(project_id=project_id, offset=offset, limit=n)


# Global singleton
event_stream = EventStream()
