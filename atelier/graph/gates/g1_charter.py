"""G1 — Charter gate. Skeleton only; wired in Phase A gate work."""

from __future__ import annotations

from atelier.artifacts.charter import ProductCharter
from atelier.graph.state import CompanyState


async def g1_charter(state: CompanyState) -> CompanyState:
    """Produce a ProductCharter from `state['request']`.

    Phase A skeleton: returns state unchanged. The Chief of Staff LLM call lands
    when the LLMProvider concrete implementations are wired.
    """
    _ = ProductCharter  # placeholder reference until gate body is implemented
    state.setdefault("notes", []).append("g1: skeleton (no-op)")
    state["current_gate"] = "G1"
    return state
