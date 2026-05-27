"""Inbox file ops."""

from __future__ import annotations

from pathlib import Path

from atelier.inbox import list_items, write_item


def test_write_and_list_roundtrip(tmp_path: Path) -> None:
    p = write_item(tmp_path, slug="hello", body="# Hello world\nbody")
    assert p.exists()
    items = list_items(tmp_path)
    assert len(items) == 1
    assert items[0].title == "Hello world"


def test_empty_inbox(tmp_path: Path) -> None:
    assert list_items(tmp_path / "does-not-exist") == []
