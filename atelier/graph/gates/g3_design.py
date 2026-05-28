"""G3 — Design gate. Design Lead + PM specialists produce PRDs + Design memo."""

from __future__ import annotations

import json
from typing import Any

from pydantic import BaseModel, ValidationError

from atelier.artifacts.design import DesignMemo
from atelier.artifacts.prd import PRD
from atelier.budget import QuotaGuard
from atelier.config import load_settings
from atelier.graph.gates._llm import strip_codefence, verify_gate
from atelier.graph.gates._specialist import specialist_challenge
from atelier.graph.state import CompanyState
from atelier.llm.provider import get_provider
from atelier.observability.tracer import trace_event
from atelier.protocols.bounded_debate import _change_rate

DESIGN_MODEL = "claude-opus-4-7"


class G3Bundle(BaseModel):
    """G3 produces both a PRD and a DesignMemo; we ask for them together."""

    prd: PRD
    design: DesignMemo


SYSTEM_PROMPT = (
    "You are the Design Lead at Atelier, partnering with the PM Specialist to "
    "translate a Plan into a single feature's PRD and a Design Memo. "
    "Reply with a SINGLE JSON object and nothing else, matching exactly: "
    '{"prd": {"feature": str, "user_stories": [str, ...], '
    '"acceptance_criteria": [str, ...], "out_of_scope": [str, ...]}, '
    '"design": {"feature": str, "information_architecture": [str, ...], '
    '"wireframe_notes": str, "tokens": {<name>: <string-value>, ...}}}'
    " user_stories 3-6 'As a <role>, I can <verb> <object>.' format. "
    "acceptance_criteria 3-6 testable bullets. information_architecture "
    "3-6 top-level screens or sections. tokens optional design tokens; "
    'ALL token VALUES must be JSON strings (e.g. "#7c3aed", "16px", "1.25"), '
    "never numbers or objects. If unsure, return tokens as {}."
)


def _coerce_token_values(raw: Any) -> None:
    """Coerce non-string token values to strings; drop nested objects."""
    if not isinstance(raw, dict):
        return
    design = raw.get("design")
    if not isinstance(design, dict):
        return
    tokens = design.get("tokens")
    if not isinstance(tokens, dict):
        design["tokens"] = {}
        return
    design["tokens"] = {
        str(k): str(v) for k, v in tokens.items() if not isinstance(v, (dict, list))
    }


def _placeholder(title: str) -> G3Bundle:
    return G3Bundle(
        prd=PRD(
            feature=title,
            user_stories=[f"As a user, I can {title.lower()}."],
            acceptance_criteria=["Feature can be exercised end-to-end without errors."],
        ),
        design=DesignMemo(
            feature=title,
            information_architecture=["Home", "Detail", "Settings"],
            wireframe_notes="Single-page flow with progressive disclosure.",
        ),
    )


_SPECIALISTS = [
    ("UX Designer", "Design", "Produce wireframes and interaction specs."),
    ("UI Designer", "Design", "Produce visual mocks and component tokens."),
]


async def _run_specialist_debate(
    bundle: G3Bundle,
    charter: dict[str, Any],
    plan: dict[str, Any],
) -> G3Bundle:
    """One round of BoundedDebate: specialists critique, Lead revises."""
    settings = load_settings()
    critiques: list[str] = []
    for name, dept, mandate in _SPECIALISTS:
        crit = await specialist_challenge(
            gate="G3",
            dept=dept,
            specialist_name=name,
            mandate=mandate,
            artifact_text=bundle.model_dump_json(indent=2),
            quota_frac=0.005,
        )
        if crit:
            critiques.append(f"## {name}\n{crit}")
    if not critiques:
        return bundle

    try:
        provider = get_provider(settings.llm_provider)
        if not await provider.healthcheck():
            return bundle
        before = bundle.model_dump_json(indent=2)
        resp = await provider.complete(
            system=SYSTEM_PROMPT
            + " Revise the prior draft to address every specialist critique.",
            prompt=(
                "Charter:\n"
                f"title: {charter.get('title', '')}\n"
                f"one_liner: {charter.get('one_liner', '')}\n"
                f"target_user: {charter.get('target_user', '')}\n\n"
                "Plan:\n"
                f"title: {plan.get('title', '')}\n"
                "milestones:\n- "
                + "\n- ".join(plan.get("milestones", []) or ["-"])
                + "\n\nPrior draft (JSON):\n"
                + before
                + "\n\nSpecialist critiques:\n"
                + "\n\n".join(critiques)
                + "\n\nReturn the revised JSON object only."
            ),
            model=DESIGN_MODEL,
            max_tokens=2400,
        )
        raw: Any = json.loads(strip_codefence(resp.text))
        _coerce_token_values(raw)
        revised = G3Bundle.model_validate(raw)
        QuotaGuard(cap=settings.quota_cap).charge("Design", 0.01)
        rate = _change_rate(before, revised.model_dump_json(indent=2))
        trace_event(
            "g3.design.debate",
            dept="Design",
            rounds=1,
            change_rate=round(rate, 3),
            specialists=[n for n, _, _ in _SPECIALISTS],
            input_tokens=resp.input_tokens,
            output_tokens=resp.output_tokens,
        )
        return revised
    except (ValidationError, json.JSONDecodeError) as e:
        trace_event("g3.design.debate.parse_error", error=f"{type(e).__name__}")
        return bundle
    except Exception as e:  # noqa: BLE001
        trace_event(
            "g3.design.debate.error", error=f"{type(e).__name__}:{str(e)[:80]}"
        )
        return bundle


async def g3_design(state: CompanyState) -> CompanyState:
    charter = state.get("charter") or {}
    plan = state.get("plan") or {}
    title = charter.get("title", "Feature")
    trace_event("g3.design.start", dept="Design", title=title)

    bundle: G3Bundle | None = None
    used_llm = False
    reason: str | None = None
    settings = load_settings()
    try:
        provider = get_provider(settings.llm_provider)
        if not await provider.healthcheck():
            reason = "provider_unconfigured"
        else:
            resp = await provider.complete(
                system=SYSTEM_PROMPT,
                prompt=(
                    "Charter:\n"
                    f"title: {title}\n"
                    f"one_liner: {charter.get('one_liner', '')}\n"
                    f"target_user: {charter.get('target_user', '')}\n\n"
                    "Plan:\n"
                    f"title: {plan.get('title', '')}\n"
                    "milestones:\n- "
                    + "\n- ".join(plan.get("milestones", []) or ["-"])
                ),
                model=DESIGN_MODEL,
                max_tokens=2400,
            )
            raw: Any = json.loads(strip_codefence(resp.text))
            _coerce_token_values(raw)
            bundle = G3Bundle.model_validate(raw)
            QuotaGuard(cap=settings.quota_cap).charge("Design", 0.015)
            trace_event(
                "quota.charge",
                dept="Design",
                role="Design Lead",
                gate="G3",
                frac=0.015,
                input_tokens=resp.input_tokens,
                output_tokens=resp.output_tokens,
            )
            used_llm = True
    except (ValidationError, json.JSONDecodeError) as e:
        reason = f"parse:{type(e).__name__}"
    except Exception as e:  # noqa: BLE001
        reason = f"{type(e).__name__}:{str(e)[:80]}"

    if bundle is None:
        trace_event("g3.design.fallback", reason=reason)
        bundle = _placeholder(title)
    elif settings.specialist_debate_enabled:
        bundle = await _run_specialist_debate(bundle, charter, plan)

    verify_prd = await verify_gate(gate="G3", dept="Product", artifact=bundle.prd)
    verify_design = await verify_gate(gate="G3", dept="Design", artifact=bundle.design)
    scores: dict[str, float] = {}
    scores.update({f"G3.prd.{k}": v for k, v in (verify_prd.get("scores") or {}).items()})
    scores.update({f"G3.design.{k}": v for k, v in (verify_design.get("scores") or {}).items()})
    if scores:
        state.setdefault("eval_scores", {}).update(scores)
    state.setdefault("prds", []).append(bundle.prd.model_dump())
    state["design"] = bundle.design.model_dump()
    state.setdefault("notes", []).append(
        "g3: prd + design drafted" + (" (LLM)" if used_llm else " (placeholder)")
    )
    state["current_gate"] = "G3"
    trace_event("g3.design.done", dept="Design", used_llm=used_llm)
    return state
