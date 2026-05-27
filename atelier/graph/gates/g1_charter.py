"""G1 — Charter gate. Chief of Staff produces the one-page charter."""

from __future__ import annotations

from atelier.artifacts.charter import ProductCharter
from atelier.graph.state import CompanyState


async def g1_charter(state: CompanyState) -> CompanyState:
    request = state.get("request", "")
    # Phase A skeleton: produce a deterministic charter from the request body.
    # Real LLM invocation lands once the provider transports are wired.
    title = request.strip().splitlines()[0][:120] if request else "Untitled"
    charter = ProductCharter(
        title=title,
        one_liner=request[:240] or title,
        problem="To be elaborated by Chief of Staff.",
        target_user="To be elaborated by PM Lead at G2.",
        success_metrics=["At least one usable artifact delivered end-to-end."],
    )
    state["charter"] = charter.model_dump()
    state.setdefault("notes", []).append("g1: charter drafted")
    state["current_gate"] = "G1"
    return state
