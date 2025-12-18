# Full Flow Test Plan

Integrasjonstest for KOE-systemet med Catenda.

## Oversikt

`scripts/test_full_flow.py` tester tre hovedflyter:

| Flyt | Beskrivelse | NS 8407 |
|------|-------------|---------|
| **KOE** | Standard krav om endringsordre | §31.1-31.2 |
| **Forsering** | Akselerasjon ved avslatt fristkrav | §33.8 |
| **Endringsordre** | BH samler KOE-saker i formell EO | §31.3 |

## Bruk

```bash
# Interaktiv meny
python scripts/test_full_flow.py

# Direkte flytvalg
python scripts/test_full_flow.py --flow koe
python scripts/test_full_flow.py --flow forsering
python scripts/test_full_flow.py --flow eo
python scripts/test_full_flow.py --flow all

# Med auto-confirm
python scripts/test_full_flow.py --flow koe -y
```

---

## Fase 1: Standard KOE-flyt

**Klasse:** `KOEFlowTester`

### Flytoversikt

```
TE sender grunnlag (§31.1)
    |
TE sender vederlagskrav
    |
TE sender fristkrav
    |
BH svarer grunnlag (godkjent/delvis/avslatt)
    |
BH svarer vederlag (godkjent/delvis/avslatt)
    |
BH svarer frist (godkjent/delvis/avslatt)
    |
TE reviderer (ved delvis godkjenning)
```

### Testdata (TEST_DATA)

| Felt | Verdi |
|------|-------|
| Grunnlag hovedkategori | ENDRING |
| Grunnlag underkategori | IRREG |
| Vederlag metode | REGNINGSARBEID |
| Vederlag beløp | 150 000 kr |
| Frist antall dager | 14 |

### Verifisering

- Kommentarer postes til Catenda topic
- PDF genereres og lastes opp
- State oppdateres korrekt i backend

---

## Fase 2: Forsering-flyt (§33.8)

**Klasse:** `ForseringFlowTester`

### Konsept

Når BH avslår et berettiget krav på fristforlengelse, kan TE velge å anse
avslaget som et pålegg om forsering. TE har ikke denne valgretten dersom
forseringskostnaden overstiger dagmulkten som ville påløpt + 30%.

### 30%-regelen

```
maks_forseringskostnad = avslatte_dager × dagmulktsats × 1.3
```

### Flytoversikt

```
1. Opprett KOE-1 med fristkrav (14 dager)
       |
2. BH avslår frist på KOE-1
       |
3. Opprett KOE-2 med fristkrav (10 dager)
       |
4. BH avslår frist på KOE-2
       |
5. Valider 30%-regelen:
   - Sum avslåtte dager: 24
   - Dagmulktsats: 50 000 kr/dag
   - Maks kostnad: 24 × 50 000 × 1.3 = 1 560 000 kr
       |
6. TE varsler forsering:
   - Estimert kostnad: 1 200 000 kr (< 1.56M, OK)
   - Relaterte saker: [KOE-1, KOE-2]
       |
7. BH aksepterer forsering
       |
8. Verifisering
```

### Testdata (FORSERING_TEST_DATA)

| Felt | Verdi |
|------|-------|
| KOE-1 frist | 14 dager |
| KOE-2 frist | 10 dager |
| Dagmulktsats | 50 000 kr/dag |
| Estimert forseringskostnad | 1 200 000 kr |
| Maks forseringskostnad | 1 560 000 kr |

### PDF-seksjon

PDF for forseringssaker viser:
1. Beregningsgrunnlag (30%-regelen)
2. TE varsler forsering (estimert kostnad, relaterte saker)
3. BH svarer (aksept/avslag)

---

## Fase 3: Endringsordre-flyt (§31.3)

**Klasse:** `EOFlowTester`

### Konsept

Endringsordre (EO) er det formelle dokumentet fra BH som bekrefter en endring
i kontrakten. En EO kan samle flere KOE-saker og formalisere kompensasjon
for pris og/eller frist.

### Flytoversikt

```
1. Opprett KOE-1 med vederlagskrav (100 000 kr)
       |
2. Opprett KOE-2 med vederlagskrav (75 000 kr)
       |
3. BH oppretter endringsordre:
   - EO-nummer: EO-001
   - Relaterte saker: [KOE-1, KOE-2]
       |
4. BH utsteder EO:
   - Kompensasjon: 175 000 kr
   - Fristforlengelse: 7 dager
   - Konsekvenser: pris, fremdrift
       |
5. TE aksepterer EO
       |
6. Verifisering
```

### Testdata (EO_TEST_DATA)

| Felt | Verdi |
|------|-------|
| KOE-1 vederlag | 100 000 kr |
| KOE-2 vederlag | 75 000 kr |
| EO kompensasjon | 175 000 kr |
| EO fristforlengelse | 7 dager |
| EO oppgjørsform | ENHETSPRISER |

### PDF-seksjon

PDF for endringsordresaker viser:
1. EO-identifikasjon (nummer, revisjon, dato)
2. Beskrivelse og konsekvenser
3. Kompensasjon og fristforlengelse
4. TE respons (aksept/bestridelse)

---

## Arkitektur

### Klassehierarki

```
BaseTester                 # Gjenbrukbar logikk
├── _fetch_csrf_token()
├── _get_auth_headers()
├── _create_topic()
├── _create_case_directly()
├── _get_state_and_version()
├── _send_event()
├── _verify_new_comment()
└── _verify_new_document()

KOEFlowTester(BaseTester)  # Standard KOE-flyt
├── create_test_topic()
├── verify_webhook_received()
├── set_verification_baseline()
├── send_grunnlag()
├── send_vederlag_and_frist()
├── send_bh_responses()
├── send_te_revisions()
└── show_summary()

ForseringFlowTester(BaseTester)  # §33.8 forsering
├── run_full_flow()
├── create_koe_cases()
├── bh_reject_deadlines()
├── validate_30_percent_rule()
├── create_forsering()
├── bh_respond_to_forsering()
└── show_summary()

EOFlowTester(BaseTester)  # §31.3 endringsordre
├── run_full_flow()
├── create_koe_cases()
├── create_endringsordre()
├── issue_endringsordre()
├── te_accept_eo()
└── show_summary()
```

### PDF-generator

`services/reportlab_pdf_generator.py` håndterer alle tre sakstyper:

```python
# Basert på sakstype
if sakstype == 'forsering':
    story.extend(self._build_forsering_section(state))
elif sakstype == 'endringsordre':
    story.extend(self._build_endringsordre_section(state))
else:
    # Standard KOE - tre spor
    story.extend(self._build_grunnlag_section(state, events))
    story.extend(self._build_vederlag_section(state, events))
    story.extend(self._build_frist_section(state, events))
```

---

## Forutsetninger

1. Backend kjører på localhost:5000
2. Catenda-autentisering konfigurert i .env
3. Topic board med typer: "Krav om endringsordre", "Forsering", "Endringsordre"

---

## Kontraktsreferanser

### §31.1 Varsel om krav (KOE)
> Totalentreprenøren skal uten ugrunnet opphold varsle byggherren skriftlig
> dersom han vil kreve endringsordre etter 31.3.

### §31.3 Endringsordre
> En endringsordre skal være skriftlig og gi beskjed om at det kreves en
> endring, samt hva endringen går ut på.

### §33.8 Forsering ved uberettiget avslag
> Hvis byggherren helt eller delvis avslår et berettiget krav på fristforlengelse,
> kan totalentreprenøren velge å anse avslaget som et pålegg om forsering...
> Totalentreprenøren har ikke en slik valgrett dersom vederlaget for forseringen
> må antas å ville overstige den dagmulkten som ville ha påløpt hvis byggherrens
> avslag var berettiget og forsering ikke ble iverksatt, tillagt 30 %.
