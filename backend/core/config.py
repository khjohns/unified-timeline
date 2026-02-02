"""
Centralized configuration for KOE Automation System.

All environment variables are loaded here using Pydantic Settings.
This provides type validation and automatic .env file loading.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables.

    Pydantic-settings v2 automatically loads from .env files.
    Field names are automatically mapped to environment variables (case-insensitive).
    """
    # Catenda API credentials
    catenda_client_id: str = ""
    catenda_client_secret: str = ""
    catenda_project_id: str = ""
    catenda_organization_id: str = ""
    catenda_library_id: str = ""
    catenda_folder_id: str = ""
    catenda_topic_board_id: str = ""

    # Catenda OAuth tokens (generert av setup_authentication.py)
    catenda_access_token: str = ""
    catenda_refresh_token: str = ""
    catenda_redirect_uri: str = "http://localhost:8080/callback"

    # Catenda integration toggle (auto-detected if not explicitly set)
    # Set to "false" to disable Catenda integration even if credentials exist
    catenda_enabled: str = ""  # "", "true", "false"

    @property
    def is_catenda_enabled(self) -> bool:
        """
        Check if Catenda integration is enabled.

        Logic:
        - If catenda_enabled is explicitly "false" → disabled
        - If catenda_enabled is explicitly "true" → enabled
        - Otherwise, auto-detect based on credentials
        """
        if self.catenda_enabled.lower() == "false":
            return False
        if self.catenda_enabled.lower() == "true":
            return True
        # Auto-detect: enabled if we have client credentials
        return bool(self.catenda_client_id and self.catenda_client_secret)

    # Dalux API
    dalux_api_key: str = ""
    dalux_base_url: str = ""
    dalux_enabled: str = ""  # "", "true", "false"

    @property
    def is_dalux_enabled(self) -> bool:
        """
        Check if Dalux integration is enabled.

        Logic:
        - If dalux_enabled is explicitly "false" → disabled
        - If dalux_enabled is explicitly "true" → enabled
        - Otherwise, auto-detect based on API key
        """
        if self.dalux_enabled.lower() == "false":
            return False
        if self.dalux_enabled.lower() == "true":
            return True
        # Auto-detect: enabled if we have API key
        return bool(self.dalux_api_key)

    # Frontend URL (for magic links i Catenda-kommentarer)
    react_app_url: str = ""
    dev_react_app_url: str = ""

    # Dataverse (for production)
    dataverse_url: str = ""
    repository_type: str = "csv"  # "csv" for local dev, "dataverse" for production

    # Security
    webhook_secret_path: str = ""
    csrf_secret_key: str = "dev-secret-key-change-in-production"

    # Flask
    flask_host: str = "0.0.0.0"
    flask_port: int = 8080
    flask_debug: bool = False  # Sett FLASK_DEBUG=true i .env for lokal utvikling

    # CORS
    cors_origins: str = "http://localhost:3000"  # Comma-separated list

    # Rate limiting
    rate_limit_per_day: str = "200 per day"
    rate_limit_per_hour: str = "50 per hour"

    # Data storage
    data_dir: str = "koe_data"

    # Logging
    log_level: str = "INFO"
    log_format: str = "json"  # "json" or "text"

    # Azure Storage (for document storage)
    azure_storage_account: str = ""
    azure_storage_key: str = ""
    azure_storage_container: str = "koe-documents"

    # Azure Service Bus (for background tasks)
    azure_service_bus_connection: str = ""
    azure_queue_name: str = "koe-events"

    # Azure SQL (for production database)
    azure_sql_connection: str = ""

    # Azure Key Vault (for secrets management)
    azure_keyvault_url: str = ""

    # Entra ID / IDA (Oslo kommunes identitetstjeneste)
    entra_enabled: bool = False  # Sett True når IDA er konfigurert
    entra_tenant_id: str = ""  # Azure AD tenant ID fra IDA
    entra_client_id: str = ""  # Application (client) ID fra IDA
    entra_issuer: str = ""  # Overstyr issuer URL (valgfritt)

    @property
    def entra_issuer_url(self) -> str:
        """Returner Entra ID issuer URL."""
        if self.entra_issuer:
            return self.entra_issuer
        if self.entra_tenant_id:
            return f"https://login.microsoftonline.com/{self.entra_tenant_id}/v2.0"
        return ""

    @property
    def entra_jwks_url(self) -> str:
        """Returner Entra ID JWKS URL for token-validering."""
        if self.entra_tenant_id:
            return f"https://login.microsoftonline.com/{self.entra_tenant_id}/discovery/v2.0/keys"
        return ""

    @property
    def is_azure_environment(self) -> bool:
        """Check if running in Azure environment."""
        return bool(self.azure_keyvault_url or self.azure_sql_connection)

    def get_catenda_config(self) -> dict:
        """Returner Catenda-konfigurasjon som dict (for bakoverkompatibilitet)."""
        return {
            'catenda_client_id': self.catenda_client_id,
            'catenda_client_secret': self.catenda_client_secret,
            'catenda_project_id': self.catenda_project_id,
            'catenda_library_id': self.catenda_library_id,
            'catenda_folder_id': self.catenda_folder_id,
            'catenda_topic_board_id': self.catenda_topic_board_id,
            'catenda_access_token': self.catenda_access_token,
            'catenda_refresh_token': self.catenda_refresh_token,
            'catenda_redirect_uri': self.catenda_redirect_uri,
            'data_dir': self.data_dir,
            'react_app_url': self.react_app_url or self.dev_react_app_url,
        }

    # Pydantic v2 configuration (replaces class Config)
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",  # Ignore extra env vars
        case_sensitive=False  # Case-insensitive env var matching
    )


# Global settings instance
settings = Settings()
