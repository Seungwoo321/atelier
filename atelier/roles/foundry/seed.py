"""Seed corpus — convert the legacy specialists list into RoleSpec instances.

These are the cold-start examples the Foundry consults before issuing a new
hire request. They keep behavior continuous with the pre-Foundry codebase
while exposing the typed spec surface to downstream callers.
"""

from __future__ import annotations

from atelier.roles.foundry.spec import RoleSpec, Rubric, WorkingStyle
from atelier.roles.specialists import SPECIALISTS

_DEPT_EXPERTISE: dict[str, list[str]] = {
    "Strategy": ["market sizing", "competitive positioning", "go-to-market"],
    "Product": ["jobs-to-be-done", "PRD authorship", "release planning"],
    "Design": ["interaction design", "design systems", "accessibility (WCAG 2.2)"],
    "Engineering": ["systems design", "code review", "operational excellence"],
    "QA": ["risk-based testing", "test automation", "defect triage"],
    "Marketing": ["positioning", "channel selection", "lifecycle messaging"],
    "Operations": ["SOP authorship", "support workflows", "incident response"],
    "Analytics": ["measurement plans", "experiment design", "KPI hygiene"],
    "Chief": ["facilitation", "decision logs", "narrative writing"],
}


def _rubric(name: str) -> Rubric:
    return Rubric(
        criteria=[
            f"{name} output is concrete and decision-grade, not aspirational.",
            "Every recommendation carries a measurable target or explicit rationale.",
            "Edge cases and counter-examples are acknowledged, not glossed over.",
        ],
        failing_when=[
            "Generic advice that could apply to any product.",
            "No measurable signals, costs, or trade-offs surfaced.",
        ],
    )


def _style() -> WorkingStyle:
    return WorkingStyle(leads_with="document", cadence="async-default, sync for blockers")


def seed_role_specs() -> list[RoleSpec]:
    specs: list[RoleSpec] = []
    for dept, name, mandate, tools in SPECIALISTS:
        base = _DEPT_EXPERTISE.get(dept, ["domain expertise", "stakeholder synthesis"])
        expertise = list(base)
        slug = name.lower()
        if not any(slug.split()[0] in d.lower() for d in expertise):
            expertise.append(f"{slug} craft")
        while len(expertise) < 3:
            expertise.append("cross-functional collaboration")
        specs.append(
            RoleSpec(
                title=name,
                department=dept,
                seniority="staff",
                one_liner=mandate,
                expertise_domains=expertise[:5],
                quality_bar=_rubric(name),
                working_style=_style(),
                tools=list(tools),
                origin="seed",
            )
        )
    return specs
