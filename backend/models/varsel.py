"""
Varsel (notification) domain model.

⚠️ DEPRECATED - This model is deprecated and will be removed.
Use Event Sourcing models instead:
- models.events.GrunnlagEvent for notification/grunnlag events
- models.events.GrunnlagData for grunnlag data

This file is kept temporarily for data migration purposes only.
DO NOT USE in new code.
"""
import warnings
from pydantic import BaseModel, Field, field_validator
from typing import Optional
from datetime import datetime

# Emit deprecation warning when module is imported
warnings.warn(
    "models.varsel is deprecated. Use models.events.GrunnlagEvent instead.",
    DeprecationWarning,
    stacklevel=2
)


class Varsel(BaseModel):
    """
    Varsel (notification) domain model.

    Represents a notification about a discovered issue that requires
    handling through the KOE process.

    Uses Pydantic v2 for:
    - Automatic type validation
    - JSON serialization/deserialization
    - Azure Functions compatibility
    """
    dato_forhold_oppdaget: str = Field(
        ...,
        description="Date when issue was discovered (ISO format YYYY-MM-DD)"
    )
    hovedkategori: str = Field(
        ...,
        min_length=1,
        description="Main category of the issue"
    )
    underkategori: str = Field(
        ...,
        min_length=1,
        description="Subcategory of the issue"
    )
    varsel_beskrivelse: str = Field(
        ...,
        min_length=1,
        description="Description of the notification"
    )
    dato_varsel_sendt: Optional[str] = Field(
        default=None,
        description="Date notification was sent (ISO format YYYY-MM-DD)"
    )

    @field_validator('dato_forhold_oppdaget', 'dato_varsel_sendt')
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
    def from_form_data(cls, form_data: dict, auto_populate_sent_date: bool = True) -> 'Varsel':
        """
        Create Varsel from frontend form data with automatic validation.

        Args:
            form_data: Form data from frontend
            auto_populate_sent_date: If True, auto-set dato_varsel_sendt to today

        Returns:
            Validated Varsel instance

        Raises:
            ValidationError: If form data is invalid
        """
        varsel_data = form_data.get('varsel', {})

        # Auto-populate sent date if requested and not already set
        dato_varsel_sendt = varsel_data.get('dato_varsel_sendt')
        if auto_populate_sent_date and not dato_varsel_sendt:
            dato_varsel_sendt = datetime.now().strftime('%Y-%m-%d')

        return cls(
            dato_forhold_oppdaget=varsel_data.get('dato_forhold_oppdaget', ''),
            hovedkategori=varsel_data.get('hovedkategori', ''),
            underkategori=varsel_data.get('underkategori', ''),
            varsel_beskrivelse=varsel_data.get('varsel_beskrivelse', ''),
            dato_varsel_sendt=dato_varsel_sendt
        )

    def to_dict(self) -> dict:
        """
        Convert to dictionary for JSON storage.

        Returns:
            Dictionary representation
        """
        return self.model_dump(exclude_none=False)

    # Pydantic v2 configuration
    model_config = {
        "json_schema_extra": {
            "examples": [{
                "dato_forhold_oppdaget": "2025-11-20",
                "hovedkategori": "Risiko",
                "underkategori": "Grunnforhold",
                "varsel_beskrivelse": "Beskrivelse av oppdaget forhold som kan medføre KOE",
                "dato_varsel_sendt": "2025-11-27"
            }]
        }
    }
