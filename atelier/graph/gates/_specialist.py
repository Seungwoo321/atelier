"""Specialist dispatch helper — Sonnet-tier critique of a lead's draft."""

from __future__ import annotations

from atelier.budget import QuotaGuard
from atelier.config import load_settings
from atelier.llm.provider import get_provider
from atelier.observability.tracer import trace_event

SPECIALIST_MODEL = "claude-sonnet-4-6"


async def specialist_challenge(
    *,
    gate: str,
    dept: str,
    specialist_name: str,
    mandate: str,
    artifact_text: str,
    quota_frac: float = 0.005,
    max_tokens: int = 600,
) -> str | None:
    """Ask a specialist (Sonnet tier) to challenge a lead's draft.

    Returns a short critique string, or None when the provider is
    unavailable or the call errors. Emits quota.charge and a
    specialist.<gate>.challenge event.
    """
    settings = load_settings()
    try:
        provider = get_provider(settings.llm_provider)
        if not await provider.healthcheck():
            return None
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
