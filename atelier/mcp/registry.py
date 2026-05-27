"""MCP server registry — defines which tools each department can request."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class MCPServer:
    name: str
    description: str
    departments: tuple[str, ...]


MCP_REGISTRY: tuple[MCPServer, ...] = (
    MCPServer("github", "Repo, PR, issue operations", ("Engineering", "QA", "Chief")),
    MCPServer("linear", "Issue/sprint planning", ("Product", "Engineering", "QA")),
    MCPServer("notion", "Docs and PRDs", ("Product", "Strategy", "Marketing", "Operations")),
    MCPServer("figma", "Design files and components", ("Design", "Product")),
    MCPServer("postgres", "Schemas, queries, migrations", ("Engineering",)),
    MCPServer("vercel", "Deploy and preview URLs", ("Engineering",)),
    MCPServer("playwright", "Browser automation, E2E tests", ("QA", "Engineering")),
    MCPServer("posthog", "Product analytics", ("Analytics", "Marketing", "Product")),
    MCPServer("resend", "Transactional email", ("Marketing", "Operations")),
    MCPServer("discord", "Community", ("Marketing", "Operations")),
    MCPServer("exa", "Web search and research", ("Strategy", "Marketing")),
    MCPServer("ahrefs", "SEO and backlinks", ("Marketing",)),
    MCPServer("sheets", "Spreadsheets for BM and financial modelling", ("Strategy", "Analytics")),
)


def list_for_department(dept: str) -> list[MCPServer]:
    return [s for s in MCP_REGISTRY if dept in s.departments]
