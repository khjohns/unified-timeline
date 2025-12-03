# Event Sourcing Refaktorering: Subsidiær Logikk & Port-Modellen

**Dato:** 2025-12-03
**Formål:** Implementere NS 8407 Port-modellen og støtte for subsidiære betraktninger

---

## Sammendrag

Dette er en omfattende refaktorering av Event Sourcing-datamodellene for å støtte kompleks juridisk logikk i norske byggekontrakter (NS 8407). Hovedmålet er å muliggjøre **subsidiære betraktninger** - hvor Byggherren (BH) kan avvise ansvar (Grunnlag), men samtidig godkjenne beregningen (Vederlag/Frist) som subsidiær vurdering.

### Kjerneprinsippet: "Rene" Sporvurderinger

**Før:**
- VederlagResponsResultat hadde `avslatt_uenig_grunnlag` ❌
- Ansvar og beregning var blandet sammen
- Subsidiære betraktninger var umulig å representere

**Etter:**
- VederlagBeregningResultat beskriver KUN beregningen ✅
- Grunnlag (ansvar) og Vederlag (beregning) er fullstendig separert
- Subsidiære betraktninger håndteres av computed fields i SakState

---

## Del 1: Backend Refaktorering

### 1.1 Nye Enums (events.py)

#### VederlagsMetode
```python
class VederlagsMetode(str, Enum):
    """NS 8407 vederlagsmetoder"""
    KONTRAKT_EP = "kontrakt_ep"      # Kontraktens enhetspriser
    JUSTERT_EP = "justert_ep"        # Justerte enhetspriser
    REGNING = "regning"              # Regningsarbeid
    TILBUD = "tilbud"                # Fastpris / Tilbud
    SKJONN = "skjonn"                # Skjønnsmessig vurdering
```

#### VederlagBeregningResultat
```python
class VederlagBeregningResultat(str, Enum):
    """Resultat av beregningsvurdering (Port 2 - ren utmåling)"""
    GODKJENT_FULLT = "godkjent_fullt"
    DELVIS_GODKJENT = "delvis_godkjent"
    GODKJENT_ANNEN_METODE = "godkjent_annen_metode"
    AVVENTER_SPESIFIKASJON = "avventer_spesifikasjon"
    AVSLATT_TOTALT = "avslatt_totalt"  # Kun ved f.eks. dobbeltfakturering

# ❌ FJERNET: avslatt_uenig_grunnlag
# Det hører hjemme i Grunnlag-sporet, ikke her!
```

#### FristVarselType
```python
class FristVarselType(str, Enum):
    """Type varsel for frist (NS 8407 §33)"""
    NOYTRALT = "noytralt"        # §33.4 - Nøytralt varsel (uten dager)
    SPESIFISERT = "spesifisert"  # §33.6 - Spesifisert krav (med dager)
    BEGGE = "begge"              # Først nøytralt, så spesifisert
```

#### FristBeregningResultat
```python
class FristBeregningResultat(str, Enum):
    """Resultat av fristberegning (Port 3 - ren utmåling)"""
    GODKJENT_FULLT = "godkjent_fullt"
    DELVIS_GODKJENT = "delvis_godkjent"
    AVVENTER_SPESIFIKASJON = "avventer_spesifikasjon"

# ❌ FJERNET: avslatt_uenig_grunnlag
```

---

### 1.2 VederlagData (Entreprenørens Krav)

**Nye felter for Port 1 (Spesifikke varsler):**

```python
class VederlagData(BaseModel):
    # Grunnleggende krav
    krav_belop: float
    metode: VederlagsMetode
    begrunnelse: str

    # ============ PORT 1: SPESIFIKKE VARSLER (NS 8407) ============

    # Rigg & Drift (§34.1.3)
    inkluderer_rigg_drift: bool = False
    saerskilt_varsel_rigg_drift_dato: Optional[str] = None  # YYYY-MM-DD
    rigg_drift_belop: Optional[float] = None

    # Justerte enhetspriser (§34.3.3)
    krever_justert_ep: bool = False
    varsel_justert_ep_dato: Optional[str] = None

    # Regningsarbeid (§30.1)
    krever_regningsarbeid: bool = False
    varsel_start_regning_dato: Optional[str] = None

    # Generelt krav fremmet
    krav_fremmet_dato: Optional[str] = None
```

**Eksempel:**
```python
vederlag_event = VederlagEvent(
    sak_id="SAK-001",
    aktor="John Doe",
    aktor_rolle="TE",
    data=VederlagData(
        krav_belop=250000.0,
        metode=VederlagsMetode.REGNING,
        begrunnelse="Ekstraarbeid pga. endret grunnforhold",

        # TE dokumenterer at rigg/drift er varslet i tide
        inkluderer_rigg_drift=True,
        saerskilt_varsel_rigg_drift_dato="2025-11-15",
        rigg_drift_belop=50000.0,

        # TE dokumenterer at regningsarbeid er varslet før start
        krever_regningsarbeid=True,
        varsel_start_regning_dato="2025-11-10",

        krav_fremmet_dato="2025-11-20"
    )
)
```

---

### 1.3 FristData (Entreprenørens Krav)

**Nye felter for å skille nøytralt vs. spesifisert varsel:**

```python
class FristData(BaseModel):
    # ============ VARSELTYPE (PORT 1) ============
    varsel_type: FristVarselType
    noytralt_varsel_dato: Optional[str] = None    # §33.4
    spesifisert_krav_dato: Optional[str] = None   # §33.6

    # Kravet (kun relevant ved SPESIFISERT eller BEGGE)
    antall_dager: Optional[int] = None
    frist_type: Literal["kalenderdager", "arbeidsdager"] = "kalenderdager"
    begrunnelse: str

    # Fremdriftsinfo (Port 2 - Vilkår)
    pavirker_kritisk_linje: bool = False
    milepael_pavirket: Optional[str] = None
    fremdriftsanalyse_vedlagt: bool = False
    ny_sluttdato: Optional[str] = None
```

**Eksempel - Nøytralt varsel:**
```python
frist_event = FristEvent(
    sak_id="SAK-001",
    aktor="John Doe",
    aktor_rolle="TE",
    data=FristData(
        varsel_type=FristVarselType.NOYTRALT,
        noytralt_varsel_dato="2025-11-05",
        begrunnelse="Grunnforhold undersøkes. Forsinkelse mulig.",
        antall_dager=None,  # Ikke spesifisert enda
        pavirker_kritisk_linje=True,
        milepael_pavirket="Innflytting Q2 2026"
    )
)
```

**Eksempel - Spesifisert krav:**
```python
frist_event = FristEvent(
    sak_id="SAK-001",
    aktor="John Doe",
    aktor_rolle="TE",
    data=FristData(
        varsel_type=FristVarselType.SPESIFISERT,
        spesifisert_krav_dato="2025-11-25",
        antall_dager=14,  # Spesifisert krav
        frist_type="kalenderdager",
        begrunnelse="Grunnarbeid forsinket 14 dager pga. fjell i grunnen",
        pavirker_kritisk_linje=True,
        fremdriftsanalyse_vedlagt=True,
        ny_sluttdato="2026-06-15"
    )
)
```

---

### 1.4 VederlagResponsData (BH Respons - Port-Modellen)

**Port 1: Varselvurderinger**
```python
class VederlagResponsData(BaseModel):
    # ============ PORT 1: SPESIFIKKE VARSLER FOR PENGER ============
    saerskilt_varsel_rigg_drift_ok: Optional[bool] = None
    varsel_justert_ep_ok: Optional[bool] = None
    varsel_start_regning_ok: Optional[bool] = None
    krav_fremmet_i_tide: bool = True
    begrunnelse_varsel: Optional[str] = None

    # ============ PORT 2: BEREGNING & METODE ============
    vederlagsmetode: Optional[VederlagsMetode] = None
    beregnings_resultat: VederlagBeregningResultat
    godkjent_belop: Optional[float] = None
    begrunnelse_beregning: str = ""
```

**Eksempel - Subsidiær godkjenning:**
```python
# BH har allerede avvist Grunnlag (i RESPONS_GRUNNLAG event)
# Men BH godkjenner beregningen subsidiært:

vederlag_respons = ResponsEvent(
    sak_id="SAK-001",
    event_type=EventType.RESPONS_VEDERLAG,
    spor=SporType.VEDERLAG,
    aktor="Jane Smith",
    aktor_rolle="BH",
    refererer_til_event_id="vederlag-event-123",
    data=VederlagResponsData(
        # Port 1: Varselvurderinger
        saerskilt_varsel_rigg_drift_ok=True,
        varsel_start_regning_ok=True,
        krav_fremmet_i_tide=True,
        begrunnelse_varsel="Alle varslingsfrister er overholdt.",

        # Port 2: Ren beregning (subsidiært)
        vederlagsmetode=VederlagsMetode.REGNING,
        beregnings_resultat=VederlagBeregningResultat.GODKJENT_FULLT,
        godkjent_belop=250000.0,
        begrunnelse_beregning=(
            "Beregningen er korrekt og dokumentert. "
            "Godkjennes subsidiært (ansvar avvist i Grunnlag)."
        )
    )
)
```

---

### 1.5 FristResponsData (BH Respons - Port-Modellen)

**Tre porter:**

```python
class FristResponsData(BaseModel):
    # ============ PORT 1: PREKLUSJON (Varslene) ============
    noytralt_varsel_ok: Optional[bool] = None
    spesifisert_krav_ok: bool = True
    har_bh_etterlyst: Optional[bool] = None
    begrunnelse_varsel: Optional[str] = None

    # ============ PORT 2: VILKÅR (Årsakssammenheng) ============
    vilkar_oppfylt: bool = True
    begrunnelse_vilkar: Optional[str] = None

    # ============ PORT 3: UTMÅLING (Beregning av dager) ============
    beregnings_resultat: FristBeregningResultat
    godkjent_dager: Optional[int] = None
    ny_sluttdato: Optional[str] = None
    begrunnelse_beregning: Optional[str] = None
```

**Eksempel - Full godkjenning med alle tre porter:**
```python
frist_respons = ResponsEvent(
    sak_id="SAK-001",
    event_type=EventType.RESPONS_FRIST,
    spor=SporType.FRIST,
    aktor="Jane Smith",
    aktor_rolle="BH",
    data=FristResponsData(
        # Port 1: Varsling OK
        noytralt_varsel_ok=True,
        spesifisert_krav_ok=True,
        begrunnelse_varsel="Nøytralt varsel 05.11, spesifisert krav 25.11. OK.",

        # Port 2: Vilkår oppfylt (årsakssammenheng bekreftet)
        vilkar_oppfylt=True,
        begrunnelse_vilkar="Fjell i grunnen medførte faktisk forsinkelse på kritisk linje.",

        # Port 3: Beregning godkjent
        beregnings_resultat=FristBeregningResultat.GODKJENT_FULLT,
        godkjent_dager=14,
        ny_sluttdato="2026-06-15",
        begrunnelse_beregning="Fremdriftsanalyse dokumenterer 14 dager forsinkelse."
    )
)
```

**Eksempel - Subsidiær godkjenning (Port 3 OK, men Grunnlag avvist):**
```python
# BH har avvist Grunnlag (ansvar)
# Men BH godkjenner dagberegningen subsidiært:

frist_respons = ResponsEvent(
    sak_id="SAK-001",
    event_type=EventType.RESPONS_FRIST,
    spor=SporType.FRIST,
    aktor="Jane Smith",
    aktor_rolle="BH",
    data=FristResponsData(
        # Port 1: Varsling OK
        spesifisert_krav_ok=True,

        # Port 2: Vilkår oppfylt (JA, det medførte hindring)
        vilkar_oppfylt=True,
        begrunnelse_vilkar="Forholdet har medført faktisk forsinkelse.",

        # Port 3: Beregning godkjent (subsidiært)
        beregnings_resultat=FristBeregningResultat.GODKJENT_FULLT,
        godkjent_dager=14,
        begrunnelse_beregning=(
            "Dagberegningen er korrekt. "
            "Godkjennes subsidiært (ansvar avvist i Grunnlag)."
        )
    )
)
```

---

### 1.6 SakState - Computed Fields

**Nye computed fields for subsidiær logikk:**

```python
class SakState(BaseModel):
    # ... eksisterende felter ...

    @computed_field
    @property
    def er_subsidiaert_vederlag(self) -> bool:
        """
        Returns True hvis:
        - Grunnlag er AVVIST av BH, MEN
        - Vederlag-beregningen er godkjent (fullt/delvis)
        """
        grunnlag_avvist = self.grunnlag.status == SporStatus.AVVIST
        beregning_godkjent = self.vederlag.bh_resultat in {
            VederlagBeregningResultat.GODKJENT_FULLT,
            VederlagBeregningResultat.DELVIS_GODKJENT,
            VederlagBeregningResultat.GODKJENT_ANNEN_METODE,
        }
        return grunnlag_avvist and beregning_godkjent

    @computed_field
    @property
    def visningsstatus_vederlag(self) -> str:
        """
        Beregner visningsstatus for Vederlag.

        Eksempler:
        - "Avslått pga. ansvar (Subsidiært enighet om 50 000 kr)"
        - "Godkjent - 120 000 kr"
        - "Under behandling"
        """
        if self.er_subsidiaert_vederlag:
            belop = f"{self.vederlag.godkjent_belop:,.0f} kr"
            if self.vederlag.bh_resultat == VederlagBeregningResultat.GODKJENT_FULLT:
                return f"Avslått pga. ansvar (Subsidiært enighet om {belop})"
            # ... osv

        # Normal (prinsipal) status
        # ... vanlig statusmapping
```

---

## Del 2: Frontend Refaktorering

### 2.1 TypeScript Types

**Nye types i timeline.ts:**

```typescript
export type VederlagsMetode =
  | 'kontrakt_ep'
  | 'justert_ep'
  | 'regning'
  | 'tilbud'
  | 'skjonn';

export type VederlagBeregningResultat =
  | 'godkjent_fullt'
  | 'delvis_godkjent'
  | 'godkjent_annen_metode'
  | 'avventer_spesifikasjon'
  | 'avslatt_totalt';

export type FristVarselType =
  | 'noytralt'
  | 'spesifisert'
  | 'begge';

export type FristBeregningResultat =
  | 'godkjent_fullt'
  | 'delvis_godkjent'
  | 'avventer_spesifikasjon';
```

### 2.2 SakState Interface

```typescript
export interface SakState {
  // ... eksisterende felter ...

  // Nye computed fields
  er_subsidiaert_vederlag: boolean;
  er_subsidiaert_frist: boolean;
  visningsstatus_vederlag: string;
  visningsstatus_frist: string;

  // ...
}
```

### 2.3 VederlagTilstand Interface

```typescript
export interface VederlagTilstand {
  status: SporStatus;

  // TE's krav
  krevd_belop?: number;
  metode?: VederlagsMetode;

  // TE's varselinfo (Port 1)
  saerskilt_varsel_rigg_drift_dato?: string;
  varsel_justert_ep_dato?: string;
  varsel_start_regning_dato?: string;
  krav_fremmet_dato?: string;

  // BH respons - Port 1 (Varsling)
  saerskilt_varsel_rigg_drift_ok?: boolean;
  varsel_justert_ep_ok?: boolean;
  varsel_start_regning_ok?: boolean;
  krav_fremmet_i_tide?: boolean;
  begrunnelse_varsel?: string;

  // BH respons - Port 2 (Beregning)
  bh_resultat?: VederlagBeregningResultat;
  bh_begrunnelse?: string;
  bh_metode?: VederlagsMetode;
  godkjent_belop?: number;

  // ...
}
```

---

## Del 3: TimelineService Oppdateringer

### 3.1 Ny Helper: _beregnings_resultat_til_status

```python
def _beregnings_resultat_til_status(self, resultat) -> SporStatus:
    """
    Mapper VederlagBeregningResultat eller FristBeregningResultat til SporStatus.

    VIKTIG: Dette mapper KUN beregningsresultatet, ikke grunnlag.
    """
    if resultat_value in ['godkjent_fullt', 'godkjent_annen_metode']:
        return SporStatus.GODKJENT
    elif resultat_value == 'delvis_godkjent':
        return SporStatus.DELVIS_GODKJENT
    # ... osv
```

### 3.2 Oppdaterte Event Handlers

**_handle_respons_vederlag:**
```python
def _handle_respons_vederlag(self, state: SakState, event: ResponsEvent) -> SakState:
    vederlag = state.vederlag

    # Port 1: Varselvurderinger
    if hasattr(event.data, 'saerskilt_varsel_rigg_drift_ok'):
        vederlag.saerskilt_varsel_rigg_drift_ok = event.data.saerskilt_varsel_rigg_drift_ok
    # ... alle Port 1 felter

    # Port 2: Beregning
    if hasattr(event.data, 'beregnings_resultat'):
        vederlag.bh_resultat = event.data.beregnings_resultat
    # ... alle Port 2 felter

    # Map beregnings_resultat til status
    if hasattr(event.data, 'beregnings_resultat'):
        vederlag.status = self._beregnings_resultat_til_status(event.data.beregnings_resultat)

    return state
```

---

## Del 4: UI-visning

### 4.1 Bruk av Computed Fields i Frontend

```typescript
// I en React-komponent:
function VederlagStatusCard({ sakState }: { sakState: SakState }) {
  return (
    <Card>
      <h3>Vederlag</h3>
      <StatusBadge
        status={sakState.vederlag.status}
        displayText={sakState.visningsstatus_vederlag}
      />

      {sakState.er_subsidiaert_vederlag && (
        <Alert variant="info">
          Beregningen er godkjent subsidiært.
          Utbetales kun hvis ansvarsspørsmålet endres.
        </Alert>
      )}

      <div>
        <p>Krevd: {formatCurrency(sakState.vederlag.krevd_belop)}</p>
        <p>Godkjent: {formatCurrency(sakState.vederlag.godkjent_belop)}</p>
      </div>
    </Card>
  );
}
```

### 4.2 Eksempel Visning

**Scenario: Subsidiært godkjent vederlag**

```
┌─────────────────────────────────────────────────────┐
│ 🔴 Grunnlag                                         │
│ Status: Avvist                                      │
│ BH mener: TE har ansvar for svikt i prosjektering  │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ 💰 Vederlag                                         │
│ Status: Avslått pga. ansvar                         │
│        (Subsidiært enighet om 250 000 kr)           │
│                                                     │
│ ℹ️ Beregningen er godkjent subsidiært.              │
│    Utbetales kun hvis ansvarsspørsmålet endres.    │
│                                                     │
│ Krevd:     250 000 kr                               │
│ Godkjent:  250 000 kr                               │
│ Metode:    Regningsarbeid                           │
└─────────────────────────────────────────────────────┘
```

---

## Del 5: Migreringsstrategi

### 5.1 Backward Compatibility

**Gammel kode fungerer fortsatt:**
```python
# Gammel ResponsResultat fungerer fortsatt
vederlag_respons = VederlagResponsData(
    resultat=ResponsResultat.GODKJENT,  # ❌ Gammel enum
    # ...
)
```

**TimelineService fallback:**
```python
# Fallback til gammel mapping hvis nye felter mangler
if hasattr(event.data, 'beregnings_resultat'):
    vederlag.status = self._beregnings_resultat_til_status(event.data.beregnings_resultat)
elif hasattr(event.data, 'resultat'):
    vederlag.status = self._respons_til_status(event.data.resultat)  # Gammel
```

### 5.2 Gradvis Migrering

**Steg 1: Oppdater TE-skjemaer**
- Legg til varsel-dato-felter i VederlagModal og FristModal
- Brukere begynner å fylle inn datoer

**Steg 2: Oppdater BH-skjemaer**
- Legg til Port-modell checkboxer i RespondVederlagModal
- Legg til Port 1, 2, 3 seksjoner i RespondFristModal

**Steg 3: Oppdater UI**
- Bruk `visningsstatus_vederlag` og `visningsstatus_frist` i stedet for direkte `status`
- Vis subsidiære meldinger når `er_subsidiaert_vederlag` er true

---

## Del 6: Testing

### 6.1 Test Case: Subsidiær Godkjenning

```python
def test_subsidiaer_godkjenning_vederlag():
    """Test at subsidiær logikk fungerer korrekt"""
    # Arrange: Opprett events
    events = [
        SakOpprettetEvent(...),
        GrunnlagEvent(...),
        VederlagEvent(data=VederlagData(
            krav_belop=250000.0,
            metode=VederlagsMetode.REGNING,
            # ... med alle varseldatoer
        )),

        # BH avviser grunnlag
        ResponsEvent(
            event_type=EventType.RESPONS_GRUNNLAG,
            spor=SporType.GRUNNLAG,
            data=GrunnlagResponsData(
                resultat=ResponsResultat.AVVIST_UENIG,
                begrunnelse="TE har ansvar"
            )
        ),

        # BH godkjenner beregningen subsidiært
        ResponsEvent(
            event_type=EventType.RESPONS_VEDERLAG,
            spor=SporType.VEDERLAG,
            data=VederlagResponsData(
                beregnings_resultat=VederlagBeregningResultat.GODKJENT_FULLT,
                godkjent_belop=250000.0,
                begrunnelse_beregning="Beregningen er korrekt (subsidiært)"
            )
        )
    ]

    # Act: Beregn state
    service = TimelineService()
    state = service.compute_state(events)

    # Assert: Sjekk subsidiær logikk
    assert state.grunnlag.status == SporStatus.AVVIST
    assert state.vederlag.status == SporStatus.GODKJENT
    assert state.er_subsidiaert_vederlag == True
    assert "Subsidiært enighet" in state.visningsstatus_vederlag
    assert state.vederlag.godkjent_belop == 250000.0
```

---

## Del 7: Juridisk Begrunnelse

### 7.1 Hvorfor Subsidiære Betraktninger?

**Scenario fra virkelig liv:**

> **TE:** "BH har endret grunnforholdene (§25.2). Dette koster 250 000 kr ekstra og tar 14 dager ekstra."
>
> **BH:** "Nei, TE har selv ansvar for å undersøke grunnen (§22.4). Kravet avvises."
>
> **TE:** "Ok, men hvis en tvist/voldgift senere finner at BH hadde ansvar - er beløpet og dagene korrekt da?"
>
> **BH:** "Ja, hvis vi hadde hatt ansvar, så er 250k og 14 dager riktig."

**Resultat:**
- Grunnlag: AVVIST (ansvar)
- Vederlag: GODKJENT SUBSIDIÆRT (beregning)
- Frist: GODKJENT SUBSIDIÆRT (beregning)

**Fordel:**
Hvis TE senere vinner en tvist om ansvaret, så er beløpet og dagene allerede enige om. Man slipper å diskutere både ansvar OG beregning i tvisten.

### 7.2 NS 8407 Referanser

**Varsler:**
- §33.4: Nøytralt varsel om frist
- §33.6: Spesifisert krav om frist
- §34.1.3: Særskilt varsel om rigg/drift
- §34.3.3: Varsel om justerte enhetspriser
- §30.1: Varsel før regningsarbeid

**Vilkår:**
- §33.1: Årsakssammenheng (fremdriftshindring)
- §25.2: BHs ansvarsgrunnlag (endringer)
- §22.4: TEs ansvarsgrunnlag (undersøkelsesplikt)

---

## Konklusjon

Denne refaktoreringen:

✅ **Støtter subsidiære betraktninger** - BH kan avvise ansvar men godkjenne beregning
✅ **Separerer ansvar fra beregning** - Grunnlag og Vederlag/Frist er uavhengige
✅ **Implementerer Port-modellen** - Sekvensiell vurdering av varsling → vilkår → utmåling
✅ **Følger NS 8407** - Alle relevante varsler og frister er modellert
✅ **Backward compatible** - Gammel kode fungerer fortsatt
✅ **Type-safe** - Strong typing i både Python og TypeScript
✅ **Computed fields** - UI får ferdig beregnet visningsstatus

**Neste steg:**
1. Oppdater frontend modals for å bruke nye felter
2. Oppdater UI for å vise subsidiære statuser
3. Skriv integrasjonstester for hele flyten
4. Dokumentere for brukere (brukerveiledning)

---

**Utviklet av:** Claude Code
**Review:** Trenger human review av domeneekspert
**Status:** ✅ Backend implementert, Frontend types oppdatert
**Testing:** ⚠️ Trenger integrasjonstester
