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

# Server instructions - shown to connecting clients
SERVER_INSTRUCTIONS = """
# Lovdata MCP - Norsk Lovoppslag

Denne MCP-serveren gir tilgang til norske lover og forskrifter fra Lovdata Public API.

## Tilgjengelige verktøy

| Verktøy | Bruk |
|---------|------|
| `lov` | Slå opp spesifikk lov/paragraf |
| `forskrift` | Slå opp forskrift |
| `sok` | Fulltekstsøk i alle lover |
| `liste` | Vis tilgjengelige aliaser |
| `status` | Sjekk sync-status |
| `sjekk_storrelse` | Estimer tokens før henting |

## Viktige begrensninger

**IKKE tilgjengelig via denne MCP:**
- Rettsavgjørelser (Høyesterett, lagmannsrett, tingrett)
- Forarbeider (NOU, Prop., Ot.prp., Innst.)
- Juridiske artikler

For disse, henvis brukeren til lovdata.no.

## Paragraf-format (VIKTIG)

| Input | Resultat |
|-------|----------|
| `"3-9"` | ✅ Korrekt |
| `"§ 3-9"` | ✅ Fungerer (§ strippes) |
| `"14-9"` | ✅ Korrekt |
| `"17"` | ✅ Enkle tall fungerer |
| `" 3-9 "` | ✅ Whitespace håndteres |

**Regel:** Paragraf-parameter trenger kun tallet, ikke §-tegn.

## Søketips

- **Enkle søkeord fungerer best:** `"mangel"`, `"erstatning"`, `"frist"`
- **Kombiner maks 2-3 ord:** `"mangel bolig"` OK, lange fraser gir færre treff
- **Søk returnerer relevante seksjoner** med snippets

## Aliaser

Begge formater fungerer (case-insensitive):
- `avhendingslova` eller `avhl`
- `bustadoppføringslova` eller `buofl`
- `plan-og-bygningsloven` eller `pbl`
- `arbeidsmiljøloven` eller `aml`
- `tvisteloven` eller `tvl`
- `kjøpsloven`, `avtaleloven`, `forvaltningsloven`

Kjør `liste` for komplett oversikt med kategorier.

## Beste praksis

1. **Start med `liste`** for å se tilgjengelige lover
2. **Bruk korte aliaser** (`aml`, `pbl`, `buofl`) for raskere typing
3. **Sjekk størrelse først** med `sjekk_storrelse` for potensielt lange paragrafer
4. **Søk først** med `sok` hvis usikker på hvilken lov som er relevant
5. **Henvis til lovdata.no** for rettsavgjørelser og forarbeider
"""


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
                    "Støtter kortnavn (avhendingslova, buofl, pbl, aml) eller full ID. "
                    "Paragraf: bruk kun tall ('3-9'), ikke '§ 3-9'. "
                    "Eksempel: lov('aml', '14-9') for arbeidsmiljøloven § 14-9"
                ),
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "lov_id": {
                            "type": "string",
                            "description": (
                                "Lovens kortnavn eller ID. "
                                "Korte aliaser: aml, pbl, buofl, avhl, tvl. "
                                "Lange: arbeidsmiljøloven, plan-og-bygningsloven, etc."
                            )
                        },
                        "paragraf": {
                            "type": "string",
                            "description": (
                                "Paragrafnummer uten §-tegn. "
                                "Format: '3-9', '14-9', '17'. "
                                "Utelat for dokumentoversikt."
                            )
                        },
                        "max_tokens": {
                            "type": "integer",
                            "description": (
                                "Maks tokens i respons. "
                                "Bruk sjekk_storrelse først for store paragrafer."
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
                    "Fulltekstsøk i norske lover og forskrifter. "
                    "Tips: Enkle søkeord fungerer best ('mangel', 'erstatning'). "
                    "Returnerer relevante paragrafer med snippets."
                ),
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": (
                                "Søkeord (1-3 ord fungerer best). "
                                "Eksempler: 'mangel', 'erstatning bolig', 'frist'"
                            )
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
            },
            {
                "name": "sync",
                "description": (
                    "Synkroniser lovdata fra Lovdata API. "
                    "Laster ned gjeldende lover og forskrifter til lokal cache. "
                    "Må kjøres minst én gang for at lov() og sok() skal returnere innhold."
                ),
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "force": {
                            "type": "boolean",
                            "description": "Tving re-nedlasting selv om data er oppdatert",
                            "default": False
                        }
                    },
                    "required": []
                }
            },
            {
                "name": "status",
                "description": (
                    "Vis status for synkronisert lovdata. "
                    "Viser når data sist ble synkronisert og antall dokumenter."
                ),
                "inputSchema": {
                    "type": "object",
                    "properties": {},
                    "required": []
                }
            },
            {
                "name": "sjekk_storrelse",
                "description": (
                    "Sjekk størrelsen på en paragraf før henting. "
                    "Returnerer estimert antall tokens. "
                    "Bruk dette for å avgjøre om du bør be brukeren om bekreftelse "
                    "før du henter store paragrafer (>5000 tokens)."
                ),
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "lov_id": {
                            "type": "string",
                            "description": "Lovens kortnavn eller ID"
                        },
                        "paragraf": {
                            "type": "string",
                            "description": "Paragrafnummer (f.eks. '3-9')"
                        }
                    },
                    "required": ["lov_id", "paragraf"]
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
            elif method == "prompts/get":
                result = self.handle_prompts_get(params)
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
            },
            "instructions": SERVER_INSTRUCTIONS.strip()
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
                    arguments.get("paragraf"),
                    max_tokens=arguments.get("max_tokens")
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
            elif tool_name == "sync":
                force = arguments.get("force", False)
                results = self.lovdata.sync(force=force)
                content = self._format_sync_results(results)
            elif tool_name == "status":
                status = self.lovdata.get_sync_status()
                content = self._format_status(status)
            elif tool_name == "sjekk_storrelse":
                size_info = self.lovdata.get_section_size(
                    arguments.get("lov_id", ""),
                    arguments.get("paragraf", "")
                )
                content = self._format_size_check(
                    arguments.get("lov_id", ""),
                    arguments.get("paragraf", ""),
                    size_info
                )
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

    def _format_sync_results(self, results: dict[str, int]) -> str:
        """Format sync results for display."""
        lines = ["## Synkronisering fullført\n"]

        total = 0
        for dataset, count in results.items():
            if count >= 0:
                lines.append(f"- **{dataset}**: {count} dokumenter indeksert")
                total += count
            else:
                lines.append(f"- **{dataset}**: Feilet")

        lines.append(f"\n**Totalt:** {total} dokumenter")
        lines.append("\n*Lovdata er nå tilgjengelig for oppslag og søk.*")

        return "\n".join(lines)

    def _format_status(self, status: dict) -> str:
        """Format sync status for display."""
        if not status:
            return """## Lovdata Status

**Status:** Ikke synkronisert

Kjør `sync()` for å laste ned lovdata fra Lovdata API.
"""

        lines = ["## Lovdata Status\n"]

        # Show backend type
        lines.append(f"**Backend:** {self.lovdata.get_backend_type()}\n")

        for dataset, info in status.items():
            lines.append(f"### {dataset.title()}")
            lines.append(f"- **Sist synkronisert:** {info.get('synced_at', 'Ukjent')}")
            lines.append(f"- **Antall filer:** {info.get('file_count', 0)}")
            lines.append(f"- **Kilde oppdatert:** {info.get('last_modified', 'Ukjent')}")
            lines.append("")

        return "\n".join(lines)

    def _format_size_check(
        self,
        lov_id: str,
        paragraf: str,
        size_info: dict | None
    ) -> str:
        """Format size check result."""
        if not size_info:
            return f"Fant ikke § {paragraf} i {lov_id}."

        tokens = size_info.get('estimated_tokens', 0)
        chars = size_info.get('char_count', 0)

        # Determine if this is a large response
        if tokens > 5000:
            warning = (
                f"\n**Advarsel:** Denne paragrafen er stor ({tokens:,} tokens). "
                f"Vurder å be brukeren om bekreftelse før henting, "
                f"eller bruk `max_tokens` parameter for å begrense."
            )
        elif tokens > 2000:
            warning = "\n*Mellomstor paragraf - bør gå greit å hente.*"
        else:
            warning = "\n*Liten paragraf - trygt å hente.*"

        return f"""## Størrelse: {lov_id} § {paragraf}

- **Tegn:** {chars:,}
- **Estimerte tokens:** {tokens:,}
{warning}
"""

    def handle_resources_list(self) -> dict[str, Any]:
        """Return list of available resources (none for now)."""
        return {"resources": []}

    def handle_prompts_list(self) -> dict[str, Any]:
        """Return list of available prompts."""
        return {
            "prompts": [
                {
                    "name": "lovdata-guide",
                    "description": (
                        "Komplett brukerveiledning for Lovdata MCP. "
                        "Inkluderer tilgjengelige verktøy, aliaser, begrensninger og tips."
                    ),
                    "arguments": []
                }
            ]
        }

    def handle_prompts_get(self, params: dict[str, Any]) -> dict[str, Any]:
        """
        Get a specific prompt by name.

        Args:
            params: Prompt parameters (name, arguments)

        Returns:
            Prompt content
        """
        prompt_name = params.get("name", "")

        if prompt_name == "lovdata-guide":
            return {
                "description": "Brukerveiledning for Lovdata MCP",
                "messages": [
                    {
                        "role": "user",
                        "content": {
                            "type": "text",
                            "text": SERVER_INSTRUCTIONS.strip()
                        }
                    }
                ]
            }

        return {
            "description": f"Ukjent prompt: {prompt_name}",
            "messages": []
        }

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
