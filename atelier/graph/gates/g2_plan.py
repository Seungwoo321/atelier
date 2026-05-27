"""G2 — Plan gate. PM Lead + Eng Manager produce roadmap + sprint plan."""

from __future__ import annotations

from atelier.artifacts.plan import Plan
from atelier.graph.state import CompanyState


async def g2_plan(state: CompanyState) -> CompanyState:
    charter = state.get("charter") or {}
    plan = Plan(
        title=charter.get("title", "Plan"),
        milestones=["G3 design memo", "G4 build review", "G5 launch memo"],
        risks=["Unverified user demand", "Quota exhaustion under load"],
    )
    state["plan"] = plan.model_dump()
    state.setdefault("notes", []).append("g2: plan drafted")
    state["current_gate"] = "G2"
    return state
