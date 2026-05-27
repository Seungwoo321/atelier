"""Role base — every lead/role inherits this."""

from __future__ import annotations

from dataclasses import dataclass, field

from atelier.llm.provider import LLMProvider, LLMResponse


@dataclass
class Role:
    name: str
    department: str
    model: str
    provider: LLMProvider
    mandate: str = ""
    tools: list[str] = field(default_factory=list)

    def system_prompt(self) -> str:
        base = (
            f"You are {self.name}, lead of the {self.department} department "
            f"in a virtual software company called Atelier."
        )
        if self.mandate:
            base += f"\n\nMandate: {self.mandate}"
        if self.tools:
            base += f"\n\nTools available: {', '.join(self.tools)}"
        return base

    async def think(self, prompt: str, max_tokens: int = 4096) -> LLMResponse:
        return await self.provider.complete(
            system=self.system_prompt(),
            prompt=prompt,
            model=self.model,
            max_tokens=max_tokens,
        )
