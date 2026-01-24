# Plan: Kvalitetssikring av Fristsporet (NS 8407 §33)

> Dato: 2026-01-23
> Status: Planlagt
> Metode: Vurder → Verifiser → Implementer

## Bakgrunn

Gjennomgang av fristsporet for å sikre korrekt implementasjon av NS 8407 kapittel 33 om fristforlengelse.

**Viktig:** Hvert tiltak skal gjennomgås i tre steg:
1. **VURDER** - Les kontraktstekst på nytt, diskuter tolkning
2. **VERIFISER** - Sjekk nåværende implementasjon, bekreft at endring er nødvendig
3. **IMPLEMENTER** - Utfør endringen

---

## Tiltak

### 1. §33.7 - Svarplikt terskel (10 → 5 dager)

**Prioritet:** Høy | **Kompleksitet:** Lav

#### Kontekst
BH skal svare "uten ugrunnet opphold" på spesifisert fristkrav. Dagens terskel for advarsel er 10 dager.

#### Kontraktstekst (§33.7)
> "Den parten som mottar krav på fristforlengelse, skal svare **uten ugrunnet opphold** etter å ha mottatt et begrunnet krav med angivelse av antallet dager fristforlengelse"

#### Foreløpig vurdering
- 5 dager gir bedre margin for "uten ugrunnet opphold"
- Verifisert at svarplikt kun gjelder spesifisert krav (ikke nøytralt varsel) ✅

#### Før implementering - VURDER:
- [ ] Les §33.7 på nytt
- [ ] Vurder om 5 dager er riktig terskel (bransjestandard?)
- [ ] Bekreft at endringen er ønskelig

#### Endring
`src/components/actions/RespondFristModal.tsx` linje 395:
```typescript
// Fra:
const bhPreklusjonsrisiko = dagerSidenKrav > 10;
// Til:
const bhPreklusjonsrisiko = dagerSidenKrav > 5;
```

---

### 2. §33.6.1 vs §33.4 - Preklusjon vs Reduksjon (KRITISK)

**Prioritet:** Høy | **Kompleksitet:** Medium

#### Kontekst
Dagens implementasjon behandler sen spesifisering (§33.6.1) som full preklusjon. Kontrakten sier dette kun gir reduksjon.

#### Kontraktstekst

**§33.4 (nøytralt varsel for sent):**
> "Krav på fristforlengelse **tapes** dersom det ikke varsles innen utløpet av fristen."
→ FULL PREKLUSJON

**§33.6.1 (spesifisering for sent, uten etterlysning):**
> "Gjør han ikke dette, har han **bare krav på slik fristforlengelse som den andre parten måtte forstå** at han hadde krav på."
→ REDUKSJON (ikke preklusjon)

**§33.6.2 (ikke svart på etterlysning):**
> "Gjør ikke totalentreprenøren noen av delene, **tapes** kravet på fristforlengelse."
→ FULL PREKLUSJON

#### Foreløpig vurdering

| Situasjon | Konsekvens | Dagens impl. | Korrekt? |
|-----------|------------|--------------|----------|
| §33.4 for sent | PREKLUSJON | `erPrekludert = true` | ✅ |
| §33.6.1 for sent (uten etterlysning) | REDUKSJON | `erPrekludert = true` | ❌ |
| §33.6.2 ikke svart | PREKLUSJON | Etterlysning-flyt | ✅ |

#### Før implementering - VURDER:
- [ ] Les §33.4, §33.6.1 og §33.6.2 på nytt
- [ ] Bekreft at tolkningen er korrekt
- [ ] Diskuter: Hva betyr "reduksjon til det BH måtte forstå" i praksis?
- [ ] Vurder UI-konsekvenser: Hvordan vise "redusert" vs "prekludert"?

#### Foreslått endring
```typescript
// Ny logikk i RespondFristModal
const erPrekludert = useMemo(() => {
  // §33.4: Nøytralt varsel for sent = FULL PREKLUSJON
  if (varselType === 'noytralt') {
    return formValues.noytralt_varsel_ok === false;
  }
  // §33.6.1 uten etterlysning = REDUKSJON (håndteres separat)
  // §33.6.2 med etterlysning = PREKLUSJON (håndteres via etterlysning-flyt)
  return false;
}, ...);

// Ny variabel for §33.6.1 reduksjon
const erRedusert_33_6_1 = useMemo(() => {
  if (varselType === 'spesifisert' && !fristTilstand?.har_bh_etterlyst) {
    return formValues.spesifisert_krav_ok === false;
  }
  return false;
}, ...);
```

---

### 3. §33.6.2 fjerde ledd - Fjern reduksjonsvarsel ved svar på etterlysning

**Prioritet:** Høy | **Kompleksitet:** Lav

#### Kontekst
Når TE svarer på BHs etterlysning, kan BH ikke påberope at §33.6.1-fristen er oversittet.

#### Kontraktstekst (§33.6.2 fjerde ledd)
> "Dersom totalentreprenøren i henhold til annet ledd bokstav a angir og begrunner antallet dager, skal byggherren svare etter 33.7. **Byggherren kan da ikke påberope at fristen i 33.6.1 er oversittet.**"

#### Foreløpig vurdering
- Når `er_svar_pa_etterlysning = true`, skal §33.6.1 reduksjonsvarsel **ikke** vises
- Dette beskytter TE som svarer på etterlysning

#### Før implementering - VURDER:
- [ ] Les §33.6.2 fjerde ledd på nytt
- [ ] Bekreft at `er_svar_pa_etterlysning` flagget finnes i data
- [ ] Vurder om dette også påvirker BHs vurdering i RespondFristModal

#### Implementert ✅
- `erSvarPaEtterlysning` variabel i RespondFristModal
- UI viser info-melding i stedet for reduksjonsspørsmål
- Oppsummering viser "Svar på etterlysning" badge

#### Kjent begrensning
Datamodellen tracker kun `har_bh_etterlyst: boolean`, ikke `dato_bh_etterlysning`.
Derfor kan vi ikke automatisk beregne om svaret på etterlysningen kom for sent.

**Løsning i UI:** Teksten forklarer at:
- §33.6.2 fjerde ledd beskytter kun mot §33.6.1-innsigelser
- TE har fortsatt plikt til å svare "uten ugrunnet opphold" (§33.6.2 annet ledd)
- BH kan påberope senhet via §5 (generell regel) hvis relevant

**Fremtidig forbedring:** Legg til `dato_bh_etterlysning` i datamodellen for å:
- Beregne dager siden etterlysning
- Vise advarsel hvis respons er forsinket

---

### 4. §33.5 - Forbedret helptext for beregning

**Prioritet:** Medium | **Kompleksitet:** Lav

#### Kontekst
Dagens helptext dekker ikke alle faktorer som skal vurderes ved beregning av fristforlengelse.

#### Kontraktstekst (§33.5)
> "Fristforlengelsen skal svare til den **virkning på fremdriften** som forhold nevnt i 33.1, 33.2 og 33.3 har forårsaket, der det blant annet tas hensyn til **nødvendig avbrudd** og eventuell **forskyvning av utførelsen til en for vedkommende part ugunstigere eller gunstigere årstid**. Det skal også tas hensyn til den **samlede virkningen av tidligere varslede forhold** som kunne gi rett til fristforlengelse.
>
> Partene plikter å **forebygge og begrense skadevirkningene** av en fristforlengelse og samarbeide med hverandre om de tiltak som kan iverksettes."

#### Foreløpig vurdering
Faktorer som bør nevnes:
- Virkning på fremdriften
- Nødvendig avbrudd
- Årstidsforskyvning
- Samlet virkning av tidligere forhold
- Tapsbegrensningsplikt

#### Før implementering - VURDER:
- [ ] Les §33.5 på nytt
- [ ] Vurder om alle faktorer skal nevnes eller kun de viktigste
- [ ] Vurder lengde på helptext - ikke for lang

#### Foreslått helptext

**SendFristModal (TE):**
```
Beregningen skal reflektere den faktiske virkning på fremdriften (§33.5).
Ta hensyn til: nødvendig avbrudd, årstidsforskyvning, samlet virkning av
tidligere forhold, og din plikt til å begrense skadevirkningene.
```

**RespondFristModal (BH):**
```
Vurder om kravet reflekterer reell virkning på fremdriften (§33.5).
Momenter: nødvendig avbrudd, årstidsforskyvning, tidligere varslede forhold,
og om TE har oppfylt tapsbegrensningsplikten.
```

---

### 5. §33.6.2 bokstav b - TE kan begrunne hvorfor beregning ikke er mulig

**Prioritet:** Medium | **Kompleksitet:** Medium

#### Kontekst
Når TE mottar etterlysning, har TE to svaralternativer - men kun alternativ a) er implementert.

#### Kontraktstekst (§33.6.2 annet ledd)
> "Når totalentreprenøren mottar en forespørsel i henhold til første ledd, skal han uten ugrunnet opphold enten
> a) angi og begrunne det antall dager han krever som fristforlengelse, **eller**
> b) begrunne hvorfor grunnlaget for å beregne kravet ikke foreligger."

**Konsekvens av bokstav b (§33.6.2 femte ledd):**
> "Dersom totalentreprenøren i henhold til annet ledd bokstav b begrunner hvorfor han ikke har grunnlag for å beregne sitt krav, **gjelder bestemmelsen i 33.6.1**."

#### Foreløpig vurdering
- TE trenger mulighet til å si "jeg kan ikke beregne ennå fordi..."
- Når TE bruker bokstav b, gjelder vanlige §33.6.1 regler videre
- Dette gir TE "utsettelse" til beregningsgrunnlag foreligger

#### Før implementering - VURDER:
- [ ] Les §33.6.2 annet og femte ledd på nytt
- [ ] Vurder: Hva skjer videre når TE bruker bokstav b? Ny etterlysning mulig?
- [ ] Vurder UI: Hvordan presentere de to alternativene?
- [ ] Vurder: Trenger vi ny event-type eller kan eksisterende brukes?

#### Implementert ✅

**Backend** (`backend/models/events.py`):
- Lagt til `BEGRUNNELSE_UTSATT = "begrunnelse_utsatt"` i `FristVarselType` enum

**Frontend** (`src/constants/fristVarselTypes.ts`):
- Ny option: "Begrunn utsettelse (§33.6.2 b)"
- Beskrivelse som forklarer konsekvensen

**SendFristModal** (`src/components/actions/SendFristModal.tsx`):
- Viser `begrunnelse_utsatt` kun når `harMottattEtterlysning = true`
- Info-alert forklarer at §33.6.1-regler gjelder videre
- Oppdatert etterlysning-advarsel med begge alternativer (a og b)

---

### 6. §33.6.2 - BH proaktiv etterlysning

**Prioritet:** Lav | **Kompleksitet:** Høy

#### Kontekst
I dag kan BH kun sende etterlysning som respons på eksisterende fristkrav. §33.6.2 tillater proaktiv etterlysning.

#### Kontraktstekst (§33.6.2 første ledd)
> "**Så lenge** totalentreprenøren ikke har fremmet krav etter 33.6.1, kan byggherren be om at totalentreprenøren gjør dette."

#### Foreløpig vurdering
- BH kan sende etterlysning når som helst (koblet til grunnlag-event)
- Krever ny event-type `FRIST_ETTERLYSNING`
- Krever ny UI-komponent `SendEtterlysningFristModal`

#### Før implementering - VURDER:
- [ ] Les §33.6.2 første ledd på nytt
- [ ] Vurder: Er dette nødvendig funksjonalitet for MVP?
- [ ] Vurder: Kompleksitet vs nytte
- [ ] Vurder: Hva skjer hvis BH sender etterlysning og TE allerede har sendt nøytralt varsel?

#### Foreslått løsning

Ny event-type: `FRIST_ETTERLYSNING`

| Felt | Type | Beskrivelse |
|------|------|-------------|
| `grunnlag_event_id` | string | Kobling til grunnlag (påkrevd) |
| `beskrivelse` | string | Hvilken hendelse BH etterspør |
| `frist_for_svar` | date | Frist for TE å svare |

---

### 7. §33.2 - BH fristforlengelse

**Prioritet:** Lav | **Kompleksitet:** Høy | **Status:** Dokumentert for fremtidig implementering

#### Kontekst
Kontrakten tillater at BH kan kreve fristforlengelse fra TE når TE forårsaker forsinkelser.

#### Kontraktstekst (§33.2)
> "Byggherren har krav på fristforlengelse dersom hans medvirkning hindres som følge av forhold totalentreprenøren har risikoen for."

#### Beslutning
**Implementeres som egen sakstype** - ikke integrert i eksisterende KOE-flyt.

#### Spesifikasjon: Sakstype `bh_frist`

**Ny sakstype i `SakType` enum:**
```python
class SakType(str, Enum):
    STANDARD = "standard"        # TE → BH (eksisterende)
    FORSERING = "forsering"      # TE → BH (eksisterende)
    ENDRINGSORDRE = "endringsordre"  # BH → TE (eksisterende)
    BH_FRIST = "bh_frist"        # BH → TE fristforlengelse (NY)
```

**Flyt:**
1. BH oppretter sak med `sakstype: 'bh_frist'`
2. BH sender fristkrav (speilvendt av dagens TE-flyt)
3. TE responderer (godkjenner/avslår/delvis)
4. Eventuell tvist håndteres

**Kategorier (§33.2):**
| Kode | Label | Beskrivelse |
|------|-------|-------------|
| `TE_FORSINKELSE` | Forsinkelse hos TE | TEs arbeider er forsinket |
| `TE_MANGEL` | Mangel ved TEs ytelse | Mangel som hindrer BHs medvirkning |
| `TE_KOORDINERING` | Koordineringssvikt | TE oppfyller ikke samordningsplikt |

**Nye komponenter:**
- `SendBhFristModal.tsx` - BH sender fristkrav
- `RespondBhFristModal.tsx` - TE responderer
- `BhFristPage.tsx` - Saksvisning for BH-frist

**Varslings- og preklusjonsregler:**
- §33.4 gjelder også for BH (varsel "uten ugrunnet opphold")
- §33.6 og §33.7 gjelder tilsvarende

#### Avhengigheter
- Krever refaktorering av frist-state for å støtte begge retninger
- Vurder om `FristTilstand` skal utvides eller om det trengs `BhFristTilstand`

#### Estimert omfang
- Backend: ~200-300 linjer (ny sakstype, events, state)
- Frontend: ~500-800 linjer (nye modaler og sidevisning)
- Tester: ~100-200 linjer

---

## Implementeringsrekkefølge

### Sprint N (Høy prioritet)

| # | Tiltak | Status | Merknad |
|---|--------|--------|---------|
| 1 | Svarplikt terskel | ⏳ Åpen | Vurder om 5 dager er riktig terskel |
| 2 | Preklusjon vs Reduksjon | ✅ Implementert | Korrekt differensiering i RespondFristModal |
| 3 | Fjern reduksjonsvarsel ved etterlysning-svar | ✅ Implementert | §33.6.2 fjerde ledd beskyttelse |

### Sprint N+1 (Medium prioritet)

| # | Tiltak | Status | Merknad |
|---|--------|--------|---------|
| 4 | Forbedret helptext §33.5 | ⏳ Åpen | |
| 5 | §33.6.2 bokstav b | ✅ Implementert | `begrunnelse_utsatt` varseltype |

### Backlog (Lav prioritet)

| # | Tiltak | Status | Merknad |
|---|--------|--------|---------|
| 6 | BH proaktiv etterlysning | ⏳ Åpen | Kun reaktiv etterlysning støttet |
| 7 | §33.2 BH fristforlengelse | ⏳ Åpen | Dokumentert, ikke implementert |

### Tillegg (identifisert ved kvalitetssikring 2026-01-24)

| # | Tiltak | Status | Merknad |
|---|--------|--------|---------|
| 8 | §33.8 forsering | ✅ Implementert | SendForseringModal + forsering_service.py |
| 9 | §5 helbredelse eksplisitt | ⏳ Åpen | Bør legges til i RespondFristModal |
| 10 | VarslingsregelInfo-komponent | ⏳ Planlagt | For bedre brukerforklaring av regler |

---

## Kvalitetssikring 2026-01-24

### Funn

1. **§33.8 manglet i dokumentasjonen** - Nå lagt til i:
   - `NS8407_VARSLINGSREGLER_KARTLEGGING.md`
   - `NS8407_VARSLINGSREGLER.md`
   - `diagrams/scenario-frist.md`
   - `diagrams/uavklarte-situasjoner.md`
   - `src/constants/varslingsregler.ts`

2. **Applikasjonen hadde §33.8-støtte** - `SendForseringModal` og `forsering_service.py` var allerede implementert, men dokumentasjonen lå etter.

3. **Implementasjonsstatus kartlagt** - Se vedlegg i `NS8407_VARSLINGSREGLER_KARTLEGGING.md`.

### Identifiserte hull

| ID | Beskrivelse | Prioritet |
|----|-------------|-----------|
| H1 | §5 helbredelse ikke eksplisitt forklart | Medium |
| H2 | BH kan ikke sende proaktiv etterlysning | Lav |
| H3 | `dato_bh_etterlysning` mangler i datamodellen | Lav |
| H4 | §33.8 konsekvens for manglende varsel uavklart | Info |

---

## Referanser

- NS 8407:2011 §33 (Fristforlengelse)
- `src/components/actions/SendFristModal.tsx`
- `src/components/actions/RespondFristModal.tsx`
- `backend/models/events.py` (FristData, FristResponsData)
- `src/constants/varslingsregler.ts`
