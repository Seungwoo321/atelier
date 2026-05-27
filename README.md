# Atelier

> Virtual company of role-specialized agents. Phase A skeleton.

설계·정책 문서는 sibling 레포 [`../multi-agent-workflow-research/`](../multi-agent-workflow-research/). 본 레포는 *구현*만 담는다.

## 현재 페이즈

**Phase A — Foundation** (사용자 결정 [`02-decisions.md` §D8](../multi-agent-workflow-research/03-virtual-company/02-decisions.md#d8--phase-a-foundation-확정값) 기준).

- 9 리드, 로컬, SQLite checkpointer, dry-run only
- CLI 진입점 `atelier`
- 인박스: `./inbox/*.md` + Claude Code 슬래시

## 설치 (개발)

```bash
git clone <local-only-for-now>
cd atelier
uv venv && source .venv/bin/activate  # 또는 python3.12 -m venv .venv
uv pip install -e ".[dev]"

# Claude 구독 인증 (브라우저 OAuth — Claude Code SDK가 처리)
atelier auth login
```

## 첫 실행

```bash
atelier start "개인 개발자용 주간 회고 자동화 CLI"
```

## LLM 통합 경로 (확정 — [`D2`](../multi-agent-workflow-research/03-virtual-company/02-decisions.md#d2--llm-통합-경로-정확히-두-개))

오직 두 경로:
1. **Claude Code SDK 인프로세스** (`@anthropic-ai/claude-agent-sdk` Python 바인딩)
2. **ACP (Agent Client Protocol)** 클라이언트

코드 호출부는 `atelier.llm.provider.LLMProvider` Protocol에만 의존.

## 디렉터리

```
atelier/
├── cli.py              # Typer 진입점
├── config.py           # Pydantic Settings
├── llm/
│   ├── provider.py     # Protocol (인터페이스)
│   ├── sdk_inprocess.py
│   └── acp_client.py
├── roles/              # 9 리드 (Phase A)
├── artifacts/          # Pydantic 산출물 스키마
├── graph/              # LangGraph 노드·게이트
├── memory/             # 3계층 메모리
├── protocols/          # 의사결정 4종
├── verify/             # 4단 게이트 (Schema→Critic→Judge→Guardrails)
├── budget.py           # QuotaGuard
├── inbox.py            # ./inbox/*.md
└── plugin/             # Claude Code 플러그인
```

## 기여

내부 프로젝트. 외부 contrib 비목표 (v1.0 출시 전).

## 라이선스

Proprietary.
