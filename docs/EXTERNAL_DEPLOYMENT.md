# Ekstern Deployment Guide

**Sist oppdatert:** 2025-12-21

Veiledning for utrulling av applikasjonen til ekstern hosting (utenfor virksomhetens Azure-miljø).

**To autentiseringsalternativer:**
- **Supabase Auth** - Enkel oppsett for testing og demo (anbefalt for rask start)
- **Entra ID SSO** - Produksjonsklar med rollebasert tilgangskontroll

---

## Innhold

- [Hurtigstart](#hurtigstart)
- [Miljøvariabler](#miljøvariabler)
- [Oversikt](#oversikt)
- [Arkitektur](#arkitektur)
- [Supabase Auth (forenklet)](#supabase-auth-forenklet)
- [Entra ID SSO-oppsett](#entra-id-sso-oppsett) *(produksjon)*
- [Roller og prosjekttilgang](#roller-og-prosjekttilgang)
- [Frontend: Vercel](#frontend)
- [Backend: Render](#backend-render)
- [Database: Supabase](#database-supabase)
- [Overvåkning](#overvåkning)
- [Kostnader](#kostnader)
- [Sjekkliste](#sjekkliste)

---

## Hurtigstart

For rask test-deploy uten Catenda-integrasjon:

### 1. Supabase (5 min)
1. Opprett prosjekt på [supabase.com](https://supabase.com)
2. Kjør SQL-migrasjonen (se [Database: Supabase](#database-supabase))
3. Aktiver Email Auth under Authentication → Providers
4. Noter: Project URL og Service Role Key (Settings → API)

### 2. Render (5 min)
1. Koble GitHub-repo
2. Velg `backend/` som root directory
3. Build: `pip install -r requirements.txt`
4. Start: `gunicorn app:app`
5. Legg til miljøvariabler (se tabell under)

### 3. Vercel (5 min)
1. Importer repo fra GitHub
2. Framework: Vite
3. Legg til miljøvariabler (se tabell under)

---

## Miljøvariabler

### Supabase (Dashboard → Settings → API)

Du trenger disse verdiene fra Supabase:

| Verdi | Hvor | Brukes av |
|-------|------|-----------|
| Project URL | Settings → API → Project URL | Backend, Frontend |
| `anon` public key | Settings → API → anon public | Frontend |
| `service_role` key | Settings → API → service_role | Backend (hemmelig!) |

### Vercel (Frontend)

| Variabel | Eksempel | Beskrivelse |
|----------|----------|-------------|
| `VITE_API_BASE_URL` | `https://my-app.onrender.com` | Backend URL (uten `/api`) |
| `VITE_SUPABASE_URL` | `https://xxx.supabase.co` | Supabase Project URL |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGc...` | Supabase anon key (offentlig) |

### Render (Backend)

| Variabel | Eksempel | Beskrivelse |
|----------|----------|-------------|
| `SUPABASE_URL` | `https://xxx.supabase.co` | Supabase Project URL |
| `SUPABASE_KEY` | `eyJhbGc...` | Service Role Key (**hemmelig**) |
| `CSRF_SECRET` | *(generer)* | `python3 -c "import secrets; print(secrets.token_urlsafe(32))"` |
| `FLASK_SECRET_KEY` | *(generer)* | `python3 -c "import secrets; print(secrets.token_hex(32))"` |
| `ALLOWED_ORIGINS` | `https://my-app.vercel.app` | Frontend URL for CORS |
| `REACT_APP_URL` | `https://my-app.vercel.app` | Frontend URL for magic links |
| `FLASK_ENV` | `production` | Miljø |
| `FLASK_DEBUG` | `False` | Må være False i prod |
| `EVENT_STORE_BACKEND` | `supabase` | Bruk Supabase for lagring |
| `SUPABASE_JWT_SECRET` | *(fra dashboard)* | Settings → API → JWT Secret (for auth) |

**Ikke nødvendig for testing (Catenda-integrasjon):**
- `CATENDA_CLIENT_ID`, `CATENDA_CLIENT_SECRET`, `CATENDA_PROJECT_ID`, etc.
- `WEBHOOK_SECRET_PATH`

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

Se [Supabase Auth](#supabase-auth-forenklet) (testing) eller [Entra ID SSO-oppsett](#entra-id-sso-oppsett) (produksjon).

### Lag 4: Data (Supabase RLS)

Se [Database: Supabase](#database-supabase).

### Lag 5: Overvåkning

Se [Overvåkning](#overvåkning).

---

## Supabase Auth (forenklet)

For testing og demo uten Entra ID. Supabase Auth gir enkel brukerautentisering med email/passord eller magic links.

### Hvorfor Supabase Auth?

| Fordel | Beskrivelse |
|--------|-------------|
| Gratis | Inkludert i Supabase free tier (50K MAU) |
| Enkel oppsett | Aktiveres i dashboard, minimal kode |
| Fleksibel | Email/passord, magic links, OAuth (Google, GitHub) |
| Integrert | Samme prosjekt som database |

### Steg 1: Aktiver Email Auth

1. **Supabase Dashboard** → **Authentication** → **Providers**
2. Aktiver **Email** provider
3. Konfigurer:
   - ✅ Enable Email Signup
   - ✅ Enable Email Confirmations (valgfritt for testing)
   - Sett Site URL: `https://din-app.vercel.app`

### Steg 2: Frontend-integrasjon

Installer Supabase client:

```bash
npm install @supabase/supabase-js
```

Opprett Supabase client:

```typescript
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

Enkel login-komponent:

```tsx
// src/components/Auth.tsx
import { useState } from 'react'
import { supabase } from '../lib/supabase'

export function Auth() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setMessage(error.message)
    } else {
      setMessage('Innlogget!')
    }
    setLoading(false)
  }

  const handleSignUp = async () => {
    setLoading(true)
    const { error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) {
      setMessage(error.message)
    } else {
      setMessage('Sjekk e-post for bekreftelseslenke')
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleLogin}>
      <input
        type="email"
        placeholder="E-post"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        type="password"
        placeholder="Passord"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button type="submit" disabled={loading}>
        Logg inn
      </button>
      <button type="button" onClick={handleSignUp} disabled={loading}>
        Registrer
      </button>
      {message && <p>{message}</p>}
    </form>
  )
}
```

Auth-context for hele appen:

```tsx
// src/context/SupabaseAuthContext.tsx
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function SupabaseAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useSupabaseAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useSupabaseAuth must be used within SupabaseAuthProvider')
  }
  return context
}
```

### Steg 3: Backend token-validering

Backend må validere Supabase JWT tokens:

```python
# backend/lib/auth/supabase_validator.py
import os
import jwt
from functools import wraps
from flask import request, g, jsonify

SUPABASE_JWT_SECRET = os.environ.get("SUPABASE_JWT_SECRET")
# Eller bruk SUPABASE_URL for å hente JWKS

def validate_supabase_token(token: str) -> dict | None:
    """Valider Supabase JWT token."""
    try:
        # Supabase bruker HS256 med JWT secret
        claims = jwt.decode(
            token,
            SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated",
        )
        return claims
    except jwt.InvalidTokenError:
        return None

def require_auth(f):
    """Decorator for å kreve autentisering."""
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")

        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing authorization"}), 401

        token = auth_header.split(" ")[1]
        claims = validate_supabase_token(token)

        if not claims:
            return jsonify({"error": "Invalid token"}), 401

        g.current_user = {
            "id": claims.get("sub"),
            "email": claims.get("email"),
            "role": claims.get("role", "authenticated"),
        }

        return f(*args, **kwargs)
    return decorated
```

### Steg 4: Roller (valgfritt)

For enkel rolletildeling, bruk Supabase user metadata:

```sql
-- Gi en bruker TE-rolle (kjør i Supabase SQL Editor)
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'),
  '{role}',
  '"TE"'
)
WHERE email = 'bruker@example.com';
```

Eller opprett en egen rolle-tabell:

```sql
CREATE TABLE user_roles (
    user_id UUID REFERENCES auth.users(id) PRIMARY KEY,
    role TEXT NOT NULL CHECK (role IN ('TE', 'BH', 'Admin', 'Reader')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for user_roles
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own role"
ON user_roles FOR SELECT
USING (auth.uid() = user_id);
```

---

## Entra ID SSO-oppsett

> **Merk:** Denne seksjonen er for produksjonsmiljø med full Entra ID-integrasjon.
> For testing, bruk [Supabase Auth](#supabase-auth-forenklet) over.

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

### Tabelloversikt

| Tabell | Formål | Påkrevd |
|--------|--------|---------|
| `koe_events` | Event store (append-only log) | ✅ Ja |
| `sak_metadata` | Sak-liste cache | ✅ Ja |
| `magic_links` | Token-lagring for deling | ⚪ Valgfritt |
| `user_roles` | Brukerroller (hvis ikke frontend-only) | ⚪ Valgfritt |

### Roller i frontend vs. database

For **testing** velges rolle (TE/BH) via en knapp i frontend og lagres i `localStorage`:

```typescript
// src/hooks/useUserRole.ts - bruker localStorage, ikke database
const STORAGE_KEY = 'unified-timeline-user-role';
const stored = localStorage.getItem(STORAGE_KEY); // 'TE' eller 'BH'
```

Dette betyr at **ingen rolle-tabell trengs for testing**. Alle brukere kan bytte mellom TE og BH i UI.

For **produksjon** med faktisk rollekontroll, se [Roller (valgfritt)](#steg-4-roller-valgfritt) under Supabase Auth.

---

### Komplett SQL-oppsett (kjør i Supabase SQL Editor)

```sql
-- ============================================================
-- KOE Event Store - Supabase Setup
-- ============================================================
-- Kopier og kjør hele denne blokken i Supabase SQL Editor
-- Dashboard → SQL Editor → New query → Paste → Run
-- ============================================================

-- 1. EVENTS TABELL (kjernen i event sourcing)
-- Matcher backend/repositories/supabase_event_repository.py

CREATE TABLE IF NOT EXISTS koe_events (
    id SERIAL PRIMARY KEY,
    event_id UUID NOT NULL UNIQUE,
    sak_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    tidsstempel TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    aktor TEXT NOT NULL,
    aktor_rolle TEXT NOT NULL CHECK (aktor_rolle IN ('TE', 'BH')),
    data JSONB NOT NULL DEFAULT '{}',
    kommentar TEXT,
    referrer_til_event_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- For optimistisk låsing (concurrency control)
    versjon INTEGER NOT NULL,
    CONSTRAINT unique_sak_version UNIQUE (sak_id, versjon)
);

-- Indexes for vanlige queries
CREATE INDEX IF NOT EXISTS idx_koe_events_sak_id ON koe_events(sak_id);
CREATE INDEX IF NOT EXISTS idx_koe_events_tidsstempel ON koe_events(tidsstempel);
CREATE INDEX IF NOT EXISTS idx_koe_events_event_type ON koe_events(event_type);
CREATE INDEX IF NOT EXISTS idx_koe_events_versjon ON koe_events(sak_id, versjon);

-- View for current version per sak
CREATE OR REPLACE VIEW koe_sak_versions AS
SELECT sak_id, MAX(versjon) as current_version, COUNT(*) as event_count
FROM koe_events
GROUP BY sak_id;

-- 2. SAK METADATA TABELL (for sak-liste uten å laste alle events)
-- Matcher backend/models/sak_metadata.py

CREATE TABLE IF NOT EXISTS sak_metadata (
    sak_id TEXT PRIMARY KEY,
    prosjekt_id TEXT,
    catenda_topic_id TEXT,
    catenda_board_id TEXT,
    catenda_project_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by TEXT NOT NULL,

    -- Cached fields (oppdateres etter hvert event)
    cached_title TEXT,
    cached_status TEXT,
    last_event_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sak_metadata_prosjekt ON sak_metadata(prosjekt_id);
CREATE INDEX IF NOT EXISTS idx_sak_metadata_catenda_topic ON sak_metadata(catenda_topic_id);

-- 3. MAGIC LINKS TABELL (valgfritt - for deling uten innlogging)
-- Brukes hvis du vil dele lenker til eksterne uten at de må logge inn

CREATE TABLE IF NOT EXISTS magic_links (
    token UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sak_id TEXT NOT NULL REFERENCES sak_metadata(sak_id) ON DELETE CASCADE,
    email TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    used_at TIMESTAMPTZ,
    revoked BOOLEAN DEFAULT FALSE,
    revoked_at TIMESTAMPTZ,
    last_accessed TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_magic_links_sak ON magic_links(sak_id);
CREATE INDEX IF NOT EXISTS idx_magic_links_expires ON magic_links(expires_at);

-- 4. RLS (Row Level Security) - Enkel oppsett for testing
-- Backend bruker service_role key som bypasser RLS

ALTER TABLE koe_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE sak_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE magic_links ENABLE ROW LEVEL SECURITY;

-- Service role (backend) har full tilgang
CREATE POLICY "Service role full access on koe_events"
ON koe_events FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role full access on sak_metadata"
ON sak_metadata FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role full access on magic_links"
ON magic_links FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Authenticated users (via Supabase Auth) kan lese
CREATE POLICY "Authenticated users can read events"
ON koe_events FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read sak_metadata"
ON sak_metadata FOR SELECT
USING (auth.role() = 'authenticated');

-- ============================================================
-- FERDIG! Tabellene er nå klare til bruk.
-- ============================================================
```

### Verifiser oppsettet

Etter å ha kjørt SQL-scriptet, verifiser i Supabase Dashboard:

1. **Table Editor** → Se at `koe_events`, `sak_metadata`, `magic_links` finnes
2. **Authentication** → **Policies** → Se at RLS-policies er aktive
3. **SQL Editor** → Kjør:

```sql
-- Sjekk at tabellene eksisterer
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('koe_events', 'sak_metadata', 'magic_links');

-- Sjekk RLS-policies
SELECT tablename, policyname, cmd FROM pg_policies
WHERE schemaname = 'public';
```

### Row-Level Security (RLS) - Produksjon

For produksjon med strengere tilgangskontroll, legg til disse policies:

```sql
-- Kun tilgang til egne saker (basert på bruker-ID i metadata)
CREATE POLICY "Users can view own sak events"
ON koe_events FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM sak_metadata sm
        WHERE sm.sak_id = koe_events.sak_id
        AND sm.created_by = auth.jwt()->>'email'
    )
);
```

### Backend-integrasjon

Backend har allerede en ferdig `SupabaseEventRepository` i `backend/repositories/supabase_event_repository.py`.

For å aktivere Supabase som event store, sett miljøvariabel:

```bash
EVENT_STORE_BACKEND=supabase
```

Eller i Python:

```python
from repositories import create_event_repository

# Automatisk basert på miljøvariabel
repo = create_event_repository("supabase")
```

Se [backend/repositories/supabase_event_repository.py](../backend/repositories/supabase_event_repository.py) for full implementasjon.

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
