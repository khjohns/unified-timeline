# ADR-003: Card-Anchored Contextual Editing

**Status:** Forslag
**Dato:** 2026-02-14
**Beslutningstagere:** Utviklingsteam
**Kontekst:** UX-mønster for inline skjemaer i bento-layout

---

## Sammendrag

Når bruker åpner et svarskjema i bento-layouten, flyttes valgkontroller
(resultat, toggles, metodevalg) inn i det tilhørende kortet der konteksten
allerede vises. Formpanelet reserveres for primæroppgaven: fritekst-begrunnelse.

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
2. **Formpanelet fokuserer** på primæroppgaven: fritekst, beregninger,
   vedlegg.
3. **Forelder koordinerer state** mellom kort og skjema.

```
┌─────────────────────────┐  ┌────────────────────────────────┐
│  MASTERCARD (col-5)     │  │  FORMPANEL (col-7)             │
│                         │  │                                │
│  Sak #123               │  │  Konsekvens-callout            │
│  ENDRING · §25.2b       │  │  ┌────────────────────────┐   │
│  «TE's beskrivelse...»  │  │  │                        │   │
│                         │  │  │  Byggherrens            │   │
│  Oppdaget    12.feb     │  │  │  begrunnelse            │   │
│  Varslet     13.feb     │  │  │                        │   │
│                         │  │  │  [Rik tekst-editor]    │   │
│  Varslet i tide?        │  │  │                        │   │
│  [✓ Ja] [✕ Nei]  ←───────── │  │                        │   │
│                         │  │  │                        │   │
│  ─────────────────────  │  │  └────────────────────────┘   │
│  DITT SVAR              │  │                                │
│  [✓ Godkjent][✕ Avslått]│  │  ─────────────────────────────│
│  ←────────────────────────── │    [Avbryt]  [Send svar]      │
│                         │  │                                │
│  [Historikk]            │  │                                │
└─────────────────────────┘  └────────────────────────────────┘
```

### Prinsipper

| # | Prinsipp | Forklaring |
|---|----------|------------|
| 1 | **Kontroller hører der konteksten er** | "Varslet i tide?" ved datoene. Verdiktkort ved grunnlaget. Metodevalg ved krevd beløp. |
| 2 | **Redaktøren får all plass** | Primæroppgaven (begrunnelse) trenger konsentrasjon og skjermplass. |
| 3 | **Kortet transformeres, ikke dupliseres** | Ingen kontekstpanel i skjemaet. Kortet selv blir interaktivt. |
| 4 | **Konsekvenser vises i formpanelet** | Dynamiske konsekvens-alerts basert på valgene i kortet vises der brukeren skriver, som veiledning for begrunnelsen. |
| 5 | **State løftes til forelder** | Sidekomponenten koordinerer verdier mellom kort og skjema. |

---

## Analyse per spor

### Grunnlag (implementert)

**Kort viser:** Kategori, beskrivelse, datoer, BH-resultat, historikk.

| Kontroll | Nå | Etter |
|----------|-----|-------|
| Varslet i tide? (§32.2) | I skjema | **I kort** (ved datoene) |
| Resultat (Godkjent/Avslått/Frafalt) | I skjema | **I kort** (under grunnlag-seksjon) |
| Begrunnelse | I skjema | I skjema (uendret) |

**Kortet trenger ikke mer data.** Allerede komplett kontekst.

### Vederlag (analyse, ikke implementert)

**Kort viser:** Krevd beløp, metode, rigg/drift, produktivitet, godkjent beløp, grad.

**BH-skjemaet (4-ports wizard) har disse valgkontrollene:**

| Kontroll | Type | Kandidat for kort? | Kontekstbehov |
|----------|------|--------------------|---------------|
| Hovedkrav varslet i tide? | Ja/Nei | Ja | Vises ved krevd beløp |
| Rigg varslet i tide? | Ja/Nei | Ja | Vises ved rigg-rad |
| Produktivitet varslet i tide? | Ja/Nei | Ja | Vises ved produktivitet-rad |
| Aksepterer metode? | Ja/Nei | Ja | Vises ved metode-rad |
| Ønsket metode | EP/RA | Ja (betinget) | Vises under metode |
| Hovedkrav vurdering | Godkjent/Delvis/Avslått | Ja | Vises ved krevd beløp |
| Godkjent beløp | Tall-input | Mulig | Ved vurdering (hvis delvis) |
| Rigg vurdering | Godkjent/Delvis/Avslått | Ja | Ved rigg-rad |
| Produktivitet vurdering | Godkjent/Delvis/Avslått | Ja | Ved produktivitet-rad |
| Begrunnelse | Teksteditor | Nei | Formpanelet |

**Kortet bør vise mer kontekst i edit-modus:**
- TE's metode-begrunnelse (hvis tilgjengelig)
- EP-justerings-status
- Rigg/drift-detaljer (beløp, dato klar)
- Produktivitet-detaljer (beløp, dato klar)

**Utfordring:** Vederlag har vesentlig mer kompleksitet enn grunnlag.
Mange valgkontroller er betingede (rigg/produktivitet vises bare hvis
krevd). Kortet kan bli overbelastet. Mulig løsning: ekspanderbare
seksjoner per underkrav, eller kun primær-vurdering i kortet med
detaljer i formpanelet.

### Frist (analyse, ikke implementert)

**Kort viser:** Krevd dager, varslet dato, ny sluttdato, godkjent dager, grad.

**BH-skjemaet (4-ports wizard) har disse valgkontrollene:**

| Kontroll | Type | Kandidat for kort? | Kontekstbehov |
|----------|------|--------------------|---------------|
| Frist-varsel i tide? (§33.4) | Ja/Nei | Ja | Ved varslet-dato |
| Spesifisert krav i tide? (§33.6.1) | Ja/Nei | Ja | Ved krevd dager |
| Forespørsel-svar i tide? (§33.6.2) | Ja/Nei | Ja | Ved varslet-dato |
| Vilkår oppfylt? | Ja/Nei | Ja | Nytt felt (kontekst: kategori) |
| Godkjent dager | Tall-input | Mulig | Ved krevd dager |
| Ny sluttdato | Datovalg | Mulig | Ved sluttdato |
| Begrunnelse | Teksteditor | Nei | Formpanelet |

**Kortet bør vise mer kontekst i edit-modus:**
- Kontraktuell sluttdato (nåværende vs ny)
- TE's begrunnelse for fristkrav (hvis tilgjengelig)

**Utfordring:** Frist har et §33.6.2-forespørsel-svar-mønster som
kan avbryte den normale flyten. Kortet må tydelig vise om BH har
sendt forespørsel og om TE har svart.

### TE-skjemaer (Send/Oppdater)

TE-skjemaene (SendGrunnlagForm, SendVederlagForm, SendFristForm) har
en annen karakter: de oppretter data som kortet deretter viser.
Card-Anchored-mønsteret passer best for BH-svarskjemaer der kortet
allerede viser TEs krav og BH vurderer det.

For TE-skjemaer kan mønsteret likevel brukes for oppdateringer:
kortet viser nåværende data, og valgkontroller for endring vises
inline mens detaljerte endringer gjøres i formpanelet.

---

## Arkitektur

### Nåværende implementering (ad-hoc)

```
CasePageBento
├── useState(formVarsletITide)
├── useState(formResultat)
├── CaseMasterCard(formVarsletITide, onFormVarsletITideChange, ...)
└── BentoRespondGrunnlag(externalVarsletITide, externalResultat)
```

Fungerer for ett spor, men skalerer dårlig: CasePageBento får
3x state-variabler og effekter per spor.

### Foreslått arkitektur: Hook-basert koordinering

**Status: Krever videre analyse.** Arkitekturen under er et
utgangspunkt, ikke en endelig beslutning. Vederlag og frist har
vesentlig mer kompleksitet (betingede felter, multi-port wizards)
som kan påvirke kontrakten.

```tsx
// Generisk hook for state-koordinering mellom kort og skjema
function useCardFormBridge<TSelections>(config: {
  track: 'grunnlag' | 'vederlag' | 'frist';
  defaults: TSelections;
  isOpen: boolean;
}) {
  const [selections, setSelections] = useState<TSelections>(config.defaults);
  const [errors, setErrors] = useState<Partial<Record<keyof TSelections, boolean>>>({});

  // Reset ved åpning/lukking
  useEffect(() => {
    if (config.isOpen) {
      setSelections(config.defaults);
      setErrors({});
    }
  }, [config.isOpen]);

  return {
    // For kortet
    cardProps: {
      selections,
      onSelectionChange: (key, value) => {
        setSelections(prev => ({ ...prev, [key]: value }));
        setErrors(prev => ({ ...prev, [key]: false }));
      },
      errors,
    },
    // For skjemaet
    formProps: {
      externalSelections: selections,
    },
    // For feilhåndtering
    setFieldError: (key) => setErrors(prev => ({ ...prev, [key]: true })),
  };
}
```

**Bruk i CasePageBento:**
```tsx
const grunnlagBridge = useCardFormBridge({
  track: 'grunnlag',
  defaults: { varsletITide: true, resultat: undefined },
  isOpen: expandedTrack?.action === 'respond',
});

<CaseMasterCard {...grunnlagBridge.cardProps} />
<BentoRespondGrunnlag {...grunnlagBridge.formProps} />
```

### Åpne spørsmål

1. **Vederlag-kompleksitet.** Wizard har 4 porter med avhengigheter
   mellom dem (metode-valg påvirker beløps-validering). Passer
   hook-mønsteret, eller trengs en state machine (XState)?

2. **Hvor mye i kortet?** Vederlag har 3 underkrav (hoved, rigg,
   produktivitet), hvert med sin varslet-vurdering + beløpsvurdering.
   Alle i kortet kan overbelaste det. Alternativ: kun hoved-vurdering
   i kortet, underkrav i formpanelet.

3. **TE vs BH.** Mønsteret er designet for BH-svar (vurdering av
   eksisterende data). For TE-skjemaer (oppretting av data) er
   konteksten annerledes. Kanskje TE-skjemaer forblir tradisjonelle
   panel-skjemaer?

4. **Tall-input i kort.** Godkjent beløp og godkjent dager er
   small numeric inputs som kunne fungere inline i kortet (ved siden
   av krevd-verdien). Men de har validering og betingelser. Trenger
   prototyping.

5. **Responsivitet.** På mobil kollapser 2-kolonne-layout til
   1-kolonne. Da bør inline-kontrollene forbli i kortet (som vises
   først), med formpanelet under.

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

### Negative / risiko

- **Økt kompleksitet i kort-komponenter.** Kortene må håndtere
  dual-mode (read-only + interaktiv).
- **State-koordinering.** Verdier må synkes mellom kort og skjema,
  som kan gi bugs ved race conditions.
- **Overbelastning.** Risiko for at kort med mange inline-kontroller
  (spesielt vederlag) blir uoversiktlige.

### Avbøtende tiltak

- Start med enkle spor (grunnlag: 2 kontroller) før komplekse
  (vederlag: 9+ kontroller).
- Bruk ekspanderbare seksjoner i kortet for å håndtere kompleksitet.
- Prototyp vederlag-kortet med og uten inline-kontroller for å
  vurdere belastning.

---

## Referanser

- Grunnlag-implementering: `src/components/bento/CaseMasterCard.tsx`
- Formpanel: `src/components/bento/BentoRespondGrunnlag.tsx`
- Koordinering: `src/pages/CasePageBento.tsx`
- VerdictCards: `src/components/bento/VerdictCards.tsx`
