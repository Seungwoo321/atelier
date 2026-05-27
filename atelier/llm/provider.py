"""LLMProvider Protocol — the only abstraction the rest of the code depends on.

Two concrete implementations:
- ClaudeSDKProvider — Claude Code SDK in-process (claude-agent-sdk)
- ACPProvider       — Agent Client Protocol client

No other LLM access paths are permitted.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol, runtime_checkable


@dataclass(frozen=True)
class LLMResponse:
    text: str
    model: str
    input_tokens: int = 0
    output_tokens: int = 0
    cache_read_tokens: int = 0
    cache_write_tokens: int = 0


@runtime_checkable
class LLMProvider(Protocol):
    """Minimal contract every provider must satisfy."""

    name: str

    async def complete(
        self,
        *,
        system: str,
        prompt: str,
        model: str,
        max_tokens: int = 4096,
    ) -> LLMResponse:
        ...

    async def healthcheck(self) -> bool:
        ...


def get_provider(name: str) -> LLMProvider:
    """Factory — returns the concrete provider for the given name."""
    if name == "sdk":
        from atelier.llm.sdk_inprocess import ClaudeSDKProvider

        return ClaudeSDKProvider()
    if name == "acp":
        from atelier.llm.acp_client import ACPProvider

        return ACPProvider()
    raise ValueError(f"unknown LLM provider: {name!r} (expected 'sdk' or 'acp')")
