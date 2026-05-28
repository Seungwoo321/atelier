"""G2 — Plan gate. PM Lead + Eng Manager produce roadmap + sprint plan."""

from __future__ import annotations

from atelier.artifacts.plan import Plan
from atelier.graph.gates._llm import call_gate_llm, verify_gate
from atelier.graph.state import CompanyState
from atelier.observability.tracer import trace_event

PM_MODEL = "claude-opus-4-7"

SYSTEM_PROMPT = (
    "You are the PM Lead at Atelier, working with the Eng Manager to turn a "
    "Product Charter into a small, executable Plan. "
    "Reply with a SINGLE JSON object and nothing else, matching exactly: "
    '{"title": str, "milestones": [str, ...], "risks": [str, ...], '
    '"owners": {<dept>: <role>, ...}}'
    " 3-6 milestones each a one-line outcome. 2-5 risks. owners maps dept "
    'name (Engineering, Design, QA, Marketing, Operations) to the lead role.'
)


def _placeholder(charter: dict) -> Plan:
    return Plan(
        title=charter.get("title", "Plan"),
        milestones=["G3 design memo", "G4 build review", "G5 launch memo"],
        risks=["Unverified user demand", "Quota exhaustion under load"],
    )


async def g2_plan(state: CompanyState) -> CompanyState:
    charter = state.get("charter") or {}
    trace_event("g2.plan.start", dept="Product", title=charter.get("title", ""))

    artifact, used_llm, reason = await call_gate_llm(
        gate="G2",
        dept="Product",
        role="PM Lead",
        model=PM_MODEL,
        system=SYSTEM_PROMPT,
        prompt=(
            "Product Charter:\n"
            f"title: {charter.get('title', '')}\n"
            f"one_liner: {charter.get('one_liner', '')}\n"
            f"problem: {charter.get('problem', '')}\n"
            f"target_user: {charter.get('target_user', '')}\n"
            "success_metrics:\n- "
            + "\n- ".join(charter.get("success_metrics", []) or ["-"])
        ),
        artifact_cls=Plan,
        max_tokens=1200,
        quota_frac=0.01,
    )
    if artifact is None:
        trace_event("g2.plan.fallback", reason=reason)
        artifact = _placeholder(charter)

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
