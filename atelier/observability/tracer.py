"""Structured logging via structlog; emits JSON lines to runs/events.jsonl."""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any

import structlog

_LOG_PATH: Path | None = None


def configure(runs_dir: Path, level: str = "INFO") -> None:
    global _LOG_PATH
    runs_dir.mkdir(parents=True, exist_ok=True)
    _LOG_PATH = runs_dir / "events.jsonl"
    structlog.configure(
        processors=[
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.add_log_level,
            structlog.processors.JSONRenderer(),
        ]
    )


def get_logger(name: str) -> structlog.BoundLogger:
    return structlog.get_logger(name)


def trace_event(event: str, **fields: Any) -> None:
    record = {"ts": datetime.now().isoformat(timespec="seconds"), "event": event, **fields}
    if _LOG_PATH is not None:
        with _LOG_PATH.open("a", encoding="utf-8") as f:
            f.write(json.dumps(record, ensure_ascii=False) + "\n")
