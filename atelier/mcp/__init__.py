"""MCP (Model Context Protocol) registry — list of tools available per role."""

from atelier.mcp.registry import MCP_REGISTRY, MCPServer, list_for_department

__all__ = ["MCPServer", "MCP_REGISTRY", "list_for_department"]
