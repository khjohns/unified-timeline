# Fristsporet (§33) - Scenarioanalyse

**Formål:** Kartlegge alle mulige hendelsesforløp for fristforlengelse og identifisere uavklarte situasjoner.

*Opprettet: 2026-01-24*

---

## Oversikt

Fristsporet har følgende hovedsteg:

```
1. TRIGGER oppstår (§33.1/§33.2/§33.3)
2. Nøytralt varsel (§33.4)
3. Spesifisert krav (§33.6.1) ELLER Etterlysning (§33.6.2)
4. Svar på krav (§33.7)
5. §5-mekanismen (ved sen varsling/svar)
```

---

## 1. Hovedflyt - TEs fristkrav

```mermaid
stateDiagram-v2
    [*] --> Trigger: Forhold oppstår (§33.1)

    Trigger --> TE_varsler_i_tide: TE varsler UUO
    Trigger --> TE_varsler_sent: TE varsler sent
    Trigger --> TE_varsler_ikke: TE varsler ikke

    %% TE varsler ikke
    TE_varsler_ikke --> PREKLUSJON_FULL: Kravet TAPES (§33.4)

    %% TE varsler sent
    TE_varsler_sent --> BH_paberoper_5: BH påberoper §5
    TE_varsler_sent --> BH_paberoper_ikke_5: BH påberoper ikke §5
    BH_paberoper_5 --> PREKLUSJON_FULL: Kravet TAPES
    BH_paberoper_ikke_5 --> HELBREDELSE: Varselet anses i tide
    HELBREDELSE --> Spesifisering

    %% TE varsler i tide
    TE_varsler_i_tide --> Spesifisering

    %% Spesifisering
    Spesifisering --> TE_spesifiserer: TE sender §33.6.1
    Spesifisering --> BH_etterlysning: BH etterspør §33.6.2
    Spesifisering --> Ingen_spesifisering: Ingen handling

    %% Ingen spesifisering - hva skjer?
    Ingen_spesifisering --> UAVKLART_1: [UAVKLART: Varsel uten oppfølging]
```

**UAVKLART 1:** Hva skjer hvis TE varsler nøytralt (§33.4) men aldri spesifiserer, og BH aldri etterspør? Kravet er "plassert" men ikke tallfestet.

---

## 2. Spesifisering via §33.6.1

```mermaid
stateDiagram-v2
    [*] --> TE_har_grunnlag: TE har grunnlag for beregning

    TE_har_grunnlag --> TE_spesifiserer_i_tide: Spesifiserer UUO
    TE_har_grunnlag --> TE_spesifiserer_sent: Spesifiserer sent
    TE_har_grunnlag --> TE_spesifiserer_ikke: Spesifiserer ikke

    %% I tide
    TE_spesifiserer_i_tide --> BH_svar: BH skal svare (§33.7)

    %% Sent
    TE_spesifiserer_sent --> BH_paberoper_5_sp: BH påberoper §5
    TE_spesifiserer_sent --> BH_paberoper_ikke_5_sp: BH påberoper ikke §5
    BH_paberoper_5_sp --> REDUKSJON: Kun det BH "måtte forstå"
    BH_paberoper_ikke_5_sp --> HELBREDELSE_SP: Spesifiseringen anses i tide
    HELBREDELSE_SP --> BH_svar

    %% Spesifiserer ikke
    TE_spesifiserer_ikke --> BH_etterlysning_alt: BH kan etterlyse (§33.6.2)
    TE_spesifiserer_ikke --> BH_etterlysning_ikke: BH etterspør ikke
    BH_etterlysning_ikke --> UAVKLART_2: [UAVKLART: Evig ventesituasjon]

    %% BH svar
    BH_svar --> BH_svarer_i_tide: Svarer UUO
    BH_svar --> BH_svarer_sent: Svarer sent
    BH_svar --> BH_svarer_ikke: Svarer ikke

    BH_svarer_ikke --> TE_paberoper_5: TE påberoper §5
    BH_svarer_ikke --> TE_paberoper_ikke_5: TE påberoper ikke §5
    TE_paberoper_5 --> INNSIGELSER_TAPT: BHs innsigelser TAPES
    TE_paberoper_ikke_5 --> HELBREDELSE_BH: BHs svar anses i tide
```

**UAVKLART 2:** Hva skjer hvis TE aldri spesifiserer og BH aldri etterspør? Kan kravet bli "foreldet" etter alminnelige regler?

---

## 3. Etterlysning via §33.6.2

```mermaid
stateDiagram-v2
    [*] --> BH_sender_etterlysning: BH sender brev (§33.6.2)

    %% Formkrav
    BH_sender_etterlysning --> Formkrav_OK: Per BREV med korrekt innhold
    BH_sender_etterlysning --> Formkrav_FEIL: E-post eller mangler innhold

    Formkrav_FEIL --> UAVKLART_3: [UAVKLART: Ugyldig etterlysning?]

    %% TE respons
    Formkrav_OK --> TE_svar_frist: TE må svare UUO

    TE_svar_frist --> TE_svarer_a: (a) Spesifiserer krav
    TE_svar_frist --> TE_svarer_b: (b) Begrunner utsettelse
    TE_svar_frist --> TE_svarer_ikke_etter: Svarer ikke
    TE_svar_frist --> TE_svarer_sent_etter: Svarer sent

    %% TE svarer ikke
    TE_svarer_ikke_etter --> PREKLUSJON_FULL_ETT: Kravet TAPES (§33.6.2)

    %% TE svarer sent
    TE_svarer_sent_etter --> BH_paberoper_5_ett: BH påberoper §5
    TE_svarer_sent_etter --> BH_paberoper_ikke_5_ett: BH påberoper ikke §5
    BH_paberoper_5_ett --> PREKLUSJON_FULL_ETT
    BH_paberoper_ikke_5_ett --> HELBREDELSE_ETT: Svaret anses i tide

    %% TE svarer (a) - spesifiserer
    TE_svarer_a --> HELBREDELSE_661: §33.6.1-frist "helbredet"
    HELBREDELSE_661 --> BH_svar_337: BH skal svare (§33.7)

    %% TE svarer (b) - begrunner utsettelse
    TE_svarer_b --> Ny_661_frist: §33.6.1 gjelder videre
    Ny_661_frist --> UAVKLART_4: [UAVKLART: Ny etterlysning nødvendig?]
```

**UAVKLART 3:** Hva er konsekvensen av ugyldig etterlysning (e-post i stedet for brev, mangler advarsel)?

**UAVKLART 4:** Når TE begrunner utsettelse (b), kan BH sende ny etterlysning umiddelbart? Eller må BH vente til grunnlag objektivt foreligger?

---

## 4. §5-mekanismen i fristsporet

```mermaid
stateDiagram-v2
    [*] --> Mottar_varsel: Part mottar varsel/svar

    Mottar_varsel --> Vurderer_tidspunkt: Mener det kom for sent?

    Vurderer_tidspunkt --> Ja_for_sent: Ja
    Vurderer_tidspunkt --> Nei_ok: Nei (i tide)

    Nei_ok --> Normal_behandling: Behandler normalt

    %% For sent
    Ja_for_sent --> Paberoper_5_skriftlig: Påberoper §5 skriftlig UUO
    Ja_for_sent --> Paberoper_5_sent: Påberoper §5, men sent
    Ja_for_sent --> Paberoper_5_ikke: Påberoper ikke §5

    Paberoper_5_skriftlig --> Konsekvens_inntrer: Konsekvens inntrer
    Paberoper_5_sent --> UAVKLART_5: [UAVKLART: §5 på §5?]
    Paberoper_5_ikke --> Helbredelse_5: Varselet anses i tide

    %% Unntak: Sluttoppgjør
    Konsekvens_inntrer --> Sjekk_sluttoppgjor: Er det sluttoppgjør?
    Sjekk_sluttoppgjor --> Ja_sluttoppgjor: Ja
    Sjekk_sluttoppgjor --> Nei_sluttoppgjor: Nei

    Ja_sluttoppgjor --> Unntak_5: §5 gjelder IKKE
    Nei_sluttoppgjor --> Normal_konsekvens: Konsekvens gjelder
```

**UAVKLART 5:** Hva skjer hvis part A påberoper §5 for sent - kan part B påberope §5 på part As §5-påberopelse? (Meta-§5)

---

## 5. BHs fristforlengelse (§33.2)

```mermaid
stateDiagram-v2
    [*] --> BH_trigger: BHs medvirkning hindres (§33.2)

    BH_trigger --> BH_varsler_i_tide: BH varsler UUO (§33.4)
    BH_trigger --> BH_varsler_sent: BH varsler sent
    BH_trigger --> BH_varsler_ikke: BH varsler ikke

    %% Symmetrisk med TE
    BH_varsler_ikke --> BH_PREKLUSJON: BHs krav TAPES

    BH_varsler_sent --> TE_paberoper_5_bh: TE påberoper §5
    TE_paberoper_5_bh --> BH_PREKLUSJON

    BH_varsler_i_tide --> BH_spesifiserer: BH spesifiserer (§33.6.1)
    BH_spesifiserer --> TE_svar_bh: TE skal svare (§33.7)

    TE_svar_bh --> TE_svarer_ikke_bh: TE svarer ikke
    TE_svarer_ikke_bh --> BH_paberoper_5_te: BH påberoper §5
    BH_paberoper_5_te --> TE_INNSIGELSER_TAPT: TEs innsigelser TAPES
```

---

## 6. Force majeure (§33.3)

```mermaid
stateDiagram-v2
    [*] --> FM_trigger: Force majeure oppstår

    FM_trigger --> Begge_hindret: Begge parter hindret
    FM_trigger --> En_part_hindret: Kun én part hindret

    En_part_hindret --> Part_varsler: Hindret part varsler (§33.4)
    Part_varsler --> Normal_flyt: [Samme flyt som §33.1/§33.2]

    %% Begge hindret - kjedereaksjon
    Begge_hindret --> TE_hindret_forst: TE hindret først
    Begge_hindret --> BH_hindret_forst: BH hindret først

    TE_hindret_forst --> TE_varsler_fm: TE varsler
    TE_varsler_fm --> BH_krav_pga_TE: BH har også krav (§33.3 fjerde ledd)

    %% VIKTIG: Ingen vederlag
    Normal_flyt --> Frist_innvilget: Frist godkjent
    Frist_innvilget --> INGEN_VEDERLAG: Ingen vederlagsjustering (§33.3)
```

---

## 7. Komplett beslutningstre

```mermaid
flowchart TD
    A[Forhold oppstår] --> B{TE varsler i tide?}

    B -->|Nei| C{BH påberoper §5?}
    C -->|Ja| D[PREKLUSJON - Kravet tapes]
    C -->|Nei| E[HELBREDELSE - Fortsett]

    B -->|Ja| E

    E --> F{TE spesifiserer i tide?}

    F -->|Nei, og BH etterspør| G{TE svarer på etterlysning?}
    F -->|Nei, og BH etterspør ikke| H[UAVKLART - Ventesituasjon]
    F -->|Ja| I{BH svarer i tide?}

    G -->|Nei| D
    G -->|Ja, med krav| I
    G -->|Ja, med begrunnelse| J[§33.6.1 gjelder videre]

    I -->|Nei| K{TE påberoper §5?}
    K -->|Ja| L[BHs innsigelser TAPES]
    K -->|Nei| M[HELBREDELSE - BHs svar anses i tide]

    I -->|Ja, godkjenner| N[Frist innvilget]
    I -->|Ja, avslår| O[Uenighet - §35]
    I -->|Ja, delvis| P[Delvis innvilget, delvis §35]
```

---

## 8. Forsering ved uberettiget avslag (§33.8)

```mermaid
stateDiagram-v2
    [*] --> BH_avslaar: BH avslår fristkrav (helt/delvis)

    BH_avslaar --> Sjekk_berettiget: Er TEs krav berettiget?

    Sjekk_berettiget --> Ikke_berettiget: Nei
    Sjekk_berettiget --> Berettiget: Ja

    Ikke_berettiget --> Normal_avslag: BHs avslag står - ingen forseringsrett

    %% Berettiget krav - sjekk kostnadsbegrensning
    Berettiget --> Sjekk_kostnad: Forseringskostnad vs dagmulkt+30%?

    Sjekk_kostnad --> For_dyrt: Kostnad > dagmulkt+30%
    Sjekk_kostnad --> Innenfor: Kostnad ≤ dagmulkt+30%

    For_dyrt --> Ingen_valgrett: TE har IKKE forseringsrett (§33.8)

    %% TE har forseringsrett
    Innenfor --> TE_velger: TE velger å anse avslag som forsering

    TE_velger --> TE_varsler_kostnad: TE varsler før iverksettelse
    TE_velger --> TE_varsler_ikke_kostnad: TE varsler IKKE

    TE_varsler_kostnad --> Forsering_iverksettes: Forsering iverksettes
    Forsering_iverksettes --> Endringsordre_effekt: Anses som EO (§33.8)

    TE_varsler_ikke_kostnad --> UAVKLART_FORS: [UAVKLART: Konsekvens?]
```

**Innholdskrav i varselet:** Skal angi hva forseringen antas å ville koste.

**Viktig:** §33.8 har INGEN eksplisitt konsekvens for manglende varsel. Mulige tolkninger:
1. TE mister retten til å anse avslaget som forseringspålegg
2. BH kan bestride forseringskostnadene
3. Kun lojalitetsbrudd

---

## 9. Identifiserte situasjoner og avklaringer

| # | Situasjon | Paragrafer | Status | Konklusjon |
|---|-----------|------------|--------|------------|
| 1 | Nøytralt varsel uten oppfølging | §33.4, §33.6.1 | **AVKLART** | Ikke et reelt problem - uten spesifisering er det aldri fremsatt et konkret krav |
| 2 | Ingen spesifisering, ingen etterlysning | §33.6.1, §33.6.2 | **AVKLART** | Samme som over - ingen spesifisering = ingen krav |
| 3 | Formkrav for etterlysning | §33.6.2 | **NOTERT** | Standard sier "brev", men i praksis aksepteres Word/PDF |
| 4 | Begrunnelse for utsettelse - ny etterlysning | §33.6.2 | **AVKLART** | Ingen regel i kontrakten = BH kan sende ny etterlysning når som helst |
| 5 | §5 på §5 (meta-spørsmål) | §5 | **AVKLART** | Logisk mulig, men praktisk irrelevant (se forklaring under) |
| 6 | Sluttoppgjør og fristkrav | §5, §33 | **UAVKLART** | Når er kravet "fremsatt" - ved §33.4 eller først ved §33.6.1? |
| 7 | Manglende varsel før forsering | §33.8 | **UAVKLART** | Ingen eksplisitt konsekvens i kontrakten |

### Forklaring: §5 på §5 (punkt 5)

Eksempel på hvordan dette fungerer:
1. TE varsler for sent
2. BH påberoper §5, men selv for sent
3. Hva skjer?

**Svar:** Domstolen vil si: Ja, TE varslet for sent, men BH påberopte ikke "uten ugrunnet opphold". Konsekvens per §5: "skal varselet eller svaret anses for å være gitt i tide."

**Konklusjon:** TE varslet i prinsippet for sent, men varselet anses å være gitt i tide da BH ikke påberopte i tide. Dette er "helbredelse" i praksis.

### Forklaring: Sluttoppgjør og fristkrav (punkt 6) - UAVKLART

§5 gjelder ikke for krav fremsatt i sluttoppgjør. Men når er et fristkrav "fremsatt"?

- **Alternativ A:** Kravet er "fremsatt" ved nøytralt varsel (§33.4)
- **Alternativ B:** Kravet er først "fremsatt" ved spesifisert krav (§33.6.1)

Svaret har betydning for om §5-unntaket gjelder. Dette bør avklares juridisk.

---

## 10. Implikasjoner for applikasjonen

### Må håndteres

1. **Helbredelse via §5** - Applikasjonen må spore om motpart har påberopt sen varsling
2. **Formkrav §33.6.2** - Applikasjonen bør advare om at etterlysning krever BREV
3. **Symmetri §33.7** - Begge parter har svarplikt, ikke bare BH
4. **Forsering §33.8** - Applikasjonen må støtte forseringsprosessen med kostnadsvarsel

### Bør flagges som UAVKLART

1. Nøytralt varsel uten oppfølging - vis advarsel til bruker
2. Lang tid mellom §33.4 og §33.6.1 - vis advarsel
3. Etterlysning per e-post - vis advarsel om formkrav

---

> **Neste steg:** Overføre uavklarte situasjoner til [uavklarte-situasjoner.md](./uavklarte-situasjoner.md)
