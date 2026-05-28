"""Shared helpers for gates that call the LLM provider."""

from __future__ import annotations

import json
import re
from typing import Any, TypeVar

from pydantic import BaseModel, ValidationError

from atelier.budget import QuotaGuard
from atelier.config import load_settings
from atelier.eval.officer import DEPT_RUBRICS
from atelier.llm.provider import LLMProvider, get_provider
from atelier.memory.role import RoleMemory
from atelier.observability.tracer import trace_event
from atelier.verify.critic import critic_check
from atelier.verify.guardrails import guardrails_check
from atelier.verify.judge import judge_score

T = TypeVar("T", bound=BaseModel)

_FENCE = re.compile(r"```(?:json)?\s*(\{.*?\})\s*```", re.S)
_BARE = re.compile(r"\{.*\}", re.S)


def _recall_role_memory(settings: Any, gate: str, dept: str, role: str) -> str:
    if not settings.role_memory_enabled:
        return ""
    cap = settings.role_memory_max_facts
    if cap <= 0:
        return ""
    try:
        store = RoleMemory(settings.runs_dir, role).recall()
    except Exception:
        return ""
    if not store:
        return ""
    facts = list(store.keys())[-cap:]
    if not facts:
        return ""
    trace_event(
        "memory.role.recalled",
        gate=gate,
        dept=dept,
        role=role,
        facts=len(facts),
    )
    bullets = "\n".join(f"- {fact}" for fact in facts)
    return (
        f"Prior runs by {role} (most recent last):\n{bullets}\n\n"
        "Use these as background only; do not copy verbatim.\n\n"
    )


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
    reflexion: bool = True,
) -> tuple[T | None, bool, str | None]:
    """Call provider, parse JSON, validate into `artifact_cls`.

    Returns `(artifact, used_llm, fallback_reason)`. When `used_llm` is False,
    `artifact` is None and `fallback_reason` is set; callers should produce a
    placeholder. Emits `quota.charge` on success.

    When `reflexion` is true and ATELIER_REFLEXION_CAP > 0, deterministic
    critic failures trigger up to `cap` retries with the critique appended
    to the prompt. Each retry incurs another quota charge.
    """
    settings = load_settings()
    try:
        provider = get_provider(settings.llm_provider)
        if not await provider.healthcheck():
            return None, False, "provider_unconfigured"

        memory_block = _recall_role_memory(settings, gate, dept, role)

        cap = settings.reflexion_cap if reflexion else 0
        critique: str | None = None
        artifact: T | None = None

        for attempt in range(cap + 1):
            effective_prompt = prompt
            if memory_block:
                effective_prompt = memory_block + effective_prompt
            if critique:
                effective_prompt = (
                    effective_prompt
                    + "\n\nThe previous draft was rejected by the Atelier Critic. "
                    "Address every issue below and reply with a fresh JSON object only.\n"
                    f"Critic issues:\n- " + "\n- ".join([critique])
                )
            resp = await provider.complete(
                system=system,
                prompt=effective_prompt,
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
                attempt=attempt + 1,
            )

            if cap == 0:
                break
            text = artifact.model_dump_json(indent=2)
            ok, issues = critic_check(text)
            if ok:
                if attempt > 0:
                    trace_event(
                        "reflexion.recovered", gate=gate, dept=dept, attempt=attempt + 1
                    )
                break
            critique = "; ".join(issues)
            if attempt == cap:
                trace_event(
                    "reflexion.exhausted",
                    gate=gate,
                    dept=dept,
                    issues=issues,
                    attempts=attempt + 1,
                )
                break
            trace_event(
                "reflexion.retry",
                gate=gate,
                dept=dept,
                attempt=attempt + 1,
                issues=issues,
            )

        return artifact, True, None
    except (ValidationError, json.JSONDecodeError) as e:
        return None, False, f"parse:{type(e).__name__}"
    except Exception as e:  # noqa: BLE001
        return None, False, f"{type(e).__name__}:{str(e)[:80]}"


def _render_artifact(artifact: BaseModel) -> str:
    return artifact.model_dump_json(indent=2)


async def verify_gate(
    *,
    gate: str,
    dept: str,
    artifact: BaseModel,
    allow_emails: bool = False,
) -> dict[str, Any]:
    """Run the 4-stage verification on a gate artifact.

    Schema is implicit (already validated). Runs Critic + Guardrails
    deterministically; runs Judge only when `judge_enabled`. Emits
    `verify.<gate>.passed` or `verify.<gate>.failed` and returns the
    summary dict.
    """
    settings = load_settings()
    if not settings.verify_enabled:
        return {"skipped": True}

    text = _render_artifact(artifact)
    issues: list[str] = []
    stage = "passed"

    ok, critic_issues = critic_check(text)
    if not ok:
        stage = "critic"
        issues.extend(critic_issues)

    if stage == "passed":
        ok, gr_issues = guardrails_check(text, allow_emails=allow_emails)
        if not ok:
            stage = "guardrails"
            issues.extend(gr_issues)

    scores: dict[str, float] = {}
    if stage == "passed" and settings.judge_enabled:
        provider: LLMProvider = get_provider(settings.llm_provider)
        if await provider.healthcheck():
            try:
                scores = await judge_score(
                    provider=provider,
                    artifact_text=text,
                    department=dept,
                    rubric=DEPT_RUBRICS.get(dept),
                )
                if scores and min(scores.values()) < settings.judge_threshold:
                    stage = "judge"
                    issues.append(
                        f"judge below threshold {settings.judge_threshold}: {scores}"
                    )
            except Exception as e:  # noqa: BLE001
                issues.append(f"judge_error:{type(e).__name__}")

    passed = stage == "passed"
    trace_event(
        f"verify.{gate.lower()}." + ("passed" if passed else "failed"),
        gate=gate,
        dept=dept,
        stage=stage,
        issues=issues,
        scores=scores,
    )
    return {"passed": passed, "stage": stage, "issues": issues, "scores": scores}
