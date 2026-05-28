"""High-level run engine — wires inbox → graph → artifacts on disk."""

from __future__ import annotations

import asyncio
import json
from pathlib import Path

from atelier.config import Settings
from atelier.graph.build import build_graph
from atelier.graph.gates._council import run_launch_council
from atelier.graph.state import CompanyState
from atelier.memory.org import OrgMemory
from atelier.memory.project import ProjectMemory
from atelier.memory.role import RoleMemory
from atelier.observability.tracer import configure as configure_logging
from atelier.observability.tracer import trace_event
from atelier.protocols.janitor import JanitorMemo


async def run_request(settings: Settings, request: str, project_id: str = "default") -> dict:
    settings.ensure_dirs()
    configure_logging(settings.runs_dir, settings.log_level)

    OrgMemory(settings.runs_dir).seed()
    pm = ProjectMemory(settings.runs_dir, project_id)
    pm.set("request", request)

    trace_event("run.start", project_id=project_id, request=request[:120])

    # Run without checkpointer for the simple sync path (no resume).
    graph = build_graph(runs_dir=None)
    state: CompanyState = {"request": request}
    final: dict = await graph.ainvoke(state)

    council = await run_launch_council(final)
    if council is not None:
        final["council"] = council

    out_dir = settings.artifacts_dir / project_id
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "result.json").write_text(
        json.dumps(final, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    pm.set("result", final)

    _write_janitor_memo(settings.runs_dir, project_id, final)
    _record_role_memory(settings.runs_dir, project_id, final)

    trace_event("run.done", project_id=project_id, gate=final.get("current_gate"))
    return final


def _record_role_memory(runs_dir: Path, project_id: str, final: dict) -> None:
    notes = "; ".join(final.get("notes") or [])
    title = (final.get("charter") or {}).get("title", "")
    leads = [
        ("Chief of Staff", "charter"),
        ("PM Lead", "plan"),
        ("Design Lead", "design"),
        ("Eng Manager", "code_review"),
        ("Mkt Lead", "launch"),
    ]
    for role, key in leads:
        if not final.get(key):
            continue
        fact = (
            f"[{project_id}] shipped {key} for '{title}'. "
            f"current_gate={final.get('current_gate', '?')}; notes={notes[:200]}"
        )
        try:
            RoleMemory(runs_dir, role).remember(fact, tags=[project_id, key])
        except Exception:  # noqa: BLE001
            continue
    trace_event("memory.role.updated", project_id=project_id, roles=[r for r, _ in leads])


def _write_janitor_memo(runs_dir: Path, project_id: str, final: dict) -> None:
    kept: list[str] = []
    archived: list[str] = []
    for label, key in (
        ("charter", "charter"),
        ("plan", "plan"),
        ("design", "design"),
        ("code_review", "code_review"),
        ("launch", "launch"),
    ):
        if final.get(key):
            kept.append(label)
        else:
            archived.append(label)
    if final.get("prds"):
        kept.append(f"prds×{len(final['prds'])}")
    notes = final.get("notes") or []
    summary = (
        f"Run {project_id} finished at gate {final.get('current_gate', '?')}. "
        f"{len(kept)} typed artifacts kept; {len(archived)} stages produced no artifact. "
        f"Notes: {len(notes)}."
    )
    memo = JanitorMemo(phase=f"run-{project_id}", summary=summary, kept=kept, archived=archived)
    path = memo.write(runs_dir)
    trace_event("janitor.memo", project_id=project_id, path=str(path), kept=kept, archived=archived)


def run_request_sync(settings: Settings, request: str, project_id: str = "default") -> dict:
    return asyncio.run(run_request(settings, request, project_id))
