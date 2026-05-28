"""Plan — G2 gate output."""

from __future__ import annotations

from pydantic import BaseModel, Field


class Plan(BaseModel):
    title: str
    milestones: list[str] = Field(min_length=1)
    risks: list[str] = Field(default_factory=list)
    owners: dict[str, str] = Field(default_factory=dict)
