"""CompanyState — shared state object that flows through the LangGraph."""

from __future__ import annotations

from typing import Any, TypedDict


class CompanyState(TypedDict, total=False):
    request: str                     # original user request
    charter: dict[str, Any]          # G1 — ProductCharter
    plan: dict[str, Any]             # G2 — Plan
    prds: list[dict[str, Any]]       # G3 — PRDs
    design: dict[str, Any]           # G3 — Design memo
    code_review: dict[str, Any]      # G4 — Code review summary
    launch: dict[str, Any]           # G5 — Launch memo
    artifacts: dict[str, Any]
    quota_used: float
    notes: list[str]
    current_gate: str                # G1..G5 or 'done'
    blocked: bool                    # awaiting human at a gate
    eval_scores: dict[str, float]    # rubric scores from Eval Officer
