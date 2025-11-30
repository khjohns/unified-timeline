# Getting Started – Utvikleroppsett

Denne guiden beskriver hvordan du setter opp utviklingsmiljøet for Skjema Endringsmeldinger-prosjektet.

---

## Innhold

- [Forutsetninger](#forutsetninger)
- [Installasjon](#installasjon)
- [Miljøvariabler](#miljøvariabler)
- [Kjøre applikasjonen](#kjøre-applikasjonen)
- [Catenda-konfigurasjon](#catenda-konfigurasjon)
- [Feilsøking](#feilsøking)
- [Neste steg](#neste-steg)

---

## Forutsetninger

### Programvare

| Verktøy | Versjon | Sjekk installasjon |
|---------|---------|---------------------|
| Node.js | 18+ | `node --version` |
| npm | 9+ | `npm --version` |
| Python | 3.8+ | `python --version` |
| pip | 21+ | `pip --version` |
| Git | 2.30+ | `git --version` |

### Valgfritt

| Verktøy | Formål |
|---------|--------|
| VS Code | Anbefalt editor med Python/TypeScript-støtte |
| ngrok | Eksponere lokal backend for Catenda webhooks |
| Postman | API-testing |

---

## Installasjon

### 1. Klon repositoriet

```bash
git clone <repository-url>
cd Skjema_Endringsmeldinger
```

### 2. Backend-oppsett

```bash
# Gå til backend-mappen
cd backend

# Opprett Python virtuelt miljø
python -m venv venv

# Aktiver virtuelt miljø
# På macOS/Linux:
source venv/bin/activate
# På Windows:
venv\Scripts\activate

# Installer avhengigheter
pip install -r requirements.txt

# For utvikling, installer også dev-avhengigheter
pip install -r requirements-dev.txt
```

### 3. Frontend-oppsett

```bash
# Gå tilbake til rot-mappen
cd ..

# Installer npm-avhengigheter
npm install

# Generer statuskonstanter fra shared/status-codes.json
npm run generate:constants
```

---

## Miljøvariabler

### Backend (.env)

Kopier eksempelfilen og tilpass:

```bash
cd backend
cp .env.example .env
```

Rediger `backend/.env`:

```env
# === Påkrevd for lokal utvikling ===

# CSRF-beskyttelse (generer med: python -c "import secrets; print(secrets.token_urlsafe(32))")
CSRF_SECRET=din_tilfeldige_streng_her

# Flask-konfigurasjon
FLASK_ENV=development
FLASK_DEBUG=True
FLASK_SECRET_KEY=en_annen_tilfeldig_streng

# CORS (frontend-URL)
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

# === Catenda (påkrevd for full funksjonalitet) ===

# Catenda OAuth-legitimasjon (fra Catenda Developer Portal)
CATENDA_CLIENT_ID=din_client_id
CATENDA_CLIENT_SECRET=din_client_secret

# Catenda prosjekt-ID
CATENDA_PROJECT_ID=ditt_prosjekt_id

# OAuth tokens (genereres av setup_authentication.py)
CATENDA_ACCESS_TOKEN=
CATENDA_REFRESH_TOKEN=

# Frontend URL for magic links
DEV_REACT_APP_URL=http://localhost:3000/Skjema_Endringsmeldinger

# Webhook-token (for Catenda webhook-autentisering)
CATENDA_WEBHOOK_TOKEN=tilfeldig_token_for_webhooks
```

> **Merk:** All konfigurasjon lagres nå i `.env`-filen. `config.json` brukes ikke lenger.

### Frontend (.env.local)

Kopier eksempelfilen:

```bash
# I rot-mappen
cp .env.example .env.local
```

Innhold i `.env.local`:

```env
# Backend API-URL
VITE_API_BASE_URL=http://localhost:8080/api
```

---

## Kjøre applikasjonen

### Start backend

```bash
cd backend
source venv/bin/activate  # Aktiver virtuelt miljø
python app.py
```

Backend starter på `http://localhost:8080`

Forventet output:
```
 * Running on http://127.0.0.1:8080
 * Debug mode: on
```

### Start frontend (ny terminal)

```bash
# I rot-mappen
npm run dev
```

Frontend starter på `http://localhost:3000`

Forventet output:
```
  VITE v6.2.0  ready in 500 ms

  ➜  Local:   http://localhost:3000/Skjema_Endringsmeldinger/
```

### Åpne applikasjonen

Gå til `http://localhost:3000/Skjema_Endringsmeldinger/` i nettleseren.

---

## Catenda-konfigurasjon

For full funksjonalitet (inkludert webhook-mottak og dokumentopplasting) må du konfigurere Catenda-integrasjonen.

### 1. Opprett Catenda-applikasjon

1. Gå til [Catenda Developer Portal](https://developer.catenda.com)
2. Opprett en ny applikasjon
3. Noter ned **Client ID** og **Client Secret**

### 2. Hent OAuth-token

```bash
cd backend
source venv/bin/activate
python scripts/setup_authentication.py
```

Følg instruksjonene for å autorisere applikasjonen.

### 3. Konfigurer webhooks (valgfritt)

For å motta webhooks fra Catenda lokalt, trenger du en offentlig URL. Bruk ngrok:

```bash
# Installer ngrok (https://ngrok.com/download)
ngrok http 8080
```

Noter den offentlige URL-en (f.eks. `https://abc123.ngrok.io`) og konfigurer webhook:

```bash
python scripts/setup_webhooks.py
```

### 4. Interaktiv Catenda-meny

For å utforske Catenda API:

```bash
python scripts/catenda_menu.py
```

---

## Kjøre tester

### Backend-tester

```bash
cd backend
source venv/bin/activate

# Kjør alle tester
python -m pytest tests/ -v

# Kjør med coverage
python -m pytest tests/ --cov=. --cov-report=html

# Kjør spesifikke tester
python -m pytest tests/test_services/ -v
python -m pytest tests/test_routes/test_varsel_routes.py -v
```

### Frontend-tester

```bash
# I rot-mappen

# Kjør alle tester
npm test

# Kjør med interaktiv UI
npm run test:ui

# Kjør med coverage-rapport
npm run test:coverage

# Kjør spesifikke tester
npm test -- src/__tests__/services/api.test.ts
```

---

## Feilsøking

### Backend starter ikke

**Problem:** `ModuleNotFoundError`

```bash
# Sjekk at virtuelt miljø er aktivert
which python  # Bør peke til venv/bin/python

# Reinstaller avhengigheter
pip install -r requirements.txt
```

**Problem:** Port 8080 er i bruk

```bash
# Finn prosessen som bruker porten
lsof -i :8080

# Eller endre port i app.py
```

### Frontend starter ikke

**Problem:** `npm ERR! Cannot find module`

```bash
# Slett node_modules og reinstaller
rm -rf node_modules package-lock.json
npm install
```

**Problem:** Konstanter mangler

```bash
# Generer konstanter på nytt
npm run generate:constants
```

### API-kall feiler

**Problem:** CORS-feil i konsollen

Sjekk at `ALLOWED_ORIGINS` i `backend/.env` inneholder frontend-URL:

```env
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

**Problem:** 401/403 feil

- Sjekk at CSRF-token er konfigurert
- Sjekk at backend faktisk kjører på forventet port

### Catenda-integrasjon feiler

**Problem:** OAuth-feil

```bash
# Kjør autentisering på nytt
python scripts/setup_authentication.py
```

**Problem:** Webhook mottas ikke

- Sjekk at ngrok kjører og URL er korrekt
- Verifiser webhook-konfigurasjon i Catenda

---

## Utviklingsarbeidsflyt

### Generell arbeidsflyt

1. **Start backend** i én terminal
2. **Start frontend** i en annen terminal
3. **Gjør endringer** – hot reload er aktivert for begge
4. **Kjør tester** før commit

### Kodeorganisering

- **Frontend-komponenter:** `src/components/`
- **Backend-routes:** `backend/routes/`
- **Delte statuskoder:** `shared/status-codes.json`

### Statuskoder

Statuskoder defineres sentralt i `shared/status-codes.json` og genereres til:
- Frontend: `src/utils/generatedConstants.ts`
- Backend: `backend/core/generated_constants.py`

Etter endring i `status-codes.json`:

```bash
npm run generate:constants
```

---

## Neste steg

- [API.md](API.md) – Backend API-referanse
- [FRONTEND_ARCHITECTURE.md](FRONTEND_ARCHITECTURE.md) – Frontend-arkitektur
- [backend/STRUCTURE.md](../backend/STRUCTURE.md) – Backend-mappestruktur
- [HLD - Overordnet Design.md](HLD%20-%20Overordnet%20Design.md) – Systemarkitektur

---

## Nyttige kommandoer

```bash
# === Backend ===
cd backend && source venv/bin/activate

python app.py                          # Start server
python -m pytest tests/ -v             # Kjør tester
python scripts/catenda_menu.py         # Catenda API-verktøy

# === Frontend ===
npm run dev                            # Start dev server
npm test                               # Kjør tester
npm run build                          # Bygg for produksjon
npm run generate:constants             # Generer statuskoder

# === Begge ===
git status                             # Sjekk endringer
git diff                               # Se endringer
```
