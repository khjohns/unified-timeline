---
name: lovdata
description: Norsk lovoppslag via Lovdata cache. Bruk ved spørsmål om lover, forskrifter, eller når du trenger presis lovtekst.
allowed-tools: Read, Grep, Glob, Bash
---

# Lovdata - Norsk Lovoppslag

Prosjektet har en lokal cache av alle norske lover og forskrifter fra Lovdata Public API.

## Når skal du bruke Lovdata?

- Bruker spør om spesifikke lovbestemmelser
- Du trenger å verifisere juridiske påstander
- Du skal sitere lovtekst i et svar
- Ved arbeid med NS 8407-relaterte lover (avhendingslova, bustadoppføringslova, etc.)

## Tilgjengelige tjenester

Backend: `backend/services/lovdata_service.py`

| Metode | Formål |
|--------|--------|
| `lookup_law(lov_id, paragraf)` | Hent spesifikk paragraf |
| `search(query, limit)` | Fulltekstsøk |
| `get_section_size(lov_id, paragraf)` | Sjekk størrelse før henting |
| `list_available_laws()` | Vis tilgjengelige aliaser |
| `get_sync_status()` | Sjekk om data er synkronisert |

## Lovaliaser

Bruk kortnavn i stedet for fulle ID-er. Både lange og korte aliaser fungerer:

| Alias | Kort | Lov |
|-------|------|-----|
| `avhendingslova` | `avhl` | Lov om avhending av fast eigedom |
| `bustadoppføringslova` | `buofl` | Lov om oppføring av ny bustad |
| `plan-og-bygningsloven` | `pbl` | Plan- og bygningsloven |
| `byggesaksforskriften` | `sak10` | Forskrift om byggesak (SAK10) |
| `byggteknisk-forskrift` | `tek17` | Forskrift om tekniske krav til byggverk |
| `arbeidsmiljøloven` | `aml` | Arbeidsmiljøloven |
| `tvisteloven` | `tvl` | Tvisteloven |
| `forvaltningsloven` | `fvl` | Forvaltningsloven |
| `anskaffelsesloven` | `loa` | Lov om offentlige anskaffelser |
| `anskaffelsesforskriften` | `foa` | Forskrift om offentlige anskaffelser |
| `kjøpsloven` | - | Kjøpsloven |
| `avtaleloven` | `avtl` | Avtaleloven |
| `skadeserstatningsloven` | `skl` | Skadeserstatningsloven |

Full liste: Se `LOV_ALIASES` i `backend/services/lovdata_service.py`

## Eksempel: Slå opp en paragraf

```python
from services.lovdata_service import LovdataService

service = LovdataService()

# Hent avhendingslova § 3-9
result = service.lookup_law("avhendingslova", "3-9")
print(result)
```

## Eksempel: Søk etter lovtekst

```python
# Søk etter "erstatning" i alle lover
results = service.search("erstatning bolig", limit=5)
for r in results:
    print(f"{r.title} § {r.section_id}")
```

## Viktige begrensninger

### Hva er IKKE tilgjengelig via API

| Kilde | Tilgang |
|-------|---------|
| Rettsavgjørelser (HR, LG, LA) | Kun lovdata.no |
| Forarbeider (NOU, Prop.) | Kun lovdata.no |
| Juridiske artikler | Kun lovdata.no |

For rettsavgjørelser og forarbeider, henvis brukeren til lovdata.no.

### Ytelse

- Søk: ~6ms (warm cache), ~600ms (cold cache)
- Data oppdateres ikke automatisk - kjør `service.sync()` for oppdatering

## Formatering av lovhenvisninger

Bruk standard juridisk format:

```
avhendingslova § 3-9 første ledd
arbeidsmiljøloven § 14-9 andre ledd bokstav a
```

## Synkronisering

Data lastes ned fra Lovdata Public API (NLOD 2.0-lisens).

```python
# Sjekk status
status = service.get_sync_status()

# Tving oppdatering
service.sync(force=True)
```

## Relevante filer

| Fil | Innhold |
|-----|---------|
| `backend/services/lovdata_service.py` | Hovedtjeneste med aliaser |
| `backend/services/lovdata_supabase.py` | Supabase backend |
| `backend/services/lovdata_sync.py` | SQLite fallback |
| `docs/ADR-003-lovdata-mcp.md` | Arkitekturbeslutninger |
| `tredjepart-api/lovdata-api.json` | OpenAPI-spec |

## Tips

1. **Sjekk alltid at data er synkronisert** før du stoler på "ikke funnet"-svar
2. **Bruk aliaser** - de er enklere å huske enn fulle ID-er
3. **Henvis til lovdata.no** for rettsavgjørelser og forarbeider
4. **Estimer tokens** med `get_section_size()` før du henter lange paragrafer

## MCP-spesifikke tips (via Claude.ai connector)

### Paragraf-format

| Format | Resultat |
|--------|----------|
| `"3-9"` | ✅ Riktig |
| `"§ 3-9"` | ✅ Fungerer (§ strippes automatisk) |
| `"17"` | ✅ Fungerer for enkle numre |
| `" 14-9 "` | ✅ Whitespace håndteres |
| `"kapittel 3"` | ❌ Kapitler støttes ikke |

**Regel:** Paragraf-parameter trenger kun tallet.

### Korte aliaser

Bruk korte aliaser for raskere oppslag:

| Kort | Fullt navn |
|------|------------|
| `aml` | arbeidsmiljøloven |
| `pbl` | plan-og-bygningsloven |
| `buofl` | bustadoppføringslova |
| `avhl` | avhendingslova |
| `tvl` | tvisteloven |
| `fvl` | forvaltningsloven |

### Søketips

- **Enkle søkeord fungerer best**: `"mangel"`, `"erstatning"`, `"frist"`
- **Kombiner maks 2-3 ord**: `"mangel bolig"` OK
- **Søk returnerer snippets** med kontekst

### Forskrifter

Forskrifter har god dekning i cachen. Test:
- `byggherreforskriften § 5`
- `anskaffelsesforskriften § 1-1`

### Responstid

- ~400-450ms per API-kall (fra Claude.ai)
- Varm cache i Supabase: ~6ms internt

### Feilhåndtering

Manglende innhold gir en lenke til lovdata.no, ikke tom respons:
```
Lovteksten er ikke tilgjengelig i lokal cache.
Se fullstendig tekst på Lovdata: [lenke]
```
