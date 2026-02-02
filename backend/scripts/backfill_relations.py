#!/usr/bin/env python3
"""
Backfill sak_relations table from existing events.

This script populates the sak_relations projection table by scanning
all existing forsering and endringsordre events.

Usage:
    # Dry run (show what would be done)
    python scripts/backfill_relations.py --dry-run

    # Actually perform backfill
    python scripts/backfill_relations.py

    # Clear and rebuild all relations
    python scripts/backfill_relations.py --rebuild

Environment:
    Requires EVENT_STORE_BACKEND=supabase and Supabase credentials
"""

import argparse
import sys
import os

# Add backend directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.logger import get_logger
from repositories import create_event_repository, create_relation_repository
from models.events import parse_event

logger = get_logger(__name__)


def backfill_forsering_relations(
    event_repository,
    relation_repository,
    dry_run: bool = False
) -> tuple[int, int]:
    """
    Backfill forsering relations from forsering_events.

    Returns:
        Tuple of (saker_processed, relations_added)
    """
    logger.info("Backfilling forsering relations...")

    # Get all forsering sak_ids
    sak_ids = event_repository.get_all_sak_ids(sakstype="forsering")
    logger.info(f"Found {len(sak_ids)} forsering saker")

    saker_processed = 0
    relations_added = 0

    for sak_id in sak_ids:
        try:
            events_data, _version = event_repository.get_events(sak_id, sakstype="forsering")
            if not events_data:
                continue

            # Find events with avslatte_fristkrav (can be in different locations)
            for event_dict in events_data:
                event = parse_event(event_dict)
                target_sak_ids = []

                # Check direct avslatte_fristkrav in event.data (typed events)
                if hasattr(event, 'data') and hasattr(event.data, 'avslatte_fristkrav'):
                    target_sak_ids = event.data.avslatte_fristkrav or []

                # Check nested forsering_data.avslatte_fristkrav (in SAK_OPPRETTET)
                if not target_sak_ids and hasattr(event, 'data'):
                    data = event.data
                    # Handle dict data (SAK_OPPRETTET stores data as dict)
                    if isinstance(data, dict):
                        fd = data.get('forsering_data', {})
                        if isinstance(fd, dict):
                            target_sak_ids = fd.get('avslatte_fristkrav', [])
                    # Handle object with forsering_data attribute
                    elif hasattr(data, 'forsering_data') and data.forsering_data:
                        fd = data.forsering_data
                        if isinstance(fd, dict):
                            target_sak_ids = fd.get('avslatte_fristkrav', [])
                        elif hasattr(fd, 'avslatte_fristkrav'):
                            target_sak_ids = fd.avslatte_fristkrav or []

                if target_sak_ids:
                    if dry_run:
                        logger.info(f"[DRY RUN] Would add {len(target_sak_ids)} relations for forsering {sak_id}")
                        relations_added += len(target_sak_ids)
                    else:
                        added = relation_repository.add_relations_batch(
                            source_sak_id=sak_id,
                            target_sak_ids=target_sak_ids,
                            relation_type="forsering",
                        )
                        relations_added += added
                        logger.debug(f"Added {added} relations for forsering {sak_id}")

                    saker_processed += 1
                    break  # Only process first event with relations

        except Exception as e:
            logger.warning(f"Failed to process forsering {sak_id}: {e}")

    return saker_processed, relations_added


def backfill_endringsordre_relations(
    event_repository,
    relation_repository,
    dry_run: bool = False
) -> tuple[int, int]:
    """
    Backfill endringsordre relations from endringsordre_events.

    Returns:
        Tuple of (saker_processed, relations_added)
    """
    logger.info("Backfilling endringsordre relations...")

    # Get all endringsordre sak_ids
    sak_ids = event_repository.get_all_sak_ids(sakstype="endringsordre")
    logger.info(f"Found {len(sak_ids)} endringsordre saker")

    saker_processed = 0
    relations_added = 0

    for sak_id in sak_ids:
        try:
            events_data, _version = event_repository.get_events(sak_id, sakstype="endringsordre")
            if not events_data:
                continue

            # Find EO_OPPRETTET or EO_UTSTEDT event to get related KOEs
            for event_dict in events_data:
                event = parse_event(event_dict)

                # Check for events which contain relaterte_koe_saker
                if hasattr(event, 'data') and hasattr(event.data, 'relaterte_koe_saker'):
                    target_sak_ids = event.data.relaterte_koe_saker or []

                    if target_sak_ids:
                        if dry_run:
                            logger.info(f"[DRY RUN] Would add {len(target_sak_ids)} relations for EO {sak_id}")
                            relations_added += len(target_sak_ids)
                        else:
                            added = relation_repository.add_relations_batch(
                                source_sak_id=sak_id,
                                target_sak_ids=target_sak_ids,
                                relation_type="endringsordre",
                            )
                            relations_added += added
                            logger.debug(f"Added {added} relations for EO {sak_id}")

                        saker_processed += 1
                        break  # Only process first event with relations

        except Exception as e:
            logger.warning(f"Failed to process EO {sak_id}: {e}")

    return saker_processed, relations_added


def main():
    parser = argparse.ArgumentParser(description="Backfill sak_relations table")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be done without making changes"
    )
    parser.add_argument(
        "--rebuild",
        action="store_true",
        help="Clear all relations before backfilling"
    )
    parser.add_argument(
        "--type",
        choices=["forsering", "endringsordre", "all"],
        default="all",
        help="Type of relations to backfill (default: all)"
    )
    args = parser.parse_args()

    # Check backend
    backend = os.environ.get("EVENT_STORE_BACKEND")
    if backend != "supabase":
        logger.error(f"This script requires EVENT_STORE_BACKEND=supabase (current: {backend})")
        sys.exit(1)

    try:
        event_repository = create_event_repository()
        relation_repository = create_relation_repository()
    except Exception as e:
        logger.error(f"Failed to create repositories: {e}")
        sys.exit(1)

    logger.info(f"Starting backfill (dry_run={args.dry_run}, rebuild={args.rebuild})")

    # Clear if requested
    if args.rebuild and not args.dry_run:
        if args.type == "all":
            cleared = relation_repository.clear_all_relations()
        else:
            cleared = relation_repository.clear_all_relations(relation_type=args.type)
        logger.info(f"Cleared {cleared} existing relations")

    # Backfill
    total_saker = 0
    total_relations = 0

    if args.type in ("forsering", "all"):
        saker, relations = backfill_forsering_relations(
            event_repository, relation_repository, dry_run=args.dry_run
        )
        total_saker += saker
        total_relations += relations
        logger.info(f"Forsering: {saker} saker, {relations} relations")

    if args.type in ("endringsordre", "all"):
        saker, relations = backfill_endringsordre_relations(
            event_repository, relation_repository, dry_run=args.dry_run
        )
        total_saker += saker
        total_relations += relations
        logger.info(f"Endringsordre: {saker} saker, {relations} relations")

    # Summary
    if args.dry_run:
        logger.info(f"[DRY RUN] Would process {total_saker} saker, add {total_relations} relations")
    else:
        logger.info(f"Backfill complete: {total_saker} saker, {total_relations} relations")

        # Verify
        all_relations = relation_repository.get_all_relations()
        logger.info(f"Total relations in table: {len(all_relations)}")


if __name__ == "__main__":
    main()
