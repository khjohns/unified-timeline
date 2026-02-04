#!/usr/bin/env python3
"""
Event Field Usage Analyzer

Analyserer hvilke felter i tre-spor events (grunnlag, vederlag, frist)
som faktisk brukes i kodebasen (frontend og backend).

Kjør: python scripts/event_field_usage.py
"""

import ast
import subprocess
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal

# Paths
ROOT = Path(__file__).parent.parent
BACKEND = ROOT / "backend"
FRONTEND = ROOT / "src"
EVENTS_FILE = BACKEND / "models" / "events.py"


@dataclass
class FieldInfo:
    name: str
    type_hint: str


@dataclass
class ModelInfo:
    name: str
    fields: list[FieldInfo] = field(default_factory=list)


@dataclass
class UsageResult:
    field: str
    model: str
    backend_hits: int = 0
    frontend_hits: int = 0
    locations: list[str] = field(default_factory=list)

    @property
    def total_hits(self) -> int:
        return self.backend_hits + self.frontend_hits

    @property
    def status(self) -> Literal["unused", "low", "ok"]:
        if self.total_hits == 0:
            return "unused"
        elif self.total_hits <= 2:
            return "low"
        return "ok"


def parse_pydantic_models(file_path: Path) -> dict[str, ModelInfo]:
    """Parse Pydantic models from a Python file."""
    with open(file_path) as f:
        source = f.read()

    tree = ast.parse(source)
    models: dict[str, ModelInfo] = {}

    for node in ast.walk(tree):
        if isinstance(node, ast.ClassDef):
            # Include classes ending with Data or ResponsData
            if not (node.name.endswith("Data") or "Varsel" in node.name or "Saerskilt" in node.name or "Kompensasjon" in node.name):
                continue

            model = ModelInfo(name=node.name)

            for item in node.body:
                if isinstance(item, ast.AnnAssign) and isinstance(item.target, ast.Name):
                    field_name = item.target.id
                    if field_name.startswith("_") or field_name == "model_config":
                        continue
                    type_hint = ast.unparse(item.annotation) if item.annotation else ""
                    model.fields.append(FieldInfo(name=field_name, type_hint=type_hint))

            if model.fields:
                models[node.name] = model

    return models


def run_grep(pattern: str, path: Path, file_ext: str = None) -> list[str]:
    """Run grep and return matching lines."""
    search_path = ROOT / path
    if not search_path.exists():
        return []

    if file_ext:
        # Use find + grep for file extension filtering
        cmd = f'find {search_path} -name "*.{file_ext}" -exec grep -nE "{pattern}" {{}} + 2>/dev/null'
    else:
        cmd = f'grep -rnE "{pattern}" {search_path} 2>/dev/null'

    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        if result.returncode == 0:
            return [line for line in result.stdout.strip().split("\n") if line]
    except Exception as e:
        pass
    return []


def analyze_field(model_name: str, field_name: str) -> UsageResult:
    """Analyze usage of a field."""
    result = UsageResult(field=field_name, model=model_name)

    # Backend: search for event.data.field_name pattern (main usage)
    pattern = rf"\.data\.{field_name}[^a-zA-Z_]"
    lines = run_grep(pattern, Path("backend"), "py")
    for line in lines:
        if line and "events.py" not in line:  # Exclude definition file
            result.backend_hits += 1
            if ":" in line:
                file_path = line.split(":")[0]
                rel_path = file_path.replace(str(ROOT) + "/", "")
                if rel_path not in result.locations:
                    result.locations.append(rel_path)

    # Backend: also check for field_name= (keyword args) and 'field_name'
    pattern2 = rf"['\"]?{field_name}['\"]?\s*[=:]"
    lines = run_grep(pattern2, Path("backend/services"), "py")
    for line in lines:
        if line and "events.py" not in line:
            result.backend_hits += 1
            if ":" in line:
                file_path = line.split(":")[0]
                rel_path = file_path.replace(str(ROOT) + "/", "")
                if rel_path not in result.locations:
                    result.locations.append(rel_path)

    # Frontend: search in TypeScript files
    fe_pattern = rf"\.{field_name}[^a-zA-Z_]|{field_name}\??\s*:"
    for ext in ["ts", "tsx"]:
        lines = run_grep(fe_pattern, Path("src"), ext)
        for line in lines:
            if line:
                result.frontend_hits += 1
                if ":" in line:
                    file_path = line.split(":")[0]
                    rel_path = file_path.replace(str(ROOT) + "/", "")
                    if rel_path not in result.locations:
                        result.locations.append(rel_path)

    return result


def main():
    print("=" * 70)
    print("  EVENT FIELD USAGE ANALYZER - TRE-SPOR")
    print("=" * 70)
    print()

    models = parse_pydantic_models(EVENTS_FILE)

    # Filter to tre-spor models
    tre_spor_names = [
        "GrunnlagData",
        "GrunnlagResponsData",
        "VederlagData",
        "VederlagKompensasjon",
        "VederlagResponsData",
        "FristData",
        "FristResponsData",
        "VarselInfo",
        "SaerskiltKrav",
        "SaerskiltKravItem",
    ]

    tre_spor_models = {k: v for k, v in models.items() if k in tre_spor_names}

    print(f"Analyserer {len(tre_spor_models)} modeller...\n")

    all_results: list[UsageResult] = []

    for model_name in tre_spor_names:
        if model_name not in tre_spor_models:
            continue

        model = tre_spor_models[model_name]
        print(f"\n{'─' * 60}")
        print(f"  {model_name} ({len(model.fields)} felter)")
        print(f"{'─' * 60}")

        for field_info in model.fields:
            result = analyze_field(model_name, field_info.name)
            all_results.append(result)

            # Status display
            if result.total_hits == 0:
                icon, color = "❌", "\033[91m"
            elif result.total_hits <= 2:
                icon, color = "⚠️ ", "\033[93m"
            else:
                icon, color = "✅", "\033[92m"

            reset = "\033[0m"
            loc_preview = result.locations[0] if result.locations else ""
            if len(loc_preview) > 35:
                loc_preview = "..." + loc_preview[-32:]

            print(
                f"  {icon} {color}{result.field:28}{reset} "
                f"BE:{result.backend_hits:3} FE:{result.frontend_hits:3}  {loc_preview}"
            )

    # Summary
    print("\n" + "=" * 70)
    print("  OPPSUMMERING")
    print("=" * 70)

    total = len(all_results)
    unused = [r for r in all_results if r.status == "unused"]
    low = [r for r in all_results if r.status == "low"]
    ok = [r for r in all_results if r.status == "ok"]

    print(f"\n  Totalt: {total} felter")
    print(f"  ✅ Brukt (>2 treff):   {len(ok)}")
    print(f"  ⚠️  Lav bruk (1-2):    {len(low)}")
    print(f"  ❌ Ubrukt (0 treff):   {len(unused)}")

    # Group unused by model
    if unused:
        print(f"\n{'─' * 60}")
        print("  UBRUKTE FELTER (kandidater for fjerning)")
        print(f"{'─' * 60}")

        by_model: dict[str, list[str]] = defaultdict(list)
        for r in unused:
            by_model[r.model].append(r.field)

        for model, fields in by_model.items():
            print(f"\n  {model}:")
            for f in fields:
                print(f"    - {f}")

    # Show low usage with locations
    if low:
        print(f"\n{'─' * 60}")
        print("  LAV BRUK (vurder om nødvendig)")
        print(f"{'─' * 60}")
        for r in low:
            locs = ", ".join(r.locations[:2])
            print(f"    {r.model}.{r.field}: {locs}")

    print()


if __name__ == "__main__":
    main()
