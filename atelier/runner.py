"""High-level run engine — wires inbox → graph → artifacts on disk."""

from __future__ import annotations

import asyncio
import json
from pathlib import Path

from atelier.config import Settings
from atelier.graph.build import build_graph
from atelier.graph.state import CompanyState
from atelier.memory.org import OrgMemory
from atelier.memory.project import ProjectMemory
from atelier.observability.tracer import configure as configure_logging
from atelier.observability.tracer import trace_event


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

    out_dir = settings.artifacts_dir / project_id
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "result.json").write_text(
        json.dumps(final, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    pm.set("result", final)
    trace_event("run.done", project_id=project_id, gate=final.get("current_gate"))
    return final


def run_request_sync(settings: Settings, request: str, project_id: str = "default") -> dict:
    return asyncio.run(run_request(settings, request, project_id))
