"""Role memory — each role can self-edit its own scratchpad."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from atelier.memory.base import JsonStore


class RoleMemory:
    def __init__(self, root: Path, role_name: str) -> None:
        slug = role_name.lower().replace(" ", "_")
        self._store = JsonStore(root / "memory" / "roles" / f"{slug}.json")
        self.role = role_name

    def remember(self, fact: str, tags: list[str] | None = None) -> None:
        self._store.update(
            **{
                fact: {"tags": tags or [], "role": self.role},
            }
        )

    def recall(self) -> dict[str, Any]:
        return self._store.read()
