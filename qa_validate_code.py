#!/usr/bin/env python3
"""
QA Script: Ekstraher og valider Python-kode fra Refaktoreringsplan - Backend.md
"""
import re
import ast
import sys
from pathlib import Path
from typing import List, Tuple, Dict

def extract_python_code_blocks(markdown_content: str) -> List[Tuple[int, str]]:
    """
    Ekstraher alle Python-kodeblokker fra markdown.
    Returns: Liste av (line_number, code) tuples
    """
    blocks = []
    in_code_block = False
    current_block = []
    block_start_line = 0
    is_python_block = False

    lines = markdown_content.split('\n')

    for i, line in enumerate(lines, 1):
        if line.strip().startswith('```python'):
            in_code_block = True
            is_python_block = True
            block_start_line = i
            current_block = []
        elif line.strip().startswith('```') and not line.strip().startswith('```python'):
            if in_code_block and is_python_block:
                # End of Python block
                blocks.append((block_start_line, '\n'.join(current_block)))
                in_code_block = False
                is_python_block = False
                current_block = []
            elif not in_code_block:
                # Start of non-Python block - skip
                in_code_block = True
                is_python_block = False
        elif in_code_block and is_python_block:
            current_block.append(line)

    return blocks

def validate_python_syntax(code: str, line_num: int) -> Tuple[bool, str]:
    """
    Valider Python-syntaks ved å parse koden.
    Returns: (is_valid, error_message)
    """
    try:
        ast.parse(code)
        return True, ""
    except SyntaxError as e:
        return False, f"Line {line_num}: SyntaxError at line {e.lineno}: {e.msg}"
    except Exception as e:
        return False, f"Line {line_num}: {type(e).__name__}: {str(e)}"

def check_imports(code: str) -> List[str]:
    """
    Ekstraher alle imports fra koden.
    Returns: Liste av importerte moduler
    """
    imports = []
    try:
        tree = ast.parse(code)
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    imports.append(alias.name)
            elif isinstance(node, ast.ImportFrom):
                if node.module:
                    imports.append(node.module)
    except:
        pass
    return imports

def check_pydantic_v2_usage(code: str) -> List[str]:
    """
    Sjekk om koden bruker Pydantic v2 syntax korrekt.
    Returns: Liste av advarsler
    """
    warnings = []

    # Sjekk for v1-spesifikke patterns
    if 'parse_obj(' in code:
        warnings.append("⚠️  Bruker 'parse_obj()' - dette er Pydantic v1. Bruk 'model_validate()' i v2")

    if 'parse_raw(' in code:
        warnings.append("⚠️  Bruker 'parse_raw()' - dette er Pydantic v1. Bruk 'model_validate_json()' i v2")

    if '.dict(' in code:
        warnings.append("⚠️  Bruker '.dict()' - dette er Pydantic v1. Bruk '.model_dump()' i v2")

    if '.json(' in code and 'import json' not in code:
        # Dette kan være OK hvis det er .model_dump_json()
        if '.model_dump_json()' not in code:
            warnings.append("ℹ️  Bruker '.json()' - verifiser at det er '.model_dump_json()' i v2")

    # Sjekk for BaseSettings location
    if 'from pydantic import BaseSettings' in code:
        warnings.append("⚠️  'BaseSettings' er flyttet i v2. Bruk 'from pydantic_settings import BaseSettings'")

    return warnings

def main():
    doc_path = Path('/home/user/Skjema_Endringsmeldinger/docs/Refaktoreringsplan - Backend.md')

    if not doc_path.exists():
        print(f"❌ Finner ikke {doc_path}")
        sys.exit(1)

    content = doc_path.read_text(encoding='utf-8')

    print("=" * 80)
    print("QA RAPPORT: Python Kode Validering")
    print("=" * 80)
    print()

    # Ekstraher kodeblokker
    blocks = extract_python_code_blocks(content)
    print(f"📊 Fant {len(blocks)} Python-kodeblokker i dokumentet")
    print()

    syntax_errors = []
    all_imports = set()
    pydantic_warnings = []

    for i, (line_num, code) in enumerate(blocks, 1):
        # Valider syntaks
        is_valid, error_msg = validate_python_syntax(code, line_num)
        if not is_valid:
            syntax_errors.append(error_msg)

        # Samle imports
        imports = check_imports(code)
        all_imports.update(imports)

        # Sjekk Pydantic usage
        if 'pydantic' in code.lower() or 'BaseModel' in code:
            warnings = check_pydantic_v2_usage(code)
            if warnings:
                pydantic_warnings.extend([f"Block {i} (line ~{line_num}): {w}" for w in warnings])

    # Print resultater
    print("=" * 80)
    print("RESULTATER")
    print("=" * 80)
    print()

    if syntax_errors:
        print("🔴 SYNTAKS FEIL:")
        for error in syntax_errors:
            print(f"  {error}")
        print()
    else:
        print("✅ Alle kodeblokker har gyldig Python-syntaks")
        print()

    if pydantic_warnings:
        print("🟡 PYDANTIC v2 ADVARSLER:")
        for warning in pydantic_warnings:
            print(f"  {warning}")
        print()
    else:
        print("✅ Ingen Pydantic v1/v2 problemer funnet")
        print()

    print("📦 IMPORTERTE MODULER:")
    common_modules = sorted([m for m in all_imports if '.' not in m or m.split('.')[0] in [
        'flask', 'azure', 'pydantic', 'pytest', 'unittest', 'typing', 'pathlib',
        'datetime', 'json', 'csv', 'os', 'sys', 'threading'
    ]])
    for module in common_modules:
        print(f"  - {module}")
    print()

    # Oppsummering
    print("=" * 80)
    print("OPPSUMMERING")
    print("=" * 80)
    print(f"Total kodeblokker: {len(blocks)}")
    print(f"Syntaks feil: {len(syntax_errors)}")
    print(f"Pydantic advarsler: {len(pydantic_warnings)}")
    print()

    if syntax_errors or pydantic_warnings:
        print("⚠️  Dokumentet har problemer som bør fikses")
        return 1
    else:
        print("✅ Kode-kvalitet: GODKJENT")
        return 0

if __name__ == '__main__':
    sys.exit(main())
