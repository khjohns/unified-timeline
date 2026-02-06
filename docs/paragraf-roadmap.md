# Paragraf - Veien videre

> **Dato:** 2026-02-06
> **Status:** Plan
> **Kontekst:** Paragraf lever i dag som del av unified-timeline. Denne planen beskriver utskilling til eget repo og distribusjon.

## Nåsituasjon

Paragraf er fullt fungerende som Flask blueprint (`/mcp/`) i unified-timeline backend. Alt kjører på eksisterende Render Starter ($7/mnd) og Supabase Pro ($25/mnd).

### Filer som utgjør Paragraf i dag

| Fil | Innhold |
|-----|---------|
| `backend/mcp/server.py` | MCP JSON-RPC server (9 verktøy, ~800 linjer) |
| `backend/mcp/__init__.py` | Modul-eksport |
| `backend/routes/mcp_routes.py` | Flask blueprint, HTTP transport, OAuth |
| `backend/services/lovdata_service.py` | Forretningslogikk, aliaser, validering |
| `backend/services/lovdata_supabase.py` | Supabase PostgreSQL backend |
| `backend/services/lovdata_sync.py` | SQLite fallback + sync fra API |
| `backend/services/lovdata_structure_parser.py` | XML → hierarkisk struktur |
| `backend/services/lovdata_vector_search.py` | Hybrid vektor+FTS søk |
| `backend/scripts/embed_lovdata.py` | Generer embeddings |
| `src/pages/lovdata-mcp/LandingPage.tsx` | Landing page (React) |
| `src/pages/lovdata-mcp/index.ts` | Page eksport |
| `supabase/migrations/20260203_*.sql` | 10 migreringsfiler |

---

## 1. Eget repo

### Repostruktur

```
paragraf/
├── README.md                  ← docs/paragraf-README.md
├── LICENSE                    MIT
├── pyproject.toml             pip install paragraf
│
├── src/paragraf/              Python-pakken
│   ├── __init__.py
│   ├── server.py              ← backend/mcp/server.py
│   ├── service.py             ← backend/services/lovdata_service.py
│   ├── supabase_backend.py    ← backend/services/lovdata_supabase.py
│   ├── sqlite_backend.py      ← backend/services/lovdata_sync.py
│   ├── vector_search.py       ← backend/services/lovdata_vector_search.py
│   ├── structure_parser.py    ← backend/services/lovdata_structure_parser.py
│   └── cli.py                 Entrypoint
│
├── web/                       Flask HTTP-wrapper (for hosted/self-host)
│   ├── app.py                 ← backend/routes/mcp_routes.py (standalone)
│   └── Dockerfile
│
├── migrations/                ← supabase/migrations/lovdata_*
│
├── scripts/
│   └── embed.py               ← backend/scripts/embed_lovdata.py
│
├── docs/
│   ├── ADR-003.md
│   ├── budget.md
│   └── dataflyt.md
│
└── site/                      Landing page (Vite)
    ├── package.json
    ├── src/LandingPage.tsx     ← src/pages/lovdata-mcp/LandingPage.tsx
    └── vite.config.ts
```

### Arbeidsrekkefølge

1. Opprett `paragraf`-repo på GitHub
2. Kopier filer (ren historikk, ikke git filter-branch)
3. Oppdater imports (`from services.lovdata_service` → `from paragraf.service`)
4. Lag `pyproject.toml` med dependencies og entrypoints
5. Verifiser at `pip install -e .` fungerer
6. Verifiser at `paragraf serve` starter MCP-server (stdio)
7. Verifiser at `paragraf serve --http` starter Flask-server

---

## 2. Python-pakke (PyPI)

### pyproject.toml (skisse)

```toml
[project]
name = "paragraf"
version = "0.1.0"
description = "MCP server for Norwegian law lookup"
requires-python = ">=3.11"
license = "MIT"
dependencies = [
    "httpx>=0.27.0",
    "beautifulsoup4>=4.12.0",
    "lxml>=5.0.0",
]

[project.optional-dependencies]
supabase = ["supabase>=2.0.0"]
vector = ["google-genai>=1.0.0"]
http = ["flask>=3.0.0", "gunicorn>=21.0.0"]
all = ["paragraf[supabase,vector,http]"]

[project.scripts]
paragraf = "paragraf.cli:main"
```

### CLI-kommandoer

```bash
paragraf serve              # stdio MCP-server (for Claude Desktop, Cursor)
paragraf serve --http       # HTTP MCP-server (for claude.ai connector)
paragraf sync               # Synkroniser fra Lovdata API
paragraf status             # Vis sync-status og statistikk
```

### Distribusjon

| Kanal | Kommando | Brukscase |
|-------|----------|-----------|
| PyPI | `pip install paragraf` | Self-host, bibliotek |
| uvx | `uvx paragraf` | Lokal MCP uten installasjon |
| Docker | `docker run ghcr.io/user/paragraf` | Produksjon self-host |
| Hosted | `https://your-domain.com/mcp/` | Null installasjon |

### Claude Desktop config

```json
{
  "mcpServers": {
    "paragraf": {
      "command": "uvx",
      "args": ["paragraf"]
    }
  }
}
```

### Cursor / VS Code config

```json
{
  "mcpServers": {
    "paragraf": {
      "command": "uvx",
      "args": ["paragraf"]
    }
  }
}
```

---

## 3. Deploy-modell

### Hosted (primær)

Paragraf fortsetter som Flask blueprint i unified-timeline backend. Ingen ekstra Render-kostnad.

```
unified-timeline backend (Render Starter $7/mnd)
├── /api/           ← unified-timeline API
└── /mcp/           ← Paragraf MCP endpoint
```

Brukere kobler til via `https://your-domain.com/mcp/` i claude.ai.

### Self-host (alternativ)

For brukere som vil kjøre egen instans:

```bash
pip install paragraf[all]
paragraf sync                          # Last ned lovdata
paragraf serve --http --port 8000      # Start HTTP-server
```

Eller med Docker:

```bash
docker run -e SUPABASE_URL=... -p 8000:8000 ghcr.io/user/paragraf
```

### Lokal MCP (for utviklere)

For bruk med Claude Desktop / Cursor uten nettverkstilgang:

```bash
pip install paragraf
paragraf sync              # Første gang: last ned til lokal SQLite
# Deretter: konfigurer i Claude Desktop (se over)
```

SQLite-backend brukes automatisk når `SUPABASE_URL` ikke er satt.

---

## 4. Landing page

Landing-pagen (`site/`) bygges som statisk Vite-app og kan:

- **A: Deployes på GitHub Pages** — gratis, paragraf.app peker dit
- **B: Serves fra Flask** — bygget output i `web/static/`
- **C: Eget Vercel/Netlify** — gratis tier

Anbefaling: **A (GitHub Pages)** — enklest, gratis, CDN inkludert.

Merk: Landing-pagen bruker Punkt-designsystemet (Oslo kommune) med Tailwind. Ved utskilling må `@/components/primitives/Button` og `Input` enten:
- Kopieres inn i `site/`
- Erstattes med vanlig HTML/Tailwind
- Importeres som npm-pakke (hvis Punkt publiseres)

---

## 5. Forholdet til unified-timeline

Etter utskilling:

| Aspekt | unified-timeline | paragraf repo |
|--------|-----------------|---------------|
| Kildekode | Importerer `paragraf` som dependency | Selvstendig pakke |
| Deploy | Samme Render service | Ingen egen deploy (delt) |
| Database | Delt Supabase | Samme tabeller |
| Landing page | Route `/paragraf` → statisk build | Egen build |

unified-timeline sin `requirements.txt` legger til:
```
paragraf[supabase,vector]
```

Og `backend/app.py` endres fra direkte import til:
```python
from paragraf.web import create_mcp_blueprint
app.register_blueprint(create_mcp_blueprint(), url_prefix="/mcp")
```

---

## 6. Sjekkliste for utskilling

- [ ] Opprett GitHub repo `paragraf`
- [ ] Kopier Python-filer, oppdater imports
- [ ] Lag `pyproject.toml` med entrypoints
- [ ] Lag `cli.py` (serve, sync, status)
- [ ] Verifiser lokal stdio MCP (`paragraf serve`)
- [ ] Verifiser HTTP MCP (`paragraf serve --http`)
- [ ] Kopier migreringer
- [ ] Kopier landing page, erstatt Punkt-imports
- [ ] Kopier docs (README, ADR, budget)
- [ ] Publiser på PyPI (`pip install paragraf`)
- [ ] Publiser Docker image
- [ ] Oppdater unified-timeline til å importere fra pakken
- [ ] Registrer domene (paragraf.app)
- [ ] Sett opp GitHub Pages for landing page
- [ ] Legg til i MCP-kataloger (mcp.so, Smithery, etc.)
