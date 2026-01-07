"""
Tests for SakState computed properties.

These tests ensure computed properties handle edge cases correctly,
especially None values that could cause formatting errors.

These tests would have caught bugs like:
- visningsstatus_vederlag failing when godkjent_belop is None
- visningsstatus_frist failing when godkjent_dager is None
"""
import pytest
from models.sak_state import (
    SakState,
    GrunnlagTilstand,
    VederlagTilstand,
    FristTilstand,
    SaksType,
)
from models.events import (
    SporStatus,
    GrunnlagResponsResultat,
    VederlagBeregningResultat,
    FristBeregningResultat,
)


# ============================================================================
# Fixtures
# ============================================================================

@pytest.fixture
def minimal_sak_state():
    """Create a minimal SakState with default values."""
    return SakState(
        sak_id="TEST-001",
        sakstype=SaksType.STANDARD,
    )


@pytest.fixture
def sak_with_vederlag_delvis_godkjent():
    """SakState where vederlag is delvis_godkjent but godkjent_belop is None."""
    return SakState(
        sak_id="TEST-002",
        sakstype=SaksType.STANDARD,
        grunnlag=GrunnlagTilstand(
            status=SporStatus.GODKJENT,
            hovedkategori="ENDRING",
            underkategori="EO",
            beskrivelse="Test",
        ),
        vederlag=VederlagTilstand(
            status=SporStatus.DELVIS_GODKJENT,
            metode="ENHETSPRISER",
            belop_direkte=100000,
            bh_resultat=VederlagBeregningResultat.DELVIS_GODKJENT,
            # godkjent_belop is None - this was the bug!
        ),
    )


@pytest.fixture
def sak_with_frist_delvis_godkjent():
    """SakState where frist is delvis_godkjent but godkjent_dager is None."""
    return SakState(
        sak_id="TEST-003",
        sakstype=SaksType.STANDARD,
        grunnlag=GrunnlagTilstand(
            status=SporStatus.GODKJENT,
        ),
        frist=FristTilstand(
            status=SporStatus.DELVIS_GODKJENT,
            varsel_type="spesifisert",
            krevd_dager=14,
            bh_resultat=FristBeregningResultat.DELVIS_GODKJENT,
            # godkjent_dager is None - potential bug!
        ),
    )


# ============================================================================
# VederlagTilstand computed property tests
# ============================================================================

class TestVederlagTilstandComputed:
    """Tests for VederlagTilstand computed properties."""

    def test_krevd_belop_enhetspriser(self):
        """krevd_belop returns belop_direkte for ENHETSPRISER."""
        tilstand = VederlagTilstand(
            metode="ENHETSPRISER",
            belop_direkte=150000,
        )
        assert tilstand.krevd_belop == 150000

    def test_krevd_belop_regningsarbeid(self):
        """krevd_belop returns kostnads_overslag for REGNINGSARBEID."""
        tilstand = VederlagTilstand(
            metode="REGNINGSARBEID",
            kostnads_overslag=200000,
        )
        assert tilstand.krevd_belop == 200000

    def test_krevd_belop_none(self):
        """krevd_belop returns None when no amount set."""
        tilstand = VederlagTilstand(metode="ENHETSPRISER")
        assert tilstand.krevd_belop is None

    def test_differanse_both_set(self):
        """differanse calculated when both amounts are set."""
        tilstand = VederlagTilstand(
            metode="ENHETSPRISER",
            belop_direkte=150000,
            godkjent_belop=100000,
        )
        assert tilstand.differanse == 50000

    def test_differanse_none_when_missing(self):
        """differanse is None when either amount is missing."""
        tilstand = VederlagTilstand(
            metode="ENHETSPRISER",
            belop_direkte=150000,
            # godkjent_belop is None
        )
        assert tilstand.differanse is None

    def test_godkjenningsgrad_prosent(self):
        """godkjenningsgrad_prosent calculates percentage correctly."""
        tilstand = VederlagTilstand(
            metode="ENHETSPRISER",
            belop_direkte=200000,
            godkjent_belop=150000,
        )
        assert tilstand.godkjenningsgrad_prosent == 75.0

    def test_godkjenningsgrad_prosent_none_when_no_krevd(self):
        """godkjenningsgrad_prosent is None when krevd_belop is 0 or None."""
        tilstand = VederlagTilstand(
            metode="ENHETSPRISER",
            godkjent_belop=150000,
        )
        assert tilstand.godkjenningsgrad_prosent is None

    def test_har_subsidiaert_standpunkt_true(self):
        """har_subsidiaert_standpunkt is True when subsidiaer_resultat is set."""
        tilstand = VederlagTilstand(
            subsidiaer_resultat=VederlagBeregningResultat.GODKJENT,
        )
        assert tilstand.har_subsidiaert_standpunkt is True

    def test_har_subsidiaert_standpunkt_false(self):
        """har_subsidiaert_standpunkt is False when subsidiaer_resultat is None."""
        tilstand = VederlagTilstand()
        assert tilstand.har_subsidiaert_standpunkt is False

    def test_visningsstatus_godkjent(self):
        """visningsstatus returns 'godkjent' for godkjent result."""
        tilstand = VederlagTilstand(
            status=SporStatus.GODKJENT,
            bh_resultat=VederlagBeregningResultat.GODKJENT,
        )
        assert tilstand.visningsstatus == "godkjent"

    def test_visningsstatus_delvis_godkjent(self):
        """visningsstatus returns 'delvis_godkjent' for delvis result."""
        tilstand = VederlagTilstand(
            status=SporStatus.DELVIS_GODKJENT,
            bh_resultat=VederlagBeregningResultat.DELVIS_GODKJENT,
        )
        assert tilstand.visningsstatus == "delvis_godkjent"

    def test_visningsstatus_avslatt_med_subsidiaer(self):
        """visningsstatus shows subsidiary status when applicable."""
        tilstand = VederlagTilstand(
            status=SporStatus.AVSLATT,
            bh_resultat=VederlagBeregningResultat.AVSLATT,
            subsidiaer_resultat=VederlagBeregningResultat.GODKJENT,
        )
        assert tilstand.visningsstatus == "avslatt_subsidiaert_godkjent"


# ============================================================================
# FristTilstand computed property tests
# ============================================================================

class TestFristTilstandComputed:
    """Tests for FristTilstand computed properties."""

    def test_differanse_dager_both_set(self):
        """differanse_dager calculated when both are set."""
        tilstand = FristTilstand(
            krevd_dager=14,
            godkjent_dager=10,
        )
        assert tilstand.differanse_dager == 4

    def test_differanse_dager_none_when_missing(self):
        """differanse_dager is None when either is missing."""
        tilstand = FristTilstand(
            krevd_dager=14,
            # godkjent_dager is None
        )
        assert tilstand.differanse_dager is None

    def test_har_subsidiaert_standpunkt_true(self):
        """har_subsidiaert_standpunkt is True when subsidiaer_resultat is set."""
        tilstand = FristTilstand(
            subsidiaer_resultat=FristBeregningResultat.GODKJENT,
        )
        assert tilstand.har_subsidiaert_standpunkt is True

    def test_har_subsidiaert_standpunkt_false(self):
        """har_subsidiaert_standpunkt is False when subsidiaer_resultat is None."""
        tilstand = FristTilstand()
        assert tilstand.har_subsidiaert_standpunkt is False


# ============================================================================
# SakState.visningsstatus_vederlag tests (the bug we fixed)
# ============================================================================

class TestVisningsstatusVederlag:
    """
    Tests for SakState.visningsstatus_vederlag computed property.

    CRITICAL: These tests would have caught the bug where godkjent_belop
    being None caused a TypeError in f-string formatting.
    """

    def test_ikke_relevant(self, minimal_sak_state):
        """visningsstatus_vederlag returns 'Ikke aktuelt' for IKKE_RELEVANT."""
        assert minimal_sak_state.visningsstatus_vederlag == "Ikke aktuelt"

    def test_godkjent_with_belop(self):
        """visningsstatus_vederlag shows amount when godkjent with belop."""
        sak = SakState(
            sak_id="TEST",
            sakstype=SaksType.STANDARD,
            vederlag=VederlagTilstand(
                status=SporStatus.GODKJENT,
                godkjent_belop=150000,
            ),
        )
        assert "150,000 kr" in sak.visningsstatus_vederlag or "150000" in sak.visningsstatus_vederlag

    def test_godkjent_without_belop(self):
        """visningsstatus_vederlag handles None godkjent_belop for GODKJENT."""
        sak = SakState(
            sak_id="TEST",
            sakstype=SaksType.STANDARD,
            vederlag=VederlagTilstand(
                status=SporStatus.GODKJENT,
                # godkjent_belop is None
            ),
        )
        # Should not raise, should return a valid string
        result = sak.visningsstatus_vederlag
        assert isinstance(result, str)
        assert "Godkjent" in result

    def test_delvis_godkjent_with_belop(self):
        """visningsstatus_vederlag shows amount when delvis_godkjent with belop."""
        sak = SakState(
            sak_id="TEST",
            sakstype=SaksType.STANDARD,
            vederlag=VederlagTilstand(
                status=SporStatus.DELVIS_GODKJENT,
                godkjent_belop=100000,
            ),
        )
        assert "Delvis godkjent" in sak.visningsstatus_vederlag

    def test_delvis_godkjent_without_belop(self):
        """
        visningsstatus_vederlag handles None godkjent_belop for DELVIS_GODKJENT.

        THIS IS THE EXACT BUG WE FIXED.
        Before the fix, this would raise:
        TypeError: unsupported format string passed to NoneType.__format__
        """
        sak = SakState(
            sak_id="TEST",
            sakstype=SaksType.STANDARD,
            vederlag=VederlagTilstand(
                status=SporStatus.DELVIS_GODKJENT,
                # godkjent_belop is None - this was causing the crash!
            ),
        )
        # Should not raise, should return a valid string with fallback
        result = sak.visningsstatus_vederlag
        assert isinstance(result, str)
        assert "Delvis godkjent" in result
        # The fix uses "beløp" as fallback text
        assert "beløp" in result

    def test_avslatt(self):
        """visningsstatus_vederlag returns 'Avvist' for AVSLATT."""
        sak = SakState(
            sak_id="TEST",
            sakstype=SaksType.STANDARD,
            vederlag=VederlagTilstand(
                status=SporStatus.AVSLATT,
            ),
        )
        assert sak.visningsstatus_vederlag == "Avvist"

    def test_sendt(self):
        """visningsstatus_vederlag returns waiting message for SENDT."""
        sak = SakState(
            sak_id="TEST",
            sakstype=SaksType.STANDARD,
            vederlag=VederlagTilstand(
                status=SporStatus.SENDT,
            ),
        )
        assert "venter" in sak.visningsstatus_vederlag.lower()

    def test_under_behandling(self):
        """visningsstatus_vederlag returns 'Under behandling' for that status."""
        sak = SakState(
            sak_id="TEST",
            sakstype=SaksType.STANDARD,
            vederlag=VederlagTilstand(
                status=SporStatus.UNDER_BEHANDLING,
            ),
        )
        assert sak.visningsstatus_vederlag == "Under behandling"

    def test_force_majeure(self):
        """visningsstatus_vederlag handles Force Majeure correctly."""
        sak = SakState(
            sak_id="TEST",
            sakstype=SaksType.STANDARD,
            grunnlag=GrunnlagTilstand(
                status=SporStatus.GODKJENT,
                bh_resultat=GrunnlagResponsResultat.ERKJENN_FM,  # Force Majeure
            ),
            vederlag=VederlagTilstand(
                status=SporStatus.SENDT,
            ),
        )
        assert "Force Majeure" in sak.visningsstatus_vederlag

    def test_subsidiaert_with_belop(self):
        """visningsstatus_vederlag shows subsidiary info when applicable."""
        sak = SakState(
            sak_id="TEST",
            sakstype=SaksType.STANDARD,
            grunnlag=GrunnlagTilstand(
                status=SporStatus.AVSLATT,
            ),
            vederlag=VederlagTilstand(
                status=SporStatus.AVSLATT,  # Will be recalculated
                bh_resultat=VederlagBeregningResultat.GODKJENT,
                godkjent_belop=100000,
            ),
        )
        result = sak.visningsstatus_vederlag
        assert "Subsidiært" in result

    def test_subsidiaert_without_belop(self):
        """visningsstatus_vederlag handles subsidiary with None belop."""
        sak = SakState(
            sak_id="TEST",
            sakstype=SaksType.STANDARD,
            grunnlag=GrunnlagTilstand(
                status=SporStatus.AVSLATT,
            ),
            vederlag=VederlagTilstand(
                status=SporStatus.AVSLATT,
                bh_resultat=VederlagBeregningResultat.GODKJENT,
                # godkjent_belop is None
            ),
        )
        # Should not raise
        result = sak.visningsstatus_vederlag
        assert isinstance(result, str)
        assert "Subsidiært" in result


# ============================================================================
# SakState.visningsstatus_frist tests
# ============================================================================

class TestVisningsstatusFrist:
    """
    Tests for SakState.visningsstatus_frist computed property.

    These tests ensure godkjent_dager None is handled correctly.
    """

    def test_ikke_relevant(self, minimal_sak_state):
        """visningsstatus_frist returns 'Ikke aktuelt' for IKKE_RELEVANT."""
        assert minimal_sak_state.visningsstatus_frist == "Ikke aktuelt"

    def test_godkjent_with_dager(self):
        """visningsstatus_frist shows days when godkjent with dager."""
        sak = SakState(
            sak_id="TEST",
            sakstype=SaksType.STANDARD,
            frist=FristTilstand(
                status=SporStatus.GODKJENT,
                godkjent_dager=14,
            ),
        )
        assert "14" in sak.visningsstatus_frist
        assert "dager" in sak.visningsstatus_frist

    def test_godkjent_without_dager(self):
        """visningsstatus_frist handles None godkjent_dager for GODKJENT."""
        sak = SakState(
            sak_id="TEST",
            sakstype=SaksType.STANDARD,
            frist=FristTilstand(
                status=SporStatus.GODKJENT,
                # godkjent_dager is None
            ),
        )
        # Should not raise
        result = sak.visningsstatus_frist
        assert isinstance(result, str)
        assert "Godkjent" in result

    def test_delvis_godkjent_with_dager(self):
        """visningsstatus_frist shows days when delvis_godkjent."""
        sak = SakState(
            sak_id="TEST",
            sakstype=SaksType.STANDARD,
            frist=FristTilstand(
                status=SporStatus.DELVIS_GODKJENT,
                godkjent_dager=10,
            ),
        )
        result = sak.visningsstatus_frist
        assert "Delvis godkjent" in result
        assert "10" in result

    def test_delvis_godkjent_without_dager(self):
        """
        visningsstatus_frist handles None godkjent_dager for DELVIS_GODKJENT.

        This was a bug similar to the vederlag one - returned "None dager".
        """
        sak = SakState(
            sak_id="TEST",
            sakstype=SaksType.STANDARD,
            frist=FristTilstand(
                status=SporStatus.DELVIS_GODKJENT,
                # godkjent_dager is None
            ),
        )
        result = sak.visningsstatus_frist
        assert isinstance(result, str)
        assert "Delvis godkjent" in result
        # Should NOT contain "None" - use fallback text instead
        assert "None" not in result
        # The fix uses "dager" as fallback text
        assert "dager" in result

    def test_avslatt(self):
        """visningsstatus_frist returns 'Avvist' for AVSLATT."""
        sak = SakState(
            sak_id="TEST",
            sakstype=SaksType.STANDARD,
            frist=FristTilstand(
                status=SporStatus.AVSLATT,
            ),
        )
        assert sak.visningsstatus_frist == "Avvist"

    def test_sendt(self):
        """visningsstatus_frist returns waiting message for SENDT."""
        sak = SakState(
            sak_id="TEST",
            sakstype=SaksType.STANDARD,
            frist=FristTilstand(
                status=SporStatus.SENDT,
            ),
        )
        assert "venter" in sak.visningsstatus_frist.lower()

    def test_subsidiaert_with_dager(self):
        """visningsstatus_frist shows subsidiary info when applicable."""
        sak = SakState(
            sak_id="TEST",
            sakstype=SaksType.STANDARD,
            grunnlag=GrunnlagTilstand(
                status=SporStatus.AVSLATT,
            ),
            frist=FristTilstand(
                status=SporStatus.AVSLATT,
                bh_resultat=FristBeregningResultat.GODKJENT,
                godkjent_dager=14,
            ),
        )
        result = sak.visningsstatus_frist
        assert "Subsidiært" in result

    def test_subsidiaert_without_dager(self):
        """visningsstatus_frist handles subsidiary with None dager."""
        sak = SakState(
            sak_id="TEST",
            sakstype=SaksType.STANDARD,
            grunnlag=GrunnlagTilstand(
                status=SporStatus.AVSLATT,
            ),
            frist=FristTilstand(
                status=SporStatus.AVSLATT,
                bh_resultat=FristBeregningResultat.GODKJENT,
                # godkjent_dager is None
            ),
        )
        # Should not raise
        result = sak.visningsstatus_frist
        assert isinstance(result, str)
        assert "Subsidiært" in result


# ============================================================================
# SakState.overordnet_status tests
# ============================================================================

class TestOverordnetStatus:
    """Tests for SakState.overordnet_status computed property."""

    def test_ingen_aktive_spor(self, minimal_sak_state):
        """overordnet_status returns INGEN_AKTIVE_SPOR when all are IKKE_RELEVANT."""
        assert minimal_sak_state.overordnet_status == "INGEN_AKTIVE_SPOR"

    def test_utkast(self):
        """overordnet_status returns UTKAST when all are UTKAST."""
        sak = SakState(
            sak_id="TEST",
            sakstype=SaksType.STANDARD,
            grunnlag=GrunnlagTilstand(status=SporStatus.UTKAST),
            vederlag=VederlagTilstand(status=SporStatus.UTKAST),
        )
        assert sak.overordnet_status == "UTKAST"

    def test_venter_paa_svar(self):
        """overordnet_status returns VENTER_PAA_SVAR when any is SENDT."""
        sak = SakState(
            sak_id="TEST",
            sakstype=SaksType.STANDARD,
            grunnlag=GrunnlagTilstand(status=SporStatus.SENDT),
        )
        assert sak.overordnet_status == "VENTER_PAA_SVAR"

    def test_under_behandling(self):
        """overordnet_status returns UNDER_BEHANDLING when any is that."""
        sak = SakState(
            sak_id="TEST",
            sakstype=SaksType.STANDARD,
            grunnlag=GrunnlagTilstand(status=SporStatus.UNDER_BEHANDLING),
        )
        assert sak.overordnet_status == "UNDER_BEHANDLING"

    def test_under_forhandling(self):
        """overordnet_status returns UNDER_FORHANDLING when any is rejected."""
        sak = SakState(
            sak_id="TEST",
            sakstype=SaksType.STANDARD,
            grunnlag=GrunnlagTilstand(status=SporStatus.AVSLATT),
        )
        assert sak.overordnet_status == "UNDER_FORHANDLING"

    def test_omforent(self):
        """overordnet_status returns OMFORENT when all active are GODKJENT."""
        sak = SakState(
            sak_id="TEST",
            sakstype=SaksType.STANDARD,
            grunnlag=GrunnlagTilstand(status=SporStatus.GODKJENT),
            vederlag=VederlagTilstand(status=SporStatus.GODKJENT),
            frist=FristTilstand(status=SporStatus.GODKJENT),
        )
        assert sak.overordnet_status == "OMFORENT"

    def test_omforent_with_laast(self):
        """overordnet_status returns OMFORENT when tracks are GODKJENT or LAAST."""
        sak = SakState(
            sak_id="TEST",
            sakstype=SaksType.STANDARD,
            grunnlag=GrunnlagTilstand(status=SporStatus.LAAST),
            vederlag=VederlagTilstand(status=SporStatus.GODKJENT),
        )
        assert sak.overordnet_status == "OMFORENT"

    def test_not_omforent_with_utkast_tracks(self):
        """UTKAST tracks should prevent OMFORENT status."""
        sak = SakState(
            sak_id="TEST",
            sakstype=SaksType.STANDARD,
            grunnlag=GrunnlagTilstand(status=SporStatus.GODKJENT),
            vederlag=VederlagTilstand(status=SporStatus.UTKAST),
            frist=FristTilstand(status=SporStatus.UTKAST),
        )
        # Saken er IKKE omforent fordi vederlag/frist fortsatt kan sendes
        assert sak.overordnet_status != "OMFORENT"
        assert sak.overordnet_status == "UTKAST"


# ============================================================================
# SakState.er_subsidiaert tests
# ============================================================================

class TestErSubsidiaert:
    """Tests for er_subsidiaert_vederlag and er_subsidiaert_frist."""

    def test_er_subsidiaert_vederlag_true(self):
        """er_subsidiaert_vederlag is True when grunnlag avslått but vederlag godkjent."""
        sak = SakState(
            sak_id="TEST",
            sakstype=SaksType.STANDARD,
            grunnlag=GrunnlagTilstand(status=SporStatus.AVSLATT),
            vederlag=VederlagTilstand(
                status=SporStatus.DELVIS_GODKJENT,
                bh_resultat=VederlagBeregningResultat.DELVIS_GODKJENT,
            ),
        )
        assert sak.er_subsidiaert_vederlag is True

    def test_er_subsidiaert_vederlag_false_grunnlag_godkjent(self):
        """er_subsidiaert_vederlag is False when grunnlag is godkjent."""
        sak = SakState(
            sak_id="TEST",
            sakstype=SaksType.STANDARD,
            grunnlag=GrunnlagTilstand(status=SporStatus.GODKJENT),
            vederlag=VederlagTilstand(
                bh_resultat=VederlagBeregningResultat.GODKJENT,
            ),
        )
        assert sak.er_subsidiaert_vederlag is False

    def test_er_subsidiaert_vederlag_false_force_majeure(self):
        """er_subsidiaert_vederlag is False for Force Majeure."""
        sak = SakState(
            sak_id="TEST",
            sakstype=SaksType.STANDARD,
            grunnlag=GrunnlagTilstand(
                status=SporStatus.GODKJENT,
                bh_resultat=GrunnlagResponsResultat.ERKJENN_FM,  # Force Majeure
            ),
            vederlag=VederlagTilstand(
                bh_resultat=VederlagBeregningResultat.GODKJENT,
            ),
        )
        assert sak.er_subsidiaert_vederlag is False

    def test_er_subsidiaert_frist_true(self):
        """er_subsidiaert_frist is True when grunnlag avslått but frist godkjent."""
        sak = SakState(
            sak_id="TEST",
            sakstype=SaksType.STANDARD,
            grunnlag=GrunnlagTilstand(status=SporStatus.AVSLATT),
            frist=FristTilstand(
                bh_resultat=FristBeregningResultat.GODKJENT,
            ),
        )
        assert sak.er_subsidiaert_frist is True

    def test_er_subsidiaert_frist_false(self):
        """er_subsidiaert_frist is False when grunnlag is not avslått."""
        sak = SakState(
            sak_id="TEST",
            sakstype=SaksType.STANDARD,
            grunnlag=GrunnlagTilstand(status=SporStatus.GODKJENT),
            frist=FristTilstand(
                bh_resultat=FristBeregningResultat.GODKJENT,
            ),
        )
        assert sak.er_subsidiaert_frist is False


# ============================================================================
# SakState.kan_utstede_eo tests
# ============================================================================

class TestKanUtstedeEo:
    """Tests for SakState.kan_utstede_eo computed property."""

    def test_kan_utstede_true(self):
        """kan_utstede_eo is True when all tracks are godkjent."""
        sak = SakState(
            sak_id="TEST",
            sakstype=SaksType.STANDARD,
            grunnlag=GrunnlagTilstand(status=SporStatus.GODKJENT),
            vederlag=VederlagTilstand(status=SporStatus.GODKJENT),
            frist=FristTilstand(status=SporStatus.GODKJENT),
        )
        assert sak.kan_utstede_eo is True

    def test_kan_utstede_false_grunnlag_ikke_godkjent(self):
        """kan_utstede_eo is False when grunnlag is not godkjent."""
        sak = SakState(
            sak_id="TEST",
            sakstype=SaksType.STANDARD,
            grunnlag=GrunnlagTilstand(status=SporStatus.SENDT),
        )
        assert sak.kan_utstede_eo is False

    def test_kan_utstede_false_grunnlag_ikke_relevant(self):
        """kan_utstede_eo is False when grunnlag is IKKE_RELEVANT."""
        sak = SakState(
            sak_id="TEST",
            sakstype=SaksType.STANDARD,
            grunnlag=GrunnlagTilstand(status=SporStatus.IKKE_RELEVANT),
        )
        assert sak.kan_utstede_eo is False


# ============================================================================
# Model serialization tests (model_dump)
# ============================================================================

class TestModelSerialization:
    """
    Tests that model_dump() works correctly with computed properties.

    The original bug was triggered during model_dump() when serializing
    the visningsstatus_vederlag computed property.
    """

    def test_model_dump_with_none_values(self, sak_with_vederlag_delvis_godkjent):
        """
        model_dump() should not raise even when computed properties
        reference None values.

        THIS WAS THE EXACT SCENARIO CAUSING THE BUG.
        """
        # This should not raise TypeError
        result = sak_with_vederlag_delvis_godkjent.model_dump(mode='json')

        assert isinstance(result, dict)
        assert 'visningsstatus_vederlag' in result
        assert isinstance(result['visningsstatus_vederlag'], str)

    def test_model_dump_frist_none_values(self, sak_with_frist_delvis_godkjent):
        """model_dump() handles frist with None godkjent_dager."""
        # This should not raise
        result = sak_with_frist_delvis_godkjent.model_dump(mode='json')

        assert isinstance(result, dict)
        assert 'visningsstatus_frist' in result

    def test_model_dump_minimal(self, minimal_sak_state):
        """model_dump() works with minimal state."""
        result = minimal_sak_state.model_dump(mode='json')

        assert isinstance(result, dict)
        assert result['sak_id'] == 'TEST-001'
        assert 'visningsstatus_vederlag' in result
        assert 'visningsstatus_frist' in result
        assert 'overordnet_status' in result
