# ADR-003: Card-Anchored Contextual Editing

**Status:** Akseptert — Alle tre spor implementert (Grunnlag, Frist, Vederlag), domenelag-ekstraksjon planlagt
**Dato:** 2026-02-14 (opprinnelig), 2026-02-15 (refaktorert + domenelag-beslutning), 2026-02-16 (vederlag implementert)
**Beslutningstagere:** Utviklingsteam
**Kontekst:** UX-mønster for inline skjemaer i bento-layout

---

## Sammendrag

Når bruker åpner et svarskjema i bento-layouten, flyttes valgkontroller
(resultat, toggles, metodevalg) inn i det tilhørende kortet der konteksten
allerede vises. Formpanelet reserveres utelukkende for skriving av begrunnelse.
Alt annet — kontroller, kontekst-alerts, resultat, innsending og avslutning —
lever i kortet. Bridge-hooken eier all form-state inkludert begrunnelse,
submit-mutasjon og form backup.

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
2. **Kortet eier hele flyten** — kontroller, kontekst-alerts, resultat,
   preklusjons-advarsler, innsending (nederst) og avslutning (øverst).
3. **Formpanelet er en ren skriveflade** — kun RichTextEditor for begrunnelse
   med «Regenerer fra valg»-knapp. Ingen kontroller, ingen submit, ingen alerts.
4. **Bridge-hooken eier all state** — inkludert begrunnelse, submit-mutasjon
   (`useSubmitEvent`), form backup (`useFormBackup`) og token-håndtering.

```
Desktop: Form venstre (col-7), Kort høyre (col-5, self-start)
Mobil:   Kort øverst (col-12), Form under (col-12)

┌────────────────────────────────┐  ┌─────────────────────────┐
│  FORMPANEL (col-7, order-1)    │  │  FRISTCARD (col-5,      │
│                                │  │  order-2, self-start)   │
│  ┌────────────────────────┐   │  │  Fristforlengelse  [✕]  │
│  │                        │   │  │                         │
│  │  Byggherrens            │   │  │  Krevd dager: 10d       │
│  │  begrunnelse            │   │  │  Varslet     13.feb     │
│  │                        │   │  │  Spesifisert 20.feb     │
│  │  [Auto-generert tekst] │   │  │                         │
│  │                        │   │  │ ┌─ §33.4 Varsel ──────┐│
│  │  [Rik tekst-editor]    │   │  │ │ Varslet i tide?      ││
│  │                        │   │  │ │ [✓ Ja] [✕ Nei]      ││
│  └────────────────────────┘   │  │ └──────────────────────┘│
│  [Regenerer fra valg]         │  │ ┌─ §33.1 Vilkår ──────┐│
│                                │  │ │ Vilkår oppfylt?      ││
│                                │  │ │ [✓ Ja] [✕ Nei]      ││
│                                │  │ └──────────────────────┘│
│                                │  │ ┌─ §33.5 Beregning ───┐│
│                                │  │ │ Godkjent: [__10_] d  ││
│                                │  │ └──────────────────────┘│
│                                │  │                         │
│                                │  │ ┌ Resultat ────────────┐│
│                                │  │ │ Godkjent – 10/10d    ││
│                                │  │ │ ↳ Subsidiært: ...    ││
│                                │  │ └──────────────────────┘│
│                                │  │                         │
│                                │  │  ─────────────────────  │
│                                │  │  [Lagre utkast] [Send]  │
└────────────────────────────────┘  └─────────────────────────┘
```

### Prinsipper

| # | Prinsipp | Forklaring |
|---|----------|------------|
| 1 | **Kontroller hører der konteksten er** | "Varslet i tide?" ved datoene. Verdiktkort ved grunnlaget. Metodevalg ved krevd beløp. |
| 2 | **Begrunnelse-feltet er kun det — fullt fokus på skriving** | Formpanelet er en ren skriveflade. Ingen kontroller, alerts, submit eller avbryt. |
| 3 | **Kortet eier hele beslutningsflyten** | Kontroller, kontekst-alerts, resultat, innsending (nederst) og avslutning (øverst). Brukeren kan lukke umiddelbart uten å scrolle. |
| 4 | **Bridge-hooken eier all state** | Begrunnelse, submit-mutasjon, form backup, token-håndtering og auto-begrunnelse — alt i bridge-hooken. Ingen domenekunnskap i form- eller kort-komponenter. |
| 5 | **Auto-begrunnelse i formpanelet** | Begrunnelse auto-genereres fra kortets valg og fylles inn i editoren. Brukeren kan redigere fritt, eller klikke «Regenerer fra valg» for å oppdatere. |
| 6 | **Dedikert bridge-hook per spor** | Hvert spor har en egen hook (`useGrunnlagBridge`, `useFristBridge`, `useVederlagBridge`) med domene-spesifikk logikk — ikke en generisk bridge. |

> **Endringshistorikk:**
> - Prinsipp 4 sa opprinnelig "Konsekvenser vises i formpanelet" → endret til
>   "Resultat og konsekvenser i kortet" etter implementering.
> - Deretter refaktorert: bridge eier nå begrunnelse + submit + form backup.
>   Formpanelet ble strippet til en ren RichTextEditor. Kortet fikk lukk øverst
>   og send nederst. Prinsippene 2–4 oppdatert tilsvarende.

---

## Implementert arkitektur

### Tre lag: Domene → Bridge → Komponent

Arkitekturen har tre lag. Domenelogikk (NS 8407-regler) er ren
TypeScript uten React-avhengigheter. Bridge-hooken er en tynn
React-adapter som kobler domenelogikk til state, mutation og feedback.
Komponentene er rene renderere.

```
┌──────────────────────────────────────────────────────────┐
│  src/domain/                                             │
│  Ren TypeScript — ingen React-avhengigheter              │
│                                                          │
│  fristDomain.ts                grunnlagDomain.ts         │
│  ├── beregnPreklusjon()        ├── erEndringMed32_2()    │
│  ├── beregnReduksjon()         ├── erPrekludert()        │
│  ├── beregnResultat()          ├── beregnPassivitet()    │
│  ├── beregnSubsidiaert()       ├── getVerdictOptions()   │
│  ├── beregnVisibility()        ├── beregnConsequence()   │
│  ├── beregnSubsidiaerTriggers()├── buildEventData()      │
│  └── buildEventData()          └── getDefaults()         │
│                                                          │
│  Testbar med vanlige unit-tester — ingen wrappers.       │
└────────────────────┬─────────────────────────────────────┘
                     │ importeres av
┌────────────────────▼─────────────────────────────────────┐
│  src/hooks/use[Spor]Bridge.ts                            │
│  Tynn React-adapter (~200 linjer)                        │
│                                                          │
│  ├── useState(FormState)        // UI-state              │
│  ├── domain.beregnResultat()    // kaller domene         │
│  ├── domain.beregnVisibility()  // kaller domene         │
│  ├── useSubmitEvent()           // React Query mutation   │
│  ├── useFormBackup()            // localStorage           │
│  ├── useToast()                 // feedback               │
│  └── returns { cardProps, editorProps }                   │
└────────────────────┬─────────────────────────────────────┘
                     │ props
┌────────────────────▼─────────────────────────────────────┐
│  Komponenter (rene renderere)                            │
│                                                          │
│  [Spor]Card(cardProps)          BentoRespond[Spor]       │
│  ├── [✕] Lukk (øverst)         (editorProps)             │
│  ├── Kontroller                 ├── RichTextEditor       │
│  ├── Alerts                     └── «Regenerer»-knapp    │
│  ├── Resultat                                            │
│  └── [Send] (nederst)                                    │
└──────────────────────────────────────────────────────────┘
```

**Eksisterende filer som allerede følger dette mønsteret:**
- `src/utils/begrunnelseGenerator.ts` (1 453 linjer, 0 React) — ren domenelogikk
- `src/components/bento/consequenceCallout.ts` (197 linjer, 0 React) — ren domenelogikk

**Nøkkel-kontrakter:**

| Komponent | Mottar fra bridge | Ansvar |
|-----------|-------------------|--------|
| **Kortet** | `cardProps: [Spor]EditState` — state + setters + visibility + resultat + onSubmit/onClose | Hele beslutningsflyten: kontroller, alerts, resultat, submit |
| **Formpanelet** | `editorProps: [Spor]EditorProps` — begrunnelse + onChange + error + placeholder | Kun skriving av begrunnelse |
| **CasePageBento** | Eier bridge, passer `cardProps` til kort og `editorProps` til formpanel | Layout, expand/collapse, action-routing |

**cardProps vs editorProps — tydelig ansvarsgrense:**

Bridge-hooken returnerer to distinkte kontrakter. Formpanelet mottar
kun `editorProps` — ingen setters, ingen submit, ingen domenelogikk:

```
use[Spor]Bridge returns {
  cardProps: {              // → Kortet (read-write + actions)
    state + setters         //   Rå FormState + onChange-handlers
    visibility flags        //   Hva skal vises/skjules
    beregnet resultat       //   Computed fra state
    onSubmit, onClose       //   Submit-mutasjon + lukk
    isSubmitting, canSubmit //   Submit-tilstand
    submitError, showToken  //   Feilhåndtering
    kontekst-alerts         //   Passivitet, snuoperasjon, etc.
  },
  editorProps: {            // → Formpanelet (ren skriveflade)
    begrunnelse             //   Teksten
    onBegrunnelseChange     //   Eneste setter
    begrunnelseError        //   Valideringsfeil
    placeholder             //   Kontekstavhengig hint
    autoBegrunnelse         //   For «Regenerer fra valg»
    onRegenerate            //   Nullstill begrunnelse
    showRegenerate          //   Vis knappen?
  }
}
```

---

## Analyse per spor

### Grunnlag (implementert — bridge-hook)

**Kort:** CaseMasterCard. **Form:** BentoRespondGrunnlag. **Bridge:** useGrunnlagBridge.

| Kontroll | Plassering | I kortet |
|----------|------------|----------|
| Varslet i tide? (§32.2) | **I kort** (InlineYesNo ved datoene) | §32.2 Varsling |
| Resultat (Godkjent/Avslått/Frafalt) | **I kort** (VerdictCards) | Resultat-seksjon |
| Konsekvens-callout | **I kort** | Under resultat |
| Passivitets-advarsel (§32.3) | **I kort** | Kontekst-alert |
| Snuoperasjon-advarsel | **I kort** | Kontekst-alert |
| TokenExpiredAlert | **I kort** | Feilhåndtering |
| Lukk-knapp [✕] | **I kort** (øverst) | Header |
| Send svar / Lagre utkast | **I kort** (nederst) | Submit footer |
| Begrunnelse | I formpanel (RichTextEditor) | — |

### Frist (implementert — bridge-hook)

**Kort:** FristCard. **Form:** BentoRespondFrist. **Bridge:** useFristBridge.

| Kontroll | Plassering | Seksjon i kort |
|----------|------------|----------------|
| Lukk-knapp [✕] | **I kort** (øverst) | Header |
| Frist-varsel i tide? (§33.4) | **I kort** (InlineYesNo) | §33.4 Varsel |
| Spesifisert krav i tide? (§33.6.1) | **I kort** (InlineYesNo) | §33.6.1 Spesifisert krav |
| Forespørsel-svar i tide? (§33.6.2) | **I kort** (InlineYesNo) | §33.6.2 Svar på forespørsel |
| Send forespørsel? | **I kort** (InlineYesNo) | §33.4 Varsel (betinget) |
| Vilkår oppfylt? (§33.1) | **I kort** (InlineYesNo) | §33.1 Vilkår |
| Godkjent dager (§33.5) | **I kort** (InlineNumberInput) | §33.5 Beregning |
| Resultat + subsidiært | **I kort** (resultat-boks) | Resultat-seksjon |
| Forespørsel-info alert | **I kort** | Kontekst-alert |
| TokenExpiredAlert | **I kort** | Feilhåndtering |
| Send svar / Lagre utkast | **I kort** (nederst) | Submit footer |
| Begrunnelse | I formpanel (RichTextEditor) | — |

**Kortets struktur i edit-modus:** Kontrollene er organisert i visuelt
adskilte seksjoner med §-referanse-overskrifter og tooltip-info-ikoner.
Preklusion vises som inline-advarsel under den aktuelle seksjonen.
Subsidiær-badges vises per seksjon når relevant. Lukk-knapp øverst
lar brukeren avbryte uten å scrolle. Submit nederst etter resultat.

### Vederlag (implementert — bridge-hook)

**Kort:** VederlagCard. **Form:** BentoRespondVederlag. **Bridge:** useVederlagBridge.

Vederlag er mer komplekst enn frist: 3 underkrav (hoved, rigg, produktivitet),
metodevalg med betingelser, og beløps-beregninger. Collapsible seksjoner viste
seg å ikke være nødvendig — kortets seksjonering med §-overskrifter (L7) gir
tilstrekkelig visuell struktur.

| Kontroll | Plassering | Seksjon i kort |
|----------|------------|----------------|
| Lukk-knapp [✕] | **I kort** (øverst) | Header |
| Metodevalg (§34) | **I kort** | Metode-seksjon |
| Godkjent beløp hovedkrav | **I kort** (InlineNumberInput) | Hovedkrav |
| Justert EP-sats (§26.3.2) | **I kort** (InlineYesNo) | Hovedkrav (betinget) |
| Rigg & drift godkjent beløp | **I kort** (InlineNumberInput) | Rigg & drift |
| Produktivitetstap godkjent beløp | **I kort** (InlineNumberInput) | Produktivitetstap |
| Resultat + subsidiært | **I kort** (resultat-boks) | Resultat-seksjon |
| TokenExpiredAlert | **I kort** | Feilhåndtering |
| Send svar / Lagre utkast | **I kort** (nederst) | Submit footer |
| Begrunnelse | I formpanel (RichTextEditor) | — |

### TE-skjemaer (Send/Oppdater)

Mønsteret passer for BH-svar (vurdering av eksisterende data) og TE-oppdateringer
(revider). TE førstegangs-innsending forblir i TrackFormView — kortet er tomt,
så det er ingen kontekst å forankre kontrollene i.

---

## Delte primitiver

Disse komponentene ble ekstrahert for gjenbruk på tvers av spor:

| Komponent | Fil | Brukes i |
|-----------|-----|----------|
| `InlineYesNo` | `src/components/bento/InlineYesNo.tsx` | CaseMasterCard, FristCard, VederlagCard |
| `InlineNumberInput` | `src/components/bento/InlineNumberInput.tsx` | FristCard, VederlagCard |
| `VerdictCards` | `src/components/bento/VerdictCards.tsx` | CaseMasterCard |
| `getFristConsequence` | `src/components/bento/consequenceCallout.ts` | (tilgjengelig, brukes ikke i card-modus) |
| `getVederlagConsequence` | `src/components/bento/consequenceCallout.ts` | (tilgjengelig, brukes ikke i card-modus) |

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

### L8: CSS grid order for layout — kort høyre, form venstre

**Problem:** På desktop skal kortet alltid ligge på høyre side (der det
normalt er i bento-gridet), med begrunnelsesskjema til venstre. Men
for korrekt mobil-stacking (L15) må kortet rendres FØR formen i DOM.

**Løsning:** Bruk CSS `order` og `self-start` på grid-children:

```html
<!-- DOM-rekkefølge: kort først (mobil-vennlig) -->
<div class="col-span-12 md:col-span-5 md:order-2 md:self-start">
  <!-- Kort: høyre på desktop, øverst på mobil -->
</div>
<div class="col-span-12 md:col-span-7 md:order-1">
  <!-- Form: venstre på desktop, under kort på mobil -->
</div>
```

- `md:order-2` på kortet → høyre kolonne på desktop
- `md:order-1` på formen → venstre kolonne på desktop
- `md:self-start` på kortet → holder seg øverst uavhengig av formhøyde
- Uten `md:`-prefix: naturlig DOM-rekkefølge = kort øverst på mobil

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

### L11: Bridge-hook skiller cardProps (read-write) fra editorProps (minimal)

**Problem:** Det er fristende å sende hele bridge-state til begge
komponenter. Men da kan formpanelet ved et uhell kalle setters som
hører hjemme i kortet, og dataretningen blir uklar.

**Løsning:** Bridge-hooken returnerer to distinkte kontrakter:
- `cardProps` — rå state + setters + visibility flags + submit + close
- `editorProps` — kun begrunnelse + onChange + error + placeholder

Formpanelet mottar kun `editorProps`. Det har ingen tilgang til
kontroll-setters, submit-mutasjon eller domenelogikk.

### L12: Bridge-hooken eier submit, begrunnelse og form backup

**Problem:** I den opprinnelige arkitekturen bygde formpanelet
event-payload fra 17+ props og kalte submit-mutasjonen selv. Dette
ga prop-eksplosjon i CasePageBento og at formpanelet måtte ha
domenekunnskap om event-strukturen.

**Løsning:** Bridge-hooken eier hele flyten internt:
- `useSubmitEvent` — React Query mutation i bridge
- `useFormBackup` — localStorage-backup i bridge
- `useToast` — feedback i bridge
- `buildEventData()` — internt, aldri eksponert
- `handleSubmit()` — validerer begrunnelse → bygger payload → muterer

Formpanelet blir en 60-linjers ren RichTextEditor-komponent. Kortet
kaller `cardProps.onSubmit()` som en one-liner.

### L13: Test-wrappers for bridge-hooks med React Query + Context

**Problem:** Når bridge-hooken kaller `useSubmitEvent()` og `useToast()`
internt, trenger tester `QueryClientProvider` + `ToastProvider` wrappers.

**Løsning:** Opprett en `createWrapper()` helper i testfilen:

```tsx
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }) => (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
}

// Bruk: renderHook(() => useFristBridge(config), { wrapper: createWrapper() })
```

Dette er standard React-testpraksis for hooks som bruker kontekst.
Ny `QueryClient` per test forhindrer state-lekkasje mellom tester.

### L14: Skille domenelogikk fra React-hooks — «god hook»-problemet

**Problem:** Bridge-hookene blander fire distinkte ansvarsområder i
én funksjon: NS 8407 forretningsregler, React state management,
infrastruktur (mutation, toast, backup) og presentasjonslogikk
(placeholder, labels). ~120–200 linjer ren domenelogikk er innkapslet
i `useMemo`/`useCallback` og kan kun testes via `renderHook` med
provider-wrappers.

| Ansvar | Eksempel | Endres når... |
|--------|----------|---------------|
| NS 8407 regler | Preklusjon, subsidiært, resultatberegning | Kontraktstolkning endres |
| React state | `useState`, `useCallback`, reset-logikk | React-patterns endres |
| Infrastruktur | `useSubmitEvent`, `useFormBackup`, `useToast` | API/libs endres |
| Presentasjon | Visibility flags, dynamicPlaceholder | UX endres |

**Løsning:** Trekk ut ren domenelogikk til `src/domain/[spor]Domain.ts`:

```ts
// src/domain/fristDomain.ts — ren TypeScript, ingen React

export interface FristFormState {
  fristVarselOk: boolean;
  spesifisertKravOk: boolean;
  vilkarOppfylt: boolean;
  sendForesporsel: boolean;
  godkjentDager: number;
  // ...
}

export function beregnPreklusjon(state: FristFormState, config: FristConfig): boolean {
  if (config.erSvarPaForesporsel && !state.foresporselSvarOk) return true;
  if (config.varselType === 'varsel') return !state.fristVarselOk;
  // ...
}

export function beregnResultat(state: FristFormState, config: FristConfig): FristBeregningResultat {
  // Ren forretningslogikk — ingen useMemo, ingen React
}

export function beregnVisibility(config: FristConfig): FristVisibilityFlags {
  // Hva skal vises basert på varselType, tilstand, etc.
}

export function buildEventData(state: FristFormState, config: FristConfig): Record<string, unknown> {
  // Komplett event-payload — ingen useCallback
}
```

Bridge-hooken blir da en tynn adapter:

```ts
// useFristBridge.ts — ~200 linjer
import * as fristDomain from '../domain/fristDomain';

export function useFristBridge(config) {
  const [formState, setFormState] = useState(fristDomain.getDefaults(config));
  const resultat = fristDomain.beregnResultat(formState, config);
  const visibility = fristDomain.beregnVisibility(config);
  // ... useSubmitEvent, useFormBackup, useToast ...
}
```

**Gevinst:**
- NS 8407-regler testbare med vanlige unit-tester (ingen wrappers)
- Domenet synlig i én fil — lesbart for jurister og nye utviklere
- Bridge-hooks halveres i størrelse (~500 → ~200 linjer)
- Vederlag skalerer: `vederlagDomain.ts` kan ha 300+ linjer uten
  at bridge-hooken vokser tilsvarende

### L15: Mobil-layout — kort øverst, begrunnelse under, auto-scroll

**Problem:** På desktop vises kort og formpanel side om side (col-5 + col-7).
På mobil stables de vertikalt (col-span-12). Rekkefølgen må være riktig:
brukeren trenger kontekst og valgkontrollene (kortet) først, deretter
begrunnelsesskjemaet.

**Løsning:**
- Kortet rendres **først i DOM** → naturlig top→bottom på mobil.
- `md:order-2` på kort + `md:order-1` på form → kort til høyre på desktop (L8).
- Når edit-modus åpnes: **auto-scroll til toppen** av kortet med
  `scrollIntoView({ behavior: 'smooth', block: 'start' })` via ref per spor.
- Formpanelets padding matcher kortet på mobil (`p-3 md:p-4` vs kortets `p-3`)
  for visuell konsistens på smale skjermer.

**Verifiser:** Alle card-anchored layouts (grunnlag, frist, vederlag) må
ha kortet først i DOM-rekkefølgen, `md:order-*` for desktop-plassering,
og utløse scroll-to-top ved åpning.

### L16: Knapper må følge bento-designsystemets mønster konsistent

**Problem:** Send- og Lagre-knapper i card-anchored modus kan lett
avvike fra det etablerte knappemønsteret i bento-layouten.

**Løsning:** Alle knapper i card-anchored edit-modus MÅ bruke det
samme mønsteret som eksisterende kort:

| Knapp | Variant | Size | Eksempel |
|-------|---------|------|----------|
| Send / primærhandling | `variant="primary"` | `size="sm"` | `<Button variant="primary" size="sm">` |
| Lagre utkast | `variant="secondary"` | `size="sm"` | `<Button variant="secondary" size="sm">` |
| Avbryt (om brukt) | `variant="ghost"` | `size="sm"` | `<Button variant="ghost" size="sm">` |

Footer-layout: `flex-col-reverse sm:flex-row sm:justify-between gap-2`
med `border-t border-pkt-border-subtle pt-3`.

**Ikke bruk:** `size="md"` eller `size="lg"` i kort-kontekst.
Modale skjemaer (som RespondVederlagModal) bruker `size="md"` og
`border-t-2 pt-6` — dette er et annet mønster som gjelder der.

### L17: Domene-tester før bridge-tester

**Problem:** Når domenelogikk lever i hooks, testes forretningsregler
og React-wiring i samme test-suite. Når en domeneregel feiler, er det
uklart om feilen er i regelen eller i React-integrasjonen.

**Løsning:** To test-nivåer:

```
src/domain/__tests__/fristDomain.test.ts     ← rene unit-tester
  beregnPreklusjon({ varselType: 'varsel', fristVarselOk: false }) → true
  beregnResultat({ erPrekludert: true }) → 'avslatt'
  buildEventData({ ... }) → { frist_krav_id: ..., resultat: ... }

src/hooks/__tests__/useFristBridge.test.ts    ← integrasjonstester
  renderHook + wrapper → tester at state-endring → riktig cardProps
  tester reset-ved-isOpen, backup-restore, submit-flow
```

Domene-testene er raske, krever ingen providers, og dokumenterer
NS 8407-reglene eksplisitt. Bridge-testene fokuserer på React-wiring.

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
  (spesielt vederlag) blir uoversiktlige — mitigert med seksjonering (L7).
  Ekspanderbare seksjoner viste seg å ikke være nødvendig.

### Avbøtende tiltak

- Start med enkle spor (grunnlag: 2 kontroller) før komplekse
  (vederlag: 9+ kontroller). ✅ Alle tre spor implementert.
- Seksjonerte kontroller med §-overskrifter (L7) for skanbarhet — tilstrekkelig
  uten ekspanderbare seksjoner, selv for vederlag.
- Konsolidert FormState (L1) for å unngå cascading-problemer.
- Auto-begrunnelse (L5) for å gi verdi tilbake til brukeren.

---

## Vurderte alternativer

### Forkastet: Splitte fristkortet i varsel-kort (§33.4) + krav-kort (§33.6.1)

**Hypotese:** Fristkortet har 6 kontroller — for mye for ett kort.
Splitting i to kort (ett per paragrafområde) ville gi 2–3 kontroller
per kort og enklere bridge-hooks.

**Avvist fordi:**

1. **Kausal kobling.** Varselvurderingen (§33.4) bestemmer direkte om
   kravet er prekludert, redusert (§33.6.1) eller om forespørsel
   kreves (§33.6.2). To kort = to separate interaksjoner der BH mister
   årsak→virkning-feedbacken som gjør bento-mønsteret verdifullt.
2. **Subsidiært standpunkt krysser begge kort.** Subsidiær-badge på
   sporet gjelder hele frist-vurderingen. Splitting gjør det uklart
   hvilket kort som eier det subsidiære standpunktet.
3. **BH tenker i spor, ikke paragrafer.** Én samlet frist-vurdering
   matcher brukerens mentale modell bedre enn to oppstykket steg.
4. **Auto-begrunnelse trenger data fra begge.** Bridge-hooken måtte
   likevel koordinere state mellom to kort, og gevinsten i enklere
   per-hook forsvinner.

**Kompleksitetsmåling bekrefter dette:** Bento-tilnærmingen (bridge +
formpanel + kort) har 1 101 linjer vs modalens 1 926 (-43%), med
tilnærmet likt antall hooks (31 vs 29). Kompleksiteten er ikke høyere —
den er distribuert på tre filer med tydelige ansvarsområder.

**Riktig granulering er sporet, ikke paragrafen.**

---

## Sjekkliste for vederlag-implementering

Basert på lærdom fra grunnlag- og frist-implementeringen:

**Domenelag (L14):**
- [ ] Opprett `src/domain/vederlagDomain.ts` med ren NS 8407-logikk
- [ ] Skriv `src/domain/__tests__/vederlagDomain.test.ts` først (L17)
- [ ] Resultatberegning, visibility, event-data som rene funksjoner

**Bridge-hook:**
- [x] Opprett `useVederlagBridge`-hook som tynn adapter over domenelag
- [x] Bridge eier `useSubmitEvent`, `useFormBackup`, `useToast` internt (L12)
- [x] Konsolidert `FormState` inkl. begrunnelse (L1, L12)
- [x] State-during-render for reset (L2), ikke useEffect+useRef
- [x] Auto-begrunnelse med `userHasEditedRef` og «Regenerer»-knapp (L5)

**Kort (VederlagCard):**
- [x] `editState?: VederlagEditState | null`-prop (L6)
- [x] Lukk-knapp [✕] øverst, Send/Lagre nederst (prinsipp 3)
- [x] All resultat/konsekvens-logikk i kortet (L3), ikke formpanelet
- [x] Kompakt resultat-linje (L4), detaljert tekst i auto-begrunnelse
- [x] Seksjonerte kontroller med §-overskrifter per underkrav (L7)
- [x] CSS grid order: kort høyre (md:order-2 + md:self-start), form venstre (md:order-1) (L8)
- [x] Knapper følger bento-mønster: `variant="primary"/"secondary" size="sm"` (L16)

> **Observasjon:** Ekspanderbare/collapsible underkrav-seksjoner viste seg
> å ikke være nødvendig. Seksjonering med §-overskrifter (L7) gir
> tilstrekkelig visuell struktur uten ekstra interaksjonskompleksitet.

**Mobil-layout:**
- [x] Kort rendres FØR formpanel i DOM → stables korrekt på mobil (L15)
- [x] Auto-scroll til toppen av kortet når edit-modus åpnes (L15)
- [x] Begrunnelsesskjema legger seg under kortet på mobil (L15)
- [x] Formpanel-padding matcher kort-padding på mobil: `p-3 md:p-4` (L15)

**Formpanel + tester:**
- [x] Formpanelet tar kun `editorProps` — ingen setters/submit/domene (L11)
- [ ] Flytt tester fra RespondVederlagModal.test → VederlagCard.test (L9)
- [x] Rydd opp foreldede props/imports i BentoRespondVederlag (L10)
- [ ] Opprett `createWrapper()` i bridge-testfil (L13)
- [ ] Test at klassiske modaler (RespondVederlagModal) fremdeles fungerer

---

## Referanser

### Implementerte filer

| Fil | Rolle | Lag |
|-----|-------|----|
| `src/domain/fristDomain.ts` | NS 8407 frist-regler | Domene |
| `src/domain/grunnlagDomain.ts` | NS 8407 grunnlag-regler (planlagt) | Domene |
| `src/utils/begrunnelseGenerator.ts` | Auto-begrunnelse (allerede ren) | Domene |
| `src/components/bento/consequenceCallout.ts` | Konsekvens-logikk (allerede ren) | Domene |
| `src/hooks/useGrunnlagBridge.ts` | Bridge-hook for grunnlag | Bridge |
| `src/hooks/useFristBridge.ts` | Bridge-hook for frist | Bridge |
| `src/hooks/useVederlagBridge.ts` | Bridge-hook for vederlag | Bridge |
| `src/components/bento/CaseMasterCard.tsx` | Kort for grunnlag (kontroller + submit + lukk) | Komponent |
| `src/components/bento/track-cards/FristCard.tsx` | Kort for frist (kontroller + submit + lukk) | Komponent |
| `src/components/bento/track-cards/VederlagCard.tsx` | Kort for vederlag (kontroller + submit + lukk) | Komponent |
| `src/components/bento/BentoRespondGrunnlag.tsx` | Ren begrunnelse-editor for grunnlag (~60 linjer) | Komponent |
| `src/components/bento/BentoRespondFrist.tsx` | Ren begrunnelse-editor for frist (~60 linjer) | Komponent |
| `src/components/bento/BentoRespondVederlag.tsx` | Ren begrunnelse-editor for vederlag (~60 linjer) | Komponent |
| `src/pages/CasePageBento.tsx` | Koordinering og layout | Komponent |

### Relaterte dokumenter

- Implementeringsplan: `docs/plans/2026-02-15-card-anchored-vederlag-frist.md`
- Bento-design: `docs/plans/2026-02-13-bento-casepage-design.md`
