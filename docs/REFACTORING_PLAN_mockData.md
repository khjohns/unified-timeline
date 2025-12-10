# Refaktoreringsplan: src/mocks/mockData.ts

## Oversikt

**Mål:** Dele opp `src/mocks/mockData.ts` (~2000 linjer) i flere filer, og kvalitetssikre at mock-data er korrekt og komplett i forhold til alle modaler i `src/components/modals`.

**Nåværende fil inneholder:**
- 10 komplette SakState-objekter (mockSakState1-10)
- 10 TimelineEntry-arrays (mockTimelineEvents1-10)
- 3 hjelperfunksjoner (getMockStateById, getMockTimelineById, getMockHistorikkById)
- mockCaseList array

---

## Del 1: Ny Mappestruktur

### Foreslått struktur:

```
src/mocks/
├── index.ts                      # Re-eksporterer alt (bakoverkompatibilitet)
├── helpers.ts                    # Hjelperfunksjoner
├── caseList.ts                   # mockCaseList array
├── cases/
│   ├── index.ts                  # Eksporterer alle cases
│   ├── sak-2025-001.ts          # Endring av grunnforhold - Bjørvika
│   ├── sak-2025-002.ts          # Forsinket materialleveranse
│   ├── sak-2024-089.ts          # Ekstraarbeid - Fasadeendringer
│   ├── sak-2025-003.ts          # Tilleggsarbeid - Rørføring
│   ├── sak-2025-005.ts          # Omtvistet endring - Teknisk rom
│   ├── sak-2025-006.ts          # Forsering - Prosjekteringsforsinkelse
│   ├── sak-2025-007.ts          # Tilbakeholdelse - Mangler overslag
│   ├── sak-2025-008.ts          # Force Majeure - Storflom
│   ├── sak-2025-009.ts          # Passivitet - Irregulær endring
│   └── sak-2025-010.ts          # Revisjonssyklus - Ekstra sprinkleranlegg
└── timelines/
    ├── index.ts                  # Eksporterer alle timelines
    ├── timeline-001.ts
    ├── timeline-002.ts
    ├── timeline-089.ts
    ├── timeline-003.ts
    ├── timeline-005.ts
    ├── timeline-006.ts
    ├── timeline-007.ts
    ├── timeline-008.ts
    ├── timeline-009.ts
    └── timeline-010.ts
```

---

## Del 2: Kvalitetssikring - Modal Datakrav

### 2.1 Aksjon-modaler (TE - Entreprenør)

#### SendGrunnlagModal
**Påkrevde felt i mock-data:**
- [ ] `hovedkategori` - må matche `HOVEDKATEGORI_OPTIONS`
- [ ] `underkategori` - må matche tilsvarende `UNDERKATEGORI` for valgt hovedkategori
- [ ] `tittel` - 3-100 tegn
- [ ] `beskrivelse` - minimum 10 tegn
- [ ] `dato_oppdaget` - gyldig ISO-dato
- [ ] `grunnlag_varsel.dato_sendt` - gyldig ISO-dato
- [ ] `grunnlag_varsel.metode` - array med gyldige metoder: `['epost', 'byggemote', 'telefon', 'system', 'brev']`
- [ ] `kontraktsreferanser` - array med strenger

**Sjekk i cases:** Alle 10 cases må ha komplett grunnlag-data.

#### SendVederlagModal
**Påkrevde felt i mock-data:**
- [ ] `metode` - må være `'ENHETSPRISER' | 'REGNINGSARBEID' | 'FASTPRIS_TILBUD'`
- [ ] `belop_direkte` - for ENHETSPRISER/FASTPRIS_TILBUD (kan være negativt)
- [ ] `kostnads_overslag` - for REGNINGSARBEID
- [ ] `begrunnelse` - minimum 10 tegn
- [ ] `saerskilt_krav.rigg_drift` - hvis relevant: `{ belop, dato_klar_over }`
- [ ] `saerskilt_krav.produktivitet` - hvis relevant: `{ belop, dato_klar_over }`
- [ ] `rigg_drift_varsel` - hvis rigg_drift krav: `{ dato_sendt, metode }`
- [ ] `produktivitetstap_varsel` - hvis produktivitet krav
- [ ] `regningsarbeid_varsel` - for REGNINGSARBEID: `{ dato_sendt, metode }`

**Cases som må ha komplett vederlag-data:**
- SAK-2025-001: REGNINGSARBEID med særskilte krav
- SAK-2025-003: ENHETSPRISER
- SAK-2024-089: FASTPRIS_TILBUD
- SAK-2025-005: Subsidiær vederlag (grunnlag avvist)

#### SendFristModal
**Påkrevde felt i mock-data:**
- [ ] `varsel_type` - må være `'noytralt' | 'spesifisert' | 'force_majeure'`
- [ ] `noytralt_varsel` - for noytralt: `{ dato_sendt, metode }`
- [ ] `spesifisert_varsel` - for spesifisert: `{ dato_sendt, metode }`
- [ ] `krevd_dager` - positivt heltall
- [ ] `begrunnelse` - minimum 10 tegn
- [ ] `pavirker_kritisk_linje` - boolean

**Cases som må ha komplett frist-data:**
- SAK-2025-001: Delvis godkjent frist
- SAK-2025-006: Forsering iverksatt
- SAK-2025-008: Force majeure frist

---

### 2.2 Aksjon-modaler (BH - Byggherre)

#### RespondGrunnlagModal
**Påkrevde felt for BH-respons:**
- [ ] `bh_resultat` - må være gyldig `GrunnlagResponsResultat`
- [ ] `bh_begrunnelse` - minimum 10 tegn

**Gyldige `bh_resultat` verdier:**
- `godkjent`
- `delvis_godkjent`
- `avvist_uenig`
- `avvist_for_sent`
- `krever_avklaring`
- `frafalt` (kun for irregulære endringer)

#### RespondGrunnlagUpdateModal (Snuoperasjon)
**Krav for test av snuoperasjon:**
- [ ] Minst én case med `bh_resultat: 'avvist_uenig'` som kan snus til godkjent
- [ ] Case med irregulær endring for testing av `frafalt`

**Case som må støtte dette:** SAK-2025-005 (subsidiær scenario)

#### RespondVederlagModal (4-port wizard)
**Port 1 - Preklusjon (§34.1.3):**
- [ ] Cases med `saerskilt_krav.rigg_drift` for preklusjons-test
- [ ] Cases med `saerskilt_krav.produktivitet` for preklusjons-test

**Port 2 - Metode & Svarplikt:**
- [ ] `bh_resultat` må inkludere metode-vurdering
- [ ] Cases med `hold_tilbake: true` for §30.2 testing

**Port 3 - Beløpsvurdering:**
- [ ] `godkjent_belop` - for delvis_godkjent
- [ ] `differanse` - beregnet felt

**Port 4 - Subsidiær:**
- [ ] `subsidiaer_triggers` - array med gyldige triggere
- [ ] `subsidiaer_resultat` - subsidiært resultat
- [ ] `subsidiaer_godkjent_belop` - subsidiært beløp

**Gyldige `subsidiaer_triggers`:**
- `preklusjon_rigg`
- `preklusjon_produktivitet`
- `preklusjon_ep_justering`
- `metode_avvist`

**Cases som må ha komplett vederlag-respons:**
- SAK-2025-007: `hold_tilbake` scenario
- SAK-2025-005: Subsidiær respons

#### RespondFristModal (4-port wizard)
**Port 1 - Preklusjon:**
- [ ] `noytralt_varsel_ok` - boolean
- [ ] `spesifisert_krav_ok` - boolean
- [ ] `frist_for_spesifisering` - hvis etterlysning

**Port 2 - Vilkår:**
- [ ] `vilkar_oppfylt` - boolean
- [ ] `begrunnelse_vilkar` - tekst

**Port 3 - Beregning:**
- [ ] `godkjent_dager` - antall godkjente dager
- [ ] `differanse_dager` - beregnet felt

**Port 4 - Subsidiær:**
- [ ] `subsidiaer_triggers` - array
- [ ] `subsidiaer_resultat` - subsidiært resultat
- [ ] `subsidiaer_godkjent_dager` - subsidiære dager

**Cases som må ha komplett frist-respons:**
- SAK-2025-001: Delvis godkjent (30 av 45 dager)
- SAK-2025-003: Avventer spesifisering
- SAK-2025-005: Subsidiær frist

---

### 2.3 Spesial-modaler

#### SendForseringModal
**Påkrevde felt:**
- [ ] `forsering.er_varslet` - boolean
- [ ] `forsering.dato_varslet` - ISO-dato
- [ ] `forsering.estimert_kostnad` - beløp
- [ ] `forsering.bekreft_30_prosent_regel` - boolean
- [ ] `forsering.er_iverksatt` - boolean
- [ ] `forsering.er_stoppet` - boolean

**Case som må ha forsering-data:** SAK-2025-006

#### ReviseVederlagModal / ReviseFristModal
**Påkrevde felt for revisjon:**
- [ ] `antall_versjoner` - må være > 0 for reviderte krav
- [ ] Timeline events med `vederlag_krav_oppdatert` / `frist_krav_oppdatert`

**Case som må ha revisjons-historikk:** SAK-2025-010

#### UpdateResponseVederlagModal / UpdateResponseFristModal
**Påkrevde felt:**
- [ ] Timeline events med `respons_vederlag_oppdatert` / `respons_frist_oppdatert`
- [ ] `respondedToVersion` i event_data

**Case som må ha oppdatert respons:** SAK-2025-010

---

### 2.4 Visnings-modaler

#### EventDetailModal / ViewSubmittedEventModal
**Alle event-typer må være representert:**
- [ ] `sak_opprettet`
- [ ] `grunnlag_opprettet`
- [ ] `grunnlag_oppdatert`
- [ ] `vederlag_krav_sendt`
- [ ] `vederlag_krav_oppdatert`
- [ ] `frist_krav_sendt`
- [ ] `frist_krav_oppdatert`
- [ ] `respons_grunnlag`
- [ ] `respons_grunnlag_oppdatert`
- [ ] `respons_vederlag`
- [ ] `respons_vederlag_oppdatert`
- [ ] `respons_frist`
- [ ] `respons_frist_oppdatert`
- [ ] `forsering_varsel`

**Sjekk:** Minst én timeline må inneholde hver event-type.

---

## Del 3: Implementeringssteg

### Steg 1: Opprett mappestruktur
```bash
mkdir -p src/mocks/cases src/mocks/timelines
```

### Steg 2: Ekstraher hjelperfunksjoner
Flytt til `src/mocks/helpers.ts`:
- `getMockStateById()`
- `getMockTimelineById()`
- `getMockHistorikkById()`

### Steg 3: Ekstraher caseList
Flytt til `src/mocks/caseList.ts`:
- `mockCaseList` array

### Steg 4: Ekstraher cases (én fil per case)
For hver case (1-10):
1. Opprett fil `src/mocks/cases/sak-XXXX-XXX.ts`
2. Eksporter `mockSakStateX`
3. Legg til JSDoc med scenario-beskrivelse

**Eksempel filstruktur:**
```typescript
// src/mocks/cases/sak-2025-001.ts
import type { SakState } from '@/types/timeline';

/**
 * SAK-2025-001: Endring av grunnforhold - Bjørvika
 *
 * Scenario: Aktiv sak under behandling med blandet status
 * - Grunnlag: Godkjent
 * - Vederlag: Under behandling (REGNINGSARBEID)
 * - Frist: Delvis godkjent (30 av 45 dager)
 *
 * Demonstrerer: Standard saksbehandlingsflyt med flere spor
 */
export const mockSakState1: SakState = {
  // ... data
};
```

### Steg 5: Ekstraher timelines (én fil per timeline)
For hver timeline (1-10):
1. Opprett fil `src/mocks/timelines/timeline-XXX.ts`
2. Eksporter `mockTimelineEventsX`
3. Legg til JSDoc med event-oversikt

### Steg 6: Opprett index-filer

**src/mocks/cases/index.ts:**
```typescript
export { mockSakState1 } from './sak-2025-001';
export { mockSakState2 } from './sak-2025-002';
// ... etc
```

**src/mocks/timelines/index.ts:**
```typescript
export { mockTimelineEvents1 } from './timeline-001';
export { mockTimelineEvents2 } from './timeline-002';
// ... etc
```

**src/mocks/index.ts:**
```typescript
// Re-eksporter alt for bakoverkompatibilitet
export * from './cases';
export * from './timelines';
export * from './helpers';
export { mockCaseList } from './caseList';
```

### Steg 7: Kvalitetssikring
For hver case, verifiser:

1. **Grunnlag-data komplett:**
   - Alle påkrevde felt utfylt
   - Verdier matcher tilgjengelige options
   - Datoer er gyldige ISO-format

2. **Vederlag-data komplett:**
   - Metode er gyldig
   - Beløp/overslag utfylt basert på metode
   - Særskilte krav har tilhørende varsler

3. **Frist-data komplett:**
   - Varseltype er gyldig
   - Tilhørende varsler utfylt
   - Dager er positive tall

4. **Timeline-events komplett:**
   - Alle relevante events for casen finnes
   - Event_data matcher event_type
   - Tidsstempler er kronologiske

### Steg 8: Fiks mangler
Basert på kvalitetssikringen, fiks eventuelle mangler:

**Kjente mangler å sjekke:**
- [ ] SAK-2025-002 (utkast): Har den nok data for visning?
- [ ] SAK-2025-008 (Force Majeure): Er `erkjenn_fm` resultat brukt korrekt?
- [ ] SAK-2025-009 (Passivitet): Er passiv aksept logikk komplett?
- [ ] Event-type dekning: Mangler noen event-typer?

### Steg 9: Oppdater imports
Søk gjennom kodebasen og oppdater imports:
```bash
# Finn alle filer som importerer fra mockData
grep -r "from.*mockData" src/
```

Siden vi bruker barrel exports, skal eksisterende imports fortsatt fungere.

### Steg 10: Verifiser at alt fungerer
```bash
npm run build
npm run test
npm run dev # Manuell testing
```

---

## Del 4: Scenario-dekning Matrix

| Case | Grunnlag | Vederlag | Frist | Spesial |
|------|----------|----------|-------|---------|
| SAK-2025-001 | Godkjent | Under behandling (REGNINGSARBEID) | Delvis godkjent | Særskilte krav |
| SAK-2025-002 | Utkast | Utkast | Utkast | Ny sak |
| SAK-2024-089 | Godkjent | Godkjent (FASTPRIS) | Godkjent | Klar for EO |
| SAK-2025-003 | Godkjent | Avventer | Avventer | Frist for spesifisering |
| SAK-2025-005 | Avvist | Subsidiært godkjent | Subsidiært godkjent | Subsidiær logikk |
| SAK-2025-006 | Godkjent | Under behandling | Avslått | Forsering (§33.8) |
| SAK-2025-007 | Godkjent | Hold tilbake | Godkjent | §30.2 tilbakeholdelse |
| SAK-2025-008 | Godkjent (FM) | N/A | Godkjent | Force Majeure |
| SAK-2025-009 | Passiv aksept | Passiv aksept | Passiv aksept | §32.3 passivitet |
| SAK-2025-010 | Godkjent | Revidert 2x | Revidert 2x | Revisjonssyklus |

---

## Del 5: Checkliste for LLM-implementering

### Før du starter:
- [ ] Les gjennom hele mockData.ts
- [ ] Les types i src/types/timeline.ts
- [ ] Forstå modal-strukturen i src/components/actions/

### Under implementering:
- [ ] Opprett mappestruktur først
- [ ] Ekstraher én fil om gangen
- [ ] Kjør typesjekk etter hver fil
- [ ] Behold original fil til slutt (for referanse)

### Kvalitetssikring:
- [ ] Kjør `npm run build` uten feil
- [ ] Verifiser at alle modaler viser korrekt data
- [ ] Test minst én case for hver modal-type
- [ ] Sjekk at timeline-events vises korrekt

### Etter ferdigstillelse:
- [ ] Slett original mockData.ts (eller arkiver)
- [ ] Oppdater eventuelle docs som refererer til mockData.ts
- [ ] Commit med beskrivende melding

---

## Estimert kompleksitet

| Oppgave | Kompleksitet |
|---------|--------------|
| Mappestruktur | Lav |
| Ekstrahere helpers | Lav |
| Ekstrahere cases | Medium (10 filer) |
| Ekstrahere timelines | Medium (10 filer) |
| Kvalitetssikring | Høy (manuell gjennomgang) |
| Fiks mangler | Medium-Høy |
| Testing | Medium |

**Total estimert:** Medium-Høy kompleksitet pga. kvalitetssikring.
