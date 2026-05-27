"""Typer entry point: `atelier <command>`."""

from __future__ import annotations

import asyncio

import typer
from rich.console import Console
from rich.table import Table

from atelier import __version__
from atelier.config import load_settings
from atelier.inbox import list_items, write_item
from atelier.llm.provider import get_provider

app = typer.Typer(
    name="atelier",
    help="Virtual company of role-specialized agents (Phase A).",
    no_args_is_help=True,
)
auth_app = typer.Typer(help="Subscription auth (Claude Code SDK OAuth).")
inbox_app = typer.Typer(help="Inbox operations.")
app.add_typer(auth_app, name="auth")
app.add_typer(inbox_app, name="inbox")

console = Console()


@app.command()
def version() -> None:
    """Print version."""
    console.print(f"atelier {__version__}")


@app.command()
def start(request: str) -> None:
    """Drop a request into the inbox (Phase A: dry-run only, no graph execution yet)."""
    settings = load_settings()
    settings.ensure_dirs()
    path = write_item(settings.inbox_dir, slug="request", body=f"# {request}\n")
    console.print(f"[green]queued[/green] {path}")
    console.print(
        "[dim]Phase A skeleton: graph execution lands with the first gate (G1).[/dim]"
    )


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


@auth_app.command("login")
def auth_login() -> None:
    """Trigger Claude Code SDK OAuth (browser flow)."""
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
    """Show which provider is selected and whether it can be loaded."""
    settings = load_settings()
    provider = get_provider(settings.llm_provider)
    ok = asyncio.run(provider.healthcheck())
    state = "[green]ready[/green]" if ok else "[yellow]not configured[/yellow]"
    console.print(f"provider = {provider.name}  {state}")
    console.print(f"quota cap = {settings.quota_cap:.0%}")
