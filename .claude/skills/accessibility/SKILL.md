---
name: accessibility
description: Tilgjengelighetsverktøy for WCAG-validering. Bruk ved arbeid med farger, kontrast eller UI-komponenter.
allowed-tools: Bash
---

# Tilgjengelighet (Accessibility)

## WCAG AA Krav

| Type | Minimum kontrast |
|------|------------------|
| Normal tekst | 4.5:1 |
| Stor tekst (18pt+ / 14pt bold) | 3:1 |
| UI-komponenter | 3:1 |

## Tilgjengelig verktøy

| Script | Formål | Når bruke |
|--------|--------|-----------|
| `check-contrast.mjs` | WCAG fargekontrast-sjekk | Etter fargeendringer, før release |

## Kjøre kontrastsjekk

```bash
node scripts/check-contrast.mjs
```

## Hva testes

Scriptet sjekker ~50 fargekombinasjoner i dark mode:

| Kategori | Eksempler |
|----------|-----------|
| Alerts | Info, Success, Warning, Danger tekst på bakgrunn |
| Badges | Default, Info, Success, Warning, Danger, Neutral |
| Tags | Neutral, Info, Warning, Frist |
| Table Rows | TE og BH rader |
| Modal Boxes | Gule, røde, blå bokser |
| Timeline | Grunnlag, Vederlag, Frist badges |
| Borders | Farget border på bakgrunner |
| Main Text | Body tekst på mørke bakgrunner |
| Status Text | Error, Success, Info, Warning |
| Progress Bars | Fargede barer på subtil bakgrunn |

## Tolke output

### Per kombinasjon

```
✅ PASS Alert Info: text on bg
       FG: #1a3a5a
       BG: rgba(180, 210, 255, 0.85) → #b8d4f7
       Ratio: 7.23:1 (Required: 4.5:1)
```

### Kategori-oppsummering

```
SUMMARY BY CATEGORY
================================================================================
✅ Alerts: 4/4 passed
✅ Badges: 6/6 passed
❌ Tags: 3/4 passed
```

### Ved feil - forslag til fiks

```
SUGGESTED FIXES

Tag Warning: text on bg:
  Current: #3a3020 on #f0e0a0 = 3.92:1
  Background luminance: 0.7234 (LIGHT)
  Foreground luminance: 0.0312
  Foreground needs luminance <= 0.0234
  → DARKEN the text color
```

## Når kjøre

| Situasjon | Anbefaling |
|-----------|------------|
| Endret farger i `src/index.css` | Kjør kontrastsjekk |
| Ny UI-komponent med farger | Legg til i scriptet, kjør sjekk |
| Før release | Verifiser alle kombinasjoner passerer |

## Legge til nye fargekombinasjoner

Rediger `scripts/check-contrast.mjs`:

1. Legg til farger i `darkColors`-objektet
2. Legg til kombinasjoner i `combinations`-arrayet:

```javascript
{
  name: 'My Component: text on bg',
  fg: 'my-text-color',      // Nøkkel i darkColors
  bg: 'my-bg-color',        // Nøkkel i darkColors
  type: 'normal',           // 'normal' (4.5:1) eller 'ui' (3:1)
  category: 'My Category'   // For gruppering i output
}
```

## Kjente begrensninger

- Kun dark mode farger er definert i scriptet
- Semi-transparente farger blandes med `#1a1a2e` (bg-default)
- Scriptet må oppdateres manuelt når CSS-variabler endres
