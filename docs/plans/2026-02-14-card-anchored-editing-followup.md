# Oppfølging: Card-Anchored Contextual Editing for Vederlag og Frist

## Kontekst

Vi har implementert et designmønster kalt "Card-Anchored Contextual Editing"
for grunnlag-sporet i bento-casepagen. Se ADR-003:
`docs/ADR-003-card-anchored-contextual-editing.md`

Kjerneprinsipp: valgkontroller (resultat, toggles) flyttes inn i kortet der
konteksten allerede vises. Formpanelet reserveres for primæroppgaven
(fritekst-begrunnelse). State koordineres av forelder-komponenten.

### Viktig arkitekturdistinksjon

Prosjektet har **to uavhengige sidetyper** for samme sak:

| Side | Rute | Skjema-mønster | Stil |
|------|------|----------------|------|
| **Klassisk CasePage** | `/saker/:id` | Modaler (fullskjerm/dialog) | Tradisjonell form-layout |
| **Bento CasePageBento** | `/saker/:id/bento` | Inline kort + panel | Card-anchored editing |

Modalene i den klassiske siden (RespondVederlagModal, RespondFristModal, etc.)
er **representative for forretningslogikken og feltene som må fylles ut**, men
de skal IKKE endres eller refaktoreres. Bento-siden bygger sine egne
inline-komponenter (BentoRespondVederlag, BentoRespondFrist) som dekker
samme forretningslogikk men med card-anchored mønsteret.

### Gjeldende implementering (grunnlag)

- `src/components/bento/CaseMasterCard.tsx` — Kort med dual-mode (read-only + interaktiv)
- `src/components/bento/BentoRespondGrunnlag.tsx` — Formpanel (kun tekstredaktør + konsekvens-callout)
- `src/pages/CasePageBento.tsx` — State-koordinering via useState + props
- `src/components/bento/VerdictCards.tsx` — Gjenbrukbar valg-komponent

## Oppgave

Analyser Vederlag- og Frist-sporene og besvar de åpne spørsmålene fra ADR-003.
Lever en konkret implementeringsplan.

### Steg 1: Analyser de klassiske modalene

Les disse filene for å forstå forretningslogikken og feltene:

**Vederlag (BH-svar):**
- `src/components/actions/RespondVederlagModal.tsx` — 4-ports wizard
- `src/components/actions/forms/RespondVederlagForm.tsx` — Skjema-felter og validering
- `src/components/actions/shared/VederlagMethodSelector.tsx` — Metodevalg-komponent

**Frist (BH-svar):**
- `src/components/actions/RespondFristModal.tsx` — 4-ports wizard
- `src/components/actions/forms/RespondFristForm.tsx` — Skjema-felter og validering

**TE-skjemaer (for kontekst, ikke for refaktorering):**
- `src/components/actions/forms/SendVederlagForm.tsx`
- `src/components/actions/forms/SendFristForm.tsx`

**Bento-kort:**
- `src/components/bento/track-cards/VederlagCard.tsx`
- `src/components/bento/track-cards/FristCard.tsx`

**State og typer:**
- `src/types/timeline.ts` — SakState, spor-felter
- `backend/models/sak_state.py` — Backend state-projeksjon
- `backend/models/events.py` — Event-typer og data

### Steg 2: Besvar åpne spørsmål fra ADR-003

For hvert spørsmål, gi en begrunnet anbefaling:

1. **Vederlag-kompleksitet.** Wizard har 4 porter med avhengigheter.
   Passer hook-mønsteret (`useCardFormBridge`), eller trengs en
   state machine? Kartlegg avhengighetene mellom portene eksplisitt.

2. **Hvor mye i kortet?** Vederlag har 3 underkrav (hoved, rigg,
   produktivitet). Alle i kortet? Bare hoved? Ekspanderbare seksjoner?
   Analyser hva VederlagCard allerede viser og hva som mangler for å
   gi kontekst til valgkontrollene.

3. **TE vs BH.** Gjelder mønsteret bare BH-svarskjemaer? Hva med
   TE-oppdateringer (revidert vederlag, revidert frist)?

4. **Tall-input i kort.** Godkjent beløp (kr) og godkjent dager —
   inline i kortet eller i formpanelet? Vurder interaksjonskompleksitet
   og feilhåndtering.

5. **Responsivitet.** Hvordan kollapser 2-kolonne-layouten på mobil?
   Hva skjer med kontroller i kortet?

### Steg 3: Design komponentarkitekturen

Basert på analysen, design:

1. **`useCardFormBridge` hook** — Generisk nok for alle tre spor?
   Eller tre spesialiserte hooks? Vis TypeScript-signaturer.

2. **Kort-kontrakt** — Hvilke nye props trenger VederlagCard og
   FristCard for interaktiv modus? Lag interface-forslag.

3. **Formpanel-kontrakt** — Hva gjenstår i BentoRespondVederlag /
   BentoRespondFrist etter at valgkontroller er flyttet?

4. **Delt vs spesifikk.** Hva kan gjenbrukes (VerdictCards,
   varslet-toggle-mønsteret) og hva må lages spesifikt?

5. **Faseplan.** Foreslå rekkefølge for implementering. Grunnlag er
   ferdig. Hva er enklest å ta neste — Frist eller Vederlag?

### Steg 4: Lever implementeringsplan

Skriv en plan i samme format som `docs/plans/2026-02-14-judgment-panel-impl.md`
med nummererte tasks, TDD-steg, og verifikasjoner per task.

## Forventet leveranse

En plan-fil i `docs/plans/` som kan eksekveres med executing-plans-skill.
Planen skal:
- Referere til ADR-003 for designprinsipper
- Ikke endre klassisk CasePage eller dens modaler
- Bygge nye BentoRespond*-komponenter for bento-siden
- Inkludere arkitekturbeslutninger med begrunnelse
- Ha testbare steg med verifikasjoner
