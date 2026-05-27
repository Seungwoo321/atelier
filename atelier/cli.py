"""Typer entry point: `atelier <command>`."""

from __future__ import annotations

import asyncio
import json
import sys

import typer
from rich.console import Console
from rich.table import Table

from atelier import __version__
from atelier.config import load_settings
from atelier.inbox import list_items, write_item
from atelier.llm.provider import get_provider
from atelier.mcp.registry import MCP_REGISTRY
from atelier.runner import run_request_sync

app = typer.Typer(
    name="atelier",
    help="Virtual company of role-specialized agents.",
    no_args_is_help=True,
)
auth_app = typer.Typer(help="Subscription auth (Claude Code SDK OAuth).")
inbox_app = typer.Typer(help="Inbox operations.")
mcp_app = typer.Typer(help="MCP server registry.")
app.add_typer(auth_app, name="auth")
app.add_typer(inbox_app, name="inbox")
app.add_typer(mcp_app, name="mcp")

console = Console()


@app.command()
def version() -> None:
    """Print version."""
    console.print(f"atelier {__version__}")


@app.command()
def start(
    request: str = typer.Argument(..., help="What should the company build?"),
    project_id: str = typer.Option("default", help="Project id (used for artifact folders)."),
    dry_run: bool = typer.Option(True, help="Phase A default: dry-run only."),
) -> None:
    """Queue a request and run the G1→G5 graph."""
    settings = load_settings()
    write_item(settings.inbox_dir, slug="request", body=f"# {request}\n")
    if not dry_run:
        console.print("[yellow]non-dry-run not enabled in Phase A[/yellow]")
    try:
        result = run_request_sync(settings, request, project_id=project_id)
    except Exception as e:
        console.print(f"[red]run failed:[/red] {e}")
        sys.exit(1)
    console.print(f"[green]done[/green] gate={result.get('current_gate')}")
    console.print(f"[dim]artifacts at {settings.artifacts_dir / project_id}[/dim]")


@inbox_app.command("list")
def inbox_list() -> None:
    """List pending inbox items."""
    settings = load_settings()
    items = list_items(settings.inbox_dir)
    if not items:
        console.print("[dim]inbox is empty[/dim]")
        return
    table = Table("created", "title", "path")
    for it in items:
        table.add_row(it.created_at.isoformat(timespec="seconds"), it.title, str(it.path))
    console.print(table)


@inbox_app.command("approve")
def inbox_approve(path: str) -> None:
    """Approve a gate card (Phase A: marks the file with .approved suffix)."""
    from pathlib import Path

    p = Path(path)
    if not p.exists():
        console.print(f"[red]not found:[/red] {p}")
        raise typer.Exit(code=1)
    approved = p.with_suffix(p.suffix + ".approved")
    approved.write_text(p.read_text(encoding="utf-8"), encoding="utf-8")
    console.print(f"[green]approved[/green] {approved}")


@auth_app.command("login")
def auth_login() -> None:
    """Trigger Claude Code SDK OAuth (browser flow on first run)."""
    settings = load_settings()
    provider = get_provider(settings.llm_provider)
    ok = asyncio.run(provider.healthcheck())
    if ok:
        console.print(
            f"[green]{provider.name}[/green] provider available. "
            "Run any `atelier start ...` to trigger first-time browser OAuth."
        )
    else:
        console.print(
            f"[yellow]{provider.name}[/yellow] provider not configured. "
            "Install `claude-agent-sdk` or set ATELIER_ACP_ENDPOINT."
        )


@auth_app.command("status")
def auth_status() -> None:
    """Show provider selection and quota cap."""
    settings = load_settings()
    provider = get_provider(settings.llm_provider)
    ok = asyncio.run(provider.healthcheck())
    state = "[green]ready[/green]" if ok else "[yellow]not configured[/yellow]"
    console.print(f"provider = {provider.name}  {state}")
    console.print(f"quota cap = {settings.quota_cap:.0%}")


@mcp_app.command("list")
def mcp_list(department: str | None = typer.Option(None)) -> None:
    """List registered MCP servers (optionally filtered by department)."""
    table = Table("name", "departments", "description")
    for s in MCP_REGISTRY:
        if department and department not in s.departments:
            continue
        table.add_row(s.name, ", ".join(s.departments), s.description)
    console.print(table)


@app.command()
def result(project_id: str = "default") -> None:
    """Print the result.json of a previous run."""
    settings = load_settings()
    p = settings.artifacts_dir / project_id / "result.json"
    if not p.exists():
        console.print(f"[dim]no result at {p}[/dim]")
        raise typer.Exit(code=1)
    console.print_json(json.loads(p.read_text(encoding="utf-8")))
