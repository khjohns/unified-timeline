# Automated Setup Script Design

## Problem

`backend/scripts/setup_authentication.py` krever mye manuell input selv nar verdier allerede finnes i `.env`. Brukeren ma bekrefte eksisterende verdier og manuelt kopiere OAuth-koder.

## Designprinsipp

**"Silent when configured, helpful when not."** Ingen bekreftelser for eksisterende verdier. Ingen prompts nar alt fungerer.

## Flyt

```
Les .env
    |
    +-- CATENDA_ACCESS_TOKEN finnes?
    |   +-- Ja -> Test med list_projects()
    |   |   +-- Gyldig -> Hopp over auth
    |   |   +-- Utgatt -> Re-autentiser (se under)
    |   +-- Nei -> Fortsett til auth
    |
    +-- CATENDA_CLIENT_SECRET finnes?
    |   +-- Ja -> Client Credentials Grant (automatisk)
    |   +-- Nei -> Authorization Code Grant
    |       +-- Start midlertidig HTTP-server pa ledig port
    |       +-- Apne nettleser til auth-URL
    |       +-- Fang callback automatisk
    |       +-- Bytt kode mot token
    |
    +-- CATENDA_PROJECT_ID finnes?
    |   +-- Ja -> Bruk stille
    |   +-- Nei -> list_projects() -> auto-velg hvis 1, picker hvis >1
    |
    +-- CATENDA_LIBRARY_ID finnes?
    |   +-- Ja -> Bruk stille
    |   +-- Nei -> list_libraries() -> auto-velg hvis 1, picker hvis >1
    |
    +-- CATENDA_FOLDER_ID finnes?
    |   +-- Ja -> Bruk stille
    |   +-- Nei -> Hopp over (valgfri)
    |
    +-- Lagre nye/oppdaterte verdier til .env
```

## OAuth Auto-Capture Server

- Pythons innebygde `http.server` + `socketserver`
- Foretrekk port 18080, fallback til OS-tildelt ledig port
- Redirect URI: `http://localhost:{port}/callback`
- Server hndterer en request, trekker ut `code`-param, viser "Suksess"-side, stenger
- `webbrowser.open()` for a apne auth-URL
- Print redirect URI tydelig sa bruker kan registrere den i Catenda Developer Portal

## Token-validering

- Kall `list_projects()` som lettvekts-sjekk
- 401/403 -> token er utgatt/ugyldig -> re-autentiser
- Gjenbruk prosjektlisten for project-picker (unnga dobbelt API-kall)

## Interaktive pickere (kun ved behov)

```
Fant 3 prosjekter:
  1. Oslobygg Fase 2  (abc-123)
  2. Testprosjekt      (def-456)
  3. Demo              (ghi-789)
Velg prosjekt [1]: _
```

Auto-velg hvis kun ett alternativ. Default til forste pa Enter.

## Endringer

Filen `backend/scripts/setup_authentication.py` skrives om med:

1. `validate_existing_token()` - Test token med API-kall
2. `auto_authenticate()` - Velg riktig auth-flyt basert pa .env
3. `OAuthCallbackServer` - Midlertidig HTTP-server for callback-fangst
4. `pick_from_list()` - Generisk picker-hjelper
5. `auto_discover_project()` - Finn/velg prosjekt via API
6. `auto_discover_library()` - Finn/velg bibliotek via API
7. Fjern alle "Bruk eksisterende? (j/n)"-prompts
