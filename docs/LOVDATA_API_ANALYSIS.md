# Lovdata API - Kartlegging og Begrensninger

**Dato:** 2026-02-03
**Kontekst:** Analyse av Lovdata MCP-integrasjon i unified-timeline

## Sammendrag

Lovdata MCP-integrasjonen (commit `9e00cee`) fungerer kun delvis. Testrapporten viser at **lovtekst ikke returneres** - kun lenker. Dette skyldes arkitektoniske begrensninger i Lovdata sitt gratis API.

## Lovdata API Struktur

### To tilgangsnivåer

| Nivå | Tilgang | Pris |
|------|---------|------|
| **Public Data** | Bulk ZIP-nedlasting av alle XML-filer | Gratis (NLOD 2.0) |
| **REST API** | Sanntids søk og oppslag | Betalingstjeneste |

### Gratis Public Data API

**Direkte nedlastingslenker (ingen autentisering):**

| Datasett | URL |
|----------|-----|
| **Gjeldende lover** | `https://api.lovdata.no/v1/publicData/get/gjeldende-lover.tar.bz2` |
| **Sentrale forskrifter** | `https://api.lovdata.no/v1/publicData/get/gjeldende-sentrale-forskrifter.tar.bz2` |

- **Format:** `tar.bz2`-arkiv med XML/HTML-dokumenter
- **Lisens:** NLOD 2.0
- **Rate Limiting:** Ingen (offentlige endepunkter)
- **Liste datasett:** `GET /v1/publicData/list`
- **Flere datasett:** Se https://api.lovdata.no/swagger#/Public%20data

**Dokumentidentifikatorer (FRBR-basert):**

| Type | Prefiks | Eksempel |
|------|---------|----------|
| refID (work) | - | `lov/2005-05-20-28` |
| dokID (expression) | `NL/`, `LTI/`, `NLE/` | `NL/lov/2005-05-20-28` |

- `LTI/` - Kunngjort i Lovtidend
- `NL/` - Konsolidert lov
- `NLE/` - Engelsk versjon
- `NLO/` - Opphevet lov

### Betalt REST API (krever X-API-Key)

Autentisering: `X-API-Key` header eller Basic Auth.

| Kategori | Endepunkter | Beskrivelse |
|----------|-------------|-------------|
| **Structured Rules** | 5 | Hent enkeltlover i XML-format |
| **Content Services** | 10 | Metadata, indeks, historikk |
| **Services** | 3 | Søk, referansegenerering |
| **AI Functionality** | 3 | Strategisøk, responsegenerering |
| **Document Upload** | 1 | Last opp dokumenter |

**Nøkkelendepunkter (betalt):**
```
GET /v1/structuredRules/get/{base}/{ruleFile}     # Hent enkeltlov i XML
GET /v1/search                                      # Fulltekstsøk
GET /documentMeta                                   # Dokumentmetadata
GET /documentIndex                                  # Innholdsfortegnelse
```

**Rate Limiting:** 200 kall/minutt (gjelder kun autentiserte kall)

**Pris:** Ikke publisert - kontakt Lovdata

## Problemer i Nåværende Implementasjon

### 1. Manglende ZIP-nedlasting

```python
# backend/services/lovdata_service.py:207-229
def _fetch_law_content(self, lov_id: str, paragraf: str | None = None) -> str | None:
    cache_file = CACHE_DIR / f"{lov_id}.xml"

    if cache_file.exists():
        return self._parse_law_xml(cache_file, paragraf)

    # For now, return None - full API integration requires downloading ZIP
    # TODO: Implement ZIP download and XML extraction
    return None  # <-- Alltid None fordi ZIP aldri lastes ned
```

**Konsekvens:** Alle lovoppslag returnerer fallback-respons med kun lenke.

### 2. Søk kun mot hardkodede aliaser

```python
# backend/services/lovdata_service.py:359-396
def search(self, query: str, limit: int = 10) -> str:
    # Simple keyword matching against known laws
    for alias, lov_id in self.LOV_ALIASES.items():
        if query_lower in alias or query_lower in law_name.lower():
            ...
```

**Konsekvens:** Søk fungerer kun hvis query matcher kortnavn eller lovnavn - ikke fulltekstsøk i selve lovteksten.

### 3. Ingen synkroniseringsmekanisme

Meldingen "kjør `lovdata-mcp --sync`" refererer til funksjonalitet som ikke er implementert.

## XML-dokumentstruktur

Lovdata bruker et XML/HTML5-hybrid format som kan åpnes direkte i nettleser.

### Grunnstruktur

```xml
<html>
  <head>
    <title>Lovens tittel</title>
    <base href="..."/>
  </head>
  <body>
    <header class="documentHeader">
      <!-- Metadata som dl/dt/dd-par -->
    </header>
    <main class="documentBody">
      <!-- Selve lovteksten -->
    </main>
  </body>
</html>
```

### Hierarki for regelverk

| Element | Klasse | Beskrivelse | Eksempel |
|---------|--------|-------------|----------|
| `<section>` | `section` | Kapittel/del | Kapittel 3 |
| `<article>` | `legalArticle` | Paragraf | § 3-9 |
| `<article>` | `numberedLegalP` | Nummer | § 4-2 nr 3 |
| `<article>` | `legalP` | Ledd | første ledd |
| `<ol>`/`<ul>` | `defaultList` | Liste | bokstav a, b, c |
| `<li>` | - | Listepunkt | a) |

### Viktige klassenavn

**Metadata (i `<header>`):**
- `class=dokid` - Dokumentets unike ID (f.eks. `NL/lov/1992-07-03-93`)
- `class=titleShort` - Korttittel (f.eks. "avhendingslova")
- `class=title` - Full tittel
- `class=dateInForce` - Ikrafttredelsesdato
- `class=ministry` - Ansvarlig departement

**Innhold (i `<main>`):**
- `span.legalArticleHeader` - Paragrafoverskrift (inneholder `§ X-X`)
- `span.legalArticleValue` - Paragrafnummer
- `span.legalArticleTitle` - Paragraftittel (valgfri)
- `article.legalP` - Ledd i paragraf

### Unik adressering

Hvert element har `data-absoluteaddress` attributt:
```
/kapittel/3/paragraf/9/ledd/1/
```

### Parsing-eksempel for § 3-9

```python
# Finn paragraf 3-9
for article in soup.find_all('article', class_='legalArticle'):
    header = article.find('span', class_='legalArticleValue')
    if header and '3-9' in header.text:
        # Hent alle ledd
        for ledd in article.find_all('article', class_='legalP'):
            print(ledd.get_text())
```

## Tekniske Begrensninger i Gratis API

| Begrensning | Beskrivelse |
|-------------|-------------|
| **Kun bulk-nedlasting** | Ingen REST-endepunkt for enkeltlover |
| **Stort datasett** | `tar.bz2`-arkiv med tusenvis av XML-filer |
| **Ingen webhooks** | Må polle for oppdateringer |
| **Ingen sanntidssøk** | Må bygge egen søkeindeks |
| **XML-parsing nødvendig** | HTML5-kompatibelt XML med spesifikke klassenavn |

## Anbefalte Løsninger

### Alternativ A: Implementer Full Bulk-nedlasting

1. Legg til kommando for å laste ned ZIP fra `api.lovdata.no`
2. Pakk ut og indekser XML-filer lokalt
3. Implementer fulltekstsøk (f.eks. med SQLite FTS eller Elasticsearch)
4. Kjør periodisk synkronisering (cron/celery)

**Fordeler:** Helt gratis, full kontroll
**Ulemper:** Kompleks implementasjon, stort lagringsbruk, vedlikeholdsbyrde

### Alternativ B: Bruk eksisterende Python-pakke "lovlig"

```bash
pip install lovlig
```

```python
from lovlig import sync_datasets

# Last ned, pakk ut, og spor endringer
sync_datasets()
```

**Fordeler:** Ferdig løsning, endringssporing inkludert
**Ulemper:** Ekstern avhengighet, fortsatt bulk-nedlasting

### Alternativ C: Betalt Lovdata API

Kontakt Lovdata for tilgang til REST API med:
- Sanntids oppslag av enkeltlover
- Fulltekstsøk
- Strukturert JSON-respons

**Fordeler:** Enklest integrasjon, alltid oppdatert
**Ulemper:** Kostnad (ukjent)

### Alternativ D: Hybrid tilnærming

1. Bruk gratis API for bulk-nedlasting av mest brukte lover
2. Fallback til lovdata.no-lenker for andre
3. Vurder betalt API senere ved behov

## Umiddelbare Tiltak

### Minimum Viable Fix

Oppdater MCP-responsene til å være ærlige om begrensninger:

```python
def _format_fallback_response(self, ...):
    return f"""## {law_name}

⚠️ **Lovtekst ikke tilgjengelig direkte**

Lovdata sitt gratis API tilbyr kun bulk-nedlasting av datasett,
ikke direkte oppslag av enkeltlover.

**Se fullstendig tekst på Lovdata:**
[{url}]({url})

---
*For å aktivere lokal lovdata-cache, se docs/LOVDATA_SETUP.md*
"""
```

### Fjern villedende melding

Endre fra:
```
Tips: For å laste ned og cache lovdata, kjør `lovdata-mcp --sync`
```

Til:
```
Tips: Bulk-nedlasting fra Lovdata API er ikke implementert ennå.
Se docs/LOVDATA_API_ANALYSIS.md for status.
```

## Ressurser

- [Lovdata API dokumentasjon](https://api.lovdata.no/publicData)
- [Lovdata annonsering av gratis API](https://www.kode24.no/artikkel/lovdata-apner-gratis-api-ser-for-seg-ki-bruk/248594)
- [Python-pakken "lovlig" på PyPI](https://pypi.org/project/lovlig/)
- [data.norge.no - Norsk Lovtidend datasett](https://data.norge.no/en/datasets/c0c6a87c-f597-3735-965f-650be23426a0/norsk-lovtidend-avdeling-i)

## Konklusjon

**Nåværende MCP-integrasjon er ikke operativ for sitt primærformål.** Den fungerer som lenke-generator, ikke lovoppslag.

For full funksjonalitet kreves enten:
1. Implementering av bulk-nedlasting og lokal indeksering (~2-3 dagers arbeid)
2. Abonnement på Lovdata sitt betalte REST API (ukjent kostnad)

Anbefaling: Start med **Alternativ D (hybrid)** - fiks meldinger til å være ærlige om begrensninger, og evaluer behovet for full implementering basert på faktisk bruk.
