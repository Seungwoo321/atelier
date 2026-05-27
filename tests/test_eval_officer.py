"""Eval Officer rubric coverage."""

from __future__ import annotations

from atelier.eval.officer import DEPT_RUBRICS


def test_every_department_has_rubric() -> None:
    for d in (
        "Product", "Engineering", "Design", "Strategy",
        "Marketing", "Operations", "QA", "Analytics", "Chief",
    ):
        assert d in DEPT_RUBRICS
        assert DEPT_RUBRICS[d], d
