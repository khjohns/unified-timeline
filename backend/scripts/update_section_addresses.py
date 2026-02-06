#!/usr/bin/env python3
"""
Update address field on existing lovdata_sections using bulk RPC.
"""

import io
import json
import os
import sys
import tarfile

import httpx
from bs4 import BeautifulSoup
from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

load_dotenv()

from supabase import create_client

DATASETS = {
    "lover": "https://api.lovdata.no/v1/publicData/get/gjeldende-lover.tar.bz2",
    "forskrifter": "https://api.lovdata.no/v1/publicData/get/gjeldende-sentrale-forskrifter.tar.bz2",
}


def update_addresses():
    client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])
    total_updated = 0

    for dataset_name, url in DATASETS.items():
        print(f"\n{'='*60}", flush=True)
        print(f"Processing {dataset_name}...", flush=True)

        print("Downloading...", flush=True)
        with httpx.Client(timeout=300.0) as http:
            response = http.get(url)
            response.raise_for_status()
        print("Download complete.", flush=True)

        print("Parsing...", flush=True)
        all_updates = []

        with tarfile.open(fileobj=io.BytesIO(response.content), mode="r:bz2") as tar:
            for member in tar:
                if not member.isfile() or not member.name.endswith(".xml"):
                    continue
                try:
                    f = tar.extractfile(member)
                    if not f:
                        continue

                    soup = BeautifulSoup(f.read().decode("utf-8"), "html.parser")
                    header = soup.find("header", class_="documentHeader")
                    if not header:
                        continue

                    dokid_elem = header.find("dd", class_="dokid")
                    if not dokid_elem:
                        continue

                    dok_id = dokid_elem.get_text(strip=True)
                    for prefix in ("NL/", "SF/", "LTI/", "NLE/", "NLO/"):
                        if dok_id.startswith(prefix):
                            dok_id = dok_id[len(prefix):]
                            break

                    for article in soup.find_all("article", class_="legalArticle"):
                        article_id = article.get("id")
                        if not article_id:
                            continue
                        value_span = article.find("span", class_="legalArticleValue")
                        if not value_span:
                            continue
                        section_id = value_span.get_text(strip=True).replace("§", "").strip()
                        section_id = " ".join(section_id.split())
                        if section_id:
                            all_updates.append({
                                "dok_id": dok_id,
                                "section_id": section_id,
                                "address": article_id
                            })
                except Exception as e:
                    print(f"  Error: {member.name}: {e}", flush=True)

        print(f"Found {len(all_updates)} sections to update", flush=True)

        # Bulk update using RPC
        batch_size = 1000
        updated = 0
        for i in range(0, len(all_updates), batch_size):
            batch = all_updates[i:i + batch_size]
            try:
                result = client.rpc("bulk_update_section_addresses", {"updates": batch}).execute()
                count = result.data if result.data else 0
                updated += count
                print(f"  Batch {i//batch_size + 1}: {count} updated", flush=True)
            except Exception as e:
                print(f"  Batch {i//batch_size + 1} error: {e}", flush=True)

        total_updated += updated
        print(f"{dataset_name}: {updated} updated", flush=True)

    print(f"\nDONE: {total_updated} total", flush=True)


if __name__ == "__main__":
    update_addresses()
