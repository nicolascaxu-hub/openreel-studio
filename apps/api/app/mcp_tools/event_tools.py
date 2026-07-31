"""Event stream tools — query lifecycle events for debugging and monitoring."""
from __future__ import annotations

from typing import Any

from app.agent.event_stream import event_stream
from app.agent.model_context.policy import COLLECTION_OUTPUT_POLICY
from app.mcp_tools.query_match import invalid_regex_response, match_text, search_blob
from app.mcp_tools.registry import register


@register(
    "events.tail",
    description="Get a bounded page of recent lifecycle events",
    tags=["events", "read"],
    output_policy=COLLECTION_OUTPUT_POLICY,
)
async def events_tail(project_id: str = "", n: int = 20, offset: int = 0) -> dict[str, Any]:
    size = _bounded_page_size(n, default=20)
    start = _bounded_offset(offset)
    events = event_stream.query(project_id or None, offset=start, limit=size + 1)
    has_more = len(events) > size
    events = events[:size]
    return {
        "events": events,
        "count": len(events),
        "offset": start,
        "limit": size,
        "next_offset": start + len(events) if has_more else None,
    }


@register(
    "events.query",
    description="Query a bounded page of events by type and optional fuzzy/regex text filter",
    tags=["events", "read"],
    output_policy=COLLECTION_OUTPUT_POLICY,
)
async def events_query(
    project_id: str = "",
    event_type: str = "",
    query: str = "",
    regex: str | list[str] | None = None,
    pattern: str | list[str] | None = None,
    case_sensitive: bool = False,
    offset: int = 0,
    limit: int = 50,
    scan_limit: int = 10_000,
) -> dict[str, Any]:
    invalid = invalid_regex_response(regex=regex, pattern=pattern)
    if invalid is not None:
        return invalid
    start = _bounded_offset(offset)
    size = _bounded_page_size(limit, default=50)
    max_scan = max(size + 1, min(_bounded_int(scan_limit, 10_000), 50_000))
    events: list[dict[str, Any]] = []
    matched = 0
    scanned = 0
    has_more = False
    for event in event_stream.iter_newest(
        project_id=project_id or None,
        event_type=event_type or None,
    ):
        scanned += 1
        if query or regex or pattern:
            match = match_text(
                search_blob(event),
                query=query,
                regex=regex,
                pattern=pattern,
                case_sensitive=case_sensitive,
            )
            if not match.get("matched"):
                if scanned >= max_scan:
                    break
                continue
            item = dict(event)
            item["match"] = {
                key: value
                for key, value in match.items()
                if key in {"mode", "matched_terms", "matched_patterns"}
                and value not in (None, "", [], {})
            }
        else:
            item = event
        if matched < start:
            matched += 1
        elif len(events) < size:
            events.append(item)
            matched += 1
        else:
            has_more = True
            break
        if scanned >= max_scan:
            break
    scan_exhausted = scanned >= max_scan and not has_more
    return {
        "events": events,
        "count": len(events),
        "offset": start,
        "limit": size,
        "next_offset": start + len(events) if has_more else None,
        "scanned": scanned,
        "scan_exhausted": scan_exhausted,
        "filters": {
            "project_id": project_id,
            "event_type": event_type,
            "query": query,
            "regex": regex,
            "pattern": pattern,
            "case_sensitive": case_sensitive,
            "offset": start,
            "limit": size,
            "scan_limit": max_scan,
        },
    }


def _bounded_int(value: Any, default: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _bounded_offset(value: Any) -> int:
    return max(0, min(_bounded_int(value, 0), 50_000))


def _bounded_page_size(value: Any, *, default: int) -> int:
    return max(1, min(_bounded_int(value, default), 100))
