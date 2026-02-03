"""
MCP (Model Context Protocol) server module for Lovdata integration.

This module implements a remote MCP server that exposes Norwegian law
lookup tools to Claude.ai and other MCP-compatible clients.

Usage:
    The MCP server is exposed via Flask routes at /mcp/
    Configure in Claude.ai: Settings → Connectors → Add custom connector

Protocol:
    - MCP Protocol Version: 2025-06-18
    - Transport: Streamable HTTP (POST for requests, optional SSE for streaming)
    - Authentication: None required (public data under NLOD 2.0)

Tools provided:
    - lov: Look up Norwegian laws by name/ID and section
    - forskrift: Look up regulations
    - sok: Search across laws and regulations
    - liste: List available laws
"""

from .server import MCPServer

__all__ = ["MCPServer"]
