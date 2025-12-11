# Sikkerhetsarkitektur - Unified Timeline

Dette dokumentet beskriver sikkerhetsarkitekturen for Unified Timeline-applikasjonen.

## Innhold
1. [Nåværende løsning (Prototype/Utvikling)](#nåværende-løsning-prototypeutvikling)
2. [Produksjonsløsning (Planlagt)](#produksjonsløsning-planlagt)
3. [Ordliste og forkortelser](#ordliste-og-forkortelser)
4. [Gap-analyse](#gap-analyse)

---

## Nåværende løsning (Prototype/Utvikling)

Nåværende implementasjon er en utviklingsprototype med grunnleggende sikkerhetsprinsipper på plass, men med forenklede lagringsmekanismer egnet for lokal utvikling.

```
┌────────────────────────────────────────────────────────────┐
│  Lag 5: Observerbarhet                                     │
│  - Audit-logging (JSON Lines → audit.log)                  │
│  - Applikasjonslogging (koe_automation.log)                │
│  - Hendelsestyper: auth, access, modify, webhook, security │
│  - IP-sporing via X-Forwarded-For / X-Real-IP              │
└────────────────────────────────────────────────────────────┘
         ▲
         │ Logger alle hendelser
         │
┌────────────────────────────────────────────────────────────┐
│  Lag 4: Data                                               │
│  - Event Sourcing (immutabel hendelseslogg)                │
│  - Optimistisk låsing (versjonskontroll)                   │
│  - JSON-filbasert lagring (koe_data/)                      │
│  - Fil-lås via fcntl (Unix/Linux)                          │
│  - Ingen kryptering ved hvile (plaintext JSON)             │
└────────────────────────────────────────────────────────────┘
         ▲
         │ Versjonskontrollert tilgang
         │
┌────────────────────────────────────────────────────────────┐
│  Lag 3: Autorisasjon                                       │
│  - Rollebasert tilgang (TE vs BH via Catenda API)          │
│  - Felt-nivå tilgangskontroll (BH-only, TE-locked)         │
│  - Prosjekt-scope isolasjon (catenda_project_id)           │
│  - Business rule validering                                │
│  - Tilstandskontroll (status-baserte restriksjoner)        │
└────────────────────────────────────────────────────────────┘
         ▲
         │ Autorisert forespørsel
         │
┌────────────────────────────────────────────────────────────┐
│  Lag 2: Autentisering                                      │
│  - Magic Link (UUID v4, 72t TTL)                           │
│  - CSRF-tokens (HMAC-SHA256, 1t TTL)                       │
│  - Catenda OAuth (for rollebestemmelse)                    │
│  - Bearer token i Authorization-header                     │
│  - Token-lagring: JSON-fil (koe_data/magic_links.json)     │
└────────────────────────────────────────────────────────────┘
         ▲
         │ Autentisert bruker
         │
┌────────────────────────────────────────────────────────────┐
│  Lag 1: Nettverk/Transport                                 │
│  - CORS (localhost:3000, 127.0.0.1:3000, ngrok)            │
│  - Rate Limiting (in-memory):                              │
│    • Submissions: 10/min                                   │
│    • Webhooks: 100/min                                     │
│    • Default: 2000/dag, 500/time                           │
│  - HTTPS via ngrok (utviklingsmiljø)                       │
│  - Ingen WAF eller DDoS-beskyttelse                        │
└────────────────────────────────────────────────────────────┘
         ▲
         │ HTTP(S) trafikk
         │
    [Utvikler / Testbruker]


┌────────────────────────────────────────────────────────────┐
│  Webhook-sikkerhet (separat flyt)                          │
│  - Secret URL path (/webhook/catenda/{SECRET})             │
│  - Idempotens-sjekk (in-memory Set, 24t TTL)               │
│  - Event-type whitelist (issue.created, .modified, etc.)   │
│  - JSON-strukturvalidering                                 │
└────────────────────────────────────────────────────────────┘
         ▲
         │ Webhook POST
         │
    [Catenda Platform]


┌────────────────────────────────────────────────────────────┐
│  Input-validering (tverrgående)                            │
│  - UUID-validering (format, path traversal blokkering)     │
│  - CSV-injeksjonsbeskyttelse (blokkerer =, +, -, @)        │
│  - E-post format validering                                │
│  - Status-whitelist (BCF og interne statuser)              │
│  - Dato-format validering (YYYY-MM-DD)                     │
│  - Tall-validering (positive, range)                       │
└────────────────────────────────────────────────────────────┘
```

### Implementasjonsdetaljer - Nåværende løsning

| Komponent | Fil | Beskrivelse |
|-----------|-----|-------------|
| Magic Link | `backend/lib/auth/magic_link.py` | UUID-baserte lenker med fil-persistens |
| CSRF | `backend/lib/auth/csrf_protection.py` | HMAC-signerte tokens med TTL |
| Catenda Auth | `backend/integrations/catenda/auth.py` | OAuth-integrasjon for roller |
| Validering | `backend/lib/security/validation.py` | Input-validatorer |
| Rate Limiting | `backend/lib/security/rate_limiter.py` | Flask-Limiter wrapper |
| Webhook | `backend/lib/security/webhook_security.py` | Secret path + idempotens |
| Audit | `backend/lib/monitoring/audit.py` | JSON Lines logging |
| CORS | `backend/core/cors_config.py` | Tillatte origins |
| Events | `backend/repositories/event_repository.py` | Optimistisk låsing |

---

## Produksjonsløsning (Planlagt)

Produksjonsarkitekturen bygger på **Defense in Depth** med flere sikkerhetslag.

### Risikovurdering

| Risiko | Mitigering |
|--------|------------|
| **Deling av lenker til frontend** | One-time tokens, kort TTL (72t), JIT-sjekk mot Catenda prosjektmedlemsliste, Step Up ved behov (e-post validering) |
| **Webhook-spoofing** | Secret URL path validering, idempotens-sjekk |

### Produksjonsarkitektur

```
┌────────────────────────────────────────────────────────────┐
│  Lag 5: Observerbarhet                                     │
│  - Application Insights (structured logging)               │
│  - Azure Monitor Alerts (mistenkelig aktivitet)            │
│  - KQL-queries for sikkerhetshendelser                     │
└────────────────────────────────────────────────────────────┘
         ▲
         │ Logg alle hendelser
         │
┌────────────────────────────────────────────────────────────┐
│  Lag 4: Data                                               │
│  - Dataverse Row-Level Security (RLS)                      │
│  - Managed Identity (ingen credentials i kode)             │
│  - Encryption at rest (AES-256)                            │
└────────────────────────────────────────────────────────────┘
         ▲
         │ Sikker tilgang
         │
┌────────────────────────────────────────────────────────────┐
│  Lag 3: Autorisasjon                                       │
│  - Gatekeeper (Azure Functions)                            │
│  - UUID-validering (format, eksistens)                     │
│  - TTL-kontroll (utløpt?)                                  │
│  - Prosjekt-scope (riktig prosjekt?)                       │
│  - Rolle-basert felttilgang (TE vs BH)                     │
│  - Tilstandskontroll (riktig status?)                      │
└────────────────────────────────────────────────────────────┘
         ▲
         │ Validert forespørsel
         │
┌────────────────────────────────────────────────────────────┐
│  Lag 2: Autentisering                                      │
│  - Magic Link (UUID v4)                                    │
│  - Entra ID (SSO + MFA for interne)                        │
│  - Catenda (invitation-only for eksterne)                  │
│  - OTP step-up (for KOE-signering)                         │
└────────────────────────────────────────────────────────────┘
         ▲
         │ Autentisert bruker
         │
┌────────────────────────────────────────────────────────────┐
│  Lag 1: Nettverk                                           │
│  - Azure Front Door + WAF                                  │
│  - DDoS Protection                                         │
│  - Rate Limiting (100 req/min per IP)                      │
│  - TLS 1.3 (encrypted transport)                           │
└────────────────────────────────────────────────────────────┘
         ▲
         │ Filtrert trafikk
         │
    [Internet]
```

---

## Gap-analyse: Prototype → Produksjon

### Kritisk (må fikses før produksjon)

| Gap | Nåværende | Produksjon |
|-----|-----------|------------|
| Token-lagring | Plaintext JSON-filer | Database med kryptering |
| Magic Link TTL | 72 timer, gjenbrukbar | 24 timer, single-use |
| CSRF Secret | Dev default hvis ikke satt | Påkrevd env-variabel |
| Rate Limiting | In-memory | Redis-backend |
| Fil-låsing | fcntl (kun Unix) | Database-transaksjoner |
| TLS | Kun via ngrok | Azure Front Door + HSTS |
| WAF | Ingen | Azure WAF |
| DDoS | Ingen | Azure DDoS Protection |

### Høy prioritet

| Gap | Nåværende | Produksjon |
|-----|-----------|------------|
| Logging | Lokal fil | Application Insights |
| Secrets | Env-variabler (plaintext) | Azure Key Vault |
| Autentisering | Kun Magic Link | + Entra ID SSO + MFA |
| Kryptering | Ingen | AES-256 at rest |
| RLS | Applikasjonsnivå | Dataverse RLS |

### Medium prioritet

| Gap | Nåværende | Produksjon |
|-----|-----------|------------|
| Access logs | Ikke indeksert | Azure Monitor / ELK |
| Felt-kryptering | Ingen | Kryptert PII |
| Nøkkelrotasjon | Ingen mekanisme | Automatisk rotasjon |
| IP-whitelist | Kun CORS | Webhook IP-allowlist |

---

## Ordliste og forkortelser

### Sikkerhetsbegreper

| Begrep | Forklaring |
|--------|------------|
| **Defense in Depth** | Sikkerhetsstrategi med flere overlappende lag, slik at svikt i ett lag ikke kompromitterer hele systemet |
| **TTL** | Time To Live - hvor lenge et token eller data er gyldig |
| **JIT** | Just In Time - validering som skjer på forespørselstidspunktet |
| **Step Up Authentication** | Krever ekstra autentisering for sensitive operasjoner |
| **Idempotens** | En operasjon som gir samme resultat uansett hvor mange ganger den utføres |
| **HMAC** | Hash-based Message Authentication Code - kryptografisk signatur |
| **CSRF** | Cross-Site Request Forgery - angrep der ondsinnet nettside sender forespørsler på vegne av innlogget bruker |
| **XSS** | Cross-Site Scripting - angrep der ondsinnet kode injiseres i nettsider |
| **WAF** | Web Application Firewall - filter som blokkerer ondsinnede HTTP-forespørsler |
| **DDoS** | Distributed Denial of Service - angrep som overbelaster tjenester |
| **RLS** | Row-Level Security - tilgangskontroll på radnivå i database |
| **SSO** | Single Sign-On - én innlogging gir tilgang til flere systemer |
| **MFA** | Multi-Factor Authentication - autentisering med flere faktorer |
| **OTP** | One-Time Password - engangskode (f.eks. via SMS eller app) |
| **HSTS** | HTTP Strict Transport Security - tvinger HTTPS |
| **AES-256** | Advanced Encryption Standard med 256-bit nøkkel |

### Teknologi og plattformer

| Begrep | Forklaring |
|--------|------------|
| **Entra ID** | Microsoft Entra ID (tidligere Azure AD) - identitets- og tilgangsstyring |
| **Catenda** | Prosjekthotell/BIM-plattform for byggebransjen |
| **Dataverse** | Microsoft Dataverse - lavkode dataplattform |
| **Azure Front Door** | Microsoft Azure CDN og lastbalanserer med WAF |
| **Application Insights** | Azure-tjeneste for applikasjonsovervåking |
| **KQL** | Kusto Query Language - spørrespråk for Azure Monitor |
| **Azure Key Vault** | Azure-tjeneste for sikker lagring av hemmeligheter |

### Roller

| Rolle | Forklaring |
|-------|------------|
| **TE** | Teknisk Entreprenør - utfører byggearbeid |
| **BH** | Byggherre - oppdragsgiver/eier av prosjektet |
| **KOE** | Krav om endring - formell endringshåndtering i NS 8407 |

### Protokoller og standarder

| Begrep | Forklaring |
|--------|------------|
| **OAuth** | Open Authorization - protokoll for delegert tilgang |
| **Bearer token** | Tilgangstoken som sendes i Authorization-header |
| **UUID v4** | Universally Unique Identifier versjon 4 - tilfeldig generert 128-bit ID |
| **TLS 1.3** | Transport Layer Security versjon 1.3 - kryptert kommunikasjon |
| **BCF** | BIM Collaboration Format - åpen standard for problemsporing i BIM |
| **JSON Lines** | Format med ett JSON-objekt per linje |
| **CORS** | Cross-Origin Resource Sharing - kontrollerer tilgang på tvers av domener |

### Filstier i kodebasen

| Sti | Innhold |
|-----|---------|
| `backend/lib/auth/` | Autentiseringsmoduler |
| `backend/lib/security/` | Sikkerhetsmoduler (validering, rate limiting, webhook) |
| `backend/lib/monitoring/` | Logging og overvåking |
| `backend/integrations/catenda/` | Catenda-integrasjon |
| `backend/repositories/` | Datalagring med event sourcing |
| `koe_data/` | Persistens for tokens og events (utvikling) |

---

## Sikkerhetstester

Eksisterende tester i `backend/tests/test_security/`:

| Test | Dekker |
|------|--------|
| `test_csrf.py` | CSRF-token generering og validering |
| `test_magic_link_decorator.py` | Magic link autentisering |
| `test_validation.py` | Input-validering (UUID, CSV, e-post, etc.) |
| `test_webhook.py` | Webhook-validering og idempotens |

---

## Anbefalinger for videre utvikling

1. **Før MVP/pilot:** Implementer Redis-basert rate limiting og token-lagring
2. **Før produksjon:** Full Azure-stack med Key Vault, Front Door, Application Insights
3. **Kontinuerlig:** Penetrasjonstesting, security code review, dependency scanning
