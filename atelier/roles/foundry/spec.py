"""Role Foundry types — RoleSpec, Requisition, and supporting structures.

A RoleSpec encodes a senior practitioner as a typed artifact rather than a
one-line mandate. Specialists are hired against capability Requisitions
issued by department leads.
"""

from __future__ import annotations

import hashlib
import re
from typing import Literal

from pydantic import BaseModel, Field

Seniority = Literal["senior", "staff", "principal"]
LeadsWith = Literal["question", "document", "prototype", "analysis"]


class Framework(BaseModel):
    name: str = Field(min_length=2)
    when_to_apply: str = Field(min_length=5)


class Citation(BaseModel):
    title: str = Field(min_length=2)
    source: str = Field(min_length=2)
    relevance: str = Field(min_length=5)


class Rubric(BaseModel):
    criteria: list[str] = Field(min_length=2)
    failing_when: list[str] = Field(default_factory=list)


class WorkingStyle(BaseModel):
    leads_with: LeadsWith
    cadence: str = Field(min_length=2)


class RoleSpec(BaseModel):
    """A senior expert encoded as a typed artifact, not a label."""

    title: str = Field(min_length=2)
    department: str = Field(min_length=2)
    seniority: Seniority = "staff"
    one_liner: str = Field(min_length=10)
    expertise_domains: list[str] = Field(min_length=3)
    decision_frameworks: list[Framework] = Field(default_factory=list)
    reference_corpus: list[Citation] = Field(default_factory=list)
    failure_modes: list[str] = Field(default_factory=list)
    anti_patterns: list[str] = Field(default_factory=list)
    quality_bar: Rubric
    working_style: WorkingStyle
    escalation_triggers: list[str] = Field(default_factory=list)
    tools: list[str] = Field(default_factory=list)
    origin: Literal["seed", "hired"] = "seed"

    def to_system_prompt(self) -> str:
        lines = [
            f"You are a {self.seniority} {self.title} in the {self.department} "
            f"department at Atelier.",
            f"Working stance: {self.one_liner}",
            "",
            "Expertise domains (you operate fluently across these):",
        ]
        lines += [f"- {d}" for d in self.expertise_domains]
        if self.decision_frameworks:
            lines += ["", "Frameworks you draw on:"]
            lines += [f"- {f.name} — apply when: {f.when_to_apply}" for f in self.decision_frameworks]
        if self.failure_modes:
            lines += ["", "Failure modes you actively avoid:"]
            lines += [f"- {fm}" for fm in self.failure_modes]
        if self.anti_patterns:
            lines += ["", "Anti-patterns — never do these:"]
            lines += [f"- {ap}" for ap in self.anti_patterns]
        lines += ["", "Quality bar (apply to your own output before returning it):"]
        lines += [f"- {c}" for c in self.quality_bar.criteria]
        if self.quality_bar.failing_when:
            lines += ["Output is failing if any of:"]
            lines += [f"- {f}" for f in self.quality_bar.failing_when]
        lines += [
            "",
            f"Working style: {self.working_style.leads_with}-first; "
            f"cadence: {self.working_style.cadence}",
        ]
        if self.escalation_triggers:
            lines += ["", "Escalate to the lead when:"]
            lines += [f"- {e}" for e in self.escalation_triggers]
        if self.tools:
            lines += ["", f"Tools available: {', '.join(self.tools)}"]
        return "\n".join(lines)


class Requisition(BaseModel):
    """A capability ask from a lead — names a job-to-be-done, not a job title."""

    gate: str = Field(min_length=2)
    issuing_lead: str = Field(min_length=2)
    department: str = Field(min_length=2)
    capability: str = Field(min_length=10)
    deliverable: str = Field(min_length=10)
    constraints: list[str] = Field(default_factory=list)
    context_summary: str = ""

    def canonical_key(self) -> str:
        def norm(s: str) -> str:
            return re.sub(r"\s+", " ", s.lower().strip())

        payload = f"{norm(self.department)}|{norm(self.capability)}|{norm(self.deliverable)}"
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:16]
