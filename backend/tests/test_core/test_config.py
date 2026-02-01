"""
Tests for core configuration.

Verifiserer at Settings:
- Laster Azure-konfigurasjon med riktige defaults
- is_azure_environment returnerer korrekt verdi
"""
import pytest
from core.config import Settings


class TestAzureConfig:
    """Test suite for Azure configuration fields."""

    def test_azure_fields_have_defaults(self):
        """Azure fields should have sensible defaults."""
        settings = Settings()

        # Storage
        assert settings.azure_storage_account == ""
        assert settings.azure_storage_key == ""
        assert settings.azure_storage_container == "koe-documents"

        # Service Bus
        assert settings.azure_service_bus_connection == ""
        assert settings.azure_queue_name == "koe-events"

        # SQL
        assert settings.azure_sql_connection == ""

        # Key Vault
        assert settings.azure_keyvault_url == ""

    def test_is_azure_environment_false_by_default(self):
        """is_azure_environment should be False when no Azure config is set."""
        settings = Settings()
        assert settings.is_azure_environment is False

    def test_is_azure_environment_true_with_keyvault(self):
        """is_azure_environment should be True when Key Vault URL is set."""
        settings = Settings(azure_keyvault_url="https://myvault.vault.azure.net/")
        assert settings.is_azure_environment is True

    def test_is_azure_environment_true_with_sql(self):
        """is_azure_environment should be True when SQL connection is set."""
        settings = Settings(azure_sql_connection="Server=tcp:myserver.database.windows.net")
        assert settings.is_azure_environment is True
