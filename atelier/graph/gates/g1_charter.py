"""G1 — Charter gate. Chief of Staff produces the one-page charter."""

from __future__ import annotations

import json
import re
from typing import Any

from pydantic import ValidationError

from atelier.artifacts.charter import ProductCharter
from atelier.budget import QuotaGuard
from atelier.config import load_settings
from atelier.graph.state import CompanyState
from atelier.llm.provider import get_provider
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


def _strip_codefence(text: str) -> str:
    m = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.S)
    if m:
        return m.group(1)
    m2 = re.search(r"\{.*\}", text, re.S)
    return m2.group(0) if m2 else text.strip()


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
    trace_event("g1.charter.start", request=request[:120])

    settings = load_settings()
    quota = QuotaGuard(cap=settings.quota_cap)
    provider_name = settings.llm_provider
    charter: ProductCharter
    used_llm = False

    try:
        provider = get_provider(provider_name)
        if await provider.healthcheck():
            resp = await provider.complete(
                system=SYSTEM_PROMPT,
                prompt=f"User request:\n\n{request}",
                model=CHIEF_MODEL,
                max_tokens=1024,
            )
            raw: Any = json.loads(_strip_codefence(resp.text))
            charter = ProductCharter.model_validate(raw)
            quota.charge("Chief", 0.01)
            trace_event(
                "quota.charge",
                dept="Chief",
                role="Chief of Staff",
                frac=0.01,
                input_tokens=resp.input_tokens,
                output_tokens=resp.output_tokens,
            )
            used_llm = True
        else:
            trace_event("g1.charter.fallback", reason="provider_unconfigured")
            charter = _placeholder(request)
    except (ValidationError, json.JSONDecodeError, RuntimeError, Exception) as e:
        trace_event("g1.charter.fallback", reason=type(e).__name__, detail=str(e)[:200])
        charter = _placeholder(request)

    state["charter"] = charter.model_dump()
    state.setdefault("notes", []).append(
        "g1: charter drafted" + (" (LLM)" if used_llm else " (placeholder)")
    )
    state["current_gate"] = "G1"
    trace_event("g1.charter.done", dept="Chief", used_llm=used_llm)
    return state
