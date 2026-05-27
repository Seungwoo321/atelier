"""Langfuse integration — opt-in via env LANGFUSE_PUBLIC_KEY/LANGFUSE_SECRET_KEY."""

from __future__ import annotations

import os
from typing import Any


def is_enabled() -> bool:
    return bool(os.environ.get("LANGFUSE_PUBLIC_KEY") and os.environ.get("LANGFUSE_SECRET_KEY"))


def trace(name: str, *, input: Any = None, output: Any = None, metadata: dict[str, Any] | None = None) -> None:
    if not is_enabled():
        return
    try:
        from langfuse import Langfuse

        client = Langfuse()
        client.trace(name=name, input=input, output=output, metadata=metadata or {})
    except Exception:
        pass
