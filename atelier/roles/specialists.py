"""Non-lead specialists (Phase B). Sonnet tier by default."""

from __future__ import annotations

from atelier.llm.provider import LLMProvider
from atelier.roles.base import Role

SONNET = "claude-sonnet-4-6"

# (department, name, mandate, tools)
SPECIALISTS: list[tuple[str, str, str, list[str]]] = [
    ("Strategy", "Market Researcher",
     "Size markets, surface trends, capture customer insight.",
     ["Exa-MCP", "Perplexity-MCP", "Web-MCP"]),
    ("Strategy", "Competitor Analyst",
     "Build competitor matrices and differentiation memos.",
     ["Crunchbase-MCP", "SimilarWeb"]),
    ("Strategy", "BM Modeler",
     "Draft business-model canvases and financial simulations.",
     ["Sheets-MCP"]),

    ("Product", "PM Specialist",
     "Author PRDs at the feature level.",
     ["Notion-MCP"]),
    ("Product", "Product Designer",
     "Define information architecture and user flows.",
     ["Figma-MCP"]),

    ("Design", "UX Designer",
     "Produce wireframes and interaction specs.",
     ["Figma-MCP", "v0-MCP"]),
    ("Design", "UI Designer",
     "Produce visual mocks and component tokens.",
     ["Figma-MCP", "Tailwind"]),
    ("Design", "Brand Designer",
     "Own logo, voice, and tone.",
     ["Image-gen MCP"]),

    ("Engineering", "Tech Lead",
     "Make architecture and tech-stack decisions; write ADRs.",
     ["GitHub-MCP", "ADR-tool"]),
    ("Engineering", "FE Engineer",
     "Build frontend code; open PRs.",
     ["GitHub-MCP", "E2B", "Playwright"]),
    ("Engineering", "BE Engineer",
     "Build backend code; open PRs.",
     ["GitHub-MCP", "E2B", "Postgres-MCP"]),
    ("Engineering", "Infra Engineer",
     "Provision infra and deployment pipelines.",
     ["Vercel-MCP", "AWS-MCP"]),
    ("Engineering", "DB Engineer",
     "Design schemas and write migrations.",
     ["Postgres-MCP"]),
    ("Engineering", "Security Engineer",
     "Run SAST/DAST reviews and threat models.",
     ["bandit", "Trivy"]),
    ("Engineering", "DevOps",
     "Run CI/CD, releases, monitoring.",
     ["GitHub Actions", "Sentry"]),

    ("QA", "Test Engineer",
     "Author automated test suites.",
     ["Playwright", "Vitest", "Pytest"]),
    ("QA", "Bug Hunter",
     "Run exploratory and edge-case testing.",
     ["browser", "fuzz"]),

    ("Marketing", "Content Writer",
     "Write blog posts and launch copy.",
     ["Notion-MCP"]),
    ("Marketing", "SEO Specialist",
     "Own keywords, meta tags, internal linking.",
     ["Ahrefs-MCP"]),
    ("Marketing", "Growth Hacker",
     "Run channel experiments and lifecycle campaigns.",
     ["Posthog-MCP"]),
    ("Marketing", "Social Media",
     "Run Twitter/LinkedIn/Discord presence.",
     ["Twitter-MCP", "Discord-MCP"]),

    ("Operations", "Customer Support",
     "Reply to tickets and maintain help docs.",
     ["Intercom-MCP"]),
    ("Operations", "Community Manager",
     "Run Discord and community forums.",
     ["Discord-MCP"]),

    ("Analytics", "Data Analyst",
     "Build dashboards and answer ad-hoc analyses.",
     ["Posthog-MCP", "BigQuery"]),
    ("Analytics", "Financial Modeler",
     "Model burn, runway, and pricing scenarios.",
     ["Sheets-MCP"]),

    ("Chief", "Memory Keeper",
     "Curate org/project/role memory tiers.",
     ["VectorDB", "RAG"]),
    ("Chief", "Eval Officer",
     "Run 4-stage verification gates with department-specific rubrics.",
     ["LLM-judge", "DeepEval"]),
]


def build_specialists(provider: LLMProvider) -> list[Role]:
    return [
        Role(
            name=name,
            department=dept,
            model=SONNET,
            provider=provider,
            mandate=mandate,
            tools=list(tools),
        )
        for dept, name, mandate, tools in SPECIALISTS
    ]
