"""Janitor Memo — shared desk + whiteboard cleanup at phase end."""

from __future__ import annotations

from datetime import datetime
from pathlib import Path

from pydantic import BaseModel, Field


class JanitorMemo(BaseModel):
    phase: str
    summary: str
    kept: list[str] = Field(default_factory=list)
    archived: list[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.now)

    def write(self, runs_dir: Path) -> Path:
        runs_dir.mkdir(parents=True, exist_ok=True)
        out = runs_dir / f"janitor-{self.phase}-{self.created_at.strftime('%Y%m%d-%H%M%S')}.json"
        out.write_text(self.model_dump_json(indent=2), encoding="utf-8")
        return out
