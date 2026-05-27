"""G4 — Build gate. Eng Manager + Tech Lead + QA Lead drive implementation."""

from __future__ import annotations

from atelier.artifacts.code_review import CodeReview
from atelier.graph.state import CompanyState


async def g4_build(state: CompanyState) -> CompanyState:
    review = CodeReview(
        feature=(state.get("plan") or {}).get("title", "Feature"),
        summary="Initial build complete; reviewer approvals pending.",
        passed_checks=["ruff", "mypy", "pytest"],
        outstanding_risks=[],
    )
    state["code_review"] = review.model_dump()
    state.setdefault("notes", []).append("g4: code review drafted")
    state["current_gate"] = "G4"
    return state
