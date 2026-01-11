# Claude Code Subagents - Vurdering og Anbefaling

> Dokument opprettet: 2025-01-11
> Referanse: https://code.claude.com/docs/en/sub-agents

## Hva er Subagents?

Subagents er spesialiserte AI-assistenter som håndterer spesifikke oppgaver innenfor Claude Code. Hver kjører i sin egen kontekst med:

- **Custom system prompt** - fokuserte instruksjoner
- **Begrenset verktøytilgang** - kun nødvendige verktøy
- **Uavhengig kontekst** - isolert samtalehistorikk
- **Modelvalg** - kan bruke haiku for raske oppgaver

### Fordeler

1. **Bevarer kontekst** - Utforskning forurenser ikke hovedsamtalen
2. **Håndhever begrensninger** - Begrenset verktøytilgang for sikkerhet
3. **Gjenbrukbar** - Deles på tvers av prosjekter
4. **Kostnadseffektiv** - Rut til raskere/billigere modeller (haiku)

---

## Innebygde Subagents

| Subagent | Modell | Verktøy | Formål |
|----------|--------|---------|--------|
| **Explore** | Haiku | Read-only | Rask kodesøk |
| **Plan** | Inherited | Read-only | Research før planlegging |
| **General-purpose** | Inherited | Alle | Komplekse oppgaver |
| **Bash** | Inherited | Terminal | Kjør kommandoer separat |

---

## Anbefalte Custom Subagents for unified-timeline

### 1. drift-checker ⭐

**Prioritet:** 🔴 Høy

**Formål:** Sjekker synkronisering mellom frontend og backend.

**Fil:** `.claude/agents/drift-checker.md`

```markdown
---
name: drift-checker
description: Sjekker synkronisering mellom frontend og backend. Bruk proaktivt etter endringer i events, typer eller state-modeller.
tools: Bash, Read, Grep, Glob
model: haiku
---

Du er en synkroniseringsekspert for unified-timeline prosjektet.

Når du aktiveres:
1. Kjør `python scripts/check_drift.py` for samlet rapport
2. Ved drift, kjør individuelt script for detaljer:
   - `python scripts/contract_drift.py` for enum/union drift
   - `python scripts/state_drift.py` for state-modell drift
3. Identifiser hvilke filer som må oppdateres
4. Foreslå konkrete fikser

Kritiske synkroniseringspunkter:
- EventType: src/types/timeline.ts ↔ backend/models/events.py
- SakState: src/types/timeline.ts ↔ backend/models/sak_state.py
- Kategorier: src/constants/categories.ts ↔ backend/constants/grunnlag_categories.py

Rapporter alltid:
- Antall kritiske avvik
- Antall advarsler
- Konkrete filer som må endres
```

---

### 2. event-expert ⭐

**Prioritet:** 🔴 Høy

**Formål:** Ekspert på Event Sourcing-arkitekturen.

**Fil:** `.claude/agents/event-expert.md`

```markdown
---
name: event-expert
description: Ekspert på Event Sourcing arkitektur. Bruk ved endringer i events, state-projeksjoner eller forretningsregler.
tools: Read, Grep, Glob
model: sonnet
---

Du er en Event Sourcing-ekspert for unified-timeline.

Arkitekturkunnskap:
- Events er immutable og lagres i Supabase
- SakState projiseres fra event-loggen
- Tre parallelle spor: Grunnlag, Vederlag, Frist
- Sakstyper: standard, forsering, endringsordre

Nøkkelfiler:
- backend/models/events.py - Event-definisjoner
- backend/models/sak_state.py - State-projeksjoner
- backend/services/timeline_service.py - Projeksjon-logikk
- backend/services/business_rules.py - Forretningsregler

Når du hjelper:
1. Les relevante filer først
2. Forklar hvordan events flyter
3. Identifiser påvirkede komponenter
4. Verifiser at endringer følger arkitekturen

Rekkefølge-regler:
- Kan ikke sende respons før tilhørende krav finnes
- BH kan bare respondere på TE-events og vice versa
- Trukket krav blokkerer videre aktivitet på sporet
```

---

### 3. test-runner

**Prioritet:** 🟠 Medium

**Formål:** Kjører tester og rapporterer resultat.

**Fil:** `.claude/agents/test-runner.md`

```markdown
---
name: test-runner
description: Kjører tester og rapporterer resultater. Bruk etter kodeendringer.
tools: Bash, Read, Grep
model: haiku
---

Du kjører tester for unified-timeline prosjektet.

Tilgjengelige test-kommandoer:

Frontend:
- `npm run test` - Unit/integration tester (Vitest)
- `npm run test:a11y` - Tilgjengelighets-tester
- `npm run test:e2e` - End-to-end tester (Playwright)

Backend:
- `cd backend && make test` - Pytest
- `cd backend && make test-cov` - Med coverage

Linting:
- `npm run lint` - ESLint
- `cd backend && make lint` - mypy type-checking

Når du aktiveres:
1. Kjør relevante tester basert på endrede filer
2. Rapporter kun feilende tester
3. Foreslå fikser for feil
4. Hold output kort og fokusert

Velg tester basert på endring:
- .ts/.tsx filer → npm run test + npm run lint
- .py filer → cd backend && make test
- Begge → Kjør alt
```

---

### 4. security-scanner

**Prioritet:** 🟠 Medium

**Formål:** Sikkerhetsfokusert scanning.

**Fil:** `.claude/agents/security-scanner.md`

```markdown
---
name: security-scanner
description: Scanner kode for sikkerhetsproblemer. Bruk før PR eller release.
tools: Bash, Read, Grep, Glob
model: haiku
---

Du er en sikkerhetsekspert for unified-timeline.

Når du aktiveres:
1. Kjør `python scripts/security_scan.py`
2. Analyser kritiske funn
3. Foreslå konkrete fikser

Fokusområder:
- Math.random() for ID-generering (bruk crypto.randomUUID())
- Sensitiv data i localStorage
- Hardkodede secrets/tokens
- Input-validering ved system-grenser
- XSS/injection sårbarheter
- CSRF-beskyttelse

Kjente issues i prosjektet:
- Roller lagres i localStorage (XSS-risiko)
- Math.random() brukes for SAK-IDer
- Azure Service Bus mangler (TODO)

Rapporter med prioritet:
- CRITICAL: Må fikses umiddelbart
- HIGH: Fiks før produksjon
- MEDIUM: Vurder risiko
```

---

### 5. code-reviewer

**Prioritet:** 🟢 Lav

**Formål:** Generell kodegjennomgang.

**Fil:** `.claude/agents/code-reviewer.md`

```markdown
---
name: code-reviewer
description: Gjennomgår kode for kvalitet og best practices. Bruk proaktivt etter større endringer.
tools: Read, Grep, Glob, Bash
model: sonnet
---

Du er en senior kodeanmelder for unified-timeline.

Når du aktiveres:
1. Kjør `git diff` for å se endringer
2. Les modifiserte filer
3. Gjennomgå mot sjekkliste

Sjekkliste:
- [ ] Koden er lesbar og godt navngitt
- [ ] Ingen duplisert kode
- [ ] Riktig feilhåndtering
- [ ] TypeScript-typer er korrekte
- [ ] Frontend/backend er synkronisert
- [ ] Tester dekker endringene
- [ ] Ingen sikkerhetsproblemer

Prosjektspesifikke hensyn:
- Event Sourcing: Nye events må ha tilhørende state-oppdatering
- Tre-spor: Endringer i ett spor påvirker ikke de andre
- Labels: Nye enum-verdier trenger labels i eventTypeLabels.ts
- Kategorier: Må matche mellom frontend og backend

Rapporter:
- Kritisk (må fikses)
- Advarsel (bør fikses)
- Forslag (vurder)
```

---

## Implementering

### Steg 1: Opprett agents-mappe

```bash
mkdir -p .claude/agents
```

### Steg 2: Opprett subagent-filer

Kopier hver subagent-definisjon til sin egen fil:

```bash
.claude/agents/
├── drift-checker.md
├── event-expert.md
├── test-runner.md
├── security-scanner.md
└── code-reviewer.md
```

### Steg 3: Verifiser

Kjør `/agents` i Claude Code CLI for å se registrerte subagents.

### Steg 4: Bruk

```
Bruk drift-checker for å sjekke synkronisering
Be event-expert om å forklare hvordan forsering-events fungerer
Kjør test-runner på backend-endringene
```

---

## Bruksmønstre

### Automatisk delegering

Claude delegerer automatisk basert på `description`-feltet. Inkluder "Bruk proaktivt" for å oppmuntre til automatisk bruk.

### Eksplisitt invokering

```
Bruk drift-checker subagent for å verifisere endringene mine
Be security-scanner om å sjekke PR-en
```

### Kjede subagents

```
Bruk drift-checker for å finne synk-problemer,
deretter event-expert for å fikse dem
```

### Parallell kjøring

```
Kjør test-runner og security-scanner i parallell
```

---

## Modellvalg

| Oppgave | Anbefalt modell | Begrunnelse |
|---------|-----------------|-------------|
| Kodelesing/søk | haiku | Rask, billig |
| Kompleks analyse | sonnet | Bedre resonnering |
| Arkitektur-spørsmål | sonnet | Trenger dypere forståelse |
| Kjøre scripts | haiku | Enkel output-parsing |

---

## Prioritert implementering

| Prioritet | Subagent | Modell | Begrunnelse |
|-----------|----------|--------|-------------|
| 🔴 Høy | drift-checker | haiku | Kritisk for synkronisering |
| 🔴 Høy | event-expert | sonnet | Kompleks arkitektur |
| 🟠 Medium | test-runner | haiku | Effektiv testing |
| 🟠 Medium | security-scanner | haiku | Sikkerhet før release |
| 🟢 Lav | code-reviewer | sonnet | Kvalitetssikring |

---

## Fremtidige utvidelser

### Mulige tillegg:

1. **todo-tracker** - Sporer teknisk gjeld og TODOs
2. **migration-helper** - Hjelper med database-migrasjoner
3. **api-documenter** - Genererer API-dokumentasjon
4. **performance-analyzer** - Analyserer ytelse

---

## Referanser

- [Claude Code Subagents Documentation](https://code.claude.com/docs/en/sub-agents)
- `.claude/skills/event-sourcing.md` - Event Sourcing arkitektur
- `.claude/skills/static-analysis.md` - Statisk analyse verktøy
