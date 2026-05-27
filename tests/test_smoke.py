"""Smoke tests — verify wiring of the v1.0 skeleton."""

from __future__ import annotations

import pytest

from atelier import __version__
from atelier.artifacts.charter import ProductCharter
from atelier.artifacts.launch import LaunchMemo
from atelier.budget import QuotaExceeded, QuotaGuard
from atelier.llm.provider import LLMProvider, get_provider


def test_version_is_v1() -> None:
    assert __version__ == "1.0.0"


def test_quota_guard_charge_and_cap() -> None:
    g = QuotaGuard(cap=0.20)
    g.charge("chief_of_staff", 0.05)
    g.charge("eng_manager", 0.10)
    assert g.used == pytest.approx(0.15)
    assert g.remaining() == pytest.approx(0.05)
    with pytest.raises(QuotaExceeded):
        g.charge("design_lead", 0.10)


def test_charter_schema_round_trip() -> None:
    c = ProductCharter(
        title="Weekly Retro CLI",
        one_liner="Automate weekly retrospectives for solo developers.",
        problem="Solo devs skip retros because the overhead is too high.",
        target_user="Solo indie developer",
        success_metrics=["≥1 retro/week for 4 consecutive weeks"],
    )
    assert c.title.startswith("Weekly")
    assert len(c.success_metrics) == 1


def test_launch_is_dry_run_by_default() -> None:
    m = LaunchMemo(
        feature="Weekly Retro CLI",
        channels=["blog"],
        success_metrics=["≥1 active user in week 1"],
    )
    assert m.dry_run is True


def test_provider_factory_accepts_known() -> None:
    # acp does not require claude-agent-sdk to instantiate.
    p = get_provider("acp")
    assert isinstance(p, LLMProvider)
    assert p.name == "acp"


def test_provider_factory_rejects_unknown() -> None:
    with pytest.raises(ValueError):
        get_provider("openai")
