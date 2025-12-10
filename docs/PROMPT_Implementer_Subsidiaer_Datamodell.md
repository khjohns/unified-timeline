# Implementeringsprompt: Subsidiær Datamodell

> **Formål**: Trinnvis implementering av subsidiær standpunkt-lagring iht. NS 8407
> **Dato**: 2025-12-09
> **Estimert omfang**: 9 oppgaver fordelt på backend og frontend

---

## Kontekst for LLM

Du skal implementere støtte for **subsidiære standpunkt** i unified-timeline-prosjektet. Dette er et system for håndtering av endringsmeldinger i byggeprosjekter basert på NS 8407 (Norsk Standard for totalentrepriser).

### Hva er subsidiært standpunkt?

Når Byggherren (BH) responderer på et krav fra Totalentreprenøren (TE), kan BH ta to standpunkt:

1. **Prinsipalt**: BH's hovedstandpunkt (f.eks. "Avvist - varslet for sent")
2. **Subsidiært**: BH's alternative standpunkt (f.eks. "Hvis varselet var i tide, godkjenner jeg 14 dager")

Dette er vanlig juridisk praksis og viktig for senere tvisteløsning.

### Viktige dokumenter å lese først

1. `docs/IMPLEMENTATION_PLAN_Subsidiaer_Datamodell.md` - **Hovedplanen** (les denne grundig!)
2. `docs/QA_PLAN_Subsidiaer_Datamodell.md` - Kvalitetssikring og NS 8407-verifisering
3. `NS_8407.md` - Kontraktsteksten (referanse ved behov)
4. `README.md` - Prosjektoversikt

---

## Implementeringsrekkefølge

Følg denne rekkefølgen nøye. Hver oppgave bygger på den forrige.

### FASE 1: Backend Datamodell

#### Oppgave 1: SubsidiaerTrigger enum

**Fil**: `backend/models/events.py`

**Instruksjoner**:
1. Les eksisterende enums i filen (rundt linje 41-110)
2. Legg til ny enum `SubsidiaerTrigger` etter `FristBeregningResultat` (ca. linje 110)
3. Eksporter enum i `backend/models/__init__.py`

**Kode fra implementasjonsplan**:
```python
class SubsidiaerTrigger(str, Enum):
    """
    Årsaker til at subsidiær vurdering er relevant.
    Kan kombineres - flere triggere kan gjelde samtidig.
    """
    # Nivå 0: Grunnlag
    GRUNNLAG_AVVIST = "grunnlag_avvist"

    # Nivå 1: Preklusjon (Vederlag)
    PREKLUSJON_RIGG = "preklusjon_rigg"
    PREKLUSJON_PRODUKTIVITET = "preklusjon_produktivitet"
    PREKLUSJON_EP_JUSTERING = "preklusjon_ep_justering"  # §34.3.3

    # Nivå 1: Preklusjon (Frist)
    PREKLUSJON_NOYTRALT = "preklusjon_noytralt"
    PREKLUSJON_SPESIFISERT = "preklusjon_spesifisert"

    # Nivå 2: Vilkår
    INGEN_HINDRING = "ingen_hindring"
    METODE_AVVIST = "metode_avvist"
```

**Verifisering**:
- [ ] Enum er definert korrekt
- [ ] Enum er eksportert i `__init__.py`
- [ ] Eksisterende tester passerer: `python -m pytest backend/tests/`

---

#### Oppgave 2: Oppdater VederlagResponsData

**Fil**: `backend/models/events.py`

**Instruksjoner**:
1. Finn `class VederlagResponsData` (ca. linje 635)
2. Legg til subsidiære felt etter `frist_for_spesifikasjon` (ca. linje 715)
3. Importer `List` fra typing hvis ikke allerede importert

**Nye felt**:
```python
    # ============ SUBSIDIÆRT STANDPUNKT ============
    # Brukes når BH tar et prinsipalt standpunkt (f.eks. avslag pga preklusjon)
    # men også vil angi hva resultatet ville vært subsidiært.

    subsidiaer_triggers: Optional[List[SubsidiaerTrigger]] = Field(
        default=None,
        description="Liste over årsaker til subsidiær vurdering"
    )
    subsidiaer_resultat: Optional[VederlagBeregningResultat] = Field(
        default=None,
        description="Subsidiært beregningsresultat"
    )
    subsidiaer_godkjent_belop: Optional[float] = Field(
        default=None,
        description="Subsidiært godkjent beløp i NOK"
    )
    subsidiaer_begrunnelse: Optional[str] = Field(
        default=None,
        description="BH's begrunnelse for subsidiær vurdering"
    )
```

**Verifisering**:
- [ ] Alle felt er Optional (bakoverkompatibilitet)
- [ ] Felt-beskrivelser er på norsk
- [ ] Eksisterende tester passerer

---

#### Oppgave 3: Oppdater FristResponsData

**Fil**: `backend/models/events.py`

**Instruksjoner**:
1. Finn `class FristResponsData` (ca. linje 718)
2. Legg til subsidiære felt etter `begrunnelse_beregning`

**Nye felt**:
```python
    # ============ SUBSIDIÆRT STANDPUNKT ============
    subsidiaer_triggers: Optional[List[SubsidiaerTrigger]] = Field(
        default=None,
        description="Liste over årsaker til subsidiær vurdering"
    )
    subsidiaer_resultat: Optional[FristBeregningResultat] = Field(
        default=None,
        description="Subsidiært beregningsresultat"
    )
    subsidiaer_godkjent_dager: Optional[int] = Field(
        default=None,
        description="Subsidiært godkjent antall dager"
    )
    subsidiaer_begrunnelse: Optional[str] = Field(
        default=None,
        description="BH's begrunnelse for subsidiær vurdering"
    )
```

**Verifisering**:
- [ ] Speiler VederlagResponsData-strukturen (men med `dager` i stedet for `belop`)
- [ ] Eksisterende tester passerer

---

### FASE 2: Backend State og Services

#### Oppgave 4: Oppdater VederlagTilstand i SakState

**Fil**: `backend/models/sak_state.py`

**Instruksjoner**:
1. Finn `class VederlagTilstand` (ca. linje 69)
2. Legg til subsidiære felt etter `godkjent_belop` (ca. linje 135)
3. Legg til computed fields for `har_subsidiaert_standpunkt` og `visningsstatus`

**Nye felt og computed fields** - se implementasjonsplanen seksjon "Oppgave 8".

**Verifisering**:
- [ ] `har_subsidiaert_standpunkt` returnerer bool
- [ ] `visningsstatus` returnerer korrekt kombinert status
- [ ] Eksisterende tester passerer

---

#### Oppgave 5: Oppdater FristTilstand i SakState

**Fil**: `backend/models/sak_state.py`

**Instruksjoner**:
1. Finn `class FristTilstand` (ca. linje 198)
2. Legg til tilsvarende felt som i VederlagTilstand

**Verifisering**:
- [ ] Speiler VederlagTilstand-strukturen
- [ ] Eksisterende tester passerer

---

#### Oppgave 6: Oppdater TimelineService

**Fil**: `backend/services/timeline_service.py`

**Instruksjoner**:
1. Finn `_apply_respons_vederlag()` metoden (ca. linje 350)
2. Legg til kopiering av subsidiære felt fra event til state
3. Gjør tilsvarende for `_apply_respons_frist()` (ca. linje 400)

**Eksempel for vederlag**:
```python
    # Subsidiært standpunkt (NYE linjer)
    if data.subsidiaer_triggers:
        state.vederlag.subsidiaer_triggers = [t.value for t in data.subsidiaer_triggers]
    if data.subsidiaer_resultat:
        state.vederlag.subsidiaer_resultat = data.subsidiaer_resultat
    if data.subsidiaer_godkjent_belop is not None:
        state.vederlag.subsidiaer_godkjent_belop = data.subsidiaer_godkjent_belop
    if data.subsidiaer_begrunnelse:
        state.vederlag.subsidiaer_begrunnelse = data.subsidiaer_begrunnelse
```

**Verifisering**:
- [ ] Subsidiære felt kopieres korrekt fra event til state
- [ ] Eksisterende tester passerer
- [ ] Manuell test: Opprett respons med subsidiært → verifiser at state oppdateres

---

### FASE 3: Frontend Types

#### Oppgave 7: Oppdater TypeScript types

**Fil**: `src/types/timeline.ts`

**Instruksjoner**:
1. Legg til `SubsidiaerTrigger` type (etter `GrunnlagResponsResultat`, ca. linje 63)
2. Oppdater `VederlagTilstand` interface med subsidiære felt
3. Oppdater `FristTilstand` interface med subsidiære felt

**Ny type**:
```typescript
export type SubsidiaerTrigger =
  | 'grunnlag_avvist'
  | 'preklusjon_rigg'
  | 'preklusjon_produktivitet'
  | 'preklusjon_ep_justering'
  | 'preklusjon_noytralt'
  | 'preklusjon_spesifisert'
  | 'ingen_hindring'
  | 'metode_avvist';
```

**Nye felt i interfaces** - se implementasjonsplanen seksjon "Komplett frontend-filoversikt".

**Verifisering**:
- [ ] TypeScript kompilerer uten feil: `npx tsc --noEmit`
- [ ] Types matcher backend-modellene eksakt

---

#### Oppgave 8: Legg til trigger-labels i constants

**Fil**: `src/constants/responseOptions.ts`

**Instruksjoner**:
1. Importer `SubsidiaerTrigger` type
2. Legg til `SUBSIDIAER_TRIGGER_LABELS` konstant
3. Legg til `getSubsidiaerTriggerLabel()` helper-funksjon

**Kode**:
```typescript
import type { SubsidiaerTrigger } from '../types/timeline';

export const SUBSIDIAER_TRIGGER_LABELS: Record<SubsidiaerTrigger, string> = {
  grunnlag_avvist: 'Grunnlag avvist av BH',
  preklusjon_rigg: 'Rigg/drift varslet for sent (§34.1.3)',
  preklusjon_produktivitet: 'Produktivitet varslet for sent (§34.1.3)',
  preklusjon_ep_justering: 'EP-justering varslet for sent (§34.3.3)',
  preklusjon_noytralt: 'Nøytralt varsel for sent (§33.4)',
  preklusjon_spesifisert: 'Spesifisert krav for sent (§33.6)',
  ingen_hindring: 'Ingen reell fremdriftshindring (§33.5)',
  metode_avvist: 'Metode ikke akseptert',
};

export function getSubsidiaerTriggerLabel(trigger: SubsidiaerTrigger): string {
  return SUBSIDIAER_TRIGGER_LABELS[trigger] || trigger;
}
```

**Verifisering**:
- [ ] Alle trigger-verdier har norske labels
- [ ] Labels inkluderer paragrafreferanser der relevant

---

### FASE 4: Frontend Modaler

#### Oppgave 9: Oppdater RespondVederlagModal

**Fil**: `src/components/actions/RespondVederlagModal.tsx`

**Instruksjoner**:
1. Importer `SubsidiaerTrigger` type
2. Finn `onSubmit` funksjonen (ca. linje 482)
3. Legg til beregning av subsidiære triggere
4. Inkluder triggere i mutation data

**Logikk for trigger-beregning**:
```typescript
const onSubmit = (data: RespondVederlagFormData) => {
  // Beregn subsidiære triggere
  const triggers: SubsidiaerTrigger[] = [];

  if (riggPrekludert) triggers.push('preklusjon_rigg');
  if (produktivitetPrekludert) triggers.push('preklusjon_produktivitet');

  // §34.3.3: EP-justering prekludert hvis TE krevde det men BH avviser varselet
  if (vederlagEvent?.krever_justert_ep && data.ep_justering_akseptert === false) {
    triggers.push('preklusjon_ep_justering');
  }

  if (!formValues.aksepterer_metode) triggers.push('metode_avvist');

  mutation.mutate({
    eventType: 'respons_vederlag',
    data: {
      // ... eksisterende felt ...

      // Subsidiært resultat (kun når relevant)
      subsidiaer_triggers: triggers.length > 0 ? triggers : undefined,
      subsidiaer_resultat: visSubsidiaertResultat ? subsidiaertResultat : undefined,
      subsidiaer_godkjent_belop: visSubsidiaertResultat
        ? computed.totalGodkjentInklPrekludert
        : undefined,
      subsidiaer_begrunnelse: visSubsidiaertResultat
        ? data.begrunnelse_samlet
        : undefined,
    },
  });
};
```

**Verifisering**:
- [ ] Triggere beregnes korrekt basert på wizard-valg
- [ ] EP-justering trigger utløses kun når relevant
- [ ] Subsidiært resultat sendes kun når `visSubsidiaertResultat` er true

---

#### Oppgave 10: Oppdater RespondFristModal

**Fil**: `src/components/actions/RespondFristModal.tsx`

**Instruksjoner**:
1. Tilsvarende endringer som for RespondVederlagModal
2. Bruk frist-spesifikke triggere (`preklusjon_noytralt`, `preklusjon_spesifisert`, `ingen_hindring`)

**Verifisering**:
- [ ] Triggere beregnes korrekt
- [ ] `subsidiaer_godkjent_dager` (ikke `belop`) sendes

---

#### Oppgave 11: Oppdater EventDetailModal

**Fil**: `src/components/views/EventDetailModal.tsx`

**Instruksjoner**:
1. Importer trigger-labels fra constants
2. Finn `ResponsVederlagSection` (ca. linje 556)
3. Legg til visning av subsidiært standpunkt med amber bakgrunn
4. Gjør tilsvarende for `ResponsFristSection` (ca. linje 667)

Se implementasjonsplanen seksjon "Oppgave 5" for detaljert kode.

**Verifisering**:
- [ ] Subsidiært standpunkt vises med amber bakgrunn
- [ ] Trigger-labels vises som liste
- [ ] Prinsipalt resultat vises med mørk blå bakgrunn (eksisterende)
- [ ] Begrunnelse vises hvis tilgjengelig

---

### FASE 5: Testing og Verifisering

#### Oppgave 12: Backend-tester

**Fil**: `backend/tests/test_events.py` (opprett eller utvid)

**Tester å legge til**:
```python
def test_vederlag_respons_med_subsidiaer():
    """Test at subsidiære felt lagres korrekt"""
    # Se implementasjonsplan for testkode

def test_frist_respons_med_flere_triggers():
    """Test kaskaderende subsidiære triggere"""
    # Se implementasjonsplan for testkode

def test_bakoverkompatibilitet():
    """Test at eksisterende data uten subsidiære felt fungerer"""
    # Se implementasjonsplan for testkode
```

---

#### Oppgave 13: Manuell testing

**Testscenario 1: Vederlag med prekludert rigg**
1. Opprett sak med grunnlag
2. Send vederlagskrav med rigg/drift
3. BH responderer: Rigg varslet for sent, men subsidiært godkjent 50.000
4. Verifiser at EventDetailModal viser begge resultater

**Testscenario 2: Frist med kaskade**
1. Opprett sak med grunnlag
2. Send fristkrav (30 dager)
3. BH responderer: Varsel for sent OG ingen hindring, subsidiært 14 dager
4. Verifiser at begge triggere vises

**Testscenario 3: Bakoverkompatibilitet**
1. Åpne eksisterende sak med gammel respons (uten subsidiære felt)
2. Verifiser at UI fungerer uten feil
3. Verifiser at ingen "undefined" vises

---

## NS 8407-referanser

Under implementering, verifiser mot disse paragrafene:

| Trigger | Paragraf | Tekst (utdrag) |
|---------|----------|----------------|
| `preklusjon_rigg` | §34.1.3 | "må han varsle byggherren særskilt uten ugrunnet opphold" |
| `preklusjon_produktivitet` | §34.1.3 | "økte utgifter på grunn av nedsatt produktivitet" |
| `preklusjon_ep_justering` | §34.3.3 | "varsle den andre parten uten ugrunnet opphold" |
| `preklusjon_noytralt` | §33.4 | "Krav på fristforlengelse tapes dersom det ikke varsles" |
| `preklusjon_spesifisert` | §33.6 | "har han bare krav på slik fristforlengelse som den andre parten måtte forstå" |
| `ingen_hindring` | §33.5 | "svare til den virkning på fremdriften som forhold har forårsaket" |

---

## Sjekkliste for fullført implementering

### Backend
- [ ] `SubsidiaerTrigger` enum definert og eksportert
- [ ] `VederlagResponsData` har subsidiære felt
- [ ] `FristResponsData` har subsidiære felt
- [ ] `VederlagTilstand` har subsidiære felt og computed fields
- [ ] `FristTilstand` har subsidiære felt og computed fields
- [ ] `TimelineService` kopierer subsidiære felt til state
- [ ] Alle backend-tester passerer

### Frontend
- [ ] `SubsidiaerTrigger` type definert
- [ ] `VederlagTilstand` interface oppdatert
- [ ] `FristTilstand` interface oppdatert
- [ ] `SUBSIDIAER_TRIGGER_LABELS` konstant definert
- [ ] `RespondVederlagModal` beregner og sender triggere
- [ ] `RespondFristModal` beregner og sender triggere
- [ ] `EventDetailModal` viser subsidiært standpunkt
- [ ] TypeScript kompilerer uten feil
- [ ] Alle frontend-tester passerer

### Integrasjon
- [ ] Manuell test: Vederlag med subsidiært standpunkt
- [ ] Manuell test: Frist med kaskaderende triggere
- [ ] Manuell test: Bakoverkompatibilitet med gamle data

---

## Tips for implementering

1. **Kjør tester ofte**: Etter hver endring, kjør `python -m pytest` og `npx tsc --noEmit`
2. **Les eksisterende kode først**: Forstå mønstrene før du endrer
3. **Bakoverkompatibilitet**: Alle nye felt SKAL være `Optional`
4. **Norske beskrivelser**: Field descriptions skal være på norsk
5. **Paragrafreferanser**: Inkluder §-referanser i labels og kommentarer

---

*Prompt opprettet: 2025-12-09*
*Basert på: IMPLEMENTATION_PLAN_Subsidiaer_Datamodell.md*
