# 📋 Handlingsplan: PDF-forbedringer (react-pdf)

**Prosjekt:** KOE - Krav om endringsordre
**Dato opprettet:** 2025-11-16
**Status:** Planleggingsfase

---

## 🎯 Overordnet strategi

Implementeringen er delt inn i **4 faser** basert på:
- **Verdi** (hvor mye forbedringen betyr for brukerne)
- **Kompleksitet** (teknisk vanskelighetsgrad)
- **Risiko** (sannsynlighet for bugs/problemer)
- **Avhengigheter** (rekkefølge for implementering)

---

## 📊 FASE 1: Quick Wins (Estimat: 4-6 timer)

**Mål:** Implementere enkle forbedringer med høy verdi og lav risiko.

### 1.1 Filtrer tomme revisjoner ✅
**Estimat:** 1 time
**Verdi:** Middels
**Risiko:** Lav

**Oppgaver:**
- [ ] Filtrer `koe_revisjoner` for kun sendte revisjoner
- [ ] Filtrer `bh_svar_revisjoner` tilsvarende
- [ ] Oppdater `totalPages` beregning
- [ ] Test med demo-data (3 revisjoner, hvorav 1 er tom)

**Fil:** `utils/pdfGeneratorReact.tsx`

**Kode:**
```typescript
// I KoePdfDocument component
const senteKoeRevisjoner = data.koe_revisjoner.filter(
  koe => koe.dato_krav_sendt && koe.dato_krav_sendt !== ''
);

const senteBhSvarRevisjoner = data.bh_svar_revisjoner.filter(
  (_, index) => data.koe_revisjoner[index]?.dato_krav_sendt
);

// Oppdater totalPages
const totalPages = 2 + senteKoeRevisjoner.length + senteBhSvarRevisjoner.length;
```

---

### 1.2 Forbedre tabellvisualisering ✅
**Estimat:** 1 time
**Verdi:** Lav
**Risiko:** Lav

**Oppgaver:**
- [ ] Øk padding i `tableRow` fra 5 til 6
- [ ] Mørkere striped bakgrunn (#F5F5F5 i stedet for #F9F9F9)
- [ ] Juster label/value bredde (45%/55%)
- [ ] Legg til farge på tableLabel (`color: COLORS.inkDim`)

**Fil:** `utils/pdfGeneratorReact.tsx` (styles)

---

### 1.3 Oppdater fargepalett ✅
**Estimat:** 1 time
**Verdi:** Middels
**Risiko:** Lav

**Oppgaver:**
- [ ] Legg til nye farger i COLORS konstant
- [ ] Dokumenter deprecated farger (inkDim, muted, border)
- [ ] Legg til kommentar om bruk av opacity

**Fil:** `utils/pdfGeneratorReact.tsx`

---

### 1.4 Metadata footer ✅
**Estimat:** 1 time
**Verdi:** Lav
**Risiko:** Lav

**Oppgaver:**
- [ ] Lag `MetadataFooter` komponent
- [ ] Legg til på siste side
- [ ] Inkluder: generert av, system, versjon

**Fil:** `utils/pdfGeneratorReact.tsx`

---

**FASE 1 TOTALT:** 4 timer
**Testing:** 1-2 timer

---

## 🚀 FASE 2: Oppsummeringsseksjon (Estimat: 6-8 timer)

**Mål:** Legg til omfattende oppsummeringsseksjon på side 1.

### 2.1 Lag ExecutiveSummary komponent ✅
**Estimat:** 3 timer
**Verdi:** Svært høy
**Risiko:** Middels

**Oppgaver:**
- [ ] Implementer `ExecutiveSummary` komponent
- [ ] Beregn totaler (krav, godkjent, differanse)
- [ ] Beregn frist-totaler
- [ ] Lag summary cards med styling
- [ ] Integrer pdfLabels for status

**Fil:** `utils/pdfGeneratorReact.tsx`

**Viktige detaljer:**
```typescript
// Bruk pdfLabels for status
<Text style={styles.statusText}>
  Status: {pdfLabels.kravStatus(data.koe_revisjoner[data.koe_revisjoner.length - 1]?.status)}
</Text>

// Sjekk for division by zero
const totalKravBelop = data.koe_revisjoner.reduce(
  (sum, koe) => sum + (parseFloat(koe.vederlag.krav_vederlag_belop || '0')), 0
);

// Conditional styling for differanse
<View style={[
  styles.summaryCard,
  differanse > 0 && styles.summaryCardWarning
]}>
```

---

### 2.2 Integrer på side 1 ✅
**Estimat:** 1 time
**Verdi:** Høy
**Risiko:** Lav

**Oppgaver:**
- [ ] Plasser ExecutiveSummary mellom SummarySection og Varsel
- [ ] Test at alt får plass på side 1
- [ ] Bruk `minPresenceAhead` hvis nødvendig

---

### 2.3 Lag StatusBadge komponent ✅
**Estimat:** 2 timer
**Verdi:** Middels
**Risiko:** Lav

**Oppgaver:**
- [ ] Implementer `StatusBadge` med type-parameter ('krav' | 'svar' | 'sak')
- [ ] Integrer med `getKravStatusSkin`, `getSvarStatusSkin`, `getSakStatusSkin`
- [ ] Integrer med `pdfLabels`
- [ ] Map skin til farger fra COLORS
- [ ] Legg til badges i KoeRevisionSection og BhSvarRevisionSection

**Fil:** `utils/pdfGeneratorReact.tsx`

---

**FASE 2 TOTALT:** 6 timer
**Testing:** 2 timer

---

## 📈 FASE 3: Layout og signatur (Estimat: 8-10 timer)

**Mål:** Forbedre platsutnyttelse og signatur-seksjoner.

### 3.1 Dynamisk page breaking ✅
**Estimat:** 3 timer
**Verdi:** Høy
**Risiko:** Middels

**Oppgaver:**
- [ ] Legg til `wrap` og `minPresenceAhead` på alle seksjoner
- [ ] Test ulike `minPresenceAhead` verdier (40, 60, 80, 100)
- [ ] Kombiner TitlePage, SummarySection, ExecutiveSummary og VarselSection på side 1
- [ ] Dokumenter optimale verdier

**Viktig:**
```typescript
// Start conservativt med høye verdier
<View wrap minPresenceAhead={100}>
  <Text style={styles.mainTitle}>Varsel</Text>
  <VarselSection data={data} />
</View>

// Reduser gradvis til optimal verdi
```

---

### 3.2 SignatureBlock komponent ✅
**Estimat:** 3 timer
**Verdi:** Høy
**Risiko:** Lav

**Oppgaver:**
- [ ] Implementer `SignatureBlock` komponent
- [ ] Legg til signaturlinje (40px høy)
- [ ] Legg til dato-linje
- [ ] Støtt optional title parameter
- [ ] Erstatt eksisterende signatur-logikk

**Fil:** `utils/pdfGeneratorReact.tsx`

---

### 3.3 Testing og justering ✅
**Estimat:** 2 timer
**Verdi:** Høy
**Risiko:** Middels

**Oppgaver:**
- [ ] Test med minimum data (1 revisjon)
- [ ] Test med maksimum data (5+ revisjoner)
- [ ] Test med lange tekstfelt (1000+ tegn)
- [ ] Verifiser at ingen orphaned headers
- [ ] Verifiser at footer alltid vises

---

**FASE 3 TOTALT:** 8 timer
**Testing:** 2 timer

---

## 🎨 FASE 4: Avanserte features (Estimat: 10-12 timer)

**Mål:** Implementer timeline og andre avanserte features.

### 4.1 RevisionTimeline komponent ✅
**Estimat:** 4 timer
**Verdi:** Høy
**Risiko:** Høy

**Oppgaver:**
- [ ] Implementer `RevisionTimeline` med flexDirection (IKKE absolute positioning)
- [ ] Lag timeline dot og connector
- [ ] Test at connector ikke forsvinner (border/padding bug)
- [ ] Legg til på side 1 ELLER egen side
- [ ] Filtrer kun sendte revisjoner

**VIKTIG:** Bruk korrigert implementering fra kvalitetssikringen (flexDirection-basert).

**Fil:** `utils/pdfGeneratorReact.tsx`

---

### 4.2 Vedleggsreferanser ✅
**Estimat:** 3 timer
**Verdi:** Middels
**Risiko:** Middels

**Oppgaver:**
- [ ] Oppdater `types.ts` med `vedlegg: string[]` i KoeVederlag interface
- [ ] Implementer `AttachmentsSection` komponent
- [ ] Legg til i KoeRevisionSection hvis vedlegg finnes
- [ ] Test med og uten vedlegg

**Filer:** `types.ts`, `utils/pdfGeneratorReact.tsx`

---

### 4.3 Watermark (VALGFRITT) ⚠️
**Estimat:** 2 timer
**Verdi:** Lav
**Risiko:** Høy

**Oppgaver:**
- [ ] Implementer alternativ løsning (IKKE transform)
- [ ] Bruk fixed positioning med hardkodede verdier
- [ ] Test opacity for å ikke blokkere innhold
- [ ] ALTERNATIV: Legg til "UTKAST" badge i header i stedet

**ANBEFALING:** Vurder om dette er nødvendig. Kan droppes hvis andre prioriteringer er viktigere.

---

### 4.4 Koderefaktorering (VALGFRITT) 🔧
**Estimat:** 6-8 timer
**Verdi:** Middels (vedlikehold)
**Risiko:** Middels

**Oppgaver:**
- [ ] Split `pdfGeneratorReact.tsx` i separate filer
- [ ] Lag `utils/pdf/components/` mappe
- [ ] Lag `utils/pdf/utils/calculations.ts` for beregninger
- [ ] Lag `utils/pdf/utils/formatting.ts` for formattering
- [ ] Oppdater imports

**ANBEFALING:** Gjør dette SIST, når all funksjonalitet er implementert og testet.

**Filer:** Se kodestruktur-anbefalinger i opprinnelig dokument.

---

**FASE 4 TOTALT:** 10-14 timer (avhengig av valgfrie oppgaver)
**Testing:** 3-4 timer

---

## 📝 Testing-sjekkliste (Etter hver fase)

### Funksjonell testing
- [ ] PDF genereres uten feil
- [ ] Alle seksjoner vises korrekt
- [ ] Ingen overlappende tekst
- [ ] Ingen orphaned headers
- [ ] Footer vises på alle sider
- [ ] Header vises på alle sider
- [ ] Sidenummerering er korrekt

### Layout testing
- [ ] Konsistent spacing mellom seksjoner
- [ ] Tabeller har riktig alignment
- [ ] Signaturer har nok plass
- [ ] Ingen tomme sider

### Data testing
- [ ] Test med DEMO_DATA
- [ ] Test med minimums-data (1 revisjon, få felt utfylt)
- [ ] Test med maksimums-data (5+ revisjoner, alle felt utfylt)
- [ ] Test med edge cases (svært lange tekstfelt)
- [ ] Test med tomme revisjoner

### Visuell testing
- [ ] Farger matcher Oslo kommunes designsystem
- [ ] Norske tegn (æ, ø, å) vises korrekt
- [ ] Datoformater er konsistente (no-NO)
- [ ] Tallformater bruker norsk locale (mellomrom som tusenskiller)
- [ ] Fonter laster korrekt (Oslo Sans)

---

## 🎯 Prioritering og estimater

### Samlet oversikt

| Fase | Estimat | Verdi | Risiko | Anbefaling |
|------|---------|-------|--------|------------|
| **Fase 1: Quick Wins** | 4-6t | Middels-Høy | Lav | ✅ START HER |
| **Fase 2: Oppsummering** | 6-8t | Svært høy | Middels | ✅ PRIORITER |
| **Fase 3: Layout/Signatur** | 8-10t | Høy | Middels | ✅ PRIORITER |
| **Fase 4: Avansert** | 10-14t | Middels | Høy | ⚠️ VALGFRITT |

**Totalt (uten valgfrie):** 18-24 timer
**Totalt (med valgfrie):** 28-38 timer

---

## 🚨 Risikoer og avbøtende tiltak

### Tekniske risikoer

1. **react-pdf begrensninger**
   - **Risiko:** transform, z-index fungerer ikke som forventet
   - **Avbøtende tiltak:** Bruk kun støttede CSS properties, test grundig

2. **Layout brudd ved lange tekster**
   - **Risiko:** Tekst går utenfor sideramme
   - **Avbøtende tiltak:** Bruk `wrap` og test med edge cases

3. **Absolute positioning bugs**
   - **Risiko:** Elementer forsvinner ved bruk av borders/padding
   - **Avbøtende tiltak:** Bruk flexDirection i stedet for absolute positioning

### Prosess-risikoer

1. **Scope creep**
   - **Risiko:** Flere features ønskes underveis
   - **Avbøtende tiltak:** Hold fast på faseplan, dokumenter nye ønsker for senere

2. **Testing tar lengre tid enn forventet**
   - **Risiko:** Edge cases avdekkes sent
   - **Avbøtende tiltak:** Test kontinuerlig etter hver endring

---

## 📚 Ressurser og dokumentasjon

### Nyttige lenker
- [react-pdf dokumentasjon](https://react-pdf.org/)
- [react-pdf advanced guide](https://react-pdf.org/advanced)
- [Oslo kommunes designsystem](https://punkt.oslo.kommune.no/)

### Interne filer
- `utils/pdfLabels.ts` - Label mapping
- `utils/statusHelpers.ts` - Status helpers
- `constants.ts` - Alle dropdown options
- `types.ts` - TypeScript interfaces

---

## ✅ Akseptansekriterier (Ferdig når...)

- [ ] Alle kritiske forbedringer (Fase 1-3) er implementert
- [ ] PDF genereres uten feil for alle testscenarioer
- [ ] Ingen visuell forskjell fra Oslo kommunes designsystem
- [ ] Koden er dokumentert med kommentarer
- [ ] Testing-sjekklisten er fullført
- [ ] Bruker kan laste ned PDF uten problemer
- [ ] PDF viser lesbare tekster (ikke tallverdier) - allerede implementert ✅

---

## 📅 Anbefalt tidsplan

### Sprint 1 (Uke 1)
- Fase 1: Quick Wins (4-6t)
- Fase 2: Oppsummeringsseksjon (6-8t)
- **Total:** 10-14t

### Sprint 2 (Uke 2)
- Fase 3: Layout og signatur (8-10t)
- Testing og bugfixing (4t)
- **Total:** 12-14t

### Sprint 3 (Uke 3) - VALGFRITT
- Fase 4: Avanserte features (10-14t)
- Koderefaktorering (6-8t)
- Final testing (4t)
- **Total:** 20-26t

---

## 📞 Kontaktinformasjon

**Utvikler:** [Navn]
**Prosjektansvarlig:** [Navn]
**Sist oppdatert:** 2025-11-16

---

**Neste steg:** Diskuter prioritering med teamet og bestem hvilke faser som skal implementeres.
