"""Tests for the 4 decision protocols."""

from __future__ import annotations

import pytest

from atelier.protocols.bounded_debate import BoundedDebate
from atelier.protocols.council import CrossDeptCouncil
from atelier.protocols.janitor import JanitorMemo
from atelier.protocols.reflexion import Reflexion


@pytest.mark.asyncio
async def test_reflexion_converges_when_critique_returns_none() -> None:
    async def produce(_prev_critique: str | None) -> tuple[str, float]:
        return "artifact v1", 0.9

    async def critique(_text: str) -> str | None:
        return None

    out = await Reflexion().run(produce=produce, critique=critique)
    assert out.converged is True
    assert out.iterations == 1


@pytest.mark.asyncio
async def test_reflexion_stops_on_low_improvement() -> None:
    scores = iter([0.5, 0.55])

    async def produce(_prev_critique: str | None) -> tuple[str, float]:
        return "text", next(scores)

    async def critique(_text: str) -> str | None:
        return "needs work"

    out = await Reflexion(cap=3, threshold=0.10).run(produce=produce, critique=critique)
    assert out.iterations == 2
    assert out.converged is False


@pytest.mark.asyncio
async def test_bounded_debate_stops_when_change_rate_low() -> None:
    proposals = iter(["hello world", "hello world maybe", "hello world maybe slight tweak"])

    async def propose() -> str:
        return next(proposals)

    async def challenge(text: str) -> str:
        return next(proposals)

    out = await BoundedDebate(rounds=2, change_rate_trigger=0.99).run(
        propose=propose, challenge=challenge
    )
    assert 1 <= out.rounds <= 2


@pytest.mark.asyncio
async def test_council_plurality_and_deciding_vote() -> None:
    votes = {"PM Lead": "A", "Eng Manager": "B", "Design Lead": "A"}

    async def cast(voter: str, _opts: list[str]) -> str:
        return votes[voter]

    out = await CrossDeptCouncil(disagreement_threshold=0.20).decide(
        options=["A", "B"],
        voters=list(votes.keys()),
        cast_vote=cast,
    )
    assert out.decision == "A"


@pytest.mark.asyncio
async def test_council_uses_deciding_vote_on_tie() -> None:
    votes = {"PM Lead": "B", "Eng Manager": "B", "Design Lead": "A", "QA Lead": "A"}

    async def cast(voter: str, _opts: list[str]) -> str:
        return votes[voter]

    out = await CrossDeptCouncil(disagreement_threshold=0.20).decide(
        options=["A", "B"],
        voters=list(votes.keys()),
        cast_vote=cast,
    )
    assert out.deciding_vote_used is True
    assert out.decision == "B"


def test_janitor_memo_writes_to_disk(tmp_path) -> None:  # type: ignore[no-untyped-def]
    memo = JanitorMemo(phase="A", summary="kept charter and plan, archived debate logs")
    out = memo.write(tmp_path)
    assert out.exists()
    assert "janitor-A-" in out.name
