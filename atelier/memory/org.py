"""Org memory — read-only company facts (mission, principles, gates)."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from atelier.memory.base import JsonStore


class OrgMemory:
    def __init__(self, root: Path) -> None:
        self._store = JsonStore(root / "memory" / "org.json")

    def get(self, key: str, default: Any = None) -> Any:
        return self._store.read().get(key, default)

    def seed(self) -> None:
        """Write baseline org constants if absent."""
        data = self._store.read()
        data.setdefault("mission", "Build a virtual company of role-specialized agents.")
        data.setdefault(
            "principles",
            [
                "One lead per department.",
                "All gates require a typed artifact.",
                "External publish is dry-run unless mandated.",
                "Cost model = subscription quota fraction.",
                "Latest major versions first.",
            ],
        )
        data.setdefault("gates", ["G1", "G2", "G3", "G4", "G5"])
        self._store.write(data)
