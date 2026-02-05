# Lovdata MCP - Remote Server og MCP Apps Plan

> Dato: Februar 2026
> Status: Planlegging

## Sammendrag

Denne planen beskriver oppgradering av Lovdata MCP fra lokal stdio-server til remote HTTP-server med interaktiv UI via MCP Apps.

## Nåværende Status

| Aspekt | Status |
|--------|--------|
| Server | Lokal, stdio-basert |
| Hosting | Kun Claude Desktop |
| UI | Kun tekst (markdown) |
| Backend | Render (eksisterende) |

## Mål

1. **Tilgjengelighet**: Fungere på claude.ai web, mobil og desktop
2. **Synlighet**: Vise brukeren hva som skjer under verktøykjøring
3. **Interaktivitet**: Rik UI for søkeresultater og lovtekst
4. **Åpen tilgang**: Ingen registrering eller autentisering

---

## Del 1: Remote MCP Server (Fase 1-2)

### 1.1 Migrere til FastMCP + Streamable HTTP

**Nåværende arkitektur** (`backend/mcp/server.py`):
```python
# Raw JSON-RPC over stdio
class MCPServer:
    def handle_request(self, body: dict) -> dict:
        # Manuell routing
```

**Ny arkitektur** (`backend/mcp/server_v2.py`):
```python
from mcp.server.fastmcp import FastMCP, Context
from mcp.types import CallToolResult

mcp = FastMCP(
    name="lovdata-mcp",
    version="0.2.0",
    instructions=SERVER_INSTRUCTIONS
)

@mcp.tool()
async def sok(query: str, limit: int = 10) -> str:
    """Fulltekstsøk i norske lover og forskrifter."""
    return lovdata_service.search(query, limit)

@mcp.tool()
async def lov(lov_id: str, paragraf: str | None = None) -> str:
    """Slå opp norsk lov eller spesifikk paragraf."""
    return lovdata_service.lookup_law(lov_id, paragraf)

# ... flere tools ...

if __name__ == "__main__":
    mcp.run(
        transport="streamable-http",
        host="0.0.0.0",
        port=8000
    )
```

### 1.2 Avhengigheter

```txt
# requirements.txt (tillegg)
mcp>=1.8.0
fastmcp>=2.14.0
```

### 1.3 Deploy på Render

Render støtter allerede Python. Legg til:

**render.yaml** (oppdater):
```yaml
services:
  - type: web
    name: lovdata-mcp
    runtime: python
    buildCommand: pip install -r requirements.txt
    startCommand: python -m backend.mcp.server_v2
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
4. Bekreft tilkobling

---

## Del 2: MCP Apps - Interaktiv UI (Fase 3-4)

### 2.1 Installer MCP-UI

```bash
pip install mcp-ui
```

### 2.2 Søkeresultater med UI

```python
from mcp.server.fastmcp import FastMCP, Context
from mcp.types import CallToolResult
from mcp_ui_server import create_ui_resource

@mcp.tool()
async def sok(query: str, limit: int = 10, ctx: Context) -> CallToolResult:
    """Fulltekstsøk i norske lover med interaktiv UI."""

    results = lovdata_service.search(query, limit)

    # Generer HTML for resultater
    html = generate_search_ui(results, query)

    return CallToolResult(
        # Tekst for modellen (kontekst)
        content=[{
            "type": "text",
            "text": format_as_markdown(results)
        }],
        # Data for UI (ikke synlig for modell)
        structuredContent={
            "results": results,
            "query": query,
            "count": len(results)
        },
        # UI-metadata
        meta={
            "ui": {
                "resourceUri": f"ui://lovdata/search"
            }
        }
    )

@mcp.resource("ui://lovdata/search")
async def search_ui_resource() -> str:
    """Serve søkeresultat-UI."""
    return create_ui_resource({
        "uri": "ui://lovdata/search",
        "content": {
            "type": "rawHtml",
            "htmlString": SEARCH_UI_TEMPLATE
        },
        "encoding": "text"
    })
```

### 2.3 UI-komponenter

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

```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@mcp.tool()
@limiter.limit("30/minute")
async def sok(query: str, limit: int = 10) -> str:
    ...
```

### 4.2 Caching

```python
from functools import lru_cache
from datetime import timedelta

@lru_cache(maxsize=1000)
def cached_search(query: str, limit: int) -> list:
    return lovdata_service.search(query, limit)
```

### 4.3 Health Check

```python
@mcp.resource("/health")
async def health_check():
    return {"status": "ok", "version": "0.2.0"}
```

---

## Implementeringsplan

| Fase | Oppgave | Estimat | Avhengigheter |
|------|---------|---------|---------------|
| **1** | Migrere til FastMCP | 2-3 timer | - |
| **2** | Deploy med Streamable HTTP på Render | 1 time | Fase 1 |
| **3** | Teste fra claude.ai web | 30 min | Fase 2 |
| **4a** | MCP Apps: Søkeresultat-UI | 3-4 timer | Fase 3 |
| **4b** | MCP Apps: Lovtekst-UI | 3-4 timer | Fase 3 |
| **4c** | MCP Apps: Sync Progress-UI | 2-3 timer | Fase 3 |
| **5** | Pakke som .mcpb | 1 time | Fase 4 |
| **6** | Rate limiting + caching | 1-2 timer | Fase 2 |

### Prioritert rekkefølge

1. **Fase 1-3**: Remote server (høyest prioritet - muliggjør claude.ai web)
2. **Fase 4a**: Søkeresultat-UI (mest synlig forbedring)
3. **Fase 6**: Sikkerhet (viktig for produksjon)
4. **Fase 4b-c**: Flere UI-komponenter
5. **Fase 5**: Desktop Extension (nice-to-have)

---

## Alternativer: Cloudflare vs Render

| Aspekt | Render (nåværende) | Cloudflare Workers |
|--------|-------------------|-------------------|
| Språk | Python (native) | JavaScript/TypeScript |
| Pris | $7/mnd (starter) | Gratis tier |
| Latency | Variabel | Edge (lav) |
| Kompleksitet | Lav | Medium |
| MCP-støtte | Via FastMCP | Native template |

**Anbefaling**: Fortsett med Render for Python-native støtte. Vurder Cloudflare senere for edge-ytelse.

---

## Referanser

- [MCP Apps Blog Post](http://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/)
- [FastMCP Documentation](https://gofastmcp.com/)
- [mcp-ui-server](https://mcpui.dev/guide/server/python/overview)
- [Building Custom Connectors - Claude Help](https://support.claude.com/en/articles/11503834-building-custom-connectors-via-remote-mcp-servers)
- [Cloudflare MCP Authless Template](https://glama.ai/mcp/servers/@lgrassin/remote-mcp-server-authless)
- [MCPB Specification](https://github.com/modelcontextprotocol/mcpb)
