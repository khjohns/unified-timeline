#!/usr/bin/env python3
"""
TODO Tracker

Finner og kategoriserer alle TODO/FIXME/HACK/XXX kommentarer i kodebasen.
Hjelper med å spore teknisk gjeld og kritiske oppgaver.

Bruk:
    python scripts/todo_tracker.py              # Standard output
    python scripts/todo_tracker.py --format json    # JSON output
    python scripts/todo_tracker.py --format markdown # Markdown output
    python scripts/todo_tracker.py --ci             # CI mode (exit 1 on critical)
    python scripts/todo_tracker.py --severity critical  # Kun kritiske
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
    """Alvorlighetsgrad basert på nøkkelord og kontekst"""
    CRITICAL = "critical"  # FIXME, HACK, SECURITY, BUG
    HIGH = "high"          # XXX, IMPORTANT, URGENT
    MEDIUM = "medium"      # TODO med viktige nøkkelord
    LOW = "low"            # Vanlige TODO


@dataclass
class TodoItem:
    """En enkelt TODO-kommentar"""
    file: str
    line: int
    tag: str           # TODO, FIXME, HACK, XXX
    content: str       # Selve kommentaren
    severity: Severity
    context: str       # Kode-kontekst rundt


# Nøkkelord som øker severity
CRITICAL_KEYWORDS = [
    'security', 'vulnerability', 'injection', 'xss', 'csrf',
    'secret', 'password', 'credential', 'auth', 'token',
    'production', 'prod', 'deploy', 'azure', 'service bus',
    'bug', 'broken', 'fails', 'crash', 'error',
]

HIGH_KEYWORDS = [
    'important', 'urgent', 'critical', 'asap', 'must',
    'required', 'necessary', 'blocking', 'blocker',
    'missing', 'incomplete', 'not implemented',
]

MEDIUM_KEYWORDS = [
    'refactor', 'cleanup', 'optimize', 'improve',
    'should', 'consider', 'later', 'eventually',
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
    ]
    path_str = str(file_path)
    return any(pattern in path_str for pattern in skip_patterns)


def determine_severity(tag: str, content: str) -> Severity:
    """Bestem severity basert på tag og innhold"""
    content_lower = content.lower()

    # FIXME og HACK er alltid kritiske
    if tag in ('FIXME', 'HACK'):
        return Severity.CRITICAL

    # Sjekk for kritiske nøkkelord
    for keyword in CRITICAL_KEYWORDS:
        if keyword in content_lower:
            return Severity.CRITICAL

    # XXX er høy
    if tag == 'XXX':
        return Severity.HIGH

    # Sjekk for høy-prioritet nøkkelord
    for keyword in HIGH_KEYWORDS:
        if keyword in content_lower:
            return Severity.HIGH

    # Sjekk for medium nøkkelord
    for keyword in MEDIUM_KEYWORDS:
        if keyword in content_lower:
            return Severity.MEDIUM

    # Standard TODO er lav
    return Severity.LOW


def scan_file(file_path: Path) -> list[TodoItem]:
    """Skann en fil for TODO-kommentarer"""
    todos = []

    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            lines = f.readlines()
    except Exception:
        return todos

    # Pattern for å finne TODO/FIXME/HACK/XXX
    pattern = re.compile(
        r'(?:#|//|/\*|\*|--|\'\'\'|"""|<!--)\s*'
        r'(TODO|FIXME|HACK|XXX|BUG|NOTE|WARNING)'
        r'\s*:?\s*(.+?)(?:\*/|-->)?$',
        re.IGNORECASE
    )

    for line_num, line in enumerate(lines, 1):
        match = pattern.search(line)
        if match:
            tag = match.group(1).upper()
            content = match.group(2).strip()

            # Få kontekst (linjen selv)
            context = line.strip()[:100]

            severity = determine_severity(tag, content)

            todos.append(TodoItem(
                file=str(file_path),
                line=line_num,
                tag=tag,
                content=content,
                severity=severity,
                context=context
            ))

    return todos


def scan_codebase(root: Path) -> list[TodoItem]:
    """Skann hele kodebasen for TODOs"""
    all_todos = []

    extensions = {'.ts', '.tsx', '.js', '.jsx', '.py', '.md', '.yaml', '.yml', '.json'}
    scan_dirs = [root / 'src', root / 'backend', root / 'e2e', root / 'docs']

    for scan_dir in scan_dirs:
        if not scan_dir.exists():
            continue

        for file_path in scan_dir.rglob('*'):
            if file_path.suffix not in extensions:
                continue
            if should_skip_file(file_path):
                continue

            todos = scan_file(file_path)
            all_todos.extend(todos)

    # Sorter etter severity, deretter fil
    severity_order = {Severity.CRITICAL: 0, Severity.HIGH: 1, Severity.MEDIUM: 2, Severity.LOW: 3}
    all_todos.sort(key=lambda t: (severity_order[t.severity], t.file, t.line))

    return all_todos


def format_text(todos: list[TodoItem], root: Path) -> str:
    """Formater TODOs som tekst"""
    lines = []
    lines.append("=" * 60)
    lines.append("  TODO TRACKER REPORT")
    lines.append("=" * 60)
    lines.append("")

    if not todos:
        lines.append("✅ Ingen TODO/FIXME/HACK funnet.")
        return "\n".join(lines)

    # Grupper etter severity
    by_severity = defaultdict(list)
    for todo in todos:
        by_severity[todo.severity].append(todo)

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

        for todo in items[:20]:  # Maks 20 per kategori
            rel_path = Path(todo.file).relative_to(root)
            lines.append(f"  [{todo.tag}] {rel_path}:{todo.line}")
            lines.append(f"    {todo.content[:80]}{'...' if len(todo.content) > 80 else ''}")
            lines.append("")

        if len(items) > 20:
            lines.append(f"  ... og {len(items) - 20} til")
            lines.append("")

    # Oppsummering
    lines.append("=" * 60)
    lines.append(f"  SUMMARY: {len(by_severity.get(Severity.CRITICAL, []))} critical, "
                 f"{len(by_severity.get(Severity.HIGH, []))} high, "
                 f"{len(by_severity.get(Severity.MEDIUM, []))} medium, "
                 f"{len(by_severity.get(Severity.LOW, []))} low")
    lines.append("=" * 60)

    return "\n".join(lines)


def format_json(todos: list[TodoItem], root: Path) -> str:
    """Formater TODOs som JSON"""
    by_severity = defaultdict(list)
    for todo in todos:
        by_severity[todo.severity.value].append(todo)

    data = {
        "summary": {
            "total": len(todos),
            "critical": len(by_severity.get("critical", [])),
            "high": len(by_severity.get("high", [])),
            "medium": len(by_severity.get("medium", [])),
            "low": len(by_severity.get("low", [])),
        },
        "items": [
            {
                "file": str(Path(todo.file).relative_to(root)),
                "line": todo.line,
                "tag": todo.tag,
                "content": todo.content,
                "severity": todo.severity.value,
            }
            for todo in todos
        ]
    }
    return json.dumps(data, indent=2, ensure_ascii=False)


def format_markdown(todos: list[TodoItem], root: Path) -> str:
    """Formater TODOs som Markdown"""
    lines = []
    lines.append("# TODO Tracker Report")
    lines.append("")

    if not todos:
        lines.append("✅ Ingen TODO/FIXME/HACK funnet.")
        return "\n".join(lines)

    by_severity = defaultdict(list)
    for todo in todos:
        by_severity[todo.severity].append(todo)

    critical = len(by_severity.get(Severity.CRITICAL, []))
    high = len(by_severity.get(Severity.HIGH, []))

    lines.append(f"**Summary:** {critical} critical, {high} high, {len(todos)} total")
    lines.append("")

    severity_headers = {
        Severity.CRITICAL: "## 🔴 Critical",
        Severity.HIGH: "## 🟠 High",
        Severity.MEDIUM: "## 🟡 Medium",
        Severity.LOW: "## 🔵 Low",
    }

    for severity in [Severity.CRITICAL, Severity.HIGH, Severity.MEDIUM, Severity.LOW]:
        items = by_severity.get(severity, [])
        if not items:
            continue

        lines.append(severity_headers[severity])
        lines.append("")
        lines.append("| File | Line | Tag | Content |")
        lines.append("|------|------|-----|---------|")

        for todo in items[:30]:
            rel_path = Path(todo.file).relative_to(root)
            content = todo.content[:60] + ('...' if len(todo.content) > 60 else '')
            content = content.replace('|', '\\|')
            lines.append(f"| `{rel_path}` | {todo.line} | {todo.tag} | {content} |")

        if len(items) > 30:
            lines.append(f"| ... | | | +{len(items) - 30} more |")

        lines.append("")

    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="Track TODO/FIXME/HACK comments")
    parser.add_argument('--format', choices=['text', 'json', 'markdown'], default='text')
    parser.add_argument('--ci', action='store_true', help='CI mode: exit 1 on critical items')
    parser.add_argument('--severity', choices=['critical', 'high', 'medium', 'low'],
                        help='Filter by minimum severity')
    args = parser.parse_args()

    root = find_project_root()

    # Skann kodebasen
    todos = scan_codebase(root)

    # Filtrer etter severity hvis spesifisert
    if args.severity:
        severity_order = {'critical': 0, 'high': 1, 'medium': 2, 'low': 3}
        min_level = severity_order[args.severity]
        todos = [t for t in todos if severity_order[t.severity.value] <= min_level]

    # Output
    if args.format == 'json':
        print(format_json(todos, root))
    elif args.format == 'markdown':
        print(format_markdown(todos, root))
    else:
        print(format_text(todos, root))

    # CI mode
    if args.ci:
        critical_count = sum(1 for t in todos if t.severity == Severity.CRITICAL)
        if critical_count > 0:
            sys.exit(1)

    sys.exit(0)


if __name__ == '__main__':
    main()
