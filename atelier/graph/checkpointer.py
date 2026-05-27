"""SQLite checkpointer for LangGraph durability.

Phase A: local sqlite file under runs/.
"""

from __future__ import annotations

from pathlib import Path


def sqlite_path(runs_dir: Path) -> Path:
    runs_dir.mkdir(parents=True, exist_ok=True)
    return runs_dir / "atelier.sqlite"


def build_checkpointer(runs_dir: Path):  # type: ignore[no-untyped-def]
    """Return a LangGraph SqliteSaver bound to runs/atelier.sqlite.

    Imported lazily so the package loads without langgraph installed.
    """
    from langgraph.checkpoint.sqlite import SqliteSaver

    return SqliteSaver.from_conn_string(str(sqlite_path(runs_dir)))
