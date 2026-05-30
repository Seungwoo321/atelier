"""Foundry tests — schema, seed conversion, cache, fallback."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from atelier.roles.foundry import (
    Foundry,
    Requisition,
    RoleSpec,
    Rubric,
    WorkingStyle,
    seed_role_specs,
)


def _minimal_spec(title: str = "UX Designer", dept: str = "Design") -> RoleSpec:
    return RoleSpec(
        title=title,
        department=dept,
        seniority="staff",
        one_liner="Produce wireframes and interaction specs.",
        expertise_domains=["interaction design", "wireframing", "accessibility"],
        quality_bar=Rubric(criteria=["clear states", "covers empty/error/loading"]),
        working_style=WorkingStyle(leads_with="prototype", cadence="weekly"),
    )


def test_rolespec_minimum_expertise_enforced() -> None:
    with pytest.raises(ValidationError):
        RoleSpec(
            title="Bad",
            department="Design",
            seniority="staff",
            one_liner="too thin to be real",
            expertise_domains=["only one"],
            quality_bar=Rubric(criteria=["a", "b"]),
            working_style=WorkingStyle(leads_with="document", cadence="async"),
        )


def test_rolespec_system_prompt_includes_quality_bar() -> None:
    spec = _minimal_spec()
    prompt = spec.to_system_prompt()
    assert "staff UX Designer" in prompt
    assert "interaction design" in prompt
    assert "Quality bar" in prompt
    assert "Working style" in prompt


def test_requisition_canonical_key_is_stable_under_whitespace() -> None:
    a = Requisition(
        gate="G3",
        issuing_lead="Design Lead",
        department="Design",
        capability="interaction design critique",
        deliverable="3-6 bullet critique",
    )
    b = Requisition(
        gate="G3",
        issuing_lead="Design Lead",
        department="Design",
        capability="  Interaction Design Critique  ",
        deliverable="3-6 BULLET   critique",
    )
    assert a.canonical_key() == b.canonical_key()


def test_seed_role_specs_covers_every_specialist() -> None:
    from atelier.roles.specialists import SPECIALISTS

    specs = seed_role_specs()
    assert len(specs) == len(SPECIALISTS)
    for s in specs:
        assert len(s.expertise_domains) >= 3
        assert s.origin == "seed"


def test_foundry_seed_lookup_hits_existing_role(tmp_path: Path) -> None:
    foundry = Foundry(tmp_path)
    req = Requisition(
        gate="G3",
        issuing_lead="Design Lead",
        department="Design",
        capability="wireframe interaction specs review",
        deliverable="critique on interaction gaps",
    )
    hit = foundry.lookup(req)
    assert hit is not None
    assert hit.department == "Design"


async def test_foundry_hire_falls_back_when_no_llm(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _no_llm(_req: Requisition) -> RoleSpec | None:
        return None

    foundry = Foundry(tmp_path)
    monkeypatch.setattr(foundry, "_hire_via_llm", _no_llm)
    req = Requisition(
        gate="G3",
        issuing_lead="Design Lead",
        department="Design",
        capability="totally novel capability with no overlap whatsoever zzzz",
        deliverable="something specific that has no cache hit zzzz",
    )
    result = await foundry.hire(req)
    assert result.department == "Design"
    assert result.origin == "seed"


def test_spec_judge_rejects_thin_spec() -> None:
    from atelier.roles.foundry.spec_judge import judge_role_spec

    thin = RoleSpec(
        title="Generic Analyst",
        department="Strategy",
        seniority="senior",
        one_liner="Provides domain expertise across topics.",
        expertise_domains=[
            "domain expertise",
            "cross-functional collaboration",
            "stakeholder synthesis",
        ],
        quality_bar=Rubric(criteria=["good", "ok"]),
        working_style=WorkingStyle(leads_with="document", cadence="weekly"),
    )
    verdict = judge_role_spec(thin)
    assert not verdict.passed
    assert verdict.score < 0.70
    assert verdict.issues


def test_spec_judge_passes_substantive_spec() -> None:
    from atelier.roles.foundry.spec import Framework
    from atelier.roles.foundry.spec_judge import judge_role_spec

    good = RoleSpec(
        title="Senior UX Researcher",
        department="Design",
        seniority="staff",
        one_liner="Diagnoses interaction-flow gaps before implementation.",
        expertise_domains=[
            "task-flow analysis",
            "WCAG 2.2 audits",
            "moderated usability testing",
        ],
        decision_frameworks=[
            Framework(name="Jobs-to-be-Done", when_to_apply="scoping new flows"),
        ],
        failure_modes=[
            "over-indexing on edge cases that drown the primary path",
            "skipping empty/error states in wireframes",
        ],
        anti_patterns=["shipping wireframes without keyboard order specified"],
        quality_bar=Rubric(
            criteria=[
                "every state has explicit copy and motion intent",
                "empty/error/loading states present for every screen",
            ]
        ),
        working_style=WorkingStyle(leads_with="prototype", cadence="weekly"),
        escalation_triggers=["accessibility violation found in lead-approved memo"],
    )
    verdict = judge_role_spec(good)
    assert verdict.passed
    assert verdict.score >= 0.70


async def test_foundry_retries_on_thin_spec(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    from atelier.roles.foundry.spec import Framework

    foundry = Foundry(tmp_path)
    thin = _minimal_spec(title="Hired Thin", dept="Strategy").model_copy(
        update={"origin": "hired"}
    )
    good = RoleSpec(
        title="Hired Good",
        department="Strategy",
        seniority="senior",
        one_liner="Pinpoints competitor moves before they hit the market.",
        expertise_domains=[
            "competitive intelligence",
            "market sizing",
            "go-to-market patterns",
        ],
        decision_frameworks=[
            Framework(name="Porter Five Forces", when_to_apply="entry assessment"),
        ],
        failure_modes=[
            "anchoring on a single competitor narrative",
            "ignoring substitutes outside the named category",
        ],
        anti_patterns=["citing analyst reports without primary signal"],
        quality_bar=Rubric(
            criteria=[
                "every claim cites an observable signal with a date",
                "trade-offs named with at least one falsifier",
            ]
        ),
        working_style=WorkingStyle(leads_with="analysis", cadence="weekly"),
        escalation_triggers=["competitor ships before our G4"],
        origin="hired",
    )
    calls: list[str] = []

    async def _attempt(
        _req: Requisition, prompt: str
    ) -> tuple[RoleSpec | None, str]:
        calls.append(prompt)
        return (thin if len(calls) == 1 else good), "ok"

    monkeypatch.setattr(foundry, "_attempt_hire", _attempt)
    req = Requisition(
        gate="G2",
        issuing_lead="PM Lead",
        department="Strategy",
        capability="competitor monitoring for a Plan",
        deliverable="3-6 bullet competitor critique",
    )
    out = await foundry._hire_via_llm(req)
    assert out is not None
    assert out.title == "Hired Good"
    assert len(calls) == 2


def test_foundry_persists_hired_specs(tmp_path: Path) -> None:
    foundry = Foundry(tmp_path)
    spec = _minimal_spec()
    spec_hired = spec.model_copy(update={"origin": "hired"})
    foundry._corpus["req:Design:fakekey"] = spec_hired
    foundry._save_corpus()
    assert foundry.cache_path.exists()
    payload = json.loads(foundry.cache_path.read_text(encoding="utf-8"))
    assert "req:Design:fakekey" in payload
    foundry2 = Foundry(tmp_path)
    assert "req:Design:fakekey" in foundry2._corpus
