"""
Tests for FravikService.

Tests state computation from events through the approval chain.
"""
import pytest
from datetime import datetime, timezone, timedelta

from services.fravik_service import FravikService
from models.fravik_events import (
    FravikEventType,
    FravikStatus,
    FravikBeslutning,
    FravikRolle,
    MaskinType,
    MaskinData,
    SoknadOpprettetData,
    SoknadOppdatertData,
    MaskinVurderingData,
    BOIVurderingData,
    PLVurderingData,
    ArbeidsgruppeVurderingData,
    EierBeslutningData,
    SoknadOpprettetEvent,
    SoknadOppdatertEvent,
    SoknadSendtInnEvent,
    MaskinLagtTilEvent,
    MaskinFjernetEvent,
    BOIVurderingEvent,
    BOIReturnertevent,
    PLVurderingEvent,
    ArbeidsgruppeVurderingEvent,
    EierGodkjentEvent,
    EierAvslattEvent,
    EierDelvisGodkjentEvent,
)
from models.fravik_state import (
    FravikState,
    MaskinVurderingStatus,
)


class TestFravikServiceBasics:
    """Test basic FravikService functionality."""

    @pytest.fixture
    def service(self):
        """Create FravikService instance."""
        return FravikService()

    @pytest.fixture
    def base_time(self):
        """Base timestamp for events."""
        return datetime.now(timezone.utc)

    @pytest.fixture
    def soknad_opprettet_event(self, base_time):
        """Create a basic SoknadOpprettetEvent."""
        return SoknadOpprettetEvent(
            sak_id="FRAVIK-001",
            aktor="Søker Person",
            aktor_rolle=FravikRolle.SOKER,
            tidsstempel=base_time,
            data=SoknadOpprettetData(
                prosjekt_id="PROJ-001",
                prosjekt_navn="Test Prosjekt",
                prosjekt_nummer="P-123",
                soker_navn="Søker Person",
                soknad_type="machine",
            ),
        )

    def test_compute_state_empty_events(self, service):
        """Test that empty events raises error."""
        with pytest.raises(ValueError, match="Kan ikke beregne state uten events"):
            service.compute_state([])

    def test_compute_state_wrong_first_event(self, service, base_time):
        """Test that wrong first event raises error."""
        event = SoknadSendtInnEvent(
            sak_id="FRAVIK-001",
            aktor="Test",
            aktor_rolle=FravikRolle.SOKER,
            tidsstempel=base_time,
        )
        with pytest.raises(ValueError, match="Første event må være SOKNAD_OPPRETTET"):
            service.compute_state([event])

    def test_compute_state_basic(self, service, soknad_opprettet_event):
        """Test basic state computation from single event."""
        state = service.compute_state([soknad_opprettet_event])

        assert state.sak_id == "FRAVIK-001"
        assert state.prosjekt_id == "PROJ-001"
        assert state.prosjekt_navn == "Test Prosjekt"
        assert state.soker_navn == "Søker Person"
        assert state.status == FravikStatus.UTKAST
        assert state.antall_events == 1


class TestFravikServiceMaskiner:
    """Test maskin-related state computation."""

    @pytest.fixture
    def service(self):
        return FravikService()

    @pytest.fixture
    def base_time(self):
        return datetime.now(timezone.utc)

    @pytest.fixture
    def events_with_maskin(self, base_time):
        """Events for a søknad with one maskin."""
        return [
            SoknadOpprettetEvent(
                sak_id="FRAVIK-001",
                aktor="Søker",
                aktor_rolle=FravikRolle.SOKER,
                tidsstempel=base_time,
                data=SoknadOpprettetData(
                    prosjekt_id="PROJ-001",
                    prosjekt_navn="Test",
                    soker_navn="Søker",
                    soknad_type="machine",
                ),
            ),
            MaskinLagtTilEvent(
                sak_id="FRAVIK-001",
                aktor="Søker",
                aktor_rolle=FravikRolle.SOKER,
                tidsstempel=base_time + timedelta(minutes=1),
                data=MaskinData(
                    maskin_id="MASKIN-001",
                    maskin_type=MaskinType.GRAVEMASKIN,
                    start_dato="2025-02-01",
                    slutt_dato="2025-04-01",
                    begrunnelse="Ingen elektrisk alternativ",
                    markedsundersokelse=True,
                ),
            ),
        ]

    def test_maskin_lagt_til(self, service, events_with_maskin):
        """Test that maskin is added to state."""
        state = service.compute_state(events_with_maskin)

        assert state.antall_maskiner == 1
        assert "MASKIN-001" in state.maskiner
        maskin = state.maskiner["MASKIN-001"]
        assert maskin.maskin_type == MaskinType.GRAVEMASKIN
        assert maskin.markedsundersokelse is True

    def test_maskin_fjernet(self, service, events_with_maskin, base_time):
        """Test that maskin is removed from state."""
        events = events_with_maskin + [
            MaskinFjernetEvent(
                sak_id="FRAVIK-001",
                aktor="Søker",
                aktor_rolle=FravikRolle.SOKER,
                tidsstempel=base_time + timedelta(minutes=2),
                maskin_id="MASKIN-001",
            ),
        ]
        state = service.compute_state(events)

        assert state.antall_maskiner == 0
        assert "MASKIN-001" not in state.maskiner

    def test_multiple_maskiner(self, service, events_with_maskin, base_time):
        """Test multiple maskiner in søknad."""
        events = events_with_maskin + [
            MaskinLagtTilEvent(
                sak_id="FRAVIK-001",
                aktor="Søker",
                aktor_rolle=FravikRolle.SOKER,
                tidsstempel=base_time + timedelta(minutes=2),
                data=MaskinData(
                    maskin_id="MASKIN-002",
                    maskin_type=MaskinType.HJULLASTER,
                    start_dato="2025-02-15",
                    slutt_dato="2025-03-15",
                    begrunnelse="Spesialbehov",
                ),
            ),
        ]
        state = service.compute_state(events)

        assert state.antall_maskiner == 2
        assert "MASKIN-001" in state.maskiner
        assert "MASKIN-002" in state.maskiner


class TestFravikServiceGodkjenningsflyt:
    """Test the approval chain workflow."""

    @pytest.fixture
    def service(self):
        return FravikService()

    @pytest.fixture
    def base_time(self):
        return datetime.now(timezone.utc)

    @pytest.fixture
    def sendt_inn_events(self, base_time):
        """Events up to SENDT_INN status."""
        return [
            SoknadOpprettetEvent(
                sak_id="FRAVIK-001",
                aktor="Søker",
                aktor_rolle=FravikRolle.SOKER,
                tidsstempel=base_time,
                data=SoknadOpprettetData(
                    prosjekt_id="PROJ-001",
                    prosjekt_navn="Test",
                    soker_navn="Søker",
                    soknad_type="machine",
                ),
            ),
            MaskinLagtTilEvent(
                sak_id="FRAVIK-001",
                aktor="Søker",
                aktor_rolle=FravikRolle.SOKER,
                tidsstempel=base_time + timedelta(minutes=1),
                data=MaskinData(
                    maskin_id="MASKIN-001",
                    maskin_type=MaskinType.GRAVEMASKIN,
                    start_dato="2025-02-01",
                    slutt_dato="2025-04-01",
                    begrunnelse="Ingen elektrisk alternativ",
                ),
            ),
            SoknadSendtInnEvent(
                sak_id="FRAVIK-001",
                aktor="Søker",
                aktor_rolle=FravikRolle.SOKER,
                tidsstempel=base_time + timedelta(minutes=2),
            ),
        ]

    def test_sendt_inn_status(self, service, sendt_inn_events):
        """Test status after sending in."""
        state = service.compute_state(sendt_inn_events)

        assert state.status == FravikStatus.SENDT_INN
        assert state.sendt_inn_tidspunkt is not None

    def test_boi_vurdering_godkjent(self, service, sendt_inn_events, base_time):
        """Test BOI vurdering updates status."""
        events = sendt_inn_events + [
            BOIVurderingEvent(
                sak_id="FRAVIK-001",
                aktor="BOI Rådgiver",
                aktor_rolle=FravikRolle.BOI,
                tidsstempel=base_time + timedelta(minutes=3),
                data=BOIVurderingData(
                    dokumentasjon_tilstrekkelig=True,
                    maskin_vurderinger=[
                        MaskinVurderingData(
                            maskin_id="MASKIN-001",
                            beslutning=FravikBeslutning.GODKJENT,
                            kommentar="OK",
                        )
                    ],
                    samlet_anbefaling=FravikBeslutning.GODKJENT,
                ),
            ),
        ]
        state = service.compute_state(events)

        assert state.status == FravikStatus.UNDER_PL_VURDERING
        assert state.godkjenningskjede.boi_vurdering.fullfort is True
        assert state.maskiner["MASKIN-001"].boi_vurdering is not None
        assert state.maskiner["MASKIN-001"].boi_vurdering.beslutning == FravikBeslutning.GODKJENT

    def test_boi_returnert(self, service, sendt_inn_events, base_time):
        """Test BOI return for missing documentation."""
        events = sendt_inn_events + [
            BOIReturnertevent(
                sak_id="FRAVIK-001",
                aktor="BOI Rådgiver",
                aktor_rolle=FravikRolle.BOI,
                tidsstempel=base_time + timedelta(minutes=3),
                manglende_dokumentasjon="Mangler markedsundersøkelse",
            ),
        ]
        state = service.compute_state(events)

        assert state.status == FravikStatus.RETURNERT_FRA_BOI
        assert state.godkjenningskjede.boi_vurdering.fullfort is False
        assert state.godkjenningskjede.boi_vurdering.manglende_dokumentasjon == "Mangler markedsundersøkelse"

    def test_full_approval_chain(self, service, sendt_inn_events, base_time):
        """Test full approval chain to GODKJENT."""
        events = sendt_inn_events + [
            # BOI vurdering
            BOIVurderingEvent(
                sak_id="FRAVIK-001",
                aktor="BOI Rådgiver",
                aktor_rolle=FravikRolle.BOI,
                tidsstempel=base_time + timedelta(minutes=3),
                data=BOIVurderingData(
                    dokumentasjon_tilstrekkelig=True,
                    maskin_vurderinger=[
                        MaskinVurderingData(
                            maskin_id="MASKIN-001",
                            beslutning=FravikBeslutning.GODKJENT,
                        )
                    ],
                    samlet_anbefaling=FravikBeslutning.GODKJENT,
                ),
            ),
            # PL vurdering
            PLVurderingEvent(
                sak_id="FRAVIK-001",
                aktor="Prosjektleder",
                aktor_rolle=FravikRolle.PL,
                tidsstempel=base_time + timedelta(minutes=4),
                data=PLVurderingData(
                    dokumentasjon_tilstrekkelig=True,
                    anbefaling=FravikBeslutning.GODKJENT,
                    kommentar="Anbefales",
                ),
            ),
            # Arbeidsgruppe vurdering
            ArbeidsgruppeVurderingEvent(
                sak_id="FRAVIK-001",
                aktor="Arbeidsgruppe",
                aktor_rolle=FravikRolle.ARBEIDSGRUPPE,
                tidsstempel=base_time + timedelta(minutes=5),
                data=ArbeidsgruppeVurderingData(
                    maskin_vurderinger=[
                        MaskinVurderingData(
                            maskin_id="MASKIN-001",
                            beslutning=FravikBeslutning.GODKJENT,
                            vilkar=["Må bruke HVO100"],
                        )
                    ],
                    samlet_innstilling=FravikBeslutning.GODKJENT,
                ),
            ),
            # Eier godkjenner
            EierGodkjentEvent(
                sak_id="FRAVIK-001",
                aktor="Prosjekteier",
                aktor_rolle=FravikRolle.EIER,
                tidsstempel=base_time + timedelta(minutes=6),
                data=EierBeslutningData(
                    folger_arbeidsgruppen=True,
                    beslutning=FravikBeslutning.GODKJENT,
                ),
            ),
        ]
        state = service.compute_state(events)

        assert state.status == FravikStatus.GODKJENT
        assert state.endelig_beslutning == FravikBeslutning.GODKJENT
        assert state.endelig_beslutning_av == "Prosjekteier"
        assert state.er_ferdigbehandlet is True
        assert state.godkjenningskjede.gjeldende_steg == "ferdig"

    def test_eier_avslatt(self, service, sendt_inn_events, base_time):
        """Test full chain ending in rejection."""
        events = sendt_inn_events + [
            BOIVurderingEvent(
                sak_id="FRAVIK-001",
                aktor="BOI",
                aktor_rolle=FravikRolle.BOI,
                tidsstempel=base_time + timedelta(minutes=3),
                data=BOIVurderingData(
                    dokumentasjon_tilstrekkelig=True,
                    maskin_vurderinger=[
                        MaskinVurderingData(
                            maskin_id="MASKIN-001",
                            beslutning=FravikBeslutning.AVSLATT,
                        )
                    ],
                    samlet_anbefaling=FravikBeslutning.AVSLATT,
                ),
            ),
            PLVurderingEvent(
                sak_id="FRAVIK-001",
                aktor="PL",
                aktor_rolle=FravikRolle.PL,
                tidsstempel=base_time + timedelta(minutes=4),
                data=PLVurderingData(
                    dokumentasjon_tilstrekkelig=True,
                    anbefaling=FravikBeslutning.AVSLATT,
                ),
            ),
            ArbeidsgruppeVurderingEvent(
                sak_id="FRAVIK-001",
                aktor="AG",
                aktor_rolle=FravikRolle.ARBEIDSGRUPPE,
                tidsstempel=base_time + timedelta(minutes=5),
                data=ArbeidsgruppeVurderingData(
                    maskin_vurderinger=[
                        MaskinVurderingData(
                            maskin_id="MASKIN-001",
                            beslutning=FravikBeslutning.AVSLATT,
                        )
                    ],
                    samlet_innstilling=FravikBeslutning.AVSLATT,
                ),
            ),
            EierAvslattEvent(
                sak_id="FRAVIK-001",
                aktor="Eier",
                aktor_rolle=FravikRolle.EIER,
                tidsstempel=base_time + timedelta(minutes=6),
                data=EierBeslutningData(
                    folger_arbeidsgruppen=True,
                    beslutning=FravikBeslutning.AVSLATT,
                ),
            ),
        ]
        state = service.compute_state(events)

        assert state.status == FravikStatus.AVSLATT
        assert state.endelig_beslutning == FravikBeslutning.AVSLATT
        assert state.maskiner["MASKIN-001"].samlet_status == MaskinVurderingStatus.AVSLATT

    def test_delvis_godkjent(self, service, base_time):
        """Test partial approval with multiple machines."""
        events = [
            SoknadOpprettetEvent(
                sak_id="FRAVIK-001",
                aktor="Søker",
                aktor_rolle=FravikRolle.SOKER,
                tidsstempel=base_time,
                data=SoknadOpprettetData(
                    prosjekt_id="PROJ-001",
                    prosjekt_navn="Test",
                    soker_navn="Søker",
                    soknad_type="machine",
                ),
            ),
            MaskinLagtTilEvent(
                sak_id="FRAVIK-001",
                aktor="Søker",
                aktor_rolle=FravikRolle.SOKER,
                tidsstempel=base_time + timedelta(minutes=1),
                data=MaskinData(
                    maskin_id="MASKIN-001",
                    maskin_type=MaskinType.GRAVEMASKIN,
                    start_dato="2025-02-01",
                    slutt_dato="2025-04-01",
                    begrunnelse="Test 1",
                ),
            ),
            MaskinLagtTilEvent(
                sak_id="FRAVIK-001",
                aktor="Søker",
                aktor_rolle=FravikRolle.SOKER,
                tidsstempel=base_time + timedelta(minutes=2),
                data=MaskinData(
                    maskin_id="MASKIN-002",
                    maskin_type=MaskinType.HJULLASTER,
                    start_dato="2025-02-01",
                    slutt_dato="2025-04-01",
                    begrunnelse="Test 2",
                ),
            ),
            SoknadSendtInnEvent(
                sak_id="FRAVIK-001",
                aktor="Søker",
                aktor_rolle=FravikRolle.SOKER,
                tidsstempel=base_time + timedelta(minutes=3),
            ),
            BOIVurderingEvent(
                sak_id="FRAVIK-001",
                aktor="BOI",
                aktor_rolle=FravikRolle.BOI,
                tidsstempel=base_time + timedelta(minutes=4),
                data=BOIVurderingData(
                    dokumentasjon_tilstrekkelig=True,
                    maskin_vurderinger=[
                        MaskinVurderingData(maskin_id="MASKIN-001", beslutning=FravikBeslutning.GODKJENT),
                        MaskinVurderingData(maskin_id="MASKIN-002", beslutning=FravikBeslutning.AVSLATT),
                    ],
                    samlet_anbefaling=FravikBeslutning.DELVIS_GODKJENT,
                ),
            ),
            PLVurderingEvent(
                sak_id="FRAVIK-001",
                aktor="PL",
                aktor_rolle=FravikRolle.PL,
                tidsstempel=base_time + timedelta(minutes=5),
                data=PLVurderingData(
                    dokumentasjon_tilstrekkelig=True,
                    anbefaling=FravikBeslutning.DELVIS_GODKJENT,
                ),
            ),
            ArbeidsgruppeVurderingEvent(
                sak_id="FRAVIK-001",
                aktor="AG",
                aktor_rolle=FravikRolle.ARBEIDSGRUPPE,
                tidsstempel=base_time + timedelta(minutes=6),
                data=ArbeidsgruppeVurderingData(
                    maskin_vurderinger=[
                        MaskinVurderingData(maskin_id="MASKIN-001", beslutning=FravikBeslutning.GODKJENT),
                        MaskinVurderingData(maskin_id="MASKIN-002", beslutning=FravikBeslutning.AVSLATT),
                    ],
                    samlet_innstilling=FravikBeslutning.DELVIS_GODKJENT,
                ),
            ),
            EierDelvisGodkjentEvent(
                sak_id="FRAVIK-001",
                aktor="Eier",
                aktor_rolle=FravikRolle.EIER,
                tidsstempel=base_time + timedelta(minutes=7),
                data=EierBeslutningData(
                    folger_arbeidsgruppen=True,
                    beslutning=FravikBeslutning.DELVIS_GODKJENT,
                    maskin_beslutninger=[
                        MaskinVurderingData(maskin_id="MASKIN-001", beslutning=FravikBeslutning.GODKJENT),
                        MaskinVurderingData(maskin_id="MASKIN-002", beslutning=FravikBeslutning.AVSLATT),
                    ],
                ),
            ),
        ]
        state = service.compute_state(events)

        assert state.status == FravikStatus.DELVIS_GODKJENT
        assert state.endelig_beslutning == FravikBeslutning.DELVIS_GODKJENT
        assert state.antall_godkjente_maskiner == 1
        assert state.antall_avslatte_maskiner == 1
        assert state.maskiner["MASKIN-001"].samlet_status == MaskinVurderingStatus.GODKJENT
        assert state.maskiner["MASKIN-002"].samlet_status == MaskinVurderingStatus.AVSLATT


class TestFravikServiceComputedFields:
    """Test computed fields in FravikState."""

    @pytest.fixture
    def service(self):
        return FravikService()

    @pytest.fixture
    def base_time(self):
        return datetime.now(timezone.utc)

    def test_kan_sendes_inn_no_maskiner(self, service, base_time):
        """Test kan_sendes_inn is False without maskiner."""
        events = [
            SoknadOpprettetEvent(
                sak_id="FRAVIK-001",
                aktor="Søker",
                aktor_rolle=FravikRolle.SOKER,
                tidsstempel=base_time,
                data=SoknadOpprettetData(
                    prosjekt_id="PROJ-001",
                    prosjekt_navn="Test",
                    soker_navn="Søker",
                    soknad_type="machine",
                ),
            ),
        ]
        state = service.compute_state(events)

        assert state.kan_sendes_inn is False

    def test_kan_sendes_inn_with_maskiner(self, service, base_time):
        """Test kan_sendes_inn is True with maskiner."""
        events = [
            SoknadOpprettetEvent(
                sak_id="FRAVIK-001",
                aktor="Søker",
                aktor_rolle=FravikRolle.SOKER,
                tidsstempel=base_time,
                data=SoknadOpprettetData(
                    prosjekt_id="PROJ-001",
                    prosjekt_navn="Test",
                    soker_navn="Søker",
                    soknad_type="machine",
                ),
            ),
            MaskinLagtTilEvent(
                sak_id="FRAVIK-001",
                aktor="Søker",
                aktor_rolle=FravikRolle.SOKER,
                tidsstempel=base_time + timedelta(minutes=1),
                data=MaskinData(
                    maskin_id="MASKIN-001",
                    maskin_type=MaskinType.GRAVEMASKIN,
                    start_dato="2025-02-01",
                    slutt_dato="2025-04-01",
                    begrunnelse="Test",
                ),
            ),
        ]
        state = service.compute_state(events)

        assert state.kan_sendes_inn is True

    def test_neste_handling_utkast(self, service, base_time):
        """Test neste_handling for UTKAST status."""
        events = [
            SoknadOpprettetEvent(
                sak_id="FRAVIK-001",
                aktor="Søker",
                aktor_rolle=FravikRolle.SOKER,
                tidsstempel=base_time,
                data=SoknadOpprettetData(
                    prosjekt_id="PROJ-001",
                    prosjekt_navn="Test",
                    soker_navn="Søker",
                    soknad_type="machine",
                ),
            ),
        ]
        state = service.compute_state(events)

        assert state.neste_handling["rolle"] == FravikRolle.SOKER
        assert "Send inn" in state.neste_handling["handling"]

    def test_visningsstatus(self, service, base_time):
        """Test visningsstatus computed field."""
        events = [
            SoknadOpprettetEvent(
                sak_id="FRAVIK-001",
                aktor="Søker",
                aktor_rolle=FravikRolle.SOKER,
                tidsstempel=base_time,
                data=SoknadOpprettetData(
                    prosjekt_id="PROJ-001",
                    prosjekt_navn="Test",
                    soker_navn="Søker",
                    soknad_type="machine",
                ),
            ),
        ]
        state = service.compute_state(events)

        assert state.visningsstatus == "Utkast"


class TestFravikServiceStateToListeItem:
    """Test state_to_liste_item conversion."""

    def test_conversion(self):
        """Test converting FravikState to FravikListeItem."""
        service = FravikService()
        base_time = datetime.now(timezone.utc)

        events = [
            SoknadOpprettetEvent(
                sak_id="FRAVIK-001",
                aktor="Søker",
                aktor_rolle=FravikRolle.SOKER,
                tidsstempel=base_time,
                data=SoknadOpprettetData(
                    prosjekt_id="PROJ-001",
                    prosjekt_navn="Test Prosjekt",
                    prosjekt_nummer="P-123",
                    soker_navn="Søker Person",
                    soknad_type="machine",
                ),
            ),
        ]
        state = service.compute_state(events)
        liste_item = service.state_to_liste_item(state)

        assert liste_item.sak_id == "FRAVIK-001"
        assert liste_item.prosjekt_navn == "Test Prosjekt"
        assert liste_item.prosjekt_nummer == "P-123"
        assert liste_item.soker_navn == "Søker Person"
        assert liste_item.status == FravikStatus.UTKAST
        assert liste_item.visningsstatus == "Utkast"
