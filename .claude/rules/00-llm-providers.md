# Rule: LLM provider boundary

Only two LLM transports exist in this repo:

- `atelier.llm.sdk_inprocess.ClaudeSDKProvider` (Claude Code SDK in-process)
- `atelier.llm.acp_client.ACPProvider` (ACP JSON-RPC over stdio)

All code that needs an LLM **must** depend on the `LLMProvider` Protocol from
`atelier.llm.provider`. Do not import `anthropic`, `openai`, `litellm`, or any
other LLM client. Do not read API keys from the environment.

If you need a new capability (e.g. streaming, tool use), extend the Protocol
and update both implementations. Do not bypass it.
