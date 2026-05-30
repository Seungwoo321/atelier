"""Role Foundry — dynamic hiring via Talent Lead, cached on disk under runs/."""

from __future__ import annotations

import json
from pathlib import Path

from pydantic import ValidationError

from atelier.budget import QuotaGuard
from atelier.config import load_settings
from atelier.llm.provider import get_provider
from atelier.observability.tracer import trace_event
from atelier.roles.foundry.seed import seed_role_specs
from atelier.roles.foundry.spec import Requisition, RoleSpec

TALENT_MODEL = "claude-opus-4-7"

TALENT_SYSTEM = (
    "You are the Talent Lead at Atelier. Given a capability requisition, "
    "draft a high-fidelity RoleSpec for a senior practitioner who could "
    "execute the deliverable at the requested quality bar. "
    "Reply with a SINGLE JSON object and nothing else. Required keys: "
    "title, department, seniority (one of: senior, staff, principal), "
    "one_liner (>=10 chars), expertise_domains (>=3 concrete items), "
    "decision_frameworks ([{name, when_to_apply}, ...]), "
    "reference_corpus ([{title, source, relevance}, ...]), "
    "failure_modes (>=2 items), anti_patterns (>=1 item), "
    "quality_bar ({criteria>=2, failing_when}), "
    "working_style ({leads_with: question|document|prototype|analysis, cadence}), "
    "escalation_triggers (>=1 item), tools."
)


def _strip_codefence(text: str) -> str:
    t = text.strip()
    if t.startswith("```"):
        first_nl = t.find("\n")
        if first_nl != -1:
            t = t[first_nl + 1 :]
    if t.endswith("```"):
        t = t[: -3]
    return t.strip()


class Foundry:
    """Hire (or recall) RoleSpec instances against capability Requisitions."""

    def __init__(self, runs_dir: Path) -> None:
        self.cache_path = runs_dir / "memory" / "org" / "role_corpus.json"
        self.cache_path.parent.mkdir(parents=True, exist_ok=True)
        self._corpus: dict[str, RoleSpec] = self._load_corpus()

    def _load_corpus(self) -> dict[str, RoleSpec]:
        corpus: dict[str, RoleSpec] = {
            f"seed:{spec.department}:{spec.title}": spec for spec in seed_role_specs()
        }
        if self.cache_path.exists():
            try:
                raw = json.loads(self.cache_path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                raw = {}
            for k, v in raw.items():
                try:
                    corpus[k] = RoleSpec.model_validate(v)
                except ValidationError:
                    continue
        return corpus

    def _save_corpus(self) -> None:
        hired = {k: v.model_dump() for k, v in self._corpus.items() if v.origin == "hired"}
        try:
            self.cache_path.write_text(json.dumps(hired, indent=2), encoding="utf-8")
        except OSError:
            return

    def lookup(self, req: Requisition) -> RoleSpec | None:
        key = f"req:{req.department}:{req.canonical_key()}"
        if key in self._corpus:
            return self._corpus[key]
        tokens = {t for t in req.capability.lower().split() if len(t) > 3}
        best: tuple[int, RoleSpec | None] = (0, None)
        for spec in self._corpus.values():
            if spec.department != req.department:
                continue
            haystack = " ".join(
                [spec.one_liner.lower(), *[d.lower() for d in spec.expertise_domains]]
            )
            overlap = sum(1 for t in tokens if t in haystack)
            if overlap > best[0]:
                best = (overlap, spec)
        return best[1] if best[0] >= 2 else None

    def _seed_fallback(self, req: Requisition) -> RoleSpec:
        for spec in self._corpus.values():
            if spec.department == req.department and spec.origin == "seed":
                return spec
        return next(iter(self._corpus.values()))

    async def hire(self, req: Requisition) -> RoleSpec:
        trace_event(
            "foundry.requisition",
            gate=req.gate,
            dept=req.department,
            lead=req.issuing_lead,
            cap_key=req.canonical_key(),
        )
        cached = self.lookup(req)
        if cached is not None:
            trace_event(
                "foundry.cache_hit",
                gate=req.gate,
                dept=req.department,
                lead=req.issuing_lead,
                role=cached.title,
                origin=cached.origin,
            )
            return cached
        spec = await self._hire_via_llm(req)
        if spec is not None:
            key = f"req:{req.department}:{req.canonical_key()}"
            self._corpus[key] = spec
            self._save_corpus()
            trace_event(
                "foundry.hire",
                gate=req.gate,
                dept=req.department,
                lead=req.issuing_lead,
                role=spec.title,
                seniority=spec.seniority,
            )
            return spec
        fb = self._seed_fallback(req)
        trace_event(
            "foundry.fallback",
            gate=req.gate,
            dept=req.department,
            lead=req.issuing_lead,
            role=fb.title,
        )
        return fb

    async def _hire_via_llm(self, req: Requisition) -> RoleSpec | None:
        settings = load_settings()
        try:
            provider = get_provider(settings.llm_provider)
            if not await provider.healthcheck():
                return None
            prompt = (
                "Requisition\n"
                f"gate: {req.gate}\n"
                f"issuing_lead: {req.issuing_lead}\n"
                f"department: {req.department}\n"
                f"capability: {req.capability}\n"
                f"deliverable: {req.deliverable}\n"
                f"constraints: {', '.join(req.constraints) or '(none)'}\n"
                f"context: {req.context_summary or '(none)'}"
            )
            resp = await provider.complete(
                system=TALENT_SYSTEM,
                prompt=prompt,
                model=TALENT_MODEL,
                max_tokens=1800,
            )
            raw = json.loads(_strip_codefence(resp.text))
            if isinstance(raw, dict):
                raw["origin"] = "hired"
            spec = RoleSpec.model_validate(raw)
            QuotaGuard(cap=settings.quota_cap).charge(req.department, 0.01)
            trace_event(
                "quota.charge",
                dept=req.department,
                role="Talent Lead",
                gate=req.gate,
                frac=0.01,
                input_tokens=resp.input_tokens,
                output_tokens=resp.output_tokens,
                tier="opus",
            )
            return spec
        except (ValidationError, json.JSONDecodeError) as e:
            trace_event(
                "foundry.hire.parse_error",
                gate=req.gate,
                dept=req.department,
                error=type(e).__name__,
            )
            return None
        except Exception as e:
            trace_event(
                "foundry.hire.error",
                gate=req.gate,
                dept=req.department,
                error=f"{type(e).__name__}:{str(e)[:80]}",
            )
            return None
