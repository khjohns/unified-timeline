# Ekstern Deployment Guide

**Sist oppdatert:** 2025-12-13

Veiledning for utrulling av applikasjonen til ekstern hosting (utenfor virksomhetens Azure-miljø), med Entra ID SSO for autentisering og rollebasert tilgangskontroll.

---

## Innhold

- [Oversikt](#oversikt)
- [Arkitektur](#arkitektur)
- [Sikkerhetslag](#sikkerhetslag)
- [Entra ID SSO-oppsett](#entra-id-sso-oppsett)
- [Roller og prosjekttilgang](#roller-og-prosjekttilgang)
- [Frontend: Vercel/Cloudflare Pages](#frontend)
- [Backend: Render](#backend-render)
- [Database: Supabase](#database-supabase)
- [Overvåkning](#overvåkning)
- [Kostnader](#kostnader)
- [Sjekkliste](#sjekkliste)

---

## Oversikt

### Intern vs. Ekstern deployment

| Aspekt | Intern (Azure) | Ekstern (Supabase/Render) |
|--------|----------------|---------------------------|
| Frontend | Azure Static Web Apps | Vercel / Cloudflare Pages |
| Backend | Azure Functions | Render / Railway |
| Database | Dataverse | Supabase (PostgreSQL) |
| Autentisering | Entra ID (direkte) | Entra ID (via App Registration) |
| WAF/DDoS | Azure Front Door | Cloudflare |
| Secrets | Key Vault + Managed Identity | Environment Variables |
| RLS | Dataverse RLS | Supabase RLS |

### Når velge ekstern hosting?

- Tilgjengeliggjøring for eksterne parter uten VPN
- Lavere kostnad for mindre bruksvolum
- Enklere onboarding for eksterne utviklere
- Uavhengighet fra virksomhetens Azure-infrastruktur

---

## Arkitektur

```
┌─────────────────────────────────────────────────────────────────┐
│                         Cloudflare                              │
│  - DDoS Protection                                              │
│  - WAF (managed rules)                                          │
│  - Rate limiting                                                │
│  - Geo-blocking (valgfritt)                                     │
└─────────────────────────────┬───────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌─────────────────────────┐         ┌─────────────────────────────┐
│  Vercel/Cloudflare      │         │        Render               │
│  Pages (Frontend)       │         │    (Python Backend)         │
│                         │         │                             │
│  - React 19 + TS        │  HTTPS  │  - FastAPI/Flask            │
│  - MSAL.js              │────────▶│  - Gatekeeper               │
│  - Entra ID login       │         │  - Event Sourcing           │
│  - Punkt designsystem   │         │  - CSRF/CORS                │
└─────────────────────────┘         └──────────────┬──────────────┘
                                                   │
                                                   ▼
                             ┌─────────────────────────────────────┐
                             │            Supabase                 │
                             │  ┌───────────────────────────────┐  │
                             │  │  PostgreSQL                   │  │
                             │  │  - koe_events (event store)   │  │
                             │  │  - koe_user_access (roller)   │  │
                             │  │  - Row-Level Security         │  │
                             │  └───────────────────────────────┘  │
                             │  - Encryption at rest               │
                             │  - Automatic backups                │
                             │  - Connection pooling (PgBouncer)   │
                             └─────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     Microsoft Entra ID                          │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  App Registration: "unified-timeline-external"            │  │
│  │  - App Roles: TE, BH, Admin                               │  │
│  │  - Group claims (prosjekttilgang)                         │  │
│  │  - MFA (conditional access)                               │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                         Sentry                                  │
│  - Error tracking                                               │
│  - Performance monitoring                                       │
│  - Alerts                                                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Sikkerhetslag

### Sammenligning med Azure-stack

| Lag | Azure-stack | Ekstern stack | Status |
|-----|-------------|---------------|--------|
| **1. Nettverk** | Azure Front Door + WAF | Cloudflare Pro | ✅ Likeverdig |
| **2. Autentisering** | Entra ID + Magic Links | Entra ID + Magic Links | ✅ Identisk |
| **3. Autorisasjon** | CSRF, RBAC, Gatekeeper | CSRF, RBAC, Gatekeeper | ✅ Identisk |
| **4. Data** | Dataverse RLS + Managed Identity | Supabase RLS + Service Role | ✅ Likeverdig |
| **5. Overvåkning** | Application Insights | Sentry + Supabase logs | ✅ Likeverdig |

### Lag 1: Nettverk (Cloudflare)

Cloudflare plasseres foran både frontend og backend:

```
# DNS-oppsett i Cloudflare
app.example.com      → Vercel (proxied)
api.example.com      → Render (proxied)
```

**Cloudflare-konfigurasjon:**

| Funksjon | Free | Pro ($20/mnd) |
|----------|------|---------------|
| DDoS-beskyttelse | ✅ Ubegrenset | ✅ Ubegrenset |
| WAF (managed rules) | ❌ | ✅ OWASP Core Ruleset |
| Rate limiting | 1 regel | 10 regler |
| Bot protection | Basic | Advanced |
| Geo-blocking | ✅ | ✅ |

**Anbefalt rate limiting-regel:**

```
URI Path: /api/*
Rate: 100 requests per minute per IP
Action: Block for 10 minutes
```

### Lag 2-3: Autentisering og autorisasjon

Se [Entra ID SSO-oppsett](#entra-id-sso-oppsett) og [Roller og prosjekttilgang](#roller-og-prosjekttilgang).

### Lag 4: Data (Supabase RLS)

Se [Database: Supabase](#database-supabase).

### Lag 5: Overvåkning

Se [Overvåkning](#overvåkning).

---

## Entra ID SSO-oppsett

### Steg 1: Opprett App Registration

1. Gå til [Azure Portal](https://portal.azure.com) → **Microsoft Entra ID** → **App registrations** → **New registration**

2. Konfigurer:
   - **Name:** `unified-timeline-external`
   - **Supported account types:** Velg basert på behov:
     - *Single tenant* - kun din organisasjon
     - *Multitenant* - alle Entra ID-organisasjoner (anbefalt for eksterne)
   - **Redirect URI:** `https://app.example.com/auth/callback` (Web)

3. Noter ned:
   - **Application (client) ID**
   - **Directory (tenant) ID**

### Steg 2: Konfigurer Client Secret

1. **Certificates & secrets** → **New client secret**
2. Beskrivelse: `Production secret`
3. Utløp: 24 måneder (sett påminnelse for fornyelse)
4. Kopier secret-verdien umiddelbart (vises kun én gang)

### Steg 3: Konfigurer API-tillatelser

1. **API permissions** → **Add a permission**
2. Legg til:
   - `Microsoft Graph` → `User.Read` (delegated)
   - `Microsoft Graph` → `email` (delegated)
   - `Microsoft Graph` → `profile` (delegated)

3. Klikk **Grant admin consent** (krever admin-rettigheter)

### Steg 4: Konfigurer Token

1. **Token configuration** → **Add optional claim**
2. Token type: **ID**
3. Legg til claims:
   - `email`
   - `preferred_username`
   - `groups` (for prosjekttilgang)

### Steg 5: Frontend-integrasjon (MSAL.js)

Installer MSAL:

```bash
npm install @azure/msal-browser @azure/msal-react
```

Opprett konfigurasjon:

```typescript
// src/auth/authConfig.ts
import { Configuration, LogLevel } from "@azure/msal-browser";

export const msalConfig: Configuration = {
  auth: {
    clientId: import.meta.env.VITE_ENTRA_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_ENTRA_TENANT_ID}`,
    redirectUri: import.meta.env.VITE_AUTH_REDIRECT_URI,
    postLogoutRedirectUri: "/",
  },
  cache: {
    cacheLocation: "sessionStorage", // Sikrere enn localStorage
    storeAuthStateInCookie: false,
  },
  system: {
    loggerOptions: {
      logLevel: LogLevel.Warning,
    },
  },
};

export const loginRequest = {
  scopes: ["User.Read", "email", "profile"],
};

export const apiRequest = {
  scopes: [`api://${import.meta.env.VITE_ENTRA_CLIENT_ID}/access_as_user`],
};
```

Integrer i App:

```tsx
// src/main.tsx
import { MsalProvider } from "@azure/msal-react";
import { PublicClientApplication } from "@azure/msal-browser";
import { msalConfig } from "./auth/authConfig";

const msalInstance = new PublicClientApplication(msalConfig);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <MsalProvider instance={msalInstance}>
    <App />
  </MsalProvider>
);
```

Login-komponent:

```tsx
// src/components/LoginButton.tsx
import { useMsal } from "@azure/msal-react";
import { loginRequest } from "../auth/authConfig";

export function LoginButton() {
  const { instance } = useMsal();

  const handleLogin = () => {
    instance.loginRedirect(loginRequest);
  };

  return <button onClick={handleLogin}>Logg inn med Entra ID</button>;
}
```

### Steg 6: Backend token-validering

```python
# backend/lib/auth/entra_validator.py
import jwt
from jwt import PyJWKClient
from functools import lru_cache
from typing import Optional
import os

TENANT_ID = os.environ["ENTRA_TENANT_ID"]
CLIENT_ID = os.environ["ENTRA_CLIENT_ID"]

@lru_cache(maxsize=1)
def get_jwks_client():
    """Cache JWKS client for performance."""
    jwks_url = f"https://login.microsoftonline.com/{TENANT_ID}/discovery/v2.0/keys"
    return PyJWKClient(jwks_url)

def validate_entra_token(token: str) -> Optional[dict]:
    """
    Validerer Entra ID token og returnerer claims.

    Returns:
        dict med claims hvis valid, None hvis ugyldig
    """
    try:
        jwks_client = get_jwks_client()
        signing_key = jwks_client.get_signing_key_from_jwt(token)

        claims = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            audience=CLIENT_ID,
            issuer=f"https://login.microsoftonline.com/{TENANT_ID}/v2.0",
            options={
                "verify_exp": True,
                "verify_iat": True,
                "verify_nbf": True,
            }
        )

        return claims

    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

def get_user_from_token(token: str) -> Optional[dict]:
    """Ekstraher brukerinfo fra validert token."""
    claims = validate_entra_token(token)
    if not claims:
        return None

    return {
        "email": claims.get("email") or claims.get("preferred_username"),
        "name": claims.get("name"),
        "oid": claims.get("oid"),  # Object ID (unik bruker-ID)
        "roles": claims.get("roles", []),
        "groups": claims.get("groups", []),
    }
```

---

## Roller og prosjekttilgang

### Strategi: App Roles + Grupper

Entra ID støtter to komplementære mekanismer:

| Mekanisme | Bruksområde | Eksempel |
|-----------|-------------|----------|
| **App Roles** | Systemroller | TE, BH, Admin |
| **Groups** | Prosjekttilgang | Prosjekt-A, Prosjekt-B |

### Steg 1: Definer App Roles

1. **Azure Portal** → App Registration → **App roles** → **Create app role**

2. Opprett roller:

```json
[
  {
    "displayName": "Totalentreprenør",
    "value": "TE",
    "description": "Totalentreprenør-rolle med skrivetilgang til endringsmeldinger",
    "allowedMemberTypes": ["User"]
  },
  {
    "displayName": "Byggherre",
    "value": "BH",
    "description": "Byggherre-rolle med godkjenningstilgang",
    "allowedMemberTypes": ["User"]
  },
  {
    "displayName": "Administrator",
    "value": "Admin",
    "description": "Full administratortilgang",
    "allowedMemberTypes": ["User"]
  },
  {
    "displayName": "Lesetilgang",
    "value": "Reader",
    "description": "Kun lesetilgang",
    "allowedMemberTypes": ["User"]
  }
]
```

### Steg 2: Opprett grupper for prosjekttilgang

1. **Azure Portal** → **Microsoft Entra ID** → **Groups** → **New group**

2. Opprett grupper:
   - `unified-timeline-prosjekt-a`
   - `unified-timeline-prosjekt-b`
   - `unified-timeline-prosjekt-c`

3. Legg til medlemmer i gruppene

### Steg 3: Aktiver group claims

1. App Registration → **Token configuration**
2. **Add groups claim**
3. Velg: **Security groups**
4. For ID tokens og Access tokens, velg **Group ID**

### Steg 4: Tilordne roller til brukere

1. **Azure Portal** → **Enterprise applications** → Velg appen
2. **Users and groups** → **Add user/group**
3. Velg bruker og tilordne rolle (TE, BH, etc.)

### Steg 5: Database-struktur for tilgangskontroll

```sql
-- Supabase: Tabell for bruker-prosjekt-tilgang
CREATE TABLE user_project_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entra_oid TEXT NOT NULL,           -- Entra Object ID
    email TEXT NOT NULL,
    project_id TEXT NOT NULL,          -- F.eks. "prosjekt-a"
    role TEXT NOT NULL CHECK (role IN ('TE', 'BH', 'Admin', 'Reader')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT NOT NULL,

    UNIQUE(entra_oid, project_id)
);

-- Index for raske oppslag
CREATE INDEX idx_user_access_oid ON user_project_access(entra_oid);
CREATE INDEX idx_user_access_project ON user_project_access(project_id);
```

### Steg 6: Synkronisering av roller

Ved innlogging, synkroniser Entra-roller med lokal database:

```python
# backend/services/user_sync_service.py
from typing import List, Dict
from repositories.user_repository import UserRepository

class UserSyncService:
    """Synkroniserer Entra ID-roller med lokal database."""

    # Mapping fra Entra gruppe-ID til prosjekt-ID
    GROUP_TO_PROJECT = {
        "abc123-group-id": "prosjekt-a",
        "def456-group-id": "prosjekt-b",
        "ghi789-group-id": "prosjekt-c",
    }

    def __init__(self, user_repo: UserRepository):
        self.user_repo = user_repo

    def sync_user_access(self, entra_claims: dict) -> List[Dict]:
        """
        Synkroniser brukerens tilganger basert på Entra-claims.

        Args:
            entra_claims: Claims fra validert Entra token

        Returns:
            Liste over brukerens prosjekttilganger
        """
        oid = entra_claims["oid"]
        email = entra_claims["email"]
        roles = entra_claims.get("roles", [])
        groups = entra_claims.get("groups", [])

        # Bestem rolle (prioriter Admin > TE > BH > Reader)
        role = self._determine_role(roles)

        # Map grupper til prosjekter
        projects = [
            self.GROUP_TO_PROJECT[g]
            for g in groups
            if g in self.GROUP_TO_PROJECT
        ]

        # Oppdater database
        for project_id in projects:
            self.user_repo.upsert_access(
                entra_oid=oid,
                email=email,
                project_id=project_id,
                role=role
            )

        # Returner oppdaterte tilganger
        return self.user_repo.get_user_access(oid)

    def _determine_role(self, roles: List[str]) -> str:
        """Bestem høyeste rolle."""
        if "Admin" in roles:
            return "Admin"
        if "TE" in roles:
            return "TE"
        if "BH" in roles:
            return "BH"
        return "Reader"
```

### Steg 7: Gatekeeper-integrasjon

```python
# backend/lib/auth/gatekeeper.py
from typing import Optional
from functools import wraps
from flask import request, g, abort

def require_project_access(required_role: Optional[str] = None):
    """
    Decorator som sjekker prosjekttilgang.

    Args:
        required_role: Påkrevd rolle (None = alle roller godkjent)
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            sak_id = kwargs.get("sak_id") or request.view_args.get("sak_id")
            if not sak_id:
                abort(400, "Mangler sak_id")

            # Hent prosjekt-ID fra sak (cache dette i praksis)
            project_id = get_project_for_sak(sak_id)

            # Sjekk tilgang
            user = g.current_user  # Satt av auth middleware
            access = get_user_project_access(user["oid"], project_id)

            if not access:
                abort(403, f"Ingen tilgang til prosjekt {project_id}")

            if required_role and access["role"] != required_role:
                if not (access["role"] == "Admin"):  # Admin har alltid tilgang
                    abort(403, f"Krever rolle {required_role}")

            g.project_access = access
            return f(*args, **kwargs)

        return decorated_function
    return decorator

# Bruk i route
@app.route("/api/cases/<sak_id>/approve", methods=["POST"])
@require_auth  # Først: Valider token
@require_project_access(required_role="BH")  # Så: Sjekk prosjekt + rolle
def approve_case(sak_id: str):
    # Kun BH (eller Admin) kommer hit
    ...
```

### Token-eksempel

Etter innlogging inneholder tokenet:

```json
{
  "aud": "din-client-id",
  "iss": "https://login.microsoftonline.com/tenant-id/v2.0",
  "sub": "bruker-unik-id",
  "email": "ola.nordmann@firma.no",
  "name": "Ola Nordmann",
  "oid": "12345-67890-abcdef",
  "roles": ["TE"],
  "groups": [
    "abc123-group-id",
    "def456-group-id"
  ],
  "exp": 1702500000
}
```

Dette gir:
- **Rolle:** TE (Totalentreprenør)
- **Prosjekter:** prosjekt-a, prosjekt-b (mappet fra gruppe-ID-er)

---

## Frontend

### Vercel (anbefalt)

```bash
# Installer Vercel CLI
npm install -g vercel

# Deploy
vercel --prod
```

**Miljøvariabler i Vercel Dashboard:**

| Variabel | Verdi |
|----------|-------|
| `VITE_API_BASE_URL` | `https://api.example.com` |
| `VITE_ENTRA_CLIENT_ID` | `din-client-id` |
| `VITE_ENTRA_TENANT_ID` | `din-tenant-id` |
| `VITE_AUTH_REDIRECT_URI` | `https://app.example.com/auth/callback` |

### Cloudflare Pages (alternativ)

```bash
# Med Wrangler
npm install -g wrangler
wrangler pages deploy dist
```

---

## Backend: Render

### Oppsett

1. Koble GitHub-repo til Render
2. Velg **Web Service**
3. Konfigurer:
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `gunicorn app:app` (eller `uvicorn app:app`)

### Miljøvariabler

| Variabel | Kilde | Beskrivelse |
|----------|-------|-------------|
| `ENTRA_TENANT_ID` | App Registration | Tenant ID |
| `ENTRA_CLIENT_ID` | App Registration | Client ID |
| `ENTRA_CLIENT_SECRET` | App Registration | Client secret |
| `SUPABASE_URL` | Supabase Dashboard | API URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard | Service role key |
| `CSRF_SECRET` | Generer selv | CSRF token secret |
| `ALLOWED_ORIGINS` | - | `https://app.example.com` |

### Health check

```python
@app.route("/health")
def health():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}
```

Konfigurer i Render: Health Check Path = `/health`

---

## Database: Supabase

### Event Store-tabeller

```sql
-- Events tabell (append-only)
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sak_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    tidsstempel TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    aktor TEXT NOT NULL,
    aktor_rolle TEXT NOT NULL CHECK (aktor_rolle IN ('TE', 'BH', 'System')),
    data JSONB NOT NULL DEFAULT '{}',
    kommentar TEXT,
    refererer_til_event_id UUID REFERENCES events(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_events_sak_id ON events(sak_id);
CREATE INDEX idx_events_tidsstempel ON events(sak_id, tidsstempel);

-- Sak metadata (for rask listing)
CREATE TABLE sak_metadata (
    sak_id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    tittel TEXT,
    status TEXT,
    opprettet TIMESTAMPTZ,
    sist_oppdatert TIMESTAMPTZ,
    versjon INTEGER DEFAULT 0
);

CREATE INDEX idx_sak_project ON sak_metadata(project_id);
```

### Row-Level Security (RLS)

```sql
-- Aktiver RLS
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE sak_metadata ENABLE ROW LEVEL SECURITY;

-- Policy: Brukere ser kun saker de har tilgang til
CREATE POLICY "Users can view events for accessible projects"
ON events
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM sak_metadata sm
        JOIN user_project_access upa ON sm.project_id = upa.project_id
        WHERE sm.sak_id = events.sak_id
        AND upa.entra_oid = current_setting('app.current_user_oid', true)
    )
);

-- Policy: Kun TE og Admin kan opprette events
CREATE POLICY "TE and Admin can insert events"
ON events
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM sak_metadata sm
        JOIN user_project_access upa ON sm.project_id = upa.project_id
        WHERE sm.sak_id = events.sak_id
        AND upa.entra_oid = current_setting('app.current_user_oid', true)
        AND upa.role IN ('TE', 'Admin')
    )
);

-- Service role bypass (for backend)
CREATE POLICY "Service role has full access"
ON events
FOR ALL
USING (current_setting('role', true) = 'service_role');
```

### Backend-integrasjon

```python
# backend/repositories/supabase_event_repository.py
from supabase import create_client, Client
import os

class SupabaseEventRepository:
    def __init__(self):
        self.client: Client = create_client(
            os.environ["SUPABASE_URL"],
            os.environ["SUPABASE_SERVICE_ROLE_KEY"]
        )

    def append(self, event: dict, expected_version: int) -> int:
        """Legg til event med optimistisk låsing."""
        sak_id = event["sak_id"]

        # Sjekk versjon
        result = self.client.table("sak_metadata") \
            .select("versjon") \
            .eq("sak_id", sak_id) \
            .single() \
            .execute()

        current_version = result.data["versjon"] if result.data else 0

        if current_version != expected_version:
            raise ConcurrencyError(
                f"Version mismatch: expected {expected_version}, got {current_version}"
            )

        # Insert event
        self.client.table("events").insert(event).execute()

        # Oppdater metadata
        new_version = current_version + 1
        self.client.table("sak_metadata") \
            .upsert({
                "sak_id": sak_id,
                "versjon": new_version,
                "sist_oppdatert": datetime.utcnow().isoformat()
            }) \
            .execute()

        return new_version

    def get_events(self, sak_id: str) -> tuple[list, int]:
        """Hent alle events for en sak."""
        result = self.client.table("events") \
            .select("*") \
            .eq("sak_id", sak_id) \
            .order("tidsstempel") \
            .execute()

        return result.data, len(result.data)
```

---

## Overvåkning

### Sentry (feil og ytelse)

```python
# backend/app.py
import sentry_sdk
from sentry_sdk.integrations.flask import FlaskIntegration

sentry_sdk.init(
    dsn=os.environ.get("SENTRY_DSN"),
    integrations=[FlaskIntegration()],
    traces_sample_rate=0.1,  # 10% av requests
    environment=os.environ.get("ENVIRONMENT", "development"),
)
```

Frontend:

```typescript
// src/main.tsx
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  tracesSampleRate: 0.1,
});
```

### Supabase-logging

Supabase Dashboard → Logs gir:
- API request logs
- Database query logs
- Auth logs

---

## Kostnader

### Estimert månedlig kostnad

| Tjeneste | Free tier | Betalt tier |
|----------|-----------|-------------|
| **Cloudflare** | Gratis (uten WAF) | $20/mnd (Pro med WAF) |
| **Vercel** | 100GB båndbredde | $20/mnd (Pro) |
| **Render** | 750 timer/mnd | $7/mnd (Starter) |
| **Supabase** | 500MB, 2GB transfer | $25/mnd (Pro) |
| **Sentry** | 5K errors/mnd | $26/mnd (Team) |
| **Entra ID** | 50K MAU gratis | ~$0.003/MAU etter |

**Totalt:**
- **Minimal:** ~$0/mnd (free tiers, ingen WAF)
- **Anbefalt:** ~$50-75/mnd (Pro tiers, WAF inkludert)
- **Enterprise:** ~$150+/mnd (høyere volum, SLA)

### Entra ID-kostnader detaljert

| Scenario | Kostnad |
|----------|---------|
| Egne ansatte (samme tenant) | Gratis |
| B2B-gjester (andre org) | 50K MAU gratis, så $0.00325/MAU |
| External Identities | 50K MAU gratis/mnd |

---

## Sjekkliste

### Før produksjon

- [ ] Entra ID App Registration opprettet
- [ ] App Roles definert (TE, BH, Admin, Reader)
- [ ] Grupper for prosjekttilgang opprettet
- [ ] Cloudflare DNS konfigurert
- [ ] Cloudflare WAF-regler aktivert
- [ ] Vercel/Cloudflare Pages deployet
- [ ] Render Web Service deployet
- [ ] Supabase-tabeller opprettet
- [ ] Supabase RLS-policies aktivert
- [ ] Miljøvariabler satt i alle tjenester
- [ ] CORS konfigurert riktig
- [ ] Sentry integrert
- [ ] Custom domain konfigurert

### Etter deploy

- [ ] SSO-innlogging fungerer
- [ ] Roller reflekteres korrekt
- [ ] Prosjekttilgang begrenser data
- [ ] Events lagres i Supabase
- [ ] RLS forhindrer uautorisert tilgang
- [ ] Feil logges til Sentry
- [ ] Health endpoint svarer

---

## Se også

- [DEPLOYMENT.md](DEPLOYMENT.md) – Intern Azure-deployment
- [SECURITY_ARCHITECTURE.md](SECURITY_ARCHITECTURE.md) – Sikkerhetsarkitektur
- [GETTING_STARTED.md](GETTING_STARTED.md) – Lokal utvikling
