"""Shared helpers for gates that call the LLM provider."""

from __future__ import annotations

import json
import re
from typing import Any, TypeVar

from pydantic import BaseModel, ValidationError

from atelier.budget import QuotaGuard
from atelier.config import load_settings
from atelier.llm.provider import get_provider
from atelier.observability.tracer import trace_event

T = TypeVar("T", bound=BaseModel)

_FENCE = re.compile(r"```(?:json)?\s*(\{.*?\})\s*```", re.S)
_BARE = re.compile(r"\{.*\}", re.S)


def strip_codefence(text: str) -> str:
    m = _FENCE.search(text)
    if m:
        return m.group(1)
    m2 = _BARE.search(text)
    return m2.group(0) if m2 else text.strip()


async def call_gate_llm(
    *,
    gate: str,
    dept: str,
    role: str,
    model: str,
    system: str,
    prompt: str,
    artifact_cls: type[T],
    max_tokens: int = 1500,
    quota_frac: float = 0.01,
) -> tuple[T | None, bool, str | None]:
    """Call provider, parse JSON, validate into `artifact_cls`.

    Returns `(artifact, used_llm, fallback_reason)`. When `used_llm` is False,
    `artifact` is None and `fallback_reason` is set; callers should produce a
    placeholder. Emits `quota.charge` on success.
    """
    settings = load_settings()
    try:
        provider = get_provider(settings.llm_provider)
        if not await provider.healthcheck():
            return None, False, "provider_unconfigured"
        resp = await provider.complete(
            system=system,
            prompt=prompt,
            model=model,
            max_tokens=max_tokens,
        )
        raw: Any = json.loads(strip_codefence(resp.text))
        artifact = artifact_cls.model_validate(raw)
        QuotaGuard(cap=settings.quota_cap).charge(dept, quota_frac)
        trace_event(
            "quota.charge",
            dept=dept,
            role=role,
            gate=gate,
            frac=quota_frac,
            input_tokens=resp.input_tokens,
            output_tokens=resp.output_tokens,
        )
        return artifact, True, None
    except (ValidationError, json.JSONDecodeError) as e:
        return None, False, f"parse:{type(e).__name__}"
    except Exception as e:  # noqa: BLE001
        return None, False, f"{type(e).__name__}:{str(e)[:80]}"
