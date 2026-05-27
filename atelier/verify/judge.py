"""Stage 3: LLM-as-judge — rubric-scored quality assessment.

The judge runs through the same LLMProvider, with a department-specific rubric.
"""

from __future__ import annotations

import json
import re

from atelier.llm.provider import LLMProvider

DEFAULT_RUBRIC = {
    "clarity": "Is the artifact unambiguous and free of contradictions?",
    "completeness": "Does it cover the brief without leaving holes?",
    "feasibility": "Is it realistically actionable inside Atelier's constraints?",
}


async def judge_score(
    *,
    provider: LLMProvider,
    artifact_text: str,
    department: str,
    rubric: dict[str, str] | None = None,
    model: str = "claude-opus-4-7",
) -> dict[str, float]:
    rubric = rubric or DEFAULT_RUBRIC
    rubric_block = "\n".join(f"- {k}: {v}" for k, v in rubric.items())
    system = (
        f"You are the Atelier Eval Officer judging a {department} artifact. "
        "Return a strict JSON object mapping each rubric criterion to a score in [0,1]."
    )
    prompt = (
        f"Rubric:\n{rubric_block}\n\nArtifact:\n{artifact_text}\n\n"
        "Respond with JSON only, no prose."
    )
    resp = await provider.complete(system=system, prompt=prompt, model=model, max_tokens=400)
    return _parse_scores(resp.text, rubric)


def _parse_scores(text: str, rubric: dict[str, str]) -> dict[str, float]:
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        return {k: 0.0 for k in rubric}
    try:
        data = json.loads(match.group(0))
    except json.JSONDecodeError:
        return {k: 0.0 for k in rubric}
    return {k: float(data.get(k, 0.0)) for k in rubric}
