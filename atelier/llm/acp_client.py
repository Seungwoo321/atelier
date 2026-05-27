"""ACP (Agent Client Protocol) provider — out-of-process LLM access.

Connects to an ACP endpoint (default: env ATELIER_ACP_ENDPOINT) that brokers
calls to a Claude subscription.
"""

from __future__ import annotations

from atelier.llm.provider import LLMResponse


class ACPProvider:
    name = "acp"

    def __init__(self, endpoint: str | None = None) -> None:
        self.endpoint = endpoint

    async def complete(
        self,
        *,
        system: str,
        prompt: str,
        model: str,
        max_tokens: int = 4096,
    ) -> LLMResponse:
        raise NotImplementedError(
            "ACPProvider.complete: wire ACP client transport in Phase A gate work"
        )

    async def healthcheck(self) -> bool:
        return bool(self.endpoint)
