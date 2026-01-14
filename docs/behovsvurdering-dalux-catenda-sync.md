# Vurdering av behovsbeskrivelse: Dalux-Catenda synkronisering

**Dato:** 2026-01-13
**Status:** Utkast til gjennomgang med OBF

## Bakgrunn

OBF har levert en behovsbeskrivelse for synkronisering mellom Dalux og Catenda. Dette dokumentet vurderer hvert punkt opp mot tekniske muligheter og eksisterende implementasjon.

---

## 1. Forutsetninger

### OBF-behov
> - Én-veis synkronisering fra Dalux til Catenda
> - Catenda er hovedsystemet (master)
> - Unntak: RUH-saker behandles i entreprenørens system

### Vurdering

| Krav | Status | Kommentar |
|------|--------|-----------|
| Én-veis synk | ✅ Støttet | Dalux API har kun lesetilgang |
| Catenda som master | ✅ Støttet | Arkitekturen er designet for dette |
| RUH-unntak | ⚠️ Må avklares | Nåværende impl. synkroniserer RUH som `Warning` |

### Avklaring påkrevd

**Spørsmål til OBF:** Skal RUH-saker:
- a) Ekskluderes helt fra synkronisering?
- b) Synkroniseres, men markeres spesielt?
- c) Synkroniseres som vanlige saker?

---

## 2. Dokumenter

### OBF-behov
> - TE ansvarlig for opplasting i Catenda
> - Automatisk overføring av filer fra TE sin UE
> - Filtyper: Office, punktsky, dwg, dxf, Revit, IFC, smc
> - Mappestruktur: Konfigurerbar mapping (mappe X → mappe Y)

### Vurdering

| Krav | Status | Kommentar |
|------|--------|-----------|
| Vedleggssynk | ✅ Verifisert | File Areas API fungerer, task attachments gir 403 |
| Filtyper | ✅ Uproblematisk | Catenda støtter alle nevnte formater |
| Mappekonfigurasjon | 🔴 Ikke implementert | Må utvikles |
| Automatisk mappeopprettelse | ✅ Verifisert | Mapper kan opprettes via API, bibliotek må eksistere |

### Tekniske begrensninger

**Catenda API:**
- **Bibliotek (library):** Kan IKKE opprettes via API for dokumenter (kun classification). Må opprettes manuelt i Catenda UI først.
- **Mapper (folders):** ✅ Verifisert 2026-01-14. Opprettes via API med `POST /v2/projects/{id}/libraries/{libId}/items` med payload `{"name": "...", "document": {"type": "folder"}, "parentId": "..."}`

**Dalux API - to separate lagringssystemer:**

| Lagring | Beskrivelse | Liste | Nedlasting |
|---------|-------------|-------|------------|
| **Task attachments** | Bilder/filer direkte på saker | ✅ OK | ❌ 403 |
| **Lokasjonsbilder** | Plantegninger med markering | ✅ OK | ❌ 403 |
| **File Areas** | Prosjektdokumenter (PDF, tegninger) | ✅ OK | ✅ OK |

**NB:** Task attachments og File Areas er **separate systemer** i Dalux. Saksvedlegg finnes IKKE i File Areas.

**Årsak til 403:** Dette er en **begrensning i API-nøkkelens rettigheter**, ikke i selve API-et. API-rettigheter styres av prosjekteier (entreprenøren) i Dalux Admin.

**Anbefaling:** Avklar med prosjekteier (entreprenør) om API-nøkkelen kan få utvidede rettigheter for nedlasting av task attachments og lokasjonsbilder.

**Kommentarer og historikk:**
- **Kommentarer:** Finnes IKKE som eget endepunkt i Dalux API. Eventuelle notater må legges i egendefinerte felt.
- **Historikk:** Tilgjengelig via `tasks/changes` API som returnerer alle endringer (action: assign/update) med timestamp, modifiedBy og hvilke felt som ble endret.

### Anbefaling

Forutsetning for synk: Bibliotek må opprettes manuelt i Catenda før synkronisering aktiveres. Deretter kan mapper opprettes automatisk etter konfigurasjon.

---

## 3. Saker og oppgaver

### OBF-behov
> - Utveksling hvert 5. minutt
> - ID-nummer identisk i begge systemer
> - Oppgavelister → forhåndsdefinerte sakslister
> - Felt som ikke finnes skal opprettes automatisk

### Vurdering

| Krav | Status | Kommentar |
|------|--------|-----------|
| Synk hvert 5 min | ⚠️ Avvik | Implementert med 15 min, ingen scheduler |
| Identiske ID | ❌ **Ikke mulig** | Dalux: numerisk, Catenda: UUID |
| Oppgaveliste-mapping | 🔴 Ikke implementert | Krever konfigurasjon |
| Auto-opprett felt | ❌ **Ikke praktisk** | Krever manuell sakstype-oppsett |

### Tekniske begrensninger

**ID-problemet:**
- Dalux bruker numerisk ID: `6070718657`
- Catenda genererer UUID: `a1b2c3d4-e5f6-7890-...`
- Disse kan IKKE være identiske

**Egendefinerte felt:**
- Catenda krever at sakstyper/sakslister opprettes manuelt
- Felt må defineres på forhånd i Catenda UI
- Automatisk opprettelse er ikke praktisk gjennomførbart

### Anbefaling

**ID-håndtering:** Begge ID-er lagres i synk-mapping og kan vises i brukergrensesnittet. Foreslått tekst til OBF:
> "Dalux-ID og Catenda-ID lagres og er sporbare, men vil ikke være identiske grunnet tekniske begrensninger i systemene."

**Felt-håndtering:** Ukjente felt fra Dalux legges i description-feltet som strukturert tekst (markdown).

---

## 4. Brukere og persondata

### OBF-behov
> - Automatisk kobling basert på e-postadresse
> - GDPR må vurderes

### Vurdering

| Krav | Status | Kommentar |
|------|--------|-----------|
| E-post-kobling | ✅ Implementert | `assignedTo.email` → `assigned_to` |
| GDPR-vurdering | 🔴 Ikke adressert | Krever juridisk vurdering |

### Avklaring påkrevd

**Spørsmål til OBF:**
- Hva skjer hvis en Dalux-bruker ikke finnes i Catenda?
  - a) Sak opprettes uten tildeling?
  - b) Synk feiler for denne saken?
  - c) Bruker opprettes automatisk i Catenda?

**GDPR:** Anbefaler at OBF avklarer:
- Behandlingsgrunnlag for persondata-overføring
- Databehandleravtale mellom partene
- Rutiner for sletting ved prosjektslutt

---

## 5. Modeller

### OBF-behov
> - Catenda som master for modeller
> - Modellokasjonsinfo (koordinater) fra Dalux kobles til modell
> - Saker koblet til modell skal få identisk kobling

### Vurdering

| Krav | Status | Kommentar |
|------|--------|-----------|
| Catenda som modell-master | ✅ OK | Ingen konflikt |
| Koordinat-kobling | ⚠️ Delvis mulig | Dalux eksponerer XYZ, men transformasjon usikker |
| Sak → modell-kobling | 🔴 Vanskelig | Dalux gir kun objektnavn, ikke IFC GUID |

### Tekniske begrensninger

**Dalux API eksponerer:**
```
location:
  coordinate.xyz: { x, y, z }
  bimObject: { categoryName, name }
  building, level, room (referanser)
```

**Mangler for fullstendig kobling:**
- Ingen IFC GUID (kun objektnavn)
- Koordinatsystem er modellspesifikt
- Ingen viewpoint-data

### Anbefaling

Realistisk løsning: Synkroniser lokasjonsmeta som strukturert tekst i BCF topic description:

```markdown
## Lokasjon (fra Dalux)
- Bygning: Stovner skole - Bygg A
- Etasje: 2. etasje
- Rom: 2.034 Klasserom
- Koordinater: X=12.5, Y=34.2, Z=8.0
- BIM-objekt: Wall - Innervegg type 1
```

Automatisk viewpoint-kobling anbefales IKKE (for upålitelig uten IFC GUID).

---

## 6. Synkroniseringsfrekvens

### OBF-behov
> - Kontinuerlig synkronisering
> - Helst hvert 5. minutt
> - Minimum én gang daglig

### Vurdering

| Krav | Status | Kommentar |
|------|--------|-----------|
| Scheduler | 🔴 Ikke implementert | Kun manuell trigger |
| 5 min intervall | ⚠️ Aggressivt | Mulig API rate limits |
| Daglig minimum | ✅ Enkelt | Kan settes opp med cron/scheduler |

### Anbefaling

| Datatype | Anbefalt intervall | Begrunnelse |
|----------|-------------------|-------------|
| Saker/oppgaver | 15 min | Balanse mellom aktualitet og API-belastning |
| Dokumenter | 30-60 min | Større filer, mindre tidskritisk |

**Spørsmål til OBF:** Er 15 min akseptabelt for saker, eller er 5 min et absolutt krav?

---

## 7. Vedlikehold og feilhåndtering

### OBF-behov
> - Fleksibel ved API-endringer
> - Varsling ved synkroniseringsfeil
> - Detaljert feilinfo (hva, hvorfor, hva som ikke ble synket)
> - Info om retry-forsøk

### Vurdering

| Krav | Status | Kommentar |
|------|--------|-----------|
| Fleksibel arkitektur | ✅ OK | Modulær klient-design |
| Varsling | 🔴 Ikke implementert | Må utvikles |
| Feillogging | ✅ Implementert | Logger med detaljer |
| Retry-logikk | ✅ Implementert | Per task med backoff |

### Anbefaling

Varsling kan implementeres via:
- E-post ved kritiske feil
- Dashboard for synk-status
- Slack/Teams-integrasjon (valgfritt)

---

## Oppsummering

### Dekningsgrad per område

| Område | Implementert | Gap | Prioritet |
|--------|--------------|-----|-----------|
| Forutsetninger | 90% | RUH-avklaring | Lav |
| Dokumenter | 50% | Mappekonfig, task attachments krever utvidede API-rettigheter | **Høy** |
| Saker/oppgaver | 60% | Scheduler, ID-avklaring | **Høy** |
| Brukere/GDPR | 50% | GDPR-vurdering | Medium |
| Modeller | 20% | Kun metadata, ikke kobling | Lav |
| Synkfrekvens | 40% | Scheduler | **Høy** |
| Feilhåndtering | 60% | Varsling | Medium |

### Avklaringer påkrevd fra OBF

1. **RUH-saker:** Synkroniseres eller ekskluderes?
2. **ID-problemet:** Aksepteres at ID-er ikke er identiske?
3. **Manglende brukere:** Håndtering når Dalux-bruker ikke finnes i Catenda?
4. **Synkfrekvens:** Er 15 min akseptabelt, eller er 5 min absolutt krav?
5. **Egendefinerte felt:** Aksepteres at ukjente felt legges i description?
6. **Modellkobling:** Aksepteres metadata-løsning uten direkte viewpoint-kobling?
7. **Dalux API-rettigheter:** Kan API-nøkkelen få utvidede rettigheter for nedlasting av task attachments og lokasjonsbilder? (Styres av prosjekteier/entreprenør i Dalux Admin)

### Forutsetninger for produksjon

Før synkronisering kan aktiveres må følgende være på plass:

1. **Manuelt i Catenda:**
   - Bibliotek opprettet
   - Sakstyper/sakslister definert med ønskede felt
   - Topic board konfigurert

2. **Konfigurasjon:**
   - Mappemapping (Dalux → Catenda)
   - Oppgaveliste-mapping
   - API-nøkler for begge systemer

3. **Juridisk:**
   - GDPR-vurdering godkjent
   - Databehandleravtale på plass

---

## Referanser

- [Dalux-Catenda integrasjonsplan](dalux-catenda-integrasjonsplan.md)
- [Catenda Document API](https://developers.catenda.com/document-api)
- [Catenda BCF/Topic API](https://developers.catenda.com/bcf)
- Dalux API: `docs/Dalux-DaluxBuild-api-4.13-resolved.json`
