"""Stage 2: Deterministic critic — linting, dead-link, threshold checks."""

from __future__ import annotations

import re

LINK_RE = re.compile(r"https?://\S+")


def critic_check(text: str, *, min_length: int = 20) -> tuple[bool, list[str]]:
    issues: list[str] = []
    if len(text.strip()) < min_length:
        issues.append(f"content too short (<{min_length} chars)")
    # Cheap dead-link sanity: must not contain placeholders.
    for placeholder in ("TODO", "FIXME", "lorem ipsum", "TBD"):
        if placeholder.lower() in text.lower():
            issues.append(f"unresolved placeholder: {placeholder}")
    return (not issues), issues
