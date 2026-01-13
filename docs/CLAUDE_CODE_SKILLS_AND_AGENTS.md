# Claude Code Skills og Agents

> Sist oppdatert: 2026-01-13

Oversikt over implementerte Claude Code skills og agents for unified-timeline prosjektet.

---

## Struktur

```
.claude/
├── settings.local.json          # Permissions
│
├── skills/                      # Domenekunnskap (lastes automatisk)
│   ├── event-sourcing/SKILL.md  # 195 linjer - Event Sourcing arkitektur
│   ├── static-analysis/SKILL.md # 211 linjer - Statisk analyse verktøy
│   ├── accessibility/SKILL.md   # 108 linjer - WCAG tilgjengelighet
│   ├── ns8407/SKILL.md          # 202 linjer - NS 8407 kontraktsreferanse
│   └── docs-update/SKILL.md     # 239 linjer - Dokumentasjonsvedlikehold
│
└── agents/                      # Spesialiserte subagents
    ├── event-expert.md          # Event Sourcing + NS 8407 ekspert
    ├── drift-checker.md         # Frontend/backend synkronisering
    └── docs-checker.md          # Dokumentasjonsvalidering
```

---

## Skills (5 stk)

Skills er domenekunnskap som lastes automatisk basert på kontekst.

| Skill | Formål | Når brukes |
|-------|--------|------------|
| `event-sourcing` | Event Sourcing arkitektur, tre-spor-modell | Endringer i events, state |
| `static-analysis` | Drift-sjekk, sikkerhet, kodekvalitet | Før commit, ved endringer |
| `accessibility` | WCAG-validering, kontrastsjekk | UI-arbeid, farger |
| `ns8407` | NS 8407:2011 kontraktsreferanse | Forretningsregler, kategorier |
| `docs-update` | Dokumentasjonsvedlikehold | Etter store endringer |

### Bruk

Skills aktiveres automatisk når Claude oppdager relevant kontekst, eller via `/skill-name`:

```
/event-sourcing   # Vis Event Sourcing guide
/static-analysis  # Kjør statisk analyse
/ns8407           # NS 8407 kontraktsreferanse
```

---

## Agents (3 stk)

Agents er spesialiserte subagents som kjører i isolert kontekst.

| Agent | Modell | Formål |
|-------|--------|--------|
| `event-expert` | sonnet | Ekspert på Event Sourcing og NS 8407 |
| `drift-checker` | sonnet | Sjekker frontend/backend synkronisering |
| `docs-checker` | sonnet | Validerer dokumentasjon mot kode |

### Bruk

Agents aktiveres automatisk eller eksplisitt:

```
Bruk drift-checker for å sjekke synkronisering
Be event-expert om å forklare forsering-arkitekturen
Kjør docs-checker på ARCHITECTURE_AND_DATAMODEL.md
```

### docs-checker detaljer

Validerer disse dokumentene semantisk:

| Dokument | Sjekker |
|----------|---------|
| `ARCHITECTURE_AND_DATAMODEL.md` | Event-typer, SakState, enums, porter |
| `FRONTEND_ARCHITECTURE.md` | Versjoner, komponent-antall, mapper |
| `backend/docs/API.md` | Endepunkter, kategorier, varsel-typer |
| `QUICKSTART.md` | API-endepunkter, kommandoer, filstier |
| `README.md` | Versjoner, testantall, event-typer |

---

## Scripts

Skills og agents refererer til disse scripts:

| Script | Formål | Brukes av |
|--------|--------|-----------|
| `scripts/check_drift.py` | Samlet drift-sjekk | drift-checker |
| `scripts/docs_drift.py` | Dokumentasjon vs kode | docs-checker |
| `scripts/check_openapi_freshness.py` | OpenAPI spec freshness | docs-checker |
| `scripts/contract_drift.py` | Enum/union synk | static-analysis |
| `scripts/state_drift.py` | State-modell synk | static-analysis |
| `scripts/security_scan.py` | Sikkerhetssårbarhet | static-analysis |
| `scripts/todo_tracker.py` | TODO/FIXME-sporing | static-analysis |

### Kjør scripts direkte

```bash
python scripts/check_drift.py           # Frontend/backend synk
python scripts/docs_drift.py            # Dokumentasjon drift
python scripts/check_openapi_freshness.py --fix  # Regenerer OpenAPI
```

---

## Beste praksis

### 1. Scripts kjøres, ikke leses

```markdown
# RIKTIG
Kjør: python scripts/check_drift.py

# FEIL
Les scriptet for å forstå hvordan det fungerer...
```

### 2. Hold skills kompakte

- Under 500 linjer per SKILL.md
- Referer til scripts for detaljer
- YAGNI - ikke legg til før behovet oppstår

### 3. Bruk riktig modell

| Oppgave | Modell |
|---------|--------|
| Rask søk/kjøring | haiku |
| Kompleks analyse | sonnet |
| Arkitektur-spørsmål | sonnet |

---

## Referanser

- [Claude Code Skills](https://code.claude.com/docs/en/skills)
- [Claude Code Subagents](https://code.claude.com/docs/en/sub-agents)
- [Claude Code Hooks](https://code.claude.com/docs/en/hooks) - Se `CLAUDE_CODE_HOOKS_ANBEFALING.md`
