"""Tests for the 4-stage verification pipeline."""

from __future__ import annotations

import pytest

from atelier.artifacts.charter import ProductCharter
from atelier.llm.provider import LLMResponse
from atelier.verify.critic import critic_check
from atelier.verify.guardrails import guardrails_check
from atelier.verify.run import run_verification
from atelier.verify.schema import schema_validate


def test_schema_passes_valid_charter() -> None:
    ok, err = schema_validate(
        ProductCharter,
        dict(
            title="x",
            one_liner="y",
            problem="z",
            target_user="u",
            success_metrics=["m1"],
        ),
    )
    assert ok and err is None


def test_schema_rejects_empty_success_metrics() -> None:
    ok, err = schema_validate(
        ProductCharter,
        dict(title="x", one_liner="y", problem="z", target_user="u", success_metrics=[]),
    )
    assert not ok and err is not None


def test_critic_flags_placeholders() -> None:
    ok, issues = critic_check("This is a TODO that needs work")
    assert not ok
    assert any("TODO" in i for i in issues)


def test_guardrails_flags_secrets() -> None:
    ok, issues = guardrails_check("here is a key: sk-AAAAAAAAAAAAAAAAAAAAAAAA")
    assert not ok
    assert any("secret" in i for i in issues)


class _StubProvider:
    name = "stub"

    async def complete(self, *, system, prompt, model, max_tokens=4096):  # type: ignore[no-untyped-def]
        return LLMResponse(
            text='{"clarity":0.9,"completeness":0.85,"feasibility":0.8}',
            model=model,
        )

    async def healthcheck(self) -> bool:
        return True


@pytest.mark.asyncio
async def test_full_pipeline_passes_clean_artifact() -> None:
    outcome = await run_verification(
        model=ProductCharter,
        data=dict(
            title="Weekly Retro CLI",
            one_liner="Automate weekly retrospectives for solo developers.",
            problem="Solo devs skip retros because the overhead is too high.",
            target_user="Solo indie developer",
            success_metrics=["≥1 retro/week"],
        ),
        artifact_text=(
            "Weekly Retro CLI helps solo developers run a weekly retrospective "
            "by generating prompts and capturing answers in markdown."
        ),
        department="Product",
        provider=_StubProvider(),
        judge_threshold=0.7,
    )
    assert outcome.passed, (outcome.stage, outcome.issues, outcome.scores)
