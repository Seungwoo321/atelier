"""Build the LangGraph for a single company run (G1 → G5)."""

from __future__ import annotations

from pathlib import Path

from atelier.graph.gates.g1_charter import g1_charter
from atelier.graph.gates.g2_plan import g2_plan
from atelier.graph.gates.g3_design import g3_design
from atelier.graph.gates.g4_build import g4_build
from atelier.graph.gates.g5_launch import g5_launch
from atelier.graph.state import CompanyState


def build_graph(runs_dir: Path | None = None):  # type: ignore[no-untyped-def]
    """Construct the strategic-gate graph.

    Lazy-imports langgraph so the package loads in minimal environments.
    """
    from langgraph.graph import END, StateGraph

    g: StateGraph = StateGraph(CompanyState)
    g.add_node("g1_charter", g1_charter)
    g.add_node("g2_plan", g2_plan)
    g.add_node("g3_design", g3_design)
    g.add_node("g4_build", g4_build)
    g.add_node("g5_launch", g5_launch)

    g.set_entry_point("g1_charter")
    g.add_edge("g1_charter", "g2_plan")
    g.add_edge("g2_plan", "g3_design")
    g.add_edge("g3_design", "g4_build")
    g.add_edge("g4_build", "g5_launch")
    g.add_edge("g5_launch", END)

    if runs_dir is not None:
        from atelier.graph.checkpointer import build_checkpointer

        return g.compile(checkpointer=build_checkpointer(runs_dir))
    return g.compile()
