"""G5 — Launch gate. Mkt Lead + Ops Lead + Analytics Lead produce launch memo."""

from __future__ import annotations

from atelier.artifacts.launch import LaunchMemo
from atelier.graph.gates._llm import call_gate_llm
from atelier.graph.state import CompanyState
from atelier.observability.tracer import trace_event

MKT_MODEL = "claude-opus-4-7"

SYSTEM_PROMPT = (
    "You are the Marketing Lead at Atelier, working with the Ops Lead and "
    "Analytics Lead to draft a Launch Memo. Atelier launches are dry-run by "
    "default: copy is written to the artifacts directory, NOT sent. "
    "Reply with a SINGLE JSON object and nothing else, matching exactly: "
    '{"feature": str, "channels": [str, ...], '
    '"success_metrics": [str, ...], "dry_run": bool}'
    " channels 2-5 distribution channels grounded in the target_user "
    "(e.g. 'blog', 'HN Show', 'twitter', 'devto', 'discord', 'reddit r/<sub>'). "
    "success_metrics 2-5 measurable launch-week outcomes. "
    'dry_run MUST be true unless the mandate explicitly authorizes a live send.'
)


def _placeholder(feature: str) -> LaunchMemo:
    return LaunchMemo(
        feature=feature,
        channels=["blog", "twitter", "discord"],
        success_metrics=["≥1 active user in week 1"],
        dry_run=True,
    )


async def g5_launch(state: CompanyState) -> CompanyState:
    charter = state.get("charter") or {}
    plan = state.get("plan") or {}
    review = state.get("code_review") or {}
    feature = charter.get("title") or plan.get("title", "Launch")
    trace_event("g5.launch.start", dept="Marketing", feature=feature)

    artifact, used_llm, reason = await call_gate_llm(
        gate="G5",
        dept="Marketing",
        role="Mkt Lead",
        model=MKT_MODEL,
        system=SYSTEM_PROMPT,
        prompt=(
            "Charter:\n"
            f"title: {feature}\n"
            f"one_liner: {charter.get('one_liner', '')}\n"
            f"target_user: {charter.get('target_user', '')}\n\n"
            "Plan milestones:\n- "
            + "\n- ".join(plan.get("milestones", []) or ["-"])
            + "\n\nCode review summary:\n"
            f"{review.get('summary', '')}\n"
            "outstanding_risks:\n- "
            + "\n- ".join(review.get("outstanding_risks", []) or ["-"])
        ),
        artifact_cls=LaunchMemo,
        max_tokens=1200,
        quota_frac=0.015,
    )
    if artifact is None:
        trace_event("g5.launch.fallback", reason=reason)
        artifact = _placeholder(feature)
    if not artifact.dry_run and not state.get("mandate", {}).get("live_publish"):
        trace_event("g5.launch.force_dry_run", reason="no_mandate")
        artifact = artifact.model_copy(update={"dry_run": True})

    state["launch"] = artifact.model_dump()
    state.setdefault("notes", []).append(
        "g5: launch memo drafted"
        + (" (LLM)" if used_llm else " (placeholder)")
        + (" (dry-run)" if artifact.dry_run else " (LIVE)")
    )
    state["current_gate"] = "done"
    trace_event(
        "g5.launch.done", dept="Marketing", used_llm=used_llm, dry_run=artifact.dry_run
    )
    return state
