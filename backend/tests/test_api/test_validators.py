"""
Tests for api/validators.py

These tests ensure that event validation catches:
- Missing required fields
- Invalid field values
- Frontend/backend field name mismatches

These tests would have caught bugs like:
- Frontend sending 'resultat' when backend expects 'beregnings_resultat'
"""

import pytest

from api.validators import (
    ValidationError,
    _normalize_to_upper,
    _validate_antall_dager,
    _validate_begrunnelse,
    _validate_frist_varsel_info,
    _validate_varsel_requirement,
    _validate_varsel_type_field,
    validate_frist_event,
    validate_grunnlag_event,
    validate_respons_event,
    validate_vederlag_event,
)

# ============================================================================
# ValidationError tests
# ============================================================================


class TestValidationError:
    """Tests for ValidationError exception class."""

    def test_basic_error(self):
        """ValidationError stores message correctly."""
        err = ValidationError("Test error")
        assert str(err) == "Test error"
        assert err.message == "Test error"

    def test_error_with_valid_options(self):
        """ValidationError stores valid_options for helpful feedback."""
        err = ValidationError(
            "Invalid field",
            valid_options={"options": ["a", "b", "c"]},
            field="test_field",
        )
        assert err.valid_options == {"options": ["a", "b", "c"]}
        assert err.field == "test_field"

    def test_to_dict(self):
        """ValidationError converts to dict for JSON responses."""
        err = ValidationError(
            "Error message", valid_options={"key": "value"}, field="my_field"
        )
        result = err.to_dict()
        assert result["message"] == "Error message"
        assert result["valid_options"] == {"key": "value"}
        assert result["field"] == "my_field"

    def test_to_dict_minimal(self):
        """ValidationError.to_dict works with minimal data."""
        err = ValidationError("Simple error")
        result = err.to_dict()
        assert result == {"message": "Simple error"}
        assert "valid_options" not in result
        assert "field" not in result


# ============================================================================
# _validate_varsel_requirement tests (shared helper)
# ============================================================================


class TestValidateVarselRequirement:
    """Tests for _validate_varsel_requirement helper function."""

    def test_no_flag_set_passes(self):
        """When flag is not set, validation passes without checking varsel."""
        data = {"other_field": "value"}
        # Should not raise
        _validate_varsel_requirement(
            data, "krever_justert_ep", "justert_ep_varsel", "Error message"
        )

    def test_flag_false_passes(self):
        """When flag is explicitly False, validation passes."""
        data = {"krever_justert_ep": False}
        _validate_varsel_requirement(
            data, "krever_justert_ep", "justert_ep_varsel", "Error message"
        )

    def test_flag_set_without_varsel_raises(self):
        """When flag is set but varsel missing, raises ValidationError."""
        data = {"krever_justert_ep": True}
        with pytest.raises(ValidationError) as exc_info:
            _validate_varsel_requirement(
                data,
                "krever_justert_ep",
                "justert_ep_varsel",
                "Justerte enhetspriser krever varsel (§34.3.3)",
            )
        assert "Justerte enhetspriser krever varsel" in str(exc_info.value)

    def test_flag_set_with_empty_varsel_raises(self):
        """When flag is set but varsel is empty dict, raises ValidationError."""
        data = {"krever_justert_ep": True, "justert_ep_varsel": {}}
        with pytest.raises(ValidationError) as exc_info:
            _validate_varsel_requirement(
                data, "krever_justert_ep", "justert_ep_varsel", "Error message"
            )
        assert "dato_sendt" in str(exc_info.value)

    def test_flag_set_varsel_missing_dato_sendt_raises(self):
        """When varsel lacks dato_sendt, raises ValidationError."""
        data = {
            "krever_justert_ep": True,
            "justert_ep_varsel": {"other_field": "value"},
        }
        with pytest.raises(ValidationError) as exc_info:
            _validate_varsel_requirement(
                data, "krever_justert_ep", "justert_ep_varsel", "Error message"
            )
        assert "justert_ep_varsel må ha dato_sendt" in str(exc_info.value)

    def test_flag_set_with_valid_varsel_passes(self):
        """When flag is set and varsel has dato_sendt, passes."""
        data = {
            "krever_justert_ep": True,
            "justert_ep_varsel": {"dato_sendt": "2025-01-15"},
        }
        # Should not raise
        _validate_varsel_requirement(
            data, "krever_justert_ep", "justert_ep_varsel", "Error message"
        )

    def test_works_with_different_field_names(self):
        """Helper works with any flag/varsel field combination."""
        data = {
            "inkluderer_rigg_drift": True,
            "rigg_drift_varsel": {"dato_sendt": "2025-01-20"},
        }
        # Should not raise
        _validate_varsel_requirement(
            data,
            "inkluderer_rigg_drift",
            "rigg_drift_varsel",
            "Rigg/drift krever varsel (§34.1.3)",
        )


# ============================================================================
# _normalize_to_upper tests (shared helper)
# ============================================================================


class TestNormalizeToUpper:
    """Tests for _normalize_to_upper helper function."""

    def test_normalizes_string_to_upper(self):
        """Converts lowercase string to uppercase."""
        data = {"kategori": "endring"}
        _normalize_to_upper(data, "kategori")
        assert data["kategori"] == "ENDRING"

    def test_normalizes_mixed_case_string(self):
        """Converts mixed case string to uppercase."""
        data = {"metode": "Enhetspriser"}
        _normalize_to_upper(data, "metode")
        assert data["metode"] == "ENHETSPRISER"

    def test_handles_already_uppercase(self):
        """Leaves uppercase strings unchanged."""
        data = {"kategori": "ENDRING"}
        _normalize_to_upper(data, "kategori")
        assert data["kategori"] == "ENDRING"

    def test_handles_missing_key(self):
        """Does nothing if key doesn't exist."""
        data = {"other": "value"}
        _normalize_to_upper(data, "kategori")
        assert "kategori" not in data

    def test_handles_none_value(self):
        """Does nothing if value is None."""
        data = {"kategori": None}
        _normalize_to_upper(data, "kategori")
        assert data["kategori"] is None

    def test_normalizes_list_of_strings(self):
        """Converts list of lowercase strings to uppercase."""
        data = {"underkategorier": ["eo", "irreg"]}
        _normalize_to_upper(data, "underkategorier")
        assert data["underkategorier"] == ["EO", "IRREG"]

    def test_handles_mixed_list(self):
        """Handles list with mixed types (only converts strings)."""
        data = {"items": ["lower", 123, "UPPER"]}
        _normalize_to_upper(data, "items")
        assert data["items"] == ["LOWER", 123, "UPPER"]

    def test_normalizes_multiple_keys(self):
        """Can normalize multiple keys in one call."""
        data = {"a": "foo", "b": "bar", "c": "baz"}
        _normalize_to_upper(data, "a", "b", "c")
        assert data == {"a": "FOO", "b": "BAR", "c": "BAZ"}

    def test_handles_empty_string(self):
        """Handles empty string (returns empty string)."""
        data = {"kategori": ""}
        _normalize_to_upper(data, "kategori")
        assert data["kategori"] == ""


# ============================================================================
# _validate_hovedkategori tests (shared helper)
# ============================================================================


class TestValidateHovedkategori:
    """Tests for _validate_hovedkategori helper function."""

    def test_valid_hovedkategori(self):
        """Valid hovedkategori passes."""
        from api.validators import _validate_hovedkategori

        # Should not raise
        _validate_hovedkategori("ENDRING")

    def test_invalid_hovedkategori(self):
        """Invalid hovedkategori raises ValidationError."""
        from api.validators import _validate_hovedkategori

        with pytest.raises(ValidationError) as exc_info:
            _validate_hovedkategori("INVALID_KATEGORI")
        assert "Ugyldig hovedkategori" in str(exc_info.value)
        assert exc_info.value.field == "hovedkategori"

    def test_missing_hovedkategori_required(self):
        """Missing hovedkategori raises error when required=True."""
        from api.validators import _validate_hovedkategori

        with pytest.raises(ValidationError) as exc_info:
            _validate_hovedkategori(None, required=True)
        assert "hovedkategori er påkrevd" in str(exc_info.value)

    def test_missing_hovedkategori_not_required(self):
        """Missing hovedkategori passes when required=False."""
        from api.validators import _validate_hovedkategori

        # Should not raise
        _validate_hovedkategori(None, required=False)

    def test_empty_string_hovedkategori_required(self):
        """Empty string hovedkategori raises error when required=True."""
        from api.validators import _validate_hovedkategori

        with pytest.raises(ValidationError) as exc_info:
            _validate_hovedkategori("", required=True)
        assert "hovedkategori er påkrevd" in str(exc_info.value)


# ============================================================================
# _validate_underkategori tests (shared helper)
# ============================================================================


class TestValidateUnderkategori:
    """Tests for _validate_underkategori helper function."""

    def test_valid_single_underkategori(self):
        """Valid single underkategori passes."""
        from api.validators import _validate_underkategori

        # Should not raise
        _validate_underkategori("ENDRING", "EO")

    def test_valid_list_underkategori(self):
        """Valid list of underkategorier passes."""
        from api.validators import _validate_underkategori

        # Should not raise
        _validate_underkategori("ENDRING", ["EO", "IRREG"])

    def test_invalid_underkategori(self):
        """Invalid underkategori raises ValidationError."""
        from api.validators import _validate_underkategori

        with pytest.raises(ValidationError) as exc_info:
            _validate_underkategori("ENDRING", "INVALID")
        assert "Ugyldig underkategori" in str(exc_info.value)
        assert exc_info.value.field == "underkategori"

    def test_invalid_underkategori_in_list(self):
        """Invalid underkategori in list raises ValidationError."""
        from api.validators import _validate_underkategori

        with pytest.raises(ValidationError) as exc_info:
            _validate_underkategori("ENDRING", ["EO", "INVALID"])
        assert "Ugyldig underkategori" in str(exc_info.value)

    def test_missing_underkategori_required(self):
        """Missing underkategori raises error when required=True."""
        from api.validators import _validate_underkategori

        with pytest.raises(ValidationError) as exc_info:
            _validate_underkategori("ENDRING", None, required=True)
        assert "underkategori er påkrevd" in str(exc_info.value)

    def test_missing_underkategori_not_required(self):
        """Missing underkategori passes when required=False."""
        from api.validators import _validate_underkategori

        # Should not raise
        _validate_underkategori("ENDRING", None, required=False)

    def test_hovedkategori_without_underkategorier(self):
        """Hovedkategori without underkategorier (e.g., Force Majeure) always passes."""
        from api.validators import _validate_underkategori

        # FORCE_MAJEURE has no underkategorier, so this should pass
        _validate_underkategori("FORCE_MAJEURE", None, required=True)


# ============================================================================
# _validate_required_text_fields tests (shared helper)
# ============================================================================


class TestValidateRequiredTextFields:
    """Tests for _validate_required_text_fields helper function."""

    def test_valid_text_fields(self):
        """Valid text fields pass."""
        from api.validators import _validate_required_text_fields

        # Should not raise
        _validate_required_text_fields(
            {
                "tittel": "Valid title",
                "beskrivelse": "Valid description",
                "dato_oppdaget": "2025-01-15",
            }
        )

    def test_missing_tittel(self):
        """Missing tittel raises ValidationError."""
        from api.validators import _validate_required_text_fields

        with pytest.raises(ValidationError) as exc_info:
            _validate_required_text_fields(
                {"beskrivelse": "Description", "dato_oppdaget": "2025-01-15"}
            )
        assert "tittel er påkrevd" in str(exc_info.value)

    def test_tittel_too_short(self):
        """Tittel < 3 characters raises ValidationError."""
        from api.validators import _validate_required_text_fields

        with pytest.raises(ValidationError) as exc_info:
            _validate_required_text_fields(
                {
                    "tittel": "AB",
                    "beskrivelse": "Description",
                    "dato_oppdaget": "2025-01-15",
                }
            )
        assert "minst 3 tegn" in str(exc_info.value)

    def test_tittel_too_long(self):
        """Tittel > 100 characters raises ValidationError."""
        from api.validators import _validate_required_text_fields

        with pytest.raises(ValidationError) as exc_info:
            _validate_required_text_fields(
                {
                    "tittel": "A" * 101,
                    "beskrivelse": "Description",
                    "dato_oppdaget": "2025-01-15",
                }
            )
        assert "lengre enn 100 tegn" in str(exc_info.value)

    def test_missing_beskrivelse(self):
        """Missing beskrivelse raises ValidationError."""
        from api.validators import _validate_required_text_fields

        with pytest.raises(ValidationError) as exc_info:
            _validate_required_text_fields(
                {"tittel": "Valid title", "dato_oppdaget": "2025-01-15"}
            )
        assert "beskrivelse er påkrevd" in str(exc_info.value)

    def test_missing_dato_oppdaget(self):
        """Missing dato_oppdaget raises ValidationError."""
        from api.validators import _validate_required_text_fields

        with pytest.raises(ValidationError) as exc_info:
            _validate_required_text_fields(
                {"tittel": "Valid title", "beskrivelse": "Description"}
            )
        assert "dato_oppdaget er påkrevd" in str(exc_info.value)


# ============================================================================
# validate_grunnlag_event tests
# ============================================================================


class TestValidateGrunnlagEvent:
    """Tests for validate_grunnlag_event."""

    def test_missing_data(self):
        """Raises ValidationError when data is None or empty."""
        with pytest.raises(ValidationError) as exc_info:
            validate_grunnlag_event(None)
        assert "Grunnlag data mangler" in str(exc_info.value)

    def test_empty_data(self):
        """Raises ValidationError when data is empty dict (treated as missing)."""
        with pytest.raises(ValidationError) as exc_info:
            validate_grunnlag_event({})
        # Empty dict is falsy, so treated as "data mangler"
        assert "Grunnlag data mangler" in str(exc_info.value)

    def test_missing_hovedkategori(self):
        """Raises ValidationError when hovedkategori is missing."""
        with pytest.raises(ValidationError) as exc_info:
            validate_grunnlag_event({"underkategori": "test"})
        assert "hovedkategori er påkrevd" in str(exc_info.value)
        assert exc_info.value.field == "hovedkategori"
        assert "hovedkategorier" in exc_info.value.valid_options

    def test_invalid_hovedkategori(self):
        """Raises ValidationError when hovedkategori is invalid."""
        with pytest.raises(ValidationError) as exc_info:
            validate_grunnlag_event(
                {"hovedkategori": "INVALID_KATEGORI", "underkategori": "test"}
            )
        assert "Ugyldig hovedkategori" in str(exc_info.value)
        assert exc_info.value.field == "hovedkategori"

    def test_missing_underkategori(self):
        """Raises ValidationError when underkategori is missing."""
        with pytest.raises(ValidationError) as exc_info:
            validate_grunnlag_event({"hovedkategori": "ENDRING"})
        assert "underkategori er påkrevd" in str(exc_info.value)
        assert exc_info.value.field == "underkategori"

    def test_invalid_underkategori(self):
        """Raises ValidationError when underkategori doesn't match hovedkategori."""
        with pytest.raises(ValidationError) as exc_info:
            validate_grunnlag_event(
                {"hovedkategori": "ENDRING", "underkategori": "INVALID_UNDERKATEGORI"}
            )
        assert "Ugyldig underkategori" in str(exc_info.value)

    def test_missing_beskrivelse(self):
        """Raises ValidationError when beskrivelse is missing."""
        with pytest.raises(ValidationError) as exc_info:
            validate_grunnlag_event(
                {
                    "hovedkategori": "ENDRING",
                    "underkategori": "EO",
                    "tittel": "Test tittel",
                    "dato_oppdaget": "2025-01-15",
                }
            )
        assert "beskrivelse er påkrevd" in str(exc_info.value)

    def test_missing_dato_oppdaget(self):
        """Raises ValidationError when dato_oppdaget is missing."""
        with pytest.raises(ValidationError) as exc_info:
            validate_grunnlag_event(
                {
                    "hovedkategori": "ENDRING",
                    "underkategori": "EO",
                    "tittel": "Test tittel",
                    "beskrivelse": "Test beskrivelse",
                }
            )
        assert "dato_oppdaget er påkrevd" in str(exc_info.value)

    def test_valid_grunnlag_event(self):
        """Valid grunnlag event passes validation."""
        # Should not raise
        validate_grunnlag_event(
            {
                "hovedkategori": "ENDRING",
                "underkategori": "EO",
                "tittel": "Endring i prosjektering",
                "beskrivelse": "Detaljert beskrivelse av endringen",
                "dato_oppdaget": "2025-01-15",
            }
        )

    def test_valid_grunnlag_with_list_underkategori(self):
        """Valid grunnlag with multiple underkategorier passes validation."""
        validate_grunnlag_event(
            {
                "hovedkategori": "ENDRING",
                "underkategori": ["EO", "IRREG"],
                "tittel": "Multiple kategorier",
                "beskrivelse": "Detaljert beskrivelse",
                "dato_oppdaget": "2025-01-15",
            }
        )


# ============================================================================
# validate_vederlag_event tests
# ============================================================================


class TestValidateVederlagEvent:
    """Tests for validate_vederlag_event."""

    def test_missing_data(self):
        """Raises ValidationError when data is None or empty."""
        with pytest.raises(ValidationError) as exc_info:
            validate_vederlag_event(None)
        assert "Vederlag data mangler" in str(exc_info.value)

    def test_missing_metode(self):
        """Raises ValidationError when metode is missing."""
        with pytest.raises(ValidationError) as exc_info:
            validate_vederlag_event({"begrunnelse": "Test"})
        assert "metode er påkrevd" in str(exc_info.value)
        assert exc_info.value.field == "metode"
        assert "metoder" in exc_info.value.valid_options

    def test_invalid_metode(self):
        """Raises ValidationError when metode is invalid."""
        with pytest.raises(ValidationError) as exc_info:
            validate_vederlag_event({"metode": "INVALID_METODE", "begrunnelse": "Test"})
        assert "Ukjent vederlagsmetode" in str(exc_info.value)

    def test_missing_belop_direkte_for_enhetspriser(self):
        """Raises ValidationError when belop_direkte missing for ENHETSPRISER."""
        with pytest.raises(ValidationError) as exc_info:
            validate_vederlag_event({"metode": "ENHETSPRISER", "begrunnelse": "Test"})
        assert "belop_direkte er påkrevd" in str(exc_info.value)

    def test_missing_belop_direkte_for_fastpris(self):
        """Raises ValidationError when belop_direkte missing for FASTPRIS_TILBUD."""
        with pytest.raises(ValidationError) as exc_info:
            validate_vederlag_event(
                {"metode": "FASTPRIS_TILBUD", "begrunnelse": "Test"}
            )
        assert "belop_direkte er påkrevd" in str(exc_info.value)

    def test_regningsarbeid_without_overslag_is_valid(self):
        """REGNINGSARBEID doesn't require kostnads_overslag (per §30.2)."""
        # Should not raise
        validate_vederlag_event(
            {"metode": "REGNINGSARBEID", "begrunnelse": "Arbeid ikke utført ennå"}
        )

    def test_missing_begrunnelse(self):
        """Raises ValidationError when begrunnelse is missing."""
        with pytest.raises(ValidationError) as exc_info:
            validate_vederlag_event({"metode": "ENHETSPRISER", "belop_direkte": 100000})
        assert "begrunnelse er påkrevd" in str(exc_info.value)

    def test_rigg_drift_requires_varsel(self):
        """Raises ValidationError when rigg/drift lacks required varsel."""
        with pytest.raises(ValidationError) as exc_info:
            validate_vederlag_event(
                {
                    "metode": "REGNINGSARBEID",
                    "begrunnelse": "Test",
                    "inkluderer_rigg_drift": True,
                }
            )
        assert "Rigg/drift-kostnader krever særskilt varsel" in str(exc_info.value)

    def test_justert_ep_requires_varsel(self):
        """Raises ValidationError when justerte EP lacks required varsel."""
        with pytest.raises(ValidationError) as exc_info:
            validate_vederlag_event(
                {
                    "metode": "ENHETSPRISER",
                    "belop_direkte": 100000,
                    "begrunnelse": "Test",
                    "krever_justert_ep": True,
                }
            )
        assert "Justerte enhetspriser krever varsel" in str(exc_info.value)

    def test_produktivitetstap_requires_varsel(self):
        """Raises ValidationError when produktivitetstap lacks varsel."""
        with pytest.raises(ValidationError) as exc_info:
            validate_vederlag_event(
                {
                    "metode": "REGNINGSARBEID",
                    "begrunnelse": "Test",
                    "inkluderer_produktivitetstap": True,
                }
            )
        assert "Produktivitetstap krever særskilt varsel" in str(exc_info.value)

    def test_valid_vederlag_event_enhetspriser(self):
        """Valid vederlag event with ENHETSPRISER passes."""
        validate_vederlag_event(
            {
                "metode": "ENHETSPRISER",
                "belop_direkte": 150000,
                "begrunnelse": "Mengdeøkning på betong",
            }
        )

    def test_valid_vederlag_event_regningsarbeid(self):
        """Valid vederlag event with REGNINGSARBEID passes."""
        validate_vederlag_event(
            {
                "metode": "REGNINGSARBEID",
                "kostnads_overslag": 200000,
                "begrunnelse": "Tilleggsarbeid",
            }
        )


# ============================================================================
# validate_frist_event tests
# ============================================================================


class TestValidateFristEvent:
    """Tests for validate_frist_event."""

    def test_missing_data(self):
        """Raises ValidationError when data is None or empty."""
        with pytest.raises(ValidationError) as exc_info:
            validate_frist_event(None)
        assert "Frist data mangler" in str(exc_info.value)

    def test_missing_varsel_type(self):
        """Raises ValidationError when varsel_type is missing."""
        with pytest.raises(ValidationError) as exc_info:
            validate_frist_event({"begrunnelse": "Test"})
        assert "varsel_type er påkrevd" in str(exc_info.value)
        assert "varsel_typer" in exc_info.value.valid_options

    def test_invalid_varsel_type(self):
        """Raises ValidationError when varsel_type is invalid."""
        with pytest.raises(ValidationError) as exc_info:
            validate_frist_event({"varsel_type": "INVALID_TYPE", "begrunnelse": "Test"})
        assert "Ugyldig varsel_type" in str(exc_info.value)

    def test_missing_begrunnelse(self):
        """Raises ValidationError when begrunnelse is missing."""
        with pytest.raises(ValidationError) as exc_info:
            validate_frist_event({"varsel_type": "varsel"})
        assert "begrunnelse er påkrevd" in str(exc_info.value)

    def test_varsel_requires_frist_varsel(self):
        """Raises ValidationError when frist_varsel is missing for varsel type."""
        with pytest.raises(ValidationError) as exc_info:
            validate_frist_event({"varsel_type": "varsel", "begrunnelse": "Test"})
        assert "frist_varsel er påkrevd" in str(exc_info.value)

    def test_spesifisert_requires_spesifisert_varsel(self):
        """Raises ValidationError when spesifisert varsel is missing."""
        with pytest.raises(ValidationError) as exc_info:
            validate_frist_event({"varsel_type": "spesifisert", "begrunnelse": "Test"})
        assert "spesifisert_varsel er påkrevd" in str(exc_info.value)

    def test_spesifisert_requires_antall_dager(self):
        """Raises ValidationError when antall_dager missing for spesifisert."""
        with pytest.raises(ValidationError) as exc_info:
            validate_frist_event(
                {
                    "varsel_type": "spesifisert",
                    "begrunnelse": "Test",
                    "spesifisert_varsel": {"dato_sendt": "2025-01-15"},
                }
            )
        assert "antall_dager er påkrevd" in str(exc_info.value)

    def test_negative_antall_dager(self):
        """Raises ValidationError when antall_dager is negative."""
        with pytest.raises(ValidationError) as exc_info:
            validate_frist_event(
                {
                    "varsel_type": "spesifisert",
                    "begrunnelse": "Test",
                    "spesifisert_varsel": {"dato_sendt": "2025-01-15"},
                    "antall_dager": -5,
                }
            )
        assert "antall_dager må være >= 0" in str(exc_info.value)

    def test_valid_frist_varsel(self):
        """Valid frist event with varsel passes."""
        validate_frist_event(
            {
                "varsel_type": "varsel",
                "begrunnelse": "Værforhold hindret arbeid",
                "frist_varsel": {"dato_sendt": "2025-01-15"},
            }
        )

    def test_valid_frist_spesifisert(self):
        """Valid frist event with spesifisert passes."""
        validate_frist_event(
            {
                "varsel_type": "spesifisert",
                "begrunnelse": "Forsinkelse på grunn av materiallevering",
                "spesifisert_varsel": {"dato_sendt": "2025-01-20"},
                "antall_dager": 14,
            }
        )


# ============================================================================
# validate_respons_event tests
# ============================================================================


class TestValidateResponsEvent:
    """
    Tests for validate_respons_event.

    CRITICAL: These tests ensure frontend/backend field name alignment.
    The bug where frontend sent 'resultat' but backend expected 'beregnings_resultat'
    would have been caught by these tests.
    """

    def test_missing_data(self):
        """Raises ValidationError when data is None or empty."""
        with pytest.raises(ValidationError) as exc_info:
            validate_respons_event(None, "grunnlag")
        assert "Respons data mangler" in str(exc_info.value)

    # --- Grunnlag response tests ---

    def test_grunnlag_missing_resultat(self):
        """Grunnlag response requires 'resultat' field."""
        with pytest.raises(ValidationError) as exc_info:
            validate_respons_event({"begrunnelse": "Test"}, "grunnlag")
        assert "resultat er påkrevd" in str(exc_info.value)

    def test_grunnlag_missing_begrunnelse(self):
        """Grunnlag response requires 'begrunnelse' field."""
        with pytest.raises(ValidationError) as exc_info:
            validate_respons_event({"resultat": "godkjent"}, "grunnlag")
        assert "begrunnelse er påkrevd" in str(exc_info.value)

    def test_valid_grunnlag_respons(self):
        """Valid grunnlag response passes validation."""
        validate_respons_event(
            {"resultat": "godkjent", "begrunnelse": "Kravet aksepteres"}, "grunnlag"
        )

    # --- Vederlag response tests ---

    def test_vederlag_missing_beregnings_resultat(self):
        """
        Vederlag response requires 'beregnings_resultat' field.

        NOTE: This test would have caught the bug where frontend sent 'resultat'
        instead of 'beregnings_resultat'.
        """
        with pytest.raises(ValidationError) as exc_info:
            validate_respons_event({"total_godkjent_belop": 100000}, "vederlag")
        assert "beregnings_resultat er påkrevd" in str(exc_info.value)

    def test_vederlag_wrong_field_name_resultat(self):
        """
        Vederlag response with 'resultat' instead of 'beregnings_resultat' fails.

        This is the exact bug we fixed: frontend was sending 'resultat' but
        backend expected 'beregnings_resultat'.
        """
        with pytest.raises(ValidationError) as exc_info:
            validate_respons_event(
                {
                    "resultat": "delvis_godkjent",  # Wrong field name!
                    "total_godkjent_belop": 100000,
                },
                "vederlag",
            )
        assert "beregnings_resultat er påkrevd" in str(exc_info.value)

    def test_valid_vederlag_respons(self):
        """Valid vederlag response with correct field name passes."""
        validate_respons_event(
            {
                "beregnings_resultat": "delvis_godkjent",  # Correct field name
                "total_godkjent_belop": 100000,
            },
            "vederlag",
        )

    def test_valid_vederlag_respons_godkjent(self):
        """Valid vederlag response with godkjent passes."""
        validate_respons_event(
            {"beregnings_resultat": "godkjent", "total_godkjent_belop": 150000},
            "vederlag",
        )

    def test_valid_vederlag_respons_avslatt(self):
        """Valid vederlag response with avslått passes."""
        validate_respons_event(
            {"beregnings_resultat": "avslatt", "total_godkjent_belop": 0}, "vederlag"
        )

    # --- Frist response tests ---

    def test_frist_missing_beregnings_resultat(self):
        """Frist response requires 'beregnings_resultat' field."""
        with pytest.raises(ValidationError) as exc_info:
            validate_respons_event(
                {"spesifisert_krav_ok": True, "vilkar_oppfylt": True}, "frist"
            )
        assert "beregnings_resultat er påkrevd" in str(exc_info.value)

    def test_frist_missing_spesifisert_krav_ok(self):
        """Frist response requires 'spesifisert_krav_ok' field."""
        with pytest.raises(ValidationError) as exc_info:
            validate_respons_event(
                {"beregnings_resultat": "godkjent", "vilkar_oppfylt": True}, "frist"
            )
        assert "spesifisert_krav_ok er påkrevd" in str(exc_info.value)

    def test_frist_missing_vilkar_oppfylt(self):
        """Frist response requires 'vilkar_oppfylt' field."""
        with pytest.raises(ValidationError) as exc_info:
            validate_respons_event(
                {"beregnings_resultat": "godkjent", "spesifisert_krav_ok": True},
                "frist",
            )
        assert "vilkar_oppfylt er påkrevd" in str(exc_info.value)

    def test_valid_frist_respons(self):
        """Valid frist response passes validation."""
        validate_respons_event(
            {
                "beregnings_resultat": "godkjent",
                "spesifisert_krav_ok": True,
                "vilkar_oppfylt": True,
                "godkjent_dager": 14,
            },
            "frist",
        )

    def test_frist_respons_with_false_values(self):
        """Frist response with False values for boolean fields passes."""
        # False is a valid value, not missing
        validate_respons_event(
            {
                "beregnings_resultat": "avslatt",
                "spesifisert_krav_ok": False,
                "vilkar_oppfylt": False,
            },
            "frist",
        )

    # --- Edge cases ---

    def test_unknown_spor_type(self):
        """Unknown spor_type doesn't raise (no specific validation)."""
        # Should not raise - just passes through
        validate_respons_event({"some_field": "value"}, "unknown_type")

    def test_empty_string_values_fail(self):
        """Empty string values are treated as missing."""
        with pytest.raises(ValidationError) as exc_info:
            validate_respons_event(
                {
                    "resultat": "",  # Empty string
                    "begrunnelse": "Test",
                },
                "grunnlag",
            )
        assert "resultat er påkrevd" in str(exc_info.value)

    def test_none_values_fail(self):
        """None values are treated as missing."""
        with pytest.raises(ValidationError) as exc_info:
            validate_respons_event(
                {
                    "beregnings_resultat": None,
                },
                "vederlag",
            )
        assert "beregnings_resultat er påkrevd" in str(exc_info.value)


# ============================================================================
# Integration-style tests (realistic payloads)
# ============================================================================


class TestRealisticPayloads:
    """
    Tests with realistic frontend payloads to catch integration issues.
    """

    def test_full_grunnlag_payload(self):
        """Full grunnlag payload from frontend passes."""
        validate_grunnlag_event(
            {
                "hovedkategori": "ENDRING",
                "underkategori": "EO",
                "tittel": "Endring i fasadeutforming",
                "beskrivelse": "Endring i arkitektonisk utforming av fasade",
                "dato_oppdaget": "2025-01-15",
                "konsekvenser": {"tid": True, "kostnad": True, "kvalitet": False},
                "dokumentasjon": ["doc-123", "doc-456"],
            }
        )

    def test_full_vederlag_respons_payload(self):
        """
        Full vederlag response payload from frontend passes.

        This mirrors the actual payload structure from RespondVederlagModal.tsx
        after the bug fix (using beregnings_resultat instead of resultat).
        """
        validate_respons_event(
            {
                "vederlag_krav_id": "event-123",
                # Port 1: Preklusjon
                "rigg_varslet_i_tide": True,
                "produktivitet_varslet_i_tide": True,
                # Port 2: Metode
                "aksepterer_metode": True,
                "ep_justering_akseptert": None,
                "hold_tilbake": False,
                # Port 3: Beløp
                "hovedkrav_vurdering": "delvis",
                "hovedkrav_godkjent_belop": 120000,
                # Port 4: Automatisk beregnet
                "beregnings_resultat": "delvis_godkjent",  # Correct field name!
                "total_godkjent_belop": 120000,
                "total_krevd_belop": 150000,
                # Begrunnelse
                "begrunnelse": "Godkjenner 80% av kravet",
            },
            "vederlag",
        )

    def test_full_frist_respons_payload(self):
        """Full frist response payload from frontend passes."""
        validate_respons_event(
            {
                "frist_krav_id": "event-456",
                # Vurdering
                "beregnings_resultat": "delvis_godkjent",
                "spesifisert_krav_ok": True,
                "vilkar_oppfylt": True,
                # Beløp
                "godkjent_dager": 10,
                "krevd_dager": 14,
                # Begrunnelse
                "begrunnelse": "Godkjenner 10 av 14 krevde dager",
            },
            "frist",
        )


# ============================================================================
# Vederlag update event tests (vederlag_krav_oppdatert)
# ============================================================================


class TestVederlagUpdateEvent:
    """
    Tests for vederlag_krav_oppdatert validation.

    Update events use the SAME field names as initial claims for consistency.
    This simplifies revision history - just read belop_direkte/antall_dager
    from any event regardless of whether it's initial or revision.
    """

    def test_update_with_belop_direkte_enhetspriser(self):
        """Update event with belop_direkte for ENHETSPRISER should pass."""
        validate_vederlag_event(
            {
                "metode": "ENHETSPRISER",
                "belop_direkte": 150000,
                "begrunnelse": "Revidert beløp etter BH tilbakemelding",
                "original_event_id": "event-123",
            }
        )

    def test_update_with_belop_direkte_fastpris(self):
        """Update event with belop_direkte for FASTPRIS_TILBUD should pass."""
        validate_vederlag_event(
            {
                "metode": "FASTPRIS_TILBUD",
                "belop_direkte": 200000,
                "begrunnelse": "Justert fastpris",
                "original_event_id": "event-456",
            }
        )

    def test_update_with_kostnads_overslag_regningsarbeid(self):
        """Update event with kostnads_overslag for REGNINGSARBEID should pass."""
        validate_vederlag_event(
            {
                "metode": "REGNINGSARBEID",
                "kostnads_overslag": 250000,
                "begrunnelse": "Økt kostnadsoverslag",
                "original_event_id": "event-789",
            }
        )

    def test_update_missing_belop_direkte_enhetspriser(self):
        """Update without belop_direkte fails for ENHETSPRISER."""
        with pytest.raises(ValidationError) as exc_info:
            validate_vederlag_event(
                {
                    "metode": "ENHETSPRISER",
                    "begrunnelse": "Mangler beløp",
                    "original_event_id": "event-123",
                }
            )
        assert "belop_direkte er påkrevd" in str(exc_info.value)

    def test_realistic_revise_vederlag_payload(self):
        """
        Realistic payload from ReviseVederlagModal.tsx should pass.

        Uses same field names as initial claim for consistency.
        """
        validate_vederlag_event(
            {
                "original_event_id": "event-abc-123",
                "metode": "ENHETSPRISER",
                "belop_direkte": 175000,
                "krever_justert_ep": False,
                "begrunnelse": "Justerer beløpet basert på BH tilbakemelding om materialpriser",
                "dato_revidert": "2025-01-20",
            }
        )

    def test_revise_with_method_change_to_regningsarbeid(self):
        """Revising claim with method change to REGNINGSARBEID should pass."""
        validate_vederlag_event(
            {
                "original_event_id": "event-def-456",
                "metode": "REGNINGSARBEID",
                "kostnads_overslag": 300000,
                "varslet_for_oppstart": True,
                "begrunnelse": "Endrer til regningsarbeid etter BH ønske",
                "dato_revidert": "2025-01-20",
            }
        )

    def test_revise_regningsarbeid_without_overslag_passes(self):
        """Revising REGNINGSARBEID without overslag should pass (per §30.2)."""
        validate_vederlag_event(
            {
                "original_event_id": "event-ghi-789",
                "metode": "REGNINGSARBEID",
                "begrunnelse": "Oppdaterer varslingsstatus",
                "varslet_for_oppstart": True,
                "dato_revidert": "2025-01-20",
            }
        )


# ============================================================================
# Frist update event tests (frist_krav_oppdatert)
# ============================================================================


class TestFristUpdateEvent:
    """
    Tests for frist_krav_oppdatert validation.

    Update events use the SAME field names as initial claims for consistency.
    This simplifies revision history - just read antall_dager from any event.
    """

    def test_update_with_antall_dager(self):
        """Update event with antall_dager should pass."""
        validate_frist_event(
            {
                "original_event_id": "event-123",
                "antall_dager": 21,
                "begrunnelse": "Øker fristkrav basert på ny dokumentasjon",
            },
            is_update=True,
        )

    def test_update_missing_antall_dager(self):
        """Update without antall_dager should fail."""
        with pytest.raises(ValidationError) as exc_info:
            validate_frist_event(
                {
                    "original_event_id": "event-123",
                    "begrunnelse": "Mangler antall dager",
                },
                is_update=True,
            )
        assert "antall_dager" in str(exc_info.value).lower()

    def test_update_negative_antall_dager(self):
        """Update with negative antall_dager should fail."""
        with pytest.raises(ValidationError) as exc_info:
            validate_frist_event(
                {
                    "original_event_id": "event-123",
                    "antall_dager": -5,
                    "begrunnelse": "Negativ dager",
                },
                is_update=True,
            )
        assert "må være >= 0" in str(exc_info.value)

    def test_realistic_revise_frist_payload(self):
        """
        Realistic payload from ReviseFristModal.tsx should pass.

        Uses same field names as initial claim for consistency.
        """
        validate_frist_event(
            {
                "original_event_id": "event-frist-123",
                "antall_dager": 18,
                "begrunnelse": "Justerer fristkrav basert på oppdatert fremdriftsplan",
                "dato_revidert": "2025-01-20",
            },
            is_update=True,
        )


# ============================================================================
# Forsering event tests
# ============================================================================


class TestForseringEvent:
    """
    Tests for forsering_varsel validation.

    Forsering (§33.8) is a special escalation event when TE chooses to
    treat BH's frist rejection as a pålegg om forsering.
    """

    def test_forsering_requires_estimert_kostnad(self):
        """Forsering event requires estimert_kostnad."""
        # This is validated in ReviseFristModal but should also be checked server-side
        # TODO: Add validate_forsering_event when implemented
        pass

    def test_forsering_requires_30_prosent_bekreftelse(self):
        """Forsering event requires confirmation of 30% rule."""
        # §33.8: Forsering cost must be < (Dagmulkt + 30%)
        # TODO: Add validate_forsering_event when implemented
        pass


# ============================================================================
# _validate_begrunnelse tests (Fase 3 helper)
# ============================================================================


class TestValidateBegrunnelse:
    """Tests for _validate_begrunnelse helper function."""

    def test_valid_begrunnelse_passes(self):
        """Valid begrunnelse passes validation."""
        _validate_begrunnelse({"begrunnelse": "En gyldig begrunnelse"})

    def test_missing_begrunnelse_fails(self):
        """Missing begrunnelse raises ValidationError."""
        with pytest.raises(ValidationError) as exc_info:
            _validate_begrunnelse({})
        assert "begrunnelse er påkrevd" in str(exc_info.value)

    def test_empty_begrunnelse_fails(self):
        """Empty begrunnelse raises ValidationError."""
        with pytest.raises(ValidationError) as exc_info:
            _validate_begrunnelse({"begrunnelse": ""})
        assert "begrunnelse er påkrevd" in str(exc_info.value)

    def test_none_begrunnelse_fails(self):
        """None begrunnelse raises ValidationError."""
        with pytest.raises(ValidationError) as exc_info:
            _validate_begrunnelse({"begrunnelse": None})
        assert "begrunnelse er påkrevd" in str(exc_info.value)


# ============================================================================
# _validate_antall_dager tests (Fase 3 helper)
# ============================================================================


class TestValidateAntallDager:
    """Tests for _validate_antall_dager helper function."""

    def test_valid_positive_value_passes(self):
        """Positive antall_dager passes validation."""
        _validate_antall_dager({"antall_dager": 10})

    def test_zero_with_allow_zero_true_passes(self):
        """Zero passes when allow_zero=True."""
        _validate_antall_dager({"antall_dager": 0}, allow_zero=True)

    def test_zero_with_allow_zero_false_fails(self):
        """Zero fails when allow_zero=False."""
        with pytest.raises(ValidationError) as exc_info:
            _validate_antall_dager({"antall_dager": 0}, allow_zero=False)
        assert "må være > 0" in str(exc_info.value)

    def test_negative_value_fails(self):
        """Negative antall_dager fails validation."""
        with pytest.raises(ValidationError) as exc_info:
            _validate_antall_dager({"antall_dager": -5})
        assert "må være >= 0" in str(exc_info.value)

    def test_missing_required_fails(self):
        """Missing antall_dager with required=True fails."""
        with pytest.raises(ValidationError) as exc_info:
            _validate_antall_dager({}, required=True)
        assert "antall_dager er påkrevd" in str(exc_info.value)

    def test_missing_not_required_passes(self):
        """Missing antall_dager with required=False passes."""
        _validate_antall_dager({}, required=False)

    def test_context_in_error_message(self):
        """Context string appears in error message."""
        with pytest.raises(ValidationError) as exc_info:
            _validate_antall_dager({}, required=True, context="for spesifisering")
        assert "for spesifisering" in str(exc_info.value)

    def test_context_in_allow_zero_false_error(self):
        """Context string appears in allow_zero=False error."""
        with pytest.raises(ValidationError) as exc_info:
            _validate_antall_dager(
                {"antall_dager": 0}, allow_zero=False, context="for spesifisering"
            )
        assert "for spesifisering" in str(exc_info.value)

    def test_none_value_with_required_fails(self):
        """None value with required=True fails."""
        with pytest.raises(ValidationError) as exc_info:
            _validate_antall_dager({"antall_dager": None}, required=True)
        assert "antall_dager er påkrevd" in str(exc_info.value)


# ============================================================================
# _validate_varsel_type_field tests (Fase 3 helper)
# ============================================================================


class TestValidateVarselTypeField:
    """Tests for _validate_varsel_type_field helper function."""

    def test_valid_varsel_type_returns_value(self):
        """Valid varsel_type returns the value."""
        result = _validate_varsel_type_field(
            {"varsel_type": "varsel"}, ["varsel", "spesifisert"]
        )
        assert result == "varsel"

    def test_missing_varsel_type_fails(self):
        """Missing varsel_type raises ValidationError."""
        with pytest.raises(ValidationError) as exc_info:
            _validate_varsel_type_field({}, ["varsel", "spesifisert"])
        assert "varsel_type er påkrevd" in str(exc_info.value)
        assert exc_info.value.field == "varsel_type"
        assert "varsel_typer" in exc_info.value.valid_options

    def test_invalid_varsel_type_fails(self):
        """Invalid varsel_type raises ValidationError."""
        with pytest.raises(ValidationError) as exc_info:
            _validate_varsel_type_field(
                {"varsel_type": "ugyldig"}, ["varsel", "spesifisert"]
            )
        assert "Ugyldig varsel_type" in str(exc_info.value)
        assert exc_info.value.field == "varsel_type"

    def test_valid_options_in_error(self):
        """Valid options are included in error response."""
        with pytest.raises(ValidationError) as exc_info:
            _validate_varsel_type_field({}, ["a", "b", "c"])
        assert exc_info.value.valid_options["varsel_typer"] == ["a", "b", "c"]


# ============================================================================
# _validate_frist_varsel_info tests (Fase 3 helper)
# ============================================================================


class TestValidateFristVarselInfo:
    """Tests for _validate_frist_varsel_info helper function."""

    def test_varsel_type_requires_frist_varsel(self):
        """varsel_type='varsel' requires frist_varsel."""
        with pytest.raises(ValidationError) as exc_info:
            _validate_frist_varsel_info({}, "varsel")
        assert "frist_varsel er påkrevd" in str(exc_info.value)

    def test_varsel_type_with_frist_varsel_passes(self):
        """varsel_type='varsel' with frist_varsel passes."""
        _validate_frist_varsel_info(
            {"frist_varsel": {"dato_sendt": "2024-01-01"}}, "varsel"
        )

    def test_spesifisert_type_requires_spesifisert_varsel(self):
        """varsel_type='spesifisert' requires spesifisert_varsel."""
        with pytest.raises(ValidationError) as exc_info:
            _validate_frist_varsel_info({}, "spesifisert")
        assert "spesifisert_varsel er påkrevd" in str(exc_info.value)

    def test_spesifisert_type_requires_antall_dager(self):
        """varsel_type='spesifisert' requires antall_dager."""
        with pytest.raises(ValidationError) as exc_info:
            _validate_frist_varsel_info(
                {"spesifisert_varsel": {"dato_sendt": "2024-01-01"}}, "spesifisert"
            )
        assert "antall_dager er påkrevd" in str(exc_info.value)

    def test_spesifisert_type_complete_passes(self):
        """Complete spesifisert data passes validation."""
        _validate_frist_varsel_info(
            {"spesifisert_varsel": {"dato_sendt": "2024-01-01"}, "antall_dager": 10},
            "spesifisert",
        )

    def test_unknown_varsel_type_passes(self):
        """Unknown varsel_type passes (no specific validation)."""
        _validate_frist_varsel_info({}, "unknown_type")
