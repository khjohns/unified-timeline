# Designvurdering — CasePageAccess tre-panel-layout

**Dato:** 2026-03-02
**Kontekst:** Vurdering av den foreslåtte tre-panel-arkitekturen med mockups for TE-sending og BH-svar

---

## Domeneutforskning

### Hvem sitter her?

Brukeren har akkurat klikket seg inn på en bestemt sak. De har et spørsmål: «Hvor er vi, og hva må jeg gjøre?» Tre-panel-layouten svarer umiddelbart med venstepanelet (posisjon), midtpanelet (detaljer), høyrepanelet (kontekst). Det er ett blikk, tre svar.

Men — og dette er nøkkelen — de vil snart **gjøre** noe. Skrive en begrunnelse. Krysse av en innsigelse. Godkjenne et antall dager. Verktøyet må ikke bare vise, det må støtte arbeid.

### Signaturelement

**Begrunnelse-editoren som lever i høyrepanelet.** Ingen annen SaaS-app har en juridisk argumentasjonseditor med låste verdier (dager, beløp, prosent) som fargekodede inline-badges — side om side med strukturerte beslutningsfelter i et tilstøtende panel. Det er unikt for dette domenet.

### Fargeverdenen

Mockupens overflatedifferensiering — `░░` (bg-subtle grå) for venstre, hvit (bg-card) for midten og høyre — er riktig. Det gir tre-panelstrukturen visuell klarhet uten 1px-dividers. Toneskiftet mellom flatene gjør jobben alene.

### Defaults å avvise

| Default | Hvorfor det er feil her | Mockupens løsning |
|---------|------------------------|-------------------|
| **Begrunnelse som textarea i midten** | Juridisk argumentasjon trenger plass og kontekst | Egen kolonne (360px) med TipTap-editor |
| **Preview til høyre, edit i midten** | Forhåndsvisning er passiv; skrivingen er det aktive arbeidet | Høyrepanelet ER editoren, ikke bare preview |
| **Modal for redigering** | Mister alle tre spor, varslingsstatus, historikk | Form erstatter midtpanelets innhold, resten forblir |
| **Flat action footer** | Alle knapper like synlige hele tiden | Footer transformeres: read-only → action buttons; edit-mode → Avbryt/Send |

---

## Vurdering av mockupenes design

### Det som er riktig

**1. «Felter i midten, argumentasjon til høyre» er den sentrale innsikten.**

Mockupen splitter to fundamentalt forskjellige arbeidsmoduser i to fysiske kolonner:

| Midtpanel | Høyrepanel |
|-----------|------------|
| Radio-knapper, tallfelt, checkboxer | Fritekst, avsnitt, juridisk argumentasjon |
| Kompakt, strukturert, skannbart | Langt, narrativt, gjennomtenkt |
| Millisekunder per beslutning | Minutter per avsnitt |
| Endrer state direkte | Bygger kontekst rundt state |

Dagens bento-layout klarer ikke dette — den klemmer begge moduser inn i en `grid grid-cols-1 md:grid-cols-2` inne i kortet (VederlagCard linje 324, FristCard linje 405). Begrunnelse-textarea'en får ~50% av en allerede trang kortbredde. Mockupen gir den 360px dedikert plass.

**2. BegrunnelseEditor med LockedValue-tokens finnes allerede.**

Mockupens `¶ B`-hint i editor-bunnen treffer en eksisterende komponent: `BegrunnelseEditor.tsx` med TipTap, `LockedValueExtension.ts` med fargekodede inline-badges for `{{dager:20:20 dager}}`, `{{belop:150000:kr 150 000,-}}`, `{{prosent:67:67%}}`. Den er bygget og klar — men brukes ikke i bento-kortene (som bruker plain `Textarea`). Tre-panel-layouten gir den naturlig plass.

**3. TEs krav read-only øverst i midtpanelet (BH-visning) er riktig kontekstmønster.**

Når BH svarer, ser de:
```
┌─ TEs krav (skrivebeskyttet) ──────────┐
│  Spesifisert krav §33.6               │
│  45 kalenderdager · Ny dato 15.08.2026│
└───────────────────────────────────────┘
```
Deretter sine egne felter under. Svaret er alltid fysisk under kravet det svarer på. Ingen scrolling opp for å sjekke «hva var det de krevde igjen?».

**4. Innsigelser som eksplisitte checkboxer er en juridisk forbedring.**

Dagens bento-oppsett har InlineYesNo-toggles som er visuelt ambivalente — «Varslet i tide? Ja/Nei». Mockupen erstatter dette med:
```
□ Preklusjon §33.4 — varslet for sent
☑ Preklusjon §33.6.1 — spesifisert krav for sent
□ Vilkår §33.1 — vilkår ikke oppfylt
```
Hver checkbox er en bevisst juridisk posisjon med §-referanse. BH tar en eksplisitt avgjørelse om hvert preklusjonsgrunnlag. Det er kontraktsmessig mer robust og lettere å forstå.

**5. Venstepanelet som aldri forsvinner er løsningen på konteksttap.**

Min forrige vurdering identifiserte konteksttap som det største problemet med bento-layouten. Mockupen løser det: sporstatus, varslingsstatus og aktivitet er alltid synlige i 260px ved siden av arbeidsflaten. Når BH svarer på frist og trenger å sjekke grunnlagsresultatet (som påvirker subsidiær logikk) — det er allerede synlig i venstepanelet.

**6. Action footer-transformasjonen er ren.**

| Modus | Footer |
|-------|--------|
| Read-only | `Send krav │ Revider │ Godta svaret  Rev. 1` |
| Edit (TE) | `Avbryt                 ▓▓ Send krav §33 ▓▓` |
| Edit (BH) | `Avbryt                  ▓▓ Send svar §33 ▓▓` |

Primærknappen inkluderer §-referansen. Det er en liten detalj som gir trygghet: «Jeg sender svar under §33, ikke §34.»

**7. Høyrepanelets dual-block-mønster for BH-svar er godt.**

```
┌────────────────────────┐
│ TE  TEs krav           │
│ Forsinkelsen skyldes...│
│           ▼ Vis mer    │
└────────────────────────┘
    ─ · ─ · ─  ↓  ─ · ─
┌────────────────────────┐
│ BH  BHs vurdering (deg)│
│ Godkjenner 30 av 45_  │
│                   ¶  B │
└────────────────────────┘
```

TE-blokken (komprimerbar med «Vis mer») over BH-blokken (aktiv editor). Utvekslingspilen mellom dem. Brukeren ser kravet og svaret som en dialog — fordi det **er** en dialog.

### Ting å skjerpe

**1. Høyrepanelet trenger en tydeligere modusindikator.**

Når Begrunnelse-fanen er aktiv under redigering, er høyrepanelet en editor. Når den er aktiv uten redigering, er den read-only. Denne modusovergangen er visuelt undertydelig i mockupen. Forslag: ring/border-endring rundt editor-boksen (f.eks. `ring-2 ring-pkt-brand-warm-blue-1000/30` — tilsvarende bento-kortenes editState-indikator).

**2. Tab-stripen i høyrepanelet konkurrerer med editor-modus.**

Når brukeren redigerer frist-svar og begrunnelse-editoren er aktiv — hva skjer om de klikker «Historikk»-taben? Forsvinner editoren? Mister de uskrevet tekst?

Forslag: Under redigering bør tab-stripen enten:
- **Låses** — bare Begrunnelse-fanen er klikkbar, de andre er dimmet
- **Splittes** — Begrunnelse-editor tar full høyrepanel-høyde, historikk er tilgjengelig via en liten sekundær toggle innenfor editoren

Låsing er enklest og trygggest. Brukeren bør ikke navigere vekk fra begrunnelsen midt i redigering.

**3. Vedlegg-plassering er usikker mellom mockupene.**

I TE-send-mockupen er vedlegg under begrunnelsen i midtpanelet. I den alternative mockupen (begrunnelse i høyrepanelet) er vedlegg også i midtpanelet. Men vedlegg er sterkt koblet til begrunnelsen — «jf. vedlagt fremdriftsplan revisjon 3». Vedlegg bør enten:
- **Leve under begrunnelse-editoren i høyrepanelet** (mest logisk — filer understøtter teksten)
- Eller **vises inline i midtpanelet med en lenke-token i editoren** (mer avansert)

Anbefaling: Vedlegg under editoren i høyrepanelet. Midtpanelet forblir rent strukturert.

**4. 260px venstepanel er i trangeste laget.**

Mockupen viser `260px`. Den nåværende CasePageAccess har `280px`. Med label «ANSVARSGRUNNLAG» (16 tegn) + «§25.2» + status-dot + eventuell «Sub.»-badge — 260px gir svært lite plass. Anbefaling: behold 280px fra nåværende implementasjon.

**5. Responsiv strategi mangler men er planlagt riktig.**

Faste bredder (280px + 360px = 640px) gir minimum ~640px for rammen alene. Fra responsive-undersøkelsen: det finnes ingen sheet/drawer-komponent, men `Collapsible.tsx` (Radix-basert, med animasjoner) og `Modal.tsx` (Radix Dialog med backdrop) finnes.

Forslag:
- **≥1280px**: Full tre-panel
- **960–1279px**: Høyrepanel kollapser til et Collapsible-panel som slider inn fra høyre (bygges fra Modal med `side: right`)
- **<960px**: Venstepanel kollapser til en top-bar med spor-tabs, høyrepanel blir et overlay-sheet

**6. OverviewPanel (ingen spor valgt) bør beholdes og styrkes.**

Mockupen fokuserer på frist-valgt-tilstand. Men overview-tilstanden (alle tre summary cards synlige) er verdifull. Den bør også inkludere: overordnet forhandlingsposisjon (prinsipalt + subsidiært for alle tre spor), og neste-handling-kortet med full kontekst.

---

## Det sentrale skiftet: fra preview til workspace

Mockupen tar høyrepanelet fra **referansepanel** (les begrunnelse, les historikk, se filer) til **arbeidspanel** (skriv begrunnelse, se kravet du svarer på). Det er et fundamentalt skifte:

| Nåværende access-side | Mockupens forslag |
|------------------------|-------------------|
| Høyrepanel: read-only referanse | Høyrepanel: aktiv editor under redigering |
| Midtpanel: key-value-lister | Midtpanel: strukturerte beslutningsfelter |
| Action footer: finnes ikke | Action footer: transformerende Avbryt/Send |
| Form: finnes ikke (kun visning) | Form: erstatter midtpanelets innhold |
| Begrunnelse: vises flat | Begrunnelse: TipTap med LockedValue-tokens |

Dette er riktig retning. Det tar de to sterkeste elementene fra to forskjellige sider og kombinerer dem:
- **Fra access-siden**: tre-panel-strukturen, persistent kontekst, stabil layout
- **Fra bento-siden**: bridge-hooks, inline editing, domenerikdom, BegrunnelseEditor

---

## Hva kodebasen allerede har — og hva som mangler

Utforskning av eksisterende kode avdekker at mockupens design er mer realiserbart enn man kanskje tror. Nøkkelkomponentene finnes allerede — de er bare ikke koblet sammen riktig.

### Begrunnelse-arkitekturen (allerede bygget)

Tre parallelle editor-komponenter finnes:

| Editor | Fil | Brukes i dag? | Evner |
|--------|-----|--------------|-------|
| `RichTextEditor` | `primitives/RichTextEditor.tsx` (412 linjer) | Ja — BentoRespondX | TipTap, markdown, toolbar (bold/italic/lister/headings/tabeller) |
| `BegrunnelseEditor` | `primitives/BegrunnelseEditor.tsx` (283 linjer) | **Nei — ubrukt** | TipTap, LockedValue-tokens, fargekodede badges |
| `MarkdownEditor` | `primitives/MarkdownEditor.tsx` (373 linjer) | **Nei — ubrukt** | Write/Preview-tabs, GitHub-stil |

BegrunnelseEditor er den mockupen sikter mot — og den er ubrukt. Den har:
- `{{dager:20:20 dager}}` → blå badge
- `{{belop:150000:kr 150 000,-}}` → grønn badge
- `{{prosent:67:67%}}` → lilla badge
- Backspace/Delete blokkert på låste verdier
- Drag-and-drop for å flytte tokens

### Auto-begrunnelse med tokens (allerede bygget)

Bridge-hookene genererer allerede token-basert begrunnelse:

- `useVederlagBridge` kaller `generateVederlagResponseBegrunnelse({ useTokens: true })` (linje 358)
- `useFristBridge` kaller `generateFristResponseBegrunnelse({ useTokens: true })` (linje 289)
- Begge memoized og lagret i `autoBegrunnelse` + `userHasEditedBegrunnelseRef`
- `buildEventData()` lagrer både `begrunnelse` og `auto_begrunnelse` i event-payload
- `begrunnelseGenerator.ts` er 60KB med full implementering

**Men**: Bento-formen bruker plain `Textarea` i stedet for `BegrunnelseEditor` — så token-strengene vises som rå `{{dager:20:20 dager}}`-tekst. Mockupens tre-panel med BegrunnelseEditor i høyrepanelet ville gjøre hele auto-begrunnelse-systemet synlig og nyttig for første gang.

### Action-mønsteret (allerede bygget)

`useActionPermissions` (229 linjer) returnerer 19 boolske flagg som dekker alle handlinger for begge roller. Mockupens action footer trenger bare å mappe disse:

| Flagg | Read-only footer | Edit footer |
|-------|-----------------|-------------|
| `canSendFrist` | «Send krav» knapp | → Avbryt + `▓▓ Send krav §33 ▓▓` |
| `canRespondToFrist` | «Svar på krav» knapp | → Avbryt + `▓▓ Send svar §33 ▓▓` |
| `canUpdateFrist` | «Revider» knapp | → Avbryt + `▓▓ Oppdater krav §33 ▓▓` |
| `canAcceptFristResponse` | «Godta svaret» i overflow | (ingen edit-modus) |
| `canWithdrawFrist` | «Trekk tilbake» i overflow | (ingen edit-modus) |

Dirty-check finnes via `TrackFormView` (Radix-dialog med «Forkast endringer» / «Fortsett redigering»). Kan gjenbrukes direkte i action footer.

### Hva som faktisk mangler

| Mangler | Beskrivelse | Estimat |
|---------|-------------|---------|
| Panelet som shell | `WorkspaceLayout` — tre-panel flex med resize | Ny komponent |
| BegrunnelsePanel | Dual-block (TE read-only + BH editor) | Ny komponent, wrapper rundt BegrunnelseEditor |
| ActionFooter | Transformerende footer read→edit | Ny komponent, bruker useActionPermissions |
| RequestSummary | TEs krav kompakt read-only | Ny komponent, leser fra state |
| Innsigelse-checkboxer | Erstatter InlineYesNo for BH-preklusjon | Ny variant av eksisterende mønster |
| BegrunnelseEditor-integrasjon | Koble BegrunnelseEditor til bridge-hookene | Bytte fra Textarea til BegrunnelseEditor |

Resten — bridge-hooks, domain-logikk, inline-kontroller, auto-begrunnelse, action permissions, dirty-check, historikk-transformasjon — finnes allerede.

---

## Komponentkart for implementering

### Nye komponenter (fra mockup)

| Komponent | Ansvar | Plassering |
|-----------|--------|------------|
| `WorkspaceLayout` | Tre-panel shell (venstre/midt/høyre) | `components/workspace/` |
| `TrackNav` | Venstre-panel med spornavigasjon | `components/workspace/` |
| `PositionBar` | Neste-handling + spor-oversikt | `components/workspace/` |
| `ActionFooter` | Transformerende footer (read→edit) | `components/workspace/` |
| `RequestSummary` | TEs krav read-only i BH-modus | `components/workspace/` |
| `BegrunnelsePanel` | Høyrepanel-editor med dual-block | `components/workspace/` |

### Gjenbruk fra bento

| Komponent | Brukes som | Endring |
|-----------|------------|---------|
| `useGrunnlagBridge` | Bridge for grunnlag edit | Ingen — brukes direkte |
| `useVederlagBridge` | Bridge for vederlag edit | Ingen |
| `useFristBridge` | Bridge for frist edit | Ingen |
| `BegrunnelseEditor` | Rich text i høyrepanelet | Allerede bygget, brukes endelig |
| `LockedValueExtension` | Token-system for verdier | Ingen |
| `InlineYesNo`, `InlineNumberInput` etc. | Felter i midtpanelet | Ingen — flyttes bare fra kort til midtpanel |
| `VarslingSection` (access) | Venstepanel | Refaktoreres til delt komponent |
| `TrackHistory` / `SporHistory` | Historikk-tab i høyrepanelet | Ingen |

### Fjernes / erstattes

| Komponent | Erstattes av |
|-----------|--------------|
| CasePageAccess (1555 linjer, monolittisk) | WorkspaceLayout + delte komponenter |
| FristCard TE two-column grid | Midtpanel (felter) + Høyrepanel (editor) |
| VederlagCard TE two-column grid | Midtpanel (felter) + Høyrepanel (editor) |
| Plain `Textarea` i bento-kort | `BegrunnelseEditor` med LockedValue |

---

## Mockup-spesifikke vurderinger

### Mockup 1: Read-only fristdetalj med BH-svar

**Styrke**: KPI-rad øverst (Krevd/Godkjent/Grad + progress bar), key-value-rader med prikket leader, subsidiært standpunkt med egen seksjon, forespørsel §33.6.2 med frist.

**Forbedring**: Preklusjonsflagg (`✕ Preklusjon §33.6.1`) bør ha en kort forklaring eller tooltip — brukeren trenger å vite *hvorfor* det er prekludert, ikke bare *at* det er det.

### Mockup 2: TE sender fristkrav

**Styrke**: Segmented control for varseltype øverst, tallfelt for dager, dato-input for sluttdato, begrunnelse-textarea i midten (alternativ) eller editor i høyre (foretrukket). Vedlegg med drag-and-drop.

**Forbedring**: «Type varsling»-radioen bør ha en kontekstuell hjelpetekst som sier hva konsekvensen er av valget — «Foreløpig varsel reserverer retten; spesifisert krav krever begrunnelse og beregning.» Tilsvarende det FristCard allerede har (`teEditState.showSegmentedControl` med forklaringstekst på linje 501-506).

### Mockup 3: BH svarer på fristkrav

**Styrke**: TEs krav read-only øverst, radio for vurdering, tallfelt for godkjente dager, innsigelse-checkboxer med §-referanse.

**Forbedring**: Resultat-radioen (Godkjent/Delvis/Avslått) bør ha umiddelbar visuell feedback — når BH velger «Delvis godkjent», bør «Godkjent dager»-feltet animeres inn med auto-fokus, og KPI-raden i venstepanelet bør oppdateres live (viser nytt grad-%).

### Mockup 4: Begrunnelse-editor i høyrepanelet (det sentrale skiftet)

**Styrke**: Full 360px bredde for skrivingen. TEs krav øverst (komprimerbar), BHs svar under (aktiv editor med TipTap). Utvekslings-pil mellom blokkene.

**Forbedring**: Editoren bør ha en «Regenerer»-knapp som kjører `generateResponseBegrunnelse()` fra bridge-hookene — auto-generert tekst basert på de strukturerte feltene i midtpanelet, med LockedValue-tokens for tallene. Brukeren kan så redigere videre. Denne funksjonaliteten finnes allerede i bridgene (`auto-begrunnelse ref`).

---

## Oppsummering

Mockupene representerer et godt designforslag som løser de to viktigste problemene identifisert i forrige vurdering:

1. **Konteksttap** → løst av persistent venstepanel
2. **Begrunnelse-plassproblemet** → løst av dedikert høyrepanel som workspace

Det sentrale skiftet — «felter i midten, argumentasjon til høyre» — er domene-riktig. Kontraktsadministratorer gjør to distinkte ting: tar strukturerte beslutninger (ja/nei, tall, valg) og skriver fritekst-argumentasjon. Disse hører hjemme i forskjellige fysiske soner.

Implementeringsrisikoen er moderat: bridge-hookene, BegrunnelseEditor, og inline-kontrollene finnes allerede. Hovedarbeidet er å refaktorere CasePageAccess fra monolittisk 1555-linjers fil til delte komponenter, og koble inn bridgene som bento-siden allerede bruker.
