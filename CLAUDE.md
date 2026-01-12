# Unified Timeline - Claude Code Context

## Prosjektoversikt

Dette er en digital samhandlingsplattform for håndtering av endringsordrer (KOE - Krav om Endring) i byggeprosjekter etter NS 8407:2011 totalentreprisekontrakten. Utviklet for Oslobygg KF.

## Tech Stack

| Lag | Teknologi |
|-----|-----------|
| Frontend | React 19 + TypeScript 5.8 + Vite |
| Backend | Flask + Python 3.11 + Pydantic v2 |
| Database | Supabase (PostgreSQL) |
| Arkitektur | Event Sourcing + CQRS |
| Testing | Vitest (unit), Playwright (e2e), Pytest (backend) |

## Viktige Arkitekturbegreper

### Tre-Spor-Modellen

Hver sak har tre uavhengige spor som behandles parallelt:

| Spor | Spørsmål | Hjemmel |
|------|----------|---------|
| **Grunnlag** | Har TE krav på endring? (Ansvar) | §25.2 |
| **Vederlag** | Hva koster det? | §34 |
| **Frist** | Hvor lang tid trengs? | §33 |

### Sakstyper

- `standard` - Ordinær KOE-sak
- `forsering` - Akselerasjon etter §33.8
- `endringsordre` - Formell EO etter §31.3

### Roller

- **TE** (Totalentreprenør) - Sender krav
- **BH** (Byggherre) - Responderer på krav

## Mappestruktur

```
src/
├── components/    # React komponenter
├── pages/         # Sideruter
├── api/           # API-klienter
├── hooks/         # Custom hooks
├── types/         # TypeScript typer
└── constants/     # Konstanter

backend/
├── models/        # Event + State modeller
├── services/      # Forretningslogikk
├── routes/        # API endpoints
└── repositories/  # Database-lag
```

## Kommandoer

```bash
# Frontend
npm run dev            # Start dev server
npm run test           # Unit tester
npm run test:e2e       # E2E tester
npm run lint           # Linting

# Backend
cd backend && make test    # Pytest
cd backend && make run     # Flask server

# Statisk analyse
python scripts/check_drift.py       # Synk-sjekk
python scripts/todo_tracker.py      # TODO-sporing
python scripts/security_scan.py     # Sikkerhetsscan
```

## Før du endrer kode

1. **Les relevante filer først** - Forstå eksisterende struktur
2. **Sjekk synkronisering** - Frontend/backend må matche for events og typer
3. **Kjør tester** - `npm run test` og `cd backend && make test`
4. **Kjør statisk analyse** ved behov - Se scripts i `/scripts`

## Viktige filer å kjenne til

| Fil | Innhold |
|-----|---------|
| `backend/models/events.py` | Alle event-typer og data-modeller |
| `backend/models/sak_state.py` | State-projeksjoner |
| `src/types/timeline.ts` | Frontend TypeScript typer |
| `src/constants/categories.ts` | Grunnlag-kategorier |
| `docs/ARCHITECTURE_AND_DATAMODEL.md` | Detaljert arkitektur |

## Skills

Mer detaljerte guider finnes i `.claude/skills/`:

- `event-sourcing/SKILL.md` - Event Sourcing arkitektur
- `static-analysis/SKILL.md` - Statisk analyse verktøy
- `accessibility/SKILL.md` - WCAG tilgjengelighet og kontrastsjekk
- `ns8407/SKILL.md` - NS 8407:2011 kontraktsreferanse og kategorimapping
