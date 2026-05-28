"""CodeReview — G4 gate output."""

from __future__ import annotations

from pydantic import BaseModel, Field


class CodeReview(BaseModel):
    feature: str
    summary: str
    passed_checks: list[str] = Field(default_factory=list)
    outstanding_risks: list[str] = Field(default_factory=list)
