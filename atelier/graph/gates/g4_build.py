"""G4 — Build gate. Eng Manager + Tech Lead + QA Lead drive implementation."""

from __future__ import annotations

from atelier.artifacts.code_review import CodeReview
from atelier.config import load_settings
from atelier.graph.gates._llm import call_gate_llm, verify_gate
from atelier.graph.gates._specialist import lead_revision_after_debate
from atelier.graph.state import CompanyState
from atelier.observability.tracer import trace_event
from atelier.roles.foundry import Foundry, Requisition

ENG_MODEL = "claude-opus-4-7"

_SPECIALISTS = [
    (
        "Tech Lead",
        "Engineering",
        "Verify architectural decisions, test coverage, and module boundaries.",
    ),
    (
        "Security Engineer",
        "Engineering",
        "Surface auth, input-validation, and secret-handling risks.",
    ),
]

_REQUISITIONS = [
    Requisition(
        gate="G4",
        issuing_lead="Eng Manager",
        department="Engineering",
        capability=(
            "architecture, test-coverage, and module-boundary critique for a "
            "first-build Code Review memo"
        ),
        deliverable=(
            "short critique (3-6 bullets) naming architectural smells, test "
            "gaps, and module boundary violations"
        ),
        constraints=["call out at least one concrete file or module"],
    ),
    Requisition(
        gate="G4",
        issuing_lead="Eng Manager",
        department="Engineering",
        capability=(
            "authentication, input-validation, and secret-handling threat "
            "model for a first-build Code Review memo"
        ),
        deliverable=(
            "short critique (3-6 bullets) naming auth risks, missing input "
            "validation, and secret-handling exposure"
        ),
        constraints=["use STRIDE categories where relevant"],
    ),
]


async def _foundry_pairs(
    plan: dict[str, object], prd: dict[str, object]
) -> list[tuple[str, str, str]]:
    settings = load_settings()
    foundry = Foundry(settings.runs_dir)
    title_val = plan.get("title", "")
    feat_val = prd.get("feature", "")
    title = title_val if isinstance(title_val, str) else ""
    feat = feat_val if isinstance(feat_val, str) else ""
    ctx = f"plan title: {title}; PRD feature: {feat}"
    pairs: list[tuple[str, str, str]] = []
    for base in _REQUISITIONS:
        req = base.model_copy(update={"context_summary": ctx})
        spec = await foundry.hire(req)
        pairs.append((spec.title, spec.department, spec.one_liner))
    return pairs

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
    base_prompt = (
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
    )
    artifact, used_llm, reason = await call_gate_llm(
        gate="G4",
        dept="Engineering",
        role="Eng Manager",
        model=ENG_MODEL,
        system=SYSTEM_PROMPT,
        prompt=base_prompt,
        artifact_cls=CodeReview,
        max_tokens=1500,
        quota_frac=0.02,
    )
    if artifact is None:
        trace_event("g4.build.fallback", reason=reason)
        artifact = _placeholder(feature)
    else:
        settings = load_settings()
        if settings.specialist_debate_enabled:
            specialists = (
                await _foundry_pairs(plan, prd_blob)
                if settings.foundry_enabled
                else _SPECIALISTS
            )
            artifact = await lead_revision_after_debate(
                gate="G4",
                dept="Engineering",
                lead_role="Eng Manager",
                model=ENG_MODEL,
                system=SYSTEM_PROMPT,
                base_prompt=base_prompt,
                draft=artifact,
                artifact_cls=CodeReview,
                specialists=specialists,
                max_tokens=1800,
            )

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
