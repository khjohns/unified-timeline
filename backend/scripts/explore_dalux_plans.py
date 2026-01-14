#!/usr/bin/env python3
"""
Utforsk Inspection Plans og Test Plans API-er i Dalux

Bruk:
    cd backend
    source venv/bin/activate
    python scripts/explore_dalux_plans.py
"""

import os
import sys
import json
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

import requests


def main():
    api_key = os.environ.get("DALUX_API_KEY") or os.environ.get("DALUX_TEST_API_KEY")
    base_url = os.environ.get("DALUX_BASE_URL") or os.environ.get("DALUX_DEFAULT_BASE_URL")

    if not api_key or not base_url:
        print("Mangler DALUX_API_KEY eller DALUX_BASE_URL i .env")
        sys.exit(1)

    headers = {"X-API-KEY": api_key}

    # Hent prosjekter
    print("=" * 70)
    print("  DALUX: Utforsker Inspection Plans og Test Plans")
    print("=" * 70)
    print()

    projects_resp = requests.get(f"{base_url}5.1/projects", headers=headers, timeout=30)
    projects_resp.raise_for_status()
    projects = projects_resp.json().get("items", [])

    if not projects:
        print("Ingen prosjekter tilgjengelig")
        sys.exit(1)

    # Bruk Stovner skole (første prosjekt)
    project = projects[0].get("data", {})
    project_id = project.get("projectId")
    project_name = project.get("projectName")

    print(f"Prosjekt: {project_name} (ID: {project_id})")
    print()

    # === INSPECTION PLANS ===
    print("-" * 70)
    print("1. INSPECTION PLANS (Kontrollplaner)")
    print("-" * 70)

    try:
        url = f"{base_url}1.2/projects/{project_id}/inspectionPlans"
        print(f"   GET {url}")
        resp = requests.get(url, headers=headers, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        items = data.get("items", [])
        print(f"   → {len(items)} kontrollplan(er) funnet")

        if items:
            print()
            for i, item in enumerate(items[:5], 1):
                d = item.get("data", item)
                plan_id = d.get("inspectionPlanId", "?")
                name = d.get("name", d.get("inspectionPlanName", "Ukjent"))
                print(f"   {i}. {name}")
                print(f"      ID: {plan_id}")
                # Vis flere felt hvis de finnes
                for key in ["description", "status", "category"]:
                    if d.get(key):
                        print(f"      {key}: {d.get(key)}")

            if len(items) > 5:
                print(f"   ... og {len(items) - 5} flere")

            # Lagre full respons
            print()
            print("   Full JSON lagret til: /tmp/dalux_inspection_plans.json")
            with open("/tmp/dalux_inspection_plans.json", "w") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
    except requests.RequestException as e:
        print(f"   ❌ Feil: {e}")

    # === INSPECTION PLAN ITEMS ===
    print()
    print("-" * 70)
    print("2. INSPECTION PLAN ITEMS (Kontrollpunkt)")
    print("-" * 70)

    try:
        url = f"{base_url}1.1/projects/{project_id}/inspectionPlanItems"
        print(f"   GET {url}")
        resp = requests.get(url, headers=headers, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        items = data.get("items", [])
        print(f"   → {len(items)} kontrollpunkt funnet")

        if items:
            print()
            for i, item in enumerate(items[:5], 1):
                d = item.get("data", item)
                item_id = d.get("inspectionPlanItemId", "?")
                plan_id = d.get("inspectionPlanId", "?")
                name = d.get("name", d.get("itemName", "Ukjent"))
                print(f"   {i}. {name}")
                print(f"      Item ID: {item_id}")
                print(f"      Plan ID: {plan_id}")

            if len(items) > 5:
                print(f"   ... og {len(items) - 5} flere")

            print()
            print("   Full JSON lagret til: /tmp/dalux_inspection_plan_items.json")
            with open("/tmp/dalux_inspection_plan_items.json", "w") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
    except requests.RequestException as e:
        print(f"   ❌ Feil: {e}")

    # === INSPECTION PLAN REGISTRATIONS ===
    print()
    print("-" * 70)
    print("3. INSPECTION PLAN REGISTRATIONS (Utførte kontroller)")
    print("-" * 70)

    try:
        url = f"{base_url}2.1/projects/{project_id}/inspectionPlanRegistrations"
        print(f"   GET {url}")
        resp = requests.get(url, headers=headers, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        items = data.get("items", [])
        print(f"   → {len(items)} registrering(er) funnet")

        if items:
            print()
            for i, item in enumerate(items[:5], 1):
                d = item.get("data", item)
                reg_id = d.get("inspectionPlanRegistrationId", "?")
                item_id = d.get("inspectionPlanItemId", "?")
                status = d.get("status", "?")
                print(f"   {i}. Registration ID: {reg_id}")
                print(f"      Item ID: {item_id}")
                print(f"      Status: {status}")
                # Vis flere felt
                for key in ["createdBy", "created", "formId", "taskId"]:
                    if d.get(key):
                        print(f"      {key}: {d.get(key)}")

            if len(items) > 5:
                print(f"   ... og {len(items) - 5} flere")

            print()
            print("   Full JSON lagret til: /tmp/dalux_inspection_registrations.json")
            with open("/tmp/dalux_inspection_registrations.json", "w") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
    except requests.RequestException as e:
        print(f"   ❌ Feil: {e}")

    # === TEST PLANS ===
    print()
    print("-" * 70)
    print("4. TEST PLANS (Testplaner/Sjekklister)")
    print("-" * 70)

    try:
        url = f"{base_url}1.2/projects/{project_id}/testPlans"
        print(f"   GET {url}")
        resp = requests.get(url, headers=headers, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        items = data.get("items", [])
        print(f"   → {len(items)} testplan(er) funnet")

        if items:
            print()
            for i, item in enumerate(items[:5], 1):
                d = item.get("data", item)
                plan_id = d.get("testPlanId", "?")
                name = d.get("name", d.get("testPlanName", "Ukjent"))
                print(f"   {i}. {name}")
                print(f"      ID: {plan_id}")
                for key in ["description", "status", "category"]:
                    if d.get(key):
                        print(f"      {key}: {d.get(key)}")

            if len(items) > 5:
                print(f"   ... og {len(items) - 5} flere")

            print()
            print("   Full JSON lagret til: /tmp/dalux_test_plans.json")
            with open("/tmp/dalux_test_plans.json", "w") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
    except requests.RequestException as e:
        print(f"   ❌ Feil: {e}")

    # === TEST PLAN ITEMS ===
    print()
    print("-" * 70)
    print("5. TEST PLAN ITEMS (Testpunkter)")
    print("-" * 70)

    try:
        url = f"{base_url}1.1/projects/{project_id}/testPlanItems"
        print(f"   GET {url}")
        resp = requests.get(url, headers=headers, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        items = data.get("items", [])
        print(f"   → {len(items)} testpunkt funnet")

        if items:
            print()
            for i, item in enumerate(items[:5], 1):
                d = item.get("data", item)
                item_id = d.get("testPlanItemId", "?")
                plan_id = d.get("testPlanId", "?")
                name = d.get("name", d.get("itemName", "Ukjent"))
                print(f"   {i}. {name}")
                print(f"      Item ID: {item_id}")
                print(f"      Plan ID: {plan_id}")

            if len(items) > 5:
                print(f"   ... og {len(items) - 5} flere")

            print()
            print("   Full JSON lagret til: /tmp/dalux_test_plan_items.json")
            with open("/tmp/dalux_test_plan_items.json", "w") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
    except requests.RequestException as e:
        print(f"   ❌ Feil: {e}")

    # === TEST PLAN REGISTRATIONS ===
    print()
    print("-" * 70)
    print("6. TEST PLAN REGISTRATIONS (Utførte tester)")
    print("-" * 70)

    try:
        url = f"{base_url}1.1/projects/{project_id}/testPlanRegistrations"
        print(f"   GET {url}")
        resp = requests.get(url, headers=headers, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        items = data.get("items", [])
        print(f"   → {len(items)} registrering(er) funnet")

        if items:
            print()
            for i, item in enumerate(items[:5], 1):
                d = item.get("data", item)
                reg_id = d.get("testPlanRegistrationId", "?")
                item_id = d.get("testPlanItemId", "?")
                status = d.get("status", "?")
                print(f"   {i}. Registration ID: {reg_id}")
                print(f"      Item ID: {item_id}")
                print(f"      Status: {status}")
                for key in ["createdBy", "created", "formId"]:
                    if d.get(key):
                        print(f"      {key}: {d.get(key)}")

            if len(items) > 5:
                print(f"   ... og {len(items) - 5} flere")

            print()
            print("   Full JSON lagret til: /tmp/dalux_test_registrations.json")
            with open("/tmp/dalux_test_registrations.json", "w") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
    except requests.RequestException as e:
        print(f"   ❌ Feil: {e}")

    # === FORMS ===
    print()
    print("-" * 70)
    print("7. FORMS (Skjemaer)")
    print("-" * 70)

    try:
        url = f"{base_url}2.1/projects/{project_id}/forms"
        print(f"   GET {url}")
        resp = requests.get(url, headers=headers, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        items = data.get("items", [])
        print(f"   → {len(items)} skjema(er) funnet")

        if items:
            print()
            for i, item in enumerate(items[:5], 1):
                d = item.get("data", item)
                form_id = d.get("formId", "?")
                name = d.get("name", d.get("formName", "Ukjent"))
                form_type = d.get("formType", "?")
                print(f"   {i}. {name}")
                print(f"      ID: {form_id}")
                print(f"      Type: {form_type}")

            if len(items) > 5:
                print(f"   ... og {len(items) - 5} flere")

            print()
            print("   Full JSON lagret til: /tmp/dalux_forms.json")
            with open("/tmp/dalux_forms.json", "w") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
    except requests.RequestException as e:
        print(f"   ❌ Feil: {e}")

    print()
    print("=" * 70)
    print("  Ferdig! JSON-filer lagret til /tmp/dalux_*.json")
    print("=" * 70)


if __name__ == "__main__":
    main()
