#!/usr/bin/env python3
"""
Dalux Sync CLI - Manual trigger for Dalux → Catenda synchronization.

Usage:
    # Sync a specific mapping
    python scripts/dalux_sync.py sync --mapping-id <uuid>

    # Full sync (all tasks, not just changes)
    python scripts/dalux_sync.py sync --mapping-id <uuid> --full

    # List all sync mappings
    python scripts/dalux_sync.py list

    # Show sync status
    python scripts/dalux_sync.py status --mapping-id <uuid>

    # Test Dalux connection
    python scripts/dalux_sync.py test --api-key <key> --base-url <url>

    # Create new sync mapping
    python scripts/dalux_sync.py create \\
        --project-id <internal_id> \\
        --dalux-project-id <dalux_id> \\
        --dalux-api-key <key> \\
        --dalux-base-url <url> \\
        --catenda-project-id <catenda_id> \\
        --catenda-board-id <board_id>
"""

import argparse
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv

# Load environment variables
load_dotenv()

from integrations.dalux import DaluxClient, DaluxAuthError, DaluxAPIError
from services.dalux_sync_service import DaluxSyncService, create_dalux_sync_service
from repositories.sync_mapping_repository import create_sync_mapping_repository
from models.sync_models import DaluxCatendaSyncMapping
from lib.catenda_factory import get_catenda_client
from utils.logger import get_logger

logger = get_logger(__name__)


def cmd_sync(args):
    """Run sync for a mapping."""
    mapping_id = args.mapping_id
    full_sync = args.full

    print(f"Loading sync mapping {mapping_id}...")

    try:
        sync_repo = create_sync_mapping_repository()
        mapping = sync_repo.get_sync_mapping(mapping_id)

        if not mapping:
            print(f"Error: Sync mapping {mapping_id} not found")
            return 1

        print(f"Dalux project: {mapping.dalux_project_id}")
        print(f"Catenda board: {mapping.catenda_board_id}")
        print(f"Sync mode: {'full' if full_sync else 'incremental'}")
        print()

        # Create clients
        dalux_client = DaluxClient(
            api_key=mapping.dalux_api_key,
            base_url=mapping.dalux_base_url
        )

        catenda_client = get_catenda_client()
        if not catenda_client:
            print("Error: Catenda client not configured. Check .env settings.")
            return 1

        # Create sync service and run
        sync_service = DaluxSyncService(dalux_client, catenda_client, sync_repo)
        result = sync_service.sync_project(mapping_id, full_sync=full_sync)

        # Print results
        print(f"\nSync completed: {result.status}")
        print(f"  Duration: {result.duration_seconds:.2f}s")
        print(f"  Tasks processed: {result.tasks_processed}")
        print(f"  Tasks created: {result.tasks_created}")
        print(f"  Tasks updated: {result.tasks_updated}")
        print(f"  Tasks skipped: {result.tasks_skipped}")
        print(f"  Tasks failed: {result.tasks_failed}")
        print(f"  Attachments synced: {result.attachments_synced}")

        if result.errors:
            print(f"\nErrors:")
            for error in result.errors[:10]:  # Show first 10 errors
                print(f"  - {error}")
            if len(result.errors) > 10:
                print(f"  ... and {len(result.errors) - 10} more")

        return 0 if result.success else 1

    except Exception as e:
        logger.exception(f"Sync failed: {e}")
        print(f"Error: {e}")
        return 1


def cmd_list(args):
    """List all sync mappings."""
    try:
        sync_repo = create_sync_mapping_repository()
        mappings = sync_repo.list_sync_mappings()

        if not mappings:
            print("No sync mappings found.")
            return 0

        print(f"Found {len(mappings)} sync mapping(s):\n")

        for m in mappings:
            status_icon = "+" if m.sync_enabled else "-"
            last_sync = m.last_sync_at.strftime("%Y-%m-%d %H:%M") if m.last_sync_at else "never"
            last_status = m.last_sync_status or "n/a"

            print(f"[{status_icon}] {m.id}")
            print(f"    Project: {m.project_id}")
            print(f"    Dalux: {m.dalux_project_id} @ {m.dalux_base_url}")
            print(f"    Catenda: board {m.catenda_board_id}")
            print(f"    Last sync: {last_sync} ({last_status})")
            print()

        return 0

    except Exception as e:
        print(f"Error: {e}")
        return 1


def cmd_status(args):
    """Show detailed status for a mapping."""
    mapping_id = args.mapping_id

    try:
        sync_repo = create_sync_mapping_repository()
        mapping = sync_repo.get_sync_mapping(mapping_id)

        if not mapping:
            print(f"Error: Sync mapping {mapping_id} not found")
            return 1

        print(f"Sync Mapping: {mapping.id}")
        print(f"  Enabled: {mapping.sync_enabled}")
        print(f"  Project ID: {mapping.project_id}")
        print()
        print("Dalux Configuration:")
        print(f"  Project ID: {mapping.dalux_project_id}")
        print(f"  Base URL: {mapping.dalux_base_url}")
        print(f"  API Key: {mapping.dalux_api_key[:10]}...")
        print()
        print("Catenda Configuration:")
        print(f"  Project ID: {mapping.catenda_project_id}")
        print(f"  Board ID: {mapping.catenda_board_id}")
        print()
        print("Sync Status:")
        print(f"  Last Sync: {mapping.last_sync_at or 'never'}")
        print(f"  Last Status: {mapping.last_sync_status or 'n/a'}")
        if mapping.last_sync_error:
            print(f"  Last Error: {mapping.last_sync_error}")
        print()

        # Count synced tasks
        records = sync_repo.list_task_sync_records(mapping_id)
        synced = len([r for r in records if r.sync_status == "synced"])
        failed = len([r for r in records if r.sync_status == "failed"])
        pending = len([r for r in records if r.sync_status == "pending"])

        print("Task Sync Records:")
        print(f"  Total: {len(records)}")
        print(f"  Synced: {synced}")
        print(f"  Failed: {failed}")
        print(f"  Pending: {pending}")

        return 0

    except Exception as e:
        print(f"Error: {e}")
        return 1


def cmd_test(args):
    """Test Dalux connection."""
    api_key = args.api_key
    base_url = args.base_url

    print(f"Testing connection to {base_url}...")

    try:
        client = DaluxClient(api_key, base_url)

        if client.health_check():
            print("Connection successful!")
            print()

            projects = client.get_projects()
            print(f"Found {len(projects)} accessible project(s):")
            for p in projects:
                data = p.get("data", {})
                print(f"  - {data.get('projectName')} (ID: {data.get('projectId')})")

            return 0
        else:
            print("Connection failed. Check API key and base URL.")
            return 1

    except DaluxAuthError as e:
        print(f"Authentication failed: {e}")
        return 1
    except DaluxAPIError as e:
        print(f"API error: {e}")
        return 1
    except Exception as e:
        print(f"Error: {e}")
        return 1


def cmd_create(args):
    """Create a new sync mapping."""
    try:
        sync_repo = create_sync_mapping_repository()

        # Validate Dalux connection first
        print("Validating Dalux connection...")
        dalux_client = DaluxClient(args.dalux_api_key, args.dalux_base_url)
        if not dalux_client.health_check():
            print("Error: Dalux API key is invalid or expired")
            return 1

        # Check project exists
        projects = dalux_client.get_projects()
        project_ids = [p.get("data", {}).get("projectId") for p in projects]
        if args.dalux_project_id not in project_ids:
            print(f"Warning: Dalux project {args.dalux_project_id} not in accessible projects: {project_ids}")

        # Create mapping
        mapping = DaluxCatendaSyncMapping(
            project_id=args.project_id,
            dalux_project_id=args.dalux_project_id,
            dalux_api_key=args.dalux_api_key,
            dalux_base_url=args.dalux_base_url,
            catenda_project_id=args.catenda_project_id,
            catenda_board_id=args.catenda_board_id,
            sync_enabled=True,
        )

        mapping_id = sync_repo.create_sync_mapping(mapping)
        print(f"Created sync mapping: {mapping_id}")
        return 0

    except Exception as e:
        print(f"Error: {e}")
        return 1


def main():
    parser = argparse.ArgumentParser(
        description="Dalux → Catenda sync CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )

    subparsers = parser.add_subparsers(dest="command", help="Command to run")

    # sync command
    sync_parser = subparsers.add_parser("sync", help="Run sync for a mapping")
    sync_parser.add_argument("--mapping-id", "-m", required=True, help="Sync mapping UUID")
    sync_parser.add_argument("--full", "-f", action="store_true", help="Full sync (not incremental)")

    # list command
    subparsers.add_parser("list", help="List all sync mappings")

    # status command
    status_parser = subparsers.add_parser("status", help="Show status for a mapping")
    status_parser.add_argument("--mapping-id", "-m", required=True, help="Sync mapping UUID")

    # test command
    test_parser = subparsers.add_parser("test", help="Test Dalux connection")
    test_parser.add_argument("--api-key", "-k", required=True, help="Dalux API key")
    test_parser.add_argument("--base-url", "-u", required=True, help="Dalux API base URL")

    # create command
    create_parser = subparsers.add_parser("create", help="Create a new sync mapping")
    create_parser.add_argument("--project-id", required=True, help="Internal project ID")
    create_parser.add_argument("--dalux-project-id", required=True, help="Dalux project ID")
    create_parser.add_argument("--dalux-api-key", required=True, help="Dalux API key")
    create_parser.add_argument("--dalux-base-url", required=True, help="Dalux API base URL")
    create_parser.add_argument("--catenda-project-id", required=True, help="Catenda project ID")
    create_parser.add_argument("--catenda-board-id", required=True, help="Catenda board ID")

    args = parser.parse_args()

    if args.command is None:
        parser.print_help()
        return 0

    # Dispatch to command handler
    commands = {
        "sync": cmd_sync,
        "list": cmd_list,
        "status": cmd_status,
        "test": cmd_test,
        "create": cmd_create,
    }

    handler = commands.get(args.command)
    if handler:
        return handler(args)
    else:
        parser.print_help()
        return 1


if __name__ == "__main__":
    sys.exit(main())
