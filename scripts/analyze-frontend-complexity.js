#!/usr/bin/env node
/**
 * Frontend Complexity Analyzer
 *
 * Measures cyclomatic complexity for TypeScript/TSX files.
 * Counts decision points: if, else if, for, while, switch, case, catch, ternary, &&, ||
 *
 * Usage:
 *   node scripts/analyze-frontend-complexity.js [--json] [--min N] [--top N]
 *
 * Options:
 *   --json    Output as JSON
 *   --min N   Only show files with complexity >= N (default: 0)
 *   --top N   Show top N files (default: 25)
 */

const fs = require('fs');
const path = require('path');

function countComplexity(content) {
  const patterns = [
    /\bif\s*\(/g,
    /\belse\s+if\s*\(/g,
    /\bfor\s*\(/g,
    /\bwhile\s*\(/g,
    /\bswitch\s*\(/g,
    /\bcase\s+/g,
    /\bcatch\s*\(/g,
    /\?\s*[^:]+\s*:/g,
    /&&/g,
    /\|\|/g,
  ];

  let complexity = 1;
  for (const pattern of patterns) {
    const matches = content.match(pattern);
    if (matches) complexity += matches.length;
  }
  return complexity;
}

function analyzeFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const complexity = countComplexity(content);
  const lines = content.split('\n').length;
  return { complexity, lines };
}

function walkDir(dir, files = []) {
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    if (item === 'node_modules' || item === '.git' || item === 'dist' || item === 'build') continue;
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      walkDir(fullPath, files);
    } else if (/\.(ts|tsx)$/.test(item) && !item.includes('.test.') && !item.includes('.spec.')) {
      files.push(fullPath);
    }
  }
  return files;
}

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    json: args.includes('--json'),
    min: parseInt(args[args.indexOf('--min') + 1]) || 0,
    top: parseInt(args[args.indexOf('--top') + 1]) || 25,
  };
}

function main() {
  const options = parseArgs();
  const srcDir = path.join(process.cwd(), 'src');

  if (!fs.existsSync(srcDir)) {
    console.error('Error: src/ directory not found');
    process.exit(1);
  }

  const files = walkDir(srcDir);
  const results = files.map(f => {
    const { complexity, lines } = analyzeFile(f);
    return {
      file: f.replace(process.cwd() + '/', ''),
      complexity,
      lines,
      density: (complexity / lines * 100).toFixed(2)
    };
  })
  .filter(r => r.complexity >= options.min)
  .sort((a, b) => b.complexity - a.complexity);

  const totalComplexity = results.reduce((s, r) => s + r.complexity, 0);
  const totalLines = results.reduce((s, r) => s + r.lines, 0);
  const avgComplexity = (totalComplexity / results.length).toFixed(1);

  if (options.json) {
    console.log(JSON.stringify({
      summary: {
        filesAnalyzed: results.length,
        totalComplexity,
        totalLines,
        averageComplexity: parseFloat(avgComplexity)
      },
      topFiles: results.slice(0, options.top)
    }, null, 2));
  } else {
    console.log(`=== Topp ${options.top} mest komplekse filer ===\n`);
    console.log('Kompleksitet | Linjer | Fil');
    console.log('-------------|--------|----');
    results.slice(0, options.top).forEach(r => {
      console.log(`${String(r.complexity).padStart(12)} | ${String(r.lines).padStart(6)} | ${r.file}`);
    });

    console.log('\n=== Oppsummering ===');
    console.log(`Filer analysert: ${results.length}`);
    console.log(`Total kompleksitet: ${totalComplexity}`);
    console.log(`Totale linjer: ${totalLines}`);
    console.log(`Gjennomsnitt kompleksitet per fil: ${avgComplexity}`);
  }
}

main();
