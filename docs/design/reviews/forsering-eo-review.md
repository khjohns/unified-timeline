# Review: Forsering og Endringsordre — forretningslogikk-konsistens

Gjennomgang av DESIGN_WORKSPACE_PANELS.md linjene 1553–1706 mot domeneanalysen i outputfrasubagent.md linjene 1700–2309.

Kun forretningslogikk er vurdert — visuelle og designmessige forskjeller er ikke tatt med.

---

## 1. TE forsering-skjema: feltdekning

**Design-referanse:** DESIGN_WORKSPACE_PANELS.md linje 1553–1591

De fire obligatoriske feltene fra domenet er:
- `estimert_kostnad`
- `dagmulktsats`
- `dato_iverksettelse`
- `begrunnelse`

### Funn

**OK — `estimert_kostnad`**
Vises i design som «Estimert kostnad»-inntastingsfelt (linje 1577–1580). Korrekt.

**OK — `dagmulktsats`**
Vises i design som «Dagmulktssats · kr 50 000» (linje 1567). Korrekt.

**OK — `dato_iverksettelse`**
Vises i design som «Varslet forsering»-datofelt (linje 1583–1586). Notat: domenet kaller feltet `dato_iverksettelse`; design bruker etiketten «Varslet forsering». Dette er en etikett-uoverensstemmelse, men feltet er tilstede. Domenet bekrefter at `dato_iverksettelse` samles i UI men foreløpig ikke sendes i API-payload (outputfrasubagent.md linje 1880–1881) — dette er en kjent svakhet i implementasjonen, ikke i designdokumentet.

**OK — `begrunnelse`**
Ikke eksplisitt synlig i designens ASCII-mock, men designet inneholder ingen «Begrunnelse»-seksjon. Feltet er i SendForseringModal.tsx (outputfrasubagent.md linje 1848–1850).

**MISSING — `begrunnelse`-felt ikke vist i designen**
TE-forsering-formen i design (linje 1557–1591) viser ikke et begrunnelsestekstfelt. Domenet krever `begrunnelse` (min 10 tegn). Skjemaet slik det er tegnet i designen ser ufullstendig ut for dette feltet.

**OK — 30%-regel-gate**
Designen viser 30%-regelens grenseberegning (linje 1569–1581) og en bekreftelsesavkrysning (linje 1574–1575). Domenet bekrefter at innsendingsknappen er deaktivert hvis `estimertKostnad > maksKostnad` (outputfrasubagent.md linje 1878). Korrekt logikk.

---

## 2. BH forsering-respons: 4-trinns veiviser

**Design-referanse:** DESIGN_WORKSPACE_PANELS.md linje 1595–1630

Domenet definerer en 4-port veiviser:
- Port 1: Forseringsrett per sak
- Port 2: 30%-regel (informasjon, ikke brukerinput)
- Port 3: Beløpsvurdering
- Port 4: Oppsummering + begrunnelse

(outputfrasubagent.md linje 1891–1894)

### Funn

**OK — Port 1 (Forseringsrett per sak)**
Designen viser per-sak-vurdering med «Anerkjenner / Bestrider»-knapper (linje 1598–1609) og summerer «Dager med forseringsrett» (linje 1610). Korrekt.

**MISSING — Port 2 (30%-regel som informasjonsport)**
Designen viser 30%-regelblokken med «Ja / Nei»-knapper (linje 1612–1617) som om det er en brukervalgt input. Domenet er tydelig på at `trettiprosent_overholdt` er **auto-satt fra backend-data** (`forseringData.kostnad_innenfor_grense`), ikke en brukervalgt radio-knapp (outputfrasubagent.md linje 1914–1916: «Auto-set from forseringData.kostnad_innenfor_grense, not a user input»). Designen fremstiller dette feilaktig som et brukervalg.

**MISSING — Port 3 og 4 ikke representert**
Designen hopper direkte fra 30%-regel-blokken til en «DIN VURDERING»-seksjon (linje 1619–1629) med Godkjent/Delvis godkjent/Avslått. Den utelater:
- Port 3: Beløpsvurdering for rigg/drift og produktivitetstap (se punkt 3 nedenfor)
- Port 4: Oppsummeringstrinnet med `tilleggs_begrunnelse`-felt

**MISSING — Manglende `tilleggs_begrunnelse`-felt**
Domenet har et «Tilleggskommentar»-felt i Port 4 som legges til den autogenererte begrunnelsen (outputfrasubagent.md linje 1966–1968). Ingen tilsvarende felt er vist i designen.

---

## 3. Rigg/drift og produktivitet — preklusjonssjekker i forsering

**Design-referanse:** DESIGN_WORKSPACE_PANELS.md linje 1595–1630

Domenet (outputfrasubagent.md linje 1930–1963) definerer følgende betingede felt i BH-forsering-responsen (alle i Port 3):
- `rigg_varslet_i_tide` — boolean, kun hvis rigg krav > 0 (§34.1.3)
- `rigg_vurdering` — godkjent/delvis/avslatt, kun hvis rigg krav
- `godkjent_rigg_drift` — beløp, kun hvis rigg delvis
- `produktivitet_varslet_i_tide` — boolean, kun hvis produktivitetstap krav > 0
- `produktivitet_vurdering` — godkjent/delvis/avslatt
- `godkjent_produktivitet` — beløp, kun hvis produktivitet delvis
- Hvis `varslet_i_tide === false` evaluerer BH subsidiært

### Funn

**MISSING — Rigg/drift og produktivitet preklusjonssjekker er ikke representert**
Designen viser ingen av disse feltene. Ingen «Varslet i tide?»-radiogruppe for rigg/drift eller produktivitetstap, ingen separate beløpsvurderinger for disse særskilte kravene. Dette er materielle forretningslogikkelementer som mangler fra designen.

---

## 4. BH oppretter EO: feltdekning

**Design-referanse:** DESIGN_WORKSPACE_PANELS.md linje 1634–1673

Domenet krever (outputfrasubagent.md linje 2024–2135):
- `eo_nummer`, `tittel`, `beskrivelse`
- KOE-utvalg (checkbox-liste)
- `konsekvenser` (sha, fremdrift, kvalitet, pris, annet)
- `konsekvens_beskrivelse` (utdypende tekst)
- `oppgjorsform` (ENHETSPRISER / REGNINGSARBEID / FASTPRIS_TILBUD)
- `kompensasjon_belop`, `fradrag_belop`
- `frist_dager`, `ny_sluttdato`
- `er_estimat` (auto-satt)

### Funn

**OK — `eo_nummer`**
Vist i design (linje 1642–1645). Korrekt.

**MISSING — `tittel`**
Domenets skjema krever `tittel` (min 3, maks 100 tegn) som et eget felt (outputfrasubagent.md linje 2040). Designen viser ikke et separat tittel-felt — EO-nummeret ser ut til å stå alene i identifikasjonsdelen.

**MISSING — `beskrivelse`**
Domenets skjema krever `beskrivelse` (outputfrasubagent.md linje 2046). Designen viser ikke et fritekstfelt for beskrivelse av hva endringen innebærer.

**OK — KOE-utvalg**
Vist som «RELATERTE KOE-SAKER» med avkrysningsbokser (linje 1647–1651). Korrekt.

**OK — `konsekvenser` (sha, fremdrift, kvalitet, pris, annet)**
Vist som avkrysningsbokser under «KONSEKVENSER» (linje 1653–1656). Korrekt.

**MISSING — `konsekvens_beskrivelse`**
Domenet har et valgfritt utdypende tekstfelt som vises når en konsekvens er krysset av (outputfrasubagent.md linje 2066). Designen mangler dette feltet.

**OK — `oppgjorsform`**
Vist som fane-utvelgelse (Enhetspriser / Regningsarbeid / Fastpris) (linje 1660–1662). Korrekt.

**OK — `kompensasjon_belop` og `fradrag_belop`**
Vist med korrekte beregninger: Kompensasjon, Fradrag §34.4, Netto (linje 1664–1666). Korrekt.

**OK — `frist_dager` og `ny_sluttdato`**
Vist (linje 1668–1669). Korrekt.

---

## 5. TE EO-respons: korrekt representasjon?

**Design-referanse:** DESIGN_WORKSPACE_PANELS.md linje 1676–1687

### Funn

**OK — Akseptert / Bestridt (ikke et fullstendig skjema)**
Designen viser korrekt en enkel to-knapp-vurdering: «Akseptert» / «Bestridt» (linje 1681–1683). Domenet bekrefter at TE-responsen på EO er en to-knapps handling direkte på EODashboard, ikke et flerfelt-skjema (outputfrasubagent.md linje 2148–2153). Korrekt.

**OK — Varsel ved Bestridt**
Designen viser «Du kan sende alternativt KOE-krav» ved Bestridt (linje 1685–1686). Dette er konsistent med domenets EO-livssyklus der bestriding medfører videre KOE-behandling.

**MISSING — `te_kommentar`-felt**
Domenet lagrer `te_kommentar?: string` som valgfri kommentar ved TE-respons (outputfrasubagent.md linje 2158). Designen viser ikke et kommentarfelt ved enten Akseptert eller Bestridt.

---

## 6. Aksept-seksjon: per-spor-aksept

**Design-referanse:** DESIGN_WORKSPACE_PANELS.md linje 1691–1706

### Funn

**MISSING — Per-spor-aksept ikke representert**
Domenet implementerer per-spor-aksept med tre separate spor: `grunnlag`, `vederlag`, `frist` (outputfrasubagent.md linje 2177). Hvert spor aksepteres uavhengig via `te_aksepterer_respons`-hendelsen med `spor`-feltet.

Designen (linje 1697) viser én enkelt «Aksepter svar»-knapp i foter-handlingene uten å skille mellom sporene. Dette er ikke korrekt: aksept er per spor, ikke en enkelt global aksept av hele saken.

**MISSING — Per-spor-kontekstvisning**
Domenet viser BHs posisjon per spor i aksept-dialogen: «BH sin posisjon: [Godkjent / Avslatt / Delvis godkjent — X kr/dager]» (outputfrasubagent.md linje 2193). Ingenting tilsvarende er skissert i designen.

**OK — Uangerlighet-advarsel**
«Aksepter»-betegnelsen med bekreftelses-dialog (linje 1701) er konsistent med domenets «Denne handlingen kan ikke angres»-advarsel (outputfrasubagent.md linje 2205).

---

## 7. Trekk (tilbaketrekking): kaskadelogikk

**Design-referanse:** DESIGN_WORKSPACE_PANELS.md linje 1697, 1703

### Funn

**MISSING — Per-spor-trekk ikke representert**
Domenet har tre separate trekk-hendelser: `grunnlag_trukket`, `vederlag_krav_trukket`, `frist_krav_trukket` (outputfrasubagent.md linje 2215–2218). «Trekk tilbake»-knappen i designen (linje 1697) er en enkelt global knapp uten spor-differensiering.

**MISSING — Kaskaderegler ikke representert**
Domenet definerer eksplisitte kaskaderegler (outputfrasubagent.md linje 2241–2247):
- Å trekke `grunnlag` kaskader og trekker `vederlag` og `frist` hvis de er aktive
- Å trekke `vederlag` mens `frist` er inaktiv kaskader og trekker også `grunnlag`
- Å trekke `frist` mens `vederlag` er inaktiv kaskader og trekker også `grunnlag`
- Alert bytter til danger-variant med tittelen «Dette vil trekke hele saken» eller «Dette vil også trekke ansvarsgrunnlaget»

Ingen av disse kaskadereglene eller den kontekstsensitive varsel-UI-en er omtalt i designen.

**OK — Begrunnelseskrav**
Designen nevner «bekreftelses-dialog med begrunnelseskrav (min 10 tegn)» (linje 1703). Domenet har `begrunnelse`-feltet i WithdrawForm (outputfrasubagent.md linje 2230). Merk at domenet har `begrunnelse` som valgfritt (ikke påkrevd), mens designen sier «min 10 tegn» — dette er en liten inkonsekvens: designen er strengere enn implementasjonen.

---

## 8. Forsering-verdict: «Anerkjenner/Bestrider» vs. «Godkjent/Avslått»

**Design-referanse:** DESIGN_WORKSPACE_PANELS.md linje 1598–1623

### Funn

**OK — Per-sak-verdict bruker «Anerkjenner / Bestrider»**
Port 1 (per-sak-vurdering) bruker korrekt «Anerkjenner» / «Bestrider» (linje 1601–1608). Domenet bruker `avslag_berettiget: boolean` (outputfrasubagent.md linje 1906) der «Anerkjenner» tilsvarer «Avslaget var berettiget» og «Bestrider» tilsvarer «Avslaget var uberettiget». Korrekt terminologi.

**INCORRECT — Overordnet verdict bruker «Godkjent / Delvis godkjent / Avslått»**
«DIN VURDERING»-seksjonen (linje 1619–1623) viser «Godkjent / Delvis godkjent / Avslått» som overordnet verdict for forsering. Domenet bruker `hovedkrav_vurdering: 'godkjent' | 'delvis' | 'avslatt'` (outputfrasubagent.md linje 1920). Dette er teknisk sett de samme verdiene, men terminologien «Godkjent/Avslått» er problematisk for forsering: den overordnede vurderingen bør reflektere «Forseringsrett anerkjent / Forseringsrett bestridt» semantikk i tråd med per-sak-terminologien, ikke den generelle godkjennings-/avslåttslanguagen som brukes for vederlag/frist. I domenet heter feltet `aksepterer: true/false` i API-payloaden (linje 1985), ikke «godkjent». Designen er konsistent med domenets skjema-verdier men er inkongruent med «Anerkjenner/Bestrider»-terminologien etablert i per-sak-vurderingen.

---

## 9. Beregnede felter i forsering: korrekthet

**Design-referanse:** DESIGN_WORKSPACE_PANELS.md linje 1563–1581

Domenet definerer (outputfrasubagent.md linje 1861–1864):
- `avslatteDager` = `krevde_dager - godkjent_dager` (eller alle krevde_dager ved subsidiær trigger)
- `maksKostnad` = `avslatteDager × dagmulktsats × 1.3`
- `erInnenforGrense` = `estimertKostnad <= maksKostnad`
- `prosentAvGrense` = vises som prosentfeedback

### Funn

**OK — `avslatteDager`**
Designen viser «Sum avslåtte dager ········ 35 dager» (linje 1566) som summen av avslåtte dager på tvers av sakene (15d + 20d). Korrekt.

**OK — `maksKostnad`-formel**
Designen viser «Maks kostnad ···· kr 2 275 000» med forklaring «(35d × kr 50k × 1,3)» (linje 1571–1572). Dette er korrekt: 35 × 50 000 × 1.3 = 2 275 000. Formelen er riktig representert.

**OK — `erInnenforGrense`-gate**
Bekreftelsesavkrysningen «Jeg bekrefter at estimert kostnad er under grensen» (linje 1574–1575) representerer `erInnenforGrense`-sjekken. Korrekt.

**MISSING — `prosentAvGrense`-visning**
Designen viser «Margin: kr 475 000 (21%)» (linje 1581) som margin-feedback. Domenet beregner `prosentAvGrense` eksplisitt (outputfrasubagent.md linje 1864). Designen viser margin i NOK og prosent — dette er korrekt og konsistent med domenet, men det er margin (gjenstående rom) som vises, ikke prosent av grensen brukt. Dette er en tolkning: 1 800 000 / 2 275 000 = 79,1%, så marginen er 20,9% ≈ 21%. Korrekt.

---

## 10. EO: `netto_belop`-beregning og `er_estimat`-auto-sett

**Design-referanse:** DESIGN_WORKSPACE_PANELS.md linje 1658–1669

### Funn

**OK — `netto_belop`-beregning vist**
Designen viser «Kompensasjon ·········· kr 2 250 000», «Fradrag §34.4 ·········· kr 100 000», «Netto ·················· kr 2 150 000» (linje 1664–1666). Domenet beregner `netto_belop` live som `kompensasjon_belop - fradrag_belop` (outputfrasubagent.md linje 2141). Korrekt representert.

**MISSING — `er_estimat`-auto-sett ikke representert**
Domenet auto-setter `er_estimat` basert på valgt oppgjørsform: `true` for ENHETSPRISER/REGNINGSARBEID, `false` for FASTPRIS_TILBUD (outputfrasubagent.md linje 2093). Designen nevner ikke denne logikken, og det er heller ingen visuell indikasjon på om beløpet er et estimat eller et fast beløp. Dette er forretningslogikk som påvirker hvordan beløpet kommuniseres til TE (estimat vs. fast beløp), og bør fremgå av designen.

---

## Oppsummering

| # | Tema | Status | Linje (design) |
|---|------|--------|----------------|
| 1a | TE forsering: `estimert_kostnad` | OK | 1577–1580 |
| 1b | TE forsering: `dagmulktsats` | OK | 1567 |
| 1c | TE forsering: `dato_iverksettelse` | OK (feil etikett) | 1583–1586 |
| 1d | TE forsering: `begrunnelse` | MISSING | — |
| 1e | TE forsering: 30%-regel-gate | OK | 1569–1581 |
| 2a | BH forsering: Port 1 per-sak-vurdering | OK | 1598–1610 |
| 2b | BH forsering: Port 2 som auto-satt (ikke brukerinput) | INCORRECT | 1612–1617 |
| 2c | BH forsering: Port 3 og 4 | MISSING | — |
| 2d | BH forsering: `tilleggs_begrunnelse` | MISSING | — |
| 3 | Rigg/drift og produktivitet preklusjonssjekker | MISSING | — |
| 4a | EO: `tittel` | MISSING | — |
| 4b | EO: `beskrivelse` | MISSING | — |
| 4c | EO: `konsekvens_beskrivelse` | MISSING | — |
| 4d | EO: øvrige felt | OK | 1642–1669 |
| 5a | TE EO-respons: Akseptert/Bestridt (ikke fullt skjema) | OK | 1681–1683 |
| 5b | TE EO-respons: `te_kommentar` | MISSING | — |
| 6 | Aksept: per-spor-aksept (grunnlag/vederlag/frist) | MISSING | 1697 |
| 7a | Trekk: per-spor-trekk | MISSING | 1697 |
| 7b | Trekk: kaskaderegler | MISSING | 1703 |
| 7c | Trekk: begrunnelse valgfri vs. påkrevd | INCORRECT | 1703 |
| 8a | Forsering-verdict: per-sak «Anerkjenner/Bestrider» | OK | 1601–1608 |
| 8b | Forsering-verdict: overordnet «Godkjent/Avslått» terminologi | INCORRECT | 1619–1623 |
| 9a–9c | Beregnede felter (avslatteDager, maksKostnad, erInnenforGrense) | OK | 1566–1581 |
| 10a | EO: `netto_belop`-beregning | OK | 1664–1666 |
| 10b | EO: `er_estimat`-auto-sett | MISSING | — |

**Antall OK:** 13
**Antall MISSING:** 12
**Antall INCORRECT:** 3
