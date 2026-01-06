# Plan: Sekvensiell Godkjenning av Krav

## Bakgrunn

Byggherrens prosjektleder svarer på entreprenørens krav, men må få godkjenning oppover i organisasjonen før svaret formelt sendes. Godkjenningskjeden følger hierarkiet:

**Prosjektleder → Seksjonsleder → Avdelingsleder → Direktør utbygging → Administrerende direktør**

---

## Designprinsipp: Dokumentet i hånden

Løsningen skal være **så enkel som mulig** - som om godkjenneren får et fysisk dokument:

```
┌─────────────────────────────────────────────────────────────────┐
│  GODKJENNINGSDOKUMENT                                           │
│  Sak: KOE-20260106-001 – Forsinket tegningsunderlag             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  KRAV FRA ENTREPRENØR                                           │
│  Krevd beløp: 2.450.000 NOK                                     │
│  Krevd fristforlengelse: 14 dager                               │
│                                                                 │
│  PROSJEKTLEDERS VURDERING                                       │
│  Anbefalt godkjenning: 1.800.000 NOK + 10 dager                 │
│  Begrunnelse: [Prosjektleders tekst]                            │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  GODKJENNINGER                                                  │
│                                                                 │
│  ✓ Prosjektleder     Ola Nordmann      2026-01-06 09:15         │
│  ✓ Seksjonsleder     Kari Hansen       2026-01-06 11:30         │
│  ◯ Avdelingsleder    [Venter]                                   │
│  ◯ Direktør utb.     [Venter]                                   │
│  ◯ Adm. direktør     [Venter]                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

Godkjenner ser:
- **Hvem som har godkjent under** (med navn og tidspunkt)
- **Hvem som skal godkjenne over** (neste steg)
- **Dokumentet** med all relevant informasjon
- **To valg**: Godkjenn eller Avvis (med begrunnelse)

---

## Del 1: Autentisering med Entra ID

### Funksjoner

| Funksjon | Beskrivelse |
|----------|-------------|
| **Single Sign-On** | Brukere logger inn med Microsoft-konto |
| **Rolle fra grupper** | Azure AD-grupper bestemmer godkjenningsnivå |
| **Hierarki fra Graph** | Hente leder-kjede automatisk via Microsoft Graph |

### Entra ID gir oss automatisk

```
Microsoft Graph API: GET /users/{id}/manager

Bruker: ole.nordmann@byggherre.no
  └─ Manager: kari.hansen@byggherre.no (Seksjonsleder)
       └─ Manager: per.olsen@byggherre.no (Avdelingsleder)
            └─ Manager: anna.berg@byggherre.no (Direktør utbygging)
                 └─ Manager: erik.gran@byggherre.no (Adm. direktør)
```

### Hensyn

- **Tenant-oppsett**: Kunden må konfigurere App Registration i Azure
- **Graph-tilgang**: Krever `User.Read` og `User.Read.All` (for hierarki)
- **Fallback**: Magic link beholdes for eksterne (entreprenører)

---

## Del 2: Prosjektleder starter godkjenning

### Funksjoner

| Funksjon | Beskrivelse |
|----------|-------------|
| **Anbefalt kjede** | System foreslår kjede basert på beløp |
| **Justere kjede** | PL kan legge til/fjerne nivåer |
| **Velge personer** | PL kan velge spesifikk person på hvert nivå |
| **Starte kjede** | PL sender til første godkjenner (ofte seg selv) |

### Brukerflyt for prosjektleder

```
┌─────────────────────────────────────────────────────────────────┐
│  START GODKJENNING                                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Beløp: 2.450.000 NOK                                           │
│                                                                 │
│  ANBEFALT GODKJENNINGSKJEDE:                                    │
│                                                                 │
│  ☑ Prosjektleder      [Meg selv            ▼]                   │
│  ☑ Seksjonsleder      [Kari Hansen         ▼]  ← min leder      │
│  ☑ Avdelingsleder     [Per Olsen           ▼]                   │
│  ☐ Direktør utb.      [Anna Berg           ▼]  ← ikke påkrevd   │
│  ☐ Adm. direktør      [Erik Gran           ▼]  ← ikke påkrevd   │
│                                                                 │
│  [+ Legg til nivå]                                              │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│  ⚠ Beløp over 2 MNOK krever minimum avdelingsleder              │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│              [Avbryt]              [Start godkjenning]          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Regler for kjede-justering

| Regel | Beskrivelse |
|-------|-------------|
| **Minimumskrav** | PL kan ikke fjerne nivåer under beløpsgrensen |
| **Legge til** | PL kan alltid legge til flere nivåer |
| **Velge person** | Dropdown viser alle med riktig rolle |
| **Standard** | Systemet foreslår basert på leder-hierarki |

### Beløpsgrenser (konfigurerbare)

| Beløp | Minimum påkrevd |
|-------|-----------------|
| < 500.000 | Prosjektleder |
| 500.000 – 2.000.000 | + Seksjonsleder |
| 2.000.000 – 5.000.000 | + Avdelingsleder |
| 5.000.000 – 10.000.000 | + Direktør utbygging |
| > 10.000.000 | + Administrerende direktør |

---

## Del 3: Automatisk stedfortreder

### Prinsipp

Stedfortreder håndteres **automatisk** uten manuell konfigurasjon:

```
1. Godkjenner er fraværende (Outlook-kalender)
   → System finner stedfortreder automatisk

2. Godkjenner svarer ikke innen X dager
   → Påminnelse sendes
   → Etter Y dager: eskaler til overordnet

3. Godkjenner har sluttet (ikke i AD)
   → System velger annen på samme nivå
```

### Kilder for stedfortreder (prioritert rekkefølge)

| Kilde | Beskrivelse |
|-------|-------------|
| **1. Outlook-delegat** | Hvis bruker har satt delegat i Outlook |
| **2. Leder** | Overordnet kan alltid godkjenne "nedover" |
| **3. Samme rolle** | Annen person med samme AD-gruppe |

### Fraværsdeteksjon

```
Microsoft Graph API: GET /users/{id}/mailboxSettings

{
  "automaticRepliesSetting": {
    "status": "scheduled",
    "scheduledStartDateTime": "2026-01-10T00:00:00Z",
    "scheduledEndDateTime": "2026-01-20T00:00:00Z"
  }
}
```

Hvis godkjenner har aktivert "automatisk svar" i Outlook:
- Varsle stedfortreder i stedet
- Logg at stedfortreder ble brukt
- Original godkjenner informeres når tilbake

### Hensyn

- **Ingen manuell konfigurasjon**: Alt hentes fra Entra ID/Graph
- **Transparent**: Alle ser hvem som godkjente på vegne av hvem
- **Audit trail**: Logges med "Godkjent av X på vegne av Y"

---

## Del 4: Godkjennerens visning

### Enkel visning

Godkjenner får e-post med lenke. Klikker og ser:

```
┌─────────────────────────────────────────────────────────────────┐
│  VENTER PÅ DIN GODKJENNING                                      │
│  Sak: KOE-20260106-001                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  📄 [Last ned dokument (PDF)]                                   │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  TIDLIGERE GODKJENNINGER:                                       │
│  ✓ Prosjektleder    Ola Nordmann     06.01.2026 kl 09:15        │
│  ✓ Seksjonsleder    Kari Hansen      06.01.2026 kl 11:30        │
│                                                                 │
│  ➤ DIN GODKJENNING (Avdelingsleder)                             │
│                                                                 │
│  GJENSTÅENDE:                                                   │
│  ◯ Direktør utb.    Anna Berg                                   │
│  ◯ Adm. direktør    Erik Gran                                   │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  Kommentar (valgfritt):                                         │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                         │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│       [Avvis med begrunnelse]           [Godkjenn]              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### To handlinger

| Handling | Resultat |
|----------|----------|
| **Godkjenn** | Sendes til neste i kjeden (eller fullført) |
| **Avvis** | Returneres til prosjektleder med begrunnelse |

### Hensyn

- **Ingen app nødvendig**: Fungerer i nettleser
- **Mobilvennlig**: Enkel layout som fungerer på telefon
- **Rask handling**: Minimum klikk for å godkjenne

---

## Del 5: Varsling via e-post

### E-postmaler

**Ny sak venter på godkjenning:**
```
Emne: Godkjenning påkrevd: KOE-20260106-001 – Forsinket tegningsunderlag

Hei [Navn],

En sak venter på din godkjenning:

Sak: KOE-20260106-001
Type: Vederlagskrav + fristforlengelse
Beløp: 1.800.000 NOK
Dager: 10

Tidligere godkjent av:
• Ola Nordmann (Prosjektleder) – 06.01.2026

[Gå til godkjenning]

Med vennlig hilsen
KOE-systemet
```

**Påminnelse (etter 3 dager):**
```
Emne: Påminnelse: Godkjenning venter – KOE-20260106-001

Hei [Navn],

Saken under venter fortsatt på din godkjenning.
Den ble sendt til deg for 3 dager siden.

[Gå til godkjenning]
```

**Sak avvist:**
```
Emne: Sak avvist: KOE-20260106-001

Hei [Prosjektleder],

Saken ble avvist av [Navn] (Avdelingsleder).

Begrunnelse:
"Mangler dokumentasjon på faktiske merkostnader."

Du kan revidere og sende på ny godkjenning.

[Gå til saken]
```

### Teknisk: Microsoft Graph API

E-post sendes via samme Graph API som brukes for autentisering og hierarki:

```
POST https://graph.microsoft.com/v1.0/users/{sender-id}/sendMail

{
  "message": {
    "subject": "Godkjenning påkrevd: KOE-20260106-001",
    "body": {
      "contentType": "HTML",
      "content": "<p>Hei Kari,</p><p>En sak venter på din godkjenning...</p>"
    },
    "toRecipients": [
      { "emailAddress": { "address": "kari.hansen@byggherre.no" } }
    ]
  }
}
```

**Fordeler med Graph API:**
- Samme autentisering som resten av løsningen
- Ingen ekstra tjenester eller kostnader
- E-post sendes fra organisasjonens domene
- Støtter HTML-formatering og vedlegg

**Påkrevd tillatelse:**
- `Mail.Send` (applikasjonstillatelse)
- Krever admin-samtykke i Azure AD

**Avsender:**
- Dedikert postboks: `koe-system@byggherre.no`
- Eller: `noreply@byggherre.no`

### Hensyn

- **Kun e-post**: Ingen Teams, push, etc.
- **Klare lenker**: Ett klikk til handling
- **Ikke for mange**: Maks én påminnelse
- **Rate limits**: Graph API har grenser (10.000/dag per postboks)

---

## Del 6: Dokumentgenerering

### Innhold i godkjenningsdokument (PDF)

| Seksjon | Innhold |
|---------|---------|
| **Header** | Saksnummer, dato, prosjekt |
| **Krav fra TE** | Beskrivelse, beløp, dager, vedlegg |
| **PLs vurdering** | Anbefaling, begrunnelse, risikovurdering |
| **Godkjenningsstatus** | Hvem har godkjent, hvem gjenstår |
| **Vedlegg** | Lenker til originalvedlegg |

### Hensyn

- **Låst dokument**: Innholdet endres ikke etter oppstart
- **Oppdatert status**: Signaturseksjonen oppdateres ved hver godkjenning
- **PDF/A**: Arkivbestandig format

---

## Del 7: Flyt ved avvisning

### Når noen avviser

```
Godkjenner avviser
       │
       ▼
┌──────────────────┐
│ Hele kjeden      │
│ stopper          │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Prosjektleder    │
│ varsles          │
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────────────────────────┐
│ PL kan:                                          │
│ • Revidere vurdering og starte ny kjede          │
│ • Endre anbefalt beløp/dager                     │
│ • Legge til mer dokumentasjon                    │
│ • Avbryte saken                                  │
└──────────────────────────────────────────────────┘
```

### Hensyn

- **Historikk bevares**: Tidligere forsøk er synlige
- **Ny kjede**: Starter fra bunn igjen
- **Læringseffekt**: Avvisningsgrunner hjelper PL neste gang

---

## Del 8: Etter fullført godkjenning

### Når siste person godkjenner

```
Siste godkjenner trykker "Godkjenn"
       │
       ▼
┌──────────────────┐
│ Godkjenning      │
│ fullført         │
└────────┬─────────┘
         │
         ├──► E-post til prosjektleder: "Sak godkjent"
         │
         ├──► Saken markeres som "klar for formelt svar"
         │
         └──► Prosjektleder kan nå sende formelt svar til TE
```

### Hensyn

- **Ikke automatisk svar til TE**: PL må aktivt sende svaret
- **Sporbarhet**: Godkjenningskjede lagres permanent
- **Arkivering**: Ferdig dokument med alle signaturer arkiveres

---

## Del 9: Integrasjon med eksisterende system

### Event-basert arkitektur (beholdes)

Godkjenning legges til som nye event-typer:

| Event | Beskrivelse |
|-------|-------------|
| `GODKJENNING_STARTET` | PL starter kjede |
| `GODKJENNING_GITT` | Ett nivå godkjenner |
| `GODKJENNING_AVVIST` | Ett nivå avviser |
| `GODKJENNING_FULLFORT` | Alle har godkjent |

### Kobling til ResponsEvent

```
Eksisterende flyt:
  TE sender krav → PL lager ResponsEvent (utkast)

Ny flyt:
  TE sender krav → PL lager ResponsEvent (utkast)
                 → PL starter godkjenningskjede
                 → Kjede fullføres
                 → ResponsEvent aktiveres og sendes til TE
```

---

## Del 10: Implementasjonsrekkefølge

### Fase 1: Kjernefunksjonalitet
1. Entra ID-innlogging
2. Hente leder-hierarki fra Graph
3. PL starter kjede med anbefalt flyt
4. Godkjenner-visning med godkjenn/avvis
5. E-postvarsling

### Fase 2: Automatikk
1. Automatisk stedfortreder ved fravær
2. Påminnelse etter X dager
3. Dokumentgenerering (PDF)

### Fase 3: Polering
1. Konfigurerbare beløpsgrenser
2. Historikk og sporbarhet
3. Arkivering

---

## Del 11: Microsoft Graph API - Samlet oversikt

### Endepunkter som brukes

| Funksjon | Graph API-endepunkt | Beskrivelse |
|----------|---------------------|-------------|
| **Autentisering** | OAuth 2.0 / OIDC | SSO via Entra ID |
| **Brukerinfo** | `GET /me` | Hente innlogget brukers profil |
| **Leder-hierarki** | `GET /users/{id}/manager` | Hente brukerens leder (rekursivt) |
| **Rolle/grupper** | `GET /me/memberOf` | Hente AD-grupper for rolle-mapping |
| **Fravær** | `GET /users/{id}/mailboxSettings` | Sjekke automatisk svar (ferie) |
| **Send e-post** | `POST /users/{id}/sendMail` | Sende varsler og påminnelser |

### Påkrevde tillatelser (App Registration)

| Tillatelse | Type | Brukes til |
|------------|------|------------|
| `User.Read` | Delegert | Lese egen profil |
| `User.Read.All` | Applikasjon | Lese alle brukere (hierarki) |
| `Mail.Send` | Applikasjon | Sende e-post |
| `MailboxSettings.Read` | Applikasjon | Lese fraværsstatus |
| `GroupMember.Read.All` | Applikasjon | Lese gruppemedlemskap |

### Azure AD-konfigurasjon

```
App Registration:
├── Navn: KOE-Godkjenningssystem
├── Redirect URI: https://koe.byggherre.no/auth/callback
├── Client ID: [genereres]
├── Client Secret: [genereres, lagres sikkert]
└── API Permissions:
    ├── Microsoft Graph
    │   ├── User.Read (Delegated)
    │   ├── User.Read.All (Application) ← Krever admin-samtykke
    │   ├── Mail.Send (Application) ← Krever admin-samtykke
    │   ├── MailboxSettings.Read (Application)
    │   └── GroupMember.Read.All (Application)
    └── Admin consent: Required
```

---

## Oppsummering

| Aspekt | Løsning |
|--------|---------|
| **Autentisering** | Entra ID (SSO) |
| **Hierarki** | Automatisk fra Microsoft Graph |
| **Stedfortreder** | Automatisk fra Outlook-fravær + leder |
| **PL-kontroll** | Kan justere anbefalt kjede |
| **Godkjenner** | Ser dokument + signaturer + to knapper |
| **Varsling** | Kun e-post |
| **Kompleksitet** | Minimal – som et dokument i hånden |
