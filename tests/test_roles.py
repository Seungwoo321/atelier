"""Roster sanity tests."""

from __future__ import annotations

from atelier.llm.acp_client import ACPProvider
from atelier.roles import build_leads, build_specialists


def test_nine_leads_with_unique_departments() -> None:
    leads = build_leads(ACPProvider())
    assert len(leads) == 9
    assert {l.department for l in leads.values()} == {
        "Chief", "Strategy", "Product", "Design", "Engineering",
        "QA", "Marketing", "Operations", "Analytics",
    }


def test_specialists_cover_all_non_chief_departments() -> None:
    specs = build_specialists(ACPProvider())
    depts = {s.department for s in specs}
    # Every non-Chief department contributes specialists; Chief group is
    # represented by Memory Keeper + Eval Officer.
    for d in ("Strategy", "Product", "Design", "Engineering", "QA",
              "Marketing", "Operations", "Analytics", "Chief"):
        assert d in depts, d


def test_every_role_carries_a_mandate() -> None:
    for role in build_specialists(ACPProvider()):
        assert role.mandate, role.name
