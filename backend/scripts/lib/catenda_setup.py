"""
Catenda Script Setup Utilities

Shared utilities for scripts that interact with the Catenda API.
Reduces duplication across test_full_flow.py, catenda_menu.py, and similar scripts.
"""

import sys
from pathlib import Path
from typing import Optional, TYPE_CHECKING

from dotenv import load_dotenv

if TYPE_CHECKING:
    from integrations.catenda.client import CatendaClient


def setup_script_path() -> Path:
    """
    Set up Python path for scripts in the scripts/ directory.

    Call this at the top of any script that needs to import from the parent directory.
    Also loads .env file from the backend directory.

    Returns:
        Path to the backend directory

    Usage:
        from scripts.lib.catenda_setup import setup_script_path
        backend_dir = setup_script_path()
    """
    backend_dir = Path(__file__).parent.parent.parent
    sys.path.insert(0, str(backend_dir))

    # Load .env
    env_path = backend_dir / ".env"
    load_dotenv(env_path)

    return backend_dir


def create_authenticated_client(
    use_access_token: bool = True,
    authenticate_if_needed: bool = True
) -> Optional["CatendaClient"]:
    """
    Create an authenticated CatendaClient instance from settings.

    Args:
        use_access_token: If True, use access token from settings if available
        authenticate_if_needed: If True, call authenticate() when no token is available

    Returns:
        Authenticated CatendaClient instance, or None if authentication fails

    Usage:
        client = create_authenticated_client()
        if client is None:
            print("Could not authenticate")
            sys.exit(1)
    """
    from core.config import settings
    from integrations.catenda import CatendaClient

    if not settings.catenda_client_id:
        print_fail("CATENDA_CLIENT_ID mangler i .env")
        print_info("Kjor: python scripts/setup_authentication.py")
        return None

    client = CatendaClient(
        client_id=settings.catenda_client_id,
        client_secret=settings.catenda_client_secret
    )

    # Set topic board if configured
    if settings.catenda_topic_board_id:
        client.topic_board_id = settings.catenda_topic_board_id

    # Try access token first
    if use_access_token and settings.catenda_access_token:
        print_info("Bruker lagret access token fra .env")
        client.set_access_token(settings.catenda_access_token)
        return client

    # Try client credentials authentication
    if authenticate_if_needed and settings.catenda_client_secret:
        print_info("Autentiserer med Client Credentials...")
        if not client.authenticate():
            print_fail("Autentisering feilet")
            return None
        print_ok("Autentisering vellykket!")
        return client

    print_fail("Ingen access token eller client secret funnet")
    print_info("Kjor: python scripts/setup_authentication.py")
    return None


def select_topic_board(
    client: "CatendaClient",
    auto_select_single: bool = True
) -> Optional[str]:
    """
    Interactive selection of topic board from available boards.

    Args:
        client: Authenticated CatendaClient instance
        auto_select_single: If True, automatically select if only one board available

    Returns:
        Selected topic board ID, or None if selection failed/cancelled

    Usage:
        topic_board_id = select_topic_board(client)
        if topic_board_id:
            client.topic_board_id = topic_board_id
    """
    print_info("Henter tilgjengelige topic boards...")
    boards = client.list_topic_boards()

    if not boards:
        print_fail("Fant ingen topic boards")
        return None

    print_ok(f"Fant {len(boards)} topic board(s):")
    for i, board in enumerate(boards, 1):
        print(f"  {i}. {board['name']} (ID: {board['project_id']})")

    # Auto-select if only one board
    if auto_select_single and len(boards) == 1:
        selected = boards[0]
        print_info(f"Velger eneste tilgjengelige: {selected['name']}")
        return selected['project_id']

    # Interactive selection
    while True:
        try:
            choice = input(f"\nVelg topic board (1-{len(boards)}): ").strip()
            idx = int(choice) - 1
            if 0 <= idx < len(boards):
                selected = boards[idx]
                print_ok(f"Valgte: {selected['name']}")
                return selected['project_id']
            else:
                print_warn(f"Ugyldig valg. Velg mellom 1 og {len(boards)}")
        except ValueError:
            print_warn("Ugyldig input. Oppgi et tall.")
        except KeyboardInterrupt:
            print("\nAvbrutt")
            return None


def select_project(client: "CatendaClient") -> Optional[str]:
    """
    Interactive selection of project from available projects.

    Args:
        client: Authenticated CatendaClient instance

    Returns:
        Selected project ID, or None if selection failed/cancelled
    """
    from core.config import settings

    print_info("Henter tilgjengelige prosjekter...")
    projects = client.list_projects()

    if not projects:
        print_fail("Fant ingen prosjekter")
        return None

    current_project_id = settings.catenda_project_id

    print_ok(f"Fant {len(projects)} prosjekt(er):")
    for i, project in enumerate(projects, 1):
        marker = "[*]" if project.get('id') == current_project_id else "[ ]"
        print(f"  {i}. {marker} {project.get('name')} ({project.get('id')})")

    # If we have a configured project, offer to use it
    if current_project_id:
        print_info(f"\nForhandsvalgt prosjekt fra .env: {current_project_id}")
        response = input("Bruk dette prosjektet? [J/n]: ").strip().lower()
        if response != 'n':
            return current_project_id

    # Interactive selection
    while True:
        try:
            choice = input(f"\nVelg prosjektnummer (1-{len(projects)}): ").strip()
            idx = int(choice) - 1
            if 0 <= idx < len(projects):
                selected = projects[idx]
                print_ok(f"Valgte: {selected.get('name')}")
                return selected['id']
            else:
                print_warn(f"Ugyldig valg. Velg mellom 1 og {len(projects)}")
        except ValueError:
            print_warn("Ugyldig input. Oppgi et tall.")
        except KeyboardInterrupt:
            print("\nAvbrutt")
            return None


# =============================================================================
# Console Output Helpers
# =============================================================================

def print_header(title: str):
    """Print formatted header."""
    print("\n" + "=" * 70)
    print(f"  {title}")
    print("=" * 70 + "\n")


def print_subheader(title: str):
    """Print formatted subheader."""
    print(f"\n--- {title} ---\n")


def print_ok(message: str):
    """Print OK/success message."""
    print(f"  [OK] {message}")


def print_fail(message: str):
    """Print failure message."""
    print(f"  [FEIL] {message}")


def print_warn(message: str):
    """Print warning message."""
    print(f"  [!] {message}")


def print_info(message: str):
    """Print info message."""
    print(f"  {message}")


def confirm(prompt: str, default: bool = True) -> bool:
    """
    Ask user for confirmation.

    Args:
        prompt: The question to ask
        default: Default answer if user just presses Enter

    Returns:
        True if user confirmed, False otherwise
    """
    suffix = "[J/n]" if default else "[j/N]"
    try:
        response = input(f"\n{prompt} {suffix}: ").strip().lower()
        if not response:
            return default
        return response in ('j', 'ja', 'y', 'yes')
    except KeyboardInterrupt:
        print("\nAvbrutt")
        return False
