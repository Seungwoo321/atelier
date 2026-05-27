# Atelier — Claude Code Project Memory

> This file is read automatically by Claude Code at session start.
> Keep it short, actionable, and focused on things Claude needs to know
> to be productive in this repo on day one.

## What this repo is

Atelier is a Python framework that orchestrates 28 LLM-driven roles across 9
departments through 5 strategic gates (G1–G5). It produces typed Pydantic
artifacts on every run.

## Hard rules

1. **LLM access is restricted to two transports only:**
   - `ClaudeSDKProvider` — Claude Code SDK in-process (`claude-agent-sdk`)
   - `ACPProvider` — ACP JSON-RPC over stdio
   No other LLM clients (raw Anthropic API, OpenAI, LiteLLM, etc.) may be added.
   All callers depend on the `LLMProvider` Protocol in `atelier/llm/provider.py`.
2. **Cost model is subscription-quota fraction, not USD per token.**
   Use `atelier.budget.QuotaGuard` for accounting.
3. **External publish is dry-run** unless a mandate explicitly says otherwise.
   This includes blog posts, social media, transactional email, deploy actions.
4. **One lead per department.** Specialists report through leads. Cross-dept
   coordination happens through the Chief of Staff and the Cross-Dept Council.
5. **Latest-major-first** for all dependencies — React 19, Next.js 16, Python
   3.12+, Pydantic v2, LangGraph 0.2+. Do not pin to older majors.

## Code conventions

- Python 3.12 typed (`from __future__ import annotations` everywhere).
- Pydantic v2 models for all artifacts.
- `ruff` (line length 100) + `mypy --strict` are the lint/type baseline.
- Tests with `pytest` + `pytest-asyncio`.
- No comments unless WHY is non-obvious. No docstring fluff.
- Don't add backwards-compat shims, dead `_var` renames, or feature flags
  for hypothetical migrations.

## Where things live

- `atelier/llm/` — provider Protocol + the two transports
- `atelier/roles/` — `Role` base, `leads.py` (9 dept heads), `specialists.py` (rest)
- `atelier/graph/` — `state.py`, `build.py`, `gates/g{1..5}_*.py`
- `atelier/protocols/` — Reflexion, BoundedDebate, CrossDeptCouncil, JanitorMemo
- `atelier/verify/` — Schema → Critic → Judge → Guardrails
- `atelier/memory/` — Org (RO), Project (shared), Role (self-edit)
- `atelier/eval/officer.py` — Eval Officer + DEPT_RUBRICS
- `atelier/mcp/registry.py` — MCP server catalog
- `atelier/observability/` — structlog + Langfuse opt-in
- `atelier/durable/` — Temporal client (falls back to local async)
- `atelier/sandbox/` — E2B + local subprocess fallback
- `web/` — Next.js 16 + React 19 dashboard with PixiJS office view
- `assets/modern-interiors/` — sprite assets (non-commercial free version)

## When asked to add a new role

1. Append it to `atelier/roles/specialists.py` as a `(dept, name, mandate, tools)` tuple.
2. Make sure the department already has a lead in `atelier/roles/leads.py`.
3. If the role needs a new tool, add the MCP server to `atelier/mcp/registry.py`
   and list it in the `tools=[...]` of the specialist.

## When asked to add a new gate

1. Add `atelier/graph/gates/g{N}_{name}.py` with one async function `g{N}_{name}(state) -> state`.
2. Add the matching Pydantic artifact to `atelier/artifacts/`.
3. Wire the gate into `atelier/graph/build.py` between the existing edges.
4. Add the gate to `CompanyState` if it produces a new top-level field.

## When asked to write tests

Target each module's public surface. Keep tests fast (no network, no LLM calls
unless mocked). The provider Protocol can be satisfied by a stub returning a
canned `LLMResponse` — see `tests/test_smoke.py`.

## Slash commands available

- `/atelier-start <request>` — runs `atelier start` inline
- `/atelier-approve <path>` — runs `atelier inbox approve`
- `/atelier-status` — prints `atelier auth status`

See `atelier/plugin/` for definitions.

## Do not

- Do not add any LLM SDK other than `claude-agent-sdk`.
- Do not introduce paid services. Optional integrations stay opt-in via env.
- Do not commit secrets. `guardrails_check` will flag them, but treat
  prevention as primary.
- Do not couple the web layer to Python internals directly — it reads the
  same `artifacts/` and `runs/events.jsonl` that the CLI produces.
