"""MCP registry sanity tests."""

from __future__ import annotations

from atelier.mcp.registry import MCP_REGISTRY, list_for_department


def test_registry_non_empty() -> None:
    assert len(MCP_REGISTRY) >= 10


def test_engineering_has_github_and_playwright() -> None:
    names = {s.name for s in list_for_department("Engineering")}
    assert {"github", "playwright"}.issubset(names)


def test_marketing_has_email_and_seo() -> None:
    names = {s.name for s in list_for_department("Marketing")}
    assert {"resend", "ahrefs"}.issubset(names)
