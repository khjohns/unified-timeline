"""
API validators integrating backend constants.

Validates event data against NS 8407 constants before persistence.
These validators are called BEFORE parse_event_from_request() to ensure
data integrity at the API boundary.
"""
from typing import Dict, Any, Optional
from models.events import (
    VederlagsMetode,
    FristVarselType,
)
from constants import (
    validate_kategori_kombinasjon,
    get_vederlag_metode,
    get_underkategorier_for_hovedkategori,
    get_alle_hovedkategorier,
)


class ValidationError(Exception):
    """
    Custom exception for validation errors with helpful context.

    Attributes:
        message: Human-readable error message
        valid_options: Dict of valid options for the failed field
        field: The field that failed validation
    """
    def __init__(
        self,
        message: str,
        valid_options: Optional[Dict[str, Any]] = None,
        field: Optional[str] = None
    ):
        super().__init__(message)
        self.message = message
        self.valid_options = valid_options or {}
        self.field = field

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dict for JSON response."""
        result = {"message": self.message}
        if self.valid_options:
            result["valid_options"] = self.valid_options
        if self.field:
            result["field"] = self.field
        return result


# ============================================================================
# Shared helper functions (reduces cyclomatic complexity)
# ============================================================================

def _validate_varsel_requirement(
    data: Dict[str, Any],
    flag_key: str,
    varsel_key: str,
    error_message: str
) -> None:
    """
    Validate that a varsel (notice) is present and has required fields when flag is set.

    This helper reduces repetitive validation patterns for NS 8407 varsel requirements.

    Args:
        data: The event data dict
        flag_key: The key that triggers varsel requirement (e.g., 'krever_regningsarbeid')
        varsel_key: The key for the varsel object (e.g., 'regningsarbeid_varsel')
        error_message: Error message if varsel is missing (should include hjemmel reference)

    Raises:
        ValidationError: If flag is set but varsel is missing or incomplete
    """
    if not data.get(flag_key):
        return

    if not data.get(varsel_key):
        raise ValidationError(error_message)

    varsel = data.get(varsel_key)
    if varsel and not varsel.get('dato_sendt'):
        raise ValidationError(f"{varsel_key} må ha dato_sendt")


def _normalize_to_upper(data: Dict[str, Any], *keys: str) -> None:
    """
    Normalize string fields to UPPERCASE in-place.

    Handles both single strings and lists of strings.

    Args:
        data: The event data dict (modified in-place)
        *keys: Field names to normalize

    Example:
        _normalize_to_upper(data, 'hovedkategori', 'metode')
        _normalize_to_upper(data, 'underkategori')  # handles list of strings
    """
    for key in keys:
        val = data.get(key)
        if isinstance(val, str):
            data[key] = val.upper()
        elif isinstance(val, list):
            data[key] = [v.upper() if isinstance(v, str) else v for v in val]


def _validate_hovedkategori(hovedkategori: Optional[str], required: bool = True) -> None:
    """
    Validate hovedkategori against valid options.

    Args:
        hovedkategori: The category to validate (may be None)
        required: If True, raises error when hovedkategori is missing

    Raises:
        ValidationError: If validation fails
    """
    valid_hovedkategorier = get_alle_hovedkategorier()

    if not hovedkategori:
        if required:
            raise ValidationError(
                "hovedkategori er påkrevd",
                valid_options={"hovedkategorier": valid_hovedkategorier},
                field="hovedkategori"
            )
        return  # Not required and not present - OK

    if hovedkategori not in valid_hovedkategorier:
        raise ValidationError(
            f"Ugyldig hovedkategori: {hovedkategori}",
            valid_options={"hovedkategorier": valid_hovedkategorier},
            field="hovedkategori"
        )


def _validate_underkategori(
    hovedkategori: str,
    underkategori: Any,
    required: bool = True
) -> None:
    """
    Validate underkategori(er) against hovedkategori.

    Handles both single string and list of strings.

    Args:
        hovedkategori: The parent category (must be valid)
        underkategori: Single string or list of strings to validate
        required: If True, raises error when underkategori is missing
                  (only for hovedkategorier that have underkategorier)

    Raises:
        ValidationError: If validation fails
    """
    valid_underkategorier = get_underkategorier_for_hovedkategori(hovedkategori)

    # Some hovedkategorier don't have underkategorier (e.g., Force Majeure)
    if not valid_underkategorier:
        return  # No underkategorier to validate

    if not underkategori:
        if required:
            raise ValidationError(
                "underkategori er påkrevd",
                valid_options={
                    "hovedkategori": hovedkategori,
                    "underkategorier": valid_underkategorier
                },
                field="underkategori"
            )
        return  # Not required and not present - OK

    # Validate each underkategori
    items = underkategori if isinstance(underkategori, list) else [underkategori]
    for uk in items:
        if not validate_kategori_kombinasjon(hovedkategori, uk):
            raise ValidationError(
                f"Ugyldig underkategori '{uk}' for hovedkategori '{hovedkategori}'",
                valid_options={
                    "hovedkategori": hovedkategori,
                    "underkategorier": valid_underkategorier
                },
                field="underkategori"
            )


def _validate_required_text_fields(data: Dict[str, Any]) -> None:
    """
    Validate required text fields for grunnlag create events.

    Args:
        data: Event data containing tittel, beskrivelse, dato_oppdaget

    Raises:
        ValidationError: If any required field is missing or invalid
    """
    tittel = data.get('tittel')
    if not tittel:
        raise ValidationError("tittel er påkrevd", field="tittel")
    if len(tittel) < 3:
        raise ValidationError("tittel må være minst 3 tegn", field="tittel")
    if len(tittel) > 100:
        raise ValidationError("tittel kan ikke være lengre enn 100 tegn", field="tittel")

    if not data.get('beskrivelse'):
        raise ValidationError("beskrivelse er påkrevd", field="beskrivelse")

    if not data.get('dato_oppdaget'):
        raise ValidationError("dato_oppdaget er påkrevd (format: YYYY-MM-DD)", field="dato_oppdaget")


def validate_grunnlag_event(data: Dict[str, Any], is_update: bool = False) -> None:
    """
    Validate grunnlag-event data against constants.

    Args:
        data: The 'data' field from a grunnlag event (modified in place to normalize casing)
        is_update: If True, only validate fields that are present (partial update)

    Raises:
        ValidationError: If validation fails (with valid_options when applicable)
    """
    if not data:
        raise ValidationError("Grunnlag data mangler")

    # Normalize casing to UPPERCASE (backend standard)
    _normalize_to_upper(data, 'hovedkategori', 'underkategori')

    hovedkategori = data.get('hovedkategori')
    underkategori = data.get('underkategori')

    if is_update:
        # For updates: only validate fields that are present
        _validate_hovedkategori(hovedkategori, required=False)
        if hovedkategori:
            _validate_underkategori(hovedkategori, underkategori, required=False)
        return

    # For create: all fields required
    _validate_hovedkategori(hovedkategori, required=True)
    _validate_underkategori(hovedkategori, underkategori, required=True)
    _validate_required_text_fields(data)


def validate_vederlag_event(data: Dict[str, Any]) -> None:
    """
    Validate vederlag-event data against constants.

    Works for both initial claims (vederlag_krav_sendt) and updates (vederlag_krav_oppdatert).
    Update events may use alternative field names:
    - nytt_belop_direkte instead of belop_direkte
    - nytt_kostnads_overslag instead of kostnads_overslag

    Args:
        data: The 'data' field from a vederlag event (modified in place to normalize casing)

    Raises:
        ValidationError: If validation fails (with valid_options when applicable)
    """
    if not data:
        raise ValidationError("Vederlag data mangler")

    # Normalize metode to UPPERCASE (backend standard)
    _normalize_to_upper(data, 'metode')
    metode = data.get('metode')

    valid_metoder = [m.value for m in VederlagsMetode]
    if not metode:
        raise ValidationError(
            "metode er påkrevd",
            valid_options={"metoder": valid_metoder},
            field="metode"
        )

    # Validate method exists
    metode_info = get_vederlag_metode(metode)
    if not metode_info:
        raise ValidationError(
            f"Ukjent vederlagsmetode: {metode}",
            valid_options={"metoder": valid_metoder},
            field="metode"
        )

    # Validate amount based on method
    # - ENHETSPRISER/FASTPRIS_TILBUD: require belop_direkte (can be negative for fradrag)
    # - REGNINGSARBEID: kostnads_overslag is optional (work not done yet = estimate)
    if metode in ['ENHETSPRISER', 'FASTPRIS_TILBUD']:
        belop_direkte = data.get('belop_direkte')
        if belop_direkte is None:
            raise ValidationError("belop_direkte er påkrevd for denne metoden")
    # Note: For REGNINGSARBEID, kostnads_overslag is optional per §30.2

    # Validate begrunnelse
    if not data.get('begrunnelse'):
        raise ValidationError("begrunnelse er påkrevd")

    # Validate NS 8407 specific warning requirements using shared helper
    _validate_varsel_requirement(
        data, 'krever_regningsarbeid', 'regningsarbeid_varsel',
        "Regningsarbeid krever varsel før oppstart (§30.1)"
    )
    _validate_varsel_requirement(
        data, 'inkluderer_rigg_drift', 'rigg_drift_varsel',
        "Rigg/drift-kostnader krever særskilt varsel (§34.1.3)"
    )
    _validate_varsel_requirement(
        data, 'krever_justert_ep', 'justert_ep_varsel',
        "Justerte enhetspriser krever varsel (§34.3.3)"
    )
    _validate_varsel_requirement(
        data, 'inkluderer_produktivitetstap', 'produktivitetstap_varsel',
        "Produktivitetstap krever særskilt varsel (§34.1.3, 2. ledd)"
    )


def validate_frist_event(data: Dict[str, Any], is_update: bool = False, is_specification: bool = False) -> None:
    """
    Validate frist-event data against constants.

    Works for initial claims (frist_krav_sendt), updates (frist_krav_oppdatert),
    and specification events (frist_krav_spesifisert).

    Update events have different requirements:
    - Don't require varsel_type (inherited from original)
    - Use nytt_antall_dager instead of antall_dager

    Specification events (§33.6.1/§33.6.2):
    - antall_dager must be > 0 (specifying days for neutral notice)
    - begrunnelse required

    Args:
        data: The 'data' field from a frist event
        is_update: True if this is an update event (frist_krav_oppdatert)
        is_specification: True if this is a specification event (frist_krav_spesifisert)

    Raises:
        ValidationError: If validation fails (with valid_options when applicable)
    """
    if not data:
        raise ValidationError("Frist data mangler")

    valid_varsel_types = [vt.value for vt in FristVarselType]

    # Specification events: TE specifies days for neutral notice (§33.6.1/§33.6.2)
    if is_specification:
        # Must have begrunnelse
        if not data.get('begrunnelse'):
            raise ValidationError("begrunnelse er påkrevd")

        # Must have antall_dager > 0 (actually specifying days)
        antall_dager = data.get('antall_dager')
        if antall_dager is None:
            raise ValidationError("antall_dager er påkrevd for spesifisering")

        if antall_dager <= 0:
            raise ValidationError("antall_dager må være > 0 for spesifisering")

        return  # Skip other validations

    # Update events have simplified validation (same field names as initial)
    if is_update:
        # Must have begrunnelse
        if not data.get('begrunnelse'):
            raise ValidationError("begrunnelse er påkrevd")

        # Must have antall_dager
        antall_dager = data.get('antall_dager')
        if antall_dager is None:
            raise ValidationError("antall_dager er påkrevd for oppdatering")

        # Validate non-negative
        if antall_dager < 0:
            raise ValidationError("antall_dager må være >= 0")

        return  # Skip initial claim validation for updates

    # Initial claim validation
    varsel_type = data.get('varsel_type')
    if not varsel_type:
        raise ValidationError(
            "varsel_type er påkrevd",
            valid_options={"varsel_typer": valid_varsel_types},
            field="varsel_type"
        )

    # Validate varsel type
    if varsel_type not in valid_varsel_types:
        raise ValidationError(
            f"Ugyldig varsel_type: {varsel_type}",
            valid_options={"varsel_typer": valid_varsel_types},
            field="varsel_type"
        )

    # Validate begrunnelse
    if not data.get('begrunnelse'):
        raise ValidationError("begrunnelse er påkrevd")

    # Validate required varsel info based on type
    if varsel_type == FristVarselType.VARSEL.value:
        if not data.get('frist_varsel'):
            raise ValidationError(
                "frist_varsel er påkrevd når varsel_type er 'varsel'"
            )

    elif varsel_type == FristVarselType.SPESIFISERT.value:
        if not data.get('spesifisert_varsel'):
            raise ValidationError(
                "spesifisert_varsel er påkrevd når varsel_type er 'spesifisert'"
            )

        # Must have antall_dager for spesifisert
        if data.get('antall_dager') is None:
            raise ValidationError(
                "antall_dager er påkrevd for spesifisert fristkrav"
            )

        if data.get('antall_dager', 0) < 0:
            raise ValidationError("antall_dager må være >= 0")


def validate_respons_event(data: Dict[str, Any], spor_type: str) -> None:
    """
    Validate respons-event data.

    Args:
        data: The 'data' field from a respons event
        spor_type: The track type ('grunnlag', 'vederlag', 'frist')

    Raises:
        ValidationError: If validation fails
    """
    if not data:
        raise ValidationError("Respons data mangler")

    # Basic validation - detailed validation happens in business rules
    if spor_type == 'grunnlag':
        if not data.get('resultat'):
            raise ValidationError("resultat er påkrevd")

        if not data.get('begrunnelse'):
            raise ValidationError("begrunnelse er påkrevd")

    elif spor_type == 'vederlag':
        if not data.get('beregnings_resultat'):
            raise ValidationError("beregnings_resultat er påkrevd")

    elif spor_type == 'frist':
        if not data.get('beregnings_resultat'):
            raise ValidationError("beregnings_resultat er påkrevd")

        if data.get('spesifisert_krav_ok') is None:
            raise ValidationError("spesifisert_krav_ok er påkrevd")

        if data.get('vilkar_oppfylt') is None:
            raise ValidationError("vilkar_oppfylt er påkrevd")
