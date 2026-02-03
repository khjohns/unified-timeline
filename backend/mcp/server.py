"""
MCP Server implementation for Lovdata tools.

Implements the Model Context Protocol (MCP) JSON-RPC interface
for exposing Norwegian law lookup tools to AI assistants.

Protocol specification: https://modelcontextprotocol.io/specification/2025-03-26
"""

from typing import Any

from services.lovdata_service import LovdataService
from utils.logger import get_logger

logger = get_logger(__name__)


# MCP Protocol version
PROTOCOL_VERSION = "2025-06-18"

# Server info
SERVER_INFO = {
    "name": "lovdata-mcp",
    "version": "0.1.0",
}


class MCPServer:
    """
    MCP Server for Lovdata law lookup tools.

    Handles JSON-RPC requests according to the MCP protocol,
    routing to appropriate tool implementations.
    """

    def __init__(self, lovdata_service: LovdataService | None = None):
        """
        Initialize MCP Server.

        Args:
            lovdata_service: LovdataService instance (created if not provided)
        """
        self.lovdata = lovdata_service or LovdataService()
        self.tools = self._define_tools()
        logger.info(f"MCPServer initialized with {len(self.tools)} tools")

    def _define_tools(self) -> list[dict[str, Any]]:
        """Define available MCP tools with their schemas."""
        return [
            {
                "name": "lov",
                "description": (
                    "Slå opp norsk lov eller spesifikk paragraf fra Lovdata. "
                    "Støtter kortnavn (avhendingslova, buofl, pbl) eller full ID. "
                    "Eksempel: lov('avhendingslova', '3-9') eller lov('bustadoppføringslova', '12')"
                ),
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "lov_id": {
                            "type": "string",
                            "description": (
                                "Lovens kortnavn eller ID. "
                                "Eksempler: 'avhendingslova', 'buofl', 'plan-og-bygningsloven', "
                                "'LOV-1992-07-03-93'"
                            )
                        },
                        "paragraf": {
                            "type": "string",
                            "description": (
                                "Paragrafnummer (valgfritt). "
                                "Eksempler: '3-9', '21-4', '12'. "
                                "Utelat for å få oversikt over hele loven."
                            )
                        }
                    },
                    "required": ["lov_id"]
                }
            },
            {
                "name": "forskrift",
                "description": (
                    "Slå opp norsk forskrift fra Lovdata. "
                    "Eksempel: forskrift('byggherreforskriften', '5')"
                ),
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "forskrift_id": {
                            "type": "string",
                            "description": "Forskriftens navn eller ID"
                        },
                        "paragraf": {
                            "type": "string",
                            "description": "Paragrafnummer (valgfritt)"
                        }
                    },
                    "required": ["forskrift_id"]
                }
            },
            {
                "name": "sok",
                "description": (
                    "Søk i norske lover og forskrifter. "
                    "Returnerer relevante lover basert på søkeord. "
                    "Eksempel: sok('erstatning mangel bolig')"
                ),
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "Søkeord eller -frase"
                        },
                        "limit": {
                            "type": "integer",
                            "description": "Maks antall resultater (standard: 10)",
                            "default": 10
                        }
                    },
                    "required": ["query"]
                }
            },
            {
                "name": "liste",
                "description": (
                    "List alle tilgjengelige lover og forskrifter med deres kortnavn. "
                    "Nyttig for å se hvilke lover som kan slås opp."
                ),
                "inputSchema": {
                    "type": "object",
                    "properties": {},
                    "required": []
                }
            }
        ]

    def handle_request(self, body: dict[str, Any]) -> dict[str, Any]:
        """
        Handle incoming MCP JSON-RPC request.

        Args:
            body: JSON-RPC request body

        Returns:
            JSON-RPC response
        """
        method = body.get("method", "")
        params = body.get("params", {})
        request_id = body.get("id")

        logger.debug(f"MCP request: method={method}, id={request_id}")

        try:
            if method == "initialize":
                result = self.handle_initialize(params)
            elif method == "initialized":
                # Client acknowledgment - no response needed
                result = {}
            elif method == "tools/list":
                result = self.handle_tools_list()
            elif method == "tools/call":
                result = self.handle_tools_call(params)
            elif method == "resources/list":
                result = self.handle_resources_list()
            elif method == "prompts/list":
                result = self.handle_prompts_list()
            elif method == "ping":
                result = {}
            else:
                logger.warning(f"Unknown MCP method: {method}")
                return self._error_response(
                    request_id,
                    -32601,
                    f"Method not found: {method}"
                )

            return self._success_response(request_id, result)

        except Exception as e:
            logger.exception(f"Error handling MCP request: {e}")
            return self._error_response(request_id, -32603, str(e))

    def handle_initialize(self, params: dict[str, Any]) -> dict[str, Any]:
        """
        Handle initialize request.

        Returns server capabilities and protocol version.
        """
        client_info = params.get("clientInfo", {})
        logger.info(
            f"MCP client connected: {client_info.get('name', 'unknown')} "
            f"v{client_info.get('version', '?')}"
        )

        return {
            "protocolVersion": PROTOCOL_VERSION,
            "serverInfo": SERVER_INFO,
            "capabilities": {
                "tools": {},
                "resources": {},
                "prompts": {},
            }
        }

    def handle_tools_list(self) -> dict[str, Any]:
        """Return list of available tools."""
        return {"tools": self.tools}

    def handle_tools_call(self, params: dict[str, Any]) -> dict[str, Any]:
        """
        Execute a tool call.

        Args:
            params: Tool call parameters (name, arguments)

        Returns:
            Tool execution result
        """
        tool_name = params.get("name", "")
        arguments = params.get("arguments", {})

        logger.info(f"Tool call: {tool_name} with args: {arguments}")

        try:
            if tool_name == "lov":
                content = self.lovdata.lookup_law(
                    arguments.get("lov_id", ""),
                    arguments.get("paragraf")
                )
            elif tool_name == "forskrift":
                content = self.lovdata.lookup_regulation(
                    arguments.get("forskrift_id", ""),
                    arguments.get("paragraf")
                )
            elif tool_name == "sok":
                content = self.lovdata.search(
                    arguments.get("query", ""),
                    arguments.get("limit", 10)
                )
            elif tool_name == "liste":
                content = self.lovdata.list_available_laws()
            else:
                content = f"Ukjent verktøy: {tool_name}"
                logger.warning(f"Unknown tool requested: {tool_name}")

            return {
                "content": [
                    {
                        "type": "text",
                        "text": content
                    }
                ]
            }

        except Exception as e:
            logger.exception(f"Tool execution error: {e}")
            return {
                "content": [
                    {
                        "type": "text",
                        "text": f"Feil ved kjøring av {tool_name}: {str(e)}"
                    }
                ],
                "isError": True
            }

    def handle_resources_list(self) -> dict[str, Any]:
        """Return list of available resources (none for now)."""
        return {"resources": []}

    def handle_prompts_list(self) -> dict[str, Any]:
        """Return list of available prompts (none for now)."""
        return {"prompts": []}

    def _success_response(
        self,
        request_id: Any,
        result: dict[str, Any]
    ) -> dict[str, Any]:
        """Format successful JSON-RPC response."""
        return {
            "jsonrpc": "2.0",
            "id": request_id,
            "result": result
        }

    def _error_response(
        self,
        request_id: Any,
        code: int,
        message: str
    ) -> dict[str, Any]:
        """Format error JSON-RPC response."""
        return {
            "jsonrpc": "2.0",
            "id": request_id,
            "error": {
                "code": code,
                "message": message
            }
        }
