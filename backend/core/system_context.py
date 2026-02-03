"""
System Context Module

Provides simplified system context for legacy route compatibility.
"""

import logging
from typing import TYPE_CHECKING, Any

from core.config import settings
from integrations.catenda import CatendaClient
from repositories.csv_repository import CSVRepository
from utils.network import get_local_ip

# Forward declaration for type hinting
if TYPE_CHECKING:
    from lib.auth.magic_link import MagicLinkManager


logger = logging.getLogger(__name__)


class SystemContext:
    """
    Simplified system context for legacy route compatibility.

    Provides access to:
    - db: CSVRepository (data access)
    - catenda: CatendaClient (Catenda API integration)
    - magic_links: MagicLinkManager (singleton instance)
    - get_react_app_base_url(): React app URL helper

    Note: Webhook handlers moved to services/webhook_service.py
    Future refactoring should migrate routes to use service layer directly.
    """

    def __init__(self, config: dict[str, Any], magic_link_manager: "MagicLinkManager"):
        self.config = config
        self.db = CSVRepository(config.get("data_dir", "koe_data"))
        self.catenda = CatendaClient(
            client_id=config["catenda_client_id"],
            client_secret=config.get("catenda_client_secret"),
        )
        self.magic_links = magic_link_manager

        if not self._authenticate():
            logger.warning("Kunne ikke autentisere mot Catenda ved oppstart")

    def _authenticate(self) -> bool:
        """Enkel autentisering med lagret token eller client credentials"""
        access_token = self.config.get("catenda_access_token")
        if access_token:
            self.catenda.set_access_token(access_token)
            return True
        if self.config.get("catenda_client_secret"):
            return self.catenda.authenticate()
        return False

    def get_react_app_base_url(self) -> str:
        """Determines the correct base URL for the React application."""
        if settings.dev_react_app_url:
            return settings.dev_react_app_url
        if settings.react_app_url:
            return settings.react_app_url
        if "react_app_url" in self.config and self.config["react_app_url"]:
            return self.config["react_app_url"]

        # Fallback: localhost
        local_ip = get_local_ip()
        return f"http://{local_ip}:3000"
