"""
API validators integrating backend constants.

Validates event data against NS 8407 constants before persistence.
These validators are called BEFORE parse_event_from_request() to ensure
data integrity at the API boundary.
"""
from typing import Dict, Any, Optional, List
from models.events import (
    GrunnlagData,
    VederlagData,
    FristData,
    VederlagsMetode,
    FristVarselType,
)
from constants import (
    validate_kategori_kombinasjon,
    get_vederlag_metode,
    krever_forhåndsvarsel,
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


def validate_grunnlag_event(data: Dict[str, Any]) -> None:
    """
    Validate grunnlag-event data against constants.

    Args:
        data: The 'data' field from a grunnlag event

    Raises:
        ValidationError: If validation fails (with valid_options when applicable)
    """
    if not data:
        raise ValidationError("Grunnlag data mangler")

    hovedkategori = data.get('hovedkategori')
    underkategori = data.get('underkategori')

    if not hovedkategori:
        raise ValidationError(
            "hovedkategori er påkrevd",
            valid_options={"hovedkategorier": get_alle_hovedkategorier()},
            field="hovedkategori"
        )

    # Check if hovedkategori is valid
    valid_hovedkategorier = get_alle_hovedkategorier()
    if hovedkategori not in valid_hovedkategorier:
        raise ValidationError(
            f"Ugyldig hovedkategori: {hovedkategori}",
            valid_options={"hovedkategorier": valid_hovedkategorier},
            field="hovedkategori"
        )

    if not underkategori:
        raise ValidationError(
            "underkategori er påkrevd",
            valid_options={
                "hovedkategori": hovedkategori,
                "underkategorier": get_underkategorier_for_hovedkategori(hovedkategori)
            },
            field="underkategori"
        )

    # Validate category combination
    valid_underkategorier = get_underkategorier_for_hovedkategori(hovedkategori)

    # Handle both single string and list of strings
    if isinstance(underkategori, list):
        for uk in underkategori:
            if not validate_kategori_kombinasjon(hovedkategori, uk):
                raise ValidationError(
                    f"Ugyldig underkategori '{uk}' for hovedkategori '{hovedkategori}'",
                    valid_options={
                        "hovedkategori": hovedkategori,
                        "underkategorier": valid_underkategorier
                    },
                    field="underkategori"
                )
    else:
        if not validate_kategori_kombinasjon(hovedkategori, underkategori):
            raise ValidationError(
                f"Ugyldig underkategori '{underkategori}' for hovedkategori '{hovedkategori}'",
                valid_options={
                    "hovedkategori": hovedkategori,
                    "underkategorier": valid_underkategorier
                },
                field="underkategori"
            )

    # Validate required fields
    if not data.get('beskrivelse'):
        raise ValidationError("beskrivelse er påkrevd", field="beskrivelse")

    if not data.get('dato_oppdaget'):
        raise ValidationError("dato_oppdaget er påkrevd (format: YYYY-MM-DD)", field="dato_oppdaget")


def validate_vederlag_event(data: Dict[str, Any]) -> None:
    """
    Validate vederlag-event data against constants.

    Works for both initial claims (vederlag_krav_sendt) and updates (vederlag_krav_oppdatert).
    Update events may use alternative field names:
    - nytt_belop_direkte instead of belop_direkte
    - nytt_kostnads_overslag instead of kostnads_overslag

    Args:
        data: The 'data' field from a vederlag event

    Raises:
        ValidationError: If validation fails (with valid_options when applicable)
    """
    if not data:
        raise ValidationError("Vederlag data mangler")

    valid_metoder = [m.value for m in VederlagsMetode]

    metode = data.get('metode')
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

    # Validate NS 8407 specific warning requirements
    # Regningsarbeid (§30.1) - must warn BEFORE starting work
    if data.get('krever_regningsarbeid'):
        if not data.get('regningsarbeid_varsel'):
            raise ValidationError(
                "Regningsarbeid krever varsel før oppstart (§30.1)"
            )

        # Validate that varsel has required fields
        regn_varsel = data.get('regningsarbeid_varsel')
        if regn_varsel and not regn_varsel.get('dato_sendt'):
            raise ValidationError(
                "regningsarbeid_varsel må ha dato_sendt"
            )

    # Rigg & Drift (§34.1.3) - must warn without undue delay
    if data.get('inkluderer_rigg_drift'):
        if not data.get('rigg_drift_varsel'):
            raise ValidationError(
                "Rigg/drift-kostnader krever særskilt varsel (§34.1.3)"
            )

        rigg_varsel = data.get('rigg_drift_varsel')
        if rigg_varsel and not rigg_varsel.get('dato_sendt'):
            raise ValidationError(
                "rigg_drift_varsel må ha dato_sendt"
            )

    # Justerte enhetspriser (§34.3.3)
    if data.get('krever_justert_ep'):
        if not data.get('justert_ep_varsel'):
            raise ValidationError(
                "Justerte enhetspriser krever varsel (§34.3.3)"
            )

        justert_varsel = data.get('justert_ep_varsel')
        if justert_varsel and not justert_varsel.get('dato_sendt'):
            raise ValidationError(
                "justert_ep_varsel må ha dato_sendt"
            )

    # Produktivitetstap (§34.1.3, andre ledd)
    if data.get('inkluderer_produktivitetstap'):
        if not data.get('produktivitetstap_varsel'):
            raise ValidationError(
                "Produktivitetstap krever særskilt varsel (§34.1.3, 2. ledd)"
            )

        prod_varsel = data.get('produktivitetstap_varsel')
        if prod_varsel and not prod_varsel.get('dato_sendt'):
            raise ValidationError(
                "produktivitetstap_varsel må ha dato_sendt"
            )


def validate_frist_event(data: Dict[str, Any], is_update: bool = False) -> None:
    """
    Validate frist-event data against constants.

    Works for both initial claims (frist_krav_sendt) and updates (frist_krav_oppdatert).
    Update events have different requirements:
    - Don't require varsel_type (inherited from original)
    - Use nytt_antall_dager instead of antall_dager

    Args:
        data: The 'data' field from a frist event
        is_update: True if this is an update event (frist_krav_oppdatert)

    Raises:
        ValidationError: If validation fails (with valid_options when applicable)
    """
    if not data:
        raise ValidationError("Frist data mangler")

    valid_varsel_types = [vt.value for vt in FristVarselType]

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
    if varsel_type == FristVarselType.NOYTRALT.value:
        if not data.get('noytralt_varsel'):
            raise ValidationError(
                "noytralt_varsel er påkrevd når varsel_type er 'noytralt'"
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

    elif varsel_type == FristVarselType.BEGGE.value:
        if not data.get('noytralt_varsel'):
            raise ValidationError(
                "noytralt_varsel er påkrevd når varsel_type er 'begge'"
            )

        if not data.get('spesifisert_varsel'):
            raise ValidationError(
                "spesifisert_varsel er påkrevd når varsel_type er 'begge'"
            )

        # Must have antall_dager when BEGGE
        if data.get('antall_dager') is None:
            raise ValidationError(
                "antall_dager er påkrevd når varsel_type er 'begge'"
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
