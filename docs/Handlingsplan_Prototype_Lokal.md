# Handlingsplan: Sikkerhetstiltak for Lokal Prototype

**Dato**: 2025-11-23
**Prototype-kontekst**:
- Backend kjører lokalt (Flask på PC)
- Eksponert via ngrok
- Autentisering via Catenda OAuth token (1 time varighet)
- Lagring: CSV-filer
- Ingen Entra ID / Azure / Dataverse

---

## Innholdsfortegnelse

1. [Hva er realistisk for lokal prototype?](#hva-er-realistisk-for-lokal-prototype)
2. [Prioriterte tiltak for prototype](#prioriterte-tiltak-for-prototype)
3. [Implementasjon: Quick Wins](#implementasjon-quick-wins)
4. [Implementasjon: Medium Priority](#implementasjon-medium-priority)
5. [Demo-scenarios for Network Tab](#demo-scenarios-for-network-tab)
6. [Testing](#testing)

---

## ⚠️ API-korrigeringer (Kvalitetssikret mot Catenda API)

Følgende korrigeringer er gjort basert på faktiske Catenda API-spesifikasjoner:

### 1. Autentisering (validate_catenda_token)
- ❌ **Feil**: Brukte `/users/me` (eksisterer ikke)
- ✅ **Korrigert**: Bruker `/opencde/foundation/1.0/current-user`
- **Response**: `{id: "email@example.com", name: "Full Name"}`

### 2. Rolle-sjekk (get_user_role_in_project)
- ❌ **Feil**: Antok at `member.role` ville gi "Engineer"/"Manager"
- ✅ **Korrigert**: Sjekker Team-medlemskap via:
  - `GET /v2/projects/{id}/teams` (henter alle teams)
  - `GET /v2/projects/{pid}/teams/{tid}/members/{uid}` (sjekker medlemskap)
  - Logikk: Finn team med "TE"/"BH" i navnet

### 3. Webhook Events
- ❌ **Feil**: Brukte `eventType: "TopicCreatedEvent"`
- ✅ **Korrigert**: Bruker `event` feltet med verdier:
  - `"issue.created"` (BCF Topic opprettet)
  - `"issue.modified"` (BCF Topic endret)
  - `"issue.status.changed"` (Status endret)

### 4. Webhook Security
- ❌ **Feil**: Antok HMAC-signatur i `X-Catenda-Signature` header
- ✅ **Korrigert**: Catenda API støtter **ikke** signering. Bruk Secret Token i URL:
  - Registrer URL: `https://ngrok.io/webhook/catenda?token=SECRET`
  - Valider `token` query parameter i backend
  - Dette er standard "Plan B" når API ikke har innebygd signering

### 5. Datamodell (Topic API / BCF)
- ❌ **Feil**: Brukte `status`, tillot bindestreker i ID
- ✅ **Korrigert**:
  - Bruk `topic_status` (BCF-standard)
  - Gyldige statuser: `"Draft"`, `"Open"`, `"Active"`, `"Resolved"`, `"Closed"`
  - ID format: 32 hex chars (compacted UUID, uten bindestreker)
  - Required felt: `title`
  - Custom fields (`cost_approved` etc.) håndteres separat

**Referanser**:
- API-reference-auth.yaml → OpenCDE Foundation API
- Project API.yaml → Teams og medlemskap
- Webhook API.yaml → Event-typer
- Topic API.yaml → BCF Topic schema

---

## Hva er realistisk for lokal prototype?

### ✅ Aktuelt (kan implementeres nå)

| Tiltak | Kompleksitet | Demo-verdi | Kommentar |
|--------|--------------|------------|-----------|
| **CSRF-beskyttelse** | Lav | ⭐⭐⭐⭐⭐ | Fungerer perfekt med ngrok |
| **Request validation** | Lav | ⭐⭐⭐⭐ | Essensielt for CSV-lagring |
| **Webhook Secret Token** | Lav | ⭐⭐⭐⭐⭐ | Token i URL (Catenda → ngrok) |
| **Rate limiting (in-memory)** | Lav | ⭐⭐⭐⭐ | Beskytter lokal Flask |
| **Audit logging (CSV/JSON)** | Lav | ⭐⭐⭐ | Skriv til lokal fil |
| **Catenda token validation** | Moderat | ⭐⭐⭐⭐⭐ | Sjekk token expiry |
| **Project-scope check** | Moderat | ⭐⭐⭐⭐ | Via Catenda API |
| **Role-based field locking** | Moderat | ⭐⭐⭐⭐ | TE/BH fra Catenda |
| **CORS (dynamisk ngrok)** | Lav | ⭐⭐⭐ | Må tillate ngrok URL |

### ❌ Ikke aktuelt (krever cloud infrastruktur)

| Tiltak | Hvorfor ikke? | Alternativ for prototype |
|--------|---------------|--------------------------|
| **Magic Link** | Krever e-postutsending + HTTPS session | Bruk Catenda OAuth direkt |
| **Entra ID SSO** | Krever Azure AD | Bruk Catenda OAuth |
| **Secure session cookies** | ngrok = HTTP (ikke HTTPS lokalt) | Token i Authorization header |
| **Rate limiting (Redis)** | Krever Redis server | In-memory (Flask-Limiter) |
| **Application Insights** | Krever Azure | Lokal fil (JSON Lines) |

---

## Prioriterte tiltak for prototype

### Fase 1: Essensielle tiltak (4-6 timer)

**Mål**: Beskytte mot vanligste angrep og demonstrere sikkerhet i Network tab

1. **CSRF-beskyttelse** (2 timer)
   - Generer token ved sideinnlasting
   - Valider på alle POST/PUT/DELETE
   - Demo: 403 ved manglende token

2. **Request validation** (1.5 timer)
   - Valider topic_id (GUID), topic_status, feltverdier
   - Sanitize input før CSV-lagring
   - Demo: 400 ved SQL/CSV injection attempt

3. **Webhook Secret Token** (1 time)
   - Valider token i URL query parameter
   - Idempotency check (in-memory set)
   - Demo: 401 ved manglende/ugyldig token

### Fase 2: Autentisering og autorisasjon (6-8 timer)

**Mål**: Sikre at kun autoriserte brukere kan aksessere riktige data

4. **Catenda token validation** (2 timer)
   - Sjekk Authorization header
   - Valider token expiry
   - Refresh ved behov
   - Demo: 401 ved utgått token

5. **Project-scope authorization** (2-3 timer)
   - Hent project fra Catenda API
   - Sjekk at sak tilhører riktig prosjekt
   - Demo: 403 ved feil prosjekt

6. **Role-based field locking** (2-3 timer)
   - Hent rolle fra Catenda (TE/BH)
   - Blokkér BH-felter for TE
   - Blokkér TE-låste felter for BH etter submit
   - Demo: 403 ved ugyldig feltoppdatering

### Fase 3: Observability og resiliens (3-4 timer)

7. **Rate limiting** (1.5 timer)
   - Flask-Limiter med in-memory backend
   - 10 req/min på submit, 100 req/min på webhooks
   - Demo: 429 ved overskridelse

8. **Audit logging** (1.5 timer)
   - Strukturert logging til JSON fil
   - Log alle access/modify/denied events
   - Demo: Vis audit.log i sanntid

9. **CORS for ngrok** (1 time)
   - Dynamisk tillate ngrok URL
   - Tillate localhost:3000 (frontend dev)
   - Demo: Preflight OPTIONS request

---

## Implementasjon: Quick Wins

### 1. CSRF-beskyttelse

**Fungerer perfekt med ngrok** - ingen HTTPS-krav for header-basert CSRF.

#### Backend implementasjon

```python
# backend/csrf_protection.py (SAMME SOM FULL HANDLINGSPLAN)
import secrets
import hmac
import hashlib
from datetime import datetime, timedelta
from flask import request, jsonify
from functools import wraps

CSRF_SECRET = "CHANGE_ME_IN_PRODUCTION"  # TODO: Flytt til .env

def generate_csrf_token() -> str:
    """Generer CSRF-token (32 bytes random + timestamp + HMAC)"""
    nonce = secrets.token_urlsafe(32)
    timestamp = int(datetime.utcnow().timestamp())
    message = f"{nonce}:{timestamp}"
    signature = hmac.new(
        CSRF_SECRET.encode(),
        message.encode(),
        hashlib.sha256
    ).hexdigest()
    return f"{nonce}:{timestamp}:{signature}"

def validate_csrf_token(token: str, max_age: int = 3600) -> tuple[bool, str]:
    """Valider CSRF-token"""
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

    # Sjekk alder
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
    """Decorator for å kreve CSRF-token"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
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

```python
# backend/app.py
from csrf_protection import generate_csrf_token, require_csrf

@app.route('/api/csrf-token', methods=['GET'])
def get_csrf_token():
    """Hent CSRF-token"""
    token = generate_csrf_token()
    return jsonify({
        "csrfToken": token,
        "expiresIn": 3600
    }), 200

@app.route('/api/varsel-submit', methods=['POST'])
@require_csrf  # ✅ CSRF-beskyttelse
def submit_varsel():
    payload = request.get_json()
    # ... resten av koden ...
    return jsonify({"success": True}), 200
```

#### Network Tab Demo

```http
# 1. Hent token
GET http://abc123.ngrok.io/api/csrf-token

→ 200 OK
{
  "csrfToken": "XYZ...:1732320000:abc123...",
  "expiresIn": 3600
}

# 2. POST uten token
POST http://abc123.ngrok.io/api/varsel-submit
Content-Type: application/json

{"sakId": "ABC123"}

→ 403 Forbidden
{
  "error": "CSRF validation failed",
  "detail": "CSRF token missing"
}

# 3. POST med gyldig token
POST http://abc123.ngrok.io/api/varsel-submit
X-CSRF-Token: XYZ...:1732320000:abc123...
Content-Type: application/json

{"sakId": "ABC123"}

→ 200 OK
```

---

### 2. Request Validation (kritisk for CSV-lagring!)

**CSV-lagring er spesielt sårbar** for injection og datakorrupsjon.

#### Implementasjon

```python
# backend/validation.py
import re
from typing import Any, Dict

class ValidationError(Exception):
    def __init__(self, field: str, message: str):
        self.field = field
        self.message = message
        super().__init__(f"{field}: {message}")

def validate_guid(val: Any) -> str:
    """
    Validerer GUID basert på Catenda/BCF standard.

    Ref Topic API: "compacted UUID using 32 hexadecimal characters"

    Tillater både compacted (32 hex) og standard UUID (36 med bindestreker)
    for fleksibilitet i prototype.
    """
    if not isinstance(val, str):
        raise ValidationError("guid", "Must be string")

    if not val:
        raise ValidationError("guid", "Cannot be empty")

    # ✅ Catenda bruker compacted UUID (32 hex), men tillater også standard (36)
    # Eksempel compacted: 18d0273de15c492497b36f47b233eebe
    # Eksempel standard: 18d0273d-e15c-4924-97b3-6f47b233eebe
    if not re.match(r'^[a-fA-F0-9-]{32,36}$', val):
        raise ValidationError("guid", "Invalid UUID format (expected 32-36 hex chars)")

    # Ekstra sikkerhet: Ikke tillat '..' (path traversal)
    if '..' in val or '/' in val or '\\' in val:
        raise ValidationError("guid", "Invalid characters")

    return val

def validate_csv_safe_string(value: Any, field_name: str, max_length: int = 500) -> str:
    """
    Valider at string er trygg for CSV-lagring.

    Beskytter mot:
    - CSV injection (=, +, -, @, tab, carriage return)
    - Newline injection
    - Kontrollkarakterer
    """
    if not isinstance(value, str):
        raise ValidationError(field_name, "Must be string")

    # Remove control characters (ASCII < 32, except space)
    cleaned = ''.join(char for char in value if ord(char) >= 32 or char == '\n')

    # Strip leading/trailing whitespace
    cleaned = cleaned.strip()

    if len(cleaned) > max_length:
        raise ValidationError(field_name, f"Max length {max_length} characters")

    # CSV Injection protection: Don't allow formulas
    if cleaned and cleaned[0] in ['=', '+', '-', '@', '\t', '\r']:
        raise ValidationError(field_name, "Cannot start with special characters (CSV injection)")

    # Replace internal newlines with space (for CSV single-line fields)
    cleaned = cleaned.replace('\n', ' ').replace('\r', ' ')

    return cleaned

def validate_topic_status(val: Any) -> str:
    """
    Validerer topic_status.

    Ref Topic API schemas/topic → topic_status

    Note: I en ekte app hentes gyldige statuser fra /extensions/statuses
    For prototype hardkoder vi standard BCF-flyt
    """
    # ✅ Standard BCF topic statuses
    ALLOWED = ["Open", "Closed", "Active", "Resolved", "Draft"]

    if not isinstance(val, str):
        raise ValidationError("topic_status", "Must be string")

    if val not in ALLOWED:
        raise ValidationError("topic_status", f"Must be one of: {ALLOWED}")

    return val

def validate_varsel_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Validerer payload for lagring til CSV.

    Struktur er oppdatert for å ligne på Catenda 'Topic' schema (BCF).
    """
    if not isinstance(payload, dict):
        raise ValidationError("payload", "Must be JSON object")

    validated = {}

    # ✅ 1. Identifikator (BCF bruker 'guid' eller 'topic_id')
    # Vi bruker 'topic_id' internt i CSV for klarhet
    if 'topic_id' in payload:
        validated['topic_id'] = validate_guid(payload['topic_id'])
    elif 'sakId' in payload:  # Bakoverkompatibilitet med frontend
        validated['topic_id'] = validate_guid(payload['sakId'])
    else:
        raise ValidationError("topic_id", "Missing topic_id (or sakId)")

    # ✅ 2. Status (BCF: topic_status)
    status_val = payload.get('topic_status') or payload.get('status')
    if not status_val:
        raise ValidationError("topic_status", "Missing topic_status (or status)")
    validated['topic_status'] = validate_topic_status(status_val)

    # ✅ 3. Tittel (BCF: title) - Required
    title = payload.get('title')
    if not title or not isinstance(title, str):
        raise ValidationError("title", "Title is required")
    validated['title'] = validate_csv_safe_string(title, 'title', 255)

    # 4. Beskrivelse (BCF: description)
    if 'description' in payload:
        validated['description'] = validate_csv_safe_string(payload['description'], 'description', 5000)

    # 5. Custom fields (Prototype-spesifikt)
    # Disse eksisterer ikke direkte i Topic API, men vi lagrer dem lokalt
    # for å simulere 'bimsync_custom_fields' logikk.
    if 'cost_approved' in payload:
        # Eksempel på validering av tall
        try:
            val = float(payload['cost_approved'])
            validated['cost_approved'] = val
        except ValueError:
            raise ValidationError("cost_approved", "Must be a number")

    return validated
```

```python
# backend/app.py
from validation import validate_varsel_payload, ValidationError

@app.route('/api/varsel-submit', methods=['POST'])
@require_csrf
def submit_varsel():
    try:
        payload = request.get_json()
        if payload is None:
            return jsonify({"error": "Invalid JSON"}), 400

        # ✅ Validate og sanitize før CSV-lagring
        validated = validate_varsel_payload(payload)
        topic_id = validated['topic_id']

    except ValidationError as e:
        return jsonify({
            "error": "Validation failed",
            "field": e.field,
            "message": e.message
        }), 400
    except Exception as e:
        app.logger.error(f"Unexpected error: {e}")
        return jsonify({"error": "Internal server error"}), 500

    # Nå er data trygg for CSV-lagring
    sys = get_system()
    sys.db.save_form_data(topic_id, validated)  # Kun validerte data!

    return jsonify({"success": True, "topic_id": topic_id}), 200
```

#### Network Tab Demo

```http
# CSV Injection attempt
POST http://abc123.ngrok.io/api/varsel-submit
X-CSRF-Token: <valid>
Content-Type: application/json

{
  "topic_id": "18d0273de15c492497b36f47b233eebe",
  "topic_status": "Draft",
  "title": "=1+1+cmd|'/c calc'!A1"  # Excel formula injection
}

→ 400 Bad Request
{
  "error": "Validation failed",
  "field": "title",
  "message": "Cannot start with special characters (CSV injection)"
}

# Invalid GUID format
POST http://abc123.ngrok.io/api/varsel-submit
X-CSRF-Token: <valid>
Content-Type: application/json

{
  "topic_id": "../../etc/passwd",
  "topic_status": "Draft",
  "title": "Valid title"
}

→ 400 Bad Request
{
  "error": "Validation failed",
  "field": "guid",
  "message": "Invalid UUID format (expected 32-36 hex chars)"
}
```

---

### 5. Webhook Security (Secret Token i URL)

**Viktig**: Catenda Webhook API støtter **ikke** HMAC-signering. I stedet bruker vi Secret Token i URL.

#### Bakgrunn

Catenda webhook-konfigurasjon har ikke felt for `secret` eller `signing_key`. Dette betyr:
- ❌ Ingen `X-Catenda-Signature` header
- ✅ Løsning: Secret Token i URL (`?token=...`)

Dette er standard "Plan B" når API ikke tilbyr innebygd signering.

#### Implementasjon

```python
# backend/webhook_security.py
import os
from flask import request

# Webhook secret token (generer sterk token, lagre i .env)
WEBHOOK_SECRET_TOKEN = os.getenv("CATENDA_WEBHOOK_TOKEN", "")  # TODO: Generer sterk token

def validate_webhook_token() -> tuple[bool, str]:
    """
    Valider Secret Token i URL query parameter.

    Catenda kaller URL: https://ngrok.io/webhook/catenda?token=SECRET

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
    Webhook endpoint for Catenda.

    Catenda configuration:
    - URL: https://abc123.ngrok.io/webhook/catenda?token=YOUR_SECRET_TOKEN
    """

    # 1. ✅ Valider Secret Token fra URL
    valid, error = validate_webhook_token()
    if not valid:
        app.logger.warning(f"Webhook token validation failed: {error}")
        return jsonify({"error": "Unauthorized", "detail": error}), 401

    # 2. Parse payload (nå vet vi at det kom fra Catenda)
    payload = request.get_json()

    # 3. ✅ Idempotency check
    event_id = payload.get("id", "") or payload.get("eventId", "")
    if not event_id:
        return jsonify({"error": "Missing event id"}), 400

    if is_duplicate_event(event_id):
        app.logger.info(f"Duplicate webhook event: {event_id}")
        return jsonify({"status": "already_processed"}), 202

    # 4. ✅ Prosesser webhook
    # Ref: Webhook API.yaml → event-feltet inneholder verdier som "issue.created"
    event_name = payload.get('event', '')

    # Logg payload for debugging i prototype-fasen
    app.logger.info(f"Received webhook event: {event_name}")

    # Logikk basert på API-spesifikasjonens verdier
    if event_name == 'issue.created':
        # Håndter ny sak (BCF Topic created)
        app.logger.info(f"Processing issue.created: {event_id}")
        pass

    elif event_name == 'issue.modified':
        # Håndter endring (BCF Topic modified)
        app.logger.info(f"Processing issue.modified: {event_id}")
        pass

    elif event_name == 'issue.status.changed':
        # Håndter statusendring spesifikt
        app.logger.info(f"Processing issue.status.changed: {event_id}")
        pass

    return jsonify({"status": "processed"}), 200
```

#### Sett opp webhook i Catenda

1. **Generer sterk secret token**:
   ```bash
   # Generer 32-byte random token (Python)
   python3 -c "import secrets; print(secrets.token_urlsafe(32))"
   # Output: f8vP3K9mX_TqL2wN7hZdR5jB1yC6aE4sU0gO8iM3
   ```

2. **Legg token i `.env`**:
   ```bash
   CATENDA_WEBHOOK_TOKEN=f8vP3K9mX_TqL2wN7hZdR5jB1yC6aE4sU0gO8iM3
   ```

3. **Logg inn på Catenda** (https://app.catenda.com)

4. **Gå til Project Settings → Webhooks**

5. **Create new webhook**:
   - **Target URL**: `https://YOUR_NGROK_URL.ngrok.io/webhook/catenda?token=f8vP3K9mX_TqL2wN7hZdR5jB1yC6aE4sU0gO8iM3`
   - **Events**: Select `issue.created`, `issue.modified`, `issue.status.changed`

6. **Test webhook** (Catenda har test-knapp)

**Viktig**: Hold token hemmelig! Ikke commit til git.

#### Network Tab Demo

```http
# Webhook fra Catenda (gyldig token i URL)
POST https://abc123.ngrok.io/webhook/catenda?token=f8vP3K9mX_TqL2wN7hZdR5jB1yC6aE4sU0gO8iM3
Content-Type: application/json

{
  "event": "issue.created",
  "id": "evt_12345",
  "topic": { ... }
}

→ 200 OK
{
  "status": "processed"
}

# Webhook fra angriper (ingen token)
POST https://abc123.ngrok.io/webhook/catenda
Content-Type: application/json

{
  "event": "issue.created",
  "id": "fake_event"
}

→ 401 Unauthorized
{
  "error": "Unauthorized",
  "detail": "Missing token parameter in URL"
}

# Webhook fra angriper (feil token)
POST https://abc123.ngrok.io/webhook/catenda?token=wrong_token
Content-Type: application/json

{
  "event": "issue.created",
  "id": "fake_event"
}

→ 401 Unauthorized
{
  "error": "Unauthorized",
  "detail": "Invalid webhook token"
}

# Duplicate webhook (samme eventId to ganger)
POST https://abc123.ngrok.io/webhook/catenda?token=f8vP3K9mX_TqL2wN7hZdR5jB1yC6aE4sU0gO8iM3

(samme payload som tidligere)

→ 202 Accepted
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

## Implementasjon: Medium Priority

### 4. Catenda Token Validation

**Du har allerede Catenda OAuth token** - la oss validere det!

#### Implementasjon

```python
# backend/catenda_auth.py
import os
from datetime import datetime, timedelta
from flask import request, jsonify, g
from functools import wraps

# Antar at catenda_api_tester.py allerede har CatendaAPI class
from catenda_api_tester import CatendaAPI

def get_catenda_token_from_request() -> str:
    """
    Hent Catenda token fra request.

    Støtter:
    - Authorization: Bearer <token>
    - X-Catenda-Token: <token>
    """
    # Sjekk Authorization header
    auth_header = request.headers.get('Authorization', '')
    if auth_header.startswith('Bearer '):
        return auth_header[7:]

    # Sjekk custom header
    return request.headers.get('X-Catenda-Token', '')

def validate_catenda_token(token: str) -> tuple[bool, str, dict]:
    """
    Valider Catenda OAuth token via OpenCDE Foundation API.

    Returns:
        (valid, error_message, user_info)
    """
    if not token:
        return False, "Missing token", {}

    # Bruker requests direkte for enkelhetens skyld i prototypen
    import requests

    try:
        # ✅ KORRIGERT ENDEPUNKT: OpenCDE Foundation API
        # Ref: API-reference-auth.yaml → /opencde/foundation/1.0/current-user
        url = "https://api.catenda.com/opencde/foundation/1.0/current-user"

        response = requests.get(
            url,
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/json"
            }
        )

        if response.status_code == 401:
            return False, "Token expired or invalid", {}

        if response.status_code != 200:
            return False, f"Catenda API error: {response.status_code}", {}

        user_data = response.json()

        # ✅ MAPPER RESPONS fra schema: foundation-current-user
        # id = e-post/brukernavn (eks: john@doe.com)
        # name = Fullt navn (eks: John Doe)
        user_info = {
            "id": user_data.get("id"),
            "email": user_data.get("id"),   # OpenCDE bruker 'id' som brukernavn/email
            "name": user_data.get("name"),
            "catenda_token": token
        }

        return True, "", user_info

    except Exception as e:
        return False, f"Token validation error: {str(e)}", {}

def require_catenda_auth(f):
    """Decorator: Krev gyldig Catenda token"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        token = get_catenda_token_from_request()

        valid, error, user_info = validate_catenda_token(token)
        if not valid:
            return jsonify({
                "error": "Authentication required",
                "detail": error
            }), 401

        # Lagre user info i request context
        g.user = user_info

        return f(*args, **kwargs)

    return decorated_function
```

```python
# backend/app.py
from catenda_auth import require_catenda_auth

@app.route('/api/cases/<string:sakId>', methods=['GET'])
@require_catenda_auth  # ✅ Krev Catenda token
def get_case(sakId):
    user = g.user  # {'id': '...', 'email': '...', 'catenda_token': '...'}

    sys = get_system()
    data = sys.db.get_form_data(sakId)

    if not data:
        return jsonify({"error": "Case not found"}), 404

    return jsonify(data), 200
```

#### Frontend integrasjon

```javascript
// Frontend: Lagre Catenda token (fra OAuth callback)
const catendaToken = "...";  // Fra OAuth flow

// Bruk token i API requests
async function fetchCase(sakId) {
    const response = await fetch(`http://abc123.ngrok.io/api/cases/${sakId}`, {
        headers: {
            'Authorization': `Bearer ${catendaToken}`
        }
    });

    if (response.status === 401) {
        // Token utløpt - re-authenticate med Catenda
        window.location.href = '/catenda-login';
    }

    return response.json();
}
```

#### Network Tab Demo

```http
# Request uten token
GET http://abc123.ngrok.io/api/cases/ABC123

→ 401 Unauthorized
{
  "error": "Authentication required",
  "detail": "Missing token"
}

# Request med utgått token
GET http://abc123.ngrok.io/api/cases/ABC123
Authorization: Bearer expired_token_here

→ 401 Unauthorized
{
  "error": "Authentication required",
  "detail": "Token expired or invalid"
}

# Request med gyldig token
GET http://abc123.ngrok.io/api/cases/ABC123
Authorization: Bearer valid_catenda_token_here

→ 200 OK
{
  "sakId": "ABC123",
  "title": "...",
  ...
}
```

---

### 5. Project-Scope Authorization

**Sjekk at bruker har tilgang til prosjektet** via Catenda API.

#### Implementasjon

```python
# backend/catenda_auth.py (fortsettelse)

def get_user_projects(catenda_token: str) -> list:
    """
    Hent alle prosjekter bruker har tilgang til.

    Returns:
        List of project IDs
    """
    api = CatendaAPI(
        client_id=os.getenv("CATENDA_CLIENT_ID"),
        client_secret=os.getenv("CATENDA_CLIENT_SECRET")
    )
    api.access_token = catenda_token

    try:
        # GET /projects (REST v2)
        response = api.session.get(
            f"{api.base_url}/projects",
            headers={"Authorization": f"Bearer {catenda_token}"}
        )

        if response.status_code != 200:
            return []

        projects = response.json()
        return [p["id"] for p in projects]

    except Exception:
        return []

def require_project_access(f):
    """
    Decorator: Sjekk at bruker har tilgang til prosjekt.

    Forutsetter at sak har 'project_id' felt i CSV.
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user = g.get('user')
        if not user:
            return jsonify({"error": "Unauthorized"}), 401

        # Hent sakId fra path eller body
        sak_id = kwargs.get('sakId') or request.get_json().get('sakId')
        if not sak_id:
            return jsonify({"error": "Missing sakId"}), 400

        # Hent sak fra CSV
        sys = get_system()
        sak = sys.db.get_form_data(sak_id)

        if not sak:
            return jsonify({"error": "Case not found"}), 404

        # Hent project_id fra sak
        sak_project_id = sak.get('project_id')
        if not sak_project_id:
            # Fallback: Tillat hvis sak ikke har project_id (eldre data)
            return f(*args, **kwargs)

        # Hent brukerens prosjekter
        user_projects = get_user_projects(user['catenda_token'])

        # Sjekk tilgang
        if sak_project_id not in user_projects:
            return jsonify({
                "error": "Forbidden",
                "detail": f"You don't have access to project {sak_project_id}"
            }), 403

        # OK - proceed
        return f(*args, **kwargs)

    return decorated_function
```

```python
# backend/app.py
from catenda_auth import require_catenda_auth, require_project_access

@app.route('/api/cases/<string:sakId>', methods=['GET'])
@require_catenda_auth
@require_project_access  # ✅ Sjekk project-tilgang
def get_case(sakId):
    # Bruker har tilgang til dette prosjektet
    sys = get_system()
    data = sys.db.get_form_data(sakId)
    return jsonify(data), 200

@app.route('/api/cases/<string:sakId>', methods=['PUT'])
@require_csrf
@require_catenda_auth
@require_project_access  # ✅ Sjekk project-tilgang
def update_case(sakId):
    # ... oppdater sak ...
    return jsonify({"success": True}), 200
```

#### CSV struktur

```csv
topic_id,project_id,title,topic_status,created_at
18d0273de15c492497b36f47b233eebe,550e8400e29b41d4a716446655440000,Endringsmelding 1,Draft,2025-11-23T10:00:00Z
a3f12bc8d4e5492497b36f47b233eebe,12345678e29b41d4a716446655440000,Endringsmelding 2,Open,2025-11-22T15:30:00Z
```

**Note**:
- `topic_id`: Compacted UUID (32 hex chars)
- `project_id`: Compacted UUID (32 hex chars)
- `topic_status`: BCF standard values (Draft, Open, Active, Resolved, Closed)

#### Network Tab Demo

```http
# Bruker autentisert i project A
Authorization: Bearer <token_for_user_in_project_A>

# Hent sak i project A (OK)
GET http://abc123.ngrok.io/api/cases/18d0273de15c492497b36f47b233eebe

→ 200 OK
{
  "topic_id": "18d0273de15c492497b36f47b233eebe",
  "project_id": "550e8400e29b41d4a716446655440000",
  "title": "Endringsmelding 1",
  "topic_status": "Draft",
  ...
}

# Forsøk å hente sak i project B (Forbidden)
GET http://abc123.ngrok.io/api/cases/a3f12bc8d4e5492497b36f47b233eebe

→ 403 Forbidden
{
  "error": "Forbidden",
  "detail": "You don't have access to project 12345678e29b41d4a716446655440000"
}
```

---

### 6. Role-Based Field Locking (TE vs BH)

**Hent rolle fra Catenda** og håndhev felt-restriksjoner.

#### Implementasjon

```python
# backend/catenda_auth.py (fortsettelse)

def get_user_role_in_project(catenda_token: str, project_id: str, user_id: str) -> str:
    """
    Bestem rolle (TE/BH) basert på Team-medlemskap.

    Henter alle teams i prosjektet, ser etter 'TE'/'BH' i navnet,
    og sjekker om bruker er medlem.

    Args:
        catenda_token: OAuth token
        project_id: Catenda project ID (compacted UUID)
        user_id: User ID fra current-user (e-post/brukernavn)

    Returns:
        "TE", "BH", eller "unknown"
    """
    import requests

    headers = {"Authorization": f"Bearer {catenda_token}"}
    base_url = "https://api.catenda.com/v2"

    try:
        # ✅ 1. Hent alle teams i prosjektet
        # Ref: Project API.yaml → GET /v2/projects/{project-id}/teams
        teams_resp = requests.get(
            f"{base_url}/projects/{project_id}/teams",
            headers=headers
        )

        if teams_resp.status_code != 200:
            return "unknown"

        all_teams = teams_resp.json()  # Liste av team-objekter

        user_role = "unknown"

        # ✅ 2. Sjekk relevante teams
        for team in all_teams:
            team_name = team.get('name', '').upper()
            team_id = team.get('id')

            # Vi bryr oss kun om teams som indikerer en rolle
            possible_role = None
            if "TE" in team_name or "ENTREPRENØR" in team_name or "TECHNICAL" in team_name:
                possible_role = "TE"
            elif "BH" in team_name or "BYGGHERRE" in team_name or "CLIENT" in team_name:
                possible_role = "BH"

            if possible_role:
                # ✅ 3. Sjekk om brukeren er medlem i dette teamet
                # Endpoint: GET /v2/projects/{pid}/teams/{tid}/members/{uid}
                # (Hvis bruker ikke er medlem, returnerer dette 404)
                member_resp = requests.get(
                    f"{base_url}/projects/{project_id}/teams/{team_id}/members/{user_id}",
                    headers=headers
                )

                if member_resp.status_code == 200:
                    user_role = possible_role
                    break  # Fant rolle, avslutt søk

        return user_role

    except Exception as e:
        print(f"Error checking roles: {e}")
        return "unknown"

# Field permissions (fra full handlingsplan)
TE_LOCKED_FIELDS = ["title", "description", "attachments", "technical_details"]
BH_ONLY_FIELDS = ["cost_estimate", "cost_approved", "bh_signature", "bh_comments"]

def validate_field_access(role: str, payload: dict, current_status: str) -> tuple[bool, str]:
    """Sjekk om bruker kan oppdatere feltene"""
    if role == "TE":
        for field in BH_ONLY_FIELDS:
            if field in payload:
                return False, f"TE cannot modify BH field: {field}"

    elif role == "BH":
        if current_status in ["submitted", "approved", "rejected"]:
            for field in TE_LOCKED_FIELDS:
                if field in payload:
                    return False, f"BH cannot modify TE-locked field after submission: {field}"

    return True, ""
```

```python
# backend/app.py
from catenda_auth import get_user_role_in_project, validate_field_access

@app.route('/api/cases/<string:sakId>', methods=['PUT'])
@require_csrf
@require_catenda_auth
@require_project_access
def update_case(sakId):
    user = g.user
    payload = request.get_json()

    # Hent nåværende sak
    sys = get_system()
    current = sys.db.get_form_data(sakId)

    if not current:
        return jsonify({"error": "Case not found"}), 404

    # Hent brukerens rolle i prosjekt
    project_id = current.get('project_id')
    role = get_user_role_in_project(
        user['catenda_token'],
        project_id,
        user['id']  # ✅ Bruker user_id (ikke email)
    )

    # ✅ Valider felt-tilgang
    allowed, error = validate_field_access(role, payload, current.get('status'))
    if not allowed:
        return jsonify({"error": error}), 403

    # Oppdater sak
    sys.db.update_form_data(sakId, payload)

    return jsonify({"success": True}), 200
```

#### Network Tab Demo

```http
# TE forsøker å oppdatere BH-felt
PUT http://abc123.ngrok.io/api/cases/ABC123
Authorization: Bearer <te_token>
X-CSRF-Token: <valid>
Content-Type: application/json

{
  "title": "Updated",
  "cost_approved": 50000  # ❌ BH-only
}

→ 403 Forbidden
{
  "error": "TE cannot modify BH field: cost_approved"
}

# BH oppdaterer etter submission (TE-felt låst)
PUT http://abc123.ngrok.io/api/cases/ABC123
Authorization: Bearer <bh_token>
X-CSRF-Token: <valid>
Content-Type: application/json

{
  "cost_approved": 50000,
  "title": "Changed title"  # ❌ TE-locked etter submit
}

→ 403 Forbidden
{
  "error": "BH cannot modify TE-locked field after submission: title"
}

# BH oppdaterer BH-felter (OK)
PUT http://abc123.ngrok.io/api/cases/ABC123
Authorization: Bearer <bh_token>
X-CSRF-Token: <valid>
Content-Type: application/json

{
  "cost_approved": 50000,
  "bh_comments": "Approved"
}

→ 200 OK
{
  "success": true
}
```

---

### 7. Rate Limiting (In-Memory)

**Perfekt for lokal prototype** - beskytter Flask mot overbelastning.

#### Implementasjon

```bash
# Installer Flask-Limiter
pip install Flask-Limiter
```

```python
# backend/app.py
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

# Opprett limiter med in-memory backend
limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"],
    storage_uri="memory://"  # In-memory (OK for prototype)
)

# Apply limits til spesifikke endpoints
@app.route('/api/varsel-submit', methods=['POST'])
@limiter.limit("10 per minute")  # ✅ Maks 10 submissions per minutt
@require_csrf
@require_catenda_auth
def submit_varsel():
    # ...
    pass

@app.route('/webhook/catenda', methods=['POST'])
@limiter.limit("100 per minute")  # ✅ Høyere limit for webhooks
def webhook():
    # ...
    pass

@app.route('/api/csrf-token', methods=['GET'])
@limiter.limit("30 per minute")  # ✅ Moderat limit
def get_csrf_token():
    # ...
    pass

# Custom error handler
@app.errorhandler(429)
def ratelimit_handler(e):
    return jsonify({
        "error": "Rate limit exceeded",
        "detail": str(e.description),
        "retry_after": e.retry_after  # Sekunder til reset
    }), 429
```

#### Network Tab Demo

```http
# Request 1-10 (innenfor limit)
POST http://abc123.ngrok.io/api/varsel-submit
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 9
X-RateLimit-Reset: 1732320120

→ 200 OK

# Request 11 (over limit)
POST http://abc123.ngrok.io/api/varsel-submit
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1732320120

→ 429 Too Many Requests
{
  "error": "Rate limit exceeded",
  "detail": "10 per 1 minute",
  "retry_after": 45
}
```

---

### 8. Audit Logging (Lokal fil)

**Skriv strukturerte logs** til JSON Lines fil.

#### Implementasjon

```python
# backend/audit.py
import json
from datetime import datetime
from flask import request, g

class AuditLogger:
    """Audit logging til lokal fil"""

    def __init__(self, log_file="audit.log"):
        self.log_file = log_file

    def log_event(
        self,
        event_type: str,
        user: str,
        resource: str,
        action: str,
        result: str,
        details: dict = None
    ):
        """
        Log security event.

        Args:
            event_type: "auth", "access", "modify", "webhook"
            user: User email eller "anonymous"
            resource: Resource (e.g., "case:ABC123")
            action: Action (e.g., "read", "update", "create")
            result: "success", "denied", "error"
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
        try:
            with open(self.log_file, 'a') as f:
                f.write(json.dumps(entry) + '\n')
        except Exception as e:
            print(f"Audit log error: {e}")

audit = AuditLogger("audit.log")
```

```python
# backend/app.py
from audit import audit

@app.route('/api/cases/<string:sakId>', methods=['GET'])
@require_catenda_auth
@require_project_access
def get_case(sakId):
    user = g.user

    # Hent data
    sys = get_system()
    data = sys.db.get_form_data(sakId)

    # ✅ Log suksess
    audit.log_event(
        event_type="access",
        user=user.get('email', 'unknown'),
        resource=f"case:{sakId}",
        action="read",
        result="success",
        details={"project_id": data.get('project_id')}
    )

    return jsonify(data), 200

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

@app.route('/webhook/catenda', methods=['POST'])
def webhook():
    # ... validering ...

    # ✅ Log webhook
    audit.log_event(
        event_type="webhook",
        user="catenda",
        resource="webhook:catenda",
        action="received",
        result="success",
        details={"event_type": payload.get('eventType')}
    )

    # ...
    return jsonify({"status": "processed"}), 200
```

#### Audit Log Eksempel

```json
{"timestamp":"2025-11-23T10:15:30Z","event_type":"access","user":"te@example.com","resource":"case:18d0273de15c492497b36f47b233eebe","action":"read","result":"success","ip":"192.168.1.100","user_agent":"Mozilla/5.0...","details":{"project_id":"550e8400e29b41d4a716446655440000"}}
{"timestamp":"2025-11-23T10:16:45Z","event_type":"access","user":"bh@example.com","resource":"case:18d0273de15c492497b36f47b233eebe","action":"update","result":"denied","ip":"192.168.1.101","user_agent":"Mozilla/5.0...","details":{"error":"TE-locked field"}}
{"timestamp":"2025-11-23T10:17:12Z","event_type":"webhook","user":"catenda","resource":"webhook:catenda","action":"received","result":"success","ip":"52.1.2.3","user_agent":"Catenda-Webhook/1.0","details":{"event":"issue.created"}}
```

#### Visualisering

```bash
# Følg audit log i sanntid
tail -f audit.log | jq .

# Filtrer kun denied events
cat audit.log | jq 'select(.result == "denied")'

# Tell events per bruker
cat audit.log | jq -r .user | sort | uniq -c
```

---

### 9. CORS for ngrok (Dynamisk)

**Tillat ngrok URL** (som endrer seg ved restart).

#### Implementasjon

```python
# backend/app.py
from flask_cors import CORS
import os

# Hent ngrok URL fra environment (sett når ngrok starter)
NGROK_URL = os.getenv("NGROK_URL", "")  # e.g., "https://abc123.ngrok.io"

# Tillatte origins
ALLOWED_ORIGINS = [
    "http://localhost:3000",  # Frontend dev
    "http://127.0.0.1:3000",
    NGROK_URL,  # Dynamisk ngrok URL
]

# Filtrer ut tomme strings
ALLOWED_ORIGINS = [o for o in ALLOWED_ORIGINS if o]

CORS(app, resources={
    r"/api/*": {
        "origins": ALLOWED_ORIGINS,
        "methods": ["GET", "POST", "PUT", "DELETE"],
        "allow_headers": ["Content-Type", "X-CSRF-Token", "Authorization"],
        "expose_headers": ["X-RateLimit-Remaining", "X-RateLimit-Reset"],
        "supports_credentials": False,  # Siden vi bruker token i header
        "max_age": 3600
    }
})

print(f"CORS allowed origins: {ALLOWED_ORIGINS}")
```

#### Start script

```bash
#!/bin/bash
# start_with_ngrok.sh

# Start Flask i bakgrunnen
python backend/app.py &
FLASK_PID=$!

# Vent litt
sleep 2

# Start ngrok og hent URL
ngrok http 5000 --log=stdout > ngrok.log &
NGROK_PID=$!

# Vent til ngrok er klar
sleep 3

# Hent ngrok URL fra API
NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | jq -r '.tunnels[0].public_url')

echo "Ngrok URL: $NGROK_URL"
echo "Update NGROK_URL environment variable and restart Flask if needed"

# Eller: Restart Flask med NGROK_URL satt
kill $FLASK_PID
NGROK_URL=$NGROK_URL python backend/app.py
```

---

## Demo-scenarios for Network Tab

### Scenario 1: Sikker Submit-flow

```http
# 1. Autentiser med Catenda (OAuth - i browser)
# → Får tilbake token

# 2. Hent CSRF-token
GET http://abc123.ngrok.io/api/csrf-token
→ 200 OK {"csrfToken": "..."}

# 3. Submit varsel
POST http://abc123.ngrok.io/api/varsel-submit
Authorization: Bearer <catenda_token>
X-CSRF-Token: <csrf_token>
Content-Type: application/json

{
  "sakId": "ABC123",
  "status": "submitted",
  "title": "Endringsmelding 1"
}

→ 200 OK
X-RateLimit-Remaining: 9

# 4. Sjekk audit.log
cat audit.log | jq 'select(.resource == "case:ABC123")'
```

### Scenario 2: Angrep-demonstrasjon

```http
# Angrep 1: CSRF (ingen token)
POST http://abc123.ngrok.io/api/varsel-submit
Authorization: Bearer <valid_token>

{"sakId": "ABC123"}

→ 403 Forbidden (CSRF token missing)

# Angrep 2: CSV Injection
POST http://abc123.ngrok.io/api/varsel-submit
Authorization: Bearer <valid_token>
X-CSRF-Token: <valid>

{"topic_id": "18d0273de15c492497b36f47b233eebe", "title": "=1+1", "topic_status": "Draft"}

→ 400 Bad Request (CSV injection blocked)

# Angrep 3: Webhook spoofing (ingen token)
POST http://abc123.ngrok.io/webhook/catenda

{"event": "issue.created", "id": "fake_12345"}

→ 401 Unauthorized (Missing token parameter in URL)

# Angrep 4: Project access violation
GET http://abc123.ngrok.io/api/cases/a3f12bc8d4e5492497b36f47b233eebe
Authorization: Bearer <project_A_token>

→ 403 Forbidden (No access to project)

# Angrep 5: Role violation (TE → BH field)
PUT http://abc123.ngrok.io/api/cases/18d0273de15c492497b36f47b233eebe
Authorization: Bearer <te_token>
X-CSRF-Token: <valid>

{"cost_approved": 50000}

→ 403 Forbidden (TE cannot modify BH field)

# Angrep 6: Rate limit abuse
# Send 11 requests raskt
→ Request 11: 429 Too Many Requests
```

---

## Testing

### Unit Tests

```python
# tests/test_security_prototype.py
import pytest
from app import app

@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

def test_csrf_protection(client):
    """POST uten CSRF-token skal blokkeres"""
    response = client.post('/api/varsel-submit',
        json={'sakId': 'ABC123', 'status': 'draft'})
    assert response.status_code == 403
    assert b'CSRF' in response.data

def test_csv_injection_protection(client):
    """CSV injection skal blokkeres"""
    # Hent CSRF token først
    token_resp = client.get('/api/csrf-token')
    token = token_resp.json['csrfToken']

    response = client.post('/api/varsel-submit',
        json={'sakId': 'ABC123', 'status': 'draft', 'title': '=1+1'},
        headers={'X-CSRF-Token': token})
    assert response.status_code == 400
    assert b'CSV injection' in response.data

def test_webhook_token(client):
    """Webhook uten token skal avvises"""
    response = client.post('/webhook/catenda',
        json={'event': 'issue.created', 'id': '123'})
    assert response.status_code == 401
    assert b'token' in response.data.lower()

def test_webhook_invalid_token(client):
    """Webhook med feil token skal avvises"""
    response = client.post('/webhook/catenda?token=wrong_token',
        json={'event': 'issue.created', 'id': '123'})
    assert response.status_code == 401

def test_rate_limiting(client):
    """Rate limit skal håndheves"""
    # Hent token
    token_resp = client.get('/api/csrf-token')
    token = token_resp.json['csrfToken']

    # Send 11 requests
    for i in range(11):
        response = client.post('/api/varsel-submit',
            json={
                'topic_id': f'18d0273de15c492497b36f47b233ee{i:02x}',  # Compacted UUID
                'topic_status': 'Draft',
                'title': f'Test {i}'
            },
            headers={'X-CSRF-Token': token})

        if i < 10:
            assert response.status_code in [200, 400, 403]  # May fail on validation/auth
        else:
            assert response.status_code == 429  # 11th should be rate limited
```

### Manual Testing Checklist

```markdown
## Prototype Security Testing

### CSRF Protection
- [ ] GET /api/csrf-token → 200 OK med token
- [ ] POST uten X-CSRF-Token → 403
- [ ] POST med ugyldig token → 403
- [ ] POST med utløpt token (>1h) → 403
- [ ] POST med gyldig token → 200

### Input Validation (CSV-safe)
- [ ] sakId med '..' → 400
- [ ] sakId med '/' → 400
- [ ] title med '=formula' → 400
- [ ] title med newline → sanitized (replaced with space)
- [ ] Gyldig input → 200

### Webhook Secret Token
- [ ] POST uten token i URL → 401
- [ ] POST med feil token → 401
- [ ] POST med gyldig token → 200
- [ ] Duplikat event ID → 202

### Catenda Token Auth
- [ ] GET uten Authorization → 401
- [ ] GET med utgått token → 401
- [ ] GET med gyldig token → 200

### Project Authorization
- [ ] Bruker i project A henter case fra project B → 403
- [ ] Bruker i project A henter case fra project A → 200

### Role-Based Field Locking
- [ ] TE oppdaterer BH-felt (cost_approved) → 403
- [ ] BH oppdaterer TE-felt etter submit → 403
- [ ] TE oppdaterer egne felter → 200
- [ ] BH oppdaterer BH-felter → 200

### Rate Limiting
- [ ] 10 requests på 1 min → 200 (alle)
- [ ] 11. request → 429
- [ ] X-RateLimit-Remaining header synker
- [ ] Vent 1 min, prøv igjen → 200

### Audit Logging
- [ ] Utfør operasjon → audit.log oppdateres
- [ ] Denied request → logged med result="denied"
- [ ] Webhook → logged med event_type="webhook"
- [ ] tail -f audit.log viser events i sanntid

### CORS
- [ ] Preflight fra localhost:3000 → 200 med CORS headers
- [ ] Preflight fra ngrok URL → 200 med CORS headers
- [ ] Request fra annen origin → Blokkert av browser
```

---

## Oppsummering

### Hva kan implementeres i lokal prototype?

| Kategori | Tiltak | Tid | Status |
|----------|--------|-----|--------|
| **Essensielt** | CSRF-beskyttelse | 2t | ✅ Klar |
| **Essensielt** | Request validation (CSV-safe) | 1.5t | ✅ Klar |
| **Essensielt** | Webhook HMAC | 1.5t | ✅ Klar |
| **Autentisering** | Catenda token validation | 2t | ✅ Klar |
| **Autorisasjon** | Project-scope check | 2-3t | ✅ Klar |
| **Autorisasjon** | Role-based field locking | 2-3t | ✅ Klar |
| **Resiliens** | Rate limiting (in-memory) | 1.5t | ✅ Klar |
| **Observability** | Audit logging (fil) | 1.5t | ✅ Klar |
| **Nettverkskontroll** | CORS (ngrok) | 1t | ✅ Klar |

**Total tid**: ~15-18 timer (2-3 dager)

### Hva demonstreres i Network Tab?

✅ **Request headers**: `Authorization`, `X-CSRF-Token`, `X-Catenda-Signature`
✅ **Response status codes**: `200`, `400`, `401`, `403`, `429`
✅ **Response headers**: `X-RateLimit-Remaining`, `Access-Control-Allow-Origin`
✅ **Error messages**: Strukturerte JSON-feil med `error` og `detail`
✅ **Audit trail**: Lokal `audit.log` fil med alle hendelser

### Neste steg

1. **Konfigurer environment**:
   ```bash
   # .env
   CATENDA_CLIENT_ID=your_client_id
   CATENDA_CLIENT_SECRET=your_client_secret
   CATENDA_WEBHOOK_SECRET=generate_strong_secret
   CSRF_SECRET=generate_strong_secret
   NGROK_URL=https://abc123.ngrok.io  # Oppdater når ngrok starter
   ```

2. **Installer avhengigheter**:
   ```bash
   pip install Flask-Limiter flask-cors
   ```

3. **Implementer i rekkefølge**:
   - Dag 1: CSRF + Request validation
   - Dag 2: Webhook HMAC + Token auth
   - Dag 3: Authorization + Rate limiting + Audit

4. **Test med Catenda**:
   - Sett opp webhook i Catenda (pek til ngrok URL)
   - Test OAuth flow
   - Verifiser rolle-mapping

5. **Demo**:
   - Vis Network tab med sikkerhetsfunksjoner
   - Demonstrer angrep som blokkeres
   - Vis audit.log i sanntid

---

**Vedlikeholdt av**: Claude
**Sist oppdatert**: 2025-11-23
**Status**: Klar for prototype-implementering
