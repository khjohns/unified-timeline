# Prompt: Analyse av subsidiær standpunkt-lagring i datamodell

> **Formål**: Få en grundig analyse og anbefaling om hvordan BH's subsidiære standpunkt bør håndteres i datamodellen for Unified Timeline.

---

## Kontekst

Du er en erfaren systemarkitekt med kompetanse innen:
- Datamodellering for juridiske/kontraktsbaserte systemer
- Event Sourcing og CQRS-mønstre
- NS 8407 (Norsk Standard for totalentrepriser)
- Microsoft Dataverse som produksjonsdatabase

### Om systemet

**Unified Timeline** er et system for håndtering av endringskrav i byggeprosjekter etter NS 8407. Systemet bruker Event Sourcing Light - alle tilstandsendringer skjer via immutable events.

**Aktører:**
- **TE** (Totalentreprenør): Sender krav om vederlag (penger) og fristforlengelse (tid)
- **BH** (Byggherre): Responderer på krav med godkjenning, avslag, eller delvis godkjenning

**Tre parallelle spor:**
1. **Grunnlag**: Ansvarsgrunnlaget (hvem sin feil er det?)
2. **Vederlag**: Pengekrav (§34)
3. **Frist**: Tidskrav (§33)

### Nåværende arkitektur

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Respond Modal  │────▶│   Event Store   │────▶│ TimelineService │
│  (wizard form)  │     │   (JSON/DB)     │     │ (compute state) │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                                                │
        │ Beregner både                                  │
        │ prinsipalt OG                                  ▼
        │ subsidiært                          ┌─────────────────────┐
        │                                     │  EventDetailModal   │
        │                                     │  (viser event data) │
        └────────────────────────────────────▶└─────────────────────┘
```

---

## Problemstilling

### NS 8407 Port-modellen

BH's respons på vederlag- og fristkrav følger en sekvensiell "port-modell":

**Vederlagskrav (§34):**
```
Port 1: Preklusjon av særskilte krav (§34.1.3)
  ├─ Rigg/drift varslet i tide?
  └─ Produktivitetstap varslet i tide?
        │
        ▼
Port 2: Metode & Svarplikt
  ├─ Aksepterer metode?
  └─ Tilbakeholdelse (§30.2)?
        │
        ▼
Port 3: Beløpsvurdering
  ├─ Hovedkrav: godkjent/delvis/avvist
  ├─ Rigg: godkjent/delvis/avvist (eller prekludert fra Port 1)
  └─ Produktivitet: godkjent/delvis/avvist (eller prekludert fra Port 1)
        │
        ▼
Port 4: Oppsummering
  ├─ PRINSIPALT RESULTAT (respekterer preklusion)
  └─ SUBSIDIÆRT RESULTAT (ignorerer preklusion)
```

**Fristkrav (§33):**
```
Port 1: Preklusjon (§33.4, §33.6)
  ├─ Nøytralt varsel i tide?
  └─ Spesifisert krav i tide?
        │
        ▼
Port 2: Vilkår (§33.5)
  └─ Faktisk fremdriftshindring?
        │
        ▼
Port 3: Beregning
  └─ Godkjent antall dager
        │
        ▼
Port 4: Oppsummering
  ├─ PRINSIPALT RESULTAT (respekterer preklusion + vilkår)
  └─ SUBSIDIÆRT RESULTAT (ignorerer preklusion, respekterer vilkår)
```

### Hva "subsidiært standpunkt" betyr juridisk

I entrepriserett kan BH innta et **subsidiært standpunkt**:

> "Prinsipalt avviser jeg kravet fordi varsel kom for sent (preklusjon).
> **Subsidiært**, dersom retten skulle komme til at varselet var i tide,
> godkjenner jeg 150.000 kr av de krevde 200.000 kr."

Dette er viktig fordi:
1. Det dokumenterer BH's reelle vurdering av kravet
2. Det gir forutsigbarhet ved forhandlinger
3. Det kan være avgjørende i en eventuell tvist

### Problemet med nåværende datamodell

**Nåværende `VederlagResponsData`:**
```python
class VederlagResponsData(BaseModel):
    # Port 1: Varselvurdering
    saerskilt_varsel_rigg_drift_ok: Optional[bool] = None
    varsel_justert_ep_ok: Optional[bool] = None
    varsel_start_regning_ok: Optional[bool] = None
    krav_fremmet_i_tide: bool = True
    begrunnelse_varsel: Optional[str] = None

    # Port 2: Metode
    vederlagsmetode: Optional[VederlagsMetode] = None

    # Port 3: Beregning (KUN PRINSIPALT)
    beregnings_resultat: VederlagBeregningResultat  # <-- Kun prinsipalt!
    godkjent_belop: Optional[float] = None          # <-- Kun prinsipalt!
    begrunnelse_beregning: str = ""
    frist_for_spesifikasjon: Optional[str] = None
```

**Nåværende `FristResponsData`:**
```python
class FristResponsData(BaseModel):
    # Port 1: Varselvurdering
    noytralt_varsel_ok: Optional[bool] = None
    spesifisert_krav_ok: bool = True
    har_bh_etterlyst: Optional[bool] = None
    begrunnelse_varsel: Optional[str] = None

    # Port 2: Vilkår
    vilkar_oppfylt: bool = True
    begrunnelse_vilkar: Optional[str] = None

    # Port 3: Beregning (KUN PRINSIPALT)
    beregnings_resultat: FristBeregningResultat  # <-- Kun prinsipalt!
    godkjent_dager: Optional[int] = None         # <-- Kun prinsipalt!
    ny_sluttdato: Optional[str] = None
    begrunnelse_beregning: Optional[str] = None
```

**Hva som skjer i praksis:**

1. BH fyller ut Respond-modal med wizard
2. Frontend beregner `prinsipaltResultat` og `subsidiaertResultat`
3. Kun `prinsipaltResultat` lagres som `beregnings_resultat`
4. Det subsidiære standpunktet **forsvinner**

---

## Mulige løsninger

### Alternativ A: Enkel utvidelse

Legg til tre felt per responstype:

```python
class VederlagResponsData(BaseModel):
    # ... eksisterende felt ...

    # NYE felt for subsidiært standpunkt
    subsidiaer_resultat: Optional[VederlagBeregningResultat] = None
    subsidiaer_godkjent_belop: Optional[float] = None
    subsidiaer_begrunnelse: Optional[str] = None
```

```python
class FristResponsData(BaseModel):
    # ... eksisterende felt ...

    # NYE felt for subsidiært standpunkt
    subsidiaer_resultat: Optional[FristBeregningResultat] = None
    subsidiaer_godkjent_dager: Optional[int] = None
    subsidiaer_begrunnelse: Optional[str] = None
```

**Fordeler:**
- Bakoverkompatibelt
- Minimal endring
- Dekker hovedbrukstilfellet

**Ulemper:**
- Kun ett overordnet subsidiært resultat
- Ikke per-krav granularitet

### Alternativ B: Strukturerte port-evalueringer

Introduser nye modeller for per-port evalueringer:

```python
class BelopEvaluering(BaseModel):
    """Evaluering av én kravkomponent med prinsipal/subsidiær"""
    krevd_belop: Optional[float] = None

    # Prinsipal vurdering
    prinsipal_status: Literal['godkjent', 'delvis', 'avvist', 'prekludert']
    prinsipal_godkjent_belop: Optional[float] = None
    prinsipal_begrunnelse: Optional[str] = None

    # Subsidiær vurdering (kun relevant hvis prinsipal er 'prekludert')
    subsidiaer_status: Optional[Literal['godkjent', 'delvis', 'avvist']] = None
    subsidiaer_godkjent_belop: Optional[float] = None
    subsidiaer_begrunnelse: Optional[str] = None


class VederlagResponsData(BaseModel):
    # ... eksisterende varselfelt ...

    # Port 3: Per-krav evalueringer
    hovedkrav: Optional[BelopEvaluering] = None
    rigg_krav: Optional[BelopEvaluering] = None
    produktivitet_krav: Optional[BelopEvaluering] = None

    # Beregnede totaler (for enkel tilgang)
    prinsipal_total_resultat: VederlagBeregningResultat
    prinsipal_total_belop: Optional[float] = None
    subsidiaer_total_resultat: Optional[VederlagBeregningResultat] = None
    subsidiaer_total_belop: Optional[float] = None
```

**Fordeler:**
- Full sporbarhet per kravkomponent
- Støtter komplekse scenarier med flere subsidiære nivåer
- Klar datamodell for Dataverse-migrering

**Ulemper:**
- Større endring
- Krever oppdatering av Respond-modaler
- Mer kompleks serialisering

### Alternativ C: Beregn ved visning

Ikke lagre subsidiært resultat - beregn det fra eksisterende felt ved visning.

```typescript
// I EventDetailModal
function computeSubsidiaerResultat(data: ResponsVederlagEventData): string | null {
  // Hvis ingen preklusion, er subsidært = prinsipalt
  if (data.saerskilt_varsel_rigg_drift_ok !== false &&
      data.varsel_justert_ep_ok !== false) {
    return null;
  }

  // Beregn hva resultatet ville vært uten preklusion
  // ... logikk basert på godkjent_belop og krav_belop ...
}
```

**Fordeler:**
- Ingen datamodell-endring
- Fungerer med eksisterende data

**Ulemper:**
- Krever at frontend har all nødvendig informasjon
- Kan gi inkonsistente resultater
- BH's faktiske subsidiære vurdering er ikke eksplisitt lagret

### Alternativ D: Separat subsidiær event

Introduser en ny event-type for subsidiære vurderinger:

```python
class SubsidiaerVurderingEvent(SakEvent):
    """BH tar subsidiært standpunkt på et tidligere avslått/prekludert krav"""
    event_type: EventType = EventType.SUBSIDIAER_VURDERING
    refererer_til_respons_id: str  # Peker til den prinsipale responsen

    # Subsidiær vurdering
    subsidiaer_resultat: Union[VederlagBeregningResultat, FristBeregningResultat]
    subsidiaer_verdi: Optional[float] = None  # Beløp eller dager
    begrunnelse: str
```

**Fordeler:**
- Ren Event Sourcing-tilnærming
- Subsidiært standpunkt er en eksplisitt hendelse
- Full historikk

**Ulemper:**
- Øker kompleksitet i state-beregning
- To events for én logisk handling
- Kan forvirre brukere

---

## Spørsmål til analyse

1. **Datamodell-design:**
   - Hvilket alternativ gir best balanse mellom enkelhet og uttrykksevne?
   - Hvordan bør modellen håndtere flere subsidiære nivåer (f.eks. "subsidiært til subsidiært")?

2. **Event Sourcing-prinsipper:**
   - Er det riktig å lagre beregnede verdier (prinsipal/subsidiær resultat) i events?
   - Eller bør dette beregnes fra rå-data ved visning?

3. **Dataverse-migrering:**
   - Hvordan påvirker valget fremtidig migrering til Dataverse?
   - Er det fordeler med å velge en Dataverse-vennlig struktur nå?

4. **NS 8407-kompleksitet:**
   - Er det scenarier i NS 8407 som krever mer enn to nivåer (prinsipal + subsidiær)?
   - Bør modellen støtte vilkårlig mange subsidiære standpunkter?

5. **Brukeropplevelse:**
   - Hva skal vises i EventDetailModal når det er subsidiært standpunkt?
   - Skal det være mulig å filtrere/søke på subsidiære resultater?

---

## Forventet output

Gi en strukturert analyse med:

1. **Anbefalt løsning** med begrunnelse
2. **Datamodell-spesifikasjon** (Pydantic/TypeScript)
3. **Migreringsplan** fra nåværende modell
4. **UI-mockup** for visning av subsidiære standpunkt
5. **Risikovurdering** og eventuelle bekymringer

---

## Referansefiler

For fullstendig kontekst, les følgende filer:
- `backend/models/events.py` - Eksisterende event-modeller
- `src/types/timeline.ts` - Frontend-typer
- `src/components/views/EventDetailModal.tsx` - Visningskomponent
- `src/components/actions/RespondVederlagModal.tsx` - Vederlag-wizard
- `src/components/actions/RespondFristModal.tsx` - Frist-wizard
- `docs/IMPLEMENTATION_PLAN_EventDetailModal.md` - Implementasjonsplan

---

*Opprettet: 2025-12-09*
*Kontekst: Task 4 i IMPLEMENTATION_PLAN_EventDetailModal.md*
