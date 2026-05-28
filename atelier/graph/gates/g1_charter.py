"""G1 — Charter gate. Chief of Staff produces the one-page charter."""

from __future__ import annotations

from atelier.artifacts.charter import ProductCharter
from atelier.graph.gates._llm import call_gate_llm, verify_gate
from atelier.graph.state import CompanyState
from atelier.observability.tracer import trace_event

CHIEF_MODEL = "claude-opus-4-7"

SYSTEM_PROMPT = (
    "You are the Chief of Staff at Atelier, a virtual product company. "
    "Given a single user request, produce a tight one-page Product Charter. "
    "Reply with a SINGLE JSON object and nothing else, matching exactly this shape: "
    '{"title": str, "one_liner": str, "problem": str, "target_user": str, '
    '"success_metrics": [str, ...], "non_goals": [str, ...], "constraints": [str, ...]}'
    " title <= 120 chars. one_liner <= 240 chars. success_metrics 1-5 items."
)


def _placeholder(request: str) -> ProductCharter:
    title = request.strip().splitlines()[0][:120] if request else "Untitled"
    return ProductCharter(
        title=title,
        one_liner=request[:240] or title,
        problem="To be elaborated by Chief of Staff.",
        target_user="To be elaborated by PM Lead at G2.",
        success_metrics=["At least one usable artifact delivered end-to-end."],
    )


async def g1_charter(state: CompanyState) -> CompanyState:
    request = state.get("request", "")
    trace_event("g1.charter.start", dept="Chief", request=request[:120])

    artifact, used_llm, reason = await call_gate_llm(
        gate="G1",
        dept="Chief",
        role="Chief of Staff",
        model=CHIEF_MODEL,
        system=SYSTEM_PROMPT,
        prompt=f"User request:\n\n{request}",
        artifact_cls=ProductCharter,
        max_tokens=1500,
        quota_frac=0.01,
    )
    if artifact is None:
        trace_event("g1.charter.fallback", reason=reason)
        artifact = _placeholder(request)

    verify = await verify_gate(gate="G1", dept="Chief", artifact=artifact)
    if verify.get("scores"):
        state.setdefault("eval_scores", {}).update(
            {f"G1.{k}": v for k, v in verify["scores"].items()}
        )
    state["charter"] = artifact.model_dump()
    state.setdefault("notes", []).append(
        "g1: charter drafted" + (" (LLM)" if used_llm else " (placeholder)")
    )
    state["current_gate"] = "G1"
    trace_event("g1.charter.done", dept="Chief", used_llm=used_llm)
    return state
