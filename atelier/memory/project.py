"""Project memory — shared facts for the current run (artifacts, decisions)."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from atelier.memory.base import JsonStore


class ProjectMemory:
    def __init__(self, root: Path, project_id: str) -> None:
        self._store = JsonStore(root / "memory" / "projects" / f"{project_id}.json")

    def all(self) -> dict[str, Any]:
        return self._store.read()

    def set(self, key: str, value: Any) -> None:
        self._store.update(**{key: value})

    def append(self, key: str, value: Any) -> None:
        data = self._store.read()
        data.setdefault(key, []).append(value)
        self._store.write(data)
