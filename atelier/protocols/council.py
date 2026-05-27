"""Cross-Dept Council — PM Lead deciding vote, ≥20% disagreement threshold.

Chief of Staff facilitates; Eval Officer scores; PM Lead breaks ties.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field


@dataclass
class CouncilOutcome:
    decision: str
    rationale: str
    votes: dict[str, str] = field(default_factory=dict)
    deciding_vote_used: bool = False


@dataclass
class CrossDeptCouncil:
    disagreement_threshold: float = 0.20

    async def decide(
        self,
        *,
        options: list[str],
        voters: list[str],
        cast_vote: Callable[[str, list[str]], Awaitable[str]],
        deciding_voter: str = "PM Lead",
    ) -> CouncilOutcome:
        votes: dict[str, str] = {}
        for v in voters:
            votes[v] = await cast_vote(v, options)
        counts: dict[str, int] = {}
        for choice in votes.values():
            counts[choice] = counts.get(choice, 0) + 1
        top = max(counts, key=lambda k: counts[k])
        top_share = counts[top] / max(1, len(voters))
        if (1 - top_share) >= self.disagreement_threshold and deciding_voter in votes:
            return CouncilOutcome(
                decision=votes[deciding_voter],
                rationale=f"{deciding_voter} deciding vote (disagreement ≥{self.disagreement_threshold:.0%})",
                votes=votes,
                deciding_vote_used=True,
            )
        return CouncilOutcome(
            decision=top,
            rationale=f"plurality {counts[top]}/{len(voters)}",
            votes=votes,
            deciding_vote_used=False,
        )
