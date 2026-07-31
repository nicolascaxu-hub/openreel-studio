from pathlib import Path

import pytest

from app.agent.event_stream import EventStream
from app.mcp_tools import event_tools


@pytest.mark.asyncio
async def test_event_pages_stream_newest_first_without_full_file_read(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    stream = EventStream(tmp_path / "events")
    monkeypatch.setattr(event_tools, "event_stream", stream)
    for index in range(6):
        stream.emit("step", project_id="project-1", data={"index": index})

    first = await event_tools.events_tail(project_id="project-1", n=2)
    second = await event_tools.events_tail(
        project_id="project-1",
        n=2,
        offset=first["next_offset"],
    )

    assert [item["data"]["index"] for item in first["events"]] == [5, 4]
    assert first["next_offset"] == 2
    assert [item["data"]["index"] for item in second["events"]] == [3, 2]
    assert second["next_offset"] == 4


@pytest.mark.asyncio
async def test_event_query_applies_offset_after_text_filter(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    stream = EventStream(tmp_path / "events")
    monkeypatch.setattr(event_tools, "event_stream", stream)
    for index in range(8):
        stream.emit(
            "step",
            project_id="project-1",
            data={"index": index, "label": "match" if index % 2 else "skip"},
        )

    page = await event_tools.events_query(
        project_id="project-1",
        event_type="step",
        query="match",
        offset=1,
        limit=2,
    )

    assert [item["data"]["index"] for item in page["events"]] == [5, 3]
    assert page["next_offset"] == 3
    assert page["scanned"] <= 8
