# Claude Code Skills og Agents

> Sist oppdatert: 2026-01-14

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

| Skill | Formål | allowed-tools |
|-------|--------|---------------|
| `event-sourcing` | Event Sourcing arkitektur, tre-spor-modell | Read, Grep, Glob |
| `static-analysis` | Drift-sjekk, sikkerhet, kodekvalitet | Bash, Read, Grep |
| `accessibility` | WCAG-validering, kontrastsjekk | Bash |
| `ns8407` | NS 8407:2011 kontraktsreferanse | Read, Grep, Glob |
| `docs-update` | Dokumentasjonsvedlikehold | Bash, Read, Grep |

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

| Agent | Modell | Formål | Skills |
|-------|--------|--------|--------|
| `event-expert` | sonnet | Ekspert på Event Sourcing og NS 8407 | event-sourcing, ns8407 |
| `drift-checker` | sonnet | Sjekker frontend/backend synkronisering | static-analysis |
| `docs-checker` | sonnet | Validerer dokumentasjon mot kode | docs-update |

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

### Skills

#### 1. Skriv gode beskrivelser

Beskrivelsen er kritisk - Claude bruker den til å velge når skill skal aktiveres.

```yaml
# DÅRLIG
description: Hjelper med dokumenter

# BRA
description: Validerer WCAG-kontrast og tilgjengelighet. Bruk ved arbeid med farger, UI-komponenter eller tilgjengelighetssjekk.
```

**Inkluder:** Spesifikke evner, trigger-ord brukere ville sagt, når skill skal brukes.

#### 2. Hold skills kompakte

- Under 500 linjer per SKILL.md
- Referer til separate filer for detaljer (progressive disclosure)
- Scripts konsumerer ikke kontekst - kun output gjør det

#### 3. Begrens verktøy ved behov

```yaml
allowed-tools: Read, Grep, Glob  # Read-only skill
```

### Agents

#### 4. Bruk agents for isolerte oppgaver

| Bruk agent når | Bruk hovedsamtale når |
|----------------|----------------------|
| Verbose output du ikke trenger | Hyppig frem-og-tilbake |
| Selvstendige oppgaver | Flere faser deler kontekst |
| Parallelle undersøkelser | Raske, målrettede endringer |

#### 5. Design fokuserte agents

Hver agent skal være ekspert på én ting. Skriv detaljerte beskrivelser:

```yaml
# DÅRLIG
description: Kodegjennomgang

# BRA
description: Sjekker synkronisering mellom frontend og backend. Bruk proaktivt etter endringer i events, typer eller state-modeller.
```

#### 6. Agents arver ikke skills automatisk

Må eksplisitt listes i frontmatter:

```yaml
---
name: drift-checker
skills: static-analysis, event-sourcing
---
```

### Generelt

#### 7. Scripts kjøres, ikke leses

```markdown
# RIKTIG
Kjør: python scripts/check_drift.py

# FEIL
Les scriptet for å forstå hvordan det fungerer...
```

#### 8. Velg riktig modell

| Oppgave | Modell | Begrunnelse |
|---------|--------|-------------|
| Rask søk, kjøre scripts | haiku | Lav latens, billig |
| Kodegjennomgang | sonnet | Balansert |
| Kompleks analyse, arkitektur | opus | Mest kapabel |

#### 9. Begrensninger å vite om

- Agents kan ikke starte andre agents (ingen nesting)
- Background agents kan ikke bruke MCP-verktøy
- Skills må eksplisitt lastes for agents

---

## Når bruke hva?

| Behov | Verktøy |
|-------|---------|
| Domenekunnskap som lastes automatisk | **Skill** |
| Gjenbrukbare prompts brukeren kaller | Slash-kommando |
| Prosjekt-brede instruksjoner | CLAUDE.md |
| Isolerte oppgaver med egen kontekst | **Agent** |
| Kjøre scripts ved events | Hooks |
| Koble til eksterne verktøy/data | MCP-servere |

---

## Referanser

- [Claude Code Skills](https://code.claude.com/docs/en/skills)
- [Claude Code Subagents](https://code.claude.com/docs/en/sub-agents)
- [Claude Code Hooks](https://code.claude.com/docs/en/hooks) - Se `CLAUDE_CODE_HOOKS_ANBEFALING.md`
