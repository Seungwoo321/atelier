"""Cross-Dept Council — end-of-run launch readiness vote."""

from __future__ import annotations

import re

from atelier.budget import QuotaGuard
from atelier.config import load_settings
from atelier.llm.provider import get_provider
from atelier.observability.tracer import trace_event
from atelier.protocols.council import CrossDeptCouncil

COUNCIL_MODEL = "claude-sonnet-4-6"
OPTIONS = ["ship", "hold", "rework"]
VOTERS = [
    ("Chief of Staff", "Chief", "facilitates and protects scope"),
    ("PM Lead", "Product", "owns roadmap and acceptance"),
    ("Eng Manager", "Engineering", "owns build risk"),
    ("QA Lead", "QA", "owns quality gates"),
    ("Mkt Lead", "Marketing", "owns launch readiness"),
]


def _parse_vote(text: str) -> str:
    lower = text.lower()
    for opt in OPTIONS:
        if re.search(rf"\b{opt}\b", lower):
            return opt
    return "hold"


async def run_launch_council(final: dict) -> dict | None:
    """Ask each lead for a one-word vote among {ship, hold, rework}.

    Returns {decision, rationale, votes, deciding_vote_used} or None
    when the provider is unconfigured.
    """
    settings = load_settings()
    if not settings.council_enabled:
        return None
    provider = get_provider(settings.llm_provider)
    if not await provider.healthcheck():
        return None

    summary = (
        f"Feature: {(final.get('charter') or {}).get('title', '')}\n"
        f"Plan title: {(final.get('plan') or {}).get('title', '')}\n"
        f"Code review summary: {(final.get('code_review') or {}).get('summary', '')}\n"
        "Outstanding risks:\n- "
        + "\n- ".join((final.get("code_review") or {}).get("outstanding_risks", []) or ["-"])
        + "\nLaunch dry_run: "
        + str((final.get("launch") or {}).get("dry_run", True))
    )

    async def cast(voter: str, options: list[str]) -> str:
        role_meta = next((v for v in VOTERS if v[0] == voter), None)
        if not role_meta:
            return "hold"
        _, dept, mandate = role_meta
        system = (
            f"You are the {voter} at Atelier. Your mandate: {mandate}. "
            "Cast a single-word vote on launch readiness from this exact set: "
            f"{options}. Reply with the word only — no preamble, no JSON."
        )
        try:
            resp = await provider.complete(
                system=system,
                prompt="Run summary:\n" + summary,
                model=COUNCIL_MODEL,
                max_tokens=20,
            )
            QuotaGuard(cap=settings.quota_cap).charge(dept, 0.003)
            trace_event(
                "quota.charge",
                dept=dept,
                role=voter,
                gate="Council",
                frac=0.003,
                input_tokens=resp.input_tokens,
                output_tokens=resp.output_tokens,
                tier="sonnet",
            )
            choice = _parse_vote(resp.text)
            trace_event("council.vote", voter=voter, dept=dept, choice=choice)
            return choice
        except Exception as e:  # noqa: BLE001
            trace_event("council.vote.error", voter=voter, error=type(e).__name__)
            return "hold"

    council = CrossDeptCouncil()
    outcome = await council.decide(
        options=OPTIONS,
        voters=[v[0] for v in VOTERS],
        cast_vote=cast,
        deciding_voter="PM Lead",
    )
    trace_event(
        "council.decision",
        decision=outcome.decision,
        rationale=outcome.rationale,
        deciding_vote_used=outcome.deciding_vote_used,
        votes=outcome.votes,
    )
    return {
        "decision": outcome.decision,
        "rationale": outcome.rationale,
        "votes": outcome.votes,
        "deciding_vote_used": outcome.deciding_vote_used,
    }
