# Plan: Alignment av Backend PDF med Frontend PDF

> **Dato:** 2024-12-19
> **Status:** Forslag til godkjenning
> **Berørte filer:** `backend/services/reportlab_pdf_generator.py`, `src/pdf/*`

## Bakgrunn

Prosjektet har to PDF-generatorer:
- **Backend:** ReportLab (Python) - server-side generering
- **Frontend:** React-PDF (@react-pdf/renderer) - client-side generering

Disse har ulik layout, styling og terminologi. Denne planen beskriver hvordan backend-PDF kan alignes med frontend for bedre konsistens og brukervennlighet.

---

## Del 1: Analyse av Hovedforskjeller

### Layout og Struktur

| Aspekt | Backend (ReportLab) | Frontend (React-PDF) |
|--------|---------------------|---------------------|
| **Sidestruktur** | Lineær flyt, én side | Side per seksjon + innholdsfortegnelse |
| **Header** | Bare tittel med linje | Full header med Oslo-logo |
| **Footer** | Enkel timestamp + sak-ID | Sidetall + timestamp på hver side |
| **Innholdsfortegnelse** | Ingen | Første side med status-oversikt |

### Styling

| Aspekt | Backend | Frontend |
|--------|---------|----------|
| **Font** | Helvetica (system) | Oslo Sans + Helvetica fallback |
| **Primærfarge** | `#003366` | `#2A2859` (Oslo design) |
| **Sekundærfarge** | `#005A9C` | `#1F42AA` |
| **Tabellrader** | Ingen striping | Zebra-striping (annenhver grå) |
| **Status-visning** | Tekst i klammer | Fargekodede badges |

### Data-presentasjon

| Aspekt | Backend | Frontend |
|--------|---------|----------|
| **Teksttrunkering** | 150 tegn + "..." | Full tekst |
| **Dato-format** | "2024-12-05" | "5. desember 2024" |
| **Valuta-format** | "1,234 kr" | "1 234 NOK" |
| **Revisjoner** | Kun siste | Viser revisjonsnummer |
| **Subsidiære krav** | Ikke markert | Uthevet med oransje boks |

---

## Del 2: Terminologi som må standardiseres

### 2.1 Grunnlag-resultater (BH respons)

| Kode | Backend (nåværende) | Anbefalt (frontend) | NS 8407 |
|------|---------------------|---------------------|---------|
| `godkjent` | "Godkjent" | "Godkjent" | - |
| `delvis_godkjent` | "Delvis godkjent" | "Delvis godkjent" | - |
| `erkjenn_fm` | "Erkjent Force Majeure" | "Force majeure erkjent" | §33.3 |
| `avslatt` | "Avslått" | "Avslått" | - |
| `frafalt` | "Frafalt pålegg" | "Frafalt (pålegg trukket)" | §32.3 c |
| `krever_avklaring` | "Krever avklaring" | "Krever avklaring" | - |

**Begrunnelse:** "Force majeure erkjent" er mer naturlig norsk ordstilling. "Frafalt (pålegg trukket)" gir tydeligere kontekst om at det gjelder §32.3 c situasjoner.

### 2.2 Vederlag-resultater

| Kode | Backend (nåværende) | Anbefalt (frontend) | NS 8407 |
|------|---------------------|---------------------|---------|
| `godkjent` | "Godkjent" | "Godkjent" | - |
| `delvis_godkjent` | "Delvis godkjent" | "Delvis godkjent" | - |
| `avslatt` | "Avslått" | "Avslått" | - |
| `hold_tilbake` | "Hold tilbake betaling" | "Betaling holdes tilbake" | §30.2 |

**Begrunnelse:** Passiv form ("holdes tilbake") er mer formelt og konsistent med kontraktsspråk.

### 2.3 Frist-varseltyper (mangler §-referanser)

| Kode | Backend (nåværende) | Anbefalt | NS 8407 |
|------|---------------------|----------|---------|
| `noytralt` | "Nøytralt varsel" | "Nøytralt varsel (§33.4)" | §33.4 - Varsel om fristforlengelse |
| `spesifisert` | "Spesifisert krav" | "Spesifisert krav (§33.6)" | §33.6 - Spesifisering av krav |
| `force_majeure` | "Force majeure" | "Force majeure (§33.3)" | §33.3 - Fristforlengelse ved FM |
| `begge` | "Begge (nøytralt + spesifisert)" | **Fjernes** | Utgått konsept |

**Begrunnelse:** §-referanser gir brukeren direkte henvisning til kontrakten. `begge` er ikke lenger i bruk i frontend.

> **Merk:** "Nøytralt varsel" er en praktisk term. NS 8407 §33.4 beskriver et varsel som kan sendes "selv om [parten] ennå ikke kan fremsette et spesifisert krav".

### 2.4 Vederlagsmetoder

Backend bruker allerede riktige labels med §-referanser via `VEDERLAG_METODER` konstanten:
- "Enhetspriser (§34.3)"
- "Regningsarbeid (§30.2/§34.4)"
- "Fastpris / Tilbud (§34.2.1)"

### 2.5 Status-labels

| Kode | Backend (nåværende) | Anbefalt | Begrunnelse |
|------|---------------------|----------|-------------|
| `sendt` | "Sendt" | "Sendt til BH" | Tydeligere mottaker |
| `SENDT` | "Sendt" | "Sendt til BH" | Konsistent |

---

## Del 3: Implementeringsplan

### Fase 1: Terminologi-standardisering (Lav risiko, høy effekt)

**Estimert omfang:** Kun endringer i `reportlab_pdf_generator.py`

#### Oppgaver:
1. **Oppdater `GRUNNLAG_RESULTAT_MAP`:**
   ```python
   GRUNNLAG_RESULTAT_MAP = {
       'godkjent': 'Godkjent',
       'delvis_godkjent': 'Delvis godkjent',
       'erkjenn_fm': 'Force majeure erkjent',  # Endret
       'avslatt': 'Avslått',
       'frafalt': 'Frafalt (pålegg trukket)',  # Endret
       'krever_avklaring': 'Krever avklaring',
   }
   ```

2. **Oppdater `VEDERLAG_RESULTAT_MAP`:**
   ```python
   VEDERLAG_RESULTAT_MAP = {
       'godkjent': 'Godkjent',
       'delvis_godkjent': 'Delvis godkjent',
       'avslatt': 'Avslått',
       'hold_tilbake': 'Betaling holdes tilbake',  # Endret
   }
   ```

3. **Oppdater `FRIST_VARSEL_TYPE_MAP`:**
   ```python
   FRIST_VARSEL_TYPE_MAP = {
       'noytralt': 'Nøytralt varsel (§33.4)',      # Lagt til §-ref
       'spesifisert': 'Spesifisert krav (§33.6)',  # Lagt til §-ref
       'force_majeure': 'Force majeure (§33.3)',   # Lagt til §-ref
       # 'begge' fjernet - utgått konsept
   }
   ```

4. **Oppdater `STATUS_MAP`:**
   ```python
   # Endre:
   'sendt': 'Sendt til BH',  # Fra "Sendt"
   ```

### Fase 2: Layout-forbedringer (Medium risiko, høy effekt)

**Estimert omfang:** Moderate endringer i `reportlab_pdf_generator.py`

#### Oppgaver:
1. **Oppdater fargepalett til Oslo Kommune-design:**
   ```python
   COLORS = {
       'primary': '#2A2859',      # Oslo dark blue
       'secondary': '#1F42AA',    # Oslo warm blue
       'text': '#2C2C2C',         # Oslo ink
       'muted': '#666666',
       'border': '#E6E6E6',
       'grayBg': '#F9F9F9',
       'success': '#034B45',
       'error': '#C9302C',
       'warning': '#F9C66B',
   }
   ```

2. **Legg til NS 8407-referanser i seksjonstitler:**
   - "1. Ansvarsgrunnlag" → "1. Ansvarsgrunnlag (§32)"
   - "2. Vederlagsjustering" → "2. Vederlagsjustering (§34)"
   - "3. Fristforlengelse" → "3. Fristforlengelse (§33)"

3. **Fjern teksttrunkering:**
   ```python
   # Fjern denne logikken:
   # beskr = grunnlag.beskrivelse[:150] + '...' if len(...) > 150 else ...
   # Vis full tekst i stedet
   ```

4. **Legg til zebra-striping på tabellrader:**
   ```python
   # Annenhver rad med grå bakgrunn
   ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#F9F9F9')),
   ```

5. **Norsk dato-formatering:**
   ```python
   from babel.dates import format_date

   def _format_date_norwegian(self, date_str: str) -> str:
       """Format date as '5. desember 2024'"""
       # Implementasjon
   ```

6. **Forbedret valuta-formatering:**
   ```python
   def _format_currency(self, amount: float) -> str:
       """Format as '1 234 567 NOK'"""
       return f"{amount:,.0f} NOK".replace(',', ' ')
   ```

### Fase 3: Strukturelle forbedringer (Høy kompleksitet)

**Estimert omfang:** Større refaktorering

#### Oppgaver (valgfrie):
1. **Header med Oslo-logo** - Krever innebygd bilde eller font
2. **Footer med sidetall** - Bruk ReportLab PageTemplate
3. **Innholdsfortegnelse** - Første side med spor-oversikt
4. **Fargekodede status-badges** - Krever custom drawing
5. **Sidebrytning per seksjon** - PageBreak mellom spor

---

## Del 4: Prioriteringsmatrise

| Oppgave | Prioritet | Risiko | Effekt | Anbefaling |
|---------|-----------|--------|--------|------------|
| Terminologi-standardisering | **Høy** | Lav | Høy | **Må gjøres** |
| NS 8407-referanser i labels | **Høy** | Lav | Høy | **Må gjøres** |
| Fargepalett-oppdatering | Medium | Lav | Medium | Bør gjøres |
| Fjern teksttrunkering | Medium | Lav | Medium | Bør gjøres |
| Norsk dato-format | Medium | Lav | Medium | Bør gjøres |
| Zebra-striping | Lav | Lav | Lav | Kan gjøres |
| Header med logo | Lav | Medium | Lav | Kan gjøres |
| Innholdsfortegnelse | Lav | Medium | Medium | Kan gjøres |
| Status-badges | Lav | Medium | Medium | Kan gjøres |

---

## Del 5: Testplan

### Før implementering:
1. Generer eksempel-PDF med nåværende kode
2. Dokumenter screenshot for sammenligning

### Etter hver fase:
1. Generer ny PDF med samme testdata
2. Verifiser at alle labels vises korrekt
3. Sammenlign med frontend-PDF visuelt
4. Test edge cases (tomme felter, lange tekster, etc.)

### Regresjonstesting:
1. Test alle sakstyper: KOE, Forsering, Endringsordre
2. Verifiser at eksisterende integrasjoner fortsatt fungerer

---

## Vedlegg: NS 8407-referanser

### Relevante paragrafer

| § | Tittel | Relevans |
|---|--------|----------|
| §28.3 | Byggherrens tilbakeholdsrett | Hold tilbake betaling ved kontraktsbrudd |
| §30.2 | Kostnadsoverslag | Regningsarbeid, tilbakehold inntil overslag foreligger |
| §31.3 | Endringsordre | Sakstype endringsordre |
| §32 | Irregulær endring | Grunnlag, KOE |
| §32.3 c | Byggherrens svarplikt (frafall) | Frafall av pålegg mot EO for utført arbeid |
| §33.3 | Fristforlengelse ved force majeure | FM gir kun fristforlengelse |
| §33.4 | Varsel om fristforlengelse | Første varsel (praktisk: "nøytralt varsel") |
| §33.6 | Spesifisering av krav | Konkret fristkrav med antall dager |
| §33.8 | Forsering ved uberettiget avslag | Sakstype forsering |
| §34.2.1 | Avtalt vederlagsjustering | Tilbudsbasert oppgjør |
| §34.3 | Enhetspriser | Vederlagsmetode |
| §34.4 | Regningsarbeid | Vederlagsmetode (refererer til §30) |

> **Merk:** Termene "nøytralt varsel" og "spesifisert krav" er praktiske forenklinger. NS 8407 bruker ikke disse begrepene eksplisitt, men skiller mellom et foreløpig varsel (§33.4) og spesifisering når grunnlag foreligger (§33.6).
