"""DesignMemo — G3 design deliverable."""

from __future__ import annotations

from pydantic import BaseModel, Field


class DesignMemo(BaseModel):
    feature: str
    information_architecture: list[str] = Field(min_length=1)
    wireframe_notes: str
    tokens: dict[str, str] = Field(default_factory=dict)
