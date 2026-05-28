"""ProductCharter — G1 gate output."""

from __future__ import annotations

from pydantic import BaseModel, Field


class ProductCharter(BaseModel):
    """One-page product charter produced by Chief of Staff at G1."""

    title: str = Field(min_length=1, max_length=120)
    one_liner: str = Field(min_length=1, max_length=240)
    problem: str
    target_user: str
    success_metrics: list[str] = Field(min_length=1, max_length=5)
    non_goals: list[str] = Field(default_factory=list)
    constraints: list[str] = Field(default_factory=list)
