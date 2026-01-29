# Refaktoreringsanalyse: Respond*Modal-komponenter

> Grundig analyse av RespondVederlagModal og RespondFristModal med vurdering av refaktoreringsmuligheter.

## Sammendrag

| Komponent | Linjer | Kompleksitet | Wizard-steg | Props | Refaktorerbar |
|-----------|--------|--------------|-------------|-------|---------------|
| RespondVederlagModal | 2 387 | 432 | 5 (dynamisk 4-5) | 12 | Ja, delvis |
| RespondFristModal | 2 061 | 301 | 5 | 12 | Ja, delvis |
| **Totalt** | **4 448** | **733** | — | — | — |

**Konklusjon:** Begge komponentene er store og komplekse, men mesteparten av kompleksiteten er **domeneiboende** (NS 8407-regler). Refaktorering er mulig og anbefales for spesifikke deler, men total omskriving er ikke hensiktsmessig.

---

## RespondVederlagModal

### Nøkkeltall

| Metrikk | Verdi |
|---------|-------|
| Linjer | 2 387 |
| Kompleksitet | 432 |
| Props | 12 |
| useState/useRef | 6 |
| useMemo | 9 |
| useCallback | 5 |

### Strukturanalyse

```
Linje 1-73:      Kommentarer og imports
Linje 74-196:    Types, interfaces, Zod schema (123 linjer)
Linje 197-268:   Hjelpefunksjoner (beregnResultat)
Linje 269-1029:  Komponent-logikk (760 linjer)
Linje 1030-2387: JSX render (1357 linjer)
```

### Domenekompleksitet (iboende)

Komponenten håndterer NS 8407 vederlagsregler:

- **§34.1.2** – Preklusjon hovedkrav (SVIKT/ANDRE)
- **§34.1.3** – Preklusjon særskilte krav (rigg/drift, produktivitet)
- **§34.3.3** – EP-justering varsling
- **§30.2** – Tilbakeholdelse regningsarbeid
- **§34.2.1** – Fallback ved fastpristilbud

**3 kravtyper** med uavhengig vurdering:
1. Hovedkrav
2. Rigg/drift (særskilt)
3. Produktivitet (særskilt)

### Teknisk kompleksitet (refaktorerbar)

| Problem | Linjer | Refaktorerbar |
|---------|--------|---------------|
| Desktop/mobil duplicate summary | ~400 | ✅ Ja |
| Inline wizard-steg | ~1200 | ✅ Delvis |
| Beregningslogikk i komponent | ~150 | ✅ Ja |
| Repetert badge/status-logikk | ~100 | ✅ Ja |

---

## RespondFristModal

### Nøkkeltall

| Metrikk | Verdi |
|---------|-------|
| Linjer | 2 061 |
| Kompleksitet | 301 |
| Props | 12 |
| useState/useRef | 5 |
| useMemo | 8 |
| useCallback | 4 |

### Strukturanalyse

```
Linje 1-65:      Kommentarer og imports
Linje 66-168:    Types, interfaces, Zod schema (103 linjer)
Linje 169-238:   Hjelpefunksjoner (beregnResultat)
Linje 239-871:   Komponent-logikk (632 linjer)
Linje 872-2061:  JSX render (1189 linjer)
```

### Domenekompleksitet (iboende)

Komponenten håndterer NS 8407 fristregler:

- **§33.4** – Varsel om fristforlengelse (PREKLUSJON)
- **§33.6.1** – Spesifisert krav (REDUKSJON)
- **§33.6.2** – Forespørsel/svar (PREKLUSJON ved sen respons)
- **§33.7** – BH svarplikt
- **§33.8** – Forsering-valg ved avslag

**Spesialtilfeller:**
- `varselType === 'varsel'` – Foreløpig varsel uten dager
- `varselType === 'spesifisert'` – Spesifisert krav
- `varselType === 'begrunnelse_utsatt'` – TE har begrunnet utsettelse

### Teknisk kompleksitet (refaktorerbar)

| Problem | Linjer | Refaktorerbar |
|---------|--------|---------------|
| Desktop/mobil duplicate summary | ~100 | ✅ Ja |
| Inline wizard-steg | ~1000 | ✅ Delvis |
| Preklusjonslogikk i komponent | ~100 | ✅ Ja |
| Spesialtilfelle inline | ~50 | ⚠️ Vurder |

---

## Felles mønstre

Begge komponentene deler følgende struktur:

```
┌─────────────────────────────────────────────────────────────┐
│  Wizard Modal                                               │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────┐  │
│  │  StepIndicator                                       │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Step 1: Oversikt                                    │  │
│  │  - Kravsammendrag                                    │  │
│  │  - Subsidiær-info                                    │  │
│  │  - Veiviser                                          │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Step 2: Preklusjon                                  │  │
│  │  - Varsling-vurdering                                │  │
│  │  - RadioGroup valg                                   │  │
│  │  - Alert ved preklusjon                              │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Step 3: Vilkår/Metode                               │  │
│  │  - Betinget logikk                                   │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Step 4: Beregning/Beløp                             │  │
│  │  - Desktop: table                                    │  │
│  │  - Mobil: card-liste                                 │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Step 5: Oppsummering                                │  │
│  │  - StatusSummary komponenter                         │  │
│  │  - Resultat-boks                                     │  │
│  │  - Auto-generert begrunnelse                         │  │
│  │  - Desktop/mobil duplicate                           │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Navigation Actions                                  │  │
│  │  - Forrige/Neste/Send svar                           │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Refaktoreringsanbefalinger

### Fase 1: Lav risiko, høy verdi (anbefalt)

#### 1.1 Ekstraher `<KravSummaryTable>` komponent

**Gevinst:** ~400 linjer (RespondVederlagModal), ~100 linjer (RespondFristModal)

```tsx
// Ny komponent: src/components/shared/KravSummaryTable.tsx
interface KravSummaryTableProps {
  items: Array<{
    label: string;
    krevd: number | string;
    godkjent: number | string;
    status: 'godkjent' | 'delvis' | 'avslatt' | 'prekludert';
    subsidiaryRow?: {
      label: string;
      godkjent: number | string;
      status: 'godkjent' | 'delvis' | 'avslatt';
    };
  }>;
  totalRow?: { krevd: number; godkjent: number };
  unit?: 'kr' | 'dager';
}
```

#### 1.2 Ekstraher beregnings-hooks

**Gevinst:** ~150 linjer per komponent, bedre testbarhet

```tsx
// src/hooks/useVederlagCalculations.ts
function useVederlagCalculations(formValues, vederlagEvent, flags) {
  return useMemo(() => ({
    totalKrevd,
    totalGodkjent,
    totalKrevdInklPrekludert,
    totalGodkjentInklPrekludert,
    harMetodeendring,
    harPrekludertKrav,
    prinsipaltResultat,
    subsidiaertResultat,
  }), [formValues, vederlagEvent, flags]);
}

// src/hooks/useFristCalculations.ts
function useFristCalculations(formValues, fristEvent, flags) {
  return useMemo(() => ({
    erPrekludert,
    erRedusert,
    harHindring,
    prinsipaltResultat,
    subsidiaertResultat,
  }), [formValues, fristEvent, flags]);
}
```

### Fase 2: Middels risiko (vurder nøye)

#### 2.1 Ekstraher wizard-steg til komponenter

**Problem:** Mye delt state, krever prop-drilling eller context.

```tsx
// Mulig struktur
<RespondVederlagModal>
  <VederlagOversiktStep />
  <VederlagPreklusjonStep />
  <VederlagMetodeStep />
  <VederlagBelopStep />
  <VederlagOppsummeringStep />
</RespondVederlagModal>
```

**Anbefaling:** Kun hvis det gir vesentlig gevinst. Vurder React Context for delt state.

#### 2.2 Felles `<WizardModal>` abstraksjon

**Problem:** Kun 2 komponenter bruker mønsteret, risiko for over-abstraksjon.

**Anbefaling:** Ikke prioriter nå. Evaluer igjen hvis flere wizard-modaler legges til.

### Fase 3: Ikke anbefalt (nå)

| Tiltak | Begrunnelse |
|--------|-------------|
| Total omskriving | Fungerer, stabil, høy risiko |
| Generisk wizard-rammeverk | Over-engineering for 2 brukere |
| Splitte til mikro-komponenter | Mister kohesjon, prop-drilling |

---

## Prioritert handlingsplan

```
┌─────────────────────────────────────────────────────────────┐
│  1. FØRST: Skriv tester for eksisterende oppførsel         │
│     - Snapshot-tester for render                           │
│     - Unit-tester for beregningslogikk                     │
│     - Integration-tester for wizard-flyt                   │
├─────────────────────────────────────────────────────────────┤
│  2. Ekstraher KravSummaryTable (lav risiko)                │
│     - Fjerner ~500 linjer duplikat kode                    │
│     - Gjenbrukbar i begge modaler                          │
├─────────────────────────────────────────────────────────────┤
│  3. Ekstraher beregnings-hooks (lav risiko)                │
│     - Bedre testbarhet                                     │
│     - Lettere å forstå logikken isolert                    │
├─────────────────────────────────────────────────────────────┤
│  4. Evaluer videre etter erfaring                          │
│     - Har refaktoreringen gitt gevinst?                    │
│     - Er wizard-steg-ekstraksjon verdt risikoen?           │
└─────────────────────────────────────────────────────────────┘
```

---

## Forventet resultat etter Fase 1

| Komponent | Før | Etter (estimat) | Reduksjon |
|-----------|-----|-----------------|-----------|
| RespondVederlagModal | 2 387 | ~1 800 | -25% |
| RespondFristModal | 2 061 | ~1 700 | -18% |
| Ny: KravSummaryTable | — | ~200 | — |
| Ny: useVederlagCalc | — | ~100 | — |
| Ny: useFristCalc | — | ~80 | — |

**Total netto:** ~4 450 → ~3 880 linjer (-13%), men med bedre struktur og testbarhet.

---

## Konklusjon

Begge komponentene er komplekse, men dette er primært **domenedrevet kompleksitet** fra NS 8407-kontrakten. De tekniske forbedringene som anbefales vil:

1. **Redusere duplisering** (~500 linjer)
2. **Forbedre testbarhet** (isolerte hooks)
3. **Gjøre koden lettere å navigere** (færre linjer per fil)

Men de vil **ikke** fjerne den iboende kompleksiteten som følger av kontraktsreglene. Dette er akseptabelt – koden reflekterer domenet den modellerer.

**Anbefaling:** Start med KravSummaryTable og beregnings-hooks. Evaluer videre basert på erfaring.
