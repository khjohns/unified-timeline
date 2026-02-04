"""
Tests for core configuration.

Verifiserer at Settings:
- Laster Azure-konfigurasjon med riktige defaults
- is_azure_environment returnerer korrekt verdi
- is_catenda_enabled auto-deteksjon og eksplisitt konfigurasjon
"""

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
        settings = Settings(
            azure_sql_connection="Server=tcp:myserver.database.windows.net"
        )
        assert settings.is_azure_environment is True


class TestCatendaConfig:
    """Test suite for Catenda configuration."""

    def test_catenda_disabled_by_default_without_credentials(self):
        """is_catenda_enabled should be False when no credentials are set."""
        settings = Settings()
        assert settings.is_catenda_enabled is False

    def test_catenda_auto_enabled_with_credentials(self):
        """is_catenda_enabled should be True when credentials are set and catenda_enabled is not explicit."""
        settings = Settings(
            catenda_client_id="my-client-id",
            catenda_client_secret="my-secret",
            catenda_enabled="",  # Empty = auto-detect based on credentials
        )
        assert settings.is_catenda_enabled is True

    def test_catenda_explicit_disable_overrides_credentials(self):
        """catenda_enabled=false should disable even with credentials."""
        settings = Settings(
            catenda_client_id="my-client-id",
            catenda_client_secret="my-secret",
            catenda_enabled="false",
        )
        assert settings.is_catenda_enabled is False

    def test_catenda_explicit_enable_without_credentials(self):
        """catenda_enabled=true should enable even without credentials."""
        settings = Settings(catenda_enabled="true")
        assert settings.is_catenda_enabled is True

    def test_catenda_enabled_case_insensitive(self):
        """catenda_enabled should be case-insensitive."""
        settings1 = Settings(catenda_enabled="FALSE")
        assert settings1.is_catenda_enabled is False

        settings2 = Settings(catenda_enabled="True")
        assert settings2.is_catenda_enabled is True
