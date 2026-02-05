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

Tilgang til norske lover og forskrifter fra Lovdata Public API (92 000+ paragrafer).

## Verktøy

| Verktøy | Bruk |
|---------|------|
| `lov(lov_id, paragraf?)` | Slå opp lov. Uten paragraf → innholdsfortegnelse |
| `forskrift(id, paragraf?)` | Slå opp forskrift. Uten paragraf → innholdsfortegnelse |
| `sok(query, limit=20)` | Fulltekstsok (returnerer 500-tegn snippets) |
| `hent_flere(lov_id, [paragrafer])` | Batch-henting (~80% raskere enn separate kall) |
| `liste` | Vis aliaser (IKKE komplett liste - alle 770+ lover kan slås opp) |
| `sjekk_storrelse` | Estimer tokens før henting |

## Søketips (VIKTIG!)

Søket bruker AND-logikk: alle ord MÅ finnes i samme paragraf.

| Søk | Resultat | Hvorfor |
|-----|----------|---------|
| `klima` | ✅ | Enkeltord fungerer |
| `vesentlig mislighold` | ✅ | Begge ord i teksten |
| `anskaffelsesforskriften miljø` | ❌ | "anskaffelsesforskriften" er tittel, ikke innhold |
| `miljøkriterier` | ❌ | Prøv `miljø` eller `klima` i stedet |

**Søkesyntaks:**
- `miljø OR klima` → minst ett ord må matche
- `"vesentlig mislighold"` → eksakt frase
- `mangel -bil` → mangel, men ikke bil

**Tommelfingerregler:**
- Bruk 1-2 **substantiver fra lovteksten** (ikke dokumentnavn)
- Ved usikkerhet → bruk `OR` mellom alternativer
- Lange spørsmål → `erstatning OR mangel eiendom`, ikke hele setninger

## Anbefalt arbeidsflyt

1. **Ukjent rettsområde?** → `sok("brede nøkkelord")` - kartlegg først!
2. **Vet hvilken lov?** → `lov("navn")` gir innholdsfortegnelse med tokens
3. **Trenger flere §§?** → `hent_flere()` er ~80% raskere
4. **Store paragrafer?** → `sjekk_storrelse()` først, spør bruker ved >5000 tokens
5. **Presis sitering?** → `lov("navn", "paragraf")`

## Viktig om lov-IDer

**Hvis lovnavn ikke fungerer:** Bruk full ID fra sok-resultatet!
- `sok("tvangsfullbyrdelse")` → gir ID `lov/1992-06-26-86`
- `lov("lov/1992-06-26-86", "13-2")` → fungerer alltid

Sok returnerer alltid gyldig ID som kan brukes direkte i lov().

**Ikke anta du kjenner hele rettsbildet!**
- Søk bredt ved tverrfaglige spørsmål
- Søk tilgrensende områder (personvern → også "arkiv", "taushetsplikt")
- Ved offentlig sektor: sok også sektorspesifikke regler

## GDPR / Personvern

GDPR (personvernforordningen) er tilgjengelig via personopplysningsloven:
- `lov("personopplysningsloven", "Artikkel 5")` → GDPR Art. 5 (prinsipper)
- `lov("personopplysningsloven", "Artikkel 6")` → GDPR Art. 6 (behandlingsgrunnlag)
- `sok("personvernkonsekvenser")` → finner DPIA-krav (Art. 35)

## Begrensninger

**IKKE tilgjengelig:**
- Rettsavgjørelser (Høyesterett, lagmannsrett)
- Forarbeider (NOU, Prop., Ot.prp.)
- Juridiske artikler

→ Henvis til lovdata.no for disse.

## Aliaser

| Kort | Full |
|------|------|
| `avhl` | avhendingslova |
| `buofl` | bustadoppføringslova |
| `pbl` | plan-og-bygningsloven |
| `aml` | arbeidsmiljøloven |
| `foa` | anskaffelsesforskriften |
| `tek17` | byggteknisk forskrift |

Kjør `liste` for komplett oversikt.
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
                "title": "Lovoppslag",
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
                "title": "Forskriftsoppslag",
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
                        },
                        "max_tokens": {
                            "type": "integer",
                            "description": "Maks antall tokens i respons (valgfritt)"
                        }
                    },
                    "required": ["forskrift_id"]
                }
            },
            {
                "name": "sok",
                "title": "Søk i Lovdata",
                "description": (
                    "Fulltekstsøk i norske lover. Støtter: OR, \"frase\", -ekskluder. "
                    "Eks: 'mangel', 'miljø OR klima', '\"vesentlig mislighold\"'. "
                    "Bruk substantiver fra lovteksten, ikke dokumentnavn."
                ),
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": (
                                "Søkeord. Støtter: OR, \"frase\", -ekskluder. "
                                "Eks: 'klima', 'miljø OR tildelingskriterier', "
                                "'\"vesentlig mislighold\"'"
                            )
                        },
                        "limit": {
                            "type": "integer",
                            "description": "Maks antall resultater (standard: 20)",
                            "default": 20
                        }
                    },
                    "required": ["query"]
                }
            },
            {
                "name": "hent_flere",
                "title": "Hent flere paragrafer",
                "description": (
                    "Hent flere paragrafer fra samme lov i ett kall. "
                    "Mer effektivt enn flere separate lov()-kall. "
                    "Eksempel: hent_flere('personopplysningsloven', ['Artikkel 5', 'Artikkel 6', 'Artikkel 35'])"
                ),
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "lov_id": {
                            "type": "string",
                            "description": "Lov-ID eller alias (f.eks. 'personopplysningsloven')"
                        },
                        "paragrafer": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "Liste med paragraf-IDer (f.eks. ['Artikkel 5', 'Artikkel 6'])"
                        },
                        "max_tokens": {
                            "type": "integer",
                            "description": "Maks tokens per paragraf (valgfri)"
                        }
                    },
                    "required": ["lov_id", "paragrafer"]
                }
            },
            {
                "name": "liste",
                "title": "Aliaser",
                "description": (
                    "Vis forhåndsdefinerte aliaser (snarveier) for vanlige lover. "
                    "MERK: Dette er IKKE en komplett liste - alle 770+ lover i Lovdata "
                    "kan slås opp med lov('lovnavn'). Bruk sok() for å finne lover."
                ),
                "inputSchema": {
                    "type": "object",
                    "properties": {},
                    "required": []
                }
            },
            {
                "name": "sync",
                "title": "Synkroniser",
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
                "title": "Synkroniseringsstatus",
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
                "title": "Sjekk paragrafstørrelse",
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
            elif method == "resources/read":
                result = self.handle_resources_read(params)
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
                    arguments.get("paragraf"),
                    max_tokens=arguments.get("max_tokens")
                )
            elif tool_name == "sok":
                query = arguments.get("query", "")
                limit = arguments.get("limit", 20)
                content = self.lovdata.search(query, limit)
            elif tool_name == "hent_flere":
                lov_id = arguments.get("lov_id", "")
                paragrafer = arguments.get("paragrafer", [])
                max_tokens = arguments.get("max_tokens")
                content = self.lovdata.lookup_sections_batch(
                    lov_id, paragrafer, max_tokens=max_tokens
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
        lines.append("\n*Lovdata er nå tilgjengelig for oppslag og sok.*")

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
        """Return list of available resources."""
        return {"resources": []}

    def handle_resources_read(self, params: dict[str, Any]) -> dict[str, Any]:
        """Read a resource by URI."""
        uri = params.get("uri", "")
        logger.warning(f"Unknown resource URI: {uri}")
        return {"contents": []}

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
