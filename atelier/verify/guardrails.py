"""Stage 4: Guardrails — PII, secrets, and policy violations."""

from __future__ import annotations

import re

SECRET_PATTERNS = [
    re.compile(r"sk-[A-Za-z0-9]{20,}"),                    # generic API key
    re.compile(r"AKIA[0-9A-Z]{16}"),                       # AWS access key
    re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----"),     # PEM
    re.compile(r"ghp_[A-Za-z0-9]{30,}"),                   # GitHub token
]
EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")


def guardrails_check(text: str, *, allow_emails: bool = False) -> tuple[bool, list[str]]:
    issues: list[str] = []
    for pat in SECRET_PATTERNS:
        if pat.search(text):
            issues.append(f"secret-like pattern detected: {pat.pattern}")
    if not allow_emails and EMAIL_RE.search(text):
        issues.append("email-like PII detected")
    return (not issues), issues
