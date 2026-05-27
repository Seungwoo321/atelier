# Rule: External publication is dry-run by default

Marketing copy, social media posts, transactional email, deploy commands —
none of these are actually executed by default. They are written to
`artifacts/<project>/` and queued for human approval.

To override, a gate must check for an explicit `state["mandate"]` flag
permitting the action. Do not unconditionally send. Do not silently call
the Resend, Twitter, or Discord MCP servers.
