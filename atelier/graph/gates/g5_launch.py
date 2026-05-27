"""G5 — Launch gate. Mkt Lead + Ops Lead + Analytics Lead produce launch memo."""

from __future__ import annotations

from atelier.artifacts.launch import LaunchMemo
from atelier.graph.state import CompanyState


async def g5_launch(state: CompanyState) -> CompanyState:
    title = (state.get("charter") or {}).get("title", "Launch")
    memo = LaunchMemo(
        feature=title,
        channels=["blog", "twitter", "discord"],
        success_metrics=["≥1 active user in week 1"],
        dry_run=True,
    )
    state["launch"] = memo.model_dump()
    state.setdefault("notes", []).append("g5: launch memo drafted (dry-run)")
    state["current_gate"] = "done"
    return state
