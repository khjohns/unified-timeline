#!/usr/bin/env python3
"""
Unified Drift Checker

Kjører alle drift-detektorer og gir en samlet rapport.

Bruk:
    python scripts/check_drift.py              # Standard output
    python scripts/check_drift.py --format json    # JSON output
    python scripts/check_drift.py --ci             # CI mode (exit 1 on any drift)
    python scripts/check_drift.py --fix            # Vis forslag til fikser
"""

import subprocess
import sys
import json
import argparse
from pathlib import Path


def find_project_root() -> Path:
    """Finn prosjektroten"""
    current = Path(__file__).resolve().parent
    while current != current.parent:
        if (current / "package.json").exists():
            return current
        current = current.parent
    raise RuntimeError("Kunne ikke finne prosjektroten")


def run_detector(script_name: str, format_arg: str = "json") -> dict:
    """Kjør en detektor og returner resultat"""
    root = find_project_root()
    script_path = root / "scripts" / script_name

    try:
        result = subprocess.run(
            [sys.executable, str(script_path), "--format", format_arg],
            capture_output=True,
            text=True,
            cwd=str(root)
        )
        if format_arg == "json":
            return json.loads(result.stdout)
        return {"output": result.stdout, "returncode": result.returncode}
    except Exception as e:
        return {"error": str(e), "drift_detected": False}


def format_text_report(contract_result: dict, state_result: dict) -> str:
    """Formater samlet tekstrapport"""
    lines = []
    lines.append("=" * 60)
    lines.append("  DRIFT CHECK REPORT")
    lines.append("=" * 60)
    lines.append("")

    # Contract drift
    lines.append("CONTRACT DRIFT (Enums/Unions)")
    lines.append("-" * 40)
    if contract_result.get("error"):
        lines.append(f"  Feil: {contract_result['error']}")
    elif contract_result.get("drift_detected"):
        lines.append(f"  DRIFT FUNNET: {contract_result['types_with_drift']} typer")
        for finding in contract_result.get("findings", []):
            lines.append(f"    - {finding['type_name']}: {len(finding['details'])} avvik")
    else:
        lines.append("  OK - Ingen drift")
    lines.append("")

    # State drift
    lines.append("STATE MODEL DRIFT (Interfaces/Models)")
    lines.append("-" * 40)
    if state_result.get("error"):
        lines.append(f"  Feil: {state_result['error']}")
    elif state_result.get("drift_detected"):
        lines.append(f"  DRIFT FUNNET: {state_result['models_with_drift']} modeller")
        for finding in state_result.get("findings", []):
            critical = sum(1 for d in finding['details'] if d['severity'] == 'critical')
            warning = sum(1 for d in finding['details'] if d['severity'] == 'warning')
            lines.append(f"    - {finding['model_name']}: {critical} kritiske, {warning} advarsler")
    else:
        lines.append("  OK - Ingen drift")
    lines.append("")

    # Oppsummering
    lines.append("=" * 60)
    total_drift = (
        contract_result.get("drift_detected", False) or
        state_result.get("drift_detected", False)
    )

    if total_drift:
        contract_issues = sum(
            len(f['details'])
            for f in contract_result.get("findings", [])
        )
        state_critical = sum(
            sum(1 for d in f['details'] if d['severity'] == 'critical')
            for f in state_result.get("findings", [])
        )
        state_warning = sum(
            sum(1 for d in f['details'] if d['severity'] == 'warning')
            for f in state_result.get("findings", [])
        )

        lines.append(f"  TOTALT: {contract_issues + state_critical} kritiske, {state_warning} advarsler")
        lines.append("")
        lines.append("  Kjør individuelt for detaljer:")
        lines.append("    python scripts/contract_drift.py")
        lines.append("    python scripts/state_drift.py")
    else:
        lines.append("  OK - Ingen drift funnet")

    lines.append("=" * 60)

    return "\n".join(lines)


def format_json_report(contract_result: dict, state_result: dict) -> str:
    """Formater samlet JSON-rapport"""
    report = {
        "drift_detected": (
            contract_result.get("drift_detected", False) or
            state_result.get("drift_detected", False)
        ),
        "contract_drift": contract_result,
        "state_drift": state_result,
        "summary": {
            "contract_types_with_drift": contract_result.get("types_with_drift", 0),
            "state_models_with_drift": state_result.get("models_with_drift", 0),
        }
    }
    return json.dumps(report, indent=2, ensure_ascii=False)


def main():
    parser = argparse.ArgumentParser(
        description="Kjører alle drift-detektorer"
    )
    parser.add_argument(
        "--format", "-f",
        choices=["text", "json"],
        default="text",
        help="Output-format (default: text)"
    )
    parser.add_argument(
        "--ci",
        action="store_true",
        help="CI-modus: Exit 1 ved drift"
    )

    args = parser.parse_args()

    # Kjør detektorene
    print("Kjører contract_drift.py...", file=sys.stderr)
    contract_result = run_detector("contract_drift.py", "json")

    print("Kjører state_drift.py...", file=sys.stderr)
    state_result = run_detector("state_drift.py", "json")

    # Formater output
    if args.format == "json":
        output = format_json_report(contract_result, state_result)
    else:
        output = format_text_report(contract_result, state_result)

    print(output)

    # Exit code for CI
    if args.ci:
        has_drift = (
            contract_result.get("drift_detected", False) or
            state_result.get("drift_detected", False)
        )
        if has_drift:
            sys.exit(1)

    sys.exit(0)


if __name__ == "__main__":
    main()
