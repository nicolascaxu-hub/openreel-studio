"""Executable model-output policies attached to registered tools."""
from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Literal


OutputProfile = Literal["json", "document", "collection", "multimodal", "delegated"]

GLOBAL_MODEL_ITEM_MAX_TOKENS = 10_000
DEFAULT_TOOL_OUTPUT_TOKENS = 2_500


@dataclass(frozen=True)
class ToolOutputPolicy:
    profile: OutputProfile = "json"
    default_model_tokens: int = DEFAULT_TOOL_OUTPUT_TOKENS
    max_model_tokens: int = 4_000
    max_items: int = 20
    artifact_threshold_bytes: int = 12_000
    max_media_items: int = 0

    def effective_tokens(self, requested_tokens: int | None = None) -> int:
        requested = self.default_model_tokens if requested_tokens is None else int(requested_tokens)
        requested = max(1, requested)
        return min(requested, self.max_model_tokens, GLOBAL_MODEL_ITEM_MAX_TOKENS)

    def as_dict(self) -> dict[str, int | str]:
        return {
            "profile": self.profile,
            "default_model_tokens": self.default_model_tokens,
            "max_model_tokens": self.max_model_tokens,
            "max_items": self.max_items,
            "artifact_threshold_bytes": self.artifact_threshold_bytes,
            "max_media_items": self.max_media_items,
        }


JSON_OUTPUT_POLICY = ToolOutputPolicy()
DOCUMENT_OUTPUT_POLICY = ToolOutputPolicy(
    profile="document",
    default_model_tokens=10_000,
    max_model_tokens=10_000,
    max_items=20,
    artifact_threshold_bytes=32_000,
)
COLLECTION_OUTPUT_POLICY = ToolOutputPolicy(
    profile="collection",
    default_model_tokens=2_500,
    max_model_tokens=3_000,
    max_items=100,
    artifact_threshold_bytes=12_000,
)
LARGE_COLLECTION_OUTPUT_POLICY = ToolOutputPolicy(
    profile="collection",
    default_model_tokens=8_000,
    max_model_tokens=10_000,
    max_items=100,
    artifact_threshold_bytes=32_000,
)
MULTIMODAL_OUTPUT_POLICY = ToolOutputPolicy(
    profile="multimodal",
    default_model_tokens=10_000,
    max_model_tokens=10_000,
    max_items=20,
    artifact_threshold_bytes=12_000,
    max_media_items=8,
)
DELEGATED_OUTPUT_POLICY = ToolOutputPolicy(
    profile="delegated",
    default_model_tokens=3_000,
    max_model_tokens=8_000,
    max_items=50,
    artifact_threshold_bytes=16_000,
    max_media_items=8,
)


def estimate_text_tokens(text: str) -> int:
    """Conservative tokenizer fallback for mixed CJK and Latin text.

    Provider tokenizers remain preferable. Three UTF-8 bytes per token is
    deliberately safer for CJK than the former 3.5 characters-per-token rule.
    """

    value = str(text or "")
    if not value:
        return 0
    byte_estimate = math.ceil(len(value.encode("utf-8")) / 3)
    char_estimate = math.ceil(len(value) / 2)
    return max(1, byte_estimate, char_estimate)
