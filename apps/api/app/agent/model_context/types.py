"""Tool-runtime values before they are compiled into provider messages."""
from __future__ import annotations

from dataclasses import dataclass, field, replace
from typing import Any, Literal


ToolContentKind = Literal["text", "image_url", "audio_url"]


@dataclass(frozen=True)
class ToolContentPart:
    """One typed model input returned by a tool.

    Binary media remains a typed part. It is never serialized into the JSON
    observation, trace preview, UI event, or diagnostic artifact.
    """

    type: ToolContentKind
    text: str = ""
    url: str = ""
    detail: str = ""

    @classmethod
    def text_part(cls, text: str) -> "ToolContentPart":
        return cls(type="text", text=str(text or ""))

    @classmethod
    def image_part(cls, url: str, *, detail: str = "") -> "ToolContentPart":
        return cls(type="image_url", url=str(url or ""), detail=str(detail or ""))

    @classmethod
    def audio_part(cls, url: str) -> "ToolContentPart":
        return cls(type="audio_url", url=str(url or ""))

    def as_provider_part(self) -> dict[str, Any]:
        if self.type == "text":
            return {"type": "text", "text": self.text}
        if self.type == "image_url":
            image_url: dict[str, Any] = {"url": self.url}
            if self.detail:
                image_url["detail"] = self.detail
            return {"type": "image_url", "image_url": image_url}
        return {"type": "audio_url", "audio_url": {"url": self.url}}


@dataclass(frozen=True)
class ToolOutput:
    """Canonical tool result with raw data separated from model-only media."""

    value: Any
    content_parts: tuple[ToolContentPart, ...] = field(default_factory=tuple)
    content_refs: tuple[str, ...] = field(default_factory=tuple)
    contains_external_context: bool = False

    def with_value(self, value: Any) -> "ToolOutput":
        return replace(self, value=value)


def coerce_tool_output(value: Any) -> ToolOutput:
    if isinstance(value, ToolOutput):
        return value
    return ToolOutput(value=value)
