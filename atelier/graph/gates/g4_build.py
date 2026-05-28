"""G4 — Build gate. Eng Manager + Tech Lead + QA Lead drive implementation."""

from __future__ import annotations

from atelier.artifacts.code_review import CodeReview
from atelier.graph.gates._llm import call_gate_llm, verify_gate
from atelier.graph.state import CompanyState
from atelier.observability.tracer import trace_event

ENG_MODEL = "claude-opus-4-7"

SYSTEM_PROMPT = (
    "You are the Eng Manager at Atelier, partnering with the Tech Lead and QA "
    "Lead to draft a Code Review memo for the first build of a feature. "
    "Reply with a SINGLE JSON object and nothing else, matching exactly: "
    '{"feature": str, "summary": str, "passed_checks": [str, ...], '
    '"outstanding_risks": [str, ...]}'
    " summary 1-3 sentences on build state. passed_checks 2-6 concrete "
    "verifications (e.g. 'ruff', 'mypy --strict', 'pytest -q', "
    "'integration smoke on macOS'). outstanding_risks 1-5 specific risks "
    "with the dept that owns mitigation in parentheses."
)


def _placeholder(feature: str) -> CodeReview:
    return CodeReview(
        feature=feature,
        summary="Initial build complete; reviewer approvals pending.",
        passed_checks=["ruff", "mypy", "pytest"],
        outstanding_risks=[],
    )


async def g4_build(state: CompanyState) -> CompanyState:
    plan = state.get("plan") or {}
    design = state.get("design") or {}
    prds = state.get("prds") or []
    feature = plan.get("title") or (state.get("charter") or {}).get("title", "Feature")
    trace_event("g4.build.start", dept="Engineering", feature=feature)

    prd_blob = prds[0] if prds else {}
    artifact, used_llm, reason = await call_gate_llm(
        gate="G4",
        dept="Engineering",
        role="Eng Manager",
        model=ENG_MODEL,
        system=SYSTEM_PROMPT,
        prompt=(
            "Plan:\n"
            f"title: {feature}\n"
            "milestones:\n- "
            + "\n- ".join(plan.get("milestones", []) or ["-"])
            + "\n\nPRD:\n"
            f"feature: {prd_blob.get('feature', '')}\n"
            "acceptance_criteria:\n- "
            + "\n- ".join(prd_blob.get("acceptance_criteria", []) or ["-"])
            + "\n\nDesign IA:\n- "
            + "\n- ".join(design.get("information_architecture", []) or ["-"])
        ),
        artifact_cls=CodeReview,
        max_tokens=1500,
        quota_frac=0.02,
    )
    if artifact is None:
        trace_event("g4.build.fallback", reason=reason)
        artifact = _placeholder(feature)

    verify = await verify_gate(gate="G4", dept="Engineering", artifact=artifact)
    if verify.get("scores"):
        state.setdefault("eval_scores", {}).update(
            {f"G4.{k}": v for k, v in verify["scores"].items()}
        )
    state["code_review"] = artifact.model_dump()
    state.setdefault("notes", []).append(
        "g4: code review drafted" + (" (LLM)" if used_llm else " (placeholder)")
    )
    state["current_gate"] = "G4"
    trace_event("g4.build.done", dept="Engineering", used_llm=used_llm)
    return state
