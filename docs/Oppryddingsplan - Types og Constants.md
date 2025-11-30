# Oppryddingsplan: Types og Constants

**Dato:** November 2025
**Versjon:** 1.0
**Status:** Klar for implementering
**Estimert tid:** 4-6 timer

---

## Innholdsfortegnelse

1. [Bakgrunn og funn](#1-bakgrunn-og-funn)
2. [Kritiske feil som må fikses](#2-kritiske-feil-som-må-fikses)
3. [Synkroniseringsstrategi](#3-synkroniseringsstrategi)
4. [Implementeringsplan](#4-implementeringsplan)
5. [Backend-oppdateringer](#5-backend-oppdateringer)
6. [Sjekkliste](#6-sjekkliste)

---

## 1. Bakgrunn og funn

### 1.1 Nåværende struktur

**Frontend har disse konstant-filene:**

| Fil | Innhold | Brukes? |
|-----|---------|---------|
| `types.ts` | TypeScript types | ✅ Ja |
| `constants.ts` | OPTIONS, INITIAL_DATA, kategorier | ✅ Ja |
| `utils/statusHelpers.ts` | Status-konstanter + label/skin-funksjoner | ✅ Ja |
| `utils/pdfLabels.ts` | Label-funksjoner for PDF | ✅ Ja |
| `statusConstants.ts` | Alternativ status-definisjon | ❌ **NEI - DØD KODE** |

**Backend har INGEN sentral konstant-fil** - alle verdier er hardkodet inline.

### 1.2 Identifiserte problemer

1. **`statusConstants.ts` er ubrukt og har feil verdier** - må slettes
2. **`TestOversiktPanel.tsx` har lokal mapping med FEIL verdier** - bug i produksjon
3. **`roleMap` er definert 3 steder** - duplisering
4. **Backend hardkoder alle status-verdier** - vanskelig å vedlikeholde
5. **Ingen synkronisering mellom frontend og backend** - risiko for drift

---

## 2. Kritiske feil som må fikses

### 2.1 BUG: TestOversiktPanel vederlagsmetode-mapping

**Fil:** `components/panels/TestOversiktPanel.tsx` linje 316-321

**Nåværende (FEIL):**
```typescript
const metodeMap: Record<string, string> = {
  '100000000': 'Enhetspris',
  '100000001': 'Regning',
  '100000002': 'Fast pris',
  '100000003': 'Kalkyle',
};
```

**Korrekt (fra constants.ts):**
```typescript
VEDERLAGSMETODER_OPTIONS = [
  { value: "100000000", label: "Entreprenørens tilbud (§34.2.1)" },
  { value: "100000001", label: "Kontraktens enhetspriser (§34.3.1)" },
  { value: "100000002", label: "Justerte enhetspriser (§34.3.2)" },
  { value: "100000003", label: "Regningsarbeid (§30.1)" },
];
```

**Konsekvens:** Brukere ser feil metodenavn i saksoversikten.

### 2.2 DØD KODE: statusConstants.ts

**Fil:** `statusConstants.ts` (140 linjer)

Filen har **0 imports** og inneholder verdier som AVVIKER fra `utils/statusHelpers.ts`:

| Konstant | statusConstants.ts | statusHelpers.ts (korrekt) |
|----------|-------------------|---------------------------|
| BH_SVAR_STATUS.GODKJENT | `'300000002'` | `'100000004'` |
| BH_SVAR_STATUS.DELVIS_GODKJENT | `'300000003'` | `'300000002'` |

**Handling:** Slett filen.

---

## 3. Synkroniseringsstrategi

### 3.1 Anbefalt løsning: Delt JSON + generering

**Opprett én sentral kilde:** `shared/status-codes.json`

```json
{
  "$schema": "./status-codes.schema.json",
  "version": "1.0.0",
  "lastUpdated": "2025-11-29",

  "sakStatus": {
    "UNDER_VARSLING": { "code": "100000000", "label": "Under varsling" },
    "VARSLET": { "code": "100000001", "label": "Varslet" },
    "VENTER_PAA_SVAR": { "code": "100000002", "label": "Venter på svar" },
    "UNDER_AVKLARING": { "code": "100000003", "label": "Under avklaring" },
    "VURDERES_AV_TE": { "code": "100000007", "label": "Vurderes av TE" },
    "OMFORENT": { "code": "100000005", "label": "Omforent (EO utstedes)" },
    "PAAGAAR": { "code": "100000013", "label": "Pågår - Under utførelse" },
    "UNDER_TVIST": { "code": "100000008", "label": "Under tvist" },
    "LUKKET_IMPLEMENTERT": { "code": "100000011", "label": "Lukket (Implementert)" },
    "LUKKET_AVSLÅTT": { "code": "100000006", "label": "Lukket (Avslått)" },
    "LUKKET_TILBAKEKALT": { "code": "100000009", "label": "Lukket (Tilbakekalt)" },
    "LUKKET_ANNULLERT": { "code": "100000012", "label": "Lukket (Annullert)" }
  },

  "koeStatus": {
    "UTKAST": { "code": "100000001", "label": "Utkast" },
    "SENDT_TIL_BH": { "code": "100000002", "label": "Sendt til BH" },
    "BESVART": { "code": "200000001", "label": "Besvart" },
    "TILBAKEKALT": { "code": "100000009", "label": "Tilbakekalt" }
  },

  "bhSvarStatus": {
    "UTKAST": { "code": "300000001", "label": "Utkast" },
    "GODKJENT": { "code": "100000004", "label": "Godkjent" },
    "DELVIS_GODKJENT": { "code": "300000002", "label": "Delvis Godkjent" },
    "AVSLÅTT_FOR_SENT": { "code": "100000010", "label": "Avslått (For sent)" },
    "AVSLÅTT_UENIG": { "code": "100000006", "label": "Avslått (Uenig)" },
    "KREVER_AVKLARING": { "code": "100000003", "label": "Krever avklaring" }
  },

  "bhVederlagSvar": {
    "GODKJENT_FULLT": { "code": "100000000", "label": "Godkjent fullt ut" },
    "DELVIS_GODKJENT": { "code": "100000001", "label": "Delvis godkjent" },
    "AVSLÅTT_UENIG": { "code": "100000002", "label": "Avslått (uenig i grunnlag)" },
    "AVSLÅTT_FOR_SENT": { "code": "100000003", "label": "Avslått (for sent varslet)" },
    "AVVENTER": { "code": "100000004", "label": "Avventer (ber om nærmere spesifikasjon)" },
    "GODKJENT_ANNEN_METODE": { "code": "100000005", "label": "Godkjent med annen metode" }
  },

  "bhFristSvar": {
    "GODKJENT_FULLT": { "code": "100000000", "label": "Godkjent fullt ut" },
    "DELVIS_GODKJENT": { "code": "100000001", "label": "Delvis godkjent (enig i grunnlag, bestrider beregning)" },
    "AVSLÅTT_UENIG": { "code": "100000002", "label": "Avslått (uenig i grunnlag)" },
    "AVSLÅTT_FOR_SENT": { "code": "100000003", "label": "Avslått (for sent varslet)" },
    "AVVENTER": { "code": "100000004", "label": "Avventer (ber om nærmere spesifikasjon)" }
  },

  "vederlagsmetoder": {
    "ENTREPRENORENS_TILBUD": { "code": "100000000", "label": "Entreprenørens tilbud (§34.2.1)" },
    "KONTRAKTENS_ENHETSPRISER": { "code": "100000001", "label": "Kontraktens enhetspriser (§34.3.1)" },
    "JUSTERTE_ENHETSPRISER": { "code": "100000002", "label": "Justerte enhetspriser (§34.3.2)" },
    "REGNINGSARBEID": { "code": "100000003", "label": "Regningsarbeid (§30.1)" }
  },

  "modus": {
    "VARSEL": { "code": "varsel", "role": "TE", "tabIndex": 0 },
    "KOE": { "code": "koe", "role": "TE", "tabIndex": 1 },
    "SVAR": { "code": "svar", "role": "BH", "tabIndex": 2 },
    "REVIDERING": { "code": "revidering", "role": "TE", "tabIndex": 1 }
  }
}
```

### 3.2 Genereringsskript

**Opprett:** `scripts/generate-constants.js`

```javascript
#!/usr/bin/env node
/**
 * Genererer TypeScript og Python konstanter fra shared/status-codes.json
 *
 * Bruk: node scripts/generate-constants.js
 */

const fs = require('fs');
const path = require('path');

const SOURCE = path.join(__dirname, '../shared/status-codes.json');
const TS_OUTPUT = path.join(__dirname, '../utils/generatedConstants.ts');
const PY_OUTPUT = path.join(__dirname, '../backend/generated_constants.py');

const data = JSON.parse(fs.readFileSync(SOURCE, 'utf-8'));

// ============ TYPESCRIPT ============
function generateTypeScript(data) {
  let ts = `/**
 * AUTO-GENERERT FIL - IKKE REDIGER MANUELT
 * Generert fra: shared/status-codes.json
 * Generert: ${new Date().toISOString()}
 */

`;

  // Generate constants
  for (const [category, values] of Object.entries(data)) {
    if (category.startsWith('$') || category === 'version' || category === 'lastUpdated') continue;

    const constName = category.replace(/([A-Z])/g, '_$1').toUpperCase();
    ts += `export const ${constName} = {\n`;

    for (const [key, val] of Object.entries(values)) {
      ts += `  ${key}: '${val.code}',\n`;
    }

    ts += `} as const;\n\n`;
  }

  // Generate label lookup functions
  ts += `// Label lookup functions\n`;
  for (const [category, values] of Object.entries(data)) {
    if (category.startsWith('$') || category === 'version' || category === 'lastUpdated') continue;

    const funcName = `get${category.charAt(0).toUpperCase() + category.slice(1)}Label`;
    ts += `export function ${funcName}(code: string): string {\n`;
    ts += `  const labels: Record<string, string> = {\n`;

    for (const [key, val] of Object.entries(values)) {
      ts += `    '${val.code}': '${val.label}',\n`;
    }

    ts += `  };\n`;
    ts += `  return labels[code] || 'Ukjent';\n`;
    ts += `}\n\n`;
  }

  return ts;
}

// ============ PYTHON ============
function generatePython(data) {
  let py = `"""
AUTO-GENERERT FIL - IKKE REDIGER MANUELT
Generert fra: shared/status-codes.json
Generert: ${new Date().toISOString()}
"""
from typing import Dict

`;

  // Generate constants
  for (const [category, values] of Object.entries(data)) {
    if (category.startsWith('$') || category === 'version' || category === 'lastUpdated') continue;

    const constName = category.replace(/([A-Z])/g, '_$1').toUpperCase();
    py += `${constName} = {\n`;

    for (const [key, val] of Object.entries(values)) {
      py += `    "${key}": "${val.code}",\n`;
    }

    py += `}\n\n`;
  }

  // Generate label lookup functions
  for (const [category, values] of Object.entries(data)) {
    if (category.startsWith('$') || category === 'version' || category === 'lastUpdated') continue;

    const funcName = `get_${category.replace(/([A-Z])/g, '_$1').toLowerCase()}_label`;
    py += `def ${funcName}(code: str) -> str:\n`;
    py += `    """Returnerer lesbar label for ${category}-kode"""\n`;
    py += `    labels: Dict[str, str] = {\n`;

    for (const [key, val] of Object.entries(values)) {
      py += `        "${val.code}": "${val.label}",\n`;
    }

    py += `    }\n`;
    py += `    return labels.get(code, "Ukjent")\n\n`;
  }

  return py;
}

// Generate files
fs.writeFileSync(TS_OUTPUT, generateTypeScript(data));
fs.writeFileSync(PY_OUTPUT, generatePython(data));

console.log('✅ Generated:', TS_OUTPUT);
console.log('✅ Generated:', PY_OUTPUT);
```

### 3.3 NPM script

**Legg til i `package.json`:**
```json
{
  "scripts": {
    "generate:constants": "node scripts/generate-constants.js",
    "prebuild": "npm run generate:constants"
  }
}
```

---

## 4. Implementeringsplan

### Trinn 1: Slett død kode (5 min)

**Slett fil:** `statusConstants.ts`

```bash
rm statusConstants.ts
git add -A && git commit -m "chore: Slett ubrukt statusConstants.ts"
```

### Trinn 2: Fiks TestOversiktPanel bug (15 min)

**Fil:** `components/panels/TestOversiktPanel.tsx`

**Legg til import:**
```typescript
import { getVederlagsmetodeLabel } from '../../utils/pdfLabels';
```

**Erstatt linje 316-327:**
```typescript
// FØR (feil):
const metodeMap: Record<string, string> = {
  '100000000': 'Enhetspris',
  '100000001': 'Regning',
  '100000002': 'Fast pris',
  '100000003': 'Kalkyle',
};
return (
  <td key={idx} className="text-center text-sm">
    {rev.vederlag?.krav_vederlag_metode ? metodeMap[rev.vederlag.krav_vederlag_metode] || '—' : '—'}
  </td>
);

// ETTER (korrekt):
return (
  <td key={idx} className="text-center text-sm">
    {rev.vederlag?.krav_vederlag_metode
      ? getVederlagsmetodeLabel(rev.vederlag.krav_vederlag_metode)
      : '—'}
  </td>
);
```

### Trinn 3: Fiks TestOversiktPanel BH-svar mappings (15 min)

**Samme fil, linje 472-500**

**Legg til import:**
```typescript
import { getBhVederlagssvarLabel, getBhFristsvarLabel } from '../../utils/pdfLabels';
```

**Erstatt linje 472-484:**
```typescript
// FØR (hardkodet):
if (vedStatus === '100000000') display = `✅ ${beløp ? beløp + ' NOK' : 'Godkjent'}`;
else if (vedStatus === '100000001') display = `⚠️ ${beløp ? beløp + ' NOK' : 'Delvis'}`;
else if (vedStatus === '100000002') display = '❌ Avslått';

// ETTER (bruker konstanter):
import { BH_VEDERLAG_SVAR } from '../../constants'; // Legg til øverst

if (vedStatus === BH_VEDERLAG_SVAR[0].value) { // Godkjent fullt
  display = `✅ ${beløp ? beløp + ' NOK' : 'Godkjent'}`;
} else if (vedStatus === BH_VEDERLAG_SVAR[1].value) { // Delvis
  display = `⚠️ ${beløp ? beløp + ' NOK' : 'Delvis'}`;
} else if (vedStatus === BH_VEDERLAG_SVAR[2].value || vedStatus === BH_VEDERLAG_SVAR[3].value) { // Avslått
  display = '❌ Avslått';
}
```

**Bedre løsning - opprett hjelpefunksjon i `utils/statusHelpers.ts`:**

```typescript
export const BH_VEDERLAG_KODER = {
  GODKJENT_FULLT: '100000000',
  DELVIS_GODKJENT: '100000001',
  AVSLÅTT_UENIG: '100000002',
  AVSLÅTT_FOR_SENT: '100000003',
  AVVENTER: '100000004',
  GODKJENT_ANNEN_METODE: '100000005',
} as const;

export const BH_FRIST_KODER = {
  GODKJENT_FULLT: '100000000',
  DELVIS_GODKJENT: '100000001',
  AVSLÅTT_UENIG: '100000002',
  AVSLÅTT_FOR_SENT: '100000003',
  AVVENTER: '100000004',
} as const;

export function isVederlagGodkjent(code?: string): boolean {
  return code === BH_VEDERLAG_KODER.GODKJENT_FULLT;
}

export function isVederlagDelvis(code?: string): boolean {
  return code === BH_VEDERLAG_KODER.DELVIS_GODKJENT;
}

export function isVederlagAvslått(code?: string): boolean {
  return code === BH_VEDERLAG_KODER.AVSLÅTT_UENIG ||
         code === BH_VEDERLAG_KODER.AVSLÅTT_FOR_SENT;
}
```

**Bruk i TestOversiktPanel:**
```typescript
import { isVederlagGodkjent, isVederlagDelvis, isVederlagAvslått } from '../../utils/statusHelpers';

if (isVederlagGodkjent(vedStatus)) {
  display = `✅ ${beløp ? beløp + ' NOK' : 'Godkjent'}`;
} else if (isVederlagDelvis(vedStatus)) {
  display = `⚠️ ${beløp ? beløp + ' NOK' : 'Delvis'}`;
} else if (isVederlagAvslått(vedStatus)) {
  display = '❌ Avslått';
}
```

### Trinn 4: Opprett modusHelpers.ts (30 min)

**Opprett fil:** `utils/modusHelpers.ts`

```typescript
/**
 * Modus-relaterte hjelpefunksjoner
 * Sentralisert for å unngå duplisering i App.tsx og useCaseLoader.ts
 */

import { Role } from '../types';

export type Modus = 'varsel' | 'koe' | 'svar' | 'revidering';

const MODUS_CONFIG: Record<Modus, { role: Role; tabIndex: number }> = {
  varsel: { role: 'TE', tabIndex: 0 },
  koe: { role: 'TE', tabIndex: 1 },
  svar: { role: 'BH', tabIndex: 2 },
  revidering: { role: 'TE', tabIndex: 1 },
};

/**
 * Henter rolle basert på modus
 */
export function getRoleFromModus(modus: Modus): Role {
  return MODUS_CONFIG[modus].role;
}

/**
 * Henter tab-index basert på modus
 */
export function getTabIndexFromModus(modus: Modus | null): number {
  if (!modus) return 0;
  return MODUS_CONFIG[modus].tabIndex;
}

/**
 * Sjekker om modus tilhører TE-rolle
 */
export function isTeMode(modus: Modus | null): boolean {
  if (!modus) return true;
  return MODUS_CONFIG[modus].role === 'TE';
}

/**
 * Sjekker om modus tilhører BH-rolle
 */
export function isBhMode(modus: Modus | null): boolean {
  if (!modus) return false;
  return MODUS_CONFIG[modus].role === 'BH';
}
```

**Oppdater App.tsx:**
```typescript
// Fjern linje 177-183 og 248-254 (roleMap-definisjonene)
// Erstatt med:
import { getRoleFromModus, getTabIndexFromModus } from './utils/modusHelpers';

// Linje ~183:
loadedFormData.rolle = getRoleFromModus(modus);

// Linje ~207:
setActiveTab(getTabIndexFromModus(modus));

// Linje ~254:
const newRole = getRoleFromModus(modus);
setActiveTab(getTabIndexFromModus(modus));
```

**Oppdater useCaseLoader.ts:**
```typescript
// Fjern getRoleFromModus og getTabFromModus funksjonene (linje 48-71)
// Erstatt med import:
import { getRoleFromModus, getTabIndexFromModus } from '../utils/modusHelpers';
```

### Trinn 5: Opprett shared status-codes (45 min)

**Opprett mappestruktur:**
```bash
mkdir -p shared scripts
```

**Opprett `shared/status-codes.json`** (se innhold i Seksjon 3.1)

**Opprett `scripts/generate-constants.js`** (se innhold i Seksjon 3.2)

**Oppdater package.json:**
```json
{
  "scripts": {
    "generate:constants": "node scripts/generate-constants.js"
  }
}
```

### Trinn 6: Erstatt hardkodede verdier i frontend (1 time)

**Søk og erstatt i alle .tsx/.ts-filer:**

| Søk etter | Erstatt med |
|-----------|------------|
| `'100000001'` (KOE utkast) | `KOE_STATUS.UTKAST` |
| `'100000002'` (KOE sendt) | `KOE_STATUS.SENDT_TIL_BH` |
| `'200000001'` (KOE besvart) | `KOE_STATUS.BESVART` |
| `'300000001'` (BH utkast) | `BH_SVAR_STATUS.UTKAST` |
| `'300000002'` (BH delvis) | `BH_SVAR_STATUS.DELVIS_GODKJENT` |

**Filer som må oppdateres:**
- `App.tsx` (linje 420)
- `components/panels/KravKoePanel.tsx` (linje 273)
- `components/panels/BhSvarPanel.tsx` (linje 163, 165, 166, 181, 211)
- `utils/pdfGeneratorReact.tsx` (linje 952)

---

## 5. Backend-oppdateringer

### 5.1 Opprett backend/constants.py

**Opprett fil:** `backend/constants.py`

```python
"""
Sentrale konstanter for KOE-systemet
Disse må holdes synkronisert med frontend (utils/statusHelpers.ts)

TODO: Generer denne filen fra shared/status-codes.json
"""

# ============ SAK STATUS ============
SAK_STATUS = {
    'UNDER_VARSLING': '100000000',
    'VARSLET': '100000001',
    'VENTER_PAA_SVAR': '100000002',
    'UNDER_AVKLARING': '100000003',
    'VURDERES_AV_TE': '100000007',
    'OMFORENT': '100000005',
    'PAAGAAR': '100000013',
    'UNDER_TVIST': '100000008',
    'LUKKET_IMPLEMENTERT': '100000011',
    'LUKKET_AVSLÅTT': '100000006',
    'LUKKET_TILBAKEKALT': '100000009',
    'LUKKET_ANNULLERT': '100000012',
}

# ============ KOE STATUS ============
KOE_STATUS = {
    'UTKAST': '100000001',
    'SENDT_TIL_BH': '100000002',
    'BESVART': '200000001',
    'TILBAKEKALT': '100000009',
}

# ============ BH SVAR STATUS ============
BH_SVAR_STATUS = {
    'UTKAST': '300000001',
    'GODKJENT': '100000004',
    'DELVIS_GODKJENT': '300000002',
    'AVSLÅTT_FOR_SENT': '100000010',
    'AVSLÅTT_UENIG': '100000006',
    'KREVER_AVKLARING': '100000003',
}

# ============ BH VEDERLAG SVAR ============
BH_VEDERLAG_SVAR = {
    'GODKJENT_FULLT': '100000000',
    'DELVIS_GODKJENT': '100000001',
    'AVSLÅTT_UENIG': '100000002',
    'AVSLÅTT_FOR_SENT': '100000003',
    'AVVENTER': '100000004',
    'GODKJENT_ANNEN_METODE': '100000005',
}

# ============ BH FRIST SVAR ============
BH_FRIST_SVAR = {
    'GODKJENT_FULLT': '100000000',
    'DELVIS_GODKJENT': '100000001',
    'AVSLÅTT_UENIG': '100000002',
    'AVSLÅTT_FOR_SENT': '100000003',
    'AVVENTER': '100000004',
}

# ============ VEDERLAGSMETODER ============
VEDERLAGSMETODER = {
    'ENTREPRENORENS_TILBUD': '100000000',
    'KONTRAKTENS_ENHETSPRISER': '100000001',
    'JUSTERTE_ENHETSPRISER': '100000002',
    'REGNINGSARBEID': '100000003',
}

# ============ LABEL MAPPINGS ============
def get_vederlag_svar_label(code: str) -> str:
    """Returnerer lesbar label for BH vederlag-svar kode"""
    labels = {
        '100000000': 'Godkjent fullt ut',
        '100000001': 'Delvis godkjent',
        '100000002': 'Avslått (uenig)',
        '100000003': 'Avslått (for sent)',
        '100000004': 'Avventer',
        '100000005': 'Godkjent med annen metode',
    }
    return labels.get(code, 'Uspesifisert')

def get_frist_svar_label(code: str) -> str:
    """Returnerer lesbar label for BH frist-svar kode"""
    labels = {
        '100000000': 'Godkjent fullt ut',
        '100000001': 'Delvis godkjent',
        '100000002': 'Avslått',
        '100000003': 'Avventer',
    }
    return labels.get(code, 'Uspesifisert')

def krever_revisjon(vederlag_svar: str = None, frist_svar: str = None) -> bool:
    """Sjekker om BH-respons krever revisjon fra TE"""
    revisjon_koder = [
        BH_VEDERLAG_SVAR['DELVIS_GODKJENT'],
        BH_VEDERLAG_SVAR['AVSLÅTT_UENIG'],
        BH_FRIST_SVAR['DELVIS_GODKJENT'],
        BH_FRIST_SVAR['AVSLÅTT_UENIG'],
    ]
    return vederlag_svar in revisjon_koder or frist_svar in revisjon_koder
```

### 5.2 Oppdater app.py

**Legg til import øverst:**
```python
from constants import (
    SAK_STATUS, KOE_STATUS, BH_SVAR_STATUS,
    BH_VEDERLAG_SVAR, BH_FRIST_SVAR,
    get_vederlag_svar_label, get_frist_svar_label,
    krever_revisjon
)
```

**Erstatt hardkodede verdier:**

**Linje 161:**
```python
# FØR:
sak_data.setdefault('status', '100000000')

# ETTER:
sak_data.setdefault('status', SAK_STATUS['UNDER_VARSLING'])
```

**Linje 184:**
```python
# FØR:
"status": "100000001",  # Utkast

# ETTER:
"status": KOE_STATUS['UTKAST'],
```

**Linje 780:**
```python
# FØR:
'status': '100000001',  # Utkast

# ETTER:
'status': KOE_STATUS['UTKAST'],
```

**Linje 866:**
```python
# FØR:
'status': '300000001',  # Utkast

# ETTER:
'status': BH_SVAR_STATUS['UTKAST'],
```

**Linje 947-953:**
```python
# FØR:
if (
    bh_svar_vederlag in ['100000001', '100000002', '100000003', '100000004'] or
    bh_svar_frist in ['100000001', '100000002', '100000003', '100000004']
):

# ETTER:
trenger_revisjon = krever_revisjon(bh_svar_vederlag, bh_svar_frist)
if trenger_revisjon:
```

**Linje 1024-1038 (fjern og bruk funksjoner):**
```python
# FØR:
vederlag_status_map = {
    '100000000': 'Godkjent fullt ut',
    ...
}
svar_tekst = vederlag_status_map.get(bh_svar_vederlag, 'Uspesifisert')

# ETTER:
svar_tekst = get_vederlag_svar_label(bh_svar_vederlag)
```

---

## 6. Sjekkliste

### Fase 1: Kritiske fiks (30 min)
- [ ] Slett `statusConstants.ts`
- [ ] Fiks TestOversiktPanel vederlagsmetode-bug
- [ ] Fiks TestOversiktPanel BH-svar mappings
- [ ] Commit: `fix: Fjern død kode og fiks status-mappings i TestOversiktPanel`

### Fase 2: Frontend-konsolidering (1.5 timer)
- [ ] Opprett `utils/modusHelpers.ts`
- [ ] Oppdater App.tsx til å bruke modusHelpers
- [ ] Oppdater useCaseLoader.ts til å bruke modusHelpers
- [ ] Legg til BH_VEDERLAG_KODER og BH_FRIST_KODER i statusHelpers.ts
- [ ] Erstatt alle hardkodede statuskoder med konstanter
- [ ] Commit: `refactor: Konsolider modus og status-konstanter`

### Fase 3: Backend-konsolidering (1 time)
- [ ] Opprett `backend/constants.py`
- [ ] Oppdater app.py til å bruke constants
- [ ] Test at backend fungerer
- [ ] Commit: `refactor: Sentraliser konstanter i backend`

### Fase 4: Synkronisering (1 time) - VALGFRITT
- [ ] Opprett `shared/status-codes.json`
- [ ] Opprett `scripts/generate-constants.js`
- [ ] Legg til npm script
- [ ] Generer og verifiser output
- [ ] Commit: `feat: Legg til sentral status-kode definisjon med generering`

### Testing
- [ ] Kjør frontend: `npm run dev`
- [ ] Verifiser TestOversiktPanel viser riktige metode-labels
- [ ] Verifiser BH-svar viser riktige status-ikoner
- [ ] Kjør backend: `python backend/app.py`
- [ ] Test ett komplett flyt (varsel → koe → svar)

---

## Tidsestimat

| Fase | Beskrivelse | Tid |
|------|-------------|-----|
| 1 | Kritiske fiks | 30 min |
| 2 | Frontend-konsolidering | 1.5 timer |
| 3 | Backend-konsolidering | 1 time |
| 4 | Synkronisering (valgfritt) | 1 time |
| Test | Manuell testing | 30 min |
| **Total** | | **4.5-5.5 timer** |

---

**Vedlikeholdt av:** Claude (Opus 4)
**Sist oppdatert:** 2025-11-30 (v1.0)
**Status:** Klar for implementering

**Prioritert rekkefølge:**
1. **Fase 1** - Fiks bugs (kritisk)
2. **Fase 2** - Frontend-konsolidering (høy verdi)
3. **Fase 3** - Backend-konsolidering (middels verdi)
4. **Fase 4** - Synkronisering (lavere prioritet, men viktig langsiktig)
