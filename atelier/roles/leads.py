"""9 department leads (Opus tier)."""

from __future__ import annotations

from atelier.llm.provider import LLMProvider
from atelier.roles.base import Role

OPUS = "claude-opus-4-7"


class ChiefOfStaff(Role):
    def __init__(self, provider: LLMProvider) -> None:
        super().__init__(
            name="Chief of Staff",
            department="Chief",
            model=OPUS,
            provider=provider,
            mandate=(
                "Orchestrate lifecycle progression across all 8 departments. "
                "Facilitate Cross-Dept Council. Surface G1~G5 gate cards to the human. "
                "Escalate blocked decisions."
            ),
            tools=["all read-only", "inbox", "gate-card-builder"],
        )


class BizDevLead(Role):
    def __init__(self, provider: LLMProvider) -> None:
        super().__init__(
            name="BizDev Lead",
            department="Strategy",
            model=OPUS,
            provider=provider,
            mandate="Decide market, business model, and partnership direction.",
            tools=["Notion-MCP", "Crunchbase-MCP"],
        )


class PMLead(Role):
    def __init__(self, provider: LLMProvider) -> None:
        super().__init__(
            name="PM Lead",
            department="Product",
            model=OPUS,
            provider=provider,
            mandate="Own product priorities and roadmap.",
            tools=["Linear-MCP", "Notion-MCP"],
        )


class DesignLead(Role):
    def __init__(self, provider: LLMProvider) -> None:
        super().__init__(
            name="Design Lead",
            department="Design",
            model=OPUS,
            provider=provider,
            mandate="Direct visual and UX language; own the design system.",
            tools=["Figma-MCP"],
        )


class EngManager(Role):
    def __init__(self, provider: LLMProvider) -> None:
        super().__init__(
            name="Eng Manager",
            department="Engineering",
            model=OPUS,
            provider=provider,
            mandate="Manage schedule, headcount, and risk. Pair with Tech Lead for tech decisions.",
            tools=["Linear-MCP", "Calendar-MCP"],
        )


class QALead(Role):
    def __init__(self, provider: LLMProvider) -> None:
        super().__init__(
            name="QA Lead",
            department="QA",
            model=OPUS,
            provider=provider,
            mandate="Own test strategy and quality gates.",
            tools=["Linear-MCP"],
        )


class MktLead(Role):
    def __init__(self, provider: LLMProvider) -> None:
        super().__init__(
            name="Mkt Lead",
            department="Marketing",
            model=OPUS,
            provider=provider,
            mandate="Set messaging strategy and campaign direction.",
            tools=["Notion-MCP", "Resend-MCP"],
        )


class OpsLead(Role):
    def __init__(self, provider: LLMProvider) -> None:
        super().__init__(
            name="Ops Lead",
            department="Operations",
            model=OPUS,
            provider=provider,
            mandate="Own operational SOPs and support workflows.",
            tools=["Notion-MCP"],
        )


class AnalyticsLead(Role):
    def __init__(self, provider: LLMProvider) -> None:
        super().__init__(
            name="Analytics Lead",
            department="Analytics",
            model=OPUS,
            provider=provider,
            mandate="Own measurement, KPIs, OKR tracking, and financial modeling.",
            tools=["Posthog-MCP", "Sheets-MCP"],
        )


def build_leads(provider: LLMProvider) -> dict[str, Role]:
    """Instantiate the 9 department leads keyed by department."""
    return {
        "Chief": ChiefOfStaff(provider),
        "Strategy": BizDevLead(provider),
        "Product": PMLead(provider),
        "Design": DesignLead(provider),
        "Engineering": EngManager(provider),
        "QA": QALead(provider),
        "Marketing": MktLead(provider),
        "Operations": OpsLead(provider),
        "Analytics": AnalyticsLead(provider),
    }
