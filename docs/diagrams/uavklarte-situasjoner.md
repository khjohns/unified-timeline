# Uavklarte situasjoner

**Formål:** Samle alle hull, mangler og uavklarte spørsmål oppdaget gjennom scenarioanalyse.

*Opprettet: 2026-01-24*

---

## Kategorier

| Kategori | Beskrivelse |
|----------|-------------|
| **KONSEKVENS** | Kontrakten angir ingen eksplisitt konsekvens |
| **FORMKRAV** | Uklart hva som skjer ved brudd på formkrav |
| **TIDSPUNKT** | Uklart når frist begynner å løpe |
| **KOMBINASJON** | Uklart hva som skjer ved kombinasjon av hendelser |
| **META** | Spørsmål om reglene selv (f.eks. §5 på §5) |

---

## Fristsporet (§33)

### FRIST-1: Nøytralt varsel uten oppfølging

| Felt | Verdi |
|------|-------|
| **Kategori** | KOMBINASJON |
| **Situasjon** | TE sender nøytralt varsel (§33.4), men spesifiserer aldri (§33.6.1). BH etterspør aldri (§33.6.2). |
| **Paragrafer** | §33.4, §33.6.1, §33.6.2 |
| **Spørsmål** | Hva skjer med kravet? Kan det "henge" for evig? |
| **Mulige tolkninger** | 1) Kravet består ubegrenset, 2) Foreldelse etter alminnelige regler, 3) BH kan påberope passivitet |
| **Anbefaling** | Applikasjonen bør vise advarsel etter X dager uten spesifisering |

---

### FRIST-2: Ugyldig etterlysning

| Felt | Verdi |
|------|-------|
| **Kategori** | FORMKRAV |
| **Situasjon** | BH sender etterlysning per e-post i stedet for brev, eller utelater påkrevd innhold |
| **Paragrafer** | §33.6.2 |
| **Spørsmål** | Er etterlysningen ugyldig? Kan TE ignorere den? |
| **Mulige tolkninger** | 1) Helt ugyldig - ingen virkning, 2) Delvis virkning - TE bør varsle om feilen, 3) Kun advarsel om tap utelatt = ugyldig |
| **Anbefaling** | Applikasjonen bør advare BH om formkrav FØR sending |

---

### FRIST-3: Begrunnelse for utsettelse - ny etterlysning

| Felt | Verdi |
|------|-------|
| **Kategori** | TIDSPUNKT |
| **Situasjon** | TE svarer på etterlysning med begrunnelse for hvorfor beregning ikke er mulig (§33.6.2 b). BH vil etterlyse igjen. |
| **Paragrafer** | §33.6.2 |
| **Spørsmål** | Når kan BH sende ny etterlysning? Umiddelbart? Når grunnlag objektivt foreligger? |
| **Mulige tolkninger** | 1) BH må vente til TEs begrunnelse ikke lenger gjelder, 2) BH kan etterlyse når som helst, 3) Ny etterlysning ugyldig før rimelig tid |
| **Anbefaling** | Applikasjonen bør logge TEs begrunnelse og flagge når den potensielt ikke lenger gjelder |

---

### FRIST-4: §5 på §5 (meta-spørsmål)

| Felt | Verdi |
|------|-------|
| **Kategori** | META |
| **Situasjon** | Part A påberoper §5 for sent. Kan Part B påberope §5 på Part As §5-påberopelse? |
| **Paragrafer** | §5 |
| **Spørsmål** | Er det en uendelig rekursjon? Hvor stopper det? |
| **Mulige tolkninger** | 1) §5 gjelder kun "varsler og krav" - ikke §5-påberopelser, 2) Ja, men praktisk bare én iterasjon, 3) Domstolene må vurdere |
| **Anbefaling** | Applikasjonen noterer kun første nivå av §5-påberopelse |

---

### FRIST-5: Sluttoppgjør-unntak for fristkrav

| Felt | Verdi |
|------|-------|
| **Kategori** | KOMBINASJON |
| **Situasjon** | §5 gjelder ikke for krav fremsatt i sluttoppgjør. Gjelder dette også fristkrav etter §33? |
| **Paragrafer** | §5, §33, §39 |
| **Spørsmål** | Kan en part påberope sen varsling av fristkrav i sluttoppgjøret uten å ha gjort det tidligere? |
| **Mulige tolkninger** | 1) Ja - §5 unntak gjelder alle krav, 2) Nei - fristkrav er annerledes enn vederlagskrav, 3) Avhenger av om fristkravet påvirker sluttoppgjøret |
| **Anbefaling** | Applikasjonen bør advare begge parter om denne usikkerheten |

---

## Grunnlagssporet (§25, §32)

### GRUNN-1: §25.3 konsekvens ved passivitet

| Felt | Verdi |
|------|-------|
| **Kategori** | KONSEKVENS |
| **Situasjon** | BH svarer ikke på varsel etter §25.1.2 eller §25.2 |
| **Paragrafer** | §25.3 |
| **Spørsmål** | Hva er konsekvensen? §32.3 har eksplisitt passivitetsvirkning, §25.3 har ikke. |
| **Mulige tolkninger** | 1) Analogt §32.3 - forholdet anses akseptert, 2) Erstatningsansvar for BH, 3) Ingen juridisk konsekvens - bare oppfordring |
| **Anbefaling** | Applikasjonen noterer passivitet men tar ikke stilling |

---

### GRUNN-2: Dobbel varsling ved SVIKT/ANDRE

| Felt | Verdi |
|------|-------|
| **Kategori** | KOMBINASJON |
| **Situasjon** | TE oppdager svikt (§25.1.2) og vil kreve både vederlag (§34.1.2) og frist (§33.4) |
| **Paragrafer** | §25.1.2, §34.1.2, §33.4 |
| **Spørsmål** | Må TE sende tre separate varsler? Kan ett varsel dekke alle? |
| **Mulige tolkninger** | 1) Tre separate varsler kreves, 2) Ett varsel med alle elementer er tilstrekkelig, 3) Grunnlag (§25.1.2) er separat, men frist/vederlag kan kombineres |
| **Anbefaling** | Applikasjonen bør støtte både separat og kombinert varsling |

---

## Vederlagssporet (§34)

### VED-1: §34.2.1 konsekvens ved passivitet

| Felt | Verdi |
|------|-------|
| **Kategori** | KONSEKVENS |
| **Situasjon** | BH svarer ikke på spesifisert tilbud fra TE innen "rimelig tid" |
| **Paragrafer** | §34.2.1 |
| **Spørsmål** | Hva er konsekvensen? Ingen eksplisitt konsekvens er angitt. |
| **Mulige tolkninger** | 1) Tilbudet anses akseptert (analogt §30.3.2), 2) TE kan iverksette arbeidet, 3) Ingen konsekvens - TE må purre |
| **Anbefaling** | Applikasjonen bør vise advarsel til BH om utløpende frist |

---

### VED-2: §34.4 konsekvens for manglende forhåndsvarsel

| Felt | Verdi |
|------|-------|
| **Kategori** | KONSEKVENS |
| **Situasjon** | TE varsler ikke før regningsarbeid igangsettes |
| **Paragrafer** | §34.4 |
| **Spørsmål** | Hva er konsekvensen? Kontrakten sier bare "skal varsles" uten å angi konsekvens. |
| **Mulige tolkninger** | 1) §30-reglene gjelder likevel, men skjerpet bevisbyrde, 2) Tap av rett til regningsarbeid, 3) BH kan kreve fastpris i ettertid |
| **Anbefaling** | Applikasjonen bør advare TE om å varsle FØR oppstart |

---

## Regningsarbeid (§30)

### REGN-1: §30.2 konsekvens for manglende overskridelsesvarsel

| Felt | Verdi |
|------|-------|
| **Kategori** | KONSEKVENS |
| **Situasjon** | TE varsler ikke om at kostnadsoverslaget vil overskrides |
| **Paragrafer** | §30.2 |
| **Spørsmål** | Hva er konsekvensen? Ingen eksplisitt konsekvens er angitt. |
| **Mulige tolkninger** | 1) BH kan holde tilbake betaling, 2) TE erstatningsansvarlig for tap BH kunne unngått, 3) Kun lojalitetsbrudd |
| **Anbefaling** | Applikasjonen bør advare TE når estimat nærmer seg grense |

---

## Generelt

### GEN-1: Skjæringstidspunkt for "uten ugrunnet opphold"

| Felt | Verdi |
|------|-------|
| **Kategori** | TIDSPUNKT |
| **Situasjon** | Flere paragrafer bruker "uten ugrunnet opphold" uten å spesifisere eksakt når fristen begynner |
| **Paragrafer** | §5, §25.1.2, §32.2, §33.4, §34.1.2, etc. |
| **Spørsmål** | Når begynner fristen? Når forholdet oppstår? Når parten blir klar over det? Når parten burde blitt klar over det? |
| **Mulige tolkninger** | Se kartleggingsdokumentet for aktsomhetsnormer |
| **Anbefaling** | Applikasjonen bruker den mest presise formuleringen fra kontrakten for hver paragraf |

---

## Sammendrag

| Kategori | Antall | Kritiske |
|----------|--------|----------|
| KONSEKVENS | 4 | VED-1, VED-2 |
| FORMKRAV | 1 | FRIST-2 |
| TIDSPUNKT | 2 | FRIST-3, GEN-1 |
| KOMBINASJON | 3 | FRIST-1, FRIST-5, GRUNN-2 |
| META | 1 | FRIST-4 |
| **Totalt** | **11** | **4** |

---

> **Handling:** Kritiske uavklarte situasjoner bør eskaleres til juridisk vurdering før produksjon.
