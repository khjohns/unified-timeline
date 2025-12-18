"""
Centralized configuration for KOE Automation System.

All environment variables are loaded here using Pydantic Settings.
This provides type validation and automatic .env file loading.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional


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
    flask_debug: bool = True

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
