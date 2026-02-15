# ADR-003: Card-Anchored Contextual Editing

**Status:** Akseptert — Grunnlag og Frist implementert (PR #439)
**Dato:** 2026-02-14 (opprinnelig), 2026-02-15 (oppdatert etter implementering)
**Beslutningstagere:** Utviklingsteam
**Kontekst:** UX-mønster for inline skjemaer i bento-layout

---

## Sammendrag

Når bruker åpner et svarskjema i bento-layouten, flyttes valgkontroller
(resultat, toggles, metodevalg) inn i det tilhørende kortet der konteksten
allerede vises. Formpanelet reserveres for primæroppgaven: fritekst-begrunnelse
og auto-generert begrunnelse. Resultat og konsekvenser vises også i kortet,
ikke i formpanelet.

---

## Kontekst

### Problemstilling

I den opprinnelige designen åpnet svarskjemaer som fulle modaler eller
ekspanderbare paneler med all kontekst og alle kontroller samlet. Dette skapte
tre problemer:

1. **Duplisert kontekst** - Skjemaet gjentok informasjon (kategori, datoer,
   beløp) som allerede var synlig i kortet.
2. **Kontroller uten kontekst** - "Varslet i tide?" stod alene i skjemaet,
   adskilt fra datoene den vurderer.
3. **Ubalansert layout** - Valgkontroller tok vertikal plass fra
   tekstredaktøren, som er den primære arbeidsflaten.

### Observasjon

Valgkontroller (radio, toggles, verdict cards) er kontekstuelle vurderinger
av data som allerede vises i kortet. "Varslet i tide?" er en vurdering av
datofeltet "Varslet". "Godkjent/Avslått" er en dom over ansvarsgrunnlaget.
Disse hører naturlig sammen med dataen de vurderer.

---

## Beslutning

### Designmønster: Card-Anchored Contextual Editing

Når et spor (grunnlag, vederlag, frist) går i redigeringsmodus:

1. **Kortet transformeres** fra read-only til interaktivt. Valgkontroller
   vises inline der den relevante konteksten allerede finnes.
2. **Kortet viser resultat og konsekvenser** — dynamisk beregnet resultat,
   subsidiær-oppsummering og preklusjons-advarsler vises i kortet nær
   kontrollene som styrer dem.
3. **Formpanelet fokuserer** utelukkende på begrunnelse: auto-generert
   tekst fra valg, rik tekst-editor, og submit/avbryt.
4. **En dedikert bridge-hook** koordinerer state mellom kort og skjema.

```
┌─────────────────────────┐  ┌────────────────────────────────┐
│  FRISTCARD (col-5)      │  │  FORMPANEL (col-7)             │
│                         │  │                                │
│  Krevd dager: 10d       │  │  ┌────────────────────────┐   │
│  Varslet     13.feb     │  │  │                        │   │
│  Spesifisert 20.feb     │  │  │  Byggherrens            │   │
│                         │  │  │  begrunnelse            │   │
│ ┌─ §33.4 Varsel ──────┐│  │  │                        │   │
│ │ Varslet i tide?      ││  │  │  [Auto-generert tekst] │   │
│ │ [✓ Ja] [✕ Nei]      ││  │  │                        │   │
│ └──────────────────────┘│  │  │  [Rik tekst-editor]    │   │
│ ┌─ §33.1 Vilkår ──────┐│  │  │                        │   │
│ │ Vilkår oppfylt?      ││  │  └────────────────────────┘   │
│ │ [✓ Ja] [✕ Nei]      ││  │  [Regenerer fra valg]         │
│ └──────────────────────┘│  │                                │
│ ┌─ §33.5 Beregning ───┐│  │  ─────────────────────────────│
│ │ Godkjent: [__10_] d  ││  │    [Avbryt]  [Send svar]      │
│ └──────────────────────┘│  │                                │
│                         │  │                                │
│ ┌ Resultat ────────────┐│  │                                │
│ │ Godkjent – 10/10d    ││  │                                │
│ │ ↳ Subsidiært: ...    ││  │                                │
│ └──────────────────────┘│  │                                │
└─────────────────────────┘  └────────────────────────────────┘
```

### Prinsipper

| # | Prinsipp | Forklaring |
|---|----------|------------|
| 1 | **Kontroller hører der konteksten er** | "Varslet i tide?" ved datoene. Verdiktkort ved grunnlaget. Metodevalg ved krevd beløp. |
| 2 | **Redaktøren får all plass** | Primæroppgaven (begrunnelse) trenger konsentrasjon og skjermplass. |
| 3 | **Kortet transformeres, ikke dupliseres** | Ingen kontekstpanel i skjemaet. Kortet selv blir interaktivt. |
| 4 | **Resultat og konsekvenser i kortet** | Beregnet resultat, subsidiær-oppsummering og preklusjons-advarsler vises i kortet — nær kontrollene som styrer dem. Formpanelet viser kun begrunnelse. |
| 5 | **Auto-begrunnelse i formpanelet** | Begrunnelse auto-genereres fra kortets valg og fylles inn i editoren. Brukeren kan redigere fritt, eller klikke «Regenerer fra valg» for å oppdatere. |
| 6 | **State løftes via dedikert bridge-hook** | Hvert spor har en egen hook (`useFristBridge`, `useVederlagBridge`) med domene-spesifikk logikk — ikke en generisk bridge. |

> **Endret fra opprinnelig forslag:** Prinsipp 4 sa opprinnelig "Konsekvenser
> vises i formpanelet". Under implementering viste det seg at konsekvens-callouts
> og subsidiær-oppsummering fungerer bedre i kortet, der brukeren allerede ser
> valgene som driver resultatet. Formpanelet ble renere og mer fokusert.

---

## Implementert arkitektur

### Grunnlag (ad-hoc state)

Grunnlag ble implementert først, før mønsteret var etablert. Bruker
ad-hoc `useState` direkte i CasePageBento:

```
CasePageBento
├── useState(formVarsletITide)      // boolean
├── useState(formResultat)          // string
├── useState(formResultatError)     // boolean
├── CaseMasterCard(formVarsletITide, onFormVarsletITideChange, ...)
└── BentoRespondGrunnlag(externalVarsletITide, externalResultat)
```

Fungerer fordi grunnlag bare har 2 kontroller. Bør refaktoreres til
en `useGrunnlagBridge`-hook for konsistens, men er ikke kritisk.

### Frist (dedikert bridge-hook) — referanseimplementering

Frist er referanseimplementeringen for card-anchored editing.
Hook-basert koordinering med konsolidert state:

```
CasePageBento
├── useFristBridge(config)
│   ├── FormState (single useState med alle 6 felter)
│   ├── Visibility flags (computed fra varselType, tilstand)
│   ├── Resultat-beregning (prinsipalt + subsidiært)
│   └── Preklusjons-/reduksjonslogikk
│
├── FristCard(editState=fristBridge.cardProps)
│   ├── InlineYesNo × N (varsling, vilkår)
│   ├── InlineNumberInput (godkjent dager)
│   ├── Preklusjons-advarsler (inline)
│   └── Resultat-boks (prinsipalt + subsidiært)
│
└── BentoRespondFrist(external*=fristBridge.computed)
    ├── Auto-begrunnelse (generateFristResponseBegrunnelse)
    ├── RichTextEditor (begrunnelse)
    ├── «Regenerer fra valg»-knapp
    └── Submit/Avbryt footer
```

**Nøkkel-kontrakter:**

| Komponent | Mottar fra bridge | Ansvar |
|-----------|-------------------|--------|
| **FristCard** | `cardProps: FristEditState` — state + handlers + visibility flags + beregnet resultat | Viser kontroller, preklusjons-advarsler, resultat |
| **BentoRespondFrist** | `computed.*` — resultat, preklusjonsinfo for auto-begrunnelse | Auto-begrunnelse, teksteditor, submit |
| **CasePageBento** | Eier bridge, passer `cardProps` til kort og `computed` til form | Layout, expand/collapse, action-routing |

**Computed vs raw — enveis dataflyt:**

Bridge-hooken returnerer to distinkte kontrakter med forskjellig
retning. Formpanelet skal aldri motta setters — det er en ren
konsument av beregnede verdier:

```
useFristBridge returns {
  cardProps: {              // → FristCard (read-write)
    state + setters         //   Rå FormState + onChange-handlers
    visibility flags        //   Hva skal vises/skjules
    beregnet resultat       //   Computed fra state
  },
  computed: {               // → BentoRespondFrist (read-only)
    prinsipaltResultat      //   For submit-disable + placeholder
    autoBegrunnelse         //   Generert fra alle kortvalg
    dynamicPlaceholder      //   Kontekstavhengig hint
    sendForesporsel         //   For info-alert
    godkjentDager           //   For utkast
  },
  buildEventData(params) {  // → BentoRespondFrist (submit)
    // Bygger komplett event-payload fra bridge-state + begrunnelse
  }
}
```

---

## Analyse per spor

### Grunnlag (implementert — ad-hoc)

**Kort:** CaseMasterCard. **Form:** BentoRespondGrunnlag.

| Kontroll | Plassering |
|----------|------------|
| Varslet i tide? (§32.2) | **I kort** (InlineYesNo ved datoene) |
| Resultat (Godkjent/Avslått/Frafalt) | **I kort** (VerdictCards under grunnlag) |
| Begrunnelse | I formpanel (RichTextEditor) |

Ingen bridge-hook — ad-hoc state i CasePageBento. Fungerer, men
inkonsistent med frist-mønsteret.

### Frist (implementert — bridge-hook)

**Kort:** FristCard. **Form:** BentoRespondFrist. **Bridge:** useFristBridge.

| Kontroll | Plassering | Seksjon i kort |
|----------|------------|----------------|
| Frist-varsel i tide? (§33.4) | **I kort** (InlineYesNo) | §33.4 Varsel |
| Spesifisert krav i tide? (§33.6.1) | **I kort** (InlineYesNo) | §33.6.1 Spesifisert krav |
| Forespørsel-svar i tide? (§33.6.2) | **I kort** (InlineYesNo) | §33.6.2 Svar på forespørsel |
| Send forespørsel? | **I kort** (InlineYesNo) | §33.4 Varsel (betinget) |
| Vilkår oppfylt? (§33.1) | **I kort** (InlineYesNo) | §33.1 Vilkår |
| Godkjent dager (§33.5) | **I kort** (InlineNumberInput) | §33.5 Beregning |
| Resultat + subsidiært | **I kort** (resultat-boks) | Resultat-seksjon |
| Begrunnelse | I formpanel | Auto-generert + manuell |

**Kortets struktur i edit-modus:** Kontrollene er organisert i visuelt
adskilte seksjoner med §-referanse-overskrifter og tooltip-info-ikoner.
Preklusion vises som inline-advarsel under den aktuelle seksjonen.
Subsidiær-badges vises per seksjon når relevant.

### Vederlag (ikke implementert)

Se implementeringsplan: `docs/plans/2026-02-15-card-anchored-vederlag-frist.md`

Vederlag er vesentlig mer komplekst: 3 underkrav (hoved, rigg, produktivitet),
metodevalg med betingelser, og beløps-beregninger. Frist-erfaringene tilsier:

- **Dedikert `useVederlagBridge`-hook** — ikke generisk bridge
- **Alle kontroller i kortet** — men med ekspanderbare underkrav-seksjoner
- **Resultat + subsidiært i kortet** — ikke i formpanelet
- **Auto-begrunnelse i formpanelet** — med `generateVederlagResponseBegrunnelse`

### TE-skjemaer (Send/Oppdater)

Mønsteret passer for BH-svar (vurdering av eksisterende data) og TE-oppdateringer
(revider). TE førstegangs-innsending forblir i TrackFormView — kortet er tomt,
så det er ingen kontekst å forankre kontrollene i.

---

## Delte primitiver

Disse komponentene ble ekstrahert for gjenbruk på tvers av spor:

| Komponent | Fil | Brukes i |
|-----------|-----|----------|
| `InlineYesNo` | `src/components/bento/InlineYesNo.tsx` | CaseMasterCard, FristCard |
| `InlineNumberInput` | `src/components/bento/InlineNumberInput.tsx` | FristCard |
| `VerdictCards` | `src/components/bento/VerdictCards.tsx` | CaseMasterCard |
| `getFristConsequence` | `src/components/bento/consequenceCallout.ts` | (tilgjengelig, brukes ikke i card-modus) |
| `getVederlagConsequence` | `src/components/bento/consequenceCallout.ts` | (tilgjengelig for vederlag) |

---

## Lærdom fra implementering

Disse problemene dukket opp under frist-implementeringen og bør unngås
ved vederlag-implementeringen.

### L1: Konsolidert FormState — unngå cascading setState

**Problem:** Individuelle `useState`-kall (ett per felt) ga ESLint-feil
for cascading setState når ett felt måtte nullstille et annet
(`fristVarselOk → false` skal også sette `sendForesporsel → false`).

**Løsning:** Samle alle felter i ett `FormState`-objekt med én
`setFormState`. Individuelle setters bruker `useCallback` med
funksjonell oppdatering:

```tsx
const [formState, setFormState] = useState<FormState>(getDefaults);

const handleFristVarselOkChange = useCallback((v: boolean) => {
  setFormState(prev => ({
    ...prev,
    fristVarselOk: v,
    ...(v === false ? { sendForesporsel: false } : {}),
  }));
}, []);
```

### L2: State-during-render for reset — ikke useEffect + useRef

**Problem:** Reset ved `isOpen`-endring med `useEffect` + `useRef(prevIsOpen)`
fungerte, men er unødvendig indirekte og gir en ekstra renderingssyklus.

**Løsning:** Bruk React-dokumentert "state during render"-mønster:

```tsx
const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
if (isOpen !== prevIsOpen) {
  setPrevIsOpen(isOpen);
  if (isOpen) {
    setFormState(getDefaults());
  }
}
```

### L3: Konsekvenser hører i kortet, ikke formpanelet

**Problem:** Første iterasjon la konsekvens-callout og §33.8
forsering-advarsel i formpanelet (per opprinnelig ADR-prinsipp #4).
Dette føltes frakoblet — brukeren så valgene i kortet men konsekvensen
langt borte i formpanelet.

**Løsning:** Flytt resultat, subsidiær-oppsummering og
preklusjons-advarsler til kortet. Formpanelet viser kun begrunnelse
og submit. Prinsipp #4 ble oppdatert.

### L4: Oppsummering ble for verbose — kompakt resultat-linje

**Problem:** Første iterasjon hadde en full «Oppsummering»-seksjon i
kortet med beskrivende tekst per §-paragraf (6 underavsnitt). Tok for
mye vertikal plass og gjentok det kontrollene allerede viste.

**Løsning:** Erstatt med kompakt resultat-linje:
`Resultat: Godkjent – 10 av 10 dager (100%)` + eventuelt
`↳ Subsidiært: ...`. Detaljene kommer i auto-begrunnelsen.

### L5: Auto-begrunnelse med manuell edit-tracking

**Problem:** Auto-generert begrunnelse skal oppdateres når kortets valg
endres, men ikke overskrive tekst brukeren har redigert manuelt.

**Løsning:** `useRef(userHasEdited)` settes til `true` ved første
manuelle redigering. Auto-begrunnelse oppdaterer kun når
`!userHasEdited`. «Regenerer fra valg»-knappen nullstiller flagget
og fyller inn på nytt:

```tsx
const userHasEditedRef = useRef(false);

useEffect(() => {
  if (autoBegrunnelse && !userHasEditedRef.current) {
    formSetValue('begrunnelse', autoBegrunnelse);
  }
}, [autoBegrunnelse]);

const handleRegenerer = () => {
  formSetValue('begrunnelse', autoBegrunnelse);
  userHasEditedRef.current = false;
};
```

### L6: editState-bag i stedet for mange props

**Problem:** FristCard trenger ~15 props for interaktiv modus (state,
handlers, visibility flags, computed values). Individuell prop-passing
er uoversiktlig og sprøtt.

**Løsning:** Saml alt i én `editState?: FristEditState | null`-prop.
Kortet sjekker `if (editState)` for å vise interaktive kontroller.
Null = read-only modus (ingen endring i eksisterende interface).

### L7: Seksjonerte kontroller med §-overskrifter

**Problem:** Alle InlineYesNo-toggles etter hverandre uten visuell
gruppering var vanskelig å skanne — spesielt med betingede felter.

**Løsning:** Grupper kontrollene i visuelt adskilte seksjoner med
§-referanse som overskrift og tooltip-info-ikon:

```
┌─ §33.4 Foreløpig varsel ℹ️ ───┐
│ Varslet i tide? [✓ Ja] [✕ Nei] │
│ ⚠️ PREKLUDERT                  │
└────────────────────────────────┘
┌─ §33.1 Vilkår ℹ️ ─────────────┐
│ Vilkår oppfylt? [✓ Ja] [✕ Nei]│
└────────────────────────────────┘
```

### L8: CSS grid order for aktiv kortposisjonering

**Problem:** Når frist-skjema åpnes bør FristCard+form vises øverst,
med de andre kortene under. Men HTML-rekkefølgen i bento-gridet er
fast.

**Løsning:** Bruk CSS `order`-property på grid-children for å
reposisjonere aktivt kort+form til toppen dynamisk.

### L9: Tester må flyttes sammen med kontrollene

**Problem:** Da konsekvens-callout, forsering-advarsel og subsidiær-
oppsummering ble flyttet fra BentoRespondFrist til FristCard, ble
tilhørende tester slettet fra `BentoRespondFrist.test.tsx` — men de
må gjenskapes i `FristCard.test.tsx`. Uten bevisst testmigrasjon
mister man testdekning uten å oppdage det.

**Løsning:** Behandle testflytting som et eget steg: for hver kontroll
som flyttes fra form til kort, flytt (eller skriv ny) tilhørende test
i samme commit. Sjekk at total testantall ikke synker.

### L10: Rydd opp foreldede props og imports i formpanelet

**Problem:** Etter at kontroller flyttes til kortet, ligger gamle
props (`visForsering`, `avslatteDager`) og imports (`getFristConsequence`,
`getResultatLabel`) igjen i formpanelet. TypeScript fanger ikke
ubrukte optional props, og ubrukte imports fanges bare av linter.

**Løsning:** Gjør en eksplisitt opprydding av formpanelets interface
og imports som siste steg etter at kontroller er flyttet:
1. Fjern props fra interface-definisjonen
2. Fjern tilhørende destructuring i komponentfunksjonen
3. Fjern ubrukte imports
4. Fjern tester som testet de fjernede prop-kombinasjonene

### L11: Bridge-hook skiller computed (readonly) fra state (read-write)

**Problem:** Det er fristende å sende hele bridge-state til begge
komponenter. Men da kan formpanelet ved et uhell kalle setters som
hører hjemme i kortet, og dataretningen blir uklar.

**Løsning:** Bridge-hooken returnerer to distinkte kontrakter:
- `cardProps` — rå state + setters + visibility flags (read-write)
- `computed` / `formProps` — beregnede verdier, readonly

Formpanelet mottar kun `computed.*`. Det skal aldri ha tilgang til
`handleFristVarselOkChange` eller lignende setters.
Se «Computed vs raw»-avsnittet under Implementert arkitektur.

### L12: Formpanelet skal ikke bygge event-payload eller auto-begrunnelse

**Problem:** Etter at kontroller flyttes til kortet, sitter formpanelet
igjen med 17+ individuelle props (`externalFristVarselOk`,
`externalGodkjentDager`, `erPrekludert`, ...) som det bruker til to
ting: (1) generere auto-begrunnelse, (2) bygge submit-payload. Begge
oppgavene bruker data som bridge-hooken allerede eier. Resultatet er
prop-eksplosjon i CasePageBento og at formpanelet leser `cardProps`-
verdier i strid med L11.

**Løsning:** Bridge-hooken eier auto-begrunnelse og payload-bygging:
- `computed.autoBegrunnelse` — generert i bridge fra alle valg
- `computed.dynamicPlaceholder` — kontekstavhengig placeholder
- `buildEventData({ fristKravId, begrunnelse })` — komplett event-data

Formpanelet mottar `computed` + `buildEventData` som to props.
Submit-handleren blir en one-liner:

```tsx
mutation.mutate({
  eventType: 'respons_frist',
  data: buildEventData({ fristKravId, begrunnelse: data.begrunnelse }),
});
```

**Resultat:** Props redusert fra 26 til 9. Formpanelet er en ren
begrunnelse-editor + submit-surface uten domenekunnskap.

---

## Konsekvenser

### Positive

- **Bedre kontekstuell forståelse.** Brukeren ser dataen de vurderer
  rett ved siden av valgkontrollen.
- **Mer plass til primæroppgaven.** Tekstredaktøren bruker hele
  col-7 uten å konkurrere med radioknapper.
- **Ingen duplisering.** Kontekst vises én gang, i kortet.
- **Naturlig progressiv avsløring.** Kortet transformeres gradvis
  fra read-only til interaktivt.
- **Auto-begrunnelse.** Reduserer skrivearbeid for BH — valg genererer
  en startbegrunnelse som kan tilpasses.

### Negative / risiko

- **Økt kompleksitet i kort-komponenter.** Kortene må håndtere
  dual-mode (read-only + interaktiv).
- **State-koordinering.** Bridge-hooks og konsolidert state krever
  disiplin — se L1-L2 for fallgruver.
- **Overbelastning.** Risiko for at kort med mange inline-kontroller
  (spesielt vederlag) blir uoversiktlige — mitiger med seksjonering (L7)
  og ekspanderbare underkrav-seksjoner.

### Avbøtende tiltak

- Start med enkle spor (grunnlag: 2 kontroller) før komplekse
  (vederlag: 9+ kontroller). ✅ Gjort.
- Bruk ekspanderbare seksjoner i kortet for å håndtere kompleksitet.
- Seksjonerte kontroller med §-overskrifter (L7) for skanbarhet.
- Konsolidert FormState (L1) for å unngå cascading-problemer.
- Auto-begrunnelse (L5) for å gi verdi tilbake til brukeren.

---

## Sjekkliste for neste spor (vederlag)

Basert på lærdom fra frist-implementeringen:

- [ ] Opprett `useVederlagBridge`-hook med konsolidert `FormState` (L1)
- [ ] Bruk state-during-render for reset (L2), ikke useEffect+useRef
- [ ] All resultat/konsekvens-logikk i kortet (L3), ikke formpanelet
- [ ] Kompakt resultat-linje i kortet (L4), detaljert tekst i auto-begrunnelse
- [ ] Auto-begrunnelse med `userHasEditedRef` og «Regenerer»-knapp (L5)
- [ ] `editState?: VederlagEditState | null`-prop til VederlagCard (L6)
- [ ] Seksjonerte kontroller med §-overskrifter per underkrav (L7)
- [ ] CSS grid order for aktiv kort-posisjonering (L8)
- [ ] Ekspanderbare rigg/produktivitet-seksjoner for å håndtere tetthet
- [ ] Flytt tester fra RespondVederlagModal.test → VederlagCard.test for flyttede kontroller (L9)
- [ ] Rydd opp foreldede props/imports i BentoRespondVederlag etter flytting (L10)
- [ ] `computed` til formpanel er readonly — ingen setters lekker (L11)
- [ ] Auto-begrunnelse + `buildEventData` i bridge, ikke i formpanelet (L12)
- [ ] Formpanel tar `computed` + `buildEventData` som props — ikke 17 individuelle
- [ ] Test at klassiske modaler (RespondVederlagModal) fremdeles fungerer

---

## Referanser

### Implementerte filer

| Fil | Rolle |
|-----|-------|
| `src/hooks/useFristBridge.ts` | Bridge-hook for frist (referanseimplementering) |
| `src/components/bento/BentoRespondFrist.tsx` | Formpanel for frist |
| `src/components/bento/track-cards/FristCard.tsx` | Kort med interaktiv modus |
| `src/components/bento/InlineYesNo.tsx` | Delt ja/nei-toggle |
| `src/components/bento/InlineNumberInput.tsx` | Delt tall-input |
| `src/components/bento/CaseMasterCard.tsx` | Kort for grunnlag (ad-hoc interaktiv) |
| `src/components/bento/BentoRespondGrunnlag.tsx` | Formpanel for grunnlag |
| `src/components/bento/VerdictCards.tsx` | Delt verdikt-komponent |
| `src/components/bento/consequenceCallout.ts` | Konsekvens-logikk (tilgjengelig) |
| `src/pages/CasePageBento.tsx` | Koordinering og layout |

### Relaterte dokumenter

- Implementeringsplan: `docs/plans/2026-02-15-card-anchored-vederlag-frist.md`
- Bento-design: `docs/plans/2026-02-13-bento-casepage-design.md`
