"""Tests for the 3-tier memory."""

from __future__ import annotations

from pathlib import Path

from atelier.memory import OrgMemory, ProjectMemory, RoleMemory


def test_org_memory_seeds_principles(tmp_path: Path) -> None:
    org = OrgMemory(tmp_path)
    org.seed()
    assert org.get("mission")
    assert isinstance(org.get("principles"), list)
    assert "G1" in org.get("gates")


def test_project_memory_appends(tmp_path: Path) -> None:
    pm = ProjectMemory(tmp_path, project_id="weekly-retro")
    pm.set("request", "weekly retro CLI")
    pm.append("notes", "g1 done")
    pm.append("notes", "g2 done")
    data = pm.all()
    assert data["notes"] == ["g1 done", "g2 done"]


def test_role_memory_isolated_per_role(tmp_path: Path) -> None:
    a = RoleMemory(tmp_path, "PM Lead")
    b = RoleMemory(tmp_path, "Eng Manager")
    a.remember("user prefers minimal CLI")
    b.remember("python 3.12 required")
    assert "user prefers minimal CLI" in a.recall()
    assert "user prefers minimal CLI" not in b.recall()


def test_recall_role_memory_renders_prior_facts(tmp_path: Path) -> None:
    from atelier.config import Settings
    from atelier.graph.gates._llm import _recall_role_memory

    RoleMemory(tmp_path, "PM Lead").remember("[demo] shipped plan for 'X'")
    settings = Settings(
        runs_dir=tmp_path, role_memory_enabled=True, role_memory_max_facts=5
    )
    block = _recall_role_memory(settings, "G2", "Product", "PM Lead")
    assert "Prior runs by PM Lead" in block
    assert "[demo] shipped plan for 'X'" in block


def test_recall_role_memory_disabled_returns_empty(tmp_path: Path) -> None:
    from atelier.config import Settings
    from atelier.graph.gates._llm import _recall_role_memory

    RoleMemory(tmp_path, "PM Lead").remember("[demo] shipped plan")
    settings = Settings(runs_dir=tmp_path, role_memory_enabled=False)
    assert _recall_role_memory(settings, "G2", "Product", "PM Lead") == ""


def test_recall_role_memory_no_facts_returns_empty(tmp_path: Path) -> None:
    from atelier.config import Settings
    from atelier.graph.gates._llm import _recall_role_memory

    settings = Settings(runs_dir=tmp_path, role_memory_enabled=True)
    assert _recall_role_memory(settings, "G2", "Product", "PM Lead") == ""
