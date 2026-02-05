"""
MCP Server implementation for Lovdata tools.

Implements the Model Context Protocol (MCP) JSON-RPC interface
for exposing Norwegian law lookup tools to AI assistants.

Protocol specification: https://modelcontextprotocol.io/specification/2025-03-26
"""

import re
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
| `sok(query, limit=20)` | Fulltekstsøk (returnerer 500-tegn snippets) |
| `hent_flere(lov_id, [paragrafer])` | Batch-henting (~80% raskere enn separate kall) |
| `liste` | Vis tilgjengelige aliaser |
| `sjekk_storrelse` | Estimer tokens før henting |

## Anbefalt arbeidsflyt

1. **Ukjent rettsområde?** → `sok("brede nøkkelord")` - kartlegg først!
2. **Vet hvilken lov?** → `lov("navn")` gir innholdsfortegnelse med tokens
3. **Trenger flere §§?** → `hent_flere()` er ~80% raskere
4. **Store paragrafer?** → `sjekk_storrelse()` først, spør bruker ved >5000 tokens
5. **Presis sitering?** → `lov("navn", "paragraf")`

**Viktig:** Ikke anta du kjenner hele rettsbildet!
- Søk bredt ved tverrfaglige spørsmål
- Søk tilgrensende områder (personvern → også "arkiv", "taushetsplikt")
- Ved offentlig sektor: søk også sektorspesifikke regler

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


# =============================================================================
# MCP Apps UI Templates
# =============================================================================

SEARCH_UI_TEMPLATE = """
<!DOCTYPE html>
<html lang="no">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 16px;
      background: #fafafa;
      color: #1a1a1a;
    }
    .header {
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 2px solid #2563eb;
    }
    .header h2 { font-size: 18px; color: #1e40af; }
    .header .count { font-size: 14px; color: #6b7280; margin-top: 4px; }
    .filters {
      display: flex;
      gap: 8px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }
    .filter-btn {
      padding: 6px 14px;
      border: 1px solid #d1d5db;
      border-radius: 20px;
      background: white;
      cursor: pointer;
      font-size: 13px;
      transition: all 0.15s;
    }
    .filter-btn:hover { background: #f3f4f6; }
    .filter-btn.active {
      background: #dbeafe;
      border-color: #2563eb;
      color: #1e40af;
    }
    .results { display: flex; flex-direction: column; gap: 10px; }
    .result-card {
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 14px;
      cursor: pointer;
      transition: all 0.15s;
    }
    .result-card:hover {
      border-color: #2563eb;
      box-shadow: 0 2px 8px rgba(37, 99, 235, 0.1);
    }
    .result-card .law-name {
      font-weight: 600;
      color: #2563eb;
      font-size: 15px;
    }
    .result-card .section {
      color: #6b7280;
      font-size: 13px;
      margin-top: 2px;
    }
    .result-card .snippet {
      color: #374151;
      font-size: 14px;
      margin-top: 8px;
      line-height: 1.5;
    }
    .result-card .snippet mark {
      background: #fef08a;
      padding: 1px 2px;
      border-radius: 2px;
    }
    .result-card .type-badge {
      display: inline-block;
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 10px;
      margin-top: 8px;
    }
    .type-badge.lov { background: #dbeafe; color: #1e40af; }
    .type-badge.forskrift { background: #dcfce7; color: #166534; }
    .empty-state {
      text-align: center;
      padding: 40px;
      color: #6b7280;
    }
    /* Dark theme support */
    body.dark-theme {
      background: #1a1a1a;
      color: #e5e7eb;
    }
    .dark-theme .header { border-bottom-color: #3b82f6; }
    .dark-theme .header h2 { color: #60a5fa; }
    .dark-theme .header .count { color: #9ca3af; }
    .dark-theme .filter-btn {
      background: #374151;
      border-color: #4b5563;
      color: #e5e7eb;
    }
    .dark-theme .filter-btn:hover { background: #4b5563; }
    .dark-theme .filter-btn.active {
      background: #1e3a5f;
      border-color: #3b82f6;
      color: #93c5fd;
    }
    .dark-theme .result-card {
      background: #1f2937;
      border-color: #374151;
    }
    .dark-theme .result-card:hover { border-color: #3b82f6; }
    .dark-theme .result-card .law-name { color: #60a5fa; }
    .dark-theme .result-card .section { color: #9ca3af; }
    .dark-theme .result-card .snippet { color: #d1d5db; }
    .dark-theme .result-card .snippet mark {
      background: #854d0e;
      color: #fef08a;
    }
  </style>
</head>
<body>
  <div class="header">
    <h2>Søkeresultater</h2>
    <div class="count" id="result-count">Laster...</div>
  </div>

  <div class="filters">
    <button class="filter-btn active" data-type="all">Alle</button>
    <button class="filter-btn" data-type="lov">Lover</button>
    <button class="filter-btn" data-type="forskrift">Forskrifter</button>
  </div>

  <div class="results" id="results"></div>

  <script>
    // MCP Apps data hydration via postMessage (spec 2026-01-26)
    let data = { results: [], query: '', count: 0 };
    let requestId = 1;
    let hostContext = {};

    function renderResults(filter = 'all') {
      const container = document.getElementById('results');
      const countEl = document.getElementById('result-count');

      const filtered = filter === 'all'
        ? data.results
        : data.results.filter(r => r.type === filter);

      countEl.textContent = `${filtered.length} treff for "${data.query}"`;

      if (filtered.length === 0) {
        container.innerHTML = '<div class="empty-state">Ingen resultater funnet</div>';
        return;
      }

      container.innerHTML = filtered.map(r => `
        <div class="result-card" data-law-id="${r.lawId}" data-section="${r.section}">
          <div class="law-name">${r.lawName}</div>
          <div class="section">§ ${r.section}</div>
          <div class="snippet">${r.snippet}</div>
          <span class="type-badge ${r.type}">${r.type === 'lov' ? 'Lov' : 'Forskrift'}</span>
        </div>
      `).join('');

      // Click handler for drilling down - use standard MCP tools/call
      container.querySelectorAll('.result-card').forEach(card => {
        card.onclick = () => {
          window.parent.postMessage({
            jsonrpc: '2.0',
            id: requestId++,
            method: 'tools/call',
            params: {
              name: 'lov',
              arguments: {
                lov_id: card.dataset.lawId,
                paragraf: card.dataset.section
              }
            }
          }, '*');
        };
      });
    }

    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderResults(btn.dataset.type);
      };
    });

    // MCP Apps protocol: send initialize request and wait for response
    function sendRequest(method, params) {
      return new Promise((resolve, reject) => {
        const id = requestId++;
        const handler = (event) => {
          if (event.source !== window.parent) return;
          if (event.data?.id === id) {
            window.removeEventListener('message', handler);
            if (event.data.error) {
              reject(new Error(event.data.error.message || 'Request failed'));
            } else {
              resolve(event.data.result);
            }
          }
        };
        window.addEventListener('message', handler);
        window.parent.postMessage({ jsonrpc: '2.0', id, method, params }, '*');
      });
    }

    // Listen for notifications from MCP host
    window.addEventListener('message', (event) => {
      if (event.source !== window.parent) return;

      const message = event.data;
      if (!message || message.jsonrpc !== '2.0') return;
      // Ignore responses (they have id), only handle notifications
      if (message.id !== undefined) return;

      // Handle tool input (arguments) - sent before tool-result
      if (message.method === 'ui/notifications/tool-input') {
        // Tool arguments available in message.params.arguments
        // For search UI, we wait for tool-result with actual data
      }

      // Handle tool result with structuredContent
      if (message.method === 'ui/notifications/tool-result') {
        const toolResult = message.params;
        if (toolResult?.structuredContent) {
          data = toolResult.structuredContent;
          renderResults();
        }
      }

      // Handle host context changes (theme, locale, etc.)
      if (message.method === 'ui/notifications/host-context-changed') {
        Object.assign(hostContext, message.params);
        if (message.params.theme) applyTheme(message.params.theme);
      }
    });

    // Apply theme from hostContext
    function applyTheme(theme) {
      document.body.classList.toggle('dark-theme', theme === 'dark');
    }

    // Send size notification to host (debounced)
    let sizeTimeout;
    function notifySize() {
      clearTimeout(sizeTimeout);
      sizeTimeout = setTimeout(() => {
        window.parent.postMessage({
          jsonrpc: '2.0',
          method: 'ui/notifications/size-changed',
          params: {
            width: document.body.scrollWidth,
            height: document.body.scrollHeight
          }
        }, '*');
      }, 100);
    }

    // MCP Apps handshake: initialize → notifications/initialized
    async function initializeMcpApp() {
      const result = await sendRequest('initialize', {
        protocolVersion: '2026-01-26',
        capabilities: {},
        clientInfo: { name: 'Lovdata Search UI', version: '1.0.0' }
      });
      hostContext = result?.hostContext || {};

      // Apply initial theme
      if (hostContext.theme) applyTheme(hostContext.theme);

      window.parent.postMessage({
        jsonrpc: '2.0',
        method: 'notifications/initialized'
      }, '*');

      // Start observing size changes
      new ResizeObserver(notifySize).observe(document.body);
    }

    // Start initialization
    initializeMcpApp();

    // Initial render with loading state
    document.getElementById('result-count').textContent = 'Venter på data...';
  </script>
</body>
</html>
"""

LAW_UI_TEMPLATE = """
<!DOCTYPE html>
<html lang="no">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Georgia, 'Times New Roman', serif;
      padding: 20px;
      max-width: 800px;
      margin: 0 auto;
      background: #fefefe;
      color: #1a1a1a;
      line-height: 1.7;
    }
    .law-header {
      border-bottom: 3px solid #1e40af;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    .law-title {
      font-size: 24px;
      font-weight: bold;
      color: #1e3a5f;
    }
    .law-meta {
      color: #6b7280;
      font-size: 14px;
      margin-top: 6px;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    }
    .toc {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 28px;
    }
    .toc-title {
      font-weight: 600;
      margin-bottom: 10px;
      font-family: -apple-system, sans-serif;
      font-size: 14px;
      color: #475569;
    }
    .toc-item {
      padding: 6px 0;
      color: #2563eb;
      cursor: pointer;
      font-size: 14px;
      font-family: -apple-system, sans-serif;
    }
    .toc-item:hover { text-decoration: underline; }
    .chapter {
      margin-bottom: 32px;
    }
    .chapter-title {
      font-size: 18px;
      font-weight: 600;
      color: #1e3a5f;
      margin-bottom: 16px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .chapter-title::before {
      content: '▼';
      font-size: 10px;
      transition: transform 0.2s;
    }
    .chapter-title.collapsed::before {
      transform: rotate(-90deg);
    }
    .chapter-content.hidden { display: none; }
    .paragraph {
      margin-bottom: 20px;
      padding-left: 16px;
      border-left: 3px solid transparent;
    }
    .paragraph:hover {
      border-left-color: #2563eb;
      background: #f8fafc;
    }
    .paragraph-num {
      font-weight: bold;
      color: #1e40af;
      font-family: -apple-system, sans-serif;
    }
    .paragraph-text {
      margin-top: 4px;
    }
    .highlight { background: #fef08a; }
    /* Dark theme support */
    body.dark-theme {
      background: #1a1a1a;
      color: #e5e7eb;
    }
    .dark-theme .law-header { border-bottom-color: #3b82f6; }
    .dark-theme .law-title { color: #93c5fd; }
    .dark-theme .law-meta { color: #9ca3af; }
    .dark-theme .toc {
      background: #1f2937;
      border-color: #374151;
    }
    .dark-theme .toc-title { color: #9ca3af; }
    .dark-theme .toc-item { color: #60a5fa; }
    .dark-theme .chapter-title { color: #93c5fd; }
    .dark-theme .paragraph:hover {
      background: #1f2937;
    }
    .dark-theme .paragraph-num { color: #60a5fa; }
    .dark-theme .highlight {
      background: #854d0e;
      color: #fef08a;
    }
  </style>
</head>
<body>
  <div class="law-header">
    <div class="law-title" id="law-title">Laster...</div>
    <div class="law-meta" id="law-meta"></div>
  </div>

  <div class="toc" id="toc">
    <div class="toc-title">Innhold</div>
    <div id="toc-items"></div>
  </div>

  <div id="content"></div>

  <script>
    // MCP Apps data hydration via postMessage (spec 2026-01-26)
    let data = {
      lawName: 'Laster...',
      shortName: '',
      lastModified: '',
      chapters: []
    };
    let requestId = 1;
    let hostContext = {};

    function render() {
      document.getElementById('law-title').textContent = data.lawName;
      document.getElementById('law-meta').textContent =
        data.shortName ? `${data.shortName} • Sist endret: ${data.lastModified}` : '';

      // Table of contents
      const tocItems = document.getElementById('toc-items');
      if (data.chapters && data.chapters.length > 0) {
        tocItems.innerHTML = data.chapters.map((ch, i) =>
          `<div class="toc-item" onclick="scrollTo('chapter-${i}')">${ch.title}</div>`
        ).join('');
      } else {
        tocItems.innerHTML = '<div style="color: #6b7280;">Venter på data...</div>';
      }

      // Content
      const content = document.getElementById('content');
      if (data.chapters && data.chapters.length > 0) {
        content.innerHTML = data.chapters.map((ch, i) => `
          <div class="chapter" id="chapter-${i}">
            <div class="chapter-title" onclick="toggleChapter(this)">
              ${ch.title}
            </div>
            <div class="chapter-content">
              ${ch.paragraphs.map(p => `
                <div class="paragraph">
                  <span class="paragraph-num">§ ${p.number}</span>
                  <div class="paragraph-text">${p.text}</div>
                </div>
              `).join('')}
            </div>
          </div>
        `).join('');
      }
    }

    function scrollTo(id) {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    }

    function toggleChapter(el) {
      el.classList.toggle('collapsed');
      el.nextElementSibling.classList.toggle('hidden');
    }

    // MCP Apps protocol: send request and wait for response
    function sendRequest(method, params) {
      return new Promise((resolve, reject) => {
        const id = requestId++;
        const handler = (event) => {
          if (event.source !== window.parent) return;
          if (event.data?.id === id) {
            window.removeEventListener('message', handler);
            if (event.data.error) {
              reject(new Error(event.data.error.message || 'Request failed'));
            } else {
              resolve(event.data.result);
            }
          }
        };
        window.addEventListener('message', handler);
        window.parent.postMessage({ jsonrpc: '2.0', id, method, params }, '*');
      });
    }

    // Listen for notifications from MCP host
    window.addEventListener('message', (event) => {
      if (event.source !== window.parent) return;

      const message = event.data;
      if (!message || message.jsonrpc !== '2.0') return;
      // Ignore responses (they have id), only handle notifications
      if (message.id !== undefined) return;

      if (message.method === 'ui/notifications/tool-result') {
        const toolResult = message.params;
        if (toolResult?.structuredContent) {
          data = toolResult.structuredContent;
          render();
        }
      }

      // Handle host context changes (theme, locale, etc.)
      if (message.method === 'ui/notifications/host-context-changed') {
        Object.assign(hostContext, message.params);
        if (message.params.theme) applyTheme(message.params.theme);
      }
    });

    // Apply theme from hostContext
    function applyTheme(theme) {
      document.body.classList.toggle('dark-theme', theme === 'dark');
    }

    // Send size notification to host (debounced)
    let sizeTimeout;
    function notifySize() {
      clearTimeout(sizeTimeout);
      sizeTimeout = setTimeout(() => {
        window.parent.postMessage({
          jsonrpc: '2.0',
          method: 'ui/notifications/size-changed',
          params: {
            width: document.body.scrollWidth,
            height: document.body.scrollHeight
          }
        }, '*');
      }, 100);
    }

    // MCP Apps handshake: initialize → notifications/initialized
    async function initializeMcpApp() {
      const result = await sendRequest('initialize', {
        protocolVersion: '2026-01-26',
        capabilities: {},
        clientInfo: { name: 'Lovdata Law UI', version: '1.0.0' }
      });
      hostContext = result?.hostContext || {};

      // Apply initial theme
      if (hostContext.theme) applyTheme(hostContext.theme);

      window.parent.postMessage({
        jsonrpc: '2.0',
        method: 'notifications/initialized'
      }, '*');

      // Start observing size changes
      new ResizeObserver(notifySize).observe(document.body);
    }

    // Start initialization and render
    initializeMcpApp();
    render();
  </script>
</body>
</html>
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
                "name": "søk",
                "title": "Søk i Lovdata",
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
                "title": "Liste over lover",
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
                "name": "sjekk_størrelse",
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
            elif tool_name == "søk":
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
            elif tool_name == "sjekk_størrelse":
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

    def _parse_search_results(self, markdown_content: str) -> list[dict[str, Any]]:
        """
        Parse search results markdown into structured format for MCP Apps UI.

        Expected markdown format from lovdata.search():
        ### Lov/Forskrift navn
        **§ X-Y** - Paragraftittel
        > Relevant snippet med søkeord...

        Returns list of dicts with: lawId, lawName, section, snippet, type
        """
        results = []
        current_law = None
        current_type = "lov"

        lines = markdown_content.split("\n")
        i = 0

        while i < len(lines):
            line = lines[i].strip()

            # Match law/regulation header: ### Avhendingslova (avhl) or ### Forskrift om...
            if line.startswith("### "):
                law_name = line[4:].strip()
                current_law = law_name

                # Determine type
                if "forskrift" in law_name.lower():
                    current_type = "forskrift"
                else:
                    current_type = "lov"

                # Extract short ID if present in parentheses
                match = re.search(r"\(([^)]+)\)$", law_name)
                law_id = match.group(1) if match else law_name.lower().replace(" ", "-")

            # Match section: **§ 3-9** - Mangel
            elif line.startswith("**§") and current_law:
                section_match = re.match(r"\*\*§\s*([^*]+)\*\*\s*[-–]?\s*(.*)", line)
                if section_match:
                    section = section_match.group(1).strip()
                    title = section_match.group(2).strip()

                    # Look for snippet in next lines (blockquote)
                    snippet = ""
                    j = i + 1
                    while j < len(lines) and lines[j].strip().startswith(">"):
                        snippet += lines[j].strip()[1:].strip() + " "
                        j += 1

                    # Also check for non-blockquote snippet
                    if not snippet and j < len(lines) and lines[j].strip():
                        snippet = lines[j].strip()

                    results.append({
                        "lawId": law_id if 'law_id' in dir() else current_law.lower().replace(" ", "-"),
                        "lawName": current_law,
                        "section": section,
                        "title": title,
                        "snippet": snippet.strip()[:200] + "..." if len(snippet) > 200 else snippet.strip(),
                        "type": current_type
                    })

            i += 1

        return results

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
        """Return list of available resources including MCP Apps UI."""
        return {
            "resources": [
                {
                    "uri": "ui://lovdata/search",
                    "name": "Søkeresultater UI",
                    "mimeType": "text/html",
                    "description": "Interaktiv visning av søkeresultater med filtrering"
                },
                {
                    "uri": "ui://lovdata/law",
                    "name": "Lovtekst UI",
                    "mimeType": "text/html",
                    "description": "Interaktiv visning av lovtekst med innholdsfortegnelse"
                }
            ]
        }

    def handle_resources_read(self, params: dict[str, Any]) -> dict[str, Any]:
        """
        Read a resource by URI.

        Supports MCP Apps UI resources (ui:// scheme).
        """
        uri = params.get("uri", "")
        logger.debug(f"Reading resource: {uri}")

        if uri == "ui://lovdata/search":
            return {
                "contents": [{
                    "uri": uri,
                    "mimeType": "text/html",
                    "text": self._get_search_ui_template()
                }]
            }
        elif uri == "ui://lovdata/law":
            return {
                "contents": [{
                    "uri": uri,
                    "mimeType": "text/html",
                    "text": self._get_law_ui_template()
                }]
            }

        logger.warning(f"Unknown resource URI: {uri}")
        return {"contents": []}

    def _get_search_ui_template(self) -> str:
        """Return HTML template for search results UI."""
        return SEARCH_UI_TEMPLATE

    def _get_law_ui_template(self) -> str:
        """Return HTML template for law view UI."""
        return LAW_UI_TEMPLATE

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
