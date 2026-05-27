"""Smoke tests — verify Phase A skeleton wiring."""

from __future__ import annotations

import pytest

from atelier import __version__
from atelier.artifacts.charter import ProductCharter
from atelier.budget import QuotaExceeded, QuotaGuard
from atelier.llm.provider import LLMProvider, get_provider


def test_version_present() -> None:
    assert __version__


def test_quota_guard_charge_and_cap() -> None:
    g = QuotaGuard(cap=0.20)
    g.charge("chief_of_staff", 0.05)
    g.charge("eng_lead", 0.10)
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


def test_provider_factory_returns_protocol() -> None:
    for name in ("sdk", "acp"):
        provider = get_provider(name)
        assert isinstance(provider, LLMProvider)
        assert provider.name == name


def test_provider_factory_rejects_unknown() -> None:
    with pytest.raises(ValueError):
        get_provider("openai")
