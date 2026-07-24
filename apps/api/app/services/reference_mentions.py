"""Shared parsing for prompt @mentions that point at referenced images."""
from __future__ import annotations

import json
import re
from copy import deepcopy
from typing import Any

from sqlmodel import select

from app.db.models import WorkflowNode


REFERENCE_MENTION_TOKEN_RE = re.compile(r"@[A-Za-z0-9_\-\u4e00-\u9fff]+")
REFERENCE_MENTION_CONTROL_RE = re.compile(r"[\x00-\x1f\x7f]+")


def safe_reference_mention_label(value: Any, fallback: str) -> str:
    raw = re.sub(r"^[@#]+", "", str(value or fallback or "参考图").strip())
    raw = re.sub(r"\.(?:png|jpe?g|webp|gif|bmp|svg)$", "", raw, flags=re.IGNORECASE)
    raw = REFERENCE_MENTION_CONTROL_RE.sub(" ", raw)
    raw = re.sub(r"\s+", " ", raw).strip()
    return raw or str(fallback or "参考图").strip() or "参考图"


def _legacy_reference_mention_label(value: Any, fallback: str) -> str:
    """Return the pre-special-character label for persisted prompt compatibility."""
    raw = re.sub(r"^[@#]+", "", str(value or fallback or "参考图").strip())
    raw = re.sub(r"\.(?:png|jpe?g|webp|gif|bmp|svg)$", "", raw, flags=re.IGNORECASE)
    raw = "".join(char for char in raw if char.isalnum() or char in {"_", "-"})
    base = raw or fallback or "参考图"
    if not re.search(r"(?:图|图片|照片|参考)$", base):
        base = f"{base}图片"
    return base[:18]


def build_reference_mention_candidates(
    references: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    seen_refs: set[str] = set()
    used_mentions: set[str] = set()
    used_legacy_mentions: set[str] = set()
    legacy_mentions_by_ref: dict[str, str] = {}
    for item in references:
        ref = str(item.get("ref") or "").strip()
        if not ref or ref in seen_refs:
            continue
        seen_refs.add(ref)
        fallback = f"参考图{len(result) + 1}"
        label_source = item.get("label") or item.get("title")
        label = safe_reference_mention_label(label_source, fallback)
        mention = f"@{label}"
        if mention in used_mentions:
            suffix = 2
            while f"{mention}{suffix}" in used_mentions:
                suffix += 1
            mention = f"{mention}{suffix}"
        used_mentions.add(mention)
        legacy_mention = f"@{_legacy_reference_mention_label(label_source, fallback)}"
        if legacy_mention in used_legacy_mentions:
            suffix = 2
            while f"{legacy_mention}{suffix}" in used_legacy_mentions:
                suffix += 1
            legacy_mention = f"{legacy_mention}{suffix}"
        used_legacy_mentions.add(legacy_mention)
        legacy_mentions_by_ref[ref] = legacy_mention
        result.append({
            "mention": mention,
            "label": label,
            "ref": ref,
            "source": str(item.get("source") or "node").strip() or "node",
            "index": len(result) + 1,
        })
    canonical_mentions = {
        str(candidate.get("mention") or "").strip()
        for candidate in result
    }
    for candidate in result:
        legacy_mention = legacy_mentions_by_ref.get(str(candidate.get("ref") or "").strip(), "")
        if (
            legacy_mention
            and legacy_mention != candidate["mention"]
            and legacy_mention not in canonical_mentions
        ):
            candidate["aliases"] = [legacy_mention]
    return result


def parse_reference_mentions(
    prompt: str,
    candidates: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[str], list[str]]:
    prompt_text = str(prompt or "")
    canonical_entries = [
        (str(candidate.get("mention") or "").strip(), candidate)
        for candidate in candidates
        if str(candidate.get("mention") or "").strip()
    ]
    token_entries: dict[str, dict[str, Any]] = {
        mention: candidate
        for mention, candidate in canonical_entries
    }
    for _mention, candidate in canonical_entries:
        aliases = candidate.get("aliases")
        alias_values = aliases if isinstance(aliases, list) else []
        for alias in alias_values:
            token = str(alias or "").strip()
            if token:
                token_entries.setdefault(token, candidate)

    occurrences: list[tuple[int, int, str, dict[str, Any]]] = []
    for mention, candidate in token_entries.items():
        start = prompt_text.find(mention)
        while start >= 0:
            end = start + len(mention)
            next_char = prompt_text[end:end + 1]
            if not next_char or not re.match(r"[A-Za-z0-9_-]", next_char):
                occurrences.append((start, end, mention, candidate))
            start = prompt_text.find(mention, start + 1)
    occurrences.sort(key=lambda item: (item[0], -(item[1] - item[0])))

    selected: list[tuple[int, int, str, dict[str, Any]]] = []
    for occurrence in occurrences:
        start, end, _mention, _candidate = occurrence
        if any(
            start < selected_end and end > selected_start
            for selected_start, selected_end, _token, _selected_candidate in selected
        ):
            continue
        selected.append(occurrence)
    selected.sort(key=lambda item: item[0])

    matched: list[dict[str, Any]] = []
    matched_candidate_ids: set[int] = set()
    for _start, _end, token, candidate in selected:
        candidate_id = id(candidate)
        if candidate_id in matched_candidate_ids:
            continue
        matched_candidate_ids.add(candidate_id)
        stored_candidate = deepcopy(candidate)
        stored_candidate.pop("aliases", None)
        stored_candidate["mention"] = token
        matched.append(stored_candidate)
    unknown: list[str] = []
    for token_match in REFERENCE_MENTION_TOKEN_RE.finditer(prompt_text):
        if any(
            token_match.start() <= selected_start < token_match.end()
            for selected_start, _selected_end, _mention, _candidate in selected
        ):
            continue
        token = token_match.group(0)
        if token not in unknown:
            unknown.append(token)
    missing = [
        mention
        for mention, candidate in canonical_entries
        if id(candidate) not in matched_candidate_ids
    ]
    return matched, unknown, missing


def reference_mention_instruction(candidates: list[dict[str, Any]]) -> str:
    if not candidates:
        return ""
    rows = [f"- {item['mention']}：{item['label']}" for item in candidates]
    return (
        "写最终媒体提示词时，必须至少使用一次下面每个精确的 @参考图标签。"
        "标签必须原样保留，不得改成图片编号，也不得创造新标签。\n"
        + "\n".join(rows)
    )


REFERENCE_MENTION_IMAGE_ROLES = {
    "",
    "reference",
    "visual_reference",
    "image_reference",
    "reference_image",
    "media_reference",
    "style_reference",
    "character_reference",
    "scene_reference",
    "storyboard_reference",
    "first_frame",
    "last_frame",
}


def _as_dict(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return dict(value)
    if isinstance(value, str) and value.strip():
        try:
            parsed = json.loads(value)
        except (TypeError, ValueError):
            return {}
        return parsed if isinstance(parsed, dict) else {}
    return {}


def _reference_values(input_data: dict[str, Any]) -> list[str]:
    result: list[str] = []
    containers = [
        input_data,
        input_data.get("fields") if isinstance(input_data.get("fields"), dict) else {},
    ]
    for container in containers:
        references = container.get("references")
        reference_items = references if isinstance(references, list) else [references]
        for item in reference_items:
            if item in (None, ""):
                continue
            if isinstance(item, dict):
                role = str(item.get("role") or "").strip().lower().replace("-", "_")
                if role not in REFERENCE_MENTION_IMAGE_ROLES:
                    continue
                value = item.get("ref") or item.get("reference") or item.get("value")
            else:
                value = item
            text = str(value or "").strip()
            if text and text not in result:
                result.append(text)
        reference_images = container.get("reference_images")
        values = reference_images if isinstance(reference_images, list) else [reference_images]
        for value in values:
            text = str(value or "").strip()
            if text and text not in result:
                result.append(text)
    return result


def _reference_node_lookup_keys(node: WorkflowNode) -> set[str]:
    keys = {str(node.id)}
    if node.display_id is not None:
        keys.update({str(node.display_id), f"#{node.display_id}"})
    title = str(node.title or "").strip()
    if title:
        keys.add(title)
    return keys


def _normalized_reference_lookup_key(value: Any) -> str:
    text = str(value or "").strip()
    if text.startswith("@"):
        text = text[1:]
    if text.startswith("node:"):
        text = text[len("node:"):]
    return text.strip()


async def refresh_node_reference_mentions(session: Any, node: WorkflowNode) -> None:
    """Rebuild prompt mention metadata from the node's current image references.

    The prompt token is matched against a candidate label, but the persisted binding
    always points at the referenced image node's stable internal id. Reference order
    only determines the current provider-facing index and can be changed safely.
    """
    input_data = _as_dict(node.input_json)
    prompt = str(input_data.get("prompt") or node.prompt or "").strip()
    reference_values = _reference_values(input_data)
    if not prompt or not reference_values:
        if "reference_image_mentions" in input_data:
            input_data.pop("reference_image_mentions", None)
            node.input_json = _json_string(input_data)
        return

    image_nodes = list((await session.exec(
        select(WorkflowNode).where(
            WorkflowNode.project_id == node.project_id,
            WorkflowNode.type == "image",
        )
    )).all())
    lookup: dict[str, WorkflowNode] = {}
    for image_node in image_nodes:
        for key in _reference_node_lookup_keys(image_node):
            lookup.setdefault(_normalized_reference_lookup_key(key), image_node)

    candidate_inputs: list[dict[str, Any]] = []
    for ref in reference_values:
        image_node = lookup.get(_normalized_reference_lookup_key(ref))
        if image_node is None or image_node.id == node.id:
            continue
        candidate_inputs.append({
            "ref": f"node:{image_node.id}",
            "label": image_node.title,
            "source": "node",
        })
    candidates = build_reference_mention_candidates(candidate_inputs)
    matched, _unknown, _missing = parse_reference_mentions(prompt, candidates)
    if matched:
        input_data["reference_image_mentions"] = matched
    else:
        input_data.pop("reference_image_mentions", None)
    node.input_json = _json_string(input_data)


def _json_string(value: dict[str, Any]) -> str:
    return json.dumps(value, ensure_ascii=False)
