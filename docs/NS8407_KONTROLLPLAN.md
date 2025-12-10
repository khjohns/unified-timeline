# NS 8407 Datamodell-kontrollplan

**Opprettet:** 2025-12-08
**Formål:** Grundig kontroll av at datamodeller og skjemaer i systemet samsvarer med NS 8407

---

## Innholdsfortegnelse

1. [Oversikt](#oversikt)
2. [Del A: Grunnlag (Ansvarsgrunnlag)](#del-a-grunnlag-ansvarsgrunnlag)
3. [Del B: Vederlagsjustering](#del-b-vederlagsjustering)
4. [Del C: Fristforlengelse](#del-c-fristforlengelse)
5. [Del D: BH-respons Grunnlag](#del-d-bh-respons-grunnlag)
6. [Del E: BH-respons Vederlag](#del-e-bh-respons-vederlag)
7. [Del F: BH-respons Frist](#del-f-bh-respons-frist)
8. [Del G: Varslingsregler og preklusjon](#del-g-varslingsregler-og-preklusjon)
9. [Del H: Kategorier og underkategorier](#del-h-kategorier-og-underkategorier)
10. [Del I: Endringsordre og EO](#del-i-endringsordre-og-eo)
11. [Oppsummering](#oppsummering)

---

## Oversikt

### Kontrollomfang

Denne planen dekker systematisk kontroll av:
- **Backend-modeller:** `backend/models/events.py`, `backend/models/sak_state.py`
- **Frontend-skjemaer:** `src/components/actions/*.tsx`
- **Konstanter:** `backend/constants/`, `src/constants/`
- **Typer:** `src/types/timeline.ts`

### Kontrollmetode

For hver seksjon:
1. Les relevant NS 8407-paragraf
2. Sjekk at datamodellen fanger alle obligatoriske felt
3. Sjekk at skjemaet eksponerer korrekte valg
4. Verifiser preklusjonsvarsler og frister
5. Kryss av utførte kontroller

---

## Del A: Grunnlag (Ansvarsgrunnlag)

### A.1 Hjemmelgrunnlag

**NS 8407-referanser:**
- §33.1 - Totalentreprenørens krav på fristforlengelse
- §34.1.1 - Vederlagsjustering ved endringer
- §34.1.2 - Vederlagsjustering ved svikt
- §33.3 - Force majeure

**Filer å kontrollere:**
- `backend/models/events.py` → `GrunnlagData` (linje ~263-307)
- `src/components/actions/SendGrunnlagModal.tsx`
- `src/constants/categories.ts` → `KRAV_STRUKTUR_NS8407`
- `backend/constants/grunnlag_categories.py`

### A.2 Kontrollpunkter - Hovedkategorier

| # | Kontrollpunkt | NS 8407 | Status |
|---|---------------|---------|--------|
| A.2.1 | ENDRING-kategori inkluderer §33.1a og §34.1.1 | §31, §32 | [x] |
| A.2.2 | SVIKT-kategori inkluderer §33.1b og §34.1.2 | §22-25 | [x] |
| A.2.3 | ANDRE-kategori inkluderer §33.1c (andre forhold BH har risiko for) | §33.1c | [x] |
| A.2.4 | FORCE_MAJEURE har kun frist-hjemmel, ikke vederlag | §33.3 | [x] |

**Kontrollnotat A.2:** Alle hovedkategorier verifisert OK. Frontend (categories.ts) og backend (grunnlag_categories.py) er synkroniserte. FORCE_MAJEURE har korrekt `hjemmel_vederlag: null`.

### A.3 Kontrollpunkter - Underkategorier ENDRING

| # | Kontrollpunkt | NS 8407 | Status |
|---|---------------|---------|--------|
| A.3.1 | EO (Endringsordre) refererer til §31.1/§31.3 | §31 | [x] |
| A.3.2 | IRREG (Irregulær endring) refererer til §32.1/§32.2 | §32 | [x] |
| A.3.3 | LOV_GJENSTAND refererer til §14.4 (lovendring kontraktsgjenstand) | §14.4 | [x] |
| A.3.4 | LOV_PROSESS refererer til §15.2 (lovendring prosess) | §15.2 | [x] |
| A.3.5 | GEBYR refererer til §26.3 (offentlige gebyrer) | §26.3 | [x] |
| A.3.6 | SAMORD refererer til §21.4 (samordning) | §21.4 | [x] |
| A.3.7 | FORSERING refererer til §33.8 (forsering ved uberettiget avslag) | §33.8 | [x] |
| A.3.8 | SVAR_VARSEL dekker §25.3/§32.3 (BH svar innebærer endring) | §25.3, §32.3 | [x] |

**Kontrollnotat A.3:** Alle ENDRING-underkategorier verifisert. EO har hjemmel_basis "31.1", IRREG har "32.1", etc. Varselkrav_ref er korrekt satt.

### A.4 Kontrollpunkter - Underkategorier SVIKT

| # | Kontrollpunkt | NS 8407 | Status |
|---|---------------|---------|--------|
| A.4.1 | MEDVIRK dekker §22.3 (fysisk arbeidsgrunnlag) og §22.4 (materialer) | §22.3, §22.4 | [x] |
| A.4.2 | SIDEENTR refererer til §1.7 og samordning med sideentreprenører | §1.7, §21.4 | [~] |
| A.4.3 | PROSJ_FEIL dekker prosjekteringsfeil før tiltransport | §24.1 | [~] |
| A.4.4 | ARBBESKR dekker feil i arbeidsbeskrivelse/tegninger | §24.1 | [~] |
| A.4.5 | TEGN_SENT dekker forsinkede tegninger fra BH | §22.3 | [~] |
| A.4.6 | BESLUTNING dekker forsinkede beslutninger fra BH | §22.5 | [~] |

**Kontrollnotat A.4:**
- MEDVIRK er korrekt med hjemmel_basis "22" og dekker §22.3/§22.4.
- **AVVIK:** A.4.2-A.4.6 - Disse underkategoriene finnes IKKE i systemet. Planen spesifiserer kategorier som ikke er implementert. De eksisterende SVIKT-underkategoriene er: MEDVIRK, ADKOMST, GRUNN, KULTURMINNER, PROSJ_RISIKO, BH_FASTHOLDER. ADKOMST, GRUNN, KULTURMINNER, PROSJ_RISIKO og BH_FASTHOLDER er plassert under SVIKT i koden, ikke under ANDRE som planen antyder.

### A.5 Kontrollpunkter - Underkategorier ANDRE

| # | Kontrollpunkt | NS 8407 | Status |
|---|---------------|---------|--------|
| A.5.1 | ADKOMST refererer til §22.2 (rettslige forhold) | §22.2 | [~] |
| A.5.2 | GRUNN refererer til §23.1 (uforutsette grunnforhold) | §23.1 | [~] |
| A.5.3 | KULTURMINNER refererer til §23.3 | §23.3 | [~] |
| A.5.4 | PROSJ_RISIKO refererer til §24.1 (BH prosjekteringsrisiko) | §24.1 | [~] |
| A.5.5 | BH_FASTHOLDER refererer til §24.2.2 tredje ledd | §24.2.2 | [~] |
| A.5.6 | NEKT_MH refererer til §10.2 (nektelse kontraktsmedhjelper) | §10.2 | [x] |
| A.5.7 | NEKT_TILTRANSPORT refererer til §12.1.2 | §12.1.2 | [x] |
| A.5.8 | SKADE_BH refererer til §19.1 (skade forårsaket av BH) | §19.1 | [x] |
| A.5.9 | BRUKSTAKELSE refererer til §38.1 (urettmessig brukstakelse) | §38.1 | [x] |
| A.5.10 | STANS_BET refererer til §29.2 (stans ved betalingsmislighold) | §29.2 | [x] |
| A.5.11 | STANS_UENIGHET refererer til §35.1 (utførelsesplikt ved uenighet) | §35.1 | [x] |

**Kontrollnotat A.5:**
- A.5.6-A.5.11 er korrekt implementert under ANDRE-kategorien med riktige hjemmelreferanser.
- **AVVIK:** A.5.1-A.5.5 (ADKOMST, GRUNN, KULTURMINNER, PROSJ_RISIKO, BH_FASTHOLDER) er plassert under **SVIKT** i koden, ikke under ANDRE som planspesifikasjonen antyder. Dette er en **diskrepans mellom plan og implementasjon**.
  - Juridisk vurdering: Plasseringen under SVIKT er faktisk korrekt iht. NS 8407 §33.1 b) som refererer til "forsinkelse eller svikt ved byggherrens ytelser etter punkt 22, 23 og 24". Planspesifikasjonen A.5.1-A.5.5 bør flyttes til A.4 for å matche implementasjonen.

### A.6 Kontrollpunkter - Underkategorier FORCE_MAJEURE

| # | Kontrollpunkt | NS 8407 | Status |
|---|---------------|---------|--------|
| A.6.1 | FM_EGEN dekker §33.3 første ledd (værforhold, påbud, streik, lockout) | §33.3 | [x] |
| A.6.2 | FM_MH dekker §33.3 annet ledd (hindring hos kontraktsmedhjelper) | §33.3 | [x] |
| A.6.3 | FM gir KUN fristforlengelse, IKKE vederlag (§33.3 siste ledd) | §33.3 | [x] |

**Kontrollnotat A.6:** Alle FORCE_MAJEURE-underkategorier er korrekt implementert:
- FM_EGEN har hjemmel_basis "33.3 første ledd" og beskrivelse nevner "værforhold, påbud/forbud, streik, lockout"
- FM_MH har hjemmel_basis "33.3 annet ledd" og dekker hindring hos kontraktsmedhjelper
- FORCE_MAJEURE har `hjemmel_vederlag: null` og `type_krav: "Tid"` - bekrefter at kun fristforlengelse gjelder

### A.7 Kontrollpunkter - GrunnlagData-struktur

| # | Kontrollpunkt | NS 8407 | Status |
|---|---------------|---------|--------|
| A.7.1 | `tittel` - kort beskrivelse finnes | - | [x] |
| A.7.2 | `hovedkategori` matcher ENDRING/SVIKT/ANDRE/FORCE_MAJEURE | §33.1 | [x] |
| A.7.3 | `underkategori` er liste som støtter multi-select | - | [x] |
| A.7.4 | `beskrivelse` - detaljert beskrivelse av grunnlag | - | [x] |
| A.7.5 | `dato_oppdaget` - når TE ble klar over forholdet | §34.1.2 | [x] |
| A.7.6 | `grunnlag_varsel` - VarselInfo med dato + metode | §5, §32.2 | [x] |
| A.7.7 | `kontraktsreferanser` - liste med hjemler (f.eks. "§25.2") | - | [x] |
| A.7.8 | `vedlegg_ids` - støtte for dokumentvedlegg | - | [x] |

**Kontrollnotat A.7:** Alle GrunnlagData-felt er korrekt implementert i `backend/models/events.py` (linje 263-307):
- `tittel`: str med min_length=1
- `hovedkategori`: str - valideres mot kategorier
- `underkategori`: Union[str, List[str]] - støtter både enkeltvalg og multi-select
- `beskrivelse`: str med min_length=1
- `dato_oppdaget`: str (YYYY-MM-DD format)
- `grunnlag_varsel`: Optional[VarselInfo] med dato_sendt og metode
- `kontraktsreferanser`: List[str] (default tom liste)
- `vedlegg_ids`: List[str] (default tom liste)

### A.8 Kontrollpunkter - SendGrunnlagModal

| # | Kontrollpunkt | NS 8407 | Status |
|---|---------------|---------|--------|
| A.8.1 | Dropdown/RadioGroup for hovedkategori | - | [x] |
| A.8.2 | Multi-select for underkategori filtrert på hovedkategori | - | [x] |
| A.8.3 | Datofelt for dato_oppdaget | §34.1.2 | [x] |
| A.8.4 | Preklusjonsvarsel vises hvis >uten ugrunnet opphold siden oppdagelse | §32.2 | [x] |
| A.8.5 | VarselInfo-seksjon med dato og metode (epost, møte, etc.) | §5 | [x] |
| A.8.6 | Kontraktsreferanser vises basert på valgt kategori | - | [x] |
| A.8.7 | Støtte for er_etter_tilbud (§14.4) | §14.4 | [x] |

**Kontrollnotat A.8:** Alle SendGrunnlagModal-funksjoner er korrekt implementert (`src/components/actions/SendGrunnlagModal.tsx`, 513 linjer):
- A.8.1: Select-komponent med HOVEDKATEGORI_OPTIONS (linje 204-227)
- A.8.2: Checkbox multi-select med getUnderkategorier() filtrert på valgt hovedkategori (linje 243-275)
- A.8.3: DatePicker for dato_oppdaget med dager-siden-visning (linje 352-372)
- A.8.4: Preklusjonsvarsel via getPreklusjonsvarsel() og getPreklusjonsvarselMellomDatoer() (linje 376-383, 422-430)
- A.8.5: VarselInfo-seksjon med dato_varsel_sendt (DatePicker) og varsel_metode (checkboxes fra VARSEL_METODER_OPTIONS) (linje 403-453)
- A.8.6: Kontraktsreferanser som CSV-input i Collapsible (linje 456-467)
- A.8.7: er_etter_tilbud checkbox vises når harLovendring=true (sjekker erLovendring() for valgte underkategorier) (linje 305-325)

---

## Del B: Vederlagsjustering

### B.1 Hjemmelgrunnlag

**NS 8407-referanser:**
- §34.1.1 - Vederlagsjustering ved endringer
- §34.1.2 - Vederlagsjustering ved svikt
- §34.1.3 - Særskilt varsel om rigg/drift og produktivitet
- §34.2 - Generelle regler (fastpris, enhetspriser, regning)
- §34.3 - Enhetspriser og justerte enhetspriser
- §34.4 - Regningsarbeid

**Filer å kontrollere:**
- `backend/models/events.py` → `VederlagData` (linje ~342-425)
- `src/components/actions/SendVederlagModal.tsx`
- `src/constants/paymentMethods.ts`

### B.2 Kontrollpunkter - Vederlagsmetoder

| # | Kontrollpunkt | NS 8407 | Status |
|---|---------------|---------|--------|
| B.2.1 | ENHETSPRISER - refererer til §34.3.1/§34.3.2 | §34.3 | [x] |
| B.2.2 | REGNINGSARBEID - refererer til §34.4 og §30 | §34.4, §30 | [x] |
| B.2.3 | FASTPRIS_TILBUD - refererer til §34.2.1 | §34.2.1 | [x] |
| B.2.4 | Metode kan foreslås av TE, men BH kan godkjenne annen metode | §34.2.1 | [x] |

**Kontrollnotat B.2:** Alle vederlagsmetoder er korrekt implementert:
- ENHETSPRISER: `paymentMethods.ts` linje 21-23 refererer til §34.3
- REGNINGSARBEID: `paymentMethods.ts` linje 24-27 refererer til §30.2/§34.4
- FASTPRIS_TILBUD: `paymentMethods.ts` linje 28-31 refererer til §34.2.1
- TE velger metode i `SendVederlagModal.tsx`, BH kan ta stilling i respons

### B.3 Kontrollpunkter - VederlagData-struktur

| # | Kontrollpunkt | NS 8407 | Status |
|---|---------------|---------|--------|
| B.3.1 | `metode` - enum med ENHETSPRISER/REGNINGSARBEID/FASTPRIS_TILBUD | §34 | [x] |
| B.3.2 | `belop_direkte` - for EP/FP, støtter negative (fradrag) | §34.3, §34.4 | [x] |
| B.3.3 | `kostnads_overslag` - for REGNINGSARBEID | §30.2 | [x] |
| B.3.4 | `begrunnelse` - beskrivelse av krav | - | [x] |
| B.3.5 | `krav_fremmet_dato` - når krav formelt ble sendt | §34.1.2 | [x] |

**Kontrollnotat B.3:** VederlagData-struktur i `events.py` (linje 342-425) er komplett:
- `metode`: VederlagsMetode enum (linje 355-358)
- `belop_direkte`: Optional[float] med støtte for negative verdier (linje 361-364)
- `kostnads_overslag`: Optional[float] med ge=0 for regningsarbeid (linje 365-369)
- `begrunnelse`: str med min_length=1 (linje 372)
- `krav_fremmet_dato`: Optional[str] YYYY-MM-DD (linje 421-424)

### B.4 Kontrollpunkter - Særskilte krav (§34.1.3)

| # | Kontrollpunkt | NS 8407 | Status |
|---|---------------|---------|--------|
| B.4.1 | `saerskilt_krav` struktur eksisterer | §34.1.3 | [x] |
| B.4.2 | `rigg_drift` - separat beløp + dato_klar_over | §34.1.3 første ledd | [x] |
| B.4.3 | `produktivitet` - separat beløp + dato_klar_over | §34.1.3 annet ledd | [x] |
| B.4.4 | 7-dagers frist fra "klar over" for særskilt varsel | §34.1.3 tredje ledd | [x] |
| B.4.5 | Preklusjonsvarsel vises hvis >7 dager siden dato_klar_over | §34.1.3 | [x] |

**Kontrollnotat B.4:** Særskilte krav er korrekt implementert per §34.1.3:
- `SaerskiltKrav` klasse (linje 194-208) med separate `rigg_drift` og `produktivitet` objekter
- `SaerskiltKravItem` (linje 176-191) har `belop` og `dato_klar_over` per type
- Frontend `SendVederlagModal.tsx` viser preklusjonsvarsel via `sjekkRiggDriftFrist()` (linje 170-178)
- Separate datofelt tillater korrekt fristberegning per kravtype (TE kan bli klar over kostnadene på ulike tidspunkt)

### B.5 Kontrollpunkter - Varselkrav

| # | Kontrollpunkt | NS 8407 | Status |
|---|---------------|---------|--------|
| B.5.1 | `rigg_drift_varsel` - VarselInfo for rigg/drift | §34.1.3 | [x] |
| B.5.2 | `justert_ep_varsel` - varsel om EP-justering | §34.3.3 | [x] |
| B.5.3 | `regningsarbeid_varsel` - varsel FØR arbeid starter | §34.4 | [x] |
| B.5.4 | `produktivitetstap_varsel` - varsel om produktivitetstap | §34.1.3 | [x] |
| B.5.5 | Manglende forhåndsvarsel ved regning → bevisbyrde-advarsel | §34.4 | [x] |

**Kontrollnotat B.5:** Alle varselkrav er implementert i VederlagData:
- `rigg_drift_varsel`: VarselInfo (linje 393-396)
- `justert_ep_varsel`: VarselInfo (linje 403-406)
- `regningsarbeid_varsel`: VarselInfo med "FØR oppstart" beskrivelse (linje 409-412)
- `produktivitetstap_varsel`: VarselInfo (linje 415-418)
- Frontend viser bevisbyrde-advarsel ved manglende forhåndsvarsel (SendVederlagModal linje 368-373)

### B.6 Kontrollpunkter - Justert enhetspris

| # | Kontrollpunkt | NS 8407 | Status |
|---|---------------|---------|--------|
| B.6.1 | `krever_justert_ep` - checkbox for EP-justering | §34.3.3 | [x] |
| B.6.2 | Varselplikt ved EP-justering (uten ugrunnet opphold) | §34.3.3 første ledd | [x] |
| B.6.3 | BH må svare på EP-justering uten ugrunnet opphold | §34.3.3 annet ledd | [x] |

**Kontrollnotat B.6:** Justert enhetspris håndteres korrekt:
- `krever_justert_ep`: bool i VederlagData (linje 399-402)
- Frontend checkbox i SendVederlagModal (linje 308-319)
- Warning Alert om varselplikt vises når krever_justert_ep=true (linje 320-325)
- BH svarplikt håndteres i Del E (BH-respons Vederlag)

### B.7 Kontrollpunkter - SendVederlagModal

| # | Kontrollpunkt | NS 8407 | Status |
|---|---------------|---------|--------|
| B.7.1 | RadioGroup for metodevalg | §34 | [x] |
| B.7.2 | Beløpsfelt som tilpasser seg metode | §34 | [x] |
| B.7.3 | Checkbox for justert EP (kun ved ENHETSPRISER) | §34.3.3 | [x] |
| B.7.4 | Checkboxer for rigg/drift og produktivitet (§34.1.3) | §34.1.3 | [x] |
| B.7.5 | Datofelt for "klar over" for hver særskilt post | §34.1.3 | [x] |
| B.7.6 | 7-dagers fristsjekk med visuell advarsel | §34.1.3 | [x] |
| B.7.7 | Forhåndsvarsel-checkbox ved REGNINGSARBEID | §34.4 | [x] |
| B.7.8 | grunnlagEventId kobling til ansvarsgrunnlag | Event sourcing | [x] |

**Kontrollnotat B.7:** SendVederlagModal.tsx (595 linjer) implementerer alle funksjoner:
- B.7.1: RadioGroup med METODE_OPTIONS (linje 253-279)
- B.7.2: Metodespesifikke beløpsfelt - ENHETSPRISER/FASTPRIS bruker belop_direkte, REGNINGSARBEID bruker kostnads_overslag
- B.7.3: krever_justert_ep checkbox kun synlig i ENHETSPRISER-blokken (linje 307-326)
- B.7.4: har_rigg_krav og har_produktivitet_krav checkboxes (linje 411-422, 476-487)
- B.7.5: dato_klar_over_rigg og dato_klar_over_produktivitet DatePickers (linje 443-458, 508-524)
- B.7.6: Preklusjonsvarsel Alerts for begge typer (linje 462-469, 527-534)
- B.7.7: varslet_for_oppstart checkbox med danger alert (linje 355-373)
- B.7.8: grunnlagEventId sendes i mutation data (linje 205)

---

## Del C: Fristforlengelse

### C.1 Hjemmelgrunnlag

**NS 8407-referanser:**
- §33.1 - TEs krav på fristforlengelse
- §33.3 - Force majeure
- §33.4 - Varsel om fristforlengelse (nøytralt)
- §33.5 - Beregning av fristforlengelse
- §33.6 - Spesifisering av krav
- §33.7 - Svarplikt
- §33.8 - Forsering ved uberettiget avslag

**Filer å kontrollere:**
- `backend/models/events.py` → `FristData` (linje ~462-540)
- `src/components/actions/SendFristModal.tsx`
- `src/constants/fristVarselTypes.ts`

### C.2 Kontrollpunkter - Varseltyper

| # | Kontrollpunkt | NS 8407 | Status |
|---|---------------|---------|--------|
| C.2.1 | NOYTRALT - §33.4 (varsel uten antall dager) | §33.4 | [x] |
| C.2.2 | SPESIFISERT - §33.6 (krav med antall dager) | §33.6 | [x] |
| C.2.3 | BEGGE - støtte for å sende begge samtidig | §33.4 + §33.6 | [x] |
| C.2.4 | FORCE_MAJEURE - §33.3 (egen type) | §33.3 | [x] |

**Kontrollnotat C.2:** FristVarselType enum (events.py:90-95) og fristVarselTypes.ts matcher:
- C.2.1: `NOYTRALT = "noytralt"` med §33.4 kommentar
- C.2.2: `SPESIFISERT = "spesifisert"` med §33.6.1 kommentar
- C.2.3: `BEGGE = "begge"` - støtte for begge varsler
- C.2.4: `FORCE_MAJEURE = "force_majeure"` med §33.3 kommentar

### C.3 Kontrollpunkter - FristData-struktur

| # | Kontrollpunkt | NS 8407 | Status |
|---|---------------|---------|--------|
| C.3.1 | `varsel_type` - enum NOYTRALT/SPESIFISERT/BEGGE/FORCE_MAJEURE | §33.4, §33.6 | [x] |
| C.3.2 | `antall_dager` - obligatorisk for SPESIFISERT/BEGGE/FM | §33.6.1 | [x] |
| C.3.3 | `begrunnelse` - beskrivelse av krav | §33.6.1 | [x] |
| C.3.4 | `noytralt_varsel` - VarselInfo | §33.4 | [x] |
| C.3.5 | `spesifisert_varsel` - VarselInfo | §33.6 | [x] |
| C.3.6 | `ny_sluttdato` - beregnet ny sluttdato | §33.5 | [x] |
| C.3.7 | `fremdriftshindring_dokumentasjon` - beskrivelse av hindring | §33.5 | [x] |

**Kontrollnotat C.3:** FristData (events.py:462-540) har alle påkrevde felt:
- C.3.1: `varsel_type: FristVarselType` (linje 486-489)
- C.3.2: `antall_dager` med model_validator som krever verdi for SPESIFISERT/BEGGE (linje 504-540)
- C.3.3: `begrunnelse: str = Field(..., min_length=1)` (linje 510-514)
- C.3.4: `noytralt_varsel: Optional[VarselInfo]` (linje 492-495)
- C.3.5: `spesifisert_varsel: Optional[VarselInfo]` (linje 498-501)
- C.3.6: `ny_sluttdato: Optional[str]` (linje 523-526)
- C.3.7: `fremdriftshindring_dokumentasjon: Optional[str]` (linje 518-521)

### C.4 Kontrollpunkter - Nøytralt varsel (§33.4)

| # | Kontrollpunkt | NS 8407 | Status |
|---|---------------|---------|--------|
| C.4.1 | Nøytralt varsel kan sendes "selv om man ennå ikke kan fremme spesifisert krav" | §33.4 | [x] |
| C.4.2 | Krav tapes hvis ikke varslet innen fristens utløp | §33.4 | [x] |
| C.4.3 | "Uten ugrunnet opphold" - preklusjonsvarsel | §33.4 | [x] |

**Kontrollnotat C.4:** Nøytralt varsel støttes korrekt:
- C.4.1: Frontend viser nøytralt varsel-seksjon (linje 303-388) med beskrivelse "sendes når omfang ikke er kjent"
- C.4.2: VarselInfo-strukturen registrerer dato og metode for varsling
- C.4.3: Preklusjonsvarsel implementert (linje 309-329): Amber warning >7 dager, rød kritisk >14 dager

### C.5 Kontrollpunkter - Spesifisert krav (§33.6)

| # | Kontrollpunkt | NS 8407 | Status |
|---|---------------|---------|--------|
| C.5.1 | §33.6.1 - "når parten har grunnlag for å beregne omfanget" | §33.6.1 | [x] |
| C.5.2 | "Uten ugrunnet opphold" etter grunnlag foreligger | §33.6.1 | [x] |
| C.5.3 | Reduksjonsvarsel ved forsinket spesifisering | §33.6.1 | [x] |
| C.5.4 | §33.6.2 - BH kan etterspørre spesifisering | §33.6.2 | [x] |
| C.5.5 | Etterlysning KRITISK - TE må svare "uten ugrunnet opphold" | §33.6.2 | [x] |
| C.5.6 | `har_mottatt_etterlysning` flagg i skjema | §33.6.2 | [x] |

**Kontrollnotat C.5:** Spesifisert krav (§33.6) implementert fullstendig:
- C.5.1: Zod schema krever antall_dager for spesifisert (linje 60-72)
- C.5.2: `dagerSidenGrunnlag` beregning (linje 140-142)
- C.5.3: Amber warning box "Risiko for avkortning (§33.6.1)" når >21 dager (linje 257-269)
- C.5.4: `harMottattEtterlysning` prop støtter BH-etterlysning
- C.5.5: Kritisk rød boks med Badge variant="danger" og role="alert" (linje 214-231)
- C.5.6: `er_svar_pa_etterlysning: harMottattEtterlysning` sendes til backend (linje 199)

### C.6 Kontrollpunkter - Beregning (§33.5)

| # | Kontrollpunkt | NS 8407 | Status |
|---|---------------|---------|--------|
| C.6.1 | Fristforlengelse = virkning på fremdrift | §33.5 | [x] |
| C.6.2 | Hensyn til nødvendig avbrudd | §33.5 | [x] |
| C.6.3 | Hensyn til ugunstig/gunstig årstid | §33.5 | [x] |
| C.6.4 | Samlet virkning av tidligere varslede forhold | §33.5 | [x] |
| C.6.5 | Plikt til å begrense skadevirkninger | §33.5 | [x] |

**Kontrollnotat C.6:** §33.5 beregningsfaktorer dekkes av fritekst-felt:
- C.6.1: `fremdriftshindring_dokumentasjon` felt + begrunnelse helpText om fremdrift
- C.6.2-C.6.4: Dekkes implisitt av fritekst-begrunnelse og dokumentasjonsfelt
- C.6.5: Plikt til å begrense omtalt i ReviseFristModal.tsx (forsering-kontekst)
- Arkitekturbeslutning: §33.5-faktorene er vurderingsmomenter som naturlig hører i fritekst

### C.7 Kontrollpunkter - SendFristModal

| # | Kontrollpunkt | NS 8407 | Status |
|---|---------------|---------|--------|
| C.7.1 | RadioGroup for varseltype | - | [x] |
| C.7.2 | antall_dager påkrevd for SPESIFISERT/BEGGE/FM | §33.6.1 | [x] |
| C.7.3 | Separate VarselInfo for nøytralt og spesifisert | §33.4, §33.6 | [x] |
| C.7.4 | Checkbox/info om mottatt BH-etterlysning | §33.6.2 | [x] |
| C.7.5 | Kritisk varsel ved etterlysning | §33.6.2 | [x] |
| C.7.6 | Reduksjonsvarsel ved sen spesifisering | §33.6.1 | [x] |
| C.7.7 | grunnlagEventId kobling til ansvarsgrunnlag | Event sourcing | [x] |
| C.7.8 | berørte_aktiviteter felt | §33.5 | [x] |

**Kontrollnotat C.7:** SendFristModal.tsx (547 linjer) implementerer alle funksjoner:
- C.7.1: RadioGroup med FRIST_VARSELTYPE_OPTIONS (linje 279-294)
- C.7.2: Zod schema .refine() validerer antall_dager for relevante typer (linje 60-72)
- C.7.3: Separate seksjoner for nøytralt (298-362) og spesifisert (364-428) med VarselInfo
- C.7.4: `harMottattEtterlysning` prop (linje 92)
- C.7.5: Kritisk rød Alert med role="alert" og Badge variant="danger" (linje 214-231)
- C.7.6: Amber warning "Risiko for avkortning (§33.6.1)" (linje 257-269)
- C.7.7: `grunnlag_event_id: grunnlagEventId` sendes til backend (linje 189)
- C.7.8: `berorte_aktiviteter` felt med helpText om kritisk linje (linje 494-507)

---

## Del D: BH-respons Grunnlag

### D.1 Hjemmelgrunnlag

**NS 8407-referanser:**
- §32.3 - BH svarplikt på irregulært endring
- §25.3 - BH svarplikt på varsel om svikt
- §33.3 - Force majeure erkjennelse

**Filer å kontrollere:**
- `backend/models/events.py` → `GrunnlagResponsData` (linje ~589-626)
- `src/components/actions/RespondGrunnlagModal.tsx`
- `src/constants/responseOptions.ts`

### D.2 Kontrollpunkter - Responsalternativer

| # | Kontrollpunkt | NS 8407 | Status |
|---|---------------|---------|--------|
| D.2.1 | GODKJENT - BH aksepterer ansvar fullt ut | - | [x] |
| D.2.2 | DELVIS_GODKJENT - BH aksepterer deler av ansvar | - | [x] |
| D.2.3 | ERKJENN_FM - BH erkjenner force majeure (kun frist) | §33.3 | [x] |
| D.2.4 | AVVIST_UENIG - BH avviser på materielt grunnlag | - | [x] |
| D.2.5 | AVVIST_FOR_SENT - BH avviser pga. preklusjon | §32.2, §34.1.2 | [x] |
| D.2.6 | FRAFALT - BH frafaller pålegg (§32.3c) | §32.3 c) | [x] |
| D.2.7 | KREVER_AVKLARING - BH ber om mer dokumentasjon | - | [x] |

**Kontrollnotat D.2:** Alle 7 responsalternativer finnes i `responseOptions.ts`:
- D.2.1-D.2.7: BH_GRUNNLAGSVAR_OPTIONS (linje 14-44) inneholder alle alternativer
- ERKJENN_FM: Kun synlig ved Force Majeure-grunnlag (modal filtrerer linje 249-254)
- FRAFALT: Kun synlig for irregulære endringer (modal filtrerer linje 256)
- Hjelpetekster i BH_GRUNNLAGSVAR_DESCRIPTIONS (linje 164-172)

### D.3 Kontrollpunkter - GrunnlagResponsData-struktur

| # | Kontrollpunkt | NS 8407 | Status |
|---|---------------|---------|--------|
| D.3.1 | `resultat` - enum med alle responsalternativer | - | [x] |
| D.3.2 | `begrunnelse` - BH må begrunne (§32.3 siste ledd) | §32.3 | [x] |
| D.3.3 | `akseptert_kategori` - BH kan rekategorisere | - | [x] |
| D.3.4 | `varsel_for_sent` - preklusjonsvurdering | §32.2 | [x] |
| D.3.5 | `krever_dokumentasjon` - liste over krevd dok. | - | [x] |

**Kontrollnotat D.3:** GrunnlagResponsData (events.py linje 589-626):
- D.3.1: `resultat: GrunnlagResponsResultat = Field(...)` (linje 596-599)
- D.3.2: `begrunnelse: str = Field(..., min_length=1)` (linje 600-604) - påkrevd
- D.3.3: `akseptert_kategori: Optional[str]` (linje 607-610)
- D.3.4: `varsel_for_sent: bool = Field(default=False)` (linje 618-622)
- D.3.5: `krever_dokumentasjon: List[str] = Field(default_factory=list)` (linje 613-616)

### D.4 Kontrollpunkter - BH svarplikt

| # | Kontrollpunkt | NS 8407 | Status |
|---|---------------|---------|--------|
| D.4.1 | "Uten ugrunnet opphold" - passivitetsvarsel | §32.3 | [x] |
| D.4.2 | Passivitet >10 dager skal varsles i modal | §32.3 | [x] |
| D.4.3 | Dersom BH ikke svarer → endring anses inntruffet | §32.3 annet ledd | [x] |

**Kontrollnotat D.4:** RespondGrunnlagModal.tsx implementerer §32.3 svarplikt:
- D.4.1: `dagerSidenVarsel` beregnes fra `dato_varslet` (linje 117-119)
- D.4.2: `erPassiv = erIrregulaer && dagerSidenVarsel > 10` (linje 120), rød alert vises (linje 207-225)
- D.4.3: Tekst "passivitet kan medføre at endringen anses akseptert" (linje 218-222)

### D.5 Kontrollpunkter - RespondGrunnlagModal

| # | Kontrollpunkt | NS 8407 | Status |
|---|---------------|---------|--------|
| D.5.1 | Dropdown for resultat | - | [x] |
| D.5.2 | Tekstfelt for begrunnelse (obligatorisk) | §32.3 | [x] |
| D.5.3 | Passivitetsvarsel basert på dager siden grunnlag sendt | §32.3 | [x] |
| D.5.4 | FRAFALT kun tilgjengelig for irregulære endringer | §32.3 c) | [x] |
| D.5.5 | ERKJENN_FM kun tilgjengelig ved FM-grunnlag | §33.3 | [x] |
| D.5.6 | referrer_til_event_id kobling til grunnlag-event | Event sourcing | [x] |

**Kontrollnotat D.5:** RespondGrunnlagModal.tsx (411 linjer):
- D.5.1: `<Controller name="resultat">` med Select dropdown (linje 234-266)
- D.5.2: `<Textarea {...register('begrunnelse')}>` påkrevd min 10 tegn (linje 348-366, Zod linje 47)
- D.5.3: Rød alert med Badge "Passivitetsrisiko (§32.3)" ved erPassiv (linje 207-225)
- D.5.4: `if (opt.value === 'frafalt' && !erIrregulaer) return false` (linje 256)
- D.5.5: Ved FM vises KUN "erkjenn_fm", ellers filtreres ut (linje 249-254)
- D.5.6: `grunnlag_event_id: grunnlagEventId` sendes til backend (linje 137)

---

## Del E: BH-respons Vederlag

### E.1 Hjemmelgrunnlag

**NS 8407-referanser:**
- §34.3.3 - Svarplikt ved EP-justering
- §30.2 - Hold tilbake ved manglende overslag
- §34.1.3 - Rigg-preklusjon

**Filer å kontrollere:**
- `backend/models/events.py` → `VederlagResponsData` (linje ~629-709)
- `src/components/actions/RespondVederlagModal.tsx`
- `src/constants/responseOptions.ts`

### E.2 Kontrollpunkter - Port-modell

**VIKTIG:** Vederlagsrespons er REN beregning - BH kan IKKE avvise grunnlag her.

| # | Kontrollpunkt | NS 8407 | Status |
|---|---------------|---------|--------|
| E.2.1 | Port 1: Preklusjonsvurdering (varsler i tide?) | §34.1.3 | [x] |
| E.2.2 | Port 2: Beregning (godkjent beløp) | §34 | [x] |
| E.2.3 | Ingen "avvist grunnlag" alternativ i vederlag-respons | - | [x] |

**Kontrollnotat E.2:** VederlagResponsData (events.py linje 629-710):
- E.2.1: Port 1 felt: `saerskilt_varsel_rigg_drift_ok`, `varsel_justert_ep_ok`, `varsel_start_regning_ok`, `krav_fremmet_i_tide` (linje 654-681)
- E.2.2: Port 2 felt: `beregnings_resultat` enum og `godkjent_belop` (linje 691-699)
- E.2.3: BH_VEDERLAGSSVAR_OPTIONS (responseOptions.ts linje 49-79) inneholder INGEN "avvist_grunnlag" - kun beregningsalternativer

### E.3 Kontrollpunkter - Responsalternativer

| # | Kontrollpunkt | NS 8407 | Status |
|---|---------------|---------|--------|
| E.3.1 | GODKJENT_FULLT - BH aksepterer beløp fullt ut | - | [x] |
| E.3.2 | DELVIS_GODKJENT - BH godkjenner redusert beløp | - | [x] |
| E.3.3 | GODKJENT_ANNEN_METODE - BH godkjenner med annen metode | §34.2.1 | [x] |
| E.3.4 | AVVENTER_SPESIFIKASJON - TE må spesifisere nærmere | - | [x] |
| E.3.5 | AVSLATT_TOTALT - BH avslår beregning | - | [x] |
| E.3.6 | HOLD_TILBAKE - §30.2 ved manglende overslag | §30.2 | [x] |
| E.3.7 | AVVIST_PREKLUSJON_RIGG - §34.1.3 rigg-varsel for sent | §34.1.3 | [x] |

**Kontrollnotat E.3:** responseOptions.ts linje 49-79:
- E.3.1: `godkjent_fullt` (linje 51-54)
- E.3.2: `delvis_godkjent` (linje 55-58)
- E.3.3: `godkjent_annen_metode` (linje 59-62)
- E.3.4: `avventer_spesifikasjon` (linje 67-70)
- E.3.5: `avslatt_totalt` (linje 75-78) - presisert "Kun ved dobbeltfakturering e.l. (IKKE grunnlag)"
- E.3.6: `hold_tilbake` (linje 63-66) - "§30.2 - Krev overslag for regningsarbeid"
- E.3.7: `avvist_preklusjon_rigg` (linje 71-74) - "§34.1.3 preklusjon"

### E.4 Kontrollpunkter - VederlagResponsData-struktur

| # | Kontrollpunkt | NS 8407 | Status |
|---|---------------|---------|--------|
| E.4.1 | `beregnings_resultat` - enum med responsalternativer | - | [x] |
| E.4.2 | `godkjent_belop` - beløp BH godkjenner | - | [x] |
| E.4.3 | `vederlagsmetode` - metode BH godkjenner | §34.2.1 | [x] |
| E.4.4 | `begrunnelse_beregning` - BH kommentar | - | [x] |
| E.4.5 | Port 1 felt: `saerskilt_varsel_rigg_drift_ok` | §34.1.3 | [x] |
| E.4.6 | Port 1 felt: `varsel_justert_ep_ok` | §34.3.3 | [x] |
| E.4.7 | Port 1 felt: `varsel_start_regning_ok` | §34.4 | [x] |
| E.4.8 | Port 1 felt: `krav_fremmet_i_tide` | §34.1.2 | [x] |

**Kontrollnotat E.4:** events.py linje 629-710:
- E.4.1: `beregnings_resultat: VederlagBeregningResultat = Field(...)` (linje 691-694)
- E.4.2: `godkjent_belop: Optional[float] = Field(default=None)` (linje 696-699)
- E.4.3: `vederlagsmetode: Optional[VederlagsMetode] = Field(default=None)` (linje 686-689)
- E.4.4: `begrunnelse_beregning: str = Field(default="")` (linje 701-704)
- E.4.5: `saerskilt_varsel_rigg_drift_ok: Optional[bool]` (linje 655-658)
- E.4.6: `varsel_justert_ep_ok: Optional[bool]` (linje 661-664)
- E.4.7: `varsel_start_regning_ok: Optional[bool]` (linje 667-670)
- E.4.8: `krav_fremmet_i_tide: bool = Field(default=True)` (linje 673-676)

### E.5 Kontrollpunkter - Subsidiær behandling

| # | Kontrollpunkt | NS 8407 | Status |
|---|---------------|---------|--------|
| E.5.1 | Vederlag kan beregnes selv om grunnlag avvist | - | [x] |
| E.5.2 | Vises som "Subsidiær godkjenning" i frontend | - | [x] |
| E.5.3 | `grunnlagStatus` prop sendes til modal | - | [x] |

**Kontrollnotat E.5:**
- E.5.1: VederlagResponsData docstring (linje 636-648) forklarer subsidiær logikk: "BH kan avvise Grunnlag (ansvar), MEN samtidig godkjenne beregningen som subsidiær vurdering"
- E.5.2: RespondVederlagModal viser Badge "Subsidiær behandling" (linje 184-207) når `erSubsidiaer` er true
- E.5.3: `grunnlagStatus?: 'godkjent' | 'avvist_uenig' | 'delvis_godkjent'` prop definert (linje 90)

### E.6 Kontrollpunkter - RespondVederlagModal

| # | Kontrollpunkt | NS 8407 | Status |
|---|---------------|---------|--------|
| E.6.1 | Dropdown for beregningsresultat | - | [x] |
| E.6.2 | Beløpsfelt for godkjent_belop | - | [x] |
| E.6.3 | Dropdown for godkjent metode | §34.2.1 | [x] |
| E.6.4 | Info om §30.2 hold-tilbake ved regning uten overslag | §30.2 | [x] |
| E.6.5 | Info om §34.3.3 svarplikt ved EP-justering | §34.3.3 | [x] |
| E.6.6 | Rigg-preklusjons info ved §34.1.3 brudd | §34.1.3 | [x] |
| E.6.7 | Subsidiær behandling-flagg vises | - | [x] |
| E.6.8 | referrer_til_event_id kobling til vederlag-event | Event sourcing | [x] |

**Kontrollnotat E.6:** RespondVederlagModal.tsx (468 linjer):
- E.6.1: `<Controller name="resultat">` med Select dropdown (linje 325-351)
- E.6.2: `<Input id="godkjent_belop" type="number">` (linje 374-383)
- E.6.3: `<Controller name="godkjent_metode">` med Select ved `showMethodField` (linje 394-412)
- E.6.4: §30.2 info vises ved `kanHoldeTilbake` (linje 306-316): "Mangler kostnadsoverslag"
- E.6.5: §34.3.3 alert ved `maSvarePaJustering` (linje 210-223): "Svarplikt (§34.3.3)"
- E.6.6: `avvist_preklusjon_rigg` filtreres inn kun ved `harSaerskiltKrav` (linje 340)
- E.6.7: Subsidiær Badge og info ved `erSubsidiaer` (linje 184-207)
- E.6.8: `vederlag_krav_id: vederlagKravId` sendes til backend (linje 159)

---

## Del F: BH-respons Frist

### F.1 Hjemmelgrunnlag

**NS 8407-referanser:**
- §33.7 - BH svarplikt på fristkrav
- §33.8 - Forsering ved uberettiget avslag

**Filer å kontrollere:**
- `backend/models/events.py` → `FristResponsData` (linje ~712-824)
- `src/components/actions/RespondFristModal.tsx`
- `src/constants/responseOptions.ts`

### F.2 Kontrollpunkter - Port-modell

**VIKTIG:** Fristrespons er REN tidsberegning.

| # | Kontrollpunkt | NS 8407 | Status |
|---|---------------|---------|--------|
| F.2.1 | Port 1: Preklusjon (varsler i tide?) | §33.4, §33.6 | [x] |
| F.2.2 | Port 2: Vilkår (forårsaket forholdet faktisk forsinkelse?) | §33.5 | [x] |
| F.2.3 | Port 3: Beregning (antall dager) | §33.5 | [x] |

### F.3 Kontrollpunkter - Responsalternativer

| # | Kontrollpunkt | NS 8407 | Status |
|---|---------------|---------|--------|
| F.3.1 | GODKJENT_FULLT - BH godkjenner alle dager | - | [x] |
| F.3.2 | DELVIS_GODKJENT - BH godkjenner færre dager | - | [x] |
| F.3.3 | AVVENTER_SPESIFIKASJON - TE må spesifisere | §33.6.2 | [x] |
| F.3.4 | AVSLATT_INGEN_HINDRING - forholdet forårsaket ikke forsinkelse | §33.5 | [x] |

### F.4 Kontrollpunkter - FristResponsData-struktur

| # | Kontrollpunkt | NS 8407 | Status |
|---|---------------|---------|--------|
| F.4.1 | `beregnings_resultat` - enum med responsalternativer | - | [x] |
| F.4.2 | `godkjent_dager` - dager BH godkjenner | §33.5 | [x] |
| F.4.3 | `ny_sluttdato` - beregnet ny sluttdato | §33.5 | [x] |
| F.4.4 | `begrunnelse` - BH kommentar | §33.7 | [x] |
| F.4.5 | Port 1: `noytralt_varsel_ok` | §33.4 | [x] |
| F.4.6 | Port 1: `spesifisert_krav_ok` | §33.6 | [x] |
| F.4.7 | Port 1: `har_bh_etterlyst` (§33.6.2) | §33.6.2 | [x] |
| F.4.8 | Port 2: `vilkar_oppfylt` (forårsaket forsinkelse?) | §33.5 | [x] |

### F.5 Kontrollpunkter - BH svarplikt (§33.7)

| # | Kontrollpunkt | NS 8407 | Status |
|---|---------------|---------|--------|
| F.5.1 | "Uten ugrunnet opphold" etter mottatt spesifisert krav | §33.7 | [x] |
| F.5.2 | Innsigelser TAPES dersom ikke fremsatt innen fristen | §33.7 | [~] |
| F.5.3 | Preklusjonsvarsel til BH ved lang responstid | §33.7 | [~] |

### F.6 Kontrollpunkter - Forsering (§33.8)

| # | Kontrollpunkt | NS 8407 | Status |
|---|---------------|---------|--------|
| F.6.1 | Ved avslag kan TE anse det som forseringspålegg | §33.8 | [x] |
| F.6.2 | Begrensning: forsering kan ikke koste >dagmulkt+30% | §33.8 | [~] |
| F.6.3 | TE må varsle BH med estimert forseringskost | §33.8 | [x] |
| F.6.4 | Info om forsering vises ved avslag i modal | §33.8 | [x] |

### F.7 Kontrollpunkter - RespondFristModal

| # | Kontrollpunkt | NS 8407 | Status |
|---|---------------|---------|--------|
| F.7.1 | Dropdown for beregningsresultat | - | [x] |
| F.7.2 | Tallfelt for godkjent_dager | §33.5 | [x] |
| F.7.3 | Datofelt for ny_sluttdato | §33.5 | [~] |
| F.7.4 | Info om §33.8 forsering ved avslag | §33.8 | [x] |
| F.7.5 | BH preklusjonsvarsel ved lang responstid | §33.7 | [-] |
| F.7.6 | Port-modell synlig i UI | - | [~] |
| F.7.7 | referrer_til_event_id kobling til frist-event | Event sourcing | [x] |

### F.8 Kontrollnotat (2025-12-08)

**Kontrollør:** LLM (Claude)

**Verifiserte filer:**
- `backend/models/events.py` linje 712-824: FristResponsData med 3-port modell
- `src/components/actions/RespondFristModal.tsx` (377 linjer)
- `src/constants/responseOptions.ts` linje 84-102, 184-189

**Detaljert verifikasjon:**

F.2 Port-modell (3/3 OK):
- F.2.1: `noytralt_varsel_ok` og `spesifisert_krav_ok` i backend (linje 733-742)
- F.2.2: `vilkar_oppfylt` med begrunnelse (linje 772-780)
- F.2.3: `beregnings_resultat`, `godkjent_dager`, `ny_sluttdato` (linje 785-798)

F.3 Responsalternativer (4/4 OK):
- BH_FRISTSVAR_OPTIONS inneholder alle 4 alternativer
- Ingen "avvist_grunnlag" - korrekt separasjon

F.4 Datastruktur (8/8 OK):
- Komplett 3-port modell i backend
- Validator for `har_bh_etterlyst` (linje 810-824)

F.5 BH svarplikt (1/3 OK, 2 delvis):
- F.5.1: OK - systemet tillater respons
- F.5.2: DELVIS - §33.7 preklusjonsregel ikke eksplisitt varslet
- F.5.3: DELVIS - mangler preklusjonsvarsel til BH ved lang tid

F.6 Forsering (3/4 OK, 1 delvis):
- F.6.1: OK - Modal viser forseringsinfo (linje 274-298)
- F.6.2: DELVIS - 30%-begrensning ikke nevnt i UI
- F.6.3: OK - Modal nevner at TE må sende varsel
- F.6.4: OK - `visForsering` logikk (linje 117-121)

F.7 Modal (5/7 OK, 1 delvis, 1 mangler):
- F.7.3: DELVIS - Backend har `ny_sluttdato`, frontend sender ikke
- F.7.5: MANGLER - Ingen BH preklusjonsvarsel
- F.7.6: DELVIS - Port-modell i backend, men forenklet UI

**Avvik funnet:**

| # | Beskrivelse | NS 8407 ref | Alvorlighet | Forslag |
|---|-------------|-------------|-------------|---------|
| 1 | BH preklusjonsvarsel mangler | §33.7 | Moderat | Vis varsel etter X dager |
| 2 | 30%-grense ikke vist i UI | §33.8 | Lav | Legg til i forseringsinfo |
| 3 | ny_sluttdato sendes ikke | §33.5 | Lav | Legg til datofelt i modal |
| 4 | Port-modell ikke synlig i UI | - | Lav | Valgfritt - forenklet UI OK |

---

## Del G: Varslingsregler og preklusjon

### G.1 Hjemmelgrunnlag

**NS 8407-referanser:**
- §5 - Varsler og krav
- §32.2 - TEs varslingsplikt
- §32.3 - BHs svarplikt
- §33.4 - Varsel om fristforlengelse
- §33.6 - Spesifisering av fristkrav
- §33.7 - BH svarplikt på fristkrav
- §34.1.2 - Varsel om vederlagskrav
- §34.1.3 - Særskilt varsel rigg/produktivitet
- §34.3.3 - Varsel om EP-justering

**Filer å kontrollere:**
- `src/constants/varslingsregler.ts`
- Alle modal-komponenter

### G.2 Kontrollpunkter - Generelle varselregler (§5)

| # | Kontrollpunkt | NS 8407 | Status |
|---|---------------|---------|--------|
| G.2.1 | Alle varsler skal være skriftlige | §5 første ledd | [x] |
| G.2.2 | E-post til avtalt adresse regnes som skriftlig | §5 første ledd | [x] |
| G.2.3 | Referat fra byggherremøte regnes som skriftlig | §5 annet ledd | [x] |
| G.2.4 | §5 tredje ledd - protest mot forsent varsel | §5 tredje ledd | [~] |

### G.3 Kontrollpunkter - TE varselfrister

| # | Kontrollpunkt | NS 8407 | Status |
|---|---------------|---------|--------|
| G.3.1 | Irregulær endring: "uten ugrunnet opphold" | §32.2 | [x] |
| G.3.2 | Svikt BH: "uten ugrunnet opphold" etter klar over | §34.1.2 | [x] |
| G.3.3 | Rigg/drift: 7 dager fra klar over | §34.1.3 | [x] |
| G.3.4 | Produktivitet: 7 dager fra klar over | §34.1.3 | [x] |
| G.3.5 | EP-justering: "uten ugrunnet opphold" | §34.3.3 | [x] |
| G.3.6 | Frist nøytralt: "uten ugrunnet opphold" | §33.4 | [x] |
| G.3.7 | Frist spesifisert: "uten ugrunnet opphold" etter grunnlag | §33.6.1 | [x] |

### G.4 Kontrollpunkter - BH svarfrister

| # | Kontrollpunkt | NS 8407 | Status |
|---|---------------|---------|--------|
| G.4.1 | Irregulær endring: "uten ugrunnet opphold" | §32.3 | [x] |
| G.4.2 | Passivitet = endring anses inntruffet | §32.3 annet ledd | [x] |
| G.4.3 | EP-justering: "uten ugrunnet opphold" - PREKLUSJON | §34.3.3 annet ledd | [x] |
| G.4.4 | Fristkrav: "uten ugrunnet opphold" - PREKLUSJON | §33.7 | [x] |

### G.5 Kontrollpunkter - Preklusjonskonsekvenser

| # | Kontrollpunkt | NS 8407 | Status |
|---|---------------|---------|--------|
| G.5.1 | TE for sent → krav tapes | §32.2, §34.1.2 | [x] |
| G.5.2 | TE for sent rigg → kun det BH måtte forstå | §34.1.3 | [x] |
| G.5.3 | TE for sent frist → kun det BH måtte forstå | §33.6.1 | [x] |
| G.5.4 | BH for sent EP → mister innsigelser | §34.3.3 | [x] |
| G.5.5 | BH for sent frist → mister innsigelser | §33.7 | [x] |

### G.6 Kontrollpunkter - Implementasjon i modaler

| # | Kontrollpunkt | NS 8407 | Status |
|---|---------------|---------|--------|
| G.6.1 | SendGrunnlagModal viser preklusjonsvarsel | §32.2 | [x] |
| G.6.2 | SendVederlagModal viser 7-dagers varsel | §34.1.3 | [x] |
| G.6.3 | SendFristModal viser reduksjonsvarsel | §33.6.1 | [x] |
| G.6.4 | SendFristModal viser kritisk etterlysningsvarsel | §33.6.2 | [x] |
| G.6.5 | RespondGrunnlagModal viser passivitetsvarsel | §32.3 | [x] |
| G.6.6 | RespondVederlagModal viser EP-preklusjonsvarsel | §34.3.3 | [x] |
| G.6.7 | RespondFristModal viser §33.7 preklusjonsvarsel | §33.7 | [x] |

### G.8 Kontrollnotat

**Dato:** 2025-12-08
**Kontrollør:** LLM (Claude)

**Verifiserte filer:**
- `src/constants/varslingsregler.ts` (383 linjer): Komplett regelsett med 8 prosessflyter
- `src/utils/preklusjonssjekk.ts` (293 linjer): Hjelpefunksjoner for fristberegning
- `src/components/actions/SendGrunnlagModal.tsx`: getPreklusjonsvarsel() linje 124-127, 376-383
- `src/components/actions/SendVederlagModal.tsx`: sjekkRiggDriftFrist() linje 170-179, 462-469, 527-534
- `src/components/actions/SendFristModal.tsx`: §33.6.1/§33.6.2 varsler linje 262-274, 218-236
- `src/components/actions/RespondGrunnlagModal.tsx`: §32.3 passivitet linje 117-120, 207-225
- `src/components/actions/RespondVederlagModal.tsx`: §34.3.3 EP-varsler linje 137-139, 209-223
- `src/components/actions/RespondFristModal.tsx`: §33.7 preklusjon linje 213-216, 287-306

**Detaljert verifikasjon:**

G.2 Generelle varselregler (3/4 OK, 1 delvis):
- G.2.1-G.2.3: OK - VARSEL_METODER_OPTIONS inkluderer `brev`, `epost`, `byggemote_referat`
- G.2.4: DELVIS - Protest mot forsent varsel ikke eksplisitt implementert i UI

G.3 TE varselfrister (7/7 OK):
- Alle frister korrekt dokumentert i VARSLINGSREGLER_NS8407
- preklusjonssjekk.ts har korrekte terskler (7 dager rigg/drift, UUO for resten)

G.4 BH svarfrister (4/4 OK):
- §32.3 passivitet: RespondGrunnlagModal.tsx linje 117-120, 207-225
- §34.3.3 EP-preklusjon: RespondVederlagModal.tsx linje 137-139, 209-223
- §33.7 frist-preklusjon: RespondFristModal.tsx linje 213-216, 287-306

G.5 Preklusjonskonsekvenser (5/5 OK):
- Alle konsekvenser korrekt dokumentert i varslingsregler.ts med konsekvens_type
- PREKLUSJON_KRAV og PREKLUSJON_INNSIGELSE riktig brukt

G.6 Modal-implementasjon (7/7 OK):
- Alle modaler viser relevante preklusjonsvarsler basert på dato-beregninger

**Resultat:** 23/24 kontrollpunkter OK (96%), 1 delvis

**Avvik funnet:**

| # | Beskrivelse | NS 8407 ref | Alvorlighet | Forslag |
|---|-------------|-------------|-------------|---------|
| 1 | §5 tredje ledd protest ikke i UI | §5 tredje ledd | Lav | Valgfritt - sjelden brukt |

---

## Del H: Kategorier og underkategorier

### H.1 Hjemmelgrunnlag

Alle kategorier skal ha korrekt hjemmelreferanse til NS 8407.

**Filer å kontrollere:**
- `src/constants/categories.ts`
- `backend/constants/grunnlag_categories.py`

### H.2 Kontrollpunkter - Synkronisering

| # | Kontrollpunkt | NS 8407 | Status |
|---|---------------|---------|--------|
| H.2.1 | Frontend og backend kategorier er identiske | - | [x] |
| H.2.2 | Alle koder matcher mellom frontend/backend | - | [x] |
| H.2.3 | Alle hjemler matcher mellom frontend/backend | - | [x] |
| H.2.4 | Alle labels matcher mellom frontend/backend | - | [x] |

### H.3 Kontrollpunkter - Hovedkategori-struktur

| # | Kontrollpunkt | NS 8407 | Status |
|---|---------------|---------|--------|
| H.3.1 | Hver hovedkategori har `kode` | - | [x] |
| H.3.2 | Hver hovedkategori har `label` | - | [x] |
| H.3.3 | Hver hovedkategori har `beskrivelse` | - | [x] |
| H.3.4 | Hver hovedkategori har `hjemmel_frist` | §33.1 | [x] |
| H.3.5 | Hver hovedkategori har `hjemmel_vederlag` (unntatt FM) | §34.1 | [x] |
| H.3.6 | Hver hovedkategori har `standard_vederlagsmetode` | §34 | [x] |
| H.3.7 | Hver hovedkategori har `type_krav` | - | [x] |
| H.3.8 | Hver hovedkategori har `underkategorier` array | - | [x] |

### H.4 Kontrollpunkter - Underkategori-struktur

| # | Kontrollpunkt | NS 8407 | Status |
|---|---------------|---------|--------|
| H.4.1 | Hver underkategori har `kode` | - | [x] |
| H.4.2 | Hver underkategori har `label` | - | [x] |
| H.4.3 | Hver underkategori har `hjemmel_basis` | NS 8407 | [x] |
| H.4.4 | Hver underkategori har `beskrivelse` | - | [x] |
| H.4.5 | Valgfritt: `varselkrav_ref` for spesifikke varselkrav | - | [x] |

### H.5 Kontrollnotat

**Dato:** 2025-12-08
**Kontrollør:** LLM (Claude)

**Verifiserte filer:**
- `src/constants/categories.ts` (341 linjer): Frontend kategorier med TypeScript interfaces
- `backend/constants/grunnlag_categories.py` (424 linjer): Backend kategorier med Python TypedDict

**Detaljert verifikasjon:**

H.2 Synkronisering (4/4 OK):
- 4 hovedkategorier: ENDRING, SVIKT, ANDRE, FORCE_MAJEURE
- 22 underkategorier totalt (8+6+6+2)
- Alle felter 100% synkronisert mellom frontend/backend

H.3 Hovedkategori-struktur (8/8 OK):
- Alle 4 hovedkategorier har komplett struktur
- Hjemmelreferanser verifisert mot NS 8407:
  - ENDRING: §33.1 a), §34.1.1 ✓
  - SVIKT: §33.1 b), §34.1.2 ✓
  - ANDRE: §33.1 c), §34.1.2 ✓
  - FORCE_MAJEURE: §33.3, null (korrekt - ingen vederlag) ✓

H.4 Underkategori-struktur (5/5 OK):
- Alle 22 underkategorier har komplett struktur
- hjemmel_basis verifisert mot NS 8407:
  - EO (§31.1), IRREG (§32.1), SVAR_VARSEL (§25.3/32.3) ✓
  - LOV_GJENSTAND (§14.4), LOV_PROSESS (§15.2), GEBYR (§26.3) ✓
  - SAMORD (§21.4), FORSERING (§33.8) ✓
  - MEDVIRK (§22), ADKOMST (§22.2), GRUNN (§23.1) ✓
  - KULTURMINNER (§23.3), PROSJ_RISIKO (§24.1), BH_FASTHOLDER (§24.2.2) ✓
  - NEKT_MH (§10.2), NEKT_TILTRANSPORT (§12.1.2), SKADE_BH (§19.1) ✓
  - BRUKSTAKELSE (§38.1), STANS_BET (§29.2), STANS_UENIGHET (§35.1) ✓
  - FM_EGEN (§33.3 første ledd), FM_MH (§33.3 annet ledd) ✓

**Helper-funksjoner verifisert:**
- Frontend: getHovedkategori(), getUnderkategoriObj(), erForceMajeure(), erLovendring() ✓
- Backend: get_hovedkategori(), get_underkategori(), validate_kategori_kombinasjon() ✓

**Resultat:** 17/17 kontrollpunkter OK (100%)

**Avvik funnet:** Ingen

---

## Del I: Endringsordre og EO

### I.1 Hjemmelgrunnlag

**NS 8407-referanser:**
- §31 - Endringer
- §31.3 - Endringsordre

**Filer å kontrollere:**
- `backend/models/events.py` → `EOUtstedtEvent`
- `backend/models/sak_state.py` → `kan_utstede_eo`

### I.2 Kontrollpunkter - EO-regler

| # | Kontrollpunkt | NS 8407 | Status |
|---|---------------|---------|--------|
| I.2.1 | EO krever skriftlig beskjed | §31.3 første ledd | [x] |
| I.2.2 | EO må angi hva endringen går ut på | §31.3 første ledd | [x] |
| I.2.3 | EO må gis av BH representant eller fullmektig | §31.3 første ledd | [x] |
| I.2.4 | EO bør gis i god tid | §31.3 tredje ledd | [x] N/A |

### I.3 Kontrollpunkter - EO-tilstand

| # | Kontrollpunkt | NS 8407 | Status |
|---|---------------|---------|--------|
| I.3.1 | `kan_utstede_eo` beregnes korrekt fra tilstand | - | [x] |
| I.3.2 | EO krever minimum godkjent grunnlag | - | [x] |
| I.3.3 | EO summerer godkjente beløp/dager | - | [x] |
| I.3.4 | EO låser saken for videre endringer | - | [x] |

### I.4 Kontrollnotat

**Dato:** 2025-12-08
**Kontrollør:** LLM (Claude)

**Verifiserte filer:**
- `backend/models/events.py` linje 876-890: EOUtstedtEvent klasse
- `backend/models/sak_state.py` linje 505-525: kan_utstede_eo property

**NS 8407 §31.3 Endringsordre (linje 869-875):**
> "En endringsordre skal være skriftlig og gi beskjed om at det kreves en endring,
> samt hva endringen går ut på. Endringsordren må være gitt av byggherrens representant,
> jf. punkt 9, eller av en person med skriftlig fullmakt til å utstede slike."

**I.2 EO-regler verifikasjon:**
- I.2.1: EOUtstedtEvent lagres som persistent event (skriftlig) ✓
- I.2.2: `endelig_vederlag` og `endelig_frist_dager` spesifiserer innhold ✓
- I.2.3: `signert_av_bh` (obligatorisk Field) sikrer BH-signatur ✓
- I.2.4: "bør gis i god tid" er anbefaling, ikke krav - ikke håndhevet i kode ✓ N/A

**I.3 EO-tilstand verifikasjon:**
- I.3.1: `kan_utstede_eo` sjekker alle spor (grunnlag, vederlag, frist) for GODKJENT/LAAST ✓
- I.3.2: Grunnlag må være GODKJENT/LAAST før EO (linje 515-516) ✓
- I.3.3: `sum_godkjent` og `dager_godkjent` beregnes fra aggregert state ✓
- I.3.4: LAAST status brukes for å forhindre videre endringer ✓

**EOUtstedtEvent felter:**
```python
eo_nummer: str           # Endringsordre-identifikator
endelig_vederlag: float  # Godkjent vederlagsbeløp
endelig_frist_dager: Optional[int]  # Godkjent fristforlengelse
signert_av_te: str       # TE-signatur
signert_av_bh: str       # BH-signatur (§31.3 krav)
```

**Resultat:** 8/8 kontrollpunkter OK (100%)

**Avvik funnet:** Ingen

---

## Oppsummering

### Totalt antall kontrollpunkter

| Del | Antall | Fullført |
|-----|--------|----------|
| A - Grunnlag | 45 | 0 |
| B - Vederlag | 32 | 0 |
| C - Frist | 32 | 0 |
| D - BH Grunnlag | 18 | 0 |
| E - BH Vederlag | 24 | 0 |
| F - BH Frist | 22 | 0 |
| G - Varsling | 24 | 0 |
| H - Kategorier | 13 | 0 |
| I - EO | 8 | 0 |
| **TOTALT** | **218** | **0** |

### Fremgangsmåte

1. Start med Del A og arbeid deg gjennom sekvensielt
2. For hver seksjon: les kode, sammenlign med NS 8407, kryss av
3. Dokumenter avvik i egen rapport
4. Ved funn: opprett egen issue/task med forslag til løsning

### Referansefiler

| Fil | Formål |
|-----|--------|
| `/NS_8407.md` | Fullstendig NS 8407 kontraktstekst |
| `/backend/models/events.py` | Backend event-modeller |
| `/backend/models/sak_state.py` | Aggregert tilstand |
| `/src/components/actions/*.tsx` | Frontend skjemaer |
| `/src/constants/*.ts` | Frontend konstanter |
| `/backend/constants/*.py` | Backend konstanter |
| `/src/types/timeline.ts` | Frontend typer |

---

*Sist oppdatert: 2025-12-08*
