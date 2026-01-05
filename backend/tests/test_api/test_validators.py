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
    validate_grunnlag_event,
    validate_vederlag_event,
    validate_frist_event,
    validate_respons_event,
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
            field="test_field"
        )
        assert err.valid_options == {"options": ["a", "b", "c"]}
        assert err.field == "test_field"

    def test_to_dict(self):
        """ValidationError converts to dict for JSON responses."""
        err = ValidationError(
            "Error message",
            valid_options={"key": "value"},
            field="my_field"
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
            validate_grunnlag_event({
                "hovedkategori": "INVALID_KATEGORI",
                "underkategori": "test"
            })
        assert "Ugyldig hovedkategori" in str(exc_info.value)
        assert exc_info.value.field == "hovedkategori"

    def test_missing_underkategori(self):
        """Raises ValidationError when underkategori is missing."""
        with pytest.raises(ValidationError) as exc_info:
            validate_grunnlag_event({
                "hovedkategori": "ENDRING"
            })
        assert "underkategori er påkrevd" in str(exc_info.value)
        assert exc_info.value.field == "underkategori"

    def test_invalid_underkategori(self):
        """Raises ValidationError when underkategori doesn't match hovedkategori."""
        with pytest.raises(ValidationError) as exc_info:
            validate_grunnlag_event({
                "hovedkategori": "ENDRING",
                "underkategori": "INVALID_UNDERKATEGORI"
            })
        assert "Ugyldig underkategori" in str(exc_info.value)

    def test_missing_beskrivelse(self):
        """Raises ValidationError when beskrivelse is missing."""
        with pytest.raises(ValidationError) as exc_info:
            validate_grunnlag_event({
                "hovedkategori": "ENDRING",
                "underkategori": "EO",
                "dato_oppdaget": "2025-01-15"
            })
        assert "beskrivelse er påkrevd" in str(exc_info.value)

    def test_missing_dato_oppdaget(self):
        """Raises ValidationError when dato_oppdaget is missing."""
        with pytest.raises(ValidationError) as exc_info:
            validate_grunnlag_event({
                "hovedkategori": "ENDRING",
                "underkategori": "EO",
                "beskrivelse": "Test beskrivelse"
            })
        assert "dato_oppdaget er påkrevd" in str(exc_info.value)

    def test_valid_grunnlag_event(self):
        """Valid grunnlag event passes validation."""
        # Should not raise
        validate_grunnlag_event({
            "hovedkategori": "ENDRING",
            "underkategori": "EO",
            "beskrivelse": "Endring i prosjektering",
            "dato_oppdaget": "2025-01-15"
        })

    def test_valid_grunnlag_with_list_underkategori(self):
        """Valid grunnlag with multiple underkategorier passes validation."""
        validate_grunnlag_event({
            "hovedkategori": "ENDRING",
            "underkategori": ["EO", "IRREG"],
            "beskrivelse": "Multiple kategorier",
            "dato_oppdaget": "2025-01-15"
        })


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
            validate_vederlag_event({
                "begrunnelse": "Test"
            })
        assert "metode er påkrevd" in str(exc_info.value)
        assert exc_info.value.field == "metode"
        assert "metoder" in exc_info.value.valid_options

    def test_invalid_metode(self):
        """Raises ValidationError when metode is invalid."""
        with pytest.raises(ValidationError) as exc_info:
            validate_vederlag_event({
                "metode": "INVALID_METODE",
                "begrunnelse": "Test"
            })
        assert "Ukjent vederlagsmetode" in str(exc_info.value)

    def test_missing_belop_direkte_for_enhetspriser(self):
        """Raises ValidationError when belop_direkte missing for ENHETSPRISER."""
        with pytest.raises(ValidationError) as exc_info:
            validate_vederlag_event({
                "metode": "ENHETSPRISER",
                "begrunnelse": "Test"
            })
        assert "belop_direkte er påkrevd" in str(exc_info.value)

    def test_missing_belop_direkte_for_fastpris(self):
        """Raises ValidationError when belop_direkte missing for FASTPRIS_TILBUD."""
        with pytest.raises(ValidationError) as exc_info:
            validate_vederlag_event({
                "metode": "FASTPRIS_TILBUD",
                "begrunnelse": "Test"
            })
        assert "belop_direkte er påkrevd" in str(exc_info.value)

    def test_regningsarbeid_without_overslag_is_valid(self):
        """REGNINGSARBEID doesn't require kostnads_overslag (per §30.2)."""
        # Should not raise
        validate_vederlag_event({
            "metode": "REGNINGSARBEID",
            "begrunnelse": "Arbeid ikke utført ennå"
        })

    def test_missing_begrunnelse(self):
        """Raises ValidationError when begrunnelse is missing."""
        with pytest.raises(ValidationError) as exc_info:
            validate_vederlag_event({
                "metode": "ENHETSPRISER",
                "belop_direkte": 100000
            })
        assert "begrunnelse er påkrevd" in str(exc_info.value)

    def test_regningsarbeid_requires_varsel(self):
        """Raises ValidationError when regningsarbeid lacks required varsel."""
        with pytest.raises(ValidationError) as exc_info:
            validate_vederlag_event({
                "metode": "REGNINGSARBEID",
                "begrunnelse": "Test",
                "krever_regningsarbeid": True
            })
        assert "Regningsarbeid krever varsel" in str(exc_info.value)

    def test_rigg_drift_requires_varsel(self):
        """Raises ValidationError when rigg/drift lacks required varsel."""
        with pytest.raises(ValidationError) as exc_info:
            validate_vederlag_event({
                "metode": "REGNINGSARBEID",
                "begrunnelse": "Test",
                "inkluderer_rigg_drift": True
            })
        assert "Rigg/drift-kostnader krever særskilt varsel" in str(exc_info.value)

    def test_justert_ep_requires_varsel(self):
        """Raises ValidationError when justerte EP lacks required varsel."""
        with pytest.raises(ValidationError) as exc_info:
            validate_vederlag_event({
                "metode": "ENHETSPRISER",
                "belop_direkte": 100000,
                "begrunnelse": "Test",
                "krever_justert_ep": True
            })
        assert "Justerte enhetspriser krever varsel" in str(exc_info.value)

    def test_produktivitetstap_requires_varsel(self):
        """Raises ValidationError when produktivitetstap lacks varsel."""
        with pytest.raises(ValidationError) as exc_info:
            validate_vederlag_event({
                "metode": "REGNINGSARBEID",
                "begrunnelse": "Test",
                "inkluderer_produktivitetstap": True
            })
        assert "Produktivitetstap krever særskilt varsel" in str(exc_info.value)

    def test_valid_vederlag_event_enhetspriser(self):
        """Valid vederlag event with ENHETSPRISER passes."""
        validate_vederlag_event({
            "metode": "ENHETSPRISER",
            "belop_direkte": 150000,
            "begrunnelse": "Mengdeøkning på betong"
        })

    def test_valid_vederlag_event_regningsarbeid(self):
        """Valid vederlag event with REGNINGSARBEID passes."""
        validate_vederlag_event({
            "metode": "REGNINGSARBEID",
            "kostnads_overslag": 200000,
            "begrunnelse": "Tilleggsarbeid"
        })


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
            validate_frist_event({
                "begrunnelse": "Test"
            })
        assert "varsel_type er påkrevd" in str(exc_info.value)
        assert "varsel_typer" in exc_info.value.valid_options

    def test_invalid_varsel_type(self):
        """Raises ValidationError when varsel_type is invalid."""
        with pytest.raises(ValidationError) as exc_info:
            validate_frist_event({
                "varsel_type": "INVALID_TYPE",
                "begrunnelse": "Test"
            })
        assert "Ugyldig varsel_type" in str(exc_info.value)

    def test_missing_begrunnelse(self):
        """Raises ValidationError when begrunnelse is missing."""
        with pytest.raises(ValidationError) as exc_info:
            validate_frist_event({
                "varsel_type": "noytralt"
            })
        assert "begrunnelse er påkrevd" in str(exc_info.value)

    def test_noytralt_requires_noytralt_varsel(self):
        """Raises ValidationError when nøytralt varsel is missing."""
        with pytest.raises(ValidationError) as exc_info:
            validate_frist_event({
                "varsel_type": "noytralt",
                "begrunnelse": "Test"
            })
        assert "noytralt_varsel er påkrevd" in str(exc_info.value)

    def test_spesifisert_requires_spesifisert_varsel(self):
        """Raises ValidationError when spesifisert varsel is missing."""
        with pytest.raises(ValidationError) as exc_info:
            validate_frist_event({
                "varsel_type": "spesifisert",
                "begrunnelse": "Test"
            })
        assert "spesifisert_varsel er påkrevd" in str(exc_info.value)

    def test_spesifisert_requires_antall_dager(self):
        """Raises ValidationError when antall_dager missing for spesifisert."""
        with pytest.raises(ValidationError) as exc_info:
            validate_frist_event({
                "varsel_type": "spesifisert",
                "begrunnelse": "Test",
                "spesifisert_varsel": {"dato_sendt": "2025-01-15"}
            })
        assert "antall_dager er påkrevd" in str(exc_info.value)

    def test_negative_antall_dager(self):
        """Raises ValidationError when antall_dager is negative."""
        with pytest.raises(ValidationError) as exc_info:
            validate_frist_event({
                "varsel_type": "spesifisert",
                "begrunnelse": "Test",
                "spesifisert_varsel": {"dato_sendt": "2025-01-15"},
                "antall_dager": -5
            })
        assert "antall_dager må være >= 0" in str(exc_info.value)

    def test_valid_frist_noytralt(self):
        """Valid frist event with nøytralt passes."""
        validate_frist_event({
            "varsel_type": "noytralt",
            "begrunnelse": "Værforhold hindret arbeid",
            "noytralt_varsel": {"dato_sendt": "2025-01-15"}
        })

    def test_valid_frist_spesifisert(self):
        """Valid frist event with spesifisert passes."""
        validate_frist_event({
            "varsel_type": "spesifisert",
            "begrunnelse": "Forsinkelse på grunn av materiallevering",
            "spesifisert_varsel": {"dato_sendt": "2025-01-20"},
            "antall_dager": 14
        })


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
            validate_respons_event({
                "begrunnelse": "Test"
            }, "grunnlag")
        assert "resultat er påkrevd" in str(exc_info.value)

    def test_grunnlag_missing_begrunnelse(self):
        """Grunnlag response requires 'begrunnelse' field."""
        with pytest.raises(ValidationError) as exc_info:
            validate_respons_event({
                "resultat": "godkjent"
            }, "grunnlag")
        assert "begrunnelse er påkrevd" in str(exc_info.value)

    def test_valid_grunnlag_respons(self):
        """Valid grunnlag response passes validation."""
        validate_respons_event({
            "resultat": "godkjent",
            "begrunnelse": "Kravet aksepteres"
        }, "grunnlag")

    # --- Vederlag response tests ---

    def test_vederlag_missing_beregnings_resultat(self):
        """
        Vederlag response requires 'beregnings_resultat' field.

        NOTE: This test would have caught the bug where frontend sent 'resultat'
        instead of 'beregnings_resultat'.
        """
        with pytest.raises(ValidationError) as exc_info:
            validate_respons_event({
                "total_godkjent_belop": 100000
            }, "vederlag")
        assert "beregnings_resultat er påkrevd" in str(exc_info.value)

    def test_vederlag_wrong_field_name_resultat(self):
        """
        Vederlag response with 'resultat' instead of 'beregnings_resultat' fails.

        This is the exact bug we fixed: frontend was sending 'resultat' but
        backend expected 'beregnings_resultat'.
        """
        with pytest.raises(ValidationError) as exc_info:
            validate_respons_event({
                "resultat": "delvis_godkjent",  # Wrong field name!
                "total_godkjent_belop": 100000
            }, "vederlag")
        assert "beregnings_resultat er påkrevd" in str(exc_info.value)

    def test_valid_vederlag_respons(self):
        """Valid vederlag response with correct field name passes."""
        validate_respons_event({
            "beregnings_resultat": "delvis_godkjent",  # Correct field name
            "total_godkjent_belop": 100000
        }, "vederlag")

    def test_valid_vederlag_respons_godkjent(self):
        """Valid vederlag response with godkjent passes."""
        validate_respons_event({
            "beregnings_resultat": "godkjent",
            "total_godkjent_belop": 150000
        }, "vederlag")

    def test_valid_vederlag_respons_avslatt(self):
        """Valid vederlag response with avslått passes."""
        validate_respons_event({
            "beregnings_resultat": "avslatt",
            "total_godkjent_belop": 0
        }, "vederlag")

    # --- Frist response tests ---

    def test_frist_missing_beregnings_resultat(self):
        """Frist response requires 'beregnings_resultat' field."""
        with pytest.raises(ValidationError) as exc_info:
            validate_respons_event({
                "spesifisert_krav_ok": True,
                "vilkar_oppfylt": True
            }, "frist")
        assert "beregnings_resultat er påkrevd" in str(exc_info.value)

    def test_frist_missing_spesifisert_krav_ok(self):
        """Frist response requires 'spesifisert_krav_ok' field."""
        with pytest.raises(ValidationError) as exc_info:
            validate_respons_event({
                "beregnings_resultat": "godkjent",
                "vilkar_oppfylt": True
            }, "frist")
        assert "spesifisert_krav_ok er påkrevd" in str(exc_info.value)

    def test_frist_missing_vilkar_oppfylt(self):
        """Frist response requires 'vilkar_oppfylt' field."""
        with pytest.raises(ValidationError) as exc_info:
            validate_respons_event({
                "beregnings_resultat": "godkjent",
                "spesifisert_krav_ok": True
            }, "frist")
        assert "vilkar_oppfylt er påkrevd" in str(exc_info.value)

    def test_valid_frist_respons(self):
        """Valid frist response passes validation."""
        validate_respons_event({
            "beregnings_resultat": "godkjent",
            "spesifisert_krav_ok": True,
            "vilkar_oppfylt": True,
            "godkjent_dager": 14
        }, "frist")

    def test_frist_respons_with_false_values(self):
        """Frist response with False values for boolean fields passes."""
        # False is a valid value, not missing
        validate_respons_event({
            "beregnings_resultat": "avslatt",
            "spesifisert_krav_ok": False,
            "vilkar_oppfylt": False
        }, "frist")

    # --- Edge cases ---

    def test_unknown_spor_type(self):
        """Unknown spor_type doesn't raise (no specific validation)."""
        # Should not raise - just passes through
        validate_respons_event({
            "some_field": "value"
        }, "unknown_type")

    def test_empty_string_values_fail(self):
        """Empty string values are treated as missing."""
        with pytest.raises(ValidationError) as exc_info:
            validate_respons_event({
                "resultat": "",  # Empty string
                "begrunnelse": "Test"
            }, "grunnlag")
        assert "resultat er påkrevd" in str(exc_info.value)

    def test_none_values_fail(self):
        """None values are treated as missing."""
        with pytest.raises(ValidationError) as exc_info:
            validate_respons_event({
                "beregnings_resultat": None,
            }, "vederlag")
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
        validate_grunnlag_event({
            "hovedkategori": "ENDRING",
            "underkategori": "EO",
            "beskrivelse": "Endring i arkitektonisk utforming av fasade",
            "dato_oppdaget": "2025-01-15",
            "konsekvenser": {
                "tid": True,
                "kostnad": True,
                "kvalitet": False
            },
            "dokumentasjon": ["doc-123", "doc-456"]
        })

    def test_full_vederlag_respons_payload(self):
        """
        Full vederlag response payload from frontend passes.

        This mirrors the actual payload structure from RespondVederlagModal.tsx
        after the bug fix (using beregnings_resultat instead of resultat).
        """
        validate_respons_event({
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
            "begrunnelse": "Godkjenner 80% av kravet"
        }, "vederlag")

    def test_full_frist_respons_payload(self):
        """Full frist response payload from frontend passes."""
        validate_respons_event({
            "frist_krav_id": "event-456",

            # Vurdering
            "beregnings_resultat": "delvis_godkjent",
            "spesifisert_krav_ok": True,
            "vilkar_oppfylt": True,

            # Beløp
            "godkjent_dager": 10,
            "krevd_dager": 14,

            # Begrunnelse
            "begrunnelse": "Godkjenner 10 av 14 krevde dager"
        }, "frist")


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
        validate_vederlag_event({
            "metode": "ENHETSPRISER",
            "belop_direkte": 150000,
            "begrunnelse": "Revidert beløp etter BH tilbakemelding",
            "original_event_id": "event-123"
        })

    def test_update_with_belop_direkte_fastpris(self):
        """Update event with belop_direkte for FASTPRIS_TILBUD should pass."""
        validate_vederlag_event({
            "metode": "FASTPRIS_TILBUD",
            "belop_direkte": 200000,
            "begrunnelse": "Justert fastpris",
            "original_event_id": "event-456"
        })

    def test_update_with_kostnads_overslag_regningsarbeid(self):
        """Update event with kostnads_overslag for REGNINGSARBEID should pass."""
        validate_vederlag_event({
            "metode": "REGNINGSARBEID",
            "kostnads_overslag": 250000,
            "begrunnelse": "Økt kostnadsoverslag",
            "original_event_id": "event-789"
        })

    def test_update_missing_belop_direkte_enhetspriser(self):
        """Update without belop_direkte fails for ENHETSPRISER."""
        with pytest.raises(ValidationError) as exc_info:
            validate_vederlag_event({
                "metode": "ENHETSPRISER",
                "begrunnelse": "Mangler beløp",
                "original_event_id": "event-123"
            })
        assert "belop_direkte er påkrevd" in str(exc_info.value)

    def test_realistic_revise_vederlag_payload(self):
        """
        Realistic payload from ReviseVederlagModal.tsx should pass.

        Uses same field names as initial claim for consistency.
        """
        validate_vederlag_event({
            "original_event_id": "event-abc-123",
            "metode": "ENHETSPRISER",
            "belop_direkte": 175000,
            "krever_justert_ep": False,
            "begrunnelse": "Justerer beløpet basert på BH tilbakemelding om materialpriser",
            "dato_revidert": "2025-01-20"
        })

    def test_revise_with_method_change_to_regningsarbeid(self):
        """Revising claim with method change to REGNINGSARBEID should pass."""
        validate_vederlag_event({
            "original_event_id": "event-def-456",
            "metode": "REGNINGSARBEID",
            "kostnads_overslag": 300000,
            "varslet_for_oppstart": True,
            "begrunnelse": "Endrer til regningsarbeid etter BH ønske",
            "dato_revidert": "2025-01-20"
        })

    def test_revise_regningsarbeid_without_overslag_passes(self):
        """Revising REGNINGSARBEID without overslag should pass (per §30.2)."""
        validate_vederlag_event({
            "original_event_id": "event-ghi-789",
            "metode": "REGNINGSARBEID",
            "begrunnelse": "Oppdaterer varslingsstatus",
            "varslet_for_oppstart": True,
            "dato_revidert": "2025-01-20"
        })


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
        validate_frist_event({
            "original_event_id": "event-123",
            "antall_dager": 21,
            "begrunnelse": "Øker fristkrav basert på ny dokumentasjon"
        }, is_update=True)

    def test_update_missing_antall_dager(self):
        """Update without antall_dager should fail."""
        with pytest.raises(ValidationError) as exc_info:
            validate_frist_event({
                "original_event_id": "event-123",
                "begrunnelse": "Mangler antall dager"
            }, is_update=True)
        assert "antall_dager" in str(exc_info.value).lower()

    def test_update_negative_antall_dager(self):
        """Update with negative antall_dager should fail."""
        with pytest.raises(ValidationError) as exc_info:
            validate_frist_event({
                "original_event_id": "event-123",
                "antall_dager": -5,
                "begrunnelse": "Negativ dager"
            }, is_update=True)
        assert "må være >= 0" in str(exc_info.value)

    def test_realistic_revise_frist_payload(self):
        """
        Realistic payload from ReviseFristModal.tsx should pass.

        Uses same field names as initial claim for consistency.
        """
        validate_frist_event({
            "original_event_id": "event-frist-123",
            "antall_dager": 18,
            "begrunnelse": "Justerer fristkrav basert på oppdatert fremdriftsplan",
            "dato_revidert": "2025-01-20"
        }, is_update=True)


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
