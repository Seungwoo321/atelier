"""CompanyState — shared state object that flows through the LangGraph."""

from __future__ import annotations

from typing import Any, TypedDict


class CompanyState(TypedDict, total=False):
    request: str                     # original user request
    charter: dict[str, Any]          # G1 output — ProductCharter
    plan: dict[str, Any]             # G2 output
    artifacts: dict[str, Any]        # accumulated typed artifacts
    quota_used: float                # fraction 0..1
    notes: list[str]                 # short audit trail
    current_gate: str                # G1..G5
