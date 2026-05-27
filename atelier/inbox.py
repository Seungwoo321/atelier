"""File-based inbox: ./inbox/*.md (Phase A)."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from pathlib import Path


@dataclass(frozen=True)
class InboxItem:
    path: Path
    title: str
    body: str
    created_at: datetime


def list_items(inbox_dir: Path) -> list[InboxItem]:
    if not inbox_dir.exists():
        return []
    items: list[InboxItem] = []
    for p in sorted(inbox_dir.glob("*.md")):
        text = p.read_text(encoding="utf-8")
        first_line = text.splitlines()[0] if text else p.stem
        title = first_line.lstrip("# ").strip() or p.stem
        items.append(
            InboxItem(
                path=p,
                title=title,
                body=text,
                created_at=datetime.fromtimestamp(p.stat().st_mtime),
            )
        )
    return items


def write_item(inbox_dir: Path, slug: str, body: str) -> Path:
    inbox_dir.mkdir(parents=True, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d-%H%M%S")
    path = inbox_dir / f"{ts}-{slug}.md"
    path.write_text(body, encoding="utf-8")
    return path
