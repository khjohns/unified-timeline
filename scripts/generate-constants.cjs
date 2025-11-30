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

// Validate source file exists
if (!fs.existsSync(SOURCE)) {
  console.error('❌ Error: shared/status-codes.json not found');
  console.error('   Expected location:', SOURCE);
  process.exit(1);
}

// Parse and validate JSON
let data;
try {
  data = JSON.parse(fs.readFileSync(SOURCE, 'utf-8'));
} catch (err) {
  console.error('❌ Error parsing JSON:', err.message);
  process.exit(1);
}

// Validate required structure
if (!data || typeof data !== 'object') {
  console.error('❌ Error: Invalid JSON structure');
  process.exit(1);
}

// ============ TYPESCRIPT ============
function generateTypeScript(data) {
  let ts = `/**
 * AUTO-GENERERT FIL - IKKE REDIGER MANUELT
 * Generert fra: shared/status-codes.json
 * Generert: ${new Date().toISOString()}
 *
 * Versjon: ${data.version || 'N/A'}
 */

`;

  // Generate constants
  for (const [category, values] of Object.entries(data)) {
    if (category.startsWith('$') || category === 'version' || category === 'lastUpdated') continue;

    const constName = category.replace(/([A-Z])/g, '_$1').toUpperCase().replace(/^_/, '');
    ts += `export const ${constName} = {\n`;

    for (const [key, val] of Object.entries(values)) {
      ts += `  ${key}: '${val.code}',\n`;
    }

    ts += `} as const;\n\n`;
  }

  // Generate label lookup functions
  ts += `// ============ LABEL LOOKUP FUNCTIONS ============\n`;
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

Versjon: ${data.version || 'N/A'}
"""
from typing import Dict

`;

  // Generate constants
  for (const [category, values] of Object.entries(data)) {
    if (category.startsWith('$') || category === 'version' || category === 'lastUpdated') continue;

    const constName = category.replace(/([A-Z])/g, '_$1').toUpperCase().replace(/^_/, '');
    py += `${constName} = {\n`;

    for (const [key, val] of Object.entries(values)) {
      py += `    "${key}": "${val.code}",\n`;
    }

    py += `}\n\n`;
  }

  // Generate label lookup functions
  py += `# ============ LABEL LOOKUP FUNCTIONS ============\n`;
  for (const [category, values] of Object.entries(data)) {
    if (category.startsWith('$') || category === 'version' || category === 'lastUpdated') continue;

    const funcName = `get_${category.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '')}_label`;
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
try {
  const tsContent = generateTypeScript(data);
  const pyContent = generatePython(data);

  fs.writeFileSync(TS_OUTPUT, tsContent);
  fs.writeFileSync(PY_OUTPUT, pyContent);

  console.log('✅ Generated:', TS_OUTPUT);
  console.log('✅ Generated:', PY_OUTPUT);
  console.log(`📦 Version: ${data.version}`);
  console.log(`📅 Last updated: ${data.lastUpdated}`);
} catch (err) {
  console.error('❌ Error writing files:', err.message);
  process.exit(1);
}
