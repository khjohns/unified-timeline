#!/usr/bin/env python3
"""
Security Pattern Scanner

Finner potensielle sikkerhetsrisikoer i kodebasen:
- Math.random() brukt for ID-generering
- Sensitiv data i localStorage/sessionStorage
- Hardkodede secrets/tokens
- Usikre patterns (eval, innerHTML, etc.)

Bruk:
    python scripts/security_scan.py              # Standard output
    python scripts/security_scan.py --format json    # JSON output
    python scripts/security_scan.py --format markdown # Markdown output
    python scripts/security_scan.py --ci             # CI mode (exit 1 on critical)
"""

import re
import json
import argparse
import sys
from pathlib import Path
from dataclasses import dataclass, field
from typing import Optional
from enum import Enum
from collections import defaultdict


class Severity(str, Enum):
    """Alvorlighetsgrad for sikkerhetsfunn"""
    CRITICAL = "critical"  # Umiddelbar risiko
    HIGH = "high"          # Bør fikses snart
    MEDIUM = "medium"      # Bør vurderes
    LOW = "low"            # Informasjon


class Category(str, Enum):
    """Kategori av sikkerhetsfunn"""
    RANDOM_ID = "random_id"           # Math.random for IDs
    STORAGE = "storage"               # localStorage/sessionStorage
    SECRETS = "secrets"               # Hardkodede secrets
    INJECTION = "injection"           # Potensielle injections
    UNSAFE_PATTERN = "unsafe_pattern" # Usikre patterns


@dataclass
class SecurityFinding:
    """Et sikkerhetsfunn"""
    file: str
    line: int
    category: Category
    severity: Severity
    pattern: str        # Hva som ble funnet
    description: str    # Forklaring
    context: str        # Kode-kontekst


# Patterns å søke etter
SECURITY_PATTERNS = [
    # Math.random for ID-generering
    {
        'pattern': r'Math\.random\(\)',
        'category': Category.RANDOM_ID,
        'severity': Severity.MEDIUM,
        'description': 'Math.random() er ikke kryptografisk sikker. Bruk crypto.randomUUID() for IDs.',
        'context_keywords': ['token', 'auth', 'session', 'secret', 'credential'],  # Kun sikkerhetskritiske IDs
        'exclude_paths': ['mock', 'Mock', 'primitives/'],  # Mock-data og UI-primitives er OK
    },

    # localStorage med sensitiv data
    {
        'pattern': r'localStorage\.(set|get)Item\s*\(\s*[\'"][^\'"]*(?:token|auth|session|role|user|email|password|secret|key)[^\'"]*[\'"]',
        'category': Category.STORAGE,
        'severity': Severity.HIGH,
        'description': 'Sensitiv data i localStorage er sårbar for XSS. Vurder httpOnly cookies.',
        'flags': re.IGNORECASE,
    },

    # sessionStorage med sensitiv data
    {
        'pattern': r'sessionStorage\.(set|get)Item\s*\(\s*[\'"][^\'"]*(?:token|auth|password|secret|key)[^\'"]*[\'"]',
        'category': Category.STORAGE,
        'severity': Severity.MEDIUM,
        'description': 'Sensitiv data i sessionStorage. Vurder om dette er nødvendig.',
        'flags': re.IGNORECASE,
    },

    # Hardkodede secrets/tokens
    {
        'pattern': r'(?:api[_-]?key|secret|token|password|credential|auth)\s*[:=]\s*[\'"][a-zA-Z0-9_\-]{20,}[\'"]',
        'category': Category.SECRETS,
        'severity': Severity.CRITICAL,
        'description': 'Mulig hardkodet secret. Bruk miljøvariabler.',
        'flags': re.IGNORECASE,
        'exclude_patterns': ['test', 'mock', 'example', 'placeholder', 'xxx'],
    },

    # Bearer tokens i kode
    {
        'pattern': r'Bearer\s+[a-zA-Z0-9_\-\.]{20,}',
        'category': Category.SECRETS,
        'severity': Severity.CRITICAL,
        'description': 'Hardkodet Bearer token funnet.',
    },

    # eval() bruk
    {
        'pattern': r'\beval\s*\(',
        'category': Category.INJECTION,
        'severity': Severity.CRITICAL,
        'description': 'eval() er farlig og kan føre til code injection.',
    },

    # innerHTML med variabler
    {
        'pattern': r'\.innerHTML\s*=\s*[^\'"][^\n;]+',
        'category': Category.INJECTION,
        'severity': Severity.HIGH,
        'description': 'innerHTML med dynamisk innhold kan føre til XSS.',
    },

    # dangerouslySetInnerHTML
    {
        'pattern': r'dangerouslySetInnerHTML',
        'category': Category.UNSAFE_PATTERN,
        'severity': Severity.MEDIUM,
        'description': 'dangerouslySetInnerHTML kan føre til XSS hvis ikke sanitert.',
    },

    # SQL-lignende streng-konkatenering
    {
        'pattern': r'(?:SELECT|INSERT|UPDATE|DELETE|FROM|WHERE)\s+.*\+\s*(?:\w+|[\'"])',
        'category': Category.INJECTION,
        'severity': Severity.HIGH,
        'description': 'Mulig SQL injection via streng-konkatenering. Bruk parameteriserte queries.',
        'flags': re.IGNORECASE,
        'skip_comments': True,  # Ignorer kommentarer og docstrings
    },

    # exec() i Python
    {
        'pattern': r'\bexec\s*\(',
        'category': Category.INJECTION,
        'severity': Severity.HIGH,
        'description': 'exec() kan føre til code injection.',
        'file_ext': '.py',
    },

    # subprocess med shell=True
    {
        'pattern': r'subprocess\.[^(]+\([^)]*shell\s*=\s*True',
        'category': Category.INJECTION,
        'severity': Severity.HIGH,
        'description': 'subprocess med shell=True kan føre til command injection.',
        'file_ext': '.py',
    },

    # Pickle load (deserialization)
    {
        'pattern': r'pickle\.loads?\s*\(',
        'category': Category.INJECTION,
        'severity': Severity.HIGH,
        'description': 'pickle.load kan føre til arbitrary code execution.',
        'file_ext': '.py',
    },

    # .env filer committet
    {
        'pattern': r'^(?:DATABASE_URL|API_KEY|SECRET_KEY|PASSWORD|PRIVATE_KEY)\s*=',
        'category': Category.SECRETS,
        'severity': Severity.CRITICAL,
        'description': 'Secrets i fil som kan være committet.',
        'file_ext': '.env',
    },

    # Hardkodede IP-adresser (ikke localhost)
    {
        'pattern': r'\b(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})\b',
        'category': Category.UNSAFE_PATTERN,
        'severity': Severity.LOW,
        'description': 'Hardkodet intern IP-adresse. Vurder om dette skal være konfigurerbart.',
    },

    # CORS med wildcard
    {
        'pattern': r'(?:Access-Control-Allow-Origin|cors.*origin)\s*[:=]\s*[\'"]?\*[\'"]?',
        'category': Category.UNSAFE_PATTERN,
        'severity': Severity.MEDIUM,
        'description': 'CORS med wildcard (*) tillater alle origins.',
        'flags': re.IGNORECASE,
    },

    # Disabled security features
    {
        'pattern': r'(?:verify|validate|check|secure|ssl|tls|https?)\s*[:=]\s*(?:false|False|0)',
        'category': Category.UNSAFE_PATTERN,
        'severity': Severity.HIGH,
        'description': 'Sikkerhetsfunksjon ser ut til å være deaktivert.',
        'flags': re.IGNORECASE,
    },

    # Console.log med sensitiv info
    {
        'pattern': r'console\.log\s*\([^)]*(?:token|password|secret|credential|auth)[^)]*\)',
        'category': Category.SECRETS,
        'severity': Severity.MEDIUM,
        'description': 'console.log kan lekke sensitiv informasjon i produksjon.',
        'flags': re.IGNORECASE,
    },
]


def find_project_root() -> Path:
    """Finn prosjektroten ved å lete etter package.json"""
    current = Path(__file__).resolve().parent
    while current != current.parent:
        if (current / "package.json").exists():
            return current
        current = current.parent
    raise RuntimeError("Kunne ikke finne prosjektroten (package.json)")


def should_skip_file(file_path: Path) -> bool:
    """Sjekk om filen skal hoppes over"""
    skip_patterns = [
        'node_modules', '.git', 'dist', 'build', '__pycache__',
        '.venv', 'venv', 'coverage', '.next',
        'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
        # Skip test files for some patterns
    ]
    path_str = str(file_path)
    return any(pattern in path_str for pattern in skip_patterns)


def is_test_file(file_path: Path) -> bool:
    """Sjekk om filen er en testfil"""
    path_str = str(file_path).lower()
    return any(pattern in path_str for pattern in [
        'test', 'spec', 'mock', '__mocks__', 'fixtures', 'e2e'
    ])


def is_comment_or_string(line: str, file_path: Path) -> bool:
    """Sjekk om linjen er en kommentar eller del av en docstring/string literal"""
    stripped = line.strip()

    # Python-kommentarer
    if str(file_path).endswith('.py'):
        if stripped.startswith('#'):
            return True
        # Docstrings (enkel heuristikk - linjer som starter/slutter med """)
        if stripped.startswith('"""') or stripped.startswith("'''"):
            return True
        # Linjer inne i docstrings (starter med bokstav/tall, ingen kode-tegn)
        if stripped and not any(c in stripped for c in ['=', '(', ')', '[', ']', '{', '}', ':']) and not stripped.startswith('def ') and not stripped.startswith('class '):
            # Sannsynligvis docstring-innhold hvis det ser ut som prosa
            words = stripped.split()
            if len(words) > 3 and all(w[0].isalpha() or w[0] in '"\'#-' for w in words[:3] if w):
                return True

    # JS/TS-kommentarer
    if str(file_path).endswith(('.ts', '.tsx', '.js', '.jsx')):
        if stripped.startswith('//'):
            return True
        if stripped.startswith('/*') or stripped.startswith('*'):
            return True

    return False


def scan_file(file_path: Path) -> list[SecurityFinding]:
    """Skann en fil for sikkerhetsproblemer"""
    findings = []

    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
            lines = content.split('\n')
    except Exception:
        return findings

    for pattern_def in SECURITY_PATTERNS:
        # Sjekk fil-extension filter
        file_ext = pattern_def.get('file_ext')
        if file_ext and not str(file_path).endswith(file_ext):
            continue

        # Sjekk exclude_paths filter
        exclude_paths = pattern_def.get('exclude_paths', [])
        if exclude_paths:
            path_str = str(file_path)
            if any(ep in path_str for ep in exclude_paths):
                continue

        flags = pattern_def.get('flags', 0)
        pattern = re.compile(pattern_def['pattern'], flags)

        for line_num, line in enumerate(lines, 1):
            # Hopp over kommentarer/docstrings hvis pattern krever det
            if pattern_def.get('skip_comments') and is_comment_or_string(line, file_path):
                continue

            matches = pattern.finditer(line)
            for match in matches:
                # Sjekk context keywords hvis definert
                context_keywords = pattern_def.get('context_keywords', [])
                if context_keywords:
                    # For Math.random, sjekk om det ser ut som ID-generering
                    has_context = any(kw in line for kw in context_keywords)
                    if not has_context:
                        continue

                # Sjekk exclude patterns
                exclude_patterns = pattern_def.get('exclude_patterns', [])
                if exclude_patterns:
                    if any(ex in line.lower() for ex in exclude_patterns):
                        continue

                # Reduser severity for testfiler
                severity = pattern_def['severity']
                if is_test_file(file_path) and severity in (Severity.CRITICAL, Severity.HIGH):
                    severity = Severity.LOW

                findings.append(SecurityFinding(
                    file=str(file_path),
                    line=line_num,
                    category=pattern_def['category'],
                    severity=severity,
                    pattern=match.group(0)[:80],
                    description=pattern_def['description'],
                    context=line.strip()[:100]
                ))

    return findings


def scan_codebase(root: Path) -> list[SecurityFinding]:
    """Skann hele kodebasen for sikkerhetsproblemer"""
    all_findings = []

    extensions = {'.ts', '.tsx', '.js', '.jsx', '.py', '.env', '.yaml', '.yml'}
    scan_dirs = [root / 'src', root / 'backend', root / 'e2e']

    for scan_dir in scan_dirs:
        if not scan_dir.exists():
            continue

        for file_path in scan_dir.rglob('*'):
            if file_path.suffix not in extensions:
                continue
            if should_skip_file(file_path):
                continue

            findings = scan_file(file_path)
            all_findings.extend(findings)

    # Sorter etter severity
    severity_order = {Severity.CRITICAL: 0, Severity.HIGH: 1, Severity.MEDIUM: 2, Severity.LOW: 3}
    all_findings.sort(key=lambda f: (severity_order[f.severity], f.file, f.line))

    return all_findings


def format_text(findings: list[SecurityFinding], root: Path) -> str:
    """Formater funn som tekst"""
    lines = []
    lines.append("=" * 60)
    lines.append("  SECURITY SCAN REPORT")
    lines.append("=" * 60)
    lines.append("")

    if not findings:
        lines.append("✅ Ingen sikkerhetsproblemer funnet.")
        return "\n".join(lines)

    by_severity = defaultdict(list)
    for finding in findings:
        by_severity[finding.severity].append(finding)

    severity_icons = {
        Severity.CRITICAL: "🔴",
        Severity.HIGH: "🟠",
        Severity.MEDIUM: "🟡",
        Severity.LOW: "🔵",
    }

    for severity in [Severity.CRITICAL, Severity.HIGH, Severity.MEDIUM, Severity.LOW]:
        items = by_severity.get(severity, [])
        if not items:
            continue

        icon = severity_icons[severity]
        lines.append(f"{icon} {severity.value.upper()} ({len(items)})")
        lines.append("-" * 40)

        for finding in items[:15]:
            rel_path = Path(finding.file).relative_to(root)
            lines.append(f"  [{finding.category.value}] {rel_path}:{finding.line}")
            lines.append(f"    {finding.description}")
            lines.append(f"    Found: {finding.pattern[:60]}{'...' if len(finding.pattern) > 60 else ''}")
            lines.append("")

        if len(items) > 15:
            lines.append(f"  ... og {len(items) - 15} til")
            lines.append("")

    lines.append("=" * 60)
    critical = len(by_severity.get(Severity.CRITICAL, []))
    high = len(by_severity.get(Severity.HIGH, []))
    lines.append(f"  SUMMARY: {critical} critical, {high} high, {len(findings)} total")
    lines.append("=" * 60)

    return "\n".join(lines)


def format_json(findings: list[SecurityFinding], root: Path) -> str:
    """Formater funn som JSON"""
    by_severity = defaultdict(list)
    for finding in findings:
        by_severity[finding.severity.value].append(finding)

    by_category = defaultdict(int)
    for finding in findings:
        by_category[finding.category.value] += 1

    data = {
        "summary": {
            "total": len(findings),
            "critical": len(by_severity.get("critical", [])),
            "high": len(by_severity.get("high", [])),
            "medium": len(by_severity.get("medium", [])),
            "low": len(by_severity.get("low", [])),
            "by_category": dict(by_category),
        },
        "findings": [
            {
                "file": str(Path(f.file).relative_to(root)),
                "line": f.line,
                "category": f.category.value,
                "severity": f.severity.value,
                "pattern": f.pattern,
                "description": f.description,
            }
            for f in findings
        ]
    }
    return json.dumps(data, indent=2, ensure_ascii=False)


def format_markdown(findings: list[SecurityFinding], root: Path) -> str:
    """Formater funn som Markdown"""
    lines = []
    lines.append("# Security Scan Report")
    lines.append("")

    if not findings:
        lines.append("✅ Ingen sikkerhetsproblemer funnet.")
        return "\n".join(lines)

    by_severity = defaultdict(list)
    for finding in findings:
        by_severity[finding.severity].append(finding)

    critical = len(by_severity.get(Severity.CRITICAL, []))
    high = len(by_severity.get(Severity.HIGH, []))

    lines.append(f"**Summary:** {critical} critical, {high} high, {len(findings)} total")
    lines.append("")

    # Kategorioversikt
    by_category = defaultdict(int)
    for finding in findings:
        by_category[finding.category.value] += 1

    lines.append("### By Category")
    lines.append("")
    for cat, count in sorted(by_category.items(), key=lambda x: -x[1]):
        lines.append(f"- **{cat}**: {count}")
    lines.append("")

    severity_headers = {
        Severity.CRITICAL: "## 🔴 Critical",
        Severity.HIGH: "## 🟠 High",
        Severity.MEDIUM: "## 🟡 Medium",
        Severity.LOW: "## 🔵 Low",
    }

    for severity in [Severity.CRITICAL, Severity.HIGH, Severity.MEDIUM]:
        items = by_severity.get(severity, [])
        if not items:
            continue

        lines.append(severity_headers[severity])
        lines.append("")

        for finding in items[:20]:
            rel_path = Path(finding.file).relative_to(root)
            lines.append(f"### `{rel_path}:{finding.line}`")
            lines.append(f"- **Category:** {finding.category.value}")
            lines.append(f"- **Description:** {finding.description}")
            lines.append(f"- **Pattern:** `{finding.pattern[:60]}`")
            lines.append("")

        if len(items) > 20:
            lines.append(f"*... og {len(items) - 20} til*")
            lines.append("")

    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="Scan for security issues")
    parser.add_argument('--format', choices=['text', 'json', 'markdown'], default='text')
    parser.add_argument('--ci', action='store_true', help='CI mode: exit 1 on critical findings')
    parser.add_argument('--include-low', action='store_true', help='Include low severity findings')
    args = parser.parse_args()

    root = find_project_root()

    # Skann kodebasen
    findings = scan_codebase(root)

    # Filtrer ut low severity med mindre --include-low
    if not args.include_low:
        findings = [f for f in findings if f.severity != Severity.LOW]

    # Output
    if args.format == 'json':
        print(format_json(findings, root))
    elif args.format == 'markdown':
        print(format_markdown(findings, root))
    else:
        print(format_text(findings, root))

    # CI mode
    if args.ci:
        critical_count = sum(1 for f in findings if f.severity == Severity.CRITICAL)
        if critical_count > 0:
            sys.exit(1)

    sys.exit(0)


if __name__ == '__main__':
    main()
