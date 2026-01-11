# Claude Code Skills - Oppdatert Vurdering og Anbefaling (v2)

> Dokument opprettet: 2025-01-11
> Oppdatert med: Multi-file structure, script-referanser, subagent-integrasjon
> Referanse: https://code.claude.com/docs/en/skills

## Ny innsikt: Scripts som kjøres uten å leses

En viktig funksjon i Claude Code skills er at **scripts kan refereres og kjøres uten å laste innholdet i kontekstvinduet**. Dette er ideelt for prosjektet vårt som allerede har scripts i `/scripts`.

### Fordeler

| Aspekt | Før (les script) | Etter (kjør script) |
|--------|------------------|---------------------|
| Kontekstbruk | ~500 tokens per script | 0 tokens |
| Pålitelighet | Claude kan misforstå | Testet kode |
| Konsistens | Varierende output | Identisk hver gang |
| Vedlikehold | Oppdater skill + script | Kun oppdater script |

### Eksisterende scripts som kan refereres

```
scripts/
├── check_drift.py        # Samlet drift-sjekk
├── contract_drift.py     # Enum/union synk
├── state_drift.py        # State-modell synk
├── constant_drift.py     # Hardkodede verdier
├── label_coverage.py     # Label-dekning
├── todo_tracker.py       # TODO/FIXME-sporing
└── security_scan.py      # Sikkerhetssårbarhet
```

---

## Oppdatert Skill-Struktur

### Anbefalt: Multi-file struktur med progressive disclosure

```
.claude/skills/
├── event-sourcing/
│   ├── SKILL.md           # Oversikt (alltid lastet)
│   ├── events-reference.md # Detaljert event-liste (lastes ved behov)
│   └── examples.md         # Eksempler (lastes ved behov)
│
├── static-analysis/
│   ├── SKILL.md           # Oversikt + script-referanser
│   └── interpreting-output.md  # Hvordan tolke output
│
└── testing/
    └── SKILL.md           # Enkelt-fil skill
```

---

## Reviderte Skills

### 1. static-analysis (Oppdatert) ⭐

**Nøkkelendring:** Refererer til scripts som bare skal kjøres, ikke leses.

**Fil:** `.claude/skills/static-analysis/SKILL.md`

```markdown
---
name: static-analysis
description: Kjører statisk analyse for synkronisering, sikkerhet og kodekvalitet. Bruk proaktivt ved kodeendringer.
allowed-tools: Bash, Read
---

# Statisk Analyse

## Hurtigkommandoer

Kjør disse scripts direkte - ikke les innholdet, bare kjør og tolk output:

### Synkroniseringssjekk
```bash
python scripts/check_drift.py
```
Sjekker frontend/backend synk. Exit 0 = OK, annet = drift funnet.

### Sikkerhetsscan
```bash
python scripts/security_scan.py
```
Scanner for Math.random(), localStorage-sensitiv data, hardkodede secrets.

### TODO-sporing
```bash
python scripts/todo_tracker.py
```
Finner alle TODO/FIXME med severity-nivå.

### Label-dekning
```bash
python scripts/label_coverage.py
```
Verifiserer at alle enum-verdier har tilhørende labels.

## Når kjøre hva

| Situasjon | Kommando |
|-----------|----------|
| Etter event-endringer | `python scripts/contract_drift.py` |
| Etter state-endringer | `python scripts/state_drift.py` |
| Før commit | `python scripts/check_drift.py` |
| Før PR | Alle scripts |

## Tolke output

For detaljert guide om output-tolkning, se [interpreting-output.md](interpreting-output.md).
```

**Fil:** `.claude/skills/static-analysis/interpreting-output.md`

```markdown
# Tolke Script-Output

## check_drift.py

```
============================================================
  DRIFT CHECK REPORT
============================================================

CONTRACT DRIFT (Enums/Unions)
----------------------------------------
  DRIFT FUNNET: 2 typer              ← MÅ FIKSES
    - EventType: 3 avvik
    - SporType: 1 avvik
```

**Handling:**
1. Kjør `python scripts/contract_drift.py` for detaljer
2. Oppdater enten frontend (`src/types/timeline.ts`) eller backend (`backend/models/events.py`)
3. Kjør sjekk igjen

## security_scan.py

```
CRITICAL:
  Math.random() for ID generation
    src/api/forsering.ts:240         ← Linje 240 i filen
```

**Handling:** Bytt til `crypto.randomUUID()`.

## todo_tracker.py

Severity-nivåer:
- CRITICAL → Må fikses før produksjon
- HIGH → Bør fikses snart
- MEDIUM → Planlegg
- LOW → Nice to have
```

---

### 2. event-sourcing (Multi-file) ⭐

**Fil:** `.claude/skills/event-sourcing/SKILL.md`

```markdown
---
name: event-sourcing
description: Guide til Event Sourcing arkitekturen. Bruk ved arbeid med events, state-projeksjoner eller forretningsregler.
allowed-tools: Read, Grep, Glob
---

# Event Sourcing Arkitektur

## Kjerneprinsipp

```
Events (immutable) → Projeksjon → SakState (computed)
```

## Tre-Spor-Modellen

| Spor | Spørsmål | Hjemmel |
|------|----------|---------|
| Grunnlag | Har TE krav? | §25.2 |
| Vederlag | Hva koster det? | §34 |
| Frist | Hvor lang tid? | §33 |

## Nøkkelfiler

- `backend/models/events.py` - Event-definisjoner
- `backend/models/sak_state.py` - State-projeksjoner
- `src/types/timeline.ts` - Frontend-typer

## Vanlige oppgaver

### Legge til ny event-type
Se [events-reference.md](events-reference.md#legge-til-ny-event).

### Endre state-modell
Se [events-reference.md](events-reference.md#endre-state).

### Verifiser synkronisering
```bash
python scripts/check_drift.py
```

## Detaljert referanse

For komplett event-liste og eksempler, se:
- [events-reference.md](events-reference.md)
- [examples.md](examples.md)
```

---

## Subagent + Skill Integrasjon

### Gi subagents tilgang til skills

Subagents må eksplisitt liste hvilke skills de har tilgang til:

**Fil:** `.claude/agents/drift-checker.md` (oppdatert)

```markdown
---
name: drift-checker
description: Sjekker synkronisering mellom frontend og backend.
tools: Bash, Read, Grep, Glob
skills: static-analysis
model: haiku
---

Du er en synkroniseringsekspert.

Du har tilgang til static-analysis skill som inneholder
kommandoer for å kjøre drift-sjekk scripts.

Kjør scripts direkte - ikke les innholdet:
- `python scripts/check_drift.py`
- `python scripts/contract_drift.py`
- `python scripts/state_drift.py`
```

**Fil:** `.claude/agents/event-expert.md` (oppdatert)

```markdown
---
name: event-expert
description: Ekspert på Event Sourcing arkitektur.
tools: Read, Grep, Glob
skills: event-sourcing
model: sonnet
---

Du er en Event Sourcing-ekspert.

Du har tilgang til event-sourcing skill med detaljert
dokumentasjon om arkitekturen.

Bruk skill-dokumentasjonen for å:
- Forklare event-flyt
- Verifisere arkitektur-beslutninger
- Hjelpe med nye event-typer
```

---

## Komplett Anbefalt Mappestruktur

```
.claude/
├── settings.json              # Hooks-konfigurasjon
│
├── skills/
│   ├── event-sourcing/
│   │   ├── SKILL.md          # Oversikt (alltid lastet)
│   │   ├── events-reference.md   # Detaljer (lazy load)
│   │   └── examples.md       # Eksempler (lazy load)
│   │
│   └── static-analysis/
│       ├── SKILL.md          # Script-referanser
│       └── interpreting-output.md  # Output-guide
│
└── agents/
    ├── drift-checker.md      # skills: static-analysis
    ├── event-expert.md       # skills: event-sourcing
    ├── test-runner.md
    ├── security-scanner.md   # skills: static-analysis
    └── code-reviewer.md      # skills: event-sourcing, static-analysis

scripts/                       # Eksisterende - IKKE endre
├── check_drift.py            # Refereres fra skills
├── contract_drift.py
├── state_drift.py
├── security_scan.py
├── todo_tracker.py
└── ...
```

---

## Viktige Prinsipper

### 1. Scripts kjøres, ikke leses

```markdown
# RIKTIG ✓
Kjør synkroniseringssjekk:
```bash
python scripts/check_drift.py
```

# FEIL ✗
Les scriptet for å forstå hvordan det fungerer...
```

### 2. Progressive disclosure

- **SKILL.md** inneholder essensielt (alltid lastet)
- **Andre filer** lastes kun ved behov (sparer kontekst)

### 3. Subagents må liste skills eksplisitt

```yaml
---
skills: static-analysis, event-sourcing  # Må listes!
---
```

### 4. allowed-tools begrenser verktøy

```yaml
---
allowed-tools: Bash, Read  # Kun disse tilgjengelig
---
```

---

## Migrering fra v1

### Endringer fra forrige versjon

| Før (v1) | Etter (v2) |
|----------|------------|
| Enkelt-fil skills | Multi-file med SKILL.md |
| Forklarte script-innhold | Refererer til scripts for kjøring |
| Subagents uten skills | Subagents med `skills:` felt |

### Migreringsplan

1. Opprett mappestruktur `.claude/skills/<skill-name>/`
2. Flytt eksisterende `.md` til `SKILL.md`
3. Trekk ut detaljer til separate filer
4. Oppdater subagents med `skills:` referanser

---

## Referanser

- [Claude Code Skills Documentation](https://code.claude.com/docs/en/skills)
- [Claude Code Subagents Documentation](https://code.claude.com/docs/en/sub-agents)
- `scripts/` - Eksisterende analyse-scripts
