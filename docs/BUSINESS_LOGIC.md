# Forretningslogikk — KOE-plattformen

**Domenebeskrivelse for grensesnittdesign**

---

## Hva systemet er

En digital samhandlingsplattform for håndtering av **endringsordrer** (KOE — Krav om Endring) i byggeprosjekter. Regulert av NS 8407:2011, den norske totalentreprisekontrakten.

Plattformen er nøytral — den hjelper begge parter å navigere kontraktens prosessregler uten å ta parti.

---

## Aktørene

To parter forhandler om endringer i et byggeprosjekt:

| Aktør | Rolle | Perspektiv |
|-------|-------|------------|
| **TE** (Totalentreprenør) | Sender krav — hevder at noe har endret seg og krever kompensasjon og/eller tid | Offensiv |
| **BH** (Byggherre) | Responderer på krav — vurderer om kravet er berettiget og hva som eventuelt innvilges | Defensiv |

De ser den samme saken, men har ulike handlinger tilgjengelig. TE bygger et krav, BH evaluerer det.

---

## Tre-spor-modellen

Hver KOE-sak består av tre uavhengige spor som behandles parallelt. Dette er kjernen i hele domenet.

| Spor | Spørsmål | Hjemmel | Aktør som sender | Aktør som svarer |
|------|----------|---------|------------------|------------------|
| **Grunnlag** | Har TE krav på endring? | §25.2 / §32 | TE | BH |
| **Vederlag** | Hva koster endringen? | §34 | TE | BH |
| **Frist** | Hvor lang tid trengs ekstra? | §33 | TE | BH |

Sporene er uavhengige — hvert har sin egen status og livssyklus — men de har logiske avhengigheter: avslag på grunnlag gjør vederlag og frist subsidiære (se «Subsidiær logikk»).

---

## Spor 1: Grunnlag — «Har TE rett til endring?»

### Kategorihierarkiet

TE må velge en juridisk hjemmel for kravet. Valget styrer hele sakens karakter.

**4 hovedkategorier:**

| Kode | Navn | Betydning | Kan kreve |
|------|------|-----------|-----------|
| **ENDRING** | Endringer | BH har endret noe i kontrakten | Tid + Penger |
| **SVIKT** | Svikt ved BH's ytelser | BH har sviktet sine plikter | Tid + Penger |
| **ANDRE** | Andre forhold BH har risikoen for | Sekkepost for BH-risiko | Tid + Penger |
| **FORCE_MAJEURE** | Force Majeure | Utenfor begge parters kontroll | Kun tid |

FORCE_MAJEURE deaktiverer vederlagssporet helt — bare frist er relevant.

**Underkategorier per hovedkategori:**

#### ENDRING (8 underkategorier)

| Kode | Navn | Hjemmel | Gruppe |
|------|------|---------|--------|
| EO | Formell endringsordre | §31.3 | Endringsordrer |
| IRREG | Irregulær endring (Pålegg) | §32.1 | Endringsordrer |
| VALGRETT | Begrensning av valgrett | §14.6 | Endringsordrer |
| SVAR_VARSEL | Endring via svar på varsel | §24.2.2 | Endringsordrer |
| LOV_GJENSTAND | Lovendring (gjenstand) | §14.4 | Lov og forskrift |
| LOV_PROSESS | Lovendring (prosess) | §15.2 | Lov og forskrift |
| GEBYR | Endring i gebyrer/avgifter | §26.3 | Lov og forskrift |
| SAMORD | Samordning/omlegging | §21.4 | Koordinering |

#### SVIKT (4 underkategorier)

| Kode | Navn | Hjemmel | Gruppe |
|------|------|---------|--------|
| MEDVIRK | Manglende medvirkning/leveranser | §22 | Medvirkning |
| GRUNN | Uforutsette grunnforhold | §23.1 | Grunnforhold |
| KULTURMINNER | Funn av kulturminner | §23.3 | Grunnforhold |
| PROSJ_RISIKO | Svikt i BH's prosjektering | §24.1 | Prosjektering |

#### ANDRE (5 underkategorier)

| Kode | Navn | Hjemmel | Gruppe |
|------|------|---------|--------|
| NEKT_MH | Nektelse av kontraktsmedhjelper | §10.2 | Kontraktsmedhjelpere |
| SKADE_BH | Skade forårsaket av BH | §19.1 | Kontraktsbrudd |
| BRUKSTAKELSE | Urettmessig brukstakelse | §38.1 | Kontraktsbrudd |
| STANS_BET | Stans ved betalingsmislighold | §29.2 | Stans |
| ANDRE_ANDRE | Annet forhold | §33.1 c) | Annet |

#### FORCE_MAJEURE

Ingen underkategorier. Dekker værforhold, offentlige påbud, streik, lockout.

### TE's grunnlagsinnsending

TE leverer:

| Felt | Beskrivelse |
|------|-------------|
| `hovedkategori` | En av de fire hovedkategoriene |
| `underkategori` | En eller flere underkategorier |
| `tittel` | Kort beskrivende tittel |
| `beskrivelse` | Fritekst om hva som har endret seg |
| `dato_oppdaget` | Dato TE oppdaget forholdet |
| `grunnlag_varsel` | Varslingsinformasjon (dato sendt, metode) |

### BH's grunnlagsrespons

BH evaluerer og gir ett av tre utfall:

| Resultat | Betydning |
|----------|-----------|
| `godkjent` | TE har rett til endring |
| `avslatt` | TE har ikke rett til endring |
| `frafalt` | BH trekker tilbake pålegget (kun IRREG/VALGRETT) |

BH leverer også:

| Felt | Beskrivelse |
|------|-------------|
| `begrunnelse` | Fritekstbegrunnelse |
| `grunnlag_varslet_i_tide` | BH's vurdering av om TE varslet i tide (§32.2, kun ENDRING) |

### Spesialregler i grunnlag

**Preklusjon (§32.2):** Gjelder kun ENDRING. Hvis TE ikke varslet i tide, kan BH hevde at kravet er prekludert. Konsekvens: hele vederlag og frist blir subsidiært.

**Passivitet (§32.3):** Gjelder kun IRREG og VALGRETT. Hvis TE varslet for >10 dager siden og BH ikke har svart, mister BH retten til å protestere. Beregnet felt: `dagerSidenVarsel`.

**Frafalt (§32.3 c):** Kun for IRREG og VALGRETT. BH kan trekke tilbake/oppheve sitt eget pålegg.

---

## Spor 2: Vederlag — «Hva koster det?»

### TE's vederlagskrav

TE velger beregningsmetode og oppgir beløp:

| Felt | Beskrivelse | Avhenger av |
|------|-------------|-------------|
| `metode` | Beregningsmetode (se under) | — |
| `belop_direkte` | Beløp | Kun ENHETSPRISER / FASTPRIS_TILBUD |
| `kostnads_overslag` | Kostnadsoverslag (§30.2) | Kun REGNINGSARBEID |
| `fradrag_belop` | Fradrag for besparelser (§34.4) | Alle metoder |
| `er_estimat` | Om beløpet er et estimat | Alle metoder |
| `krever_justert_ep` | Krever justerte enhetspriser | Kun ENHETSPRISER |
| `varslet_for_oppstart` | Varslet BH før oppstart? | Kun REGNINGSARBEID |
| `saerskilt_krav.rigg_drift` | Rigg/drift-kostnader | Valgfritt tillegg |
| `saerskilt_krav.produktivitet` | Produktivitetstap | Valgfritt tillegg |
| `begrunnelse` | Begrunnelse (≥10 tegn) | — |

**Tre beregningsmetoder:**

| Metode | Kode | Typisk for | Beskrivelse |
|--------|------|-----------|-------------|
| Enhetspriser | `ENHETSPRISER` | ENDRING | Kontraktspriser × mengde |
| Regningsarbeid | `REGNINGSARBEID` | SVIKT, ANDRE | Faktiske kostnader + påslag (§30) |
| Fastpris/tilbud | `FASTPRIS_TILBUD` | Alle | Avtalt fast beløp (§34.2.1) |

**Særskilte krav (§34.1.3):** TE kan legge til rigg/drift-kostnader og/eller produktivitetstap som egne poster. Hver har eget beløp og dato for når TE ble klar over kostnadene.

### BH's vederlagsrespons — 3 porter

BH evaluerer sekvensielt. Avslag i en port gjør etterfølgende poster subsidiære — men de evalueres likevel.

#### Port 1: Preklusjon — varslet BH i tide?

| Vurdering | Gjelder når | Konsekvens hvis nei |
|-----------|-------------|---------------------|
| `hovedkravVarsletITide` | Kun SVIKT/ANDRE | Hovedkravet prekluderes |
| `riggVarsletITide` | Rigg-krav finnes | Rigg-kravet prekluderes |
| `produktivitetVarsletITide` | Produktivitetskrav finnes | Produktivitetskravet prekluderes |

Prekluderte poster fjernes fra prinsipal vurdering men evalueres subsidiært.

Tillegg: Hvis hele grunnlaget er prekludert via §32.2 (ENDRING, ikke varslet i tide), blir *hele* vederlagssporet subsidiært.

#### Port 2: Metode — aksepteres beregningsmetoden?

| Felt | Beskrivelse |
|------|-------------|
| `akseptererMetode` | Godtar BH den valgte metoden? |
| `oensketMetode` | Hvis nei — hvilken metode foreslår BH? |
| `epJusteringAkseptert` | Aksepterer BH EP-justeringsvarsel? (§34.3.3, kun ENHETSPRISER) |
| `holdTilbake` | §30.2: BH holder tilbake betaling (kun REGNINGSARBEID uten kostnadsoverslag) |

**§30.2 Hold-tilbake:** Hvis TE bruker regningsarbeid men ikke ga kostnadsoverslag, kan BH holde tilbake betaling for arbeid som ikke dekkes av estimatet.

#### Port 3: Beløp — hva innvilges?

BH evaluerer hvert delkrav individuelt:

| Delkrav | Vurdering | Godkjent beløp |
|---------|-----------|----------------|
| Hovedkrav | `godkjent` / `delvis` / `avslatt` | `hovedkravGodkjentBelop` |
| Rigg/drift | `godkjent` / `delvis` / `avslatt` | `riggGodkjentBelop` |
| Produktivitet | `godkjent` / `delvis` / `avslatt` | `produktivitetGodkjentBelop` |

### Vederlag-resultater

Beregnes automatisk fra portene:

| Resultat | Betingelse |
|----------|------------|
| `godkjent` | ≥99% av krevd beløp innvilget, ingen metodeendring |
| `delvis_godkjent` | >0% men <99% innvilget |
| `avslatt` | 0% innvilget |
| `hold_tilbake` | BH holder tilbake (§30.2) |

Avledede verdier: `totalKrevd`, `totalGodkjent`, `differanse`, `godkjenningsgradProsent`.

---

## Spor 3: Frist — «Hvor lang tid trengs?»

### TE's fristkrav — trinnvis prosess

Frist har en sekvensiell flyt som skiller seg fra vederlag:

```
Steg 1: TE sender VARSEL (foreløpig melding)
         ↓
Steg 2: BH kan sende FORESPØRSEL (ber om detaljer)
         ↓
Steg 3: TE svarer med SPESIFISERT krav eller BEGRUNNELSE_UTSATT
```

**Tre varseltyper:**

| Type | Betydning | Krav til TE |
|------|-----------|-------------|
| `varsel` | «Vi kan bli forsinket» | Bare varsling, ingen antall dager |
| `spesifisert` | «Vi trenger X dager» | antallDager > 0, begrunnelse ≥ 10 tegn |
| `begrunnelse_utsatt` | «Vi kan ikke beregne enda» | Begrunnelse ≥ 10 tegn |

**Scenarier for innsending:**

| Scenario | Trigger | Tilgjengelige varseltyper |
|----------|---------|--------------------------|
| `new` | TE starter nytt krav | `varsel` eller `spesifisert` |
| `spesifisering` | TE spesifiserer etter tidligere varsel | `spesifisert` (låst) |
| `foresporsel` | TE svarer på BH's etterlysning | `spesifisert` eller `begrunnelse_utsatt` |
| `edit` | TE oppdaterer eksisterende krav | Beholder opprinnelig type |

**Felter TE leverer:**

| Felt | Beskrivelse | Betingelse |
|------|-------------|------------|
| `varselType` | En av de tre typene | Alltid |
| `tidligereVarslet` | Har TE sendt varsel tidligere? | Kun `new` |
| `varselDato` | Dato for tidligere varsel | Hvis `tidligereVarslet` |
| `antallDager` | Antall dager krevd | Kun `spesifisert`, >0 |
| `nySluttdato` | Justert sluttdato | Valgfritt |
| `begrunnelse` | Begrunnelse | ≥10 tegn (unntatt `varsel`) |

**Preklusjonsadvarsel:** Beregnes fra `dato_oppdaget`. >7 dager = advarsel. >14 dager = fare. TE har begrenset tid til å varsle.

### BH's fristrespons — 3 porter

#### Port 1: Varsling — sendt i tide?

| Vurdering | Beskrivelse | Vises når |
|-----------|-------------|-----------|
| `fristVarselOk` | §33.4 nøytralt varsel sendt i tide? | Varsel eller spesifisert krav finnes |
| `spesifisertKravOk` | §33.6 spesifisert krav sendt i tide? | Spesifisert krav finnes |
| `foresporselSvarOk` | §33.6.2 svar på forespørsel sendt i tide? | BH har sendt forespørsel |

**Reduksjonsregel (§33.6):** Hvis TE sendte varsel i tide men spesifiseringen kom for sent, reduseres kravet (men prekluderes ikke helt) — BH innvilger «det BH måtte forstå».

#### Port 2: Vilkår — reell forsinkelse?

| Felt | Beskrivelse |
|------|-------------|
| `vilkarOppfylt` | §33.1 — førte forholdet faktisk til forsinkelse? |

Hvis nei → prinsipal avslag, men subsidiær evaluering: «Hadde det vært reell forsinkelse, ville vi innvilget X dager.»

#### Port 3: Utmåling — hvor mange dager?

| Felt | Beskrivelse |
|------|-------------|
| `godkjentDager` | Antall dager BH innvilger |
| `nySluttdato` | Justert sluttdato |

### Frist-resultater

| Resultat | Betingelse |
|----------|------------|
| `godkjent` | ≥99% av krevde dager innvilget |
| `delvis_godkjent` | >0% men <99% innvilget |
| `avslatt` | 0 dager innvilget |

Avledede verdier: `krevdDager`, `godkjentDager`, `differanseDager`.

### BH's forespørsel

BH kan på ethvert tidspunkt sende en forespørsel til TE om å spesifisere fristkravet. Dette setter en frist (`frist_for_spesifisering`) som TE må svare innen.

---

## Subsidiær logikk

Subsidiær betyr: «Vi avslår primært, men *dersom* vi tar feil, ville vi innvilget dette.» Det er et reelt forhandlingsgrep brukt aktivt i tvisteløsning — ikke bare en hypotetisk øvelse.

### Når trigges subsidiær evaluering?

| Trigger | Kode | Forklaring | Påvirker |
|---------|------|------------|----------|
| Grunnlag avslått | `grunnlag_avslatt` | BH sier TE ikke har rett, men evaluerer likevel | Vederlag + Frist |
| §32.2 preklusjon | `grunnlag_prekludert_32_2` | ENDRING ikke varslet i tide | Hele vederlag + frist |
| §34.1.2 hovedkrav | `preklusjon_hovedkrav` | SVIKT/ANDRE-kostnader ikke varslet i tide | Hovedkrav i vederlag |
| §34.1.3 rigg | `preklusjon_rigg` | Rigg-krav ikke varslet i tide | Rigg-post i vederlag |
| §34.1.3 produktivitet | `preklusjon_produktivitet` | Produktivitetskrav ikke varslet i tide | Produktivitetspost i vederlag |
| §34.3.3 EP-justering | `reduksjon_ep_justering` | EP-justeringsvarsel for sent | Reduksjon i vederlag |
| Vilkår ikke oppfylt | `ingen_hindring` | Ingen reell forsinkelse (§33.1) | Frist |
| Varsel for sent | `preklusjon_varsel` | §33.4/§33.6 varsel sendt for sent | Frist |
| Spesifisering for sent | `reduksjon_spesifisert` | §33.6 spesifisering for sent (reduksjon, ikke full preklusjon) | Frist |

### Beregningsregel

Prekluderte poster fjernes fra prinsipalt resultat, men inkluderes i subsidiært resultat:

- **Prinsipalt:** `totalGodkjent` — kun ikke-prekluderte poster
- **Subsidiært:** `totalGodkjentInklPrekludert` — alle poster evaluert på sine meritter

Hvert spor har egne subsidiære felter: `subsidiaer_resultat`, `subsidiaer_godkjent_belop`/`subsidiaer_godkjent_dager`, `subsidiaer_begrunnelse`, og `subsidiaer_triggers` (liste over årsaker).

---

## Sakstyper

### Standard (default)

Vanlig KOE-sak. Tre spor: Grunnlag + Vederlag + Frist.

### Forsering (§33.8)

Oppstår når BH avslår TE's fristkrav og TE mener avslaget er uberettiget. TE akselererer arbeidet og krever kostnadene dekket.

**Forutsetninger:**
- BH har avslått fristkrav (helt eller delvis)
- TE mener avslaget er uberettiget

**Kostnadsbegrensning:**
```
Maks forseringskostnad = avslåtte dager × dagmulktssats × 1,3
```

**Data:**

| Felt | Beskrivelse |
|------|-------------|
| `avslatte_fristkrav` | Referanser til avslåtte fristsaker |
| `dato_varslet` | Dato forsering ble varslet |
| `estimert_kostnad` | TE's kostnadsestimat |
| `bekreft_30_prosent_regel` | TE bekrefter at kostnad < grense |
| `avslatte_dager` | Sum avslåtte dager |
| `dagmulktsats` | Dagmulktssats (NOK) |
| `maks_forseringskostnad` | Beregnet grense |
| `er_iverksatt` / `er_stoppet` | Livssyklusstatus |
| `paalopte_kostnader` | Faktisk påløpte kostnader |

**BH's respons på forsering:**

| Felt | Beskrivelse |
|------|-------------|
| `vurdering_per_sak` | Vurdering av hvert avslått fristkrav |
| `dager_med_forseringsrett` | Dager BH anerkjenner forseringsrett for |
| `trettiprosent_overholdt` | Er 30%-regelen overholdt? |
| `aksepterer` | Godtar BH forseringskravet? |
| `godkjent_belop` | Innvilget beløp |
| `begrunnelse` | Begrunnelse |

### Endringsordre (§31.3)

BH-initiert formell endring. Samler en eller flere KOE-saker under én endringsordre.

**Data:**

| Felt | Beskrivelse |
|------|-------------|
| `relaterte_koe_saker` | Referanser til inkluderte KOE-saker |
| `eo_nummer` | EO-identifikator |
| `revisjon_nummer` | Versjonsnummer |
| `beskrivelse` | Endringsbeskrivelse |
| `konsekvenser` | Flagg: SHA / kvalitet / fremdrift / pris / annet |
| `oppgjorsform` | Beregningsmetode |
| `kompensasjon_belop` | Kompensasjonsbeløp |
| `fradrag_belop` | Fradrag (§34.4) |
| `netto_belop` | Beregnet: kompensasjon - fradrag |
| `frist_dager` | Fristforlengelse i dager |
| `ny_sluttdato` | Justert sluttdato |
| `status` | `utkast` → `utstedt` → `akseptert` / `bestridt` / `revidert` |

**TE's svar på endringsordre:**
- **Akseptert:** TE godtar
- **Bestridt:** TE er uenig, kan sende alternativt KOE-krav

---

## Statusmodellen

### Sporstatus (per spor)

```
ikke_relevant → utkast → sendt → under_behandling → godkjent
                                                    → delvis_godkjent
                                                    → avslatt
                                                    → under_forhandling
```

### Overordnet saksstatus

```
UTKAST → SENDT → VENTER_PAA_SVAR → UNDER_BEHANDLING → UNDER_FORHANDLING → OMFORENT
                                                                          → LUKKET
                                                                          → LUKKET_TRUKKET
```

### Neste handling

Systemet beregner alltid hvem som har neste trekk:

| Felt | Beskrivelse |
|------|-------------|
| `rolle` | `TE` / `BH` / `null` |
| `handling` | Beskrivelse av neste steg |
| `spor` | Hvilket spor handlingen gjelder |

---

## Versjonering

Begge parter kan revidere sine innlegg. Versjonsnummer øker ved hver oppdatering.

| Begrep | Beskrivelse |
|--------|-------------|
| `antall_versjoner` | Totalt antall versjoner sendt |
| `versjon` | 1-indeksert versjonsnummer |
| `revisjon` | UI-label = versjon - 1 (original har ingen revisjon, første oppdatering er «Rev. 1») |
| `bh_respondert_versjon` | 0-indeksert — hvilken TE-versjon BH har svart på |

Hvis TE oppdaterer etter at BH har svart, gjelder BH's svar fortsatt den gamle versjonen inntil BH sender ny respons.

**Snuoperasjon:** Hvis BH endrer fra `avslatt` til `godkjent`, er det en posisjonell reversering som krever oppdatert begrunnelse.

---

## Aksept og lukking

Etter BH har svart på et spor, har TE tre valg:

| Handling | Resultat |
|----------|----------|
| Akseptere respons | Sporet lukkes, enighet registrert |
| Revidere krav | TE sender ny versjon |
| Trekke krav | Sporet lukkes, kravet bortfaller |

---

## Hendelsestyper (Event Sourcing)

Alle mutasjoner skjer gjennom uforanderlige hendelser. State beregnes ved å spille av hendelsesloggen.

### Saksopprettelse

- `sak_opprettet`

### Grunnlag

- `grunnlag_opprettet` — TE sender krav
- `grunnlag_oppdatert` — TE reviderer
- `grunnlag_trukket` — TE trekker kravet
- `respons_grunnlag` — BH svarer
- `respons_grunnlag_oppdatert` — BH reviderer svar

### Vederlag

- `vederlag_krav_sendt` — TE sender krav
- `vederlag_krav_oppdatert` — TE reviderer
- `vederlag_krav_trukket` — TE trekker kravet
- `respons_vederlag` — BH svarer
- `respons_vederlag_oppdatert` — BH reviderer svar

### Frist

- `frist_krav_sendt` — TE sender varsel eller krav
- `frist_krav_oppdatert` — TE reviderer
- `frist_krav_spesifisert` — TE spesifiserer dager etter varsel
- `frist_krav_trukket` — TE trekker kravet
- `respons_frist` — BH svarer
- `respons_frist_oppdatert` — BH reviderer svar

### Forsering

- `forsering_varsel` — TE varsler forsering med kostnadsestimat
- `forsering_respons` — BH evaluerer forseringskravet
- `forsering_stoppet` — TE stopper forsering
- `forsering_kostnader_oppdatert` — TE oppdaterer påløpte kostnader

### Endringsordre

- `eo_opprettet` — BH oppretter EO-sak
- `eo_koe_lagt_til` — KOE legges til EO
- `eo_koe_fjernet` — KOE fjernes fra EO
- `eo_utstedt` — BH utsteder formelt
- `eo_akseptert` — TE aksepterer
- `eo_bestridt` — TE bestrider
- `eo_revidert` — BH reviderer

### Aksept

- `te_aksepterer_respons` — TE bekrefter enighet på et spor

---

## Dynamisk skjemalogikk

Skjemaene er dynamiske — synlighet og obligatoriske felter endrer seg basert på kontekst.

### Hva styrer synlighet

| Kontekst | Påvirker |
|----------|----------|
| Valgt hovedkategori | Om vederlag-sporet er aktivt (FORCE_MAJEURE → nei) |
| Valgt underkategori | Om frafalt-handling er tilgjengelig (kun IRREG/VALGRETT) |
| Valgt beregningsmetode | Hvilke beløpsfelt som vises |
| Varseltype (frist) | Om antallDager-felt vises |
| Scenario (frist) | Hvilke varseltyper som er tilgjengelige |
| Preklusion-svar | Om subsidiær-seksjon vises |
| Eksistens av særskilte krav | Om rigg/produktivitet-vurdering vises for BH |

### Dynamisk begrunnelsestekst

Begrunnelsesfeltets veiledningstekst endrer seg basert på valgt resultat, varseltype og kontekst. For eksempel guider den BH til å forklare avslaget annerledes enn en godkjenning.

---

## Aggregerte verdier

Systemet beregner disse verdiene per sak:

| Felt | Beskrivelse |
|------|-------------|
| `sum_krevd` | Total krevd kompensasjon (alle spor) |
| `sum_godkjent` | Total godkjent kompensasjon |
| `er_subsidiaert_vederlag` | Om vederlag har subsidiær evaluering |
| `er_subsidiaert_frist` | Om frist har subsidiær evaluering |
| `kan_utstede_eo` | Om BH kan utstede formell endringsordre |
| `overordnet_status` | Aggregert status fra alle spor |

---

## Prosjektstruktur

Plattformen støtter flere prosjekter med rollebasert tilgangsstyring:

| Rolle | Tilgang |
|-------|---------|
| `admin` | Full tilgang, kan administrere medlemmer |
| `member` | Kan lese og skrive |
| `viewer` | Kun lesetilgang |

Medlemskap er email-basert. Hver bruker har en domenerolle (TE eller BH) som bestemmer hvilke handlinger som er tilgjengelige.
