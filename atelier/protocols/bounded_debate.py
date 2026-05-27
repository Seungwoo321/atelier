"""Bounded Debate protocol — N=2 rounds, trigger when change-rate ≥ 30%."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field


@dataclass
class DebateResult:
    final_text: str
    rounds: int
    change_rates: list[float] = field(default_factory=list)


@dataclass
class BoundedDebate:
    rounds: int = 2
    change_rate_trigger: float = 0.30

    async def run(
        self,
        *,
        propose: Callable[[], Awaitable[str]],
        challenge: Callable[[str], Awaitable[str]],
    ) -> DebateResult:
        text = await propose()
        rates: list[float] = []
        for _ in range(self.rounds):
            revised = await challenge(text)
            rate = _change_rate(text, revised)
            rates.append(rate)
            text = revised
            if rate < self.change_rate_trigger:
                break
        return DebateResult(text, rounds=len(rates), change_rates=rates)


def _change_rate(a: str, b: str) -> float:
    a_tokens = a.split()
    b_tokens = b.split()
    if not a_tokens:
        return 1.0 if b_tokens else 0.0
    overlap = len(set(a_tokens) & set(b_tokens))
    union = len(set(a_tokens) | set(b_tokens))
    if union == 0:
        return 0.0
    return 1.0 - (overlap / union)
