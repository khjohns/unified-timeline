# ADR-003: Card-Anchored Contextual Editing

**Status:** Akseptert — Grunnlag og Frist implementert (PR #439, refaktorert)
**Dato:** 2026-02-14 (opprinnelig), 2026-02-15 (refaktorert: bridge eier begrunnelse + submit)
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
┌─────────────────────────┐  ┌────────────────────────────────┐
│  FRISTCARD (col-5)      │  │  FORMPANEL (col-7)             │
│  Fristforlengelse  [✕]  │  │                                │
│                         │  │  ┌────────────────────────┐   │
│  Krevd dager: 10d       │  │  │                        │   │
│  Varslet     13.feb     │  │  │  Byggherrens            │   │
│  Spesifisert 20.feb     │  │  │  begrunnelse            │   │
│                         │  │  │                        │   │
│ ┌─ §33.4 Varsel ──────┐│  │  │  [Auto-generert tekst] │   │
│ │ Varslet i tide?      ││  │  │                        │   │
│ │ [✓ Ja] [✕ Nei]      ││  │  │  [Rik tekst-editor]    │   │
│ └──────────────────────┘│  │  │                        │   │
│ ┌─ §33.1 Vilkår ──────┐│  │  └────────────────────────┘   │
│ │ Vilkår oppfylt?      ││  │  [Regenerer fra valg]         │
│ │ [✓ Ja] [✕ Nei]      ││  │                                │
│ └──────────────────────┘│  │                                │
│ ┌─ §33.5 Beregning ───┐│  │                                │
│ │ Godkjent: [__10_] d  ││  │                                │
│ └──────────────────────┘│  │                                │
│                         │  │                                │
│ ┌ Resultat ────────────┐│  │                                │
│ │ Godkjent – 10/10d    ││  │                                │
│ │ ↳ Subsidiært: ...    ││  │                                │
│ └──────────────────────┘│  │                                │
│                         │  │                                │
│  ─────────────────────  │  │                                │
│  [Lagre utkast] [Send]  │  │                                │
└─────────────────────────┘  └────────────────────────────────┘
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

### Felles mønster: Bridge eier alt

Begge spor (grunnlag og frist) følger samme arkitektur. Bridge-hooken
eier all form-state, begrunnelse, submit-mutasjon, form backup og
token-håndtering. Kortet viser kontroller + submit. Formpanelet er
en ren skriveflade.

```
CasePageBento
├── use[Spor]Bridge(config)
│   ├── FormState (single useState inkl. begrunnelse)
│   ├── useSubmitEvent (React Query mutation)
│   ├── useFormBackup (localStorage-backup)
│   ├── useCatendaStatusHandler
│   ├── useToast (feedback)
│   ├── Visibility flags, resultat-beregning, auto-begrunnelse
│   └── handleSubmit / handleSaveDraft / canSubmit
│
├── [Spor]Card(editState=bridge.cardProps)
│   ├── [✕] Lukk-knapp (øverst — lukk uten å scrolle)
│   ├── Kontroller (InlineYesNo, VerdictCards, etc.)
│   ├── Kontekst-alerts (passivitet, snuoperasjon, preklusjon)
│   ├── Resultat-boks
│   ├── TokenExpiredAlert + submitError
│   └── [Lagre utkast] [Send svar] (nederst)
│
└── BentoRespond[Spor](editorProps=bridge.editorProps)
    ├── RichTextEditor (begrunnelse)
    └── «Regenerer fra valg»-knapp
```

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

## Sjekkliste for neste spor (vederlag)

Basert på lærdom fra grunnlag- og frist-implementeringen:

- [ ] Opprett `useVederlagBridge`-hook med konsolidert `FormState` inkl. begrunnelse (L1, L12)
- [ ] Bridge eier `useSubmitEvent`, `useFormBackup`, `useToast` internt (L12)
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
- [ ] Formpanelet tar kun `editorProps` — ingen setters, submit eller domenelogikk (L11)
- [ ] Lukk-knapp [✕] øverst i kortet, Send/Lagre nederst (prinsipp 3)
- [ ] Opprett `createWrapper()` i testfil med QueryClient + ToastProvider (L13)
- [ ] Test at klassiske modaler (RespondVederlagModal) fremdeles fungerer

---

## Referanser

### Implementerte filer

| Fil | Rolle |
|-----|-------|
| `src/hooks/useGrunnlagBridge.ts` | Bridge-hook for grunnlag |
| `src/hooks/useFristBridge.ts` | Bridge-hook for frist |
| `src/components/bento/BentoRespondGrunnlag.tsx` | Ren begrunnelse-editor for grunnlag (~60 linjer) |
| `src/components/bento/BentoRespondFrist.tsx` | Ren begrunnelse-editor for frist (~60 linjer) |
| `src/components/bento/CaseMasterCard.tsx` | Kort for grunnlag (kontroller + submit + lukk) |
| `src/components/bento/track-cards/FristCard.tsx` | Kort for frist (kontroller + submit + lukk) |
| `src/components/bento/InlineYesNo.tsx` | Delt ja/nei-toggle |
| `src/components/bento/InlineNumberInput.tsx` | Delt tall-input |
| `src/components/bento/VerdictCards.tsx` | Delt verdikt-komponent |
| `src/components/bento/consequenceCallout.ts` | Konsekvens-logikk |
| `src/pages/CasePageBento.tsx` | Koordinering og layout |

### Relaterte dokumenter

- Implementeringsplan: `docs/plans/2026-02-15-card-anchored-vederlag-frist.md`
- Bento-design: `docs/plans/2026-02-13-bento-casepage-design.md`
