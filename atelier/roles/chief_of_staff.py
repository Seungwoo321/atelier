"""Chief of Staff — orchestrates intake → charter (G1)."""

from __future__ import annotations

from atelier.llm.provider import LLMProvider
from atelier.roles.base import Role


class ChiefOfStaff(Role):
    def __init__(self, provider: LLMProvider) -> None:
        super().__init__(
            name="Chief of Staff",
            department="Office of the CEO",
            model="claude-sonnet-4-6",
            provider=provider,
        )
