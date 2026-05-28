<div align="center">

# Atelier

**역할 특화 에이전트로 구성된 가상 회사.**
9개 부서에 분산된 28개의 LLM 기반 역할을 5개의 전략 게이트(G1–G5)를 통해 오케스트레이션하는 Python 프레임워크. 모든 실행은 타입이 검증된 아티팩트를 산출합니다.

[![Python](https://img.shields.io/badge/python-3.12%2B-blue.svg)](https://www.python.org/)
[![License](https://img.shields.io/badge/license-Proprietary-red.svg)](#license)
[![Status](https://img.shields.io/badge/status-v1.0-green.svg)](#)

[English](README.md) · **한국어**

</div>

![Atelier 라이브 오피스 — 9명의 부서 리드, SSE 기반 활동, 회의실 러그 위의 Cross-Dept Council 배지](docs/r9-office.png)

> **라이브 액션** — SSE 스트림으로 이벤트가 도착하면 Chief of Staff에서 각 부서 리드로 파티클 트레일이 발사됩니다:
>
> ![이벤트 도착 시 파티클 트레일, 라이브 이벤트 로그, Cross-Dept Council 펄스](docs/office-demo.gif)

---

## 개요

Atelier는 소프트웨어 회사를 역할 특화 에이전트의 방향성 그래프로 모델링합니다. 단일 사용자 요청이 인박스 파일로 들어와 다섯 개의 전략 게이트 — **Charter → Plan → Design → Build → Launch** — 를 통과한 뒤, 타입과 스키마가 검증된 아티팩트 묶음과 런치 메모로 출력됩니다.

이미 동작 중인 LLM 전송 방식 두 가지를 지원합니다:

1. **Claude Code SDK in-process** — `claude-agent-sdk`를 사용하며 브라우저 OAuth로 사용자의 Claude Pro/Max 구독을 그대로 공유합니다.
2. **ACP (Agent Client Protocol)** — stdio 기반 JSON-RPC로 ACP 호환 에이전트(Claude Code ACP, Gemini ACP, Codex CLI)와 통신합니다.

모든 호출부는 단일 `LLMProvider` 프로토콜에 의존하며, 위 두 구현체가 유일한 트랜스포트입니다.

## 특징

- **9명의 부서 리드** (Opus 4.7) + **19명의 스페셜리스트** (Sonnet 4.6) — 조합 가능한 `Role` 객체로 정의.
- **5개의 전략 게이트**를 LangGraph로 배선, 선택적 SQLite 체크포인팅 지원.
- **4개의 의사결정 프로토콜** — Reflexion(최대 3회, 10% 이상 개선), Bounded Debate(N=2, 30% 이상 변경률), Cross-Dept Council(PM Lead 결정투표, 20% 이상 이견), Janitor Memo.
- **4단계 검증** — Schema(Pydantic) → Critic(결정론) → Judge(LLM 루브릭) → Guardrails(PII/시크릿).
- **3계층 메모리** — Org(읽기 전용) / Project(공유) / Role(자기 편집).
- **구독 쿼터 예산 모델** — 토큰당 달러가 아닌 일일 구독 쿼터의 비율로 회계(`QuotaGuard`).
- **MCP 도구 레지스트리** — 기본 13개 서버를 부서별로 매핑.
- **선택적 통합** — Langfuse 트레이싱, Temporal durable workflows, E2B 샌드박스 실행.
- **웹 대시보드** — Next.js 16 + React 19, Modern Interiors 스프라이트 기반 PixiJS 오피스 뷰. 부서 리드를 클릭하면 라이브 이벤트 로그가 필터링됩니다.
- **Claude Code 플러그인** — Claude Code 내부에서 게이트 승인을 위한 슬래시 커맨드 제공.

## 설치

```bash
git clone https://github.com/Seungwoo321/atelier.git
cd atelier
uv venv && source .venv/bin/activate     # 또는: python3.12 -m venv .venv
uv pip install -e ".[dev]"

# Claude 구독 최초 브라우저 OAuth:
atelier auth login
```

Python 3.12 이상이 필요합니다.

## 빠른 시작

```bash
# 요청을 등록하고 5개 게이트를 전부 실행, 아티팩트 트리 출력:
atelier start "weekly retrospective CLI for solo developers"

# 인박스 대기열 확인:
atelier inbox list

# 게이트 카드 승인 (Phase A: 파일 플래그 기반):
atelier inbox approve ./inbox/20260101-120000-request.md

# 특정 부서의 MCP 도구 확인:
atelier mcp list --department Engineering

# 마지막 결과 확인:
atelier result
```

아티팩트는 `./artifacts/<project_id>/result.json`에 저장됩니다. 실행 로그와 SQLite 체크포인트는 `./runs/`에 위치합니다.

CLI 데모:

![Atelier CLI](docs/demo.gif)

## 환경 변수

`.env.example`을 `.env`로 복사 후 조정:

| 변수 | 기본값 | 의미 |
| --- | --- | --- |
| `ATELIER_LLM_PROVIDER` | `sdk` | `sdk`(인프로세스) 또는 `acp` |
| `ATELIER_ACP_ENDPOINT` | — | ACP 에이전트 실행 커맨드 (provider=`acp`일 때) |
| `ATELIER_QUOTA_CAP` | `0.20` | 일일 쿼터 사용 비율 (0.0–1.0) |
| `ATELIER_ARTIFACTS_DIR` | `./artifacts` | 아티팩트 출력 위치 |
| `ATELIER_INBOX_DIR` | `./inbox` | 인박스 마크다운 디렉터리 |
| `ATELIER_RUNS_DIR` | `./runs` | 로그 및 SQLite 체크포인터 |
| `ATELIER_LOG_LEVEL` | `INFO` | 구조화된 로그 레벨 |

선택적 통합: `LANGFUSE_PUBLIC_KEY`/`LANGFUSE_SECRET_KEY`, `TEMPORAL_HOST`, `E2B_API_KEY`.

## 프로젝트 구조

```
atelier/
├── atelier/                  # Python 패키지
│   ├── cli.py                # Typer 엔트리 포인트
│   ├── config.py             # Pydantic Settings
│   ├── runner.py             # 상위 레벨 실행 엔진
│   ├── budget.py             # QuotaGuard
│   ├── inbox.py              # ./inbox/*.md 처리
│   ├── llm/                  # LLMProvider 프로토콜 + SDK & ACP
│   ├── roles/                # 9명의 리드 + 스페셜리스트 카탈로그
│   ├── artifacts/            # 게이트별 Pydantic 스키마
│   ├── graph/                # LangGraph 배선 + G1–G5 게이트
│   ├── protocols/            # Reflexion, Debate, Council, Janitor
│   ├── verify/               # 4단계 검증
│   ├── memory/               # Org / Project / Role 계층
│   ├── mcp/                  # MCP 서버 레지스트리
│   ├── observability/        # structlog + Langfuse
│   ├── durable/              # Temporal 클라이언트 래퍼
│   ├── sandbox/              # E2B + 로컬 폴백
│   ├── eval/                 # Eval Officer + DEPT_RUBRICS
│   └── plugin/               # Claude Code 플러그인
├── web/                      # Next.js 16 + React 19 대시보드
├── assets/                   # Modern Interiors 스프라이트 (프리 버전)
├── tests/
└── .claude/                  # Claude Code용 프로젝트 메모리 + 규칙
```

## 9개 부서

| # | 부서 | 리드 | 스페셜리스트 |
| --- | --- | --- | --- |
| 1 | Strategy | BizDev Lead | Market Researcher, Competitor Analyst, BM Modeler |
| 2 | Product | PM Lead | PM Specialist, Product Designer |
| 3 | Design | Design Lead | UX, UI, Brand Designer |
| 4 | Engineering | Eng Manager | Tech Lead, FE, BE, Infra, DB, Security, DevOps |
| 5 | QA | QA Lead | Test Engineer, Bug Hunter |
| 6 | Marketing | Mkt Lead | Content Writer, SEO, Growth, Social |
| 7 | Operations | Ops Lead | Customer Support, Community Manager |
| 8 | Analytics | Analytics Lead | Data Analyst, Financial Modeler |
| 9 | Chief | Chief of Staff | Memory Keeper, Eval Officer |

모델 티어: 리드와 Chief 그룹 → Opus 4.7, 스페셜리스트 → Sonnet 4.6, 런타임 유틸리티 → Haiku 4.5.

## 5개 게이트

```
inbox/*.md
   │
   ▼
G1 Charter ──► G2 Plan ──► G3 Design ──► G4 Build ──► G5 Launch ──► artifacts/
   │              │             │             │            │
   └──────────────┴── 4단계 검증 (Schema → Critic → Judge → Guardrails) ───────────┘
```

각 게이트는 타입이 정의된 Pydantic 아티팩트(`ProductCharter`, `Plan`, `PRD` + `DesignMemo`, `CodeReview`, `LaunchMemo`)를 생산합니다. 검증 단계가 실패하면 Reflexion(최대 3회 반복)을 거치고, 그래도 해결되지 않으면 Cross-Dept Council로 에스컬레이션됩니다.

## 웹 대시보드

`web/` 디렉터리는 Next.js 16 + React 19 대시보드와 PixiJS로 렌더링되는 오피스 뷰(Modern Interiors 타일맵)를 포함합니다. 실행:

```bash
cd web
pnpm install
pnpm dev
```

<http://localhost:3000> 접속. 랜딩은 `/`, 라이브 오피스는 `/office`, 실행 요약은 `/dashboard`.

| 경로 | 미리보기 |
| --- | --- |
| `/` — 랜딩 | ![](docs/r9-landing.png) |
| `/office` — 라이브 오피스 | ![](docs/r9-office.png) |
| `/dashboard` — 실행 요약 | ![](docs/r9-dashboard.png) |


첫 실행 전에 오피스/대시보드를 채워보고 싶다면 샘플 데이터를 시드하세요:

```bash
python scripts/seed_demo.py
```

이 명령은 `artifacts/atelier-demo/`(5개의 타입 아티팩트)와 `runs/events.jsonl`(G1 → G5를 포함하는 16개 이벤트)를 생성합니다. 두 디렉터리는 런타임 상태로 git에서 제외되어 있습니다.

## Claude Code 플러그인

`atelier/plugin/`을 Claude Code 플러그인 경로에 배치하거나, 번들된 슬래시 커맨드(`/atelier-start`, `/atelier-approve`)로 호출합니다. 자세한 내용은 `atelier/plugin/README.md` 참조.

## 개발

```bash
uv pip install -e ".[dev]"
ruff check .
mypy atelier
pytest
```

## License

Proprietary — 내부 사용에 한함. `assets/modern-interiors/`에 번들된 Modern Interiors 스프라이트는 © LimeZu의 자산이며 *free version* 라이선스(비상업적 용도)로 재배포됩니다. `assets/modern-interiors/LICENSE.txt` 참조.
