"""Claude Code SDK in-process provider — uses claude-agent-sdk.

Auth comes from the user's Claude subscription via OAuth (browser flow on first
run). No API key is read or stored by this module.
"""

from __future__ import annotations

from atelier.llm.provider import LLMResponse


class ClaudeSDKProvider:
    name = "sdk"

    def __init__(self) -> None:
        try:
            import claude_agent_sdk  # noqa: F401
        except ImportError as e:
            raise RuntimeError(
                "claude-agent-sdk is not installed. "
                "Run `uv pip install claude-agent-sdk` (requires Python 3.12)."
            ) from e

    async def complete(
        self,
        *,
        system: str,
        prompt: str,
        model: str,
        max_tokens: int = 4096,
    ) -> LLMResponse:
        from claude_agent_sdk import ClaudeAgentOptions, query

        options = ClaudeAgentOptions(
            system_prompt=system,
            model=model,
            max_turns=1,
        )

        text_parts: list[str] = []
        input_tokens = 0
        output_tokens = 0
        cache_read = 0
        cache_write = 0

        async for message in query(prompt=prompt, options=options):
            kind = type(message).__name__
            if kind == "AssistantMessage":
                for block in getattr(message, "content", []) or []:
                    text = getattr(block, "text", None)
                    if text:
                        text_parts.append(text)
            elif kind == "ResultMessage":
                usage = getattr(message, "usage", None) or {}
                input_tokens = int(usage.get("input_tokens", 0))
                output_tokens = int(usage.get("output_tokens", 0))
                cache_read = int(usage.get("cache_read_input_tokens", 0))
                cache_write = int(usage.get("cache_creation_input_tokens", 0))

        return LLMResponse(
            text="".join(text_parts),
            model=model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cache_read_tokens=cache_read,
            cache_write_tokens=cache_write,
        )

    async def healthcheck(self) -> bool:
        try:
            import claude_agent_sdk  # noqa: F401
        except ImportError:
            return False
        return True
