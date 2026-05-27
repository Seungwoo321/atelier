"""Observability — structured logging + optional Langfuse tracing."""

from atelier.observability.tracer import get_logger, trace_event

__all__ = ["trace_event", "get_logger"]
