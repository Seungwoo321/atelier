"""G3 — Design gate. Design Lead + PM specialists produce PRDs + Design memo."""

from __future__ import annotations

from atelier.artifacts.design import DesignMemo
from atelier.artifacts.prd import PRD
from atelier.graph.state import CompanyState


async def g3_design(state: CompanyState) -> CompanyState:
    title = (state.get("charter") or {}).get("title", "Feature")
    prd = PRD(
        feature=title,
        user_stories=[f"As a user, I can {title.lower()}."],
        acceptance_criteria=["Feature can be exercised end-to-end without errors."],
    )
    design = DesignMemo(
        feature=title,
        information_architecture=["Home", "Detail", "Settings"],
        wireframe_notes="Single-page flow with progressive disclosure.",
    )
    state.setdefault("prds", []).append(prd.model_dump())
    state["design"] = design.model_dump()
    state.setdefault("notes", []).append("g3: prd + design drafted")
    state["current_gate"] = "G3"
    return state
