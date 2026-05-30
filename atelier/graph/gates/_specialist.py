"""Specialist dispatch helper — Sonnet-tier critique of a lead's draft."""

from __future__ import annotations

import json
from typing import TypeVar

from pydantic import BaseModel, ValidationError

from atelier.budget import QuotaGuard
from atelier.config import load_settings
from atelier.llm.provider import get_provider
from atelier.observability.tracer import trace_event
from atelier.protocols.bounded_debate import _change_rate
from atelier.roles.foundry.spec import RoleSpec

SPECIALIST_MODEL = "claude-sonnet-4-6"
M = TypeVar("M", bound=BaseModel)


async def specialist_challenge(
    *,
    gate: str,
    dept: str,
    specialist_name: str,
    mandate: str,
    artifact_text: str,
    quota_frac: float = 0.005,
    max_tokens: int = 600,
    role_spec: RoleSpec | None = None,
) -> str | None:
    """Ask a specialist (Sonnet tier) to challenge a lead's draft.

    Returns a short critique string, or None when the provider is
    unavailable or the call errors. Emits quota.charge and a
    specialist.<gate>.challenge event. When `role_spec` is provided the
    specialist runs under its full system prompt (Foundry path).
    """
    settings = load_settings()
    try:
        provider = get_provider(settings.llm_provider)
        if not await provider.healthcheck():
            return None
        if role_spec is not None:
            system = (
                role_spec.to_system_prompt()
                + "\n\nReview the lead's draft and reply with a SHORT critique "
                "(3-6 bullets, no preamble, no JSON) covering the most consequential "
                "gaps, risks, or ambiguities you would push back on in a working session."
            )
        else:
            system = (
                f"You are the {specialist_name} in the {dept} department at Atelier. "
                f"Your mandate: {mandate} "
                "Review the lead's draft and reply with a SHORT critique (3-6 bullets, "
                "no preamble, no JSON) covering the most consequential gaps, risks, or "
                "ambiguities you would push back on in a working session."
            )
        prompt = "Lead draft:\n" + artifact_text
        resp = await provider.complete(
            system=system,
            prompt=prompt,
            model=SPECIALIST_MODEL,
            max_tokens=max_tokens,
        )
        QuotaGuard(cap=settings.quota_cap).charge(dept, quota_frac)
        trace_event(
            "quota.charge",
            dept=dept,
            role=specialist_name,
            gate=gate,
            frac=quota_frac,
            input_tokens=resp.input_tokens,
            output_tokens=resp.output_tokens,
            tier="sonnet",
        )
        critique = resp.text.strip()
        trace_event(
            f"specialist.{gate.lower()}.challenge",
            gate=gate,
            dept=dept,
            specialist=specialist_name,
            chars=len(critique),
            via_spec=role_spec is not None,
            seniority=role_spec.seniority if role_spec else None,
        )
        return critique
    except Exception as e:  # noqa: BLE001
        trace_event(
            f"specialist.{gate.lower()}.error",
            gate=gate,
            dept=dept,
            specialist=specialist_name,
            error=f"{type(e).__name__}:{str(e)[:80]}",
        )
        return None


async def lead_revision_after_debate(
    *,
    gate: str,
    dept: str,
    lead_role: str,
    model: str,
    system: str,
    base_prompt: str,
    draft: M,
    artifact_cls: type[M],
    specialists: list[tuple[str, str, str]],
    revision_quota_frac: float = 0.01,
    specialist_quota_frac: float = 0.005,
    max_tokens: int = 1800,
) -> M:
    """Run one bounded-debate round: each specialist critiques `draft`, then the
    lead is asked to revise. Returns the revised artifact, or the original
    draft if the provider is unreachable or parsing fails. Emits
    `{gate.lower()}.{dept.lower()}.debate` with change_rate.
    """
    settings = load_settings()
    draft_text = draft.model_dump_json(indent=2)
    critiques: list[str] = []
    for name, sdept, mandate in specialists:
        crit = await specialist_challenge(
            gate=gate,
            dept=sdept,
            specialist_name=name,
            mandate=mandate,
            artifact_text=draft_text,
            quota_frac=specialist_quota_frac,
        )
        if crit:
            critiques.append(f"## {name}\n{crit}")
    if not critiques:
        return draft
    try:
        provider = get_provider(settings.llm_provider)
        if not await provider.healthcheck():
            return draft
        resp = await provider.complete(
            system=system + " Revise the prior draft to address every specialist critique.",
            prompt=(
                base_prompt
                + "\n\nPrior draft (JSON):\n"
                + draft_text
                + "\n\nSpecialist critiques:\n"
                + "\n\n".join(critiques)
                + "\n\nReturn the revised JSON object only."
            ),
            model=model,
            max_tokens=max_tokens,
        )
        raw = json.loads(resp.text.strip().removeprefix("```json").removesuffix("```").strip())
        revised = artifact_cls.model_validate(raw)
        QuotaGuard(cap=settings.quota_cap).charge(dept, revision_quota_frac)
        rate = _change_rate(draft_text, revised.model_dump_json(indent=2))
        trace_event(
            f"{gate.lower()}.{dept.lower()}.debate",
            dept=dept,
            role=lead_role,
            rounds=1,
            change_rate=round(rate, 3),
            specialists=[n for n, _, _ in specialists],
            input_tokens=resp.input_tokens,
            output_tokens=resp.output_tokens,
        )
        return revised
    except (ValidationError, json.JSONDecodeError) as e:
        trace_event(
            f"{gate.lower()}.{dept.lower()}.debate.parse_error",
            error=f"{type(e).__name__}",
        )
        return draft
    except Exception as e:
        trace_event(
            f"{gate.lower()}.{dept.lower()}.debate.error",
            error=f"{type(e).__name__}:{str(e)[:80]}",
        )
        return draft
