# Handlingsplan: Sikkerhetstiltak for Prototype

**Dato**: 2025-11-23
**Versjon**: 1.0
**Formål**: Implementere demonstrerbare sikkerhetstiltak i Flask-prototype

---

## Innholdsfortegnelse

1. [Executive Summary](#executive-summary)
2. [Nåværende Sikkerhetsstatus](#nåværende-sikkerhetsstatus)
3. [Implementeringsstrategi](#implementeringsstrategi)
4. [Quick Wins (Fase 1: 1-2 dager)](#quick-wins-fase-1-1-2-dager)
5. [Medium Priority (Fase 2: 3-5 dager)](#medium-priority-fase-2-3-5-dager)
6. [Long-term (Fase 3: 1-2 uker)](#long-term-fase-3-1-2-uker)
7. [Network Tab Demonstrasjon](#network-tab-demonstrasjon)
8. [Testing og Verifikasjon](#testing-og-verifikasjon)

---

## ⚠️ Catenda API-korrigeringer

**Viktig**: Hvis du integrerer med Catenda API, bruk følgende endepunkter:

### Webhook Events (Catenda BCF API)
- ✅ **Korrekt**: `event` felt med verdier `"issue.created"`, `"issue.modified"`, `"issue.status.changed"`
- ❌ **Feil**: `eventType` felt med `"TopicCreatedEvent"`, `"TopicModifiedEvent"`
- **Referanse**: Webhook API.yaml

### Webhook Security (Catenda)
- ✅ **Korrekt**: Secret Token i URL query parameter (`?token=SECRET`)
- ❌ **Feil**: HMAC-signatur i `X-Catenda-Signature` header
- **Årsak**: Catenda Webhook API har ikke felt for `secret`/`signing_key` - støtter ikke signering
- **Løsning**: Registrer `https://url.com/webhook?token=SECRET`, valider token i backend

Se [Handlingsplan_Prototype_Lokal.md](./Handlingsplan_Prototype_Lokal.md) for fullstendige Catenda API-korrigeringer.

---

## Executive Summary

Denne handlingsplanen prioriterer sikkerhetstiltak fra [Beslutningsmatrisen](./Digital%20Samhandlingsplattform%20for%20Byggeprosjekter.md#beslutningsmatrise-for-sikkerhetstiltak) som kan implementeres i nåværende Flask-prototype og **demonstreres via browser Network tab**.

### Prioritering

| Fase | Tiltak | Demo-verdi | Innsats | Sikkerhet |
|------|--------|------------|---------|-----------|
| **1** | CORS-restriksjon | ⭐⭐⭐ | Lav | Moderat |
| **1** | CSRF-beskyttelse | ⭐⭐⭐⭐⭐ | Lav | Høy |
| **1** | Webhook HMAC-validering | ⭐⭐⭐⭐⭐ | Lav | Kritisk |
| **1** | Request validation | ⭐⭐⭐⭐ | Lav | Høy |
| **2** | Magic Link (one-time + TTL) | ⭐⭐⭐⭐⭐ | Moderat | Kritisk |
| **2** | Project-scope authorization | ⭐⭐⭐⭐ | Moderat | Høy |
| **2** | Rate limiting | ⭐⭐⭐⭐ | Moderat | Høy |
| **2** | Audit logging | ⭐⭐⭐ | Moderat | Moderat |
| **3** | Entra ID SSO | ⭐⭐⭐ | Høy | Høy |
| **3** | Role-based field locking | ⭐⭐⭐⭐ | Høy | Høy |

---

## Nåværende Sikkerhetsstatus

### Identifiserte Sårbarheter (backend/app.py)

```python
# ❌ KRITISK: CORS helt åpen (linje 392)
CORS(app, resources={r"/api/*": {"origins": "*"}})

# ❌ KRITISK: Ingen autentisering (linje 415-426)
@app.route('/api/cases/<string:sakId>', methods=['GET'])
def get_case(sakId):
    # Hvem som helst kan lese alle saker

# ❌ KRITISK: Ingen CSRF-beskyttelse (linje 428-467)
@app.route('/api/varsel-submit', methods=['POST'])
def submit_varsel():
    payload = request.get_json()
    # Ingen token-validering, ingen nonce-sjekk

# ❌ KRITISK: Webhook uten signatur (linje 647-663)
@app.route('/webhook/catenda', methods=['POST'])
def webhook():
    payload = request.get_json()
    # Aksepterer webhooks fra hvem som helst

# ❌ HØY: Ingen input-validering
# ❌ HØY: Ingen rate limiting
# ❌ MODERAT: Ingen strukturert logging
# ❌ MODERAT: Ingen audit trail
```

### Risikovurdering

| Sårbarhet | Sannsynlighet | Konsekvens | Risiko | Prioritet |
|-----------|---------------|------------|--------|-----------|
| **Åpen CORS** | Høy | Moderat | Høy | 🔴 P1 |
| **Manglende CSRF** | Høy | Høy | **Kritisk** | 🔴 P0 |
| **Webhook spoofing** | Moderat | Høy | **Kritisk** | 🔴 P0 |
| **Ingen autentisering** | Høy | Høy | **Kritisk** | 🔴 P0 |
| **Ingen rate limiting** | Høy | Moderat | Høy | 🟡 P2 |

---

## Implementeringsstrategi

### Prinsipper

1. **Demo-først**: Velg tiltak som er **synlige i Network tab** (headers, status codes, response bodies)
2. **Quick wins først**: Start med høy sikkerhet/lav innsats
3. **Inkrementell**: Ikke ødelegg eksisterende funksjonalitet
4. **Testing**: Hver implementasjon skal ha test-case

### Demonstrasjon via Network Tab

Alle tiltak demonstreres ved å vise:

- ✅ **Request headers** (Authorization, X-CSRF-Token, X-Catenda-Signature)
- ✅ **Response status codes** (200 OK, 401 Unauthorized, 403 Forbidden)
- ✅ **Response headers** (Set-Cookie, X-RateLimit-Remaining)
- ✅ **Response bodies** (error messages, audit logs)
- ✅ **Timing** (TTL expiry, rate limit reset)

---

## Quick Wins (Fase 1: 1-2 dager)

### 1.1 CORS-restriksjon

**Kategori**: C. Nettverkskontroll
**Demo-verdi**: ⭐⭐⭐
**Innsats**: 15 minutter
**Risiko**: Moderat → Lav

#### Nåværende tilstand

```python
# backend/app.py:392
CORS(app, resources={r"/api/*": {"origins": "*"}})
```

**Problem**: Enhver nettside kan kalle vårt API fra brukerens nettleser.

#### Implementasjon

```python
# backend/app.py
from flask_cors import CORS

# Tillat kun kjente domener
ALLOWED_ORIGINS = [
    "http://localhost:3000",           # Lokal utvikling
    "https://byggeprosjekt.azurewebsites.net",  # Produksjon
]

CORS(app, resources={
    r"/api/*": {
        "origins": ALLOWED_ORIGINS,
        "methods": ["GET", "POST", "PUT", "DELETE"],
        "allow_headers": ["Content-Type", "X-CSRF-Token"],
        "expose_headers": ["X-RateLimit-Remaining"],
        "supports_credentials": True,  # For cookies
        "max_age": 3600  # Preflight cache
    }
})
```

#### Network Tab Demonstrasjon

**Test 1**: Gyldig origin
```http
GET /api/cases/123 HTTP/1.1
Host: localhost:5000
Origin: http://localhost:3000

→ 200 OK
Access-Control-Allow-Origin: http://localhost:3000
Access-Control-Allow-Credentials: true
```

**Test 2**: Ugyldig origin
```http
GET /api/cases/123 HTTP/1.1
Host: localhost:5000
Origin: https://evil.com

→ (CORS error - ingen Access-Control-Allow-Origin header)
```

#### Testing

```bash
# Test 1: Gyldig origin
curl -H "Origin: http://localhost:3000" http://localhost:5000/api/cases/123

# Test 2: Ugyldig origin
curl -H "Origin: https://evil.com" http://localhost:5000/api/cases/123
```

---

### 1.2 CSRF-beskyttelse (Double-Submit Cookie)

**Kategori**: F. Anti-CSRF
**Demo-verdi**: ⭐⭐⭐⭐⭐
**Innsats**: 2-3 timer
**Risiko**: Kritisk → Lav

#### Nåværende tilstand

```python
# backend/app.py:428-467
@app.route('/api/varsel-submit', methods=['POST'])
def submit_varsel():
    payload = request.get_json()
    # ❌ Ingen CSRF-validering
```

**Problem**: Ondsinnet nettside kan sende POST-requests på vegne av innlogget bruker.

#### Implementasjon

**Steg 1**: Legg til CSRF-modul

```python
# backend/csrf_protection.py (NY FIL)
import secrets
import hmac
import hashlib
from datetime import datetime, timedelta
from flask import request, jsonify
from functools import wraps

# Secret key (bør hentes fra environment variable i prod)
CSRF_SECRET = "CHANGE_ME_IN_PRODUCTION"  # TODO: os.getenv("CSRF_SECRET")

def generate_csrf_token() -> str:
    """Generer CSRF-token (32 bytes random + timestamp + HMAC)"""
    nonce = secrets.token_urlsafe(32)
    timestamp = int(datetime.utcnow().timestamp())

    # HMAC signatur: nonce + timestamp
    message = f"{nonce}:{timestamp}"
    signature = hmac.new(
        CSRF_SECRET.encode(),
        message.encode(),
        hashlib.sha256
    ).hexdigest()

    return f"{nonce}:{timestamp}:{signature}"

def validate_csrf_token(token: str, max_age: int = 3600) -> tuple[bool, str]:
    """
    Valider CSRF-token.

    Returns:
        (valid, error_message)
    """
    if not token:
        return False, "CSRF token missing"

    parts = token.split(":")
    if len(parts) != 3:
        return False, "CSRF token malformed"

    nonce, timestamp_str, signature = parts

    try:
        timestamp = int(timestamp_str)
    except ValueError:
        return False, "CSRF token invalid timestamp"

    # Sjekk alder (default 1 time)
    age = int(datetime.utcnow().timestamp()) - timestamp
    if age > max_age:
        return False, f"CSRF token expired (age: {age}s > {max_age}s)"

    if age < 0:
        return False, "CSRF token timestamp in future"

    # Verifiser signatur
    message = f"{nonce}:{timestamp_str}"
    expected_sig = hmac.new(
        CSRF_SECRET.encode(),
        message.encode(),
        hashlib.sha256
    ).hexdigest()

    if not hmac.compare_digest(signature, expected_sig):
        return False, "CSRF token signature invalid"

    return True, ""

def require_csrf(f):
    """Decorator for å kreve CSRF-token på endpoint"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Hent token fra header
        token = request.headers.get("X-CSRF-Token", "")

        valid, error = validate_csrf_token(token, max_age=3600)
        if not valid:
            return jsonify({
                "error": "CSRF validation failed",
                "detail": error
            }), 403

        return f(*args, **kwargs)

    return decorated_function
```

**Steg 2**: Oppdater app.py

```python
# backend/app.py
from csrf_protection import generate_csrf_token, require_csrf

# Nytt endpoint: Hent CSRF-token
@app.route('/api/csrf-token', methods=['GET'])
def get_csrf_token():
    """
    GET /api/csrf-token

    Returnerer ny CSRF-token som skal brukes i påfølgende POST/PUT/DELETE.
    """
    token = generate_csrf_token()
    return jsonify({
        "csrfToken": token,
        "expiresIn": 3600  # sekunder
    }), 200

# Oppdater submit-endpoint med CSRF-validering
@app.route('/api/varsel-submit', methods=['POST'])
@require_csrf  # ✅ CSRF-beskyttelse
def submit_varsel():
    payload = request.get_json()
    sak_id = payload.get('sakId')

    # ... resten av koden uendret ...

    return jsonify({"success": True, "sakId": sak_id}), 200

# Oppdater alle POST/PUT/DELETE endpoints
@app.route('/api/cases/<string:sakId>', methods=['PUT'])
@require_csrf  # ✅ CSRF-beskyttelse
def update_case(sakId):
    # ...
    pass
```

**Steg 3**: Frontend-integrasjon (eksempel)

```javascript
// Frontend: Hent CSRF-token ved sideinnlasting
let csrfToken = null;

async function fetchCsrfToken() {
    const response = await fetch('/api/csrf-token');
    const data = await response.json();
    csrfToken = data.csrfToken;
}

// Kall ved page load
fetchCsrfToken();

// Bruk token i POST-requests
async function submitVarsel(payload) {
    const response = await fetch('/api/varsel-submit', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken  // ✅ Inkluder CSRF-token
        },
        body: JSON.stringify(payload)
    });

    if (response.status === 403) {
        // CSRF-feil - hent ny token og prøv igjen
        await fetchCsrfToken();
        return submitVarsel(payload);
    }

    return response.json();
}
```

#### Network Tab Demonstrasjon

**Test 1**: POST uten CSRF-token
```http
POST /api/varsel-submit HTTP/1.1
Content-Type: application/json

{"sakId": "123", "status": "approved"}

→ 403 Forbidden
{
  "error": "CSRF validation failed",
  "detail": "CSRF token missing"
}
```

**Test 2**: POST med ugyldig token
```http
POST /api/varsel-submit HTTP/1.1
X-CSRF-Token: invalid-token-here
Content-Type: application/json

{"sakId": "123", "status": "approved"}

→ 403 Forbidden
{
  "error": "CSRF validation failed",
  "detail": "CSRF token malformed"
}
```

**Test 3**: POST med utløpt token
```http
POST /api/varsel-submit HTTP/1.1
X-CSRF-Token: abc:1637000000:xyz
Content-Type: application/json

{"sakId": "123", "status": "approved"}

→ 403 Forbidden
{
  "error": "CSRF validation failed",
  "detail": "CSRF token expired (age: 3700s > 3600s)"
}
```

**Test 4**: POST med gyldig token
```http
# Først: Hent token
GET /api/csrf-token HTTP/1.1

→ 200 OK
{
  "csrfToken": "aB3...xyz:1732320000:1a2b3c...",
  "expiresIn": 3600
}

# Deretter: Bruk token
POST /api/varsel-submit HTTP/1.1
X-CSRF-Token: aB3...xyz:1732320000:1a2b3c...
Content-Type: application/json

{"sakId": "123", "status": "approved"}

→ 200 OK
{
  "success": true,
  "sakId": "123"
}
```

#### Testing

```bash
# Test 1: Ingen token
curl -X POST http://localhost:5000/api/varsel-submit \
  -H "Content-Type: application/json" \
  -d '{"sakId":"123"}'

# Test 2: Hent gyldig token og bruk den
TOKEN=$(curl http://localhost:5000/api/csrf-token | jq -r .csrfToken)
curl -X POST http://localhost:5000/api/varsel-submit \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $TOKEN" \
  -d '{"sakId":"123"}'
```

---

### 1.3 Webhook Security (Secret Token)

**Kategori**: D. Integrasjonssikkerhet
**Demo-verdi**: ⭐⭐⭐⭐⭐
**Innsats**: 1 time
**Risiko**: Kritisk → Lav

#### Nåværende tilstand

```python
# backend/app.py:647-663
@app.route('/webhook/catenda', methods=['POST'])
def webhook():
    payload = request.get_json()
    # ❌ Ingen autentisering - aksepterer webhooks fra hvem som helst
```

**Problem**: Angriper kan sende falske webhooks og trigge automatisering.

#### Bakgrunn: Hvorfor ikke HMAC?

Catenda Webhook API har **ikke** felt for `secret` eller `signing_key` i webhook-konfigurasjon. Dette betyr:
- ❌ Ingen `X-Catenda-Signature` header
- ✅ Løsning: Secret Token i URL (`?token=...`)

Dette er standard "Plan B" når API ikke tilbyr innebygd signering.

#### Implementasjon

```python
# backend/webhook_security.py (NY FIL)
import os
from flask import request

# Webhook secret token (generer sterk token, lagre i .env)
WEBHOOK_SECRET_TOKEN = os.getenv("CATENDA_WEBHOOK_TOKEN", "")

def validate_webhook_token() -> tuple[bool, str]:
    """
    Valider Secret Token i URL query parameter.

    Catenda kaller URL: https://url.com/webhook/catenda?token=SECRET

    Returns:
        (valid, error_message)
    """
    # Hent token fra URL query parameter
    received_token = request.args.get("token", "")

    if not received_token:
        return False, "Missing token parameter in URL"

    if not WEBHOOK_SECRET_TOKEN:
        return False, "Server configuration error: WEBHOOK_SECRET_TOKEN not set"

    # Constant-time comparison (timing attack protection)
    import hmac
    if not hmac.compare_digest(received_token, WEBHOOK_SECRET_TOKEN):
        return False, "Invalid webhook token"

    return True, ""

# Idempotency tracking (in-memory for prototype, bruk Redis/database i prod)
processed_events = set()

def is_duplicate_event(event_id: str) -> bool:
    """Sjekk om event allerede er prosessert (idempotency)"""
    if event_id in processed_events:
        return True
    processed_events.add(event_id)
    # TODO: Legg til TTL cleanup (fjern events eldre enn 24t)
    return False
```

```python
# backend/app.py
from webhook_security import validate_webhook_token, is_duplicate_event

@app.route('/webhook/catenda', methods=['POST'])
def webhook():
    """
    POST /webhook/catenda?token=SECRET

    Mottar webhooks fra Catenda med token-validering og idempotency.
    """
    # 1. ✅ Valider Secret Token fra URL
    valid, error = validate_webhook_token()
    if not valid:
        app.logger.warning(f"Webhook token validation failed: {error}")
        return jsonify({"error": "Unauthorized", "detail": error}), 401

    # 2. Parse payload
    payload = request.get_json()

    # 3. Idempotency check
    # ✅ Catenda sender 'id' felt i webhook payload
    event_id = payload.get("id", "") or payload.get("eventId", "")
    if not event_id:
        return jsonify({"error": "Missing event id"}), 400

    if is_duplicate_event(event_id):
        app.logger.info(f"Duplicate webhook event: {event_id}")
        return jsonify({"status": "already_processed"}), 202

    # 4. Prosesser webhook
    # ✅ Catenda BCF API bruker 'event' felt (ikke 'eventType')
    event_name = payload.get('event', '')

    if event_name == 'issue.created':
        # Håndter ny BCF Topic
        pass
    elif event_name == 'issue.modified':
        # Håndter endret BCF Topic
        pass
    elif event_name == 'issue.status.changed':
        # Håndter statusendring
        pass

    return jsonify({"status": "processed"}), 200
```

#### Setup

1. **Generer sterk secret token**:
   ```bash
   python3 -c "import secrets; print(secrets.token_urlsafe(32))"
   # Output: f8vP3K9mX_TqL2wN7hZdR5jB1yC6aE4sU0gO8iM3
   ```

2. **Legg token i `.env`**:
   ```bash
   CATENDA_WEBHOOK_TOKEN=f8vP3K9mX_TqL2wN7hZdR5jB1yC6aE4sU0gO8iM3
   ```

3. **Registrer webhook i Catenda**:
   - **Target URL**: `https://your-domain.com/webhook/catenda?token=f8vP3K9mX_TqL2wN7hZdR5jB1yC6aE4sU0gO8iM3`
   - **Events**: `issue.created`, `issue.modified`, `issue.status.changed`

**Viktig**: Hold token hemmelig! Ikke commit til git.

#### Network Tab Demonstrasjon

**Test 1**: Webhook uten token
```http
POST /webhook/catenda HTTP/1.1
Content-Type: application/json

{"event": "issue.created", "id": "123"}

→ 401 Unauthorized
{
  "error": "Unauthorized",
  "detail": "Missing token parameter in URL"
}
```

**Test 2**: Webhook med feil token
```http
POST /webhook/catenda?token=wrong_token HTTP/1.1
Content-Type: application/json

{"event": "issue.created", "id": "123"}

→ 401 Unauthorized
{
  "error": "Unauthorized",
  "detail": "Invalid webhook token"
}
```

**Test 3**: Webhook med gyldig token
```http
POST /webhook/catenda?token=f8vP3K9mX_TqL2wN7hZdR5jB1yC6aE4sU0gO8iM3 HTTP/1.1
Content-Type: application/json

{"event": "issue.created", "id": "123"}

→ 200 OK
{
  "status": "processed"
}
```

**Test 4**: Duplikat webhook (idempotency)
```http
# Send samme event to ganger
POST /webhook/catenda?token=f8vP3K9mX_TqL2wN7hZdR5jB1yC6aE4sU0gO8iM3 HTTP/1.1
Content-Type: application/json

{"event": "issue.created", "id": "123"}

→ 202 Accepted (første gang: 200 OK, andre gang: 202)
{
  "status": "already_processed"
}
```

#### Testing

```bash
# Test 1: Ingen token
curl -X POST 'http://localhost:5000/webhook/catenda' \
  -H "Content-Type: application/json" \
  -d '{"event":"issue.created","id":"123"}'
# → 401 Unauthorized

# Test 2: Feil token
curl -X POST 'http://localhost:5000/webhook/catenda?token=wrong' \
  -H "Content-Type: application/json" \
  -d '{"event":"issue.created","id":"123"}'
# → 401 Unauthorized

# Test 3: Gyldig token
curl -X POST 'http://localhost:5000/webhook/catenda?token=f8vP3K9mX_TqL2wN7hZdR5jB1yC6aE4sU0gO8iM3' \
  -H "Content-Type: application/json" \
  -d '{"event":"issue.created","id":"123"}'
# → 200 OK
```

---

### 1.4 Request Validation (Input Sanitization)

**Kategori**: E. Observability (delvis), generell sikkerhet
**Demo-verdi**: ⭐⭐⭐⭐
**Innsats**: 2-3 timer
**Risiko**: Høy → Moderat

#### Nåværende tilstand

```python
@app.route('/api/varsel-submit', methods=['POST'])
def submit_varsel():
    payload = request.get_json()
    sak_id = payload.get('sakId')  # ❌ Ingen validering
```

**Problem**: Ugyldig/ondsinnet input kan forårsake crashes, injeksjon, eller datakorrups.

#### Implementasjon

```python
# backend/validation.py (NY FIL)
from typing import Any, Dict
import re

class ValidationError(Exception):
    """Custom exception for validation errors"""
    def __init__(self, field: str, message: str):
        self.field = field
        self.message = message
        super().__init__(f"{field}: {message}")

def validate_sak_id(sak_id: Any) -> str:
    """
    Valider sakId:
    - Må være string
    - Kun alfanumerisk + bindestrek + underscore
    - Lengde 1-50 tegn
    """
    if not isinstance(sak_id, str):
        raise ValidationError("sakId", "Must be string")

    if not sak_id:
        raise ValidationError("sakId", "Cannot be empty")

    if len(sak_id) > 50:
        raise ValidationError("sakId", "Max length 50 characters")

    if not re.match(r'^[a-zA-Z0-9_-]+$', sak_id):
        raise ValidationError("sakId", "Only alphanumeric, dash, underscore allowed")

    return sak_id

def validate_status(status: Any) -> str:
    """Valider status"""
    ALLOWED_STATUSES = ["draft", "submitted", "approved", "rejected", "completed"]

    if not isinstance(status, str):
        raise ValidationError("status", "Must be string")

    if status not in ALLOWED_STATUSES:
        raise ValidationError("status", f"Must be one of: {ALLOWED_STATUSES}")

    return status

def validate_email(email: Any) -> str:
    """Valider e-postadresse"""
    if not isinstance(email, str):
        raise ValidationError("email", "Must be string")

    # Basic regex (ikke perfekt, men OK for prototype)
    if not re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', email):
        raise ValidationError("email", "Invalid email format")

    return email.lower().strip()

def validate_varsel_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Valider varsel-submit payload.

    Returns:
        Validert og sanitized payload

    Raises:
        ValidationError hvis ugyldig
    """
    if not isinstance(payload, dict):
        raise ValidationError("payload", "Must be JSON object")

    validated = {}

    # Required fields
    validated['sakId'] = validate_sak_id(payload.get('sakId'))
    validated['status'] = validate_status(payload.get('status'))

    # Optional fields
    if 'email' in payload:
        validated['email'] = validate_email(payload['email'])

    if 'comment' in payload:
        comment = payload['comment']
        if not isinstance(comment, str):
            raise ValidationError("comment", "Must be string")
        if len(comment) > 5000:
            raise ValidationError("comment", "Max length 5000 characters")
        validated['comment'] = comment.strip()

    return validated
```

```python
# backend/app.py
from validation import validate_varsel_payload, ValidationError

@app.route('/api/varsel-submit', methods=['POST'])
@require_csrf
def submit_varsel():
    """POST /api/varsel-submit - Submit varsel with validation"""

    try:
        # Parse JSON
        payload = request.get_json()
        if payload is None:
            return jsonify({"error": "Invalid JSON"}), 400

        # ✅ Validate and sanitize
        validated = validate_varsel_payload(payload)
        sak_id = validated['sakId']
        status = validated['status']

    except ValidationError as e:
        return jsonify({
            "error": "Validation failed",
            "field": e.field,
            "message": e.message
        }), 400
    except Exception as e:
        app.logger.error(f"Unexpected error in submit_varsel: {e}")
        return jsonify({"error": "Internal server error"}), 500

    # ... resten av koden med validert data ...

    return jsonify({"success": True, "sakId": sak_id}), 200
```

#### Network Tab Demonstrasjon

**Test 1**: Ugyldig sakId (SQL injection attempt)
```http
POST /api/varsel-submit HTTP/1.1
X-CSRF-Token: <valid_token>
Content-Type: application/json

{"sakId": "'; DROP TABLE cases; --", "status": "approved"}

→ 400 Bad Request
{
  "error": "Validation failed",
  "field": "sakId",
  "message": "Only alphanumeric, dash, underscore allowed"
}
```

**Test 2**: Ugyldig status
```http
POST /api/varsel-submit HTTP/1.1
X-CSRF-Token: <valid_token>
Content-Type: application/json

{"sakId": "ABC123", "status": "hacked"}

→ 400 Bad Request
{
  "error": "Validation failed",
  "field": "status",
  "message": "Must be one of: ['draft', 'submitted', 'approved', 'rejected', 'completed']"
}
```

**Test 3**: Gyldig payload
```http
POST /api/varsel-submit HTTP/1.1
X-CSRF-Token: <valid_token>
Content-Type: application/json

{"sakId": "ABC-123", "status": "approved", "comment": "OK"}

→ 200 OK
{
  "success": true,
  "sakId": "ABC-123"
}
```

---

## Medium Priority (Fase 2: 3-5 dager)

### 2.1 Magic Link (One-time + TTL)

**Kategori**: B. Autentisering
**Demo-verdi**: ⭐⭐⭐⭐⭐
**Innsats**: 1 dag
**Risiko**: Kritisk → Lav

#### Implementasjon

Se [Detaljert Magic Link Implementasjon](#appendix-a-magic-link-implementasjon) i Appendix A.

Nøkkelfunksjoner:
- UUID v4 token generation
- TTL ≤ 72 timer
- One-time use (revokering etter bruk)
- Automatic revokering ved statusendring
- Personlig lenke (1:1 binding til e-post)

#### Network Tab Demonstrasjon

```http
# 1. Generer magic link
POST /api/magic-link/generate HTTP/1.1
Content-Type: application/json

{"email": "te@example.com", "sakId": "ABC123"}

→ 200 OK
{
  "message": "Magic link sent to te@example.com",
  "expiresAt": "2025-11-26T10:00:00Z"
}

# 2. Bruk magic link (første gang)
GET /api/magic-link/verify?token=abc123...&email=te@example.com HTTP/1.1

→ 200 OK
Set-Cookie: session=xyz...; HttpOnly; Secure; SameSite=Strict
{
  "success": true,
  "user": {"email": "te@example.com", "role": "TE"}
}

# 3. Bruk samme link igjen (replay attack)
GET /api/magic-link/verify?token=abc123...&email=te@example.com HTTP/1.1

→ 403 Forbidden
{
  "error": "Token already used or revoked"
}
```

---

### 2.2 Project-Scope Authorization

**Kategori**: A. Autorisasjon
**Demo-verdi**: ⭐⭐⭐⭐
**Innsats**: 1 dag
**Risiko**: Høy → Lav

#### Implementasjon

```python
# backend/authorization.py (NY FIL)
from flask import request, jsonify, g
from functools import wraps

def require_project_access(f):
    """
    Decorator: Sjekk at bruker har tilgang til prosjekt.

    Forutsetter at session inneholder user info og at
    request context har sakId som mapper til et prosjekt.
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Hent bruker fra session (satt av magic link)
        user = g.get('user')  # {'email': '...', 'role': 'TE', 'project_id': 'proj123'}

        if not user:
            return jsonify({"error": "Unauthorized - not authenticated"}), 401

        # Hent sakId fra path eller body
        sak_id = kwargs.get('sakId') or request.get_json().get('sakId')

        if not sak_id:
            return jsonify({"error": "Missing sakId"}), 400

        # Hent sak fra database
        sys = get_system()
        sak = sys.db.get_form_data(sak_id)

        if not sak:
            return jsonify({"error": "Case not found"}), 404

        # Sjekk at sak tilhører brukerens prosjekt
        if sak.get('project_id') != user.get('project_id'):
            return jsonify({
                "error": "Forbidden - case belongs to different project"
            }), 403

        # OK - proceed
        return f(*args, **kwargs)

    return decorated_function

@app.route('/api/cases/<string:sakId>', methods=['GET'])
@require_project_access  # ✅ Project-scope check
def get_case(sakId):
    # Bruker har tilgang til dette prosjektet
    sys = get_system()
    data = sys.db.get_form_data(sakId)
    return jsonify(data), 200
```

#### Network Tab Demonstrasjon

```http
# 1. Autentiser som TE i prosjekt A
GET /api/magic-link/verify?token=...&email=te@example.com
→ 200 OK, session cookie satt

# 2. Hent sak i prosjekt A (OK)
GET /api/cases/SAK_A_123 HTTP/1.1
Cookie: session=xyz...

→ 200 OK
{
  "sakId": "SAK_A_123",
  "project_id": "proj_A",
  "title": "..."
}

# 3. Forsøk å hente sak i prosjekt B (Forbidden)
GET /api/cases/SAK_B_456 HTTP/1.1
Cookie: session=xyz...

→ 403 Forbidden
{
  "error": "Forbidden - case belongs to different project"
}
```

---

### 2.3 Rate Limiting

**Kategori**: C. Nettverkskontroll
**Demo-verdi**: ⭐⭐⭐⭐
**Innsats**: 4-6 timer
**Risiko**: Høy → Moderat

#### Implementasjon

```python
# requirements.txt
Flask-Limiter==3.5.0

# backend/app.py
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"],
    storage_uri="memory://"  # For prototype; bruk Redis i prod
)

# Spesifikke limits per endpoint
@app.route('/api/varsel-submit', methods=['POST'])
@limiter.limit("10 per minute")  # ✅ Rate limit
@require_csrf
def submit_varsel():
    # ...
    pass

@app.route('/webhook/catenda', methods=['POST'])
@limiter.limit("100 per minute")  # ✅ Høyere limit for webhooks
def webhook():
    # ...
    pass

@app.route('/api/magic-link/generate', methods=['POST'])
@limiter.limit("5 per hour")  # ✅ Streng limit for magic link
def generate_magic_link():
    # ...
    pass
```

#### Network Tab Demonstrasjon

```http
# Send 11 requests på 1 minutt
POST /api/varsel-submit (request 1-10)
→ 200 OK
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 9, 8, 7, ..., 0

POST /api/varsel-submit (request 11)
→ 429 Too Many Requests
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1732320060

{
  "error": "Rate limit exceeded. Try again in 45 seconds."
}
```

---

### 2.4 Audit Logging

**Kategori**: E. Observability
**Demo-verdi**: ⭐⭐⭐
**Innsats**: 1 dag
**Risiko**: Moderat (compliance)

#### Implementasjon

```python
# backend/audit.py (NY FIL)
import json
from datetime import datetime
from typing import Dict, Any

class AuditLogger:
    """Strukturert audit logging for compliance"""

    def __init__(self, log_file="audit.log"):
        self.log_file = log_file

    def log_event(
        self,
        event_type: str,
        user: str,
        resource: str,
        action: str,
        result: str,
        details: Dict[str, Any] = None
    ):
        """
        Log security event.

        Args:
            event_type: "auth", "access", "modify", "admin"
            user: User identifier (email)
            resource: Resource accessed (e.g., "case:ABC123")
            action: Action performed (e.g., "read", "update", "delete")
            result: "success" or "denied"
            details: Additional context
        """
        entry = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "event_type": event_type,
            "user": user,
            "resource": resource,
            "action": action,
            "result": result,
            "ip": request.remote_addr if hasattr(request, 'remote_addr') else None,
            "user_agent": request.headers.get('User-Agent') if hasattr(request, 'headers') else None,
            "details": details or {}
        }

        # Skriv til fil (JSON Lines format)
        with open(self.log_file, 'a') as f:
            f.write(json.dumps(entry) + '\n')

audit = AuditLogger()

# Bruk i endpoints
@app.route('/api/cases/<string:sakId>', methods=['GET'])
@require_project_access
def get_case(sakId):
    user = g.get('user', {})

    # ... hent data ...

    # ✅ Log suksess
    audit.log_event(
        event_type="access",
        user=user.get('email', 'unknown'),
        resource=f"case:{sakId}",
        action="read",
        result="success"
    )

    return jsonify(data), 200

# Log failed attempts
@app.errorhandler(403)
def forbidden(error):
    user = g.get('user', {})

    # ✅ Log denial
    audit.log_event(
        event_type="access",
        user=user.get('email', 'anonymous'),
        resource=request.path,
        action=request.method,
        result="denied",
        details={"error": str(error)}
    )

    return jsonify({"error": "Forbidden"}), 403
```

#### Audit Log Eksempel

```json
{"timestamp":"2025-11-23T10:15:30Z","event_type":"access","user":"te@example.com","resource":"case:ABC123","action":"read","result":"success","ip":"192.168.1.100","user_agent":"Mozilla/5.0...","details":{}}
{"timestamp":"2025-11-23T10:16:45Z","event_type":"access","user":"bh@example.com","resource":"case:ABC123","action":"update","result":"denied","ip":"192.168.1.101","user_agent":"Mozilla/5.0...","details":{"error":"TE-locked field"}}
```

#### Network Tab Demonstrasjon

Audit logging er ikke direkte synlig i Network tab, men kan demonstreres ved:

1. Utfør operasjon (GET /api/cases/123)
2. Vis `audit.log` fil i sanntid (tail -f)
3. Verifiser at hendelse er logget med riktig metadata

---

## Long-term (Fase 3: 1-2 uker)

### 3.1 Entra ID SSO (OIDC)

**Kategori**: B. Autentisering
**Demo-verdi**: ⭐⭐⭐
**Innsats**: 3-5 dager
**Risiko**: Høy → Lav

#### Implementasjon

Krever:
- Azure AD app registrering
- MSAL.js (frontend) eller authlib (backend)
- ID token validering
- Claims mapping (email, roles)

**Omfattende** - krever egen guide. Se Microsoft docs for Flask + MSAL.

#### Network Tab Demonstrasjon

```http
# 1. Redirect til Entra ID
GET /login HTTP/1.1
→ 302 Redirect
Location: https://login.microsoftonline.com/...

# 2. Callback med authorization code
GET /auth/callback?code=abc123... HTTP/1.1
→ (Backend veksler code til tokens)

# 3. Session etablert
→ 302 Redirect
Location: /
Set-Cookie: session=...; HttpOnly; Secure
```

---

### 3.2 Role-Based Field Locking (TE vs BH)

**Kategori**: A. Autorisasjon
**Demo-verdi**: ⭐⭐⭐⭐
**Innsats**: 2-3 dager
**Risiko**: Høy → Lav

#### Implementasjon

```python
# backend/field_permissions.py (NY FIL)
"""
Felt-nivå tilgangskontroll for TE vs BH roller.

Basert på dokumentasjon:
- TE kan ikke redigere BH-felter (kostnader, signatur)
- BH kan ikke redigere TE-låste felter etter innsending
"""

# Definer felt-rettigheter
TE_LOCKED_FIELDS = [
    "title",
    "description",
    "attachments",
    "technical_details"
]

BH_ONLY_FIELDS = [
    "cost_estimate",
    "cost_approved",
    "bh_signature",
    "bh_comments"
]

def validate_field_access(role: str, payload: dict, current_status: str) -> tuple[bool, str]:
    """
    Sjekk om bruker med gitt rolle kan oppdatere feltene i payload.

    Args:
        role: "TE" eller "BH"
        payload: Felter som skal oppdateres
        current_status: Nåværende sakstatus

    Returns:
        (allowed, error_message)
    """
    if role == "TE":
        # TE kan aldri redigere BH-felter
        for field in BH_ONLY_FIELDS:
            if field in payload:
                return False, f"TE cannot modify BH field: {field}"

    elif role == "BH":
        # BH kan ikke redigere TE-låste felter etter innsending
        if current_status in ["submitted", "approved", "rejected"]:
            for field in TE_LOCKED_FIELDS:
                if field in payload:
                    return False, f"BH cannot modify TE-locked field after submission: {field}"

    return True, ""

# Bruk i endpoint
@app.route('/api/cases/<string:sakId>', methods=['PUT'])
@require_csrf
@require_project_access
def update_case(sakId):
    user = g.get('user', {})
    role = user.get('role', '')

    payload = request.get_json()

    # Hent nåværende sak
    sys = get_system()
    current = sys.db.get_form_data(sakId)

    if not current:
        return jsonify({"error": "Case not found"}), 404

    # ✅ Valider felt-tilgang
    allowed, error = validate_field_access(role, payload, current.get('status'))
    if not allowed:
        audit.log_event(
            event_type="modify",
            user=user.get('email'),
            resource=f"case:{sakId}",
            action="update",
            result="denied",
            details={"error": error, "attempted_fields": list(payload.keys())}
        )
        return jsonify({"error": error}), 403

    # ... oppdater sak ...

    return jsonify({"success": True}), 200
```

#### Network Tab Demonstrasjon

```http
# TE forsøker å oppdatere BH-felt
PUT /api/cases/ABC123 HTTP/1.1
X-CSRF-Token: <valid>
Cookie: session=<te_session>
Content-Type: application/json

{
  "title": "Updated title",
  "cost_approved": 50000  # ❌ BH-only felt
}

→ 403 Forbidden
{
  "error": "TE cannot modify BH field: cost_approved"
}

# BH forsøker å oppdatere TE-felt etter innsending
PUT /api/cases/ABC123 HTTP/1.1
X-CSRF-Token: <valid>
Cookie: session=<bh_session>
Content-Type: application/json

{
  "cost_approved": 50000,
  "technical_details": "Changed"  # ❌ TE-locked etter submit
}

→ 403 Forbidden
{
  "error": "BH cannot modify TE-locked field after submission: technical_details"
}
```

---

## Network Tab Demonstrasjon

### Oppsummering: Hva som er synlig i Network Tab

| Sikkerhetstiltak | Header/Response Element | Verdi/Status |
|------------------|------------------------|--------------|
| **CORS** | `Access-Control-Allow-Origin` | `http://localhost:3000` (ikke `*`) |
| **CSRF** | `X-CSRF-Token` (request) | `abc:1732320000:1a2b3c...` |
| **CSRF** | `403` ved ugyldig token | `{"error":"CSRF validation failed"}` |
| **Webhook HMAC** | `X-Catenda-Signature` | `sha256=...` |
| **Webhook HMAC** | `401` ved ugyldig sig | `{"error":"Invalid signature"}` |
| **Idempotency** | `202` ved duplikat | `{"status":"already_processed"}` |
| **Validation** | `400` ved ugyldig input | `{"field":"sakId","message":"..."}` |
| **Magic Link** | `Set-Cookie: session=...` | `HttpOnly; Secure; SameSite=Strict` |
| **Magic Link** | `403` ved replay | `{"error":"Token already used"}` |
| **Authorization** | `403` ved feil prosjekt | `{"error":"Forbidden - different project"}` |
| **Rate Limiting** | `X-RateLimit-Remaining` | `9, 8, 7, ..., 0` |
| **Rate Limiting** | `429` ved overskridelse | `{"error":"Rate limit exceeded"}` |
| **Field Locking** | `403` ved BH-felt som TE | `{"error":"TE cannot modify BH field"}` |

### Demo-scenario: Full Sikkerhetskjede

**Scenario**: TE oppdaterer endringsmelding

```http
# 1. Hent CSRF-token
GET /api/csrf-token
→ 200 OK
{"csrfToken":"abc:1732320000:xyz","expiresIn":3600}

# 2. Autentiser med Magic Link
GET /api/magic-link/verify?token=...&email=te@example.com
→ 200 OK
Set-Cookie: session=...; HttpOnly; Secure; SameSite=Strict

# 3. Hent sak (med authorization check)
GET /api/cases/ABC123
Cookie: session=...
→ 200 OK
{"sakId":"ABC123","project_id":"proj_A","title":"..."}

# 4. Oppdater sak (validering + field locking + audit)
PUT /api/cases/ABC123
Cookie: session=...
X-CSRF-Token: abc:1732320000:xyz
Content-Type: application/json

{
  "title": "Updated Title",
  "technical_details": "Updated details"
}

→ 200 OK
{"success":true}

# 5. Forsøk å oppdatere BH-felt (skal feile)
PUT /api/cases/ABC123
Cookie: session=...
X-CSRF-Token: abc:1732320000:xyz
Content-Type: application/json

{"cost_approved":50000}

→ 403 Forbidden
{"error":"TE cannot modify BH field: cost_approved"}

# 6. Sjekk rate limit headers
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1732320120
```

---

## Testing og Verifikasjon

### Automated Testing

```python
# tests/test_security.py
import pytest
from app import app

@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

def test_csrf_protection(client):
    """Test at POST uten CSRF-token blokkeres"""
    response = client.post('/api/varsel-submit', json={
        'sakId': 'ABC123',
        'status': 'approved'
    })
    assert response.status_code == 403
    assert b'CSRF' in response.data

def test_webhook_token_validation(client):
    """Test at webhook uten token avvises"""
    response = client.post('/webhook/catenda', json={
        'event': 'issue.created',
        'id': '123'
    })
    assert response.status_code == 401
    assert b'token' in response.data.lower()

def test_webhook_invalid_token(client):
    """Test at webhook med feil token avvises"""
    response = client.post('/webhook/catenda?token=wrong', json={
        'event': 'issue.created',
        'id': '123'
    })
    assert response.status_code == 401

def test_input_validation(client):
    """Test at SQL injection blokkeres"""
    # Hent gyldig CSRF-token først
    token_response = client.get('/api/csrf-token')
    token = token_response.json['csrfToken']

    response = client.post('/api/varsel-submit',
        json={'sakId': "'; DROP TABLE cases; --", 'status': 'approved'},
        headers={'X-CSRF-Token': token}
    )
    assert response.status_code == 400
    assert b'alphanumeric' in response.data.lower()
```

### Manual Testing Checklist

```markdown
## Security Testing Checklist

### CORS
- [ ] Request fra tillatt origin → 200 OK med CORS headers
- [ ] Request fra ikke-tillatt origin → Blokkert av browser
- [ ] Preflight OPTIONS request → Riktige headers

### CSRF
- [ ] POST uten token → 403
- [ ] POST med ugyldig token → 403
- [ ] POST med utløpt token (>1t) → 403
- [ ] POST med gyldig token → 200

### Webhook Security
- [ ] Webhook uten X-Catenda-Signature → 401
- [ ] Webhook med feil signatur → 401
- [ ] Webhook med gyldig signatur → 200
- [ ] Duplikat webhook (samme eventId) → 202

### Input Validation
- [ ] Ugyldig sakId (SQL injection) → 400
- [ ] Ugyldig status (ulovlig verdi) → 400
- [ ] Ugyldig e-post → 400
- [ ] Gyldig input → 200

### Magic Link
- [ ] Generering med ugyldig e-post → 400
- [ ] Verifisering med utløpt token (>72t) → 403
- [ ] Verifisering av brukt token → 403
- [ ] Verifisering med gyldig token → 200 + session cookie

### Authorization
- [ ] Uautentisert bruker → 401
- [ ] Autentisert bruker, feil prosjekt → 403
- [ ] Autentisert bruker, riktig prosjekt → 200

### Rate Limiting
- [ ] 10 requests → Header viser 0 remaining
- [ ] 11. request → 429
- [ ] Vent 1 minutt → Header resettes

### Field Locking
- [ ] TE oppdaterer BH-felt → 403
- [ ] BH oppdaterer TE-felt etter submit → 403
- [ ] TE oppdaterer egne felter → 200
```

---

## Appendix A: Magic Link Implementasjon

```python
# backend/magic_link.py
import uuid
import secrets
from datetime import datetime, timedelta
from typing import Optional, Dict

class MagicLinkManager:
    """
    Håndterer generering og validering av Magic Links.

    Features:
    - UUID v4 tokens
    - TTL ≤ 72 timer
    - One-time use (revokering)
    - Personlig (1:1 e-post binding)
    """

    def __init__(self):
        # In-memory storage (bruk database i prod)
        self.tokens: Dict[str, Dict] = {}

    def generate(self, email: str, sak_id: str, ttl_hours: int = 72) -> str:
        """
        Generer Magic Link token.

        Args:
            email: E-postadresse (normalisert)
            sak_id: Sak som lenken gir tilgang til
            ttl_hours: Time-to-live (max 72)

        Returns:
            Token (UUID v4)
        """
        if ttl_hours > 72:
            raise ValueError("TTL cannot exceed 72 hours")

        # Normaliser e-post
        email = email.lower().strip()

        # Generer UUID v4
        token = str(uuid.uuid4())

        # Lagre token metadata
        self.tokens[token] = {
            "email": email,
            "sak_id": sak_id,
            "created_at": datetime.utcnow(),
            "expires_at": datetime.utcnow() + timedelta(hours=ttl_hours),
            "used": False,
            "revoked": False
        }

        return token

    def verify(self, token: str, email: str) -> tuple[bool, str, Optional[Dict]]:
        """
        Verifiser Magic Link token.

        Args:
            token: Token fra URL
            email: E-post fra URL (må matche)

        Returns:
            (valid, error_message, user_data)
        """
        # Normaliser e-post
        email = email.lower().strip()

        # Sjekk at token eksisterer
        if token not in self.tokens:
            return False, "Invalid token", None

        meta = self.tokens[token]

        # Sjekk at e-post matcher (1:1 binding)
        if meta["email"] != email:
            return False, "Token does not match email", None

        # Sjekk at token ikke er revokert
        if meta["revoked"]:
            return False, "Token has been revoked", None

        # Sjekk at token ikke er brukt (one-time)
        if meta["used"]:
            return False, "Token already used", None

        # Sjekk at token ikke er utløpt (TTL)
        if datetime.utcnow() > meta["expires_at"]:
            return False, f"Token expired at {meta['expires_at'].isoformat()}Z", None

        # ✅ Gyldig token - marker som brukt
        meta["used"] = True
        meta["used_at"] = datetime.utcnow()

        # Return user data
        user_data = {
            "email": meta["email"],
            "sak_id": meta["sak_id"],
            "role": "TE"  # TODO: Lookup fra Catenda
        }

        return True, "", user_data

    def revoke(self, token: str):
        """Revoke token (ved statusendring)"""
        if token in self.tokens:
            self.tokens[token]["revoked"] = True
            self.tokens[token]["revoked_at"] = datetime.utcnow()

# Integrasjon i app.py
magic_link_mgr = MagicLinkManager()

@app.route('/api/magic-link/generate', methods=['POST'])
@limiter.limit("5 per hour")
def generate_magic_link():
    """POST /api/magic-link/generate"""
    payload = request.get_json()

    email = payload.get('email', '').lower().strip()
    sak_id = payload.get('sakId', '')

    if not email or not sak_id:
        return jsonify({"error": "Missing email or sakId"}), 400

    # Generer token
    token = magic_link_mgr.generate(email, sak_id, ttl_hours=72)

    # Bygg URL
    base_url = "https://byggeprosjekt.azurewebsites.net"  # TODO: fra config
    magic_url = f"{base_url}/verify?token={token}&email={email}"

    # TODO: Send e-post med magic_url

    expires_at = datetime.utcnow() + timedelta(hours=72)

    return jsonify({
        "message": f"Magic link sent to {email}",
        "expiresAt": expires_at.isoformat() + "Z"
    }), 200

@app.route('/api/magic-link/verify', methods=['GET'])
def verify_magic_link():
    """GET /api/magic-link/verify?token=...&email=..."""
    token = request.args.get('token', '')
    email = request.args.get('email', '')

    valid, error, user_data = magic_link_mgr.verify(token, email)

    if not valid:
        return jsonify({"error": error}), 403

    # Opprett session
    session['user'] = user_data

    return jsonify({
        "success": True,
        "user": user_data
    }), 200
```

---

## Appendix B: Implementeringsrekkefølge

### Uke 1: Quick Wins
- **Dag 1**: CORS + Request Validation
- **Dag 2**: CSRF-beskyttelse
- **Dag 3**: Webhook HMAC + Idempotency
- **Dag 4**: Testing + dokumentasjon
- **Dag 5**: Demo til stakeholders

### Uke 2: Medium Priority
- **Dag 6-7**: Magic Link (generering + verifisering)
- **Dag 8**: Project-scope authorization
- **Dag 9**: Rate limiting + Audit logging
- **Dag 10**: Testing + dokumentasjon

### Uke 3-4: Long-term (valgfritt)
- **Dag 11-15**: Entra ID SSO
- **Dag 16-18**: Role-based field locking
- **Dag 19-20**: E2E testing + dokumentasjon

---

## Konklusjon

Denne handlingsplanen prioriterer sikkerhetstiltak som:

1. ✅ **Kan demonstreres** via Network tab (headers, status codes, response bodies)
2. ✅ **Gir høy sikkerhet** (CSRF, webhook validation, authorization)
3. ✅ **Lav implementeringskostnad** (1-2 dager per fase)
4. ✅ **Følger Beslutningsmatrisen** fra arkitekturdokumentasjonen

**Neste steg**: Start med Fase 1 (Quick Wins) for å demonstrere sikkerhetsforbedringer raskt.

---

**Vedlikeholdt av**: Claude
**Sist oppdatert**: 2025-11-23
**Status**: Klar for implementering
