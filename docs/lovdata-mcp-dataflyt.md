# Lovdata MCP - Dataflytdiagram

## Oversikt

Denne dokumentasjonen beskriver dataflyt for Lovdata MCP-tjenesten som gir AI-assistenter tilgang til norske lover og forskrifter.

## Arkitekturdiagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BRUKERE                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                 │
│   │   Copilot    │    │   Claude.ai  │    │  Gemini AI   │                 │
│   │    Studio    │    │  Connector   │    │   Studio     │                 │
│   └──────┬───────┘    └──────┬───────┘    └──────┬───────┘                 │
│          │                   │                   │                          │
│          └───────────────────┼───────────────────┘                          │
│                              │                                              │
│                              ▼                                              │
│                    ┌─────────────────┐                                      │
│                    │  HTTPS/JSON-RPC │                                      │
│                    │   (MCP 2025)    │                                      │
│                    └────────┬────────┘                                      │
│                              │                                              │
└──────────────────────────────┼──────────────────────────────────────────────┘
                               │
┌──────────────────────────────┼──────────────────────────────────────────────┐
│                              ▼                           AZURE/RENDER       │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                      UNIFIED TIMELINE BACKEND                         │  │
│  │                         (Flask/Python)                                │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │  │
│  │  │                      MCP Server Module                          │  │  │
│  │  │                    /mcp/ endpoints                              │  │  │
│  │  │                                                                 │  │  │
│  │  │   Verktøy:                                                      │  │  │
│  │  │   • lov(lov_id, paragraf)     - Slå opp lov                    │  │  │
│  │  │   • forskrift(id, paragraf)   - Slå opp forskrift              │  │  │
│  │  │   • sok(query, limit)         - Fulltekstsøk                   │  │  │
│  │  │   • liste()                   - Vis tilgjengelige lover        │  │  │
│  │  │   • sjekk_storrelse()         - Estimer tokens                 │  │  │
│  │  │   • sync()                    - Synkroniser fra Lovdata        │  │  │
│  │  └─────────────────────────────────────────────────────────────────┘  │  │
│  │                              │                                        │  │
│  │                              ▼                                        │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │  │
│  │  │                    LovdataService                               │  │  │
│  │  │              (Forretningslogikk + aliaser)                      │  │  │
│  │  └─────────────────────────────────────────────────────────────────┘  │  │
│  │                              │                                        │  │
│  └──────────────────────────────┼────────────────────────────────────────┘  │
│                                 │                                           │
└─────────────────────────────────┼───────────────────────────────────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │                           │
                    ▼                           ▼
┌───────────────────────────────┐   ┌───────────────────────────────┐
│         SUPABASE              │   │        LOVDATA API            │
│     (AWS eu-central-1)        │   │    (api.lovdata.no)           │
│                               │   │                               │
│  ┌─────────────────────────┐  │   │  Kun ved SYNC (sjelden):      │
│  │  PostgreSQL Database    │  │   │                               │
│  │                         │  │   │  • gjeldende-lover.tar.bz2    │
│  │  • lovdata_documents    │  │   │  • gjeldende-sentrale-        │
│  │    (770 lover,          │  │   │    forskrifter.tar.bz2        │
│  │     3666 forskrifter)   │  │   │                               │
│  │                         │  │   │  Lisens: NLOD 2.0             │
│  │  • lovdata_sections     │  │   │  (Norsk lisens for            │
│  │    (92.000+ paragrafer) │  │   │   offentlige data)            │
│  │                         │  │   │                               │
│  │  • lovdata_sync_meta    │  │   └───────────────────────────────┘
│  │    (sync-status)        │  │
│  │                         │  │
│  │  Full-text search med   │  │
│  │  PostgreSQL GIN-indeks  │  │
│  └─────────────────────────┘  │
│                               │
└───────────────────────────────┘
```

## Dataflyt - Oppslag

```
Bruker spør AI          AI kaller MCP           Backend behandler
─────────────────────────────────────────────────────────────────────────────

"Hva sier aml        ──►  POST /mcp/           ──►  1. Parse JSON-RPC
 § 14-9?"                 tools/call                2. Resolve alias
                          name: "lov"                  aml → LOV-2005-06-17-62
                          lov_id: "aml"            3. Query Supabase
                          paragraf: "14-9"         4. Format respons

                     ◄──  JSON response        ◄──  Returnerer lovtekst
                          med lovtekst              med metadata og lenke
```

## Dataflyt - Synkronisering

```
Scheduled job / Manuell          Backend                    Eksterne tjenester
─────────────────────────────────────────────────────────────────────────────

Trigger sync              ──►  1. Sjekk Last-Modified  ──►  HEAD api.lovdata.no
(cron / admin)                    mot cached dato

                               2. Hvis endret:
                                  Download tar.bz2     ──►  GET api.lovdata.no
                                  (streaming, ~50MB)

                               3. Parse XML-filer
                                  i batches á 50

                               4. Upsert til          ──►  Supabase PostgreSQL
                                  database

                          ◄──  Sync complete:
                               770 lover
                               3666 forskrifter
```

## Sikkerhetsmodell

### Autentisering

| Lag | Mekanisme | Kommentar |
|-----|-----------|-----------|
| Bruker → AI | AI-plattformens auth | Microsoft Entra ID for Copilot |
| AI → MCP | Ingen (authless) | Kun offentlige data |
| MCP → Supabase | Service Role Key | Hemmelighet i miljøvariabler |
| MCP → Lovdata | Ingen | Offentlig API |

### Nettverkssikkerhet

```
┌─────────────────────────────────────────────────────────────────┐
│                     OSLOBYGG NETTVERK                           │
│                                                                 │
│   ┌─────────────┐                                               │
│   │  Copilot    │──┐                                            │
│   │  Studio     │  │                                            │
│   └─────────────┘  │    ┌─────────────────────────────────┐     │
│                    ├───►│  Azure App Proxy / VPN          │     │
│   ┌─────────────┐  │    │  (anbefalt for intern tilgang)  │     │
│   │  Ansatte    │──┘    └──────────────┬──────────────────┘     │
│   │  (AI chat)  │                      │                        │
│   └─────────────┘                      │                        │
│                                        ▼                        │
└────────────────────────────────────────┼────────────────────────┘
                                         │
                              HTTPS (TLS 1.3)
                                         │
                                         ▼
                          ┌──────────────────────────┐
                          │    MCP Server            │
                          │    (Render / Azure)      │
                          └──────────────────────────┘
```

## Dataklassifisering

| Datakategori | Klassifisering | Begrunnelse |
|--------------|----------------|-------------|
| Lovtekster | Offentlig | NLOD 2.0-lisensiert |
| Forskrifter | Offentlig | NLOD 2.0-lisensiert |
| Søkelogger | Intern | Kan avsløre arbeidsfokus |
| Bruker-ID | Ikke lagret | Authless design |
| IP-adresser | Ikke lagret | Kun i transient logs |

## Tredjeparter

| Tjeneste | Leverandør | Lokasjon | Data som deles |
|----------|------------|----------|----------------|
| Supabase | Supabase Inc. | AWS eu-central-1 (Frankfurt) | Lovtekster (offentlige) |
| Lovdata API | Lovdata | Norge | Ingen (kun nedlasting) |
| Render/Azure | Render/Microsoft | EU | Applikasjonskode, env vars |

## Logging og overvåking

### Hva logges

```
2024-02-04 10:15:32 INFO  MCP client connected: copilot-studio v1.0
2024-02-04 10:15:33 INFO  Tool call: lov with args: {lov_id: "aml", paragraf: "14-9"}
2024-02-04 10:15:33 DEBUG Query completed in 6ms
```

### Hva logges IKKE

- Bruker-identitet
- IP-adresser (i prod-config)
- Fullstendige søkeresultater
- Session-tokens

## Kapasitet og ytelse

| Metrikk | Verdi |
|---------|-------|
| Typisk responstid | 50-200ms |
| Database-query | ~6ms |
| Maks samtidige brukere | 100+ |
| Database-størrelse | ~50MB |
| Sync-tid (full) | ~5 min |

## Disaster Recovery

| Scenario | Mitigering |
|----------|------------|
| Supabase utilgjengelig | Fallback til lovdata.no-lenker |
| Sync feiler | Beholder cached data, retry senere |
| MCP-server nede | AI-assistenter får feilmelding |

## Vedlikehold

| Oppgave | Frekvens | Metode |
|---------|----------|--------|
| Data-sync | Ukentlig | Scheduled job |
| Dependency-oppdatering | Månedlig | Dependabot |
| Sikkerhetsscan | Ved deploy | GitHub Actions |
