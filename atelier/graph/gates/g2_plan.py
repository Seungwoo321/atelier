"""G2 — Plan gate. PM Lead + Eng Manager produce roadmap + sprint plan."""

from __future__ import annotations

from atelier.artifacts.plan import Plan
from atelier.config import load_settings
from atelier.graph.gates._llm import call_gate_llm, verify_gate
from atelier.graph.gates._specialist import lead_revision_after_debate
from atelier.graph.state import CompanyState
from atelier.observability.tracer import trace_event
from atelier.roles.foundry import Foundry, Requisition

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

_REQUISITIONS = [
    Requisition(
        gate="G2",
        issuing_lead="PM Lead",
        department="Product",
        capability=(
            "milestone scoping and acceptance-criteria sharpening for a "
            "Plan derived from a Product Charter"
        ),
        deliverable=(
            "short critique (3-6 bullets) calling out vague milestones, "
            "missing acceptance criteria, and risky scope creep"
        ),
        constraints=["3-6 milestones total", "outcome-shaped, not task-shaped"],
    ),
    Requisition(
        gate="G2",
        issuing_lead="PM Lead",
        department="Strategy",
        capability=(
            "market-demand and competitor-move critique for a Plan derived "
            "from a Product Charter"
        ),
        deliverable=(
            "short critique (3-6 bullets) on demand evidence gaps, competitor "
            "exposure, and ignored adjacent use-cases"
        ),
        constraints=["cite at least one observable signal", "no hand-waving"],
    ),
]


async def _foundry_pairs(charter: dict[str, object]) -> list[tuple[str, str, str]]:
    settings = load_settings()
    foundry = Foundry(settings.runs_dir)
    title_val = charter.get("title", "")
    one_val = charter.get("one_liner", "")
    user_val = charter.get("target_user", "")
    title = title_val if isinstance(title_val, str) else ""
    one_liner = one_val if isinstance(one_val, str) else ""
    target_user = user_val if isinstance(user_val, str) else ""
    ctx = f"charter title: {title}; one_liner: {one_liner}; target_user: {target_user}"
    pairs: list[tuple[str, str, str]] = []
    for base in _REQUISITIONS:
        req = base.model_copy(update={"context_summary": ctx})
        spec = await foundry.hire(req)
        pairs.append((spec.title, spec.department, spec.one_liner))
    return pairs

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
    else:
        settings = load_settings()
        if settings.specialist_debate_enabled:
            specialists = (
                await _foundry_pairs(charter) if settings.foundry_enabled else _SPECIALISTS
            )
            artifact = await lead_revision_after_debate(
                gate="G2",
                dept="Product",
                lead_role="PM Lead",
                model=PM_MODEL,
                system=SYSTEM_PROMPT,
                base_prompt=base_prompt,
                draft=artifact,
                artifact_cls=Plan,
                specialists=specialists,
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
