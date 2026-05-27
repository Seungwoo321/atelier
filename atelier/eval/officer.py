"""Eval Officer — runs department-specific rubrics through the verify pipeline."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel

from atelier.llm.provider import LLMProvider
from atelier.verify.run import VerifyOutcome, run_verification

DEPT_RUBRICS: dict[str, dict[str, str]] = {
    "Product": {
        "clarity": "Are user stories and acceptance criteria unambiguous?",
        "priority": "Is prioritization rationale sound?",
        "completeness": "Do acceptance criteria cover the user story?",
    },
    "Engineering": {
        "clarity": "Is the code review summary specific and actionable?",
        "rigor": "Are SAST/lint/test gates listed and passing?",
        "risk_disclosure": "Are outstanding risks named honestly?",
    },
    "Design": {
        "ia_clarity": "Is information architecture clear?",
        "usability": "Does the flow respect cognitive load?",
        "consistency": "Are tokens consistent with the design system?",
    },
    "Strategy": {
        "evidence": "Are statistics and sources cited and recent?",
        "depth": "Is competitor and segment analysis non-superficial?",
        "actionability": "Does it lead to a clear BM or partner decision?",
    },
    "Marketing": {
        "clarity": "Is messaging unambiguous?",
        "cta_strength": "Is the call-to-action compelling?",
        "tone": "Is tone consistent with brand voice?",
    },
    "Operations": {
        "completeness": "Is the SOP free of gaps?",
        "accuracy": "Are reply templates factually correct?",
    },
    "QA": {
        "coverage": "Are test cases comprehensive?",
        "edge_cases": "Are edge cases enumerated?",
    },
    "Analytics": {
        "metric_quality": "Are metrics MECE and decision-relevant?",
        "rigor": "Are calculations reproducible?",
    },
    "Chief": {
        "consistency": "Is cross-dept communication coherent?",
        "discipline": "Are decisions logged with rationale?",
    },
}


class EvalOfficer:
    def __init__(self, provider: LLMProvider) -> None:
        self.provider = provider

    async def evaluate(
        self,
        *,
        model: type[BaseModel],
        data: dict[str, Any],
        artifact_text: str,
        department: str,
        judge_threshold: float = 0.70,
    ) -> VerifyOutcome:
        rubric = DEPT_RUBRICS.get(department)
        return await run_verification(
            model=model,
            data=data,
            artifact_text=artifact_text,
            department=department,
            provider=self.provider,
            judge_threshold=judge_threshold,
            rubric=rubric,
        )
