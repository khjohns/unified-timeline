# Lovdata MCP - Remote Server og MCP Apps Plan

> Dato: Februar 2026
> Status: Planlegging
> Oppdatert: Endret fra FastMCP-migrering til minimal HTTP-wrapper

## Sammendrag

Denne planen beskriver oppgradering av Lovdata MCP fra lokal stdio-server til remote HTTP-server med interaktiv UI via MCP Apps.

**Viktig beslutning**: Vi beholder eksisterende `MCPServer`-klasse og legger kun til en minimal HTTP-wrapper (~50 linjer). Dette er mer effektivt enn full FastMCP-migrering.

## Nåværende Status

| Aspekt | Status |
|--------|--------|
| Server | Lokal, stdio-basert (`MCPServer` klasse) |
| Kodebase | ~570 linjer, fullstendig JSON-RPC |
| Hosting | Kun Claude Desktop |
| UI | Kun tekst (markdown) |
| Backend | Render (eksisterende) |

## Mål

1. **Tilgjengelighet**: Fungere på claude.ai web, mobil og desktop
2. **Synlighet**: Vise brukeren hva som skjer under verktøykjøring
3. **Interaktivitet**: Rik UI for søkeresultater og lovtekst
4. **Åpen tilgang**: Ingen registrering eller autentisering

---

## Arkitekturbeslutning: Minimal Wrapper vs FastMCP

### Vurdering

| Aspekt | Minimal HTTP-wrapper | FastMCP-migrering |
|--------|---------------------|-------------------|
| **Ny kode** | ~50 linjer | ~200+ linjer (omskriving) |
| **Eksisterende kode** | Beholdes uendret | Må omskrives |
| **Avhengigheter** | Flask (har allerede) | fastmcp, mcp SDK |
| **MCP Apps støtte** | Legges til manuelt | Innebygd |
| **Vedlikehold** | Full kontroll | Avhengig av FastMCP |
| **Risiko** | Lav | Medium (omskriving) |

### Beslutning

**Bruk minimal HTTP-wrapper** fordi:
1. Eksisterende `MCPServer` har allerede 95% av funksjonaliteten
2. Ingen omskriving av fungerende kode
3. Full kontroll over implementasjonen
4. MCP Apps kan legges til like enkelt

---

## Del 1: Remote MCP Server (Fase 1-2)

### 1.1 Legg til HTTP-wrapper (Streamable HTTP)

**Eksisterende arkitektur** (`backend/mcp/server.py`) - BEHOLDES:
```python
class MCPServer:
    def handle_request(self, body: dict) -> dict:
        # Komplett JSON-RPC håndtering (allerede implementert)
```

**Ny fil** (`backend/mcp/http_transport.py`) - ~50 linjer:
```python
"""
HTTP transport layer for MCP Server.
Implements Streamable HTTP per MCP spec 2025-06-18.
"""
from flask import Flask, request, jsonify, Response
import json
import os

from .server import MCPServer

app = Flask(__name__)
mcp = MCPServer()

@app.route("/mcp", methods=["POST"])
def mcp_endpoint():
    """
    Streamable HTTP endpoint for MCP.

    Supports both JSON and SSE responses based on Accept header.
    """
    # Valider protocol version
    protocol_version = request.headers.get("MCP-Protocol-Version", "2025-03-26")
    session_id = request.headers.get("Mcp-Session-Id")

    body = request.get_json()
    result = mcp.handle_request(body)

    # SSE eller vanlig JSON basert på Accept header
    accept = request.headers.get("Accept", "application/json")

    if accept == "text/event-stream":
        def generate():
            yield f"data: {json.dumps(result)}\n\n"
        response = Response(generate(), mimetype="text/event-stream")
    else:
        response = jsonify(result)

    # Legg til session ID hvis satt
    if session_id:
        response.headers["Mcp-Session-Id"] = session_id

    return response

@app.route("/mcp", methods=["GET"])
def mcp_sse_stream():
    """
    SSE endpoint for server-initiated messages.
    Used for notifications and progress updates.
    """
    def stream():
        # Placeholder for fremtidige server-push meldinger
        yield ": keepalive\n\n"
    return Response(stream(), mimetype="text/event-stream")

@app.route("/health")
def health():
    """Health check endpoint for Render."""
    return {"status": "ok", "version": "0.1.0"}

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    app.run(host="0.0.0.0", port=port)
```

### 1.2 Avhengigheter

```txt
# requirements.txt (minimale tillegg)
flask>=3.0.0
gunicorn>=21.0.0  # For produksjon
```

**Merk**: Ingen nye MCP-relaterte avhengigheter trengs - vi bruker eksisterende kode.

### 1.3 Deploy på Render

**render.yaml** (oppdater):
```yaml
services:
  - type: web
    name: lovdata-mcp
    runtime: python
    buildCommand: pip install -r requirements.txt
    startCommand: gunicorn backend.mcp.http_transport:app --bind 0.0.0.0:$PORT
    envVars:
      - key: PORT
        value: 8000
    healthCheckPath: /health
```

**Endpoint**: `https://lovdata-mcp.onrender.com/mcp`

### 1.4 Koble til claude.ai

1. Gå til **claude.ai > Settings > Connectors**
2. Klikk **Add custom connector**
3. Skriv inn URL: `https://lovdata-mcp.onrender.com/mcp`
4. Bekreft tilkobling (ingen OAuth - authless)

---

## Del 2: MCP Apps - Interaktiv UI (Fase 3-4)

### 2.1 Installer MCP-UI (valgfritt)

```bash
pip install mcp-ui  # Kun hvis du vil bruke helper-funksjoner
```

**Merk**: MCP Apps krever kun spesifikke felter i JSON-responsen. Du kan bygge dette manuelt uten ekstra biblioteker.

### 2.2 Utvide MCPServer med MCP Apps-støtte

Oppdater `handle_tools_call()` i eksisterende `server.py`:

```python
def handle_tools_call(self, params: dict[str, Any]) -> dict[str, Any]:
    """Execute a tool call with optional MCP Apps UI."""
    tool_name = params.get("name", "")
    arguments = params.get("arguments", {})

    try:
        if tool_name == "sok":
            # Hent resultater
            query = arguments.get("query", "")
            limit = arguments.get("limit", 10)
            results = self.lovdata.search(query, limit)

            # Parse resultater til strukturert format
            structured_results = self._parse_search_results(results)

            return {
                # Tekst for modellen (kontekst)
                "content": [{
                    "type": "text",
                    "text": results  # Markdown-formatert
                }],
                # Data for UI (ikke synlig for modell)
                "structuredContent": {
                    "results": structured_results,
                    "query": query,
                    "count": len(structured_results)
                },
                # UI-metadata
                "_meta": {
                    "ui": {
                        "resourceUri": "ui://lovdata/search"
                    }
                }
            }

        # ... andre tools (uten UI foreløpig) ...

    except Exception as e:
        # ... error handling ...
```

### 2.3 Legge til UI Resources

Utvid `handle_resources_list()` og legg til ny metode:

```python
def handle_resources_list(self) -> dict[str, Any]:
    """Return list of available resources including UI."""
    return {
        "resources": [
            {
                "uri": "ui://lovdata/search",
                "name": "Søkeresultater UI",
                "mimeType": "text/html",
                "description": "Interaktiv visning av søkeresultater"
            },
            {
                "uri": "ui://lovdata/law",
                "name": "Lovtekst UI",
                "mimeType": "text/html",
                "description": "Interaktiv visning av lovtekst"
            }
        ]
    }

def handle_resources_read(self, params: dict[str, Any]) -> dict[str, Any]:
    """Read a resource by URI."""
    uri = params.get("uri", "")

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

    return {"contents": []}

def _get_search_ui_template(self) -> str:
    """Return HTML template for search results."""
    return SEARCH_UI_TEMPLATE  # Se seksjon 2.4
```

Og oppdater `handle_request()` for å route resources/read:

```python
elif method == "resources/read":
    result = self.handle_resources_read(params)
```

### 2.4 UI-komponenter (HTML Templates)

#### Søkeresultater

```html
<!-- templates/search_results.html -->
<div class="lovdata-search" style="font-family: system-ui; padding: 16px;">
  <style>
    .result-card {
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 8px;
      cursor: pointer;
    }
    .result-card:hover { background: #f5f5f5; }
    .law-name { font-weight: 600; color: #1a73e8; }
    .section { color: #5f6368; font-size: 14px; }
    .snippet { color: #3c4043; margin-top: 8px; }
    .snippet mark { background: #fff3cd; }
    .filters { margin-bottom: 16px; }
    .filter-btn {
      padding: 6px 12px;
      border: 1px solid #dadce0;
      border-radius: 16px;
      background: white;
      margin-right: 8px;
      cursor: pointer;
    }
    .filter-btn.active { background: #e8f0fe; border-color: #1a73e8; }
  </style>

  <h3>Søkeresultater for "{{query}}"</h3>
  <p class="count">{{count}} treff</p>

  <div class="filters">
    <button class="filter-btn active" data-type="all">Alle</button>
    <button class="filter-btn" data-type="lov">Lover</button>
    <button class="filter-btn" data-type="forskrift">Forskrifter</button>
  </div>

  <div class="results">
    {{#each results}}
    <div class="result-card" data-type="{{type}}">
      <div class="law-name">{{lawName}}</div>
      <div class="section">§ {{section}}</div>
      <div class="snippet">{{{snippet}}}</div>
    </div>
    {{/each}}
  </div>

  <script>
    // Filtrering
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const type = btn.dataset.type;
        document.querySelectorAll('.result-card').forEach(card => {
          card.style.display = (type === 'all' || card.dataset.type === type) ? 'block' : 'none';
        });
      };
    });

    // Klikk for å ekspandere (kaller MCP tool)
    document.querySelectorAll('.result-card').forEach(card => {
      card.onclick = () => {
        window.mcpBridge?.callTool('lov', {
          lov_id: card.dataset.lawId,
          paragraf: card.dataset.section
        });
      };
    });
  </script>
</div>
```

#### Lovtekst-visning

```html
<!-- templates/law_view.html -->
<div class="lovdata-law" style="font-family: Georgia, serif; padding: 16px; max-width: 800px;">
  <style>
    .law-header { border-bottom: 2px solid #1a73e8; padding-bottom: 12px; margin-bottom: 24px; }
    .law-title { font-size: 24px; font-weight: bold; }
    .law-meta { color: #5f6368; font-size: 14px; margin-top: 4px; }
    .toc { background: #f8f9fa; padding: 16px; border-radius: 8px; margin-bottom: 24px; }
    .toc-item { padding: 4px 0; cursor: pointer; color: #1a73e8; }
    .chapter { margin-bottom: 32px; }
    .chapter-title { font-size: 18px; font-weight: 600; margin-bottom: 16px; }
    .paragraph { margin-bottom: 16px; line-height: 1.6; }
    .paragraph-num { font-weight: bold; color: #1a73e8; }
    .collapsible { cursor: pointer; }
    .collapsible::before { content: '▶ '; font-size: 12px; }
    .collapsible.open::before { content: '▼ '; }
    .collapsed { display: none; }
  </style>

  <div class="law-header">
    <div class="law-title">{{lawName}}</div>
    <div class="law-meta">{{shortName}} • Sist endret: {{lastModified}}</div>
  </div>

  <div class="toc">
    <strong>Innhold</strong>
    {{#each chapters}}
    <div class="toc-item" onclick="scrollToChapter('{{id}}')">{{title}}</div>
    {{/each}}
  </div>

  <div class="content">
    {{#each chapters}}
    <div class="chapter" id="chapter-{{id}}">
      <div class="chapter-title collapsible" onclick="toggleChapter(this)">{{title}}</div>
      <div class="chapter-content">
        {{#each paragraphs}}
        <div class="paragraph">
          <span class="paragraph-num">§ {{number}}</span>
          {{text}}
        </div>
        {{/each}}
      </div>
    </div>
    {{/each}}
  </div>

  <script>
    function toggleChapter(el) {
      el.classList.toggle('open');
      el.nextElementSibling.classList.toggle('collapsed');
    }
    function scrollToChapter(id) {
      document.getElementById('chapter-' + id).scrollIntoView({ behavior: 'smooth' });
    }
  </script>
</div>
```

#### Sync Progress

```html
<!-- templates/sync_progress.html -->
<div class="sync-progress" style="font-family: system-ui; padding: 16px;">
  <style>
    .progress-container { margin-bottom: 16px; }
    .progress-label { display: flex; justify-content: space-between; margin-bottom: 4px; }
    .progress-bar { height: 8px; background: #e0e0e0; border-radius: 4px; overflow: hidden; }
    .progress-fill { height: 100%; background: #1a73e8; transition: width 0.3s; }
    .status-item { padding: 8px 0; border-bottom: 1px solid #e0e0e0; }
    .status-icon { margin-right: 8px; }
    .done { color: #34a853; }
    .running { color: #1a73e8; }
    .pending { color: #9aa0a6; }
  </style>

  <h3>Synkroniserer Lovdata</h3>

  <div class="progress-container">
    <div class="progress-label">
      <span>Total fremdrift</span>
      <span id="progress-pct">0%</span>
    </div>
    <div class="progress-bar">
      <div class="progress-fill" id="progress-fill" style="width: 0%"></div>
    </div>
  </div>

  <div class="status-list">
    <div class="status-item" data-step="lover">
      <span class="status-icon pending">○</span>
      Henter lover...
    </div>
    <div class="status-item" data-step="forskrifter">
      <span class="status-icon pending">○</span>
      Henter forskrifter...
    </div>
    <div class="status-item" data-step="indeksering">
      <span class="status-icon pending">○</span>
      Indekserer...
    </div>
  </div>

  <script>
    // Motta oppdateringer via structuredContent
    window.addEventListener('mcp-update', (e) => {
      const { progress, currentStep, completedSteps } = e.detail;

      document.getElementById('progress-pct').textContent = Math.round(progress * 100) + '%';
      document.getElementById('progress-fill').style.width = (progress * 100) + '%';

      completedSteps.forEach(step => {
        const el = document.querySelector(`[data-step="${step}"] .status-icon`);
        el.className = 'status-icon done';
        el.textContent = '✓';
      });

      if (currentStep) {
        const el = document.querySelector(`[data-step="${currentStep}"] .status-icon`);
        el.className = 'status-icon running';
        el.textContent = '◉';
      }
    });
  </script>
</div>
```

---

## Del 3: Desktop Extension (.mcpb) (Fase 5)

### 3.1 Pakkestruktur

```
lovdata-mcp.mcpb/
├── manifest.json
├── icon.png
└── server/
    └── (bundlet Python eller referanse til remote)
```

### 3.2 manifest.json

```json
{
  "name": "lovdata-mcp",
  "version": "0.2.0",
  "displayName": "Lovdata - Norske Lover",
  "description": "Søk og slå opp i norske lover og forskrifter fra Lovdata",
  "author": "Unified Timeline",
  "icon": "icon.png",
  "type": "remote",
  "remoteUrl": "https://lovdata-mcp.onrender.com/mcp",
  "capabilities": {
    "tools": true,
    "resources": true,
    "prompts": true
  },
  "categories": ["legal", "reference", "norway"]
}
```

### 3.3 Publisering

1. Bygg .mcpb-fil: `npx @anthropic/mcpb pack`
2. Test lokalt i Claude Desktop
3. (Valgfritt) Submit til Anthropic Extension Directory

---

## Del 4: Sikkerhet og Ytelse

### 4.1 Rate Limiting

Legg til i `http_transport.py`:

```python
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["100 per hour"],
    storage_uri="memory://"
)

@app.route("/mcp", methods=["POST"])
@limiter.limit("30/minute")
def mcp_endpoint():
    # ... eksisterende kode ...
```

### 4.2 Caching

Legg til i `server.py`:

```python
from functools import lru_cache

class MCPServer:
    @lru_cache(maxsize=1000)
    def _cached_search(self, query: str, limit: int) -> str:
        return self.lovdata.search(query, limit)
```

### 4.3 Health Check

Allerede inkludert i `http_transport.py`:

```python
@app.route("/health")
def health():
    return {"status": "ok", "version": "0.1.0"}
```

---

## Implementeringsplan

| Fase | Oppgave | Estimat | Ny kode |
|------|---------|---------|---------|
| **1** | Legg til HTTP-wrapper | 30 min | ~50 linjer |
| **2** | Deploy på Render | 30 min | Config only |
| **3** | Test fra claude.ai web | 15 min | 0 |
| **4a** | MCP Apps: Søkeresultat-UI | 2 timer | ~100 linjer |
| **4b** | MCP Apps: Lovtekst-UI | 2 timer | ~100 linjer |
| **4c** | MCP Apps: Sync Progress-UI | 1 time | ~50 linjer |
| **5** | Pakke som .mcpb | 30 min | Config only |
| **6** | Rate limiting + caching | 30 min | ~20 linjer |

**Total ny kode**: ~320 linjer (vs ~500+ med FastMCP-migrering)

### Prioritert rekkefølge

```
┌─────────────────────────────────────────────────────┐
│ Fase 1-3: HTTP-wrapper + Deploy (høyest prioritet) │
│ → Muliggjør claude.ai web, mobil, desktop          │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│ Fase 6: Rate limiting (viktig for åpen server)     │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│ Fase 4a: Søkeresultat-UI (mest synlig forbedring)  │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│ Fase 4b-c: Flere UI-komponenter (nice-to-have)     │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│ Fase 5: .mcpb Desktop Extension (bonus)            │
└─────────────────────────────────────────────────────┘
```

---

## Alternativer: Cloudflare vs Render

| Aspekt | Render (nåværende) | Cloudflare Workers |
|--------|-------------------|-------------------|
| Språk | Python (native) | JavaScript/TypeScript |
| Pris | $7/mnd (starter) | Gratis tier |
| Latency | Variabel | Edge (lav) |
| Kompleksitet | Lav | Medium |
| MCP-støtte | Minimal wrapper | Native template |

**Anbefaling**: Fortsett med Render - du har allerede backend der og Python-koden fungerer direkte.

---

## Referanser

- [MCP Apps Blog Post](http://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/)
- [MCP Specification 2025-06-18 - Transports](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports)
- [mcp-ui-server](https://mcpui.dev/guide/server/python/overview)
- [Building Custom Connectors - Claude Help](https://support.claude.com/en/articles/11503834-building-custom-connectors-via-remote-mcp-servers)
- [Cloudflare MCP Authless Template](https://glama.ai/mcp/servers/@lgrassin/remote-mcp-server-authless)
- [MCPB Specification](https://github.com/modelcontextprotocol/mcpb)
- [Invariant Labs - MCP Streamable HTTP Example](https://github.com/invariantlabs-ai/mcp-streamable-http)
