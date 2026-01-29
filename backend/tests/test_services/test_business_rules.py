"""
Tests for Business Rule Validators.

These tests ensure that business logic is properly enforced
before events can be persisted.
"""
import pytest
from services.business_rules import BusinessRuleValidator, ValidationResult
from services.timeline_service import TimelineService
from models.events import (
    SakOpprettetEvent,
    GrunnlagEvent,
    GrunnlagData,
    VederlagEvent,
    VederlagData,
    VederlagsMetode,
    FristEvent,
    FristData,
    FristVarselType,
    VarselInfo,
    ResponsEvent,
    GrunnlagResponsData,
    VederlagResponsData,
    EOUtstedtEvent,
    EOUtstedtData,
    EventType,
    SporType,
    GrunnlagResponsResultat,
    VederlagBeregningResultat
)


class TestBusinessRuleValidator:
    """Test the Business Rule Validator."""

    @pytest.fixture
    def validator(self):
        """Create validator instance."""
        return BusinessRuleValidator()

    @pytest.fixture
    def timeline_service(self):
        """Create timeline service for computing state."""
        return TimelineService()

    @pytest.fixture
    def base_state(self, timeline_service):
        """Create a base state with SAK_OPPRETTET and GRUNNLAG_SENT."""
        events = [
            SakOpprettetEvent(
                sak_id="TEST-001",
                aktor="TE User",
                aktor_rolle="TE",
                sakstittel="Test Case"
            ),
            GrunnlagEvent(
                sak_id="TEST-001",
                aktor="TE User",
                aktor_rolle="TE",
                data=GrunnlagData(
                    tittel="Test grunnlag",
                    hovedkategori="Risiko",
                    underkategori="Grunnforhold",
                    beskrivelse="Test beskrivelse",
                    dato_oppdaget="2025-01-01"
                )
            )
        ]
        return timeline_service.compute_state(events)

    # ========== ROLE CHECK TESTS ==========

    def test_te_can_send_grunnlag(self, validator, base_state):
        """Test that TE can create grunnlag."""
        event = GrunnlagEvent(
            sak_id="TEST-001",
            aktor="TE User",
            aktor_rolle="TE",
            data=GrunnlagData(
                tittel="Test grunnlag",
                hovedkategori="Test",
                underkategori="Test",
                beskrivelse="Test",
                dato_oppdaget="2025-01-01"
            )
        )

        result = validator.validate(event, base_state)
        assert result.is_valid

    def test_bh_cannot_send_grunnlag(self, validator, base_state):
        """Test that BH cannot create grunnlag (TE only)."""
        event = GrunnlagEvent(
            sak_id="TEST-001",
            aktor="BH User",
            aktor_rolle="BH",  # Wrong role!
            data=GrunnlagData(
                tittel="Test grunnlag",
                hovedkategori="Test",
                underkategori="Test",
                beskrivelse="Test",
                dato_oppdaget="2025-01-01"
            )
        )

        result = validator.validate(event, base_state)
        assert not result.is_valid
        assert result.violated_rule == "ROLE_CHECK"
        assert "Kun TE" in result.message

    def test_te_cannot_send_respons(self, validator, base_state):
        """Test that TE cannot send BH response."""
        event = ResponsEvent(
            event_type=EventType.RESPONS_GRUNNLAG,
            sak_id="TEST-001",
            aktor="TE User",
            aktor_rolle="TE",  # Wrong role!
            spor=SporType.GRUNNLAG,
            data=GrunnlagResponsData(
                resultat=GrunnlagResponsResultat.GODKJENT,
                begrunnelse="Test"
            )
        )

        result = validator.validate(event, base_state)
        assert not result.is_valid
        assert result.violated_rule == "ROLE_CHECK"
        assert "Kun BH" in result.message

    def test_bh_can_send_respons(self, validator, base_state):
        """Test that BH can send response."""
        event = ResponsEvent(
            event_type=EventType.RESPONS_GRUNNLAG,
            sak_id="TEST-001",
            aktor="BH User",
            aktor_rolle="BH",
            spor=SporType.GRUNNLAG,
            data=GrunnlagResponsData(
                resultat=GrunnlagResponsResultat.GODKJENT,
                begrunnelse="Test"
            )
        )

        result = validator.validate(event, base_state)
        assert result.is_valid

    # ========== GRUNNLAG REQUIRED TESTS ==========

    def test_vederlag_requires_grunnlag_sent(self, validator, timeline_service):
        """Test that vederlag cannot be sent without grunnlag."""
        # State with NO grunnlag
        events = [
            SakOpprettetEvent(
                sak_id="TEST-002",
                aktor="TE User",
                aktor_rolle="TE",
                sakstittel="Test"
            )
        ]
        state = timeline_service.compute_state(events)

        # Try to send vederlag without grunnlag
        vederlag_event = VederlagEvent(
            sak_id="TEST-002",
            aktor="TE User",
            aktor_rolle="TE",
            versjon=1,
            data=VederlagData(
                kostnads_overslag=100000.0,
                metode=VederlagsMetode.REGNINGSARBEID,
                begrunnelse="Test"
            )
        )

        result = validator.validate(vederlag_event, state)
        assert not result.is_valid
        assert result.violated_rule == "GRUNNLAG_REQUIRED"
        assert "Grunnlag må være sendt" in result.message

    def test_vederlag_allowed_with_grunnlag(self, validator, base_state):
        """Test that vederlag can be sent when grunnlag exists."""
        vederlag_event = VederlagEvent(
            sak_id="TEST-001",
            aktor="TE User",
            aktor_rolle="TE",
            versjon=1,
            data=VederlagData(
                kostnads_overslag=100000.0,
                metode=VederlagsMetode.REGNINGSARBEID,
                begrunnelse="Test"
            )
        )

        result = validator.validate(vederlag_event, base_state)
        assert result.is_valid

    def test_frist_requires_grunnlag_sent(self, validator, timeline_service):
        """Test that frist cannot be sent without grunnlag."""
        # State with NO grunnlag
        events = [
            SakOpprettetEvent(
                sak_id="TEST-003",
                aktor="TE User",
                aktor_rolle="TE",
                sakstittel="Test"
            )
        ]
        state = timeline_service.compute_state(events)

        # Try to send frist without grunnlag
        frist_event = FristEvent(
            sak_id="TEST-003",
            aktor="TE User",
            aktor_rolle="TE",
            versjon=1,
            data=FristData(
                varsel_type=FristVarselType.SPESIFISERT,
                spesifisert_varsel=VarselInfo(dato_sendt="2025-01-01", metode=["epost"]),
                antall_dager=14,
                begrunnelse="Test"
            )
        )

        result = validator.validate(frist_event, state)
        assert not result.is_valid
        assert "Grunnlag må være sendt" in result.message

    # ========== TRACK SENT TESTS ==========

    def test_cannot_respond_to_unsent_vederlag(self, validator, base_state):
        """Test that BH cannot respond to vederlag that hasn't been sent."""
        # base_state has NO vederlag sent yet

        response_event = ResponsEvent(
            event_type=EventType.RESPONS_VEDERLAG,
            sak_id="TEST-001",
            aktor="BH User",
            aktor_rolle="BH",
            spor=SporType.VEDERLAG,
            data=VederlagResponsData(
                beregnings_resultat=VederlagBeregningResultat.GODKJENT,
                begrunnelse="Test",
                total_godkjent_belop=100000.0
            )
        )

        result = validator.validate(response_event, base_state)
        assert not result.is_valid
        assert result.violated_rule == "TRACK_SENT"
        assert "ikke er sendt" in result.message

    def test_can_respond_to_sent_vederlag(self, validator, timeline_service):
        """Test that BH can respond to sent vederlag."""
        # Create state with vederlag sent
        events = [
            SakOpprettetEvent(
                sak_id="TEST-004",
                aktor="TE User",
                aktor_rolle="TE",
                sakstittel="Test"
            ),
            GrunnlagEvent(
                sak_id="TEST-004",
                aktor="TE User",
                aktor_rolle="TE",
                data=GrunnlagData(
                    tittel="Test grunnlag",
                    hovedkategori="Test",
                    underkategori="Test",
                    beskrivelse="Test",
                    dato_oppdaget="2025-01-01"
                )
            ),
            VederlagEvent(
                sak_id="TEST-004",
                aktor="TE User",
                aktor_rolle="TE",
                versjon=1,
                data=VederlagData(
                    kostnads_overslag=100000.0,
                    metode=VederlagsMetode.REGNINGSARBEID,
                    begrunnelse="Test"
                )
            )
        ]
        state = timeline_service.compute_state(events)

        response_event = ResponsEvent(
            event_type=EventType.RESPONS_VEDERLAG,
            sak_id="TEST-004",
            aktor="BH User",
            aktor_rolle="BH",
            spor=SporType.VEDERLAG,
            data=VederlagResponsData(
                beregnings_resultat=VederlagBeregningResultat.GODKJENT,
                begrunnelse="Approved",
                total_godkjent_belop=100000.0
            )
        )

        result = validator.validate(response_event, state)
        assert result.is_valid

    # ========== LOCKED GRUNNLAG TESTS ==========

    def test_cannot_update_locked_grunnlag(self, validator, timeline_service):
        """Test that locked grunnlag cannot be updated."""
        # Create state with approved (locked) grunnlag but pending vederlag
        # This keeps the case active (not OMFORENT) while grunnlag is locked
        events = [
            SakOpprettetEvent(
                sak_id="TEST-005",
                aktor="TE User",
                aktor_rolle="TE",
                sakstittel="Test"
            ),
            GrunnlagEvent(
                sak_id="TEST-005",
                aktor="TE User",
                aktor_rolle="TE",
                data=GrunnlagData(
                    tittel="Test grunnlag",
                    hovedkategori="Test",
                    underkategori="Test",
                    beskrivelse="Test",
                    dato_oppdaget="2025-01-01"
                )
            ),
            ResponsEvent(
                event_type=EventType.RESPONS_GRUNNLAG,
                sak_id="TEST-005",
                aktor="BH User",
                aktor_rolle="BH",
                spor=SporType.GRUNNLAG,
                data=GrunnlagResponsData(
                    resultat=GrunnlagResponsResultat.GODKJENT,  # This locks it!
                    begrunnelse="Approved"
                )
            ),
            # Add vederlag to keep case active
            VederlagEvent(
                sak_id="TEST-005",
                aktor="TE User",
                aktor_rolle="TE",
                versjon=1,
                data=VederlagData(
                    kostnads_overslag=100000.0,
                    metode=VederlagsMetode.REGNINGSARBEID,
                    begrunnelse="Test"
                )
            )
        ]
        state = timeline_service.compute_state(events)
        assert state.grunnlag.laast  # Verify it's locked
        assert state.overordnet_status != "OMFORENT"  # Case still active

        # Try to update locked grunnlag
        update_event = GrunnlagEvent(
            event_type=EventType.GRUNNLAG_OPPDATERT,  # Update event
            sak_id="TEST-005",
            aktor="TE User",
            aktor_rolle="TE",
            data=GrunnlagData(
                tittel="Updated grunnlag",
                hovedkategori="Updated",
                underkategori="Updated",
                beskrivelse="Updated",
                dato_oppdaget="2025-01-02"
            )
        )

        result = validator.validate(update_event, state)
        assert not result.is_valid
        assert result.violated_rule == "NOT_LOCKED"
        assert "låst" in result.message

    # ========== ACTIVE CLAIM TESTS ==========

    def test_cannot_update_nonexistent_vederlag(self, validator, base_state):
        """Test that you can't update vederlag that doesn't exist."""
        # base_state has NO vederlag

        update_event = VederlagEvent(
            event_type=EventType.VEDERLAG_KRAV_OPPDATERT,  # Update event
            sak_id="TEST-001",
            aktor="TE User",
            aktor_rolle="TE",
            versjon=2,  # Trying to update
            data=VederlagData(
                kostnads_overslag=150000.0,
                metode=VederlagsMetode.REGNINGSARBEID,
                begrunnelse="Updated"
            )
        )

        result = validator.validate(update_event, base_state)
        assert not result.is_valid
        assert result.violated_rule == "ACTIVE_CLAIM_EXISTS"

    def test_cannot_update_nonexistent_frist(self, validator, base_state):
        """Test that you can't update frist that doesn't exist."""
        # base_state has NO frist

        update_event = FristEvent(
            event_type=EventType.FRIST_KRAV_OPPDATERT,  # Update event
            sak_id="TEST-001",
            aktor="TE User",
            aktor_rolle="TE",
            versjon=2,  # Trying to update
            data=FristData(
                varsel_type=FristVarselType.SPESIFISERT,
                spesifisert_varsel=VarselInfo(dato_sendt="2025-01-01", metode=["epost"]),
                antall_dager=21,
                begrunnelse="Updated"
            )
        )

        result = validator.validate(update_event, base_state)
        assert not result.is_valid
        assert result.violated_rule == "ACTIVE_CLAIM_EXISTS"

    # ========== EO TESTS ==========

    def test_cannot_issue_eo_without_all_approved(self, validator, base_state):
        """Test that EO cannot be issued without all tracks approved."""
        # base_state only has grunnlag sent, not approved

        eo_event = EOUtstedtEvent(
            sak_id="TEST-001",
            aktor="BH User",
            aktor_rolle="BH",
            data=EOUtstedtData(
                eo_nummer="EO-001",
                beskrivelse="Test endringsordre",
                kompensasjon_belop=100000.0
            )
        )

        result = validator.validate(eo_event, base_state)
        assert not result.is_valid
        assert result.violated_rule == "EO_CAN_BE_ISSUED"

    def test_can_issue_eo_when_all_approved(self, validator, timeline_service):
        """Test that EO can be issued when all tracks are approved."""
        # Create state with all tracks approved
        events = [
            SakOpprettetEvent(
                sak_id="TEST-006",
                aktor="TE User",
                aktor_rolle="TE",
                sakstittel="Test"
            ),
            GrunnlagEvent(
                sak_id="TEST-006",
                aktor="TE User",
                aktor_rolle="TE",
                data=GrunnlagData(
                    tittel="Test grunnlag",
                    hovedkategori="Test",
                    underkategori="Test",
                    beskrivelse="Test",
                    dato_oppdaget="2025-01-01"
                )
            ),
            ResponsEvent(
                event_type=EventType.RESPONS_GRUNNLAG,
                sak_id="TEST-006",
                aktor="BH User",
                aktor_rolle="BH",
                spor=SporType.GRUNNLAG,
                data=GrunnlagResponsData(
                    resultat=GrunnlagResponsResultat.GODKJENT,
                    begrunnelse="Approved"
                )
            )
        ]
        state = timeline_service.compute_state(events)
        assert state.kan_utstede_eo  # Verify ready for EO

        eo_event = EOUtstedtEvent(
            sak_id="TEST-006",
            aktor="BH User",
            aktor_rolle="BH",
            data=EOUtstedtData(
                eo_nummer="EO-001",
                beskrivelse="Test endringsordre",
                kompensasjon_belop=100000.0
            )
        )

        result = validator.validate(eo_event, state)
        assert result.is_valid


class TestValidationResult:
    """Test the ValidationResult dataclass."""

    def test_valid_result(self):
        """Test creating a valid result."""
        result = ValidationResult(is_valid=True)
        assert result.is_valid
        assert result.message is None
        assert result.violated_rule is None

    def test_invalid_result_with_message(self):
        """Test creating an invalid result with message."""
        result = ValidationResult(
            is_valid=False,
            message="Test error message",
            violated_rule="TEST_RULE"
        )
        assert not result.is_valid
        assert result.message == "Test error message"
        assert result.violated_rule == "TEST_RULE"
