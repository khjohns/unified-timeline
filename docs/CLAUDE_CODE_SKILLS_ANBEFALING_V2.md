# Claude Code Skills - Oppdatert Vurdering og Anbefaling (v2)

> Dokument opprettet: 2025-01-11
> Oppdatert: 2026-01-13 - Lagt til docs-update skill
> Referanse: https://code.claude.com/docs/en/skills

---

## Implementeringsstatus

| Komponent | Status | Plassering |
|-----------|--------|------------|
| `event-sourcing` skill | Implementert | `.claude/skills/event-sourcing/SKILL.md` |
| `static-analysis` skill | Implementert | `.claude/skills/static-analysis/SKILL.md` |
| `accessibility` skill | Implementert | `.claude/skills/accessibility/SKILL.md` |
| `ns8407` skill | Implementert | `.claude/skills/ns8407/SKILL.md` |
| `docs-update` skill | Implementert | `.claude/skills/docs-update/SKILL.md` |
| Custom subagents | Implementert | `.claude/agents/` |
| Multi-file skills (progressive disclosure) | **Ikke nødvendig** | Se vurdering nedenfor |
| Hooks | Ikke implementert | Se `CLAUDE_CODE_HOOKS_ANBEFALING.md` |

**Nåværende struktur:**
```
.claude/
├── settings.local.json          # Permissions
├── skills/
│   ├── event-sourcing/
│   │   └── SKILL.md             # 195 linjer
│   ├── static-analysis/
│   │   └── SKILL.md             # 211 linjer
│   ├── accessibility/
│   │   └── SKILL.md             # 108 linjer
│   ├── ns8407/
│   │   └── SKILL.md             # 202 linjer
│   └── docs-update/
│       └── SKILL.md             # 239 linjer
└── agents/
    ├── event-expert.md          # Implementert
    └── drift-checker.md         # Implementert
```

---

## Vurdering: Multi-file struktur

### Konklusjon: Ikke nødvendig nå

Etter gjennomgang av [Claude Code dokumentasjonen](https://code.claude.com/docs/en/skills#add-supporting-files-with-progressive-disclosure) og analyse av våre skills, er konklusjonen at **multi-file struktur ikke er hensiktsmessig for dette prosjektet**.

### Begrunnelse

| Skill | Linjer | Grense | Status |
|-------|--------|--------|--------|
| accessibility | 108 | 500 | Godt under |
| event-sourcing | 195 | 500 | Godt under |
| ns8407 | 202 | 500 | Godt under |
| static-analysis | 211 | 500 | Godt under |
| docs-update | 239 | 500 | Godt under |

**Argumenter mot multi-file:**

1. **Alle filer er godt under 500-linjers grensen** - Progressive disclosure gir mest verdi når SKILL.md nærmer seg grensen
2. **Ekstra kompleksitet** - Flere filer å vedlikeholde uten reell gevinst
3. **Risiko for dype referanser** - Dokumentasjonen advarer mot fil A → fil B → fil C
4. **Scripts ligger allerede i `/scripts`** - Riktig struktur; skills refererer til scripts som kjøres

### Når revurdere

Vurder multi-file struktur hvis:
- En skill nærmer seg 400+ linjer
- Det legges til omfattende eksempler eller tutorials
- `event-sourcing` skal inneholde komplett event-liste med alle felter

**YAGNI-prinsippet gjelder** - ikke overingeniør før behovet oppstår.

---

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

## Skill-Struktur

### Valgt: Enkelt-fil struktur

Basert på vurderingen ovenfor bruker vi enkelt-fil struktur:

```
.claude/skills/
├── event-sourcing/
│   └── SKILL.md           # Komplett guide (195 linjer)
│
├── static-analysis/
│   └── SKILL.md           # Script-referanser (211 linjer)
│
├── accessibility/
│   └── SKILL.md           # WCAG-guide (108 linjer)
│
├── ns8407/
│   └── SKILL.md           # Kontraktsreferanse (202 linjer)
│
└── docs-update/
    └── SKILL.md           # Dokumentasjonsvedlikehold (239 linjer)
```

### Fremtidig multi-file (kun ved behov)

Hvis en skill vokser over 400 linjer, kan den splittes:

```
event-sourcing/
├── SKILL.md               # Oversikt (alltid lastet)
├── events-reference.md    # Detaljert event-liste (lazy load)
└── examples.md            # Eksempler (lazy load)
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

## Implementert Mappestruktur

```
.claude/
├── settings.local.json        # Permissions
│
├── skills/
│   ├── event-sourcing/
│   │   └── SKILL.md          # Komplett guide
│   ├── static-analysis/
│   │   └── SKILL.md          # Script-referanser
│   ├── accessibility/
│   │   └── SKILL.md          # WCAG-guide
│   ├── ns8407/
│   │   └── SKILL.md          # Kontraktsreferanse
│   └── docs-update/
│       └── SKILL.md          # Dokumentasjonsvedlikehold
│
└── agents/
    ├── event-expert.md       # Event Sourcing + NS 8407
    └── drift-checker.md      # Synkroniseringssjekk

scripts/                       # Eksisterende - refereres fra skills
├── check_drift.py            # Samlet drift-sjekk
├── contract_drift.py
├── state_drift.py
├── docs_drift.py             # Dokumentasjon vs kode
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

### 2. Hold skills kompakte

- **Under 500 linjer** per SKILL.md
- **Kun essensielt innhold** - ikke dupliser det som finnes i kode/scripts
- **Vurder multi-file** først når en skill nærmer seg 400+ linjer

### 3. allowed-tools begrenser verktøy

```yaml
---
allowed-tools: Bash, Read  # Kun disse tilgjengelig
---
```

---

## Status og Historikk

### Implementert (v2)

| Komponent | Status |
|-----------|--------|
| 5 skills (event-sourcing, static-analysis, accessibility, ns8407, docs-update) | ✓ Implementert |
| 2 agenter (event-expert, drift-checker) | ✓ Implementert |
| Script-referanser i skills | ✓ Implementert |
| Multi-file progressive disclosure | ✗ Ikke nødvendig |

### Endringer fra v1

| Før (v1) | Etter (v2) |
|----------|------------|
| 2 skills | 5 skills |
| Ingen agenter | 2 agenter implementert |
| Planla multi-file | Vurdert og forkastet (YAGNI) |
| Forklarte script-innhold | Refererer til scripts for kjøring |

---

## Referanser

- [Claude Code Skills Documentation](https://code.claude.com/docs/en/skills)
- [Claude Code Subagents Documentation](https://code.claude.com/docs/en/sub-agents)
- `scripts/` - Eksisterende analyse-scripts
