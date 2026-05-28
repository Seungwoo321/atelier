"""LaunchMemo — G5 gate output."""

from __future__ import annotations

from pydantic import BaseModel, Field


class LaunchMemo(BaseModel):
    feature: str
    channels: list[str] = Field(min_length=1)
    success_metrics: list[str] = Field(min_length=1)
    dry_run: bool = True
