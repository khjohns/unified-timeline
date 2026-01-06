# Plan: Sekvensiell Godkjenning av Krav

## Bakgrunn

Byggherrens prosjektleder svarer på entreprenørens krav, men må få godkjenning oppover i organisasjonen før svaret formelt sendes. Godkjenningskjeden følger hierarkiet:

**Prosjektleder → Seksjonsleder → Avdelingsleder → Direktør utbygging → Administrerende direktør**

---

## Del 1: Brukerautentisering med Entra ID

### 1.1 Funksjoner

| Funksjon | Beskrivelse |
|----------|-------------|
| **Single Sign-On (SSO)** | Brukere logger inn med eksisterende Microsoft-konto |
| **Rolle-mapping** | Azure AD-grupper mappes til systemroller (PL, SL, AL, DU, AD) |
| **Hierarki-oppslag** | Hente brukerens leder fra Microsoft Graph API |
| **Token-validering** | Validere JWT-tokens fra Entra ID |
| **Sesjonshåndtering** | Opprettholde brukerøkt med refresh tokens |

### 1.2 Hensyn

- **Tenant-konfigurasjon**: Må konfigureres i kundens Azure AD
- **Samtykke (consent)**: Admin-samtykke kreves for Graph API-tilgang
- **Fallback**: Beholde magic link som alternativ for eksterne brukere (TE)
- **MFA**: Støtte for multifaktor-autentisering via Entra ID
- **Personvern**: Kun hente nødvendige brukerdata (navn, e-post, rolle)

### 1.3 Azure AD-grupper (forslag)

```
KOE-Prosjektledere        → GodkjenningsNivaa.PROSJEKTLEDER
KOE-Seksjonsledere        → GodkjenningsNivaa.SEKSJONSLEDER
KOE-Avdelingsledere       → GodkjenningsNivaa.AVDELINGSLEDER
KOE-DirektorUtbygging     → GodkjenningsNivaa.DIREKTOR_UTBYGGING
KOE-AdminDirector         → GodkjenningsNivaa.ADMINISTRERENDE_DIREKTOR
```

---

## Del 2: Godkjenningskjede-logikk

### 2.1 Funksjoner

| Funksjon | Beskrivelse |
|----------|-------------|
| **Automatisk kjede-beregning** | Bestem påkrevd kjede basert på beløp, type eller risiko |
| **Sekvensiell flyt** | Kun én godkjenner aktiv om gangen |
| **Stopp ved avvisning** | Hele kjeden stopper hvis noen avviser |
| **Retur til initiator** | Ved avvisning returneres saken til prosjektleder |
| **Re-innsending** | Prosjektleder kan revidere og starte ny kjede |
| **Parallell godkjenning** | Valgfritt: flere på samme nivå (f.eks. to avdelingsledere) |

### 2.2 Beløpsgrenser (eksempel)

| Beløp (NOK) | Påkrevd godkjenningskjede |
|-------------|---------------------------|
| 0 – 500.000 | Prosjektleder |
| 500.001 – 2.000.000 | Prosjektleder → Seksjonsleder |
| 2.000.001 – 5.000.000 | Prosjektleder → Seksjonsleder → Avdelingsleder |
| 5.000.001 – 10.000.000 | PL → SL → AL → Direktør utbygging |
| > 10.000.000 | PL → SL → AL → DU → Administrerende direktør |

### 2.3 Andre triggere for utvidet kjede

- **Preklusjonssaker**: Alltid til avdelingsleder+
- **Prinsipiell betydning**: Manuell eskalering til direktør
- **Forsering**: Alltid til direktør utbygging+
- **Første gang (presedens)**: Ny type krav → høyere nivå

### 2.4 Hensyn

- **Konfigurerbarhet**: Beløpsgrenser må kunne justeres per prosjekt
- **Unntak**: Enkelte sakstyper kan ha egne regler
- **Habilitet**: Sjekk at godkjenner ikke er inhabil (f.eks. selv initiator)
- **Versjonering**: Kjede-regler må versjoneres for etterprøvbarhet

---

## Del 3: Dokumenthåndtering

### 3.1 Funksjoner

| Funksjon | Beskrivelse |
|----------|-------------|
| **Automatisk dokumentgenerering** | Generer PDF med kravdetaljer og foreslått svar |
| **Dokumentlåsing** | Dokumentet låses når kjeden starter |
| **Hash-validering** | SHA-256 hash sikrer at dokumentet ikke endres |
| **Vedlegg** | Støtte for vedlegg fra original krav |
| **Revisjonshistorikk** | Ved re-innsending: nytt dokument med endringsmarkering |

### 3.2 Dokumentinnhold

```
┌─────────────────────────────────────────────────────────┐
│  GODKJENNINGSDOKUMENT                                   │
│  Sak: KOE-20260106-001                                  │
├─────────────────────────────────────────────────────────┤
│  SAMMENDRAG                                             │
│  • Kravtype: Vederlagskrav                              │
│  • Entreprenør: [Navn]                                  │
│  • Krevd beløp: 2.450.000 NOK                           │
│  • Foreslått godkjenning: 1.800.000 NOK                 │
│                                                         │
│  VURDERING                                              │
│  • Grunnlag: [Prosjektleders vurdering]                 │
│  • Dokumentasjon: [Vedlagt/mangler]                     │
│  • Risiko: [Lav/Middels/Høy]                            │
│                                                         │
│  PÅKREVD GODKJENNING                                    │
│  ☐ Prosjektleder                                        │
│  ☐ Seksjonsleder                                        │
│  ☐ Avdelingsleder                                       │
│                                                         │
│  VEDLEGG                                                │
│  • Entreprenørens krav (PDF)                            │
│  • Fremdriftsplan                                       │
│  • Kostnadsberegning                                    │
└─────────────────────────────────────────────────────────┘
```

### 3.3 Hensyn

- **Arkivering**: Dokumenter må arkiveres iht. arkivloven
- **Tilgjengelighet**: PDF/A-format for langtidslagring
- **Størrelse**: Begrense vedleggsstørrelse (f.eks. maks 50 MB totalt)
- **Konfidensialitet**: Dokumenter må ikke lekke utenfor organisasjonen

---

## Del 4: Varsling og påminnelser

### 4.1 Funksjoner

| Funksjon | Beskrivelse |
|----------|-------------|
| **E-postvarsling** | Varsel når sak venter på godkjenning |
| **Teams-integrasjon** | Valgfritt: varsel i Microsoft Teams |
| **Påminnelser** | Automatisk påminnelse etter X dager |
| **Eskalering** | Varsle overordnet hvis frist nærmer seg |
| **Mobilvarsel** | Push-notifikasjoner til app |
| **Daglig oppsummering** | Samleoversikt over ventende saker |

### 4.2 Varslingsflyt

```
Dag 0:  Sak sendt til godkjenning → E-post + Teams-melding
Dag 3:  Ingen respons → Påminnelse
Dag 5:  Ingen respons → Påminnelse + kopi til overordnet
Dag 7:  Frist utløper → Eskalering til neste nivå
```

### 4.3 Hensyn

- **Varslingstretthet**: Ikke for mange varsler
- **Arbeidstid**: Varsler kun i arbeidstiden (08-16)
- **Ferie/fravær**: Respektere Outlook-kalender for fravær
- **Språk**: Varsler på norsk
- **Avmelding**: Mulighet for å endre varslingsfrekvens

---

## Del 5: Stedfortreder og delegering

### 5.1 Funksjoner

| Funksjon | Beskrivelse |
|----------|-------------|
| **Stedfortreder-registrering** | Angi hvem som kan godkjenne på dine vegne |
| **Automatisk delegering** | Ved fravær (fra Outlook) → automatisk til stedfortreder |
| **Tidsbegrenset delegering** | Delegering med start- og sluttdato |
| **Delegerings-audit** | Logg over hvem som godkjente på vegne av hvem |
| **Godkjenning fra overordnet** | Overordnet kan alltid godkjenne "nedover" |

### 5.2 Hensyn

- **Kjede av stedfortredere**: Maks 2 ledd (unngå kompleksitet)
- **Samme nivå**: Stedfortreder må ha samme eller høyere rolle
- **Varsling**: Original godkjenner varsles når stedfortreder handler
- **Tilbakekalling**: Kunne trekke tilbake delegering umiddelbart

---

## Del 6: Brukergrensesnitt

### 6.1 Visninger

| Visning | Beskrivelse |
|---------|-------------|
| **Mine godkjenninger** | Liste over saker som venter på min godkjenning |
| **Godkjenningshistorikk** | Oversikt over saker jeg har behandlet |
| **Kjede-status** | Visuell fremstilling av hvor i kjeden saken er |
| **Sak-detaljer** | Full visning av krav, dokumenter og vurdering |
| **Dashboard** | Aggregert oversikt (antall ventende, gjennomsnittlig tid, etc.) |

### 6.2 Handlinger

| Handling | Beskrivelse |
|----------|-------------|
| **Godkjenn** | Godkjenn og send til neste i kjeden |
| **Godkjenn med kommentar** | Godkjenn med merknad |
| **Avvis** | Avvis med begrunnelse (returnerer til PL) |
| **Be om mer info** | Sett på hold, be PL om tilleggsinformasjon |
| **Eskaler** | Manuelt sende til høyere nivå |
| **Deleger** | Sende til stedfortreder |

### 6.3 Hensyn

- **Mobilvennlig**: Må fungere på telefon (godkjenning på farten)
- **Tastaturnavigasjon**: Effektiv behandling med hurtigtaster
- **Tilgjengelighet**: WCAG 2.1 AA
- **Offline**: Vise saker offline, synkronisere når online

---

## Del 7: Rapportering og analyse

### 7.1 Funksjoner

| Funksjon | Beskrivelse |
|----------|-------------|
| **Behandlingstid** | Gjennomsnittlig tid per nivå og totalt |
| **Flaskehalser** | Identifisere hvor saker stopper opp |
| **Godkjenningsrate** | Andel godkjent vs. avvist |
| **Beløpsstatistikk** | Totalt godkjent beløp per periode |
| **Brukerstatistikk** | Antall saker behandlet per person |
| **Trend-analyse** | Utvikling over tid |

### 7.2 Hensyn

- **Personvern**: Aggregerte data, ikke individovervåking
- **Eksport**: Mulighet for eksport til Excel/Power BI
- **Tilgangsstyring**: Kun ledere ser rapporter for sin enhet

---

## Del 8: Integrasjoner

### 8.1 Eksisterende integrasjoner (beholdes)

| System | Integrasjon |
|--------|-------------|
| **Catenda** | Synkronisering av krav og kommentarer |
| **PDF-generering** | Dokumentgenerering |
| **Magic Link** | Autentisering for eksterne (TE) |

### 8.2 Nye integrasjoner

| System | Integrasjon |
|--------|-------------|
| **Microsoft Entra ID** | SSO, roller, hierarki |
| **Microsoft Graph** | Kalender (fravær), e-post, Teams |
| **SharePoint/OneDrive** | Dokumentlagring og arkivering |
| **Power Automate** | Valgfritt: egendefinerte workflows |
| **ERP-system** | Valgfritt: automatisk bokføring av godkjente beløp |

### 8.3 Hensyn

- **API-grenser**: Microsoft Graph har rate limits
- **Feilhåndtering**: Graceful degradation hvis integrasjon er nede
- **Synkronisering**: Håndtere konflikter mellom systemer

---

## Del 9: Sikkerhet og compliance

### 9.1 Funksjoner

| Funksjon | Beskrivelse |
|----------|-------------|
| **Audit log** | Komplett logg over alle handlinger |
| **Uavviselighet** | Kan ikke benekte at man har godkjent |
| **Tidsstempel** | Kryptografisk sikre tidsstempler |
| **Tilgangskontroll** | Kun se saker man har tilgang til |
| **Dataminimering** | Kun lagre nødvendige data |

### 9.2 Hensyn

- **GDPR**: Personopplysninger må håndteres korrekt
- **Arkivloven**: Dokumenter må arkiveres i påkrevd tid
- **Internkontroll**: Støtte revisjonsrapporter
- **Logging**: Alle godkjenninger logges med hvem, når, hva
- **Backup**: Regelmessig backup av alle data

---

## Del 10: Implementasjonsrekkefølge

### Fase 1: Grunnleggende godkjenningsflyt (MVP)
1. Entra ID-innlogging (SSO)
2. Rolle-mapping fra Azure AD-grupper
3. Enkel sekvensiell godkjenningskjede (hardkodet nivåer)
4. E-postvarsling ved ny sak
5. Grunnleggende UI for godkjenning

### Fase 2: Dokumenthåndtering
1. Automatisk PDF-generering
2. Dokumentlåsing og hash-validering
3. Vedleggshåndtering
4. Arkivering

### Fase 3: Avansert flyt
1. Konfigurerbare beløpsgrenser
2. Stedfortreder og delegering
3. Påminnelser og eskalering
4. Teams-integrasjon

### Fase 4: Rapportering og optimalisering
1. Dashboard og statistikk
2. Behandlingstidsrapporter
3. Flaskehals-analyse
4. Mobil-optimalisering

---

## Del 11: Tekniske avhengigheter

### Backend
- **msal** - Microsoft Authentication Library for Python
- **httpx** - For Microsoft Graph API-kall
- **weasyprint** eller **reportlab** - PDF-generering
- **apscheduler** - Planlagte oppgaver (påminnelser)

### Frontend
- **@azure/msal-react** - Entra ID i React
- **react-pdf** - PDF-visning

### Infrastruktur
- **Azure App Registration** - Konfigurert i kundens tenant
- **Microsoft Graph API-tilgang** - User.Read, Mail.Send, Calendars.Read
- **SMTP/SendGrid** - E-postutsending (alternativ til Graph)

---

## Del 12: Åpne spørsmål

| # | Spørsmål | Påvirker |
|---|----------|----------|
| 1 | Skal beløpsgrenser være per prosjekt eller globalt? | Konfigurasjon |
| 2 | Hva skjer hvis en godkjenner slutter? | Stedfortreder-logikk |
| 3 | Skal TE se godkjenningsstatus underveis? | UI, tilgangskontroll |
| 4 | Kreves elektronisk signatur (kvalifisert)? | Integrasjon, compliance |
| 5 | Skal godkjenning kunne gjøres i Teams direkte? | Teams-bot |
| 6 | Hvordan håndtere hastesaker (bypass)? | Spesialflyt |
| 7 | Integrasjon mot eksisterende ERP? | Fase 4+ |

---

## Oppsummering

Løsningen bygger på eksisterende event sourcing-arkitektur og legger til:

1. **Entra ID** for sikker autentisering og rollebasert tilgang
2. **Sekvensiell godkjenningskjede** som respekterer organisasjonshierarkiet
3. **Automatisk dokumentgenerering** med integritetssikring
4. **Varsling og påminnelser** for effektiv saksbehandling
5. **Stedfortreder-funksjonalitet** for å unngå flaskehalser
6. **Full audit trail** for compliance og etterprøvbarhet

Løsningen er **skalerbar** (flere nivåer kan legges til), **konfigurerbar** (beløpsgrenser, tidsfrister) og **integrerbar** med eksisterende Microsoft 365-infrastruktur.
