#!/usr/bin/env python3
"""
Backfill reporting cache fields for existing KOE cases.

This script populates the new cached reporting fields:
- cached_sum_krevd
- cached_sum_godkjent
- cached_dager_krevd
- cached_dager_godkjent
- cached_hovedkategori
- cached_underkategori

Usage:
    cd backend
    python scripts/backfill_reporting_cache.py

    # Dry run (no changes):
    python scripts/backfill_reporting_cache.py --dry-run
"""

import argparse
import sys
from pathlib import Path

# Add backend to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

# Load .env file
from dotenv import load_dotenv
load_dotenv(backend_dir / ".env")

from core.container import get_container
from models.events import parse_event


def backfill_reporting_cache(dry_run: bool = False) -> None:
    """Backfill reporting cache fields for all KOE cases."""
    container = get_container()
    metadata_repo = container.metadata_repository
    event_repo = container.event_repository
    timeline_service = container.timeline_service

    # Get all standard (KOE) cases
    # Use list_all and filter, since CSV repo doesn't have list_by_sakstype
    all_metadata = metadata_repo.list_all()
    all_cases = [c for c in all_metadata if getattr(c, "sakstype", "standard") == "standard"]
    print(f"Found {len(all_cases)} KOE cases to backfill (of {len(all_metadata)} total)")

    updated = 0
    skipped = 0
    errors = 0

    for case in all_cases:
        sak_id = case.sak_id
        try:
            # Get events and compute state
            event_dicts, version = event_repo.get_events(sak_id)

            if not event_dicts:
                print(f"  {sak_id}: No events, skipping")
                skipped += 1
                continue

            # Parse dicts to Event objects
            events = [parse_event(e) for e in event_dicts]
            state = timeline_service.compute_state(events)

            # Handle legacy array format for underkategori
            underkategori = state.grunnlag.underkategori
            if isinstance(underkategori, list):
                underkategori = underkategori[0] if underkategori else None

            # Prepare update values
            update_values = {
                "cached_sum_krevd": state.vederlag.krevd_belop,
                "cached_sum_godkjent": state.vederlag.godkjent_belop,
                "cached_dager_krevd": state.frist.krevd_dager,
                "cached_dager_godkjent": state.frist.godkjent_dager,
                "cached_hovedkategori": state.grunnlag.hovedkategori,
                "cached_underkategori": underkategori,
            }

            # Log what we're doing
            sum_krevd = update_values["cached_sum_krevd"]
            sum_godkjent = update_values["cached_sum_godkjent"]
            dager_krevd = update_values["cached_dager_krevd"]
            hovedkat = update_values["cached_hovedkategori"] or "-"
            underkat = update_values["cached_underkategori"] or "-"

            print(
                f"  {sak_id}: krevd={sum_krevd}, godkjent={sum_godkjent}, "
                f"dager={dager_krevd}, kat={hovedkat}/{underkat}"
            )

            if not dry_run:
                metadata_repo.update_cache(sak_id=sak_id, **update_values)

            updated += 1

        except Exception as e:
            print(f"  {sak_id}: ERROR - {e}")
            errors += 1

    # Summary
    print()
    print("=" * 50)
    print(f"Backfill complete{'(DRY RUN)' if dry_run else ''}")
    print(f"  Updated: {updated}")
    print(f"  Skipped: {skipped}")
    print(f"  Errors:  {errors}")


def main():
    parser = argparse.ArgumentParser(
        description="Backfill reporting cache fields for KOE cases"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be updated without making changes",
    )
    args = parser.parse_args()

    backfill_reporting_cache(dry_run=args.dry_run)


if __name__ == "__main__":
    main()
