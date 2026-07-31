"""Typed, bounded model-context contracts for tool outputs."""

from .policy import (
    COLLECTION_OUTPUT_POLICY,
    DELEGATED_OUTPUT_POLICY,
    DOCUMENT_OUTPUT_POLICY,
    JSON_OUTPUT_POLICY,
    MULTIMODAL_OUTPUT_POLICY,
    ToolOutputPolicy,
)
from .types import ToolContentPart, ToolOutput, coerce_tool_output

__all__ = [
    "COLLECTION_OUTPUT_POLICY",
    "DELEGATED_OUTPUT_POLICY",
    "DOCUMENT_OUTPUT_POLICY",
    "JSON_OUTPUT_POLICY",
    "MULTIMODAL_OUTPUT_POLICY",
    "ToolContentPart",
    "ToolOutput",
    "ToolOutputPolicy",
    "coerce_tool_output",
]
