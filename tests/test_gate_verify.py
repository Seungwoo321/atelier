"""Tests for verify_gate: Critic + Guardrails on artifact text."""

from __future__ import annotations

import pytest

from atelier.artifacts.charter import ProductCharter
from atelier.artifacts.launch import LaunchMemo
from atelier.graph.gates._llm import verify_gate


@pytest.mark.asyncio
async def test_verify_gate_passes_clean_artifact() -> None:
    charter = ProductCharter(
        title="Weekly Retro CLI for Indie Developers",
        one_liner="Automate weekly retrospectives for solo developers using a tiny CLI.",
        problem="Solo developers skip retrospectives because the manual overhead is too high.",
        target_user="Solo indie developer running multiple small repos.",
        success_metrics=["≥1 retro/week for 4 consecutive weeks per active user"],
    )
    out = await verify_gate(gate="G1", dept="Chief", artifact=charter)
    assert out["passed"] is True
    assert out["stage"] == "passed"
    assert out["issues"] == []


@pytest.mark.asyncio
async def test_verify_gate_blocks_pii_in_artifact() -> None:
    memo = LaunchMemo(
        feature="Pingstack",
        channels=["contact us at hello@example.com for early access"],
        success_metrics=["≥1 user in week 1"],
    )
    out = await verify_gate(gate="G5", dept="Marketing", artifact=memo)
    assert out["passed"] is False
    assert out["stage"] == "guardrails"
    assert any("email" in issue.lower() for issue in out["issues"])


@pytest.mark.asyncio
async def test_verify_gate_flags_unresolved_placeholders() -> None:
    memo = LaunchMemo(
        feature="TODO: feature name",
        channels=["blog"],
        success_metrics=["≥1 user"],
    )
    out = await verify_gate(gate="G5", dept="Marketing", artifact=memo)
    assert out["passed"] is False
    assert out["stage"] == "critic"
    assert any("TODO" in issue for issue in out["issues"])
