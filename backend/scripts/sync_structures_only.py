#!/usr/bin/env python3
"""
Sync only hierarchical structures (Del, Kapittel, etc.) for existing documents.

Does NOT re-download or re-parse sections - only adds structure metadata.
Uses small batches to avoid Supabase statement timeouts.
"""

import io
import os
import sys
import tarfile
import time

import httpx
from bs4 import BeautifulSoup
from dotenv import load_dotenv

# Add parent to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.lovdata_structure_parser import extract_structure_hierarchy

load_dotenv()

from supabase import create_client

DATASETS = {
    "lover": "https://api.lovdata.no/v1/publicData/get/gjeldende-lover.tar.bz2",
    "forskrifter": "https://api.lovdata.no/v1/publicData/get/gjeldende-sentrale-forskrifter.tar.bz2",
}


def sync_structures():
    """Sync structures for all documents."""
    client = create_client(
        os.environ["SUPABASE_URL"],
        os.environ["SUPABASE_KEY"],
    )

    total_structures = 0
    total_mappings = 0

    for dataset_name, url in DATASETS.items():
        print(f"\n{'='*60}")
        print(f"Processing {dataset_name}...")
        print(f"{'='*60}")

        doc_type = "lov" if dataset_name == "lover" else "forskrift"

        # Download archive
        print("Downloading archive...")
        with httpx.Client(timeout=300.0) as http_client:
            response = http_client.get(url)
            response.raise_for_status()

        # Process XML files
        print("Parsing structures...")
        structure_batch = []
        batch_num = 0

        with tarfile.open(fileobj=io.BytesIO(response.content), mode="r:bz2") as tar:
            for member in tar:
                if not member.isfile() or not member.name.endswith(".xml"):
                    continue

                try:
                    f = tar.extractfile(member)
                    if f is None:
                        continue

                    content = f.read().decode("utf-8")
                    soup = BeautifulSoup(content, "html.parser")

                    # Extract dok_id from header
                    header = soup.find("header", class_="documentHeader")
                    if not header:
                        continue

                    dokid_elem = header.find("dd", class_="dokid")
                    if not dokid_elem:
                        continue

                    dok_id = dokid_elem.get_text(strip=True)
                    # Normalize
                    for prefix in ("NL/", "SF/", "LTI/", "NLE/", "NLO/"):
                        if dok_id.startswith(prefix):
                            dok_id = dok_id[len(prefix) :]
                            break

                    # Extract structures
                    structures, mappings = extract_structure_hierarchy(soup, dok_id)

                    if structures:
                        for s in structures:
                            structure_batch.append({
                                "dok_id": s.dok_id,
                                "structure_type": s.structure_type,
                                "structure_id": s.structure_id,
                                "title": s.title,
                                "sort_order": s.sort_order,
                                "address": s.address,
                                "heading_level": s.heading_level,
                            })

                        total_structures += len(structures)
                        total_mappings += len(mappings)

                    # Flush in small batches (5 documents worth)
                    if len(structure_batch) >= 50:
                        batch_num += 1
                        _flush_structures(client, structure_batch, batch_num)
                        structure_batch = []

                except Exception as e:
                    print(f"  Error parsing {member.name}: {e}")

        # Flush remaining
        if structure_batch:
            batch_num += 1
            _flush_structures(client, structure_batch, batch_num)

        print(f"  {dataset_name}: {total_structures} structures, {total_mappings} mappings")

    print(f"\n{'='*60}")
    print(f"DONE: {total_structures} total structures")
    print(f"{'='*60}")


def _flush_structures(client, structures: list[dict], batch_num: int, retries: int = 3):
    """Insert structures with retry logic."""
    # Deduplicate
    seen = {}
    for s in structures:
        key = (s["dok_id"], s["structure_type"], s["structure_id"])
        seen[key] = s
    unique = list(seen.values())

    for attempt in range(retries):
        try:
            client.table("lovdata_structure").upsert(
                unique,
                on_conflict="dok_id,structure_type,structure_id",
            ).execute()
            print(f"  Batch {batch_num}: {len(unique)} structures inserted")
            return
        except Exception as e:
            if attempt < retries - 1:
                wait = 2 ** attempt
                print(f"  Batch {batch_num} failed, retrying in {wait}s: {e}")
                time.sleep(wait)
            else:
                print(f"  Batch {batch_num} FAILED after {retries} attempts: {e}")


if __name__ == "__main__":
    sync_structures()
