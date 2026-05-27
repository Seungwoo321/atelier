"""Thin Temporal client wrapper — Phase C-1 durable execution.

Falls back to local async execution when no TEMPORAL_HOST is configured.
"""

from __future__ import annotations

import os
from collections.abc import Awaitable, Callable
from typing import Any


class TemporalRunner:
    def __init__(self, host: str | None = None, namespace: str = "atelier") -> None:
        self.host = host or os.environ.get("TEMPORAL_HOST")
        self.namespace = namespace

    @property
    def is_remote(self) -> bool:
        return bool(self.host)

    async def run_workflow(
        self,
        workflow_id: str,
        fn: Callable[..., Awaitable[Any]],
        *args: Any,
        **kwargs: Any,
    ) -> Any:
        if not self.is_remote:
            return await fn(*args, **kwargs)
        from temporalio.client import Client

        client = await Client.connect(self.host, namespace=self.namespace)  # type: ignore[arg-type]
        handle = await client.start_workflow(
            fn, *args, id=workflow_id, task_queue="atelier-default", **kwargs
        )
        return await handle.result()
