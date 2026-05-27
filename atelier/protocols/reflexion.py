"""Reflexion protocol — iterative self-correction (cap=3, threshold ≥10%)."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field


@dataclass
class ReflexionResult:
    final_text: str
    iterations: int
    scores: list[float] = field(default_factory=list)
    converged: bool = False


@dataclass
class Reflexion:
    cap: int = 3
    threshold: float = 0.10

    async def run(
        self,
        *,
        produce: Callable[[str | None], Awaitable[tuple[str, float]]],
        critique: Callable[[str], Awaitable[str | None]],
    ) -> ReflexionResult:
        """Iterate produce → critique up to `cap` times.

        - `produce(prev_critique)` returns (artifact_text, score).
        - `critique(artifact_text)` returns a critique string or None when satisfied.
        Stop early when consecutive score improvement < `threshold`.
        """
        prev_critique: str | None = None
        prev_score = -1.0
        scores: list[float] = []
        text = ""
        for i in range(1, self.cap + 1):
            text, score = await produce(prev_critique)
            scores.append(score)
            crit = await critique(text)
            if crit is None:
                return ReflexionResult(text, i, scores, converged=True)
            if prev_score >= 0 and (score - prev_score) < self.threshold:
                return ReflexionResult(text, i, scores, converged=False)
            prev_score = score
            prev_critique = crit
        return ReflexionResult(text, self.cap, scores, converged=False)
