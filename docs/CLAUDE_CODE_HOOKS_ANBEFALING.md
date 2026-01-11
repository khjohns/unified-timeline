# Claude Code Hooks - Vurdering og Anbefaling

> Dokument opprettet: 2025-01-11
> Referanse: https://code.claude.com/docs/en/hooks-guide

## Hva er Hooks?

Claude Code hooks er brukerdefinerte shell-kommandoer som kjøres automatisk på ulike punkter i Claude Code sitt livssyklus. De gir deterministisk kontroll over oppførsel og sikrer at visse handlinger alltid kjøres.

## Tilgjengelige Hook-Typer

| Hook-Type | Beskrivelse | Relevans for prosjektet |
|-----------|-------------|-------------------------|
| `PreToolUse` | Før verktøykall (kan blokkere) | ⭐ Høy - beskytte filer |
| `PostToolUse` | Etter verktøykall fullført | ⭐ Høy - formatering |
| `Stop` | Når Claude avslutter respons | ⭐ Høy - drift-sjekk |
| `Notification` | Ved varsler | 🔹 Medium - desktop-varsler |
| `UserPromptSubmit` | Når bruker sender prompt | 🔹 Lav |
| `SessionStart` | Ved sesjonsstart | 🔹 Lav |
| `SessionEnd` | Ved sesjonsavslutning | 🔹 Lav |

---

## Anbefalte Hooks for unified-timeline

### 1. Beskytt Sensitive Filer (PreToolUse)

**Prioritet:** 🔴 Høy

**Formål:** Blokker Claude fra å redigere filer som ikke bør endres.

**Beskyttede filer:**
- `.env`, `.env.local` - Miljøvariabler med secrets
- `package-lock.json`, `pnpm-lock.yaml` - Lock-filer
- `.git/` - Git internals
- `node_modules/` - Dependencies

**Konfigurasjon:**

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "python3 -c \"import json,sys; d=json.load(sys.stdin); p=d.get('tool_input',{}).get('file_path',''); blocked=['.env','.env.local','package-lock.json','pnpm-lock.yaml','.git/','node_modules/']; sys.exit(2 if any(x in p for x in blocked) else 0)\""
          }
        ]
      }
    ]
  }
}
```

**Exit-koder:**
- `0` = Tillat operasjonen
- `2` = Blokker operasjonen (vises som feil til Claude)

---

### 2. Drift-Sjekk ved Stopp (Stop)

**Prioritet:** 🔴 Høy

**Formål:** Kjør synkroniseringssjekk automatisk når Claude er ferdig med en oppgave. Fanger opp frontend/backend drift tidlig.

**Konfigurasjon:**

```json
{
  "hooks": {
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "cd \"$CLAUDE_PROJECT_DIR\" && python3 scripts/check_drift.py --format text 2>/dev/null | head -25 || true"
          }
        ]
      }
    ]
  }
}
```

**Merk:** `|| true` sikrer at hook ikke feiler selv om scriptet har warnings.

---

### 3. Automatisk Formatering (PostToolUse)

**Prioritet:** 🟠 Medium

**Formål:** Kjør prettier automatisk på TypeScript/JavaScript-filer etter redigering.

**Konfigurasjon:**

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "jq -r '.tool_input.file_path' | xargs -I {} sh -c 'case \"{}\" in *.ts|*.tsx|*.js|*.jsx) cd \"$CLAUDE_PROJECT_DIR\" && npx prettier --write \"{}\" 2>/dev/null;; esac'"
          }
        ]
      }
    ]
  }
}
```

**Alternativ med Python-filer (black):**

```json
{
  "type": "command",
  "command": "jq -r '.tool_input.file_path' | xargs -I {} sh -c 'case \"{}\" in *.py) cd \"$CLAUDE_PROJECT_DIR\" && python3 -m black \"{}\" 2>/dev/null;; esac'"
}
```

---

### 4. Kommando-Logging (PreToolUse)

**Prioritet:** 🟢 Lav

**Formål:** Logg alle bash-kommandoer for debugging og audit.

**Konfigurasjon:**

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "jq -r '\"[\" + (now | strftime(\"%Y-%m-%d %H:%M:%S\")) + \"] \" + .tool_input.command' >> \"$CLAUDE_PROJECT_DIR/.claude/command-log.txt\""
          }
        ]
      }
    ]
  }
}
```

**Output-eksempel (.claude/command-log.txt):**
```
[2025-01-11 14:32:15] npm run test
[2025-01-11 14:33:22] git status
[2025-01-11 14:33:45] python scripts/check_drift.py
```

---

### 5. Desktop-Varsler (Notification)

**Prioritet:** 🟢 Lav (personlig preferanse)

**Formål:** Få desktop-varsel når Claude venter på input.

**Linux (notify-send):**

```json
{
  "hooks": {
    "Notification": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "notify-send 'Claude Code' 'Venter på input' 2>/dev/null || true"
          }
        ]
      }
    ]
  }
}
```

**macOS (osascript):**

```json
{
  "type": "command",
  "command": "osascript -e 'display notification \"Venter på input\" with title \"Claude Code\"' 2>/dev/null || true"
}
```

---

## Komplett Anbefalt Konfigurasjon

Kopier dette til `.claude/settings.json` (eller bruk `/hooks` kommandoen):

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "python3 -c \"import json,sys; d=json.load(sys.stdin); p=d.get('tool_input',{}).get('file_path',''); blocked=['.env','.env.local','package-lock.json','pnpm-lock.yaml','.git/','node_modules/']; sys.exit(2 if any(x in p for x in blocked) else 0)\""
          }
        ]
      },
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "jq -r '\"[\" + (now | strftime(\"%Y-%m-%d %H:%M:%S\")) + \"] \" + .tool_input.command' >> \"$CLAUDE_PROJECT_DIR/.claude/command-log.txt\""
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "jq -r '.tool_input.file_path' | xargs -I {} sh -c 'case \"{}\" in *.ts|*.tsx|*.js|*.jsx) cd \"$CLAUDE_PROJECT_DIR\" && npx prettier --write \"{}\" 2>/dev/null;; esac'"
          }
        ]
      }
    ],
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "cd \"$CLAUDE_PROJECT_DIR\" && python3 scripts/check_drift.py --format text 2>/dev/null | head -25 || true"
          }
        ]
      }
    ]
  }
}
```

---

## Implementering

### Steg 1: Opprett settings.json

```bash
mkdir -p .claude
touch .claude/settings.json
```

### Steg 2: Kopier konfigurasjon

Kopier JSON-konfigurasjonen ovenfor til `.claude/settings.json`.

### Steg 3: Verifiser

Kjør `/hooks` i Claude Code CLI for å se registrerte hooks.

### Steg 4: Test

1. Prøv å redigere `.env` - skal blokkeres
2. Rediger en `.ts`-fil - skal formateres automatisk
3. Fullfør en oppgave - drift-sjekk skal kjøres

---

## Sikkerhetshensyn

⚠️ **Viktig:**

- Hooks kjøres med dine brukerrettigheter
- Unngå å logge sensitive data
- Gjennomgå alle hooks før du aktiverer dem
- Vær forsiktig med hooks som kjører eksterne scripts

---

## Fremtidige Utvidelser

### Mulige tillegg:

1. **Lint-sjekk før commit** - Kjør ESLint på endrede filer
2. **Type-sjekk** - Kjør `tsc --noEmit` etter TypeScript-endringer
3. **Test-kjøring** - Kjør relevante tester etter kodeendringer
4. **Security scan** - Kjør `security_scan.py` ved Stop

### Eksempel: Type-sjekk hook

```json
{
  "matcher": "Edit|Write",
  "hooks": [{
    "type": "command",
    "command": "jq -r '.tool_input.file_path' | xargs -I {} sh -c 'case \"{}\" in *.ts|*.tsx) cd \"$CLAUDE_PROJECT_DIR\" && npx tsc --noEmit 2>&1 | head -10;; esac'"
  }]
}
```

---

## Referanser

- [Claude Code Hooks Guide](https://code.claude.com/docs/en/hooks-guide)
- [Claude Code Documentation](https://code.claude.com/docs)
