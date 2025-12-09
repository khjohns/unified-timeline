# Implementeringsplan: Subsidiær standpunkt-lagring i datamodell

> **Formål**: Utvide datamodellen slik at BH's subsidiære standpunkt lagres eksplisitt i events.
>
> **Dato**: 2025-12-09
> **Status**: Klar for implementering
> **Prioritet**: Høy
> **Estimert omfang**: Backend + Frontend endringer

---

## Innholdsfortegnelse

1. [Bakgrunn og problemstilling](#bakgrunn-og-problemstilling)
2. [Subsidiær logikk - Fullstendig oversikt](#subsidiær-logikk---fullstendig-oversikt)
3. [Anbefalt løsning](#anbefalt-løsning)
4. [Analyse av eksisterende statuskoder](#analyse-av-eksisterende-statuskoder)
5. [Datamodell-spesifikasjon](#datamodell-spesifikasjon)
6. [Implementeringsoppgaver](#implementeringsoppgaver)
7. [UI-spesifikasjon](#ui-spesifikasjon)
8. [Testing](#testing)
9. [Filreferanser](#filreferanser)

---

## Bakgrunn og problemstilling

### Hva er subsidiært standpunkt?

I entrepriserett kan BH (Byggherre) innta et **subsidiært standpunkt**. Dette betyr at BH tar stilling til kravet på flere nivåer:

> "Prinsipalt avviser jeg kravet fordi varsel kom for sent (preklusjon).
> **Subsidiært**, dersom retten skulle komme til at varselet var i tide,
> mener jeg at det ikke forelå reell fremdriftshindring.
> **Enda mer subsidiært**, dersom det likevel var hindring,
> godkjenner jeg maksimalt 14 av de krevde 30 dagene."

### Nåværende problem

1. **Frontend beregner subsidiært resultat** - `RespondVederlagModal.tsx` og `RespondFristModal.tsx` beregner og viser både prinsipalt og subsidiært resultat
2. **Frontend sender subsidiært til backend** - Modalene sender `subsidiaert_resultat` og `subsidiaert_godkjent_belop/dager`
3. **Backend lagrer IKKE subsidiært** - `VederlagResponsData` og `FristResponsData` mangler felt for subsidiære verdier
4. **Subsidiært standpunkt forsvinner** - Juridisk viktig informasjon går tapt

---

## Subsidiær logikk - Fullstendig oversikt

### Kaskaderende subsidiær behandling

Subsidiær behandling kan utløses på flere nivåer som bygger på hverandre:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     KASKADERENDE SUBSIDIÆR LOGIKK                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  NIVÅ 0: GRUNNLAG (separat event)                                       │
│  ─────────────────────────────────                                      │
│  Hvis grunnlag er avvist → ALT under behandles subsidiært               │
│                                                                         │
│           │                                                             │
│           ▼                                                             │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  VEDERLAG RESPONS                  FRIST RESPONS                │    │
│  ├─────────────────────────────────────────────────────────────────┤    │
│  │                                                                 │    │
│  │  NIVÅ 1: PREKLUSJON                NIVÅ 1: PREKLUSJON           │    │
│  │  ──────────────────                ──────────────────           │    │
│  │  Port 1: Særskilte varsler         Port 1: Varsel              │    │
│  │  - Rigg/drift (§34.1.3)            - Nøytralt varsel (§33.4)    │    │
│  │  - Produktivitet (§34.1.3)         - Spesifisert krav (§33.6)   │    │
│  │                                                                 │    │
│  │  Hvis prekludert → Resten          Hvis prekludert → Resten     │    │
│  │  av vurderingen er subsidiær       av vurderingen er subsidiær  │    │
│  │                                                                 │    │
│  │           │                                 │                   │    │
│  │           ▼                                 ▼                   │    │
│  │                                                                 │    │
│  │  NIVÅ 2: METODE                    NIVÅ 2: VILKÅR (§33.5)       │    │
│  │  ──────────────                    ──────────────────           │    │
│  │  Port 2: Metode & Svarplikt        Port 2: Fremdriftshindring   │    │
│  │  - Aksepterer metode?              - Faktisk hindring?          │    │
│  │  - EP-justering (§34.3.3)          - Årsakssammenheng?          │    │
│  │  - Tilbakeholdelse (§30.2)                                      │    │
│  │                                    Hvis ingen hindring →        │    │
│  │                                    Dagberegning er subsidiær    │    │
│  │                                                                 │    │
│  │           │                                 │                   │    │
│  │           ▼                                 ▼                   │    │
│  │                                                                 │    │
│  │  NIVÅ 3: BEREGNING                 NIVÅ 3: BEREGNING            │    │
│  │  ─────────────────                 ─────────────────            │    │
│  │  Port 3: Beløpsvurdering           Port 3: Dagberegning         │    │
│  │  - Hovedkrav                       - Antall dager               │    │
│  │  - Rigg/drift (subsidiært?)        - Ny sluttdato               │    │
│  │  - Produktivitet (subsidiært?)                                  │    │
│  │                                                                 │    │
│  │           │                                 │                   │    │
│  │           ▼                                 ▼                   │    │
│  │                                                                 │    │
│  │  NIVÅ 4: OPPSUMMERING              NIVÅ 4: OPPSUMMERING         │    │
│  │  ────────────────────              ────────────────────         │    │
│  │  - Prinsipalt resultat             - Prinsipalt resultat        │    │
│  │  - Subsidiært resultat             - Subsidiært resultat        │    │
│  │    (inkl. prekluderte krav)          (ignorerer preklusion)     │    │
│  │                                                                 │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Vederlag: Subsidiære triggere

| Trigger | Nivå | Beskrivelse | Konsekvens |
|---------|------|-------------|------------|
| `grunnlag_avvist` | 0 | BH avviste ansvarsgrunnlaget | Hele vederlagskravet er subsidiært |
| `preklusjon_rigg` | 1 | Rigg/drift varslet for sent (§34.1.3) | Rigg/drift-beløp er subsidiært |
| `preklusjon_produktivitet` | 1 | Produktivitet varslet for sent (§34.1.3) | Produktivitets-beløp er subsidiært |
| `metode_avvist` | 2 | BH krever annen metode | Metodevalg er omtvistet |
| `belop_redusert` | 3 | BH godkjenner lavere beløp | Differanse er omtvistet |

### Frist: Subsidiære triggere

| Trigger | Nivå | Beskrivelse | Konsekvens |
|---------|------|-------------|------------|
| `grunnlag_avvist` | 0 | BH avviste ansvarsgrunnlaget | Hele fristkravet er subsidiært |
| `preklusjon_noytralt` | 1 | Nøytralt varsel for sent (§33.4) | Kravet er prinsipalt prekludert |
| `preklusjon_spesifisert` | 1 | Spesifisert krav for sent (§33.6) | Kravet er prinsipalt prekludert |
| `ingen_hindring` | 2 | BH mener ingen reell forsinkelse (§33.5) | Dagberegning er subsidiær |
| `dager_redusert` | 3 | BH godkjenner færre dager | Differanse er omtvistet |

### Eksempel: Maksimal kaskade (Frist)

```
BH's standpunkt:

1. PRINSIPALT: Kravet avvises fordi varsel kom for sent (§33.4)
   → Godkjent: 0 dager

2. SUBSIDIÆRT (nivå 1): Dersom varselet var i tide, mener BH at det
   ikke forelå reell fremdriftshindring (§33.5)
   → Godkjent: 0 dager

3. ENDA MER SUBSIDIÆRT (nivå 2): Dersom det likevel var hindring,
   godkjenner BH maksimalt 14 av de krevde 30 dagene
   → Godkjent: 14 dager

Lagres som:
- beregnings_resultat: "avvist_preklusjon"
- godkjent_dager: 0
- subsidiaer_triggers: ["preklusjon_noytralt", "ingen_hindring"]
- subsidiaer_resultat: "delvis_godkjent"
- subsidiaer_godkjent_dager: 14
```

---

## Anbefalt løsning

### Designprinsipper

1. **Én subsidiær "bunnlinje"**: Vi lagrer kun det endelige subsidiære resultatet, ikke mellomtrinn
2. **Liste over triggere**: Vi lagrer alle grunner til at det er subsidiært
3. **Bakoverkompatibilitet**: Alle nye felt er `Optional`
4. **Forretningslogikk i backend**: Frontend sender rådata, backend beregner resultater

### Hvorfor ikke per-nivå subsidiære felt?

Juridisk sett tar BH én prinsipal posisjon og én subsidiær posisjon (med eventuelt flere begrunnelser). Det er ikke nødvendig å lagre mellomtrinn fordi:

1. **Triggerlisten** dokumenterer alle omtvistede punkter
2. **Subsidiært resultat** er "bunnlinjen" - hva BH maksimalt kan akseptere
3. **Begrunnelse** forklarer hele resonnementet

---

## Analyse av eksisterende statuskoder

### Oversikt over eksisterende statuskoder

Systemet har flere lag med statuskoder:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     STATUSKODE-HIERARKI                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  NIVÅ 1: SporStatus (Overordnet per spor)                               │
│  ─────────────────────────────────────────                              │
│  Brukes i: GrunnlagTilstand, VederlagTilstand, FristTilstand            │
│                                                                         │
│  IKKE_RELEVANT | UTKAST | SENDT | UNDER_BEHANDLING                      │
│  GODKJENT | DELVIS_GODKJENT | AVVIST                                    │
│  UNDER_FORHANDLING | TRUKKET | LAAST                                    │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  NIVÅ 2: BeregningResultat (Detaljert event-resultat)                   │
│  ────────────────────────────────────────────────────                   │
│  Brukes i: VederlagResponsData, FristResponsData                        │
│                                                                         │
│  VederlagBeregningResultat:                                             │
│  - GODKJENT_FULLT                                                       │
│  - DELVIS_GODKJENT                                                      │
│  - GODKJENT_ANNEN_METODE                                                │
│  - AVVENTER_SPESIFIKASJON                                               │
│  - AVSLATT_TOTALT                                                       │
│  - HOLD_TILBAKE                                                         │
│  - AVVIST_PREKLUSJON_RIGG  ← For granulær?                              │
│                                                                         │
│  FristBeregningResultat:                                                │
│  - GODKJENT_FULLT                                                       │
│  - DELVIS_GODKJENT                                                      │
│  - AVVENTER_SPESIFIKASJON                                               │
│  - AVSLATT_INGEN_HINDRING  ← For granulær?                              │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  NIVÅ 3: GrunnlagResponsResultat (Ansvarsvurdering)                     │
│  ──────────────────────────────────────────────────                     │
│  Brukes i: GrunnlagResponsData                                          │
│                                                                         │
│  GODKJENT | DELVIS_GODKJENT | ERKJENN_FM | AVVIST_UENIG                 │
│  AVVIST_FOR_SENT | FRAFALT | KREVER_AVKLARING                           │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  NIVÅ 4: Computed Fields i SakState (Aggregert)                         │
│  ──────────────────────────────────────────────                         │
│  - er_force_majeure: bool                                               │
│  - er_frafalt: bool                                                     │
│  - er_subsidiaert_vederlag: bool  ← Kun grunnlag-nivå!                  │
│  - er_subsidiaert_frist: bool     ← Kun grunnlag-nivå!                  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Problem: Granulære statuskoder vs. subsidiær logikk

**Eksisterende spesifikke statuskoder:**

| Kode | Problem |
|------|---------|
| `AVVIST_PREKLUSJON_RIGG` | Kun for rigg/drift. Hva med produktivitet? |
| `AVSLATT_INGEN_HINDRING` | Dekker kun vilkår-avslag, ikke preklusjon |

**Med subsidiær logikk får vi mer informasjon:**

Nå som vi lagrer `subsidiaer_triggers` og `subsidiaer_resultat`, blir de granulære kodene delvis redundante:

```
GAMMEL MÅTE:
  beregnings_resultat: "avvist_preklusjon_rigg"
  → Vet kun at rigg er prekludert, ikke hva det subsidiære resultatet er

NY MÅTE:
  beregnings_resultat: "avvist"  (eller "delvis_godkjent"?)
  subsidiaer_triggers: ["preklusjon_rigg"]
  subsidiaer_resultat: "delvis_godkjent"
  subsidiaer_godkjent_belop: 950000
  → Full informasjon om både prinsipal og subsidiær vurdering
```

### Anbefaling: Forenkle BeregningResultat

**Forslag for VederlagBeregningResultat:**

```python
class VederlagBeregningResultat(str, Enum):
    """Resultat av vederlagsvurdering (prinsipal)"""
    GODKJENT_FULLT = "godkjent_fullt"
    DELVIS_GODKJENT = "delvis_godkjent"
    GODKJENT_ANNEN_METODE = "godkjent_annen_metode"
    AVVENTER_SPESIFIKASJON = "avventer_spesifikasjon"
    AVSLATT = "avslatt"  # Erstatter AVSLATT_TOTALT og AVVIST_PREKLUSJON_RIGG
    HOLD_TILBAKE = "hold_tilbake"
```

**Forslag for FristBeregningResultat:**

```python
class FristBeregningResultat(str, Enum):
    """Resultat av fristberegning (prinsipal)"""
    GODKJENT_FULLT = "godkjent_fullt"
    DELVIS_GODKJENT = "delvis_godkjent"
    AVVENTER_SPESIFIKASJON = "avventer_spesifikasjon"
    AVSLATT = "avslatt"  # Erstatter AVSLATT_INGEN_HINDRING
```

**Hvorfor forenkle:**

1. **Årsaken til avslag fanges av `subsidiaer_triggers`** - Vi trenger ikke egne statuskoder per årsak
2. **Reduserer kompleksitet** - Færre koder å håndtere i frontend og rapporter
3. **Mer konsistent** - Samme mønster for vederlag og frist
4. **Bakoverkompatibel** - Gamle koder kan mappes til nye

### Migreringsplan for statuskoder

**Fase 1: Legg til nye koder (bakoverkompatibelt)**

```python
class VederlagBeregningResultat(str, Enum):
    # Eksisterende (beholdes for bakoverkompatibilitet)
    GODKJENT_FULLT = "godkjent_fullt"
    DELVIS_GODKJENT = "delvis_godkjent"
    GODKJENT_ANNEN_METODE = "godkjent_annen_metode"
    AVVENTER_SPESIFIKASJON = "avventer_spesifikasjon"
    AVSLATT_TOTALT = "avslatt_totalt"
    HOLD_TILBAKE = "hold_tilbake"
    AVVIST_PREKLUSJON_RIGG = "avvist_preklusjon_rigg"  # Deprecated

    # Ny generisk avslags-kode
    AVSLATT = "avslatt"  # Bruk denne fremover
```

**Fase 2: Oppdater frontend til å bruke nye koder**

- Nye responser bruker `AVSLATT` + `subsidiaer_triggers`
- Frontend behandler `AVVIST_PREKLUSJON_RIGG` og `AVSLATT` likt for visning

**Fase 3: (Fremtidig) Fjern deprecated koder**

Når alle eksisterende data er migrert, fjern de gamle kodene.

### Oppdatering av SakState computed fields

**Nåværende implementering** (`sak_state.py` linje 346-394):

```python
@computed_field
@property
def er_subsidiaert_vederlag(self) -> bool:
    """Kun basert på grunnlag-avslag"""
    grunnlag_avvist = self.grunnlag.status == SporStatus.AVVIST
    beregning_godkjent = self.vederlag.bh_resultat in {
        VederlagBeregningResultat.GODKJENT_FULLT,
        VederlagBeregningResultat.DELVIS_GODKJENT,
        VederlagBeregningResultat.GODKJENT_ANNEN_METODE,
    }
    return grunnlag_avvist and beregning_godkjent
```

**Problem:** Dette dekker kun grunnlag-nivå subsidiær, ikke event-nivå (preklusjon, vilkår).

**Anbefalt utvidelse:**

Legg til nye computed fields i `VederlagTilstand` og `FristTilstand`:

```python
class VederlagTilstand(BaseModel):
    # ... eksisterende felt ...

    # NYE FELT for subsidiær data (fra event)
    subsidiaer_triggers: Optional[List[str]] = Field(default=None)
    subsidiaer_resultat: Optional[VederlagBeregningResultat] = Field(default=None)
    subsidiaer_godkjent_belop: Optional[float] = Field(default=None)
    subsidiaer_begrunnelse: Optional[str] = Field(default=None)

    @computed_field
    @property
    def har_subsidiaert_standpunkt(self) -> bool:
        """True hvis BH har tatt subsidiær stilling på event-nivå"""
        return self.subsidiaer_resultat is not None

    @computed_field
    @property
    def visningsstatus(self) -> str:
        """
        Kombinert status for UI-visning.

        Returnerer en av:
        - "godkjent" / "delvis_godkjent" / "avslatt"
        - "avslatt_subsidiaert_godkjent" (prinsipal avslått, subsidiært godkjent)
        - "avventer_spesifikasjon"
        - etc.
        """
        if self.bh_resultat is None:
            return self.status.value

        # Prinsipal avslått men subsidiært godkjent
        if self.bh_resultat in {VederlagBeregningResultat.AVSLATT,
                                 VederlagBeregningResultat.AVVIST_PREKLUSJON_RIGG,
                                 VederlagBeregningResultat.AVSLATT_TOTALT}:
            if self.subsidiaer_resultat in {
                VederlagBeregningResultat.GODKJENT_FULLT,
                VederlagBeregningResultat.DELVIS_GODKJENT,
            }:
                return "avslatt_subsidiaert_godkjent"

        return self.bh_resultat.value
```

**Tilsvarende for FristTilstand.**

### Oppsummering: Anbefalte endringer til statuskoder

| Område | Endring | Prioritet |
|--------|---------|-----------|
| `VederlagBeregningResultat` | Legg til `AVSLATT` som generisk avslag | Høy |
| `FristBeregningResultat` | Legg til `AVSLATT` som generisk avslag | Høy |
| `VederlagTilstand` | Legg til subsidiære felt + `visningsstatus` | Høy |
| `FristTilstand` | Legg til subsidiære felt + `visningsstatus` | Høy |
| `SakState` | Utvid `er_subsidiaert_*` til å inkludere event-nivå | Middels |
| Deprecated koder | Marker `AVVIST_PREKLUSJON_RIGG`, `AVSLATT_INGEN_HINDRING` som deprecated | Lav |

---

## Datamodell-spesifikasjon

### Nye enums

```python
# backend/models/events.py

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

    # Nivå 1: Preklusjon (Frist)
    PREKLUSJON_NOYTRALT = "preklusjon_noytralt"
    PREKLUSJON_SPESIFISERT = "preklusjon_spesifisert"

    # Nivå 2: Vilkår (kun Frist)
    INGEN_HINDRING = "ingen_hindring"

    # Nivå 2: Metode (kun Vederlag)
    METODE_AVVIST = "metode_avvist"
```

### Oppdatert VederlagResponsData

```python
class VederlagResponsData(BaseModel):
    """
    Byggherrens respons på vederlagskrav (Port-modellen).

    OPPDATERT: Inkluderer nå subsidiær vurdering med triggere.

    Subsidiær vurdering er relevant når:
    - Grunnlag er avvist (fra separat respons)
    - Særskilte krav (rigg/produktivitet) er prekludert

    Frontend sender subsidiære verdier, backend lagrer dem.
    """

    # ============ PORT 1: VARSELVURDERING (§34.1.3) ============
    saerskilt_varsel_rigg_drift_ok: Optional[bool] = Field(
        default=None,
        description="Er rigg/drift varslet i tide? False = prekludert"
    )
    varsel_justert_ep_ok: Optional[bool] = Field(
        default=None,
        description="Er justerte EP varslet i tide? (§34.3.3)"
    )
    varsel_start_regning_ok: Optional[bool] = Field(
        default=None,
        description="Ble BH varslet før regningsarbeid startet? (§30.1)"
    )
    krav_fremmet_i_tide: bool = Field(
        default=True,
        description="Er vederlagskravet fremmet uten ugrunnet opphold?"
    )
    begrunnelse_varsel: Optional[str] = Field(
        default=None,
        description="Begrunnelse for varselvurdering"
    )

    # ============ PORT 2: METODE ============
    vederlagsmetode: Optional[VederlagsMetode] = Field(
        default=None,
        description="Metode BH legger til grunn"
    )
    aksepterer_metode: bool = Field(
        default=True,
        description="Aksepterer BH den foreslåtte metoden?"
    )
    ep_justering_akseptert: Optional[bool] = Field(
        default=None,
        description="Aksepterer BH justering av enhetspriser? (§34.3.3)"
    )
    hold_tilbake: bool = Field(
        default=False,
        description="Holder BH tilbake betaling? (§30.2)"
    )
    begrunnelse_metode: Optional[str] = Field(
        default=None,
        description="Begrunnelse for metodevurdering"
    )

    # ============ PORT 3: PRINSIPALT RESULTAT ============
    beregnings_resultat: VederlagBeregningResultat = Field(
        ...,
        description="Prinsipalt beregningsresultat"
    )
    godkjent_belop: Optional[float] = Field(
        default=None,
        description="Prinsipalt godkjent beløp (respekterer preklusion)"
    )
    begrunnelse_beregning: str = Field(
        default="",
        description="Begrunnelse for beløpsvurdering"
    )
    frist_for_spesifikasjon: Optional[str] = Field(
        default=None,
        description="Frist for TE å levere spesifikasjon (YYYY-MM-DD)"
    )

    # ============ NYE FELT: SUBSIDIÆRT RESULTAT ============
    subsidiaer_triggers: Optional[List[SubsidiaerTrigger]] = Field(
        default=None,
        description="Liste over hva som utløser subsidiær vurdering"
    )
    subsidiaer_resultat: Optional[VederlagBeregningResultat] = Field(
        default=None,
        description="Subsidiært beregningsresultat (ignorerer preklusion)"
    )
    subsidiaer_godkjent_belop: Optional[float] = Field(
        default=None,
        description="Subsidiært godkjent beløp (inkl. prekluderte krav)"
    )
    subsidiaer_begrunnelse: Optional[str] = Field(
        default=None,
        description="BH's samlede begrunnelse for subsidiær vurdering"
    )
```

### Oppdatert FristResponsData

```python
class FristResponsData(BaseModel):
    """
    Byggherrens respons på fristforlengelseskrav (Port-modellen).

    OPPDATERT: Inkluderer nå subsidiær vurdering med triggere.

    Subsidiær vurdering er relevant når:
    - Grunnlag er avvist (fra separat respons)
    - Varsel kom for sent (preklusjon)
    - BH mener ingen reell hindring (vilkår)
    """

    # ============ PORT 1: PREKLUSJON (§33.4, §33.6) ============
    noytralt_varsel_ok: Optional[bool] = Field(
        default=None,
        description="Er nøytralt varsel sendt i tide? (§33.4)"
    )
    spesifisert_krav_ok: bool = Field(
        default=True,
        description="Er spesifisert krav sendt i tide? (§33.6)"
    )
    har_bh_etterlyst: Optional[bool] = Field(
        default=None,
        description="Har BH etterlyst kravet skriftlig? (§33.6.2)"
    )
    begrunnelse_varsel: Optional[str] = Field(
        default=None,
        description="Begrunnelse for varselvurdering"
    )

    # ============ PORT 2: VILKÅR (§33.5) ============
    vilkar_oppfylt: bool = Field(
        default=True,
        description="Medførte forholdet faktisk fremdriftshindring?"
    )
    begrunnelse_vilkar: Optional[str] = Field(
        default=None,
        description="Begrunnelse for vilkårsvurdering"
    )

    # ============ PORT 3: PRINSIPALT RESULTAT ============
    beregnings_resultat: FristBeregningResultat = Field(
        ...,
        description="Prinsipalt beregningsresultat"
    )
    godkjent_dager: Optional[int] = Field(
        default=None,
        description="Prinsipalt godkjent antall dager"
    )
    ny_sluttdato: Optional[str] = Field(
        default=None,
        description="Ny sluttdato basert på godkjent forlengelse"
    )
    begrunnelse_beregning: Optional[str] = Field(
        default=None,
        description="Begrunnelse for dagberegning"
    )
    frist_for_spesifisering: Optional[str] = Field(
        default=None,
        description="Frist for TE å levere spesifikasjon (YYYY-MM-DD)"
    )

    # ============ NYE FELT: SUBSIDIÆRT RESULTAT ============
    subsidiaer_triggers: Optional[List[SubsidiaerTrigger]] = Field(
        default=None,
        description="Liste over hva som utløser subsidiær vurdering"
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
        description="BH's samlede begrunnelse for subsidiær vurdering"
    )
```

### TypeScript typer

```typescript
// src/types/timeline.ts

export type SubsidiaerTrigger =
  | 'grunnlag_avvist'
  | 'preklusjon_rigg'
  | 'preklusjon_produktivitet'
  | 'preklusjon_noytralt'
  | 'preklusjon_spesifisert'
  | 'ingen_hindring'
  | 'metode_avvist';

export interface ResponsVederlagEventData {
  // Port 1: Varselvurdering (eksisterende)
  saerskilt_varsel_rigg_drift_ok?: boolean;
  varsel_justert_ep_ok?: boolean;
  varsel_start_regning_ok?: boolean;
  krav_fremmet_i_tide?: boolean;
  begrunnelse_varsel?: string;

  // Port 2: Metode (eksisterende + nye)
  vederlagsmetode?: VederlagsMetode;
  aksepterer_metode?: boolean;
  ep_justering_akseptert?: boolean;
  hold_tilbake?: boolean;
  begrunnelse_metode?: string;

  // Port 3: Prinsipalt resultat (eksisterende)
  beregnings_resultat: VederlagBeregningResultat;
  godkjent_belop?: number;
  begrunnelse_beregning?: string;
  frist_for_spesifikasjon?: string;

  // NYE: Subsidiært resultat
  subsidiaer_triggers?: SubsidiaerTrigger[];
  subsidiaer_resultat?: VederlagBeregningResultat;
  subsidiaer_godkjent_belop?: number;
  subsidiaer_begrunnelse?: string;
}

export interface ResponsFristEventData {
  // Port 1: Preklusjon (eksisterende)
  noytralt_varsel_ok?: boolean;
  spesifisert_krav_ok?: boolean;
  har_bh_etterlyst?: boolean;
  begrunnelse_varsel?: string;

  // Port 2: Vilkår (eksisterende)
  vilkar_oppfylt?: boolean;
  begrunnelse_vilkar?: string;

  // Port 3: Prinsipalt resultat (eksisterende)
  beregnings_resultat: FristBeregningResultat;
  godkjent_dager?: number;
  ny_sluttdato?: string;
  begrunnelse_beregning?: string;
  frist_for_spesifisering?: string;

  // NYE: Subsidiært resultat
  subsidiaer_triggers?: SubsidiaerTrigger[];
  subsidiaer_resultat?: FristBeregningResultat;
  subsidiaer_godkjent_dager?: number;
  subsidiaer_begrunnelse?: string;
}
```

---

## Implementeringsoppgaver

### Oppgave 1: Backend - Oppdater datamodeller

**Fil**: `backend/models/events.py`

**Endringer**:
1. Legg til `SubsidiaerTrigger` enum (etter linje ~110)
2. Oppdater `VederlagResponsData` med nye felt (linje 635-716)
3. Oppdater `FristResponsData` med nye felt (linje 718-815)

**Kode for SubsidiaerTrigger**:
```python
class SubsidiaerTrigger(str, Enum):
    """Årsaker til at subsidiær vurdering er relevant"""
    # Nivå 0: Grunnlag
    GRUNNLAG_AVVIST = "grunnlag_avvist"

    # Nivå 1: Preklusjon (Vederlag)
    PREKLUSJON_RIGG = "preklusjon_rigg"
    PREKLUSJON_PRODUKTIVITET = "preklusjon_produktivitet"

    # Nivå 1: Preklusjon (Frist)
    PREKLUSJON_NOYTRALT = "preklusjon_noytralt"
    PREKLUSJON_SPESIFISERT = "preklusjon_spesifisert"

    # Nivå 2
    INGEN_HINDRING = "ingen_hindring"
    METODE_AVVIST = "metode_avvist"
```

**Nye felt i VederlagResponsData** (legg til etter `frist_for_spesifikasjon`):
```python
    # ============ SUBSIDIÆRT RESULTAT ============
    subsidiaer_triggers: Optional[List[SubsidiaerTrigger]] = Field(
        default=None,
        description="Liste over hva som utløser subsidiær vurdering"
    )
    subsidiaer_resultat: Optional[VederlagBeregningResultat] = Field(
        default=None,
        description="Subsidiært beregningsresultat (ignorerer preklusion)"
    )
    subsidiaer_godkjent_belop: Optional[float] = Field(
        default=None,
        description="Subsidiært godkjent beløp (inkl. prekluderte krav)"
    )
    subsidiaer_begrunnelse: Optional[str] = Field(
        default=None,
        description="BH's samlede begrunnelse for subsidiær vurdering"
    )
```

**Nye felt i FristResponsData** (legg til etter `frist_for_spesifisering`):
```python
    # ============ SUBSIDIÆRT RESULTAT ============
    subsidiaer_triggers: Optional[List[SubsidiaerTrigger]] = Field(
        default=None,
        description="Liste over hva som utløser subsidiær vurdering"
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
        description="BH's samlede begrunnelse for subsidiær vurdering"
    )
```

**Viktig**: Husk å importere `List` fra typing hvis ikke allerede importert.

---

### Oppgave 2: Frontend - Oppdater TypeScript typer

**Fil**: `src/types/timeline.ts`

**Endringer**:
1. Legg til `SubsidiaerTrigger` type (etter linje ~63)
2. Oppdater `ResponsVederlagEventData` (linje 329-343)
3. Oppdater `ResponsFristEventData` (linje 346-363)

**Ny type**:
```typescript
// Etter GrunnlagResponsResultat type (linje ~63)

export type SubsidiaerTrigger =
  | 'grunnlag_avvist'
  | 'preklusjon_rigg'
  | 'preklusjon_produktivitet'
  | 'preklusjon_noytralt'
  | 'preklusjon_spesifisert'
  | 'ingen_hindring'
  | 'metode_avvist';
```

**Oppdater ResponsVederlagEventData** - legg til etter `frist_for_spesifikasjon`:
```typescript
  // Subsidiært resultat
  subsidiaer_triggers?: SubsidiaerTrigger[];
  subsidiaer_resultat?: VederlagBeregningResultat;
  subsidiaer_godkjent_belop?: number;
  subsidiaer_begrunnelse?: string;
```

**Oppdater ResponsFristEventData** - legg til etter `frist_for_spesifisering`:
```typescript
  // Subsidiært resultat
  subsidiaer_triggers?: SubsidiaerTrigger[];
  subsidiaer_resultat?: FristBeregningResultat;
  subsidiaer_godkjent_dager?: number;
  subsidiaer_begrunnelse?: string;
```

---

### Oppgave 3: Frontend - Oppdater RespondVederlagModal

**Fil**: `src/components/actions/RespondVederlagModal.tsx`

**Nåværende oppførsel** (linje 533-543):
Modalen sender allerede `subsidiaert_resultat` og `subsidiaert_godkjent_belop`, men med litt annet navngivning.

**Endringer**:
1. Beregn `subsidiaer_triggers` basert på wizard-valg
2. Map til korrekte feltnavn i submit-handler

**Oppdater onSubmit (linje 482-545)**:

```typescript
const onSubmit = (data: RespondVederlagFormData) => {
  // Beregn subsidiære triggere
  const triggers: string[] = [];
  if (riggPrekludert) triggers.push('preklusjon_rigg');
  if (produktivitetPrekludert) triggers.push('preklusjon_produktivitet');
  if (!formValues.aksepterer_metode) triggers.push('metode_avvist');
  // Merk: grunnlag_avvist settes basert på grunnlagStatus prop

  mutation.mutate({
    eventType: 'respons_vederlag',
    data: {
      // ... eksisterende felt ...

      // Prinsipalt resultat
      beregnings_resultat: prinsipaltResultat,
      godkjent_belop: computed.totalGodkjent,

      // Subsidiært resultat (kun når relevant)
      subsidiaer_triggers: triggers.length > 0 ? triggers : undefined,
      subsidiaer_resultat: visSubsidiaertResultat ? subsidiaertResultat : undefined,
      subsidiaer_godkjent_belop: visSubsidiaertResultat
        ? computed.totalGodkjentInklPrekludert
        : undefined,
      subsidiaer_begrunnelse: visSubsidiaertResultat
        ? data.begrunnelse_samlet  // Eller et dedikert felt
        : undefined,
    },
  });
};
```

---

### Oppgave 4: Frontend - Oppdater RespondFristModal

**Fil**: `src/components/actions/RespondFristModal.tsx`

**Endringer**:
1. Beregn `subsidiaer_triggers` basert på wizard-valg
2. Map til korrekte feltnavn i submit-handler

**Oppdater onSubmit (linje 367-401)**:

```typescript
const onSubmit = (data: RespondFristFormData) => {
  // Beregn subsidiære triggere
  const triggers: string[] = [];
  if (erPrekludert) {
    if (varselType === 'noytralt') {
      triggers.push('preklusjon_noytralt');
    } else {
      triggers.push('preklusjon_spesifisert');
    }
  }
  if (!harHindring) triggers.push('ingen_hindring');
  // Merk: grunnlag_avvist settes basert på grunnlagStatus prop

  mutation.mutate({
    eventType: 'respons_frist',
    data: {
      // ... eksisterende felt ...

      // Prinsipalt resultat
      beregnings_resultat: prinsipaltResultat,
      godkjent_dager: erPrekludert || !harHindring ? 0 : godkjentDager,

      // Subsidiært resultat (kun når relevant)
      subsidiaer_triggers: triggers.length > 0 ? triggers : undefined,
      subsidiaer_resultat: visSubsidiaertResultat ? subsidiaertResultat : undefined,
      subsidiaer_godkjent_dager: visSubsidiaertResultat ? godkjentDager : undefined,
      subsidiaer_begrunnelse: visSubsidiaertResultat
        ? data.begrunnelse_samlet
        : undefined,
    },
  });
};
```

---

### Oppgave 5: Frontend - Oppdater EventDetailModal

**Fil**: `src/components/views/EventDetailModal.tsx`

**Endringer**:
1. Legg til visning av subsidiært resultat i `ResponsVederlagSection`
2. Legg til visning av subsidiært resultat i `ResponsFristSection`
3. Legg til helper-funksjon for trigger-labels

**Ny helper-funksjon** (legg til etter linje ~179):

```typescript
const SUBSIDIAER_TRIGGER_LABELS: Record<string, string> = {
  grunnlag_avvist: 'Grunnlag avvist',
  preklusjon_rigg: 'Rigg/drift varslet for sent (§34.1.3)',
  preklusjon_produktivitet: 'Produktivitet varslet for sent (§34.1.3)',
  preklusjon_noytralt: 'Nøytralt varsel for sent (§33.4)',
  preklusjon_spesifisert: 'Spesifisert krav for sent (§33.6)',
  ingen_hindring: 'Ingen reell fremdriftshindring (§33.5)',
  metode_avvist: 'Metode ikke akseptert',
};

function getSubsidiaerTriggerLabels(triggers: string[] | undefined): string[] {
  if (!triggers) return [];
  return triggers.map(t => SUBSIDIAER_TRIGGER_LABELS[t] || t);
}
```

**Oppdater ResponsVederlagSection** (etter linje ~556):

```typescript
function ResponsVederlagSection({ data }: { data: ResponsVederlagEventData }) {
  const badge = getVederlagResultatBadge(data.beregnings_resultat);

  // Sjekk om det er subsidiært standpunkt
  const harSubsidiaert = data.subsidiaer_resultat !== undefined;
  const subsidiaerBadge = harSubsidiaert
    ? getVederlagResultatBadge(data.subsidiaer_resultat!)
    : null;

  // ... eksisterende kode for hasVarselFields, hasBeregningFields ...

  return (
    <dl>
      {/* ── Prinsipalt resultat ─────────────────────────────────────── */}
      <div className="p-4 bg-pkt-surface-strong-dark-blue text-white mb-4">
        <span className="text-xs uppercase opacity-80">Prinsipalt resultat</span>
        <div className="flex items-center gap-3 mt-1">
          <Badge variant={badge.variant} size="lg">{badge.label}</Badge>
          {data.godkjent_belop !== undefined && (
            <span className="font-mono text-lg">
              {formatCurrency(data.godkjent_belop)}
            </span>
          )}
        </div>
      </div>

      {/* ── Subsidiært standpunkt ───────────────────────────────────── */}
      {harSubsidiaert && (
        <div className="p-4 bg-amber-100 border-2 border-amber-400 mb-4">
          <span className="text-xs uppercase text-amber-800 font-medium">
            Subsidiært standpunkt
          </span>

          {/* Triggere */}
          {data.subsidiaer_triggers && data.subsidiaer_triggers.length > 0 && (
            <div className="mt-2 mb-3">
              <span className="text-sm text-amber-700">Årsak(er):</span>
              <ul className="list-disc list-inside text-sm text-amber-800 mt-1">
                {getSubsidiaerTriggerLabels(data.subsidiaer_triggers).map((label, i) => (
                  <li key={i}>{label}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Resultat */}
          <div className="flex items-center gap-3 mt-2">
            <Badge variant={subsidiaerBadge!.variant}>{subsidiaerBadge!.label}</Badge>
            {data.subsidiaer_godkjent_belop !== undefined && (
              <span className="font-mono text-lg text-amber-900">
                {formatCurrency(data.subsidiaer_godkjent_belop)}
              </span>
            )}
          </div>

          {/* Begrunnelse */}
          {data.subsidiaer_begrunnelse && (
            <p className="text-sm text-amber-800 mt-3 italic border-t border-amber-300 pt-2">
              "{data.subsidiaer_begrunnelse}"
            </p>
          )}
        </div>
      )}

      {/* ... resten av eksisterende kode ... */}
    </dl>
  );
}
```

**Tilsvarende oppdatering for ResponsFristSection** (etter linje ~667).

---

### Oppgave 6: Backend - Beregningslogikk (Fremtidig forbedring)

> **Merk**: Dette er en forbedring som kan gjøres senere. For nå håndterer frontend beregningene.

**Fil**: `backend/services/timeline_service.py` (eller ny fil `backend/services/respons_service.py`)

**Formål**: Flytte `beregnPrinsipaltResultat()` og `beregnSubsidiaertResultat()` fra frontend til backend.

**Fordeler**:
- Konsistent beregning på tvers av klienter
- Lettere å teste
- Forretningslogikk samlet på ett sted

**Utsatt til**: Etter at datamodell og frontend-lagring fungerer.

---

### Oppgave 7: Backend - Oppdater BeregningResultat enums

**Fil**: `backend/models/events.py`

**Endringer**:
1. Legg til `AVSLATT` i `VederlagBeregningResultat` (linje ~83)
2. Legg til `AVSLATT` i `FristBeregningResultat` (linje ~104)
3. Legg til kommentar om deprecated koder

**Kode for VederlagBeregningResultat** (oppdater linje 83-92):

```python
class VederlagBeregningResultat(str, Enum):
    """Resultat av beregningsvurdering (Port 2 - ren utmåling)"""
    GODKJENT_FULLT = "godkjent_fullt"
    DELVIS_GODKJENT = "delvis_godkjent"
    GODKJENT_ANNEN_METODE = "godkjent_annen_metode"
    AVVENTER_SPESIFIKASJON = "avventer_spesifikasjon"
    HOLD_TILBAKE = "hold_tilbake"

    # Generisk avslag (bruk sammen med subsidiaer_triggers for detaljer)
    AVSLATT = "avslatt"

    # Deprecated - bruk AVSLATT + subsidiaer_triggers i stedet
    AVSLATT_TOTALT = "avslatt_totalt"  # @deprecated
    AVVIST_PREKLUSJON_RIGG = "avvist_preklusjon_rigg"  # @deprecated
```

**Kode for FristBeregningResultat** (oppdater linje 104-110):

```python
class FristBeregningResultat(str, Enum):
    """Resultat av fristberegning (Port 3 - ren utmåling)"""
    GODKJENT_FULLT = "godkjent_fullt"
    DELVIS_GODKJENT = "delvis_godkjent"
    AVVENTER_SPESIFIKASJON = "avventer_spesifikasjon"

    # Generisk avslag (bruk sammen med subsidiaer_triggers for detaljer)
    AVSLATT = "avslatt"

    # Deprecated - bruk AVSLATT + subsidiaer_triggers i stedet
    AVSLATT_INGEN_HINDRING = "avslatt_ingen_hindring"  # @deprecated
```

---

### Oppgave 8: Backend - Oppdater SakState tilstander

**Fil**: `backend/models/sak_state.py`

**Endringer**:
1. Legg til subsidiære felt i `VederlagTilstand` (etter linje ~135)
2. Legg til subsidiære felt i `FristTilstand` (etter linje ~243)
3. Legg til `visningsstatus` computed field i begge

**Nye felt i VederlagTilstand** (legg til etter `godkjent_belop`):

```python
    # Subsidiært standpunkt (fra BH respons event)
    subsidiaer_triggers: Optional[List[str]] = Field(
        default=None,
        description="Liste over triggere for subsidiær vurdering"
    )
    subsidiaer_resultat: Optional[VederlagBeregningResultat] = Field(
        default=None,
        description="Subsidiært beregningsresultat"
    )
    subsidiaer_godkjent_belop: Optional[float] = Field(
        default=None,
        description="Subsidiært godkjent beløp"
    )
    subsidiaer_begrunnelse: Optional[str] = Field(
        default=None,
        description="BH's begrunnelse for subsidiær vurdering"
    )

    @computed_field
    @property
    def har_subsidiaert_standpunkt(self) -> bool:
        """True hvis BH har tatt subsidiær stilling på event-nivå"""
        return self.subsidiaer_resultat is not None

    @computed_field
    @property
    def visningsstatus(self) -> str:
        """Kombinert status for UI-visning inkludert subsidiær info"""
        if self.bh_resultat is None:
            return self.status.value

        # Sjekk om prinsipal avslått men subsidiært godkjent
        avslatt_koder = {
            VederlagBeregningResultat.AVSLATT,
            VederlagBeregningResultat.AVVIST_PREKLUSJON_RIGG,
            VederlagBeregningResultat.AVSLATT_TOTALT,
        }
        godkjent_koder = {
            VederlagBeregningResultat.GODKJENT_FULLT,
            VederlagBeregningResultat.DELVIS_GODKJENT,
        }

        if self.bh_resultat in avslatt_koder:
            if self.subsidiaer_resultat in godkjent_koder:
                return "avslatt_subsidiaert_godkjent"

        return self.bh_resultat.value
```

**Tilsvarende for FristTilstand** (etter `begrunnelse_beregning`).

---

### Oppgave 9: Backend - Oppdater TimelineService

**Fil**: `backend/services/timeline_service.py`

**Endringer**: Oppdater `_apply_respons_vederlag()` og `_apply_respons_frist()` for å kopiere subsidiære felt til tilstand.

**Eksempel for vederlag** (i `_apply_respons_vederlag`, ca. linje 350):

```python
def _apply_respons_vederlag(self, state: SakState, event: VederlagResponsEvent) -> None:
    """Appliser BH respons på vederlag"""
    data = event.data

    # ... eksisterende kode for prinsipalt resultat ...

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

**Tilsvarende for `_apply_respons_frist()`.**

---

## UI-spesifikasjon

### EventDetailModal med subsidiært standpunkt

```
┌─────────────────────────────────────────────────────────────────────┐
│  ✕  Svar på fristkrav                                               │
│      Innsendt av Kari Nordmann (BH)                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  📅 22. jan. 2025    👤 Kari Nordmann    [BH]    [Frist]             │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ PRINSIPALT RESULTAT                                 (mørk blå) │  │
│  │                                                               │  │
│  │ [████ Avvist - Varslet for sent ████]                         │  │
│  │ Godkjent: 0 dager                                             │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ ⚠️ SUBSIDIÆRT STANDPUNKT                              (amber)  │  │
│  │ ─────────────────────────────────────────────────────────────  │  │
│  │                                                               │  │
│  │ Årsak(er):                                                    │  │
│  │ • Nøytralt varsel for sent (§33.4)                            │  │
│  │ • Ingen reell fremdriftshindring (§33.5)                      │  │
│  │                                                               │  │
│  │ [████ Delvis godkjent ████]  14 dager                         │  │
│  │                                                               │  │
│  │ ─────────────────────────────────────────────────────────────  │  │
│  │ "Byggherren er etter dette uenig i kravet. Subsidiært, dersom │  │
│  │ retten skulle komme til at varsel var i tide og det forelå    │  │
│  │ reell hindring, kan BH under ingen omstendigheter se at mer   │  │
│  │ enn 14 dager er berettiget å kreve."                          │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ── Varselvurdering (§33.4 / §33.6) ────────────────────────────    │
│                                                                     │
│  Nøytralt varsel OK          [✗ Nei]                               │
│  Spesifisert krav OK         [—]                                   │
│  Begrunnelse                 ▼                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ Nøytralt varsel mottatt 15. januar, men grunnlaget oppstod    │  │
│  │ allerede 3. januar. TE varslet dermed 12 dager for sent...    │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ── Vilkårsvurdering (§33.5) ───────────────────────────────────    │
│                                                                     │
│  Vilkår oppfylt              [✗ Nei - Subsidiært]                  │
│  Begrunnelse                 ▼                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ TE hadde slakk i fremdriftsplanen. Arbeidet på kritisk linje  │  │
│  │ ble ikke påvirket...                                          │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ── Beregning ──────────────────────────────────────────────────    │
│                                                                     │
│  Godkjent dager              14 dager (subsidiært)                 │
│  Begrunnelse                 ▼                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ Selv om BH ikke anser at det forelå hindring, vil en          │  │
│  │ subsidiær vurdering av konsekvensene tilsi maksimalt 14...    │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ─────────────────────────────────────────────────────────────────  │
│  Event ID: evt-frist-resp-001                                       │
└─────────────────────────────────────────────────────────────────────┘
```

### Badge-markering for subsidiære felt

Når et felt vises som del av subsidiær vurdering, marker det:

```
Vilkår oppfylt    [✗ Nei]  [Subsidiært]
                   ↑ Rød     ↑ Amber badge
```

---

## Testing

### Backend tester

```python
# tests/test_events.py

def test_vederlag_respons_med_subsidiaer():
    """Test at subsidiære felt lagres korrekt"""
    data = VederlagResponsData(
        beregnings_resultat=VederlagBeregningResultat.AVVIST_PREKLUSJON_RIGG,
        godkjent_belop=750000,
        subsidiaer_triggers=[SubsidiaerTrigger.PREKLUSJON_RIGG],
        subsidiaer_resultat=VederlagBeregningResultat.DELVIS_GODKJENT,
        subsidiaer_godkjent_belop=950000,
        subsidiaer_begrunnelse="Subsidiært godkjent hvis varslet i tide"
    )

    assert data.subsidiaer_triggers == [SubsidiaerTrigger.PREKLUSJON_RIGG]
    assert data.subsidiaer_godkjent_belop == 950000


def test_frist_respons_med_flere_triggers():
    """Test kaskaderende subsidiære triggere"""
    data = FristResponsData(
        beregnings_resultat=FristBeregningResultat.AVVIST_PREKLUSJON,
        godkjent_dager=0,
        subsidiaer_triggers=[
            SubsidiaerTrigger.PREKLUSJON_NOYTRALT,
            SubsidiaerTrigger.INGEN_HINDRING
        ],
        subsidiaer_resultat=FristBeregningResultat.DELVIS_GODKJENT,
        subsidiaer_godkjent_dager=14,
    )

    assert len(data.subsidiaer_triggers) == 2
    assert SubsidiaerTrigger.INGEN_HINDRING in data.subsidiaer_triggers


def test_bakoverkompatibilitet():
    """Test at eksisterende data uten subsidiære felt fungerer"""
    data = VederlagResponsData(
        beregnings_resultat=VederlagBeregningResultat.GODKJENT_FULLT,
        godkjent_belop=100000,
    )

    assert data.subsidiaer_triggers is None
    assert data.subsidiaer_resultat is None
```

### Frontend tester

```typescript
// src/components/views/__tests__/EventDetailModal.test.tsx

describe('EventDetailModal - Subsidiært standpunkt', () => {
  it('viser subsidiært standpunkt når tilgjengelig', () => {
    const event: TimelineEntry = {
      event_id: 'test-1',
      tidsstempel: '2025-01-22T14:30:00',
      type: 'Svar på vederlagskrav',
      event_type: 'respons_vederlag',
      aktor: 'Test BH',
      rolle: 'BH',
      spor: 'vederlag',
      sammendrag: 'Test',
      event_data: {
        beregnings_resultat: 'avvist_preklusjon_rigg',
        godkjent_belop: 750000,
        subsidiaer_triggers: ['preklusjon_rigg'],
        subsidiaer_resultat: 'delvis_godkjent',
        subsidiaer_godkjent_belop: 950000,
        subsidiaer_begrunnelse: 'Test begrunnelse',
      },
    };

    render(<EventDetailModal open={true} onOpenChange={() => {}} event={event} />);

    expect(screen.getByText('SUBSIDIÆRT STANDPUNKT')).toBeInTheDocument();
    expect(screen.getByText('950 000 kr')).toBeInTheDocument();
    expect(screen.getByText(/Rigg\/drift varslet for sent/)).toBeInTheDocument();
  });

  it('skjuler subsidiært standpunkt når ikke tilgjengelig', () => {
    const event: TimelineEntry = {
      // ... event uten subsidiaer_resultat
    };

    render(<EventDetailModal open={true} onOpenChange={() => {}} event={event} />);

    expect(screen.queryByText('SUBSIDIÆRT STANDPUNKT')).not.toBeInTheDocument();
  });
});
```

### Integrasjonstester

1. **Test vederlag med prekludert rigg**:
   - Opprett vederlagskrav med rigg/drift
   - Send BH-respons med rigg varslet for sent
   - Verifiser at `subsidiaer_triggers` inneholder `preklusjon_rigg`
   - Verifiser at EventDetailModal viser begge resultater

2. **Test frist med kaskade**:
   - Opprett fristkrav
   - Send BH-respons med: varsel for sent OG ingen hindring
   - Verifiser at `subsidiaer_triggers` inneholder begge
   - Verifiser korrekt visning i UI

---

## Filreferanser

### Backend - Datamodell

| Fil | Linjer | Endring |
|-----|--------|---------|
| `backend/models/events.py` | ~110 | Legg til `SubsidiaerTrigger` enum |
| `backend/models/events.py` | 83-92 | Oppdater `VederlagBeregningResultat` (legg til AVSLATT) |
| `backend/models/events.py` | 104-110 | Oppdater `FristBeregningResultat` (legg til AVSLATT) |
| `backend/models/events.py` | 635-716 | Oppdater `VederlagResponsData` |
| `backend/models/events.py` | 718-815 | Oppdater `FristResponsData` |

### Backend - SakState og Services

| Fil | Linjer | Endring |
|-----|--------|---------|
| `backend/models/sak_state.py` | 69-167 | Oppdater `VederlagTilstand` med subsidiære felt |
| `backend/models/sak_state.py` | 198-263 | Oppdater `FristTilstand` med subsidiære felt |
| `backend/services/timeline_service.py` | ~350 | Oppdater `_apply_respons_vederlag()` |
| `backend/services/timeline_service.py` | ~400 | Oppdater `_apply_respons_frist()` |

### Frontend

| Fil | Linjer | Endring |
|-----|--------|---------|
| `src/types/timeline.ts` | ~63 | Legg til `SubsidiaerTrigger` type |
| `src/types/timeline.ts` | 329-343 | Oppdater `ResponsVederlagEventData` |
| `src/types/timeline.ts` | 346-363 | Oppdater `ResponsFristEventData` |
| `src/components/actions/RespondVederlagModal.tsx` | 482-545 | Oppdater `onSubmit` |
| `src/components/actions/RespondFristModal.tsx` | 367-401 | Oppdater `onSubmit` |
| `src/components/views/EventDetailModal.tsx` | ~179, ~467, ~574 | Legg til subsidiær visning |

---

## Sjekkliste for implementering

### Oppgave 1-3: Datamodell (events.py)
- [ ] **Backend**: Legg til `SubsidiaerTrigger` enum i `events.py`
- [ ] **Backend**: Oppdater `VederlagResponsData` med subsidiære felt
- [ ] **Backend**: Oppdater `FristResponsData` med subsidiære felt
- [ ] **Backend**: Verifiser bakoverkompatibilitet med eksisterende data

### Oppgave 4-5: Frontend typer og modaler
- [ ] **Frontend**: Legg til `SubsidiaerTrigger` type i `timeline.ts`
- [ ] **Frontend**: Oppdater `ResponsVederlagEventData` interface
- [ ] **Frontend**: Oppdater `ResponsFristEventData` interface
- [ ] **Frontend**: Oppdater `RespondVederlagModal` submit handler
- [ ] **Frontend**: Oppdater `RespondFristModal` submit handler
- [ ] **Frontend**: Legg til subsidiær visning i `EventDetailModal`

### Oppgave 7: Statuskoder (BeregningResultat enums)
- [ ] **Backend**: Legg til `AVSLATT` i `VederlagBeregningResultat`
- [ ] **Backend**: Legg til `AVSLATT` i `FristBeregningResultat`
- [ ] **Backend**: Marker deprecated koder med kommentarer
- [ ] **Frontend**: Oppdater TypeScript typer for nye statuskoder

### Oppgave 8-9: SakState og TimelineService
- [ ] **Backend**: Legg til subsidiære felt i `VederlagTilstand` (sak_state.py)
- [ ] **Backend**: Legg til subsidiære felt i `FristTilstand` (sak_state.py)
- [ ] **Backend**: Legg til `har_subsidiaert_standpunkt` computed field
- [ ] **Backend**: Legg til `visningsstatus` computed field
- [ ] **Backend**: Oppdater `_apply_respons_vederlag()` i TimelineService
- [ ] **Backend**: Oppdater `_apply_respons_frist()` i TimelineService

### Testing
- [ ] **Test**: Kjør eksisterende backend-tester
- [ ] **Test**: Kjør eksisterende frontend-tester
- [ ] **Test**: Opprett ny respons med subsidiært standpunkt
- [ ] **Test**: Verifiser at data lagres i JSON-fil
- [ ] **Test**: Verifiser at EventDetailModal viser subsidiært korrekt
- [ ] **Test**: Verifiser at SakState.visningsstatus fungerer

### Prioritert rekkefølge

1. **Først**: Oppgave 1-3 (datamodell) + Oppgave 7 (statuskoder)
2. **Deretter**: Oppgave 8-9 (SakState + TimelineService)
3. **Så**: Oppgave 4-5 (frontend)
4. **Til slutt**: Testing

---

*Dokument opprettet: 2025-12-09*
*Sist oppdatert: 2025-12-09*
*Forfatter: Claude (LLM Assistant)*
*Kontekst: Analyse og implementeringsplan for subsidiær standpunkt-lagring*
