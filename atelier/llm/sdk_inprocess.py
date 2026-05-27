"""Claude Code SDK in-process provider.

Uses `claude-agent-sdk` (Anthropic) which shares the user's Claude subscription
auth via OAuth — no API key is read here.
"""

from __future__ import annotations

from atelier.llm.provider import LLMResponse


class ClaudeSDKProvider:
    name = "sdk"

    async def complete(
        self,
        *,
        system: str,
        prompt: str,
        model: str,
        max_tokens: int = 4096,
    ) -> LLMResponse:
        # Phase A skeleton: actual claude-agent-sdk wiring lands with the first
        # gate implementation. We surface the shape now so callers can integrate.
        raise NotImplementedError(
            "ClaudeSDKProvider.complete: wire claude-agent-sdk in Phase A gate work"
        )

    async def healthcheck(self) -> bool:
        try:
            import claude_agent_sdk  # noqa: F401
        except ImportError:
            return False
        return True
