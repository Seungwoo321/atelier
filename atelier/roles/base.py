"""Role base class — every lead/role inherits from this."""

from __future__ import annotations

from dataclasses import dataclass

from atelier.llm.provider import LLMProvider


@dataclass
class Role:
    name: str
    department: str
    model: str                       # routing decided per role (see D3)
    provider: LLMProvider

    def system_prompt(self) -> str:
        return (
            f"You are {self.name}, lead of the {self.department} department "
            f"in a virtual software company. Operate within your mandate."
        )
