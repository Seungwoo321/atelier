"""Run the full 4-stage verification pipeline."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from pydantic import BaseModel

from atelier.llm.provider import LLMProvider
from atelier.verify.critic import critic_check
from atelier.verify.guardrails import guardrails_check
from atelier.verify.judge import judge_score
from atelier.verify.schema import schema_validate


@dataclass
class VerifyOutcome:
    passed: bool
    stage: str
    issues: list[str] = field(default_factory=list)
    scores: dict[str, float] = field(default_factory=dict)


async def run_verification(
    *,
    model: type[BaseModel],
    data: dict[str, Any],
    artifact_text: str,
    department: str,
    provider: LLMProvider | None = None,
    judge_threshold: float = 0.70,
    rubric: dict[str, str] | None = None,
) -> VerifyOutcome:
    ok, err = schema_validate(model, data)
    if not ok:
        return VerifyOutcome(False, "schema", [err or "schema invalid"])

    ok, issues = critic_check(artifact_text)
    if not ok:
        return VerifyOutcome(False, "critic", issues)

    scores: dict[str, float] = {}
    if provider is not None:
        scores = await judge_score(
            provider=provider,
            artifact_text=artifact_text,
            department=department,
            rubric=rubric,
        )
        if scores and min(scores.values()) < judge_threshold:
            return VerifyOutcome(False, "judge", ["judge below threshold"], scores)

    ok, issues = guardrails_check(artifact_text)
    if not ok:
        return VerifyOutcome(False, "guardrails", issues, scores)

    return VerifyOutcome(True, "passed", [], scores)
