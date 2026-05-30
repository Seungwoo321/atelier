"""Spec Judge — deterministic quality gate on a hired RoleSpec.

Catches thin specs (label without substance) before they reach the dispatch
path. Returns a verdict with score in [0, 1] plus an issues list. A hired
spec below `pass_threshold` triggers one Reflexion retry in the Foundry.
"""

from __future__ import annotations

from dataclasses import dataclass

from atelier.roles.foundry.spec import RoleSpec

PASS_THRESHOLD = 0.70

_GENERIC_PHRASES = (
    "domain expertise",
    "cross-functional collaboration",
    "stakeholder synthesis",
    "industry best practices",
    "subject matter expert",
)


@dataclass(frozen=True)
class JudgeVerdict:
    score: float
    issues: list[str]
    passed: bool


def judge_role_spec(spec: RoleSpec) -> JudgeVerdict:
    issues: list[str] = []
    checks_passed = 0
    total_checks = 6

    if len(spec.expertise_domains) >= 3:
        generic = sum(
            1
            for d in spec.expertise_domains
            if any(p in d.lower() for p in _GENERIC_PHRASES)
        )
        if generic <= len(spec.expertise_domains) // 2:
            checks_passed += 1
        else:
            issues.append("expertise_domains skews toward generic phrases")
    else:
        issues.append("fewer than 3 expertise_domains")

    if len(spec.decision_frameworks) >= 1:
        checks_passed += 1
    else:
        issues.append("no decision_frameworks named — spec lacks methodology")

    if len(spec.failure_modes) >= 2:
        checks_passed += 1
    else:
        issues.append("fewer than 2 failure_modes — spec does not warn against own pitfalls")

    if len(spec.anti_patterns) >= 1:
        checks_passed += 1
    else:
        issues.append("no anti_patterns — spec does not forbid known bad behavior")

    if len(spec.quality_bar.criteria) >= 2 and all(
        len(c) >= 20 for c in spec.quality_bar.criteria
    ):
        checks_passed += 1
    else:
        issues.append("quality_bar.criteria too thin — fewer than 2 items or items shorter than 20 chars")

    if len(spec.escalation_triggers) >= 1:
        checks_passed += 1
    else:
        issues.append("no escalation_triggers — spec does not know when to surface to lead")

    score = checks_passed / total_checks
    return JudgeVerdict(
        score=round(score, 3),
        issues=issues,
        passed=score >= PASS_THRESHOLD,
    )
