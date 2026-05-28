"""G2 — Plan gate. PM Lead + Eng Manager produce roadmap + sprint plan."""

from __future__ import annotations

from atelier.artifacts.plan import Plan
from atelier.config import load_settings
from atelier.graph.gates._llm import call_gate_llm, verify_gate
from atelier.graph.gates._specialist import lead_revision_after_debate
from atelier.graph.state import CompanyState
from atelier.observability.tracer import trace_event

PM_MODEL = "claude-opus-4-7"

_SPECIALISTS = [
    (
        "PM Specialist",
        "Product",
        "Sharpen scope, milestones, and acceptance criteria.",
    ),
    (
        "Market Researcher",
        "Strategy",
        "Surface demand signals, competitor moves, and unmet user needs.",
    ),
]

SYSTEM_PROMPT = (
    "You are the PM Lead at Atelier, working with the Eng Manager to turn a "
    "Product Charter into a small, executable Plan. "
    "Reply with a SINGLE JSON object and nothing else, matching exactly: "
    '{"title": str, "milestones": [str, ...], "risks": [str, ...], '
    '"owners": {<dept>: <role>, ...}}'
    " 3-6 milestones each a one-line outcome. 2-5 risks. owners maps dept "
    'name (Engineering, Design, QA, Marketing, Operations) to the lead role.'
)


def _placeholder(charter: dict[str, object]) -> Plan:
    title = charter.get("title", "Plan")
    return Plan(
        title=title if isinstance(title, str) else "Plan",
        milestones=["G3 design memo", "G4 build review", "G5 launch memo"],
        risks=["Unverified user demand", "Quota exhaustion under load"],
    )


async def g2_plan(state: CompanyState) -> CompanyState:
    charter = state.get("charter") or {}
    trace_event("g2.plan.start", dept="Product", title=charter.get("title", ""))

    base_prompt = (
        "Product Charter:\n"
        f"title: {charter.get('title', '')}\n"
        f"one_liner: {charter.get('one_liner', '')}\n"
        f"problem: {charter.get('problem', '')}\n"
        f"target_user: {charter.get('target_user', '')}\n"
        "success_metrics:\n- "
        + "\n- ".join(charter.get("success_metrics", []) or ["-"])
    )
    artifact, used_llm, reason = await call_gate_llm(
        gate="G2",
        dept="Product",
        role="PM Lead",
        model=PM_MODEL,
        system=SYSTEM_PROMPT,
        prompt=base_prompt,
        artifact_cls=Plan,
        max_tokens=1200,
        quota_frac=0.01,
    )
    if artifact is None:
        trace_event("g2.plan.fallback", reason=reason)
        artifact = _placeholder(charter)
    elif load_settings().specialist_debate_enabled:
        artifact = await lead_revision_after_debate(
            gate="G2",
            dept="Product",
            lead_role="PM Lead",
            model=PM_MODEL,
            system=SYSTEM_PROMPT,
            base_prompt=base_prompt,
            draft=artifact,
            artifact_cls=Plan,
            specialists=_SPECIALISTS,
            max_tokens=1500,
        )

    verify = await verify_gate(gate="G2", dept="Product", artifact=artifact)
    if verify.get("scores"):
        state.setdefault("eval_scores", {}).update(
            {f"G2.{k}": v for k, v in verify["scores"].items()}
        )
    state["plan"] = artifact.model_dump()
    state.setdefault("notes", []).append(
        "g2: plan drafted" + (" (LLM)" if used_llm else " (placeholder)")
    )
    state["current_gate"] = "G2"
    trace_event("g2.plan.done", dept="Product", used_llm=used_llm)
    return state
