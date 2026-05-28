"""PRD — Product Requirements Document (G3 output)."""

from __future__ import annotations

from pydantic import BaseModel, Field


class PRD(BaseModel):
    feature: str
    user_stories: list[str] = Field(min_length=1)
    acceptance_criteria: list[str] = Field(min_length=1)
    out_of_scope: list[str] = Field(default_factory=list)
