"""
Sak (case) domain model.

⚠️ DEPRECATED - This model is deprecated and will be removed.
Use Event Sourcing models instead:
- models.events.SakOpprettetEvent for case creation
- models.sak_state.SakState for computed state

This file is kept temporarily for data migration purposes only.
DO NOT USE in new code.
"""
import warnings
from pydantic import BaseModel, Field, field_validator
from typing import Optional
from datetime import datetime

# Emit deprecation warning when module is imported
warnings.warn(
    "models.sak is deprecated. Use models.events (Event Sourcing) instead.",
    DeprecationWarning,
    stacklevel=2
)


class Sak(BaseModel):
    """
    Sak (case) domain model.

    Represents a KOE case that tracks the entire workflow:
    - Varsel (notification) → KOE (change order) → Svar (response)

    Uses Pydantic v2 for:
    - Automatic type validation
    - JSON serialization/deserialization
    - Azure Functions compatibility
    """
    sak_id: str = Field(
        ...,
        description="Unique case identifier (e.g., KOE-20251130-123456)"
    )
    sakstittel: str = Field(
        ...,
        min_length=1,
        description="Case title/description"
    )
    status: str = Field(
        ...,
        description="Current case status (from SAK_STATUS constants)"
    )
    modus: Optional[str] = Field(
        default=None,
        description="Current workflow mode (varsel, koe, svar, revidering)"
    )
    rolle: Optional[str] = Field(
        default='TE',
        description="User role (TE=Totalentreprenør, BH=Byggherre)"
    )

    # Catenda integration
    catenda_topic_id: Optional[str] = Field(
        default=None,
        description="Catenda topic/issue GUID"
    )
    catenda_project_id: Optional[str] = Field(
        default=None,
        description="Catenda project ID (v2 API)"
    )
    catenda_board_id: Optional[str] = Field(
        default=None,
        description="Catenda topic board ID"
    )

    # Metadata
    opprettet_dato: Optional[str] = Field(
        default=None,
        description="Date case was created (ISO format YYYY-MM-DD)"
    )
    opprettet_av: Optional[str] = Field(
        default=None,
        description="User who created the case"
    )

    # Parties involved
    te_navn: Optional[str] = Field(
        default=None,
        description="Name of contractor (Totalentreprenør)"
    )
    byggherre: Optional[str] = Field(
        default='Ikke spesifisert',
        description="Name of client (Byggherre)"
    )
    entreprenor: Optional[str] = Field(
        default='Ikke spesifisert',
        description="Name of contractor company"
    )
    prosjekt_navn: Optional[str] = Field(
        default='Ukjent prosjekt',
        description="Project name"
    )

    @field_validator('opprettet_dato')
    @classmethod
    def validate_date_format(cls, v):
        """Validate that date strings are in ISO format (YYYY-MM-DD)"""
        if v:
            try:
                # Parse to ensure it's a valid date
                datetime.fromisoformat(v)
            except ValueError:
                raise ValueError(
                    f"Invalid date format: {v}. Expected ISO format (YYYY-MM-DD)"
                )
        return v

    @classmethod
    def from_form_data(cls, form_data: dict) -> 'Sak':
        """
        Create Sak from frontend form data with automatic validation.

        Args:
            form_data: Form data from frontend

        Returns:
            Validated Sak instance

        Raises:
            ValidationError: If form data is invalid
        """
        sak_data = form_data.get('sak', {})

        return cls(
            sak_id=sak_data.get('sak_id', ''),
            sakstittel=sak_data.get('sakstittel', ''),
            status=sak_data.get('status', ''),
            modus=sak_data.get('modus'),
            rolle=sak_data.get('rolle', 'TE'),
            catenda_topic_id=sak_data.get('catenda_topic_id'),
            catenda_project_id=sak_data.get('catenda_project_id'),
            catenda_board_id=sak_data.get('catenda_board_id'),
            opprettet_dato=sak_data.get('opprettet_dato'),
            opprettet_av=sak_data.get('opprettet_av'),
            te_navn=sak_data.get('te_navn'),
            byggherre=sak_data.get('byggherre', 'Ikke spesifisert'),
            entreprenor=sak_data.get('entreprenor', 'Ikke spesifisert'),
            prosjekt_navn=sak_data.get('prosjekt_navn', 'Ukjent prosjekt')
        )

    @classmethod
    def create_from_webhook(
        cls,
        sak_id: str,
        catenda_topic_id: str,
        sakstittel: str,
        status: str,
        catenda_project_id: Optional[str] = None,
        catenda_board_id: Optional[str] = None,
        te_navn: Optional[str] = None,
        byggherre: str = 'Ikke spesifisert',
        entreprenor: str = 'Ikke spesifisert',
        prosjekt_navn: str = 'Ukjent prosjekt'
    ) -> 'Sak':
        """
        Create Sak from webhook data (used by WebhookService).

        Args:
            sak_id: Generated case ID
            catenda_topic_id: Catenda topic GUID
            sakstittel: Case title from Catenda
            status: Initial status
            catenda_project_id: Catenda project ID
            catenda_board_id: Catenda board ID
            te_navn: Contractor name
            byggherre: Client name
            entreprenor: Contractor company name
            prosjekt_navn: Project name

        Returns:
            Validated Sak instance
        """
        return cls(
            sak_id=sak_id,
            sakstittel=sakstittel,
            status=status,
            modus='varsel',  # Initial mode
            rolle='TE',  # Default role
            catenda_topic_id=catenda_topic_id,
            catenda_project_id=catenda_project_id,
            catenda_board_id=catenda_board_id,
            opprettet_dato=datetime.now().strftime('%Y-%m-%d'),
            opprettet_av=te_navn,
            te_navn=te_navn,
            byggherre=byggherre,
            entreprenor=entreprenor,
            prosjekt_navn=prosjekt_navn
        )

    def to_dict(self) -> dict:
        """
        Convert to dictionary for JSON storage.

        Returns:
            Dictionary representation
        """
        return self.model_dump(exclude_none=False)

    def to_csv_row(self) -> dict:
        """
        Convert to CSV row format (matches CSVRepository.SAKER_FIELDNAMES).

        Returns:
            Dictionary with CSV field names
        """
        return {
            'sak_id': self.sak_id,
            'catenda_topic_id': self.catenda_topic_id or '',
            'catenda_project_id': self.catenda_project_id or '',
            'catenda_board_id': self.catenda_board_id or '',
            'sakstittel': self.sakstittel,
            'opprettet_dato': self.opprettet_dato or '',
            'opprettet_av': self.opprettet_av or '',
            'status': self.status,
            'te_navn': self.te_navn or '',
            'modus': self.modus or '',
            'byggherre': self.byggherre,
            'entreprenor': self.entreprenor,
            'prosjekt_navn': self.prosjekt_navn
        }

    # Pydantic v2 configuration
    model_config = {
        "json_schema_extra": {
            "examples": [{
                "sak_id": "KOE-20251130-123456",
                "sakstittel": "Grunnforhold avviker fra prosjektert",
                "status": "100000000",
                "modus": "varsel",
                "rolle": "TE",
                "catenda_topic_id": "abc-123-def-456",
                "catenda_project_id": "project-789",
                "catenda_board_id": "board-012",
                "opprettet_dato": "2025-11-30",
                "opprettet_av": "John Doe",
                "te_navn": "John Doe",
                "byggherre": "Oslo Kommune",
                "entreprenor": "Byggfirma AS",
                "prosjekt_navn": "Nybygg Skole"
            }]
        }
    }
