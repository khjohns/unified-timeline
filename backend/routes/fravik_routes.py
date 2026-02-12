"""
Fravik Routes Blueprint

REST API for fravik-søknader (fravik fra utslippsfrie krav på byggeplasser).

Endpoints:
- POST /api/fravik/opprett - Opprett ny søknad
- GET /api/fravik/<sak_id>/state - Hent tilstand
- GET /api/fravik/<sak_id>/events - Hent event-logg
- POST /api/fravik/<sak_id>/events - Send event
- GET /api/fravik/liste - Liste over søknader
- POST /api/fravik/<sak_id>/maskin - Legg til maskin
- DELETE /api/fravik/<sak_id>/maskin/<maskin_id> - Fjern maskin
- POST /api/fravik/<sak_id>/send-inn - Send inn søknad
- POST /api/fravik/<sak_id>/miljo-vurdering - Miljørådgiver vurdering
- POST /api/fravik/<sak_id>/pl-vurdering - Prosjektleder vurdering
- POST /api/fravik/<sak_id>/arbeidsgruppe-vurdering - Arbeidsgruppe vurdering
- POST /api/fravik/<sak_id>/eier-beslutning - Eier beslutning
"""

from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from flask import Blueprint, jsonify, request

from lib.auth.csrf_protection import require_csrf
from lib.auth.magic_link import require_magic_link
from lib.auth.project_access import require_project_access
from lib.decorators import handle_service_errors
from lib.helpers.version_control import (
    handle_concurrency_error,
    not_found_response,
    version_conflict_response,
)
from models.fravik_events import (
    ArbeidsgruppeVurderingData,
    ArbeidsgruppeVurderingEvent,
    EierAvslattEvent,
    EierBeslutningData,
    EierDelvisGodkjentEvent,
    EierGodkjentEvent,
    FravikEventType,
    FravikRolle,
    MaskinData,
    MaskinLagtTilEvent,
    MaskinVurderingData,
    MiljoVurderingData,
    MiljoVurderingEvent,
    PLVurderingData,
    PLVurderingEvent,
    SoknadOppdatertData,
    SoknadOppdatertEvent,
    SoknadOpprettetData,
    SoknadOpprettetEvent,
    SoknadSendtInnEvent,
    parse_fravik_event,
)
from repositories.event_repository import ConcurrencyError
from services.fravik_service import fravik_service
from utils.logger import get_logger

logger = get_logger(__name__)

# Create Blueprint
fravik_bp = Blueprint("fravik", __name__)


# ---------------------------------------------------------------------------
# Dependency access via Container
# ---------------------------------------------------------------------------


def _get_event_repo():
    """Hent EventRepository fra Container."""
    from core.container import get_container

    return get_container().event_repository


def _generate_sak_id() -> str:
    """Genererer unik sak-ID for fravik-søknad."""
    timestamp = datetime.now().strftime("%Y%m%d")
    unique = str(uuid4())[:8].upper()
    return f"FRAVIK-{timestamp}-{unique}"


def _get_events_for_sak(sak_id: str) -> tuple[list, int]:
    """Henter events for en søknad."""
    try:
        # Specify sakstype for direct table lookup (more efficient)
        events_data, version = _get_event_repo().get_events(sak_id, sakstype="fravik")
        events = [parse_fravik_event(e) for e in events_data]
        return events, version
    except FileNotFoundError:
        return [], 0


def _append_event(sak_id: str, event: Any, expected_version: int) -> int:
    """Legger til en event i event-loggen."""
    # Pass event object directly - repository handles serialization
    # sakstype auto-detects from event_type prefix 'fravik_'
    new_version = _get_event_repo().append(event, expected_version)
    return new_version


# =============================================================================
# OPPRETT SØKNAD
# =============================================================================


@fravik_bp.route("/api/fravik/opprett", methods=["POST"])
@require_csrf
@require_magic_link
@require_project_access(min_role="member")
@handle_service_errors
def opprett_fravik_soknad():
    """
    Opprett en ny fravik-søknad.

    Request:
    {
        "prosjekt_navn": "Nye Deichman",
        "prosjekt_nummer": "P-2025-001",
        "soker_navn": "Ola Nordmann",
        "soker_epost": "ola@firma.no",
        "soknad_type": "machine",
        "aktor": "Ola Nordmann"
    }

    Response 201:
    {
        "success": true,
        "sak_id": "FRAVIK-20250115-ABC123",
        "version": 1,
        "state": { ... FravikState ... }
    }
    """
    payload = request.json

    # Valider påkrevde felt
    required_fields = [
        "prosjekt_navn",
        "prosjekt_nummer",
        "soker_navn",
        "soknad_type",
        "aktor",
    ]
    missing = [f for f in required_fields if not payload.get(f)]
    if missing:
        return jsonify(
            {
                "success": False,
                "error": "MISSING_FIELDS",
                "message": f"Manglende felt: {', '.join(missing)}",
            }
        ), 400

    # Generer søknad-ID
    sak_id = _generate_sak_id()

    # Opprett event
    event = SoknadOpprettetEvent(
        sak_id=sak_id,
        event_type=FravikEventType.SOKNAD_OPPRETTET,
        aktor=payload["aktor"],
        aktor_rolle=FravikRolle.SOKER,
        data=SoknadOpprettetData(
            prosjekt_navn=payload["prosjekt_navn"],
            prosjekt_nummer=payload["prosjekt_nummer"],
            rammeavtale=payload.get("rammeavtale"),
            hovedentreprenor=payload.get("hovedentreprenor"),
            soker_navn=payload["soker_navn"],
            soker_epost=payload.get("soker_epost"),
            soknad_type=payload["soknad_type"],
            frist_for_svar=payload.get("frist_for_svar"),
            er_haste=payload.get("er_haste", False),
            haste_begrunnelse=payload.get("haste_begrunnelse"),
        ),
    )

    # Lagre event
    new_version = _append_event(sak_id, event, expected_version=0)

    # Beregn state
    events, _ = _get_events_for_sak(sak_id)
    state = fravik_service.compute_state(events)

    logger.info(f"✅ Opprettet fravik-søknad: {sak_id}")

    return jsonify(
        {
            "success": True,
            "sak_id": sak_id,
            "version": new_version,
            "state": state.model_dump(mode="json"),
        }
    ), 201


# =============================================================================
# HENT STATE
# =============================================================================


@fravik_bp.route("/api/fravik/<sak_id>/state", methods=["GET"])
@require_magic_link
@require_project_access()
def get_fravik_state(sak_id: str):
    """
    Hent tilstand for en fravik-søknad.

    Response 200:
    {
        "success": true,
        "sak_id": "FRAVIK-20250115-ABC123",
        "version": 5,
        "state": { ... FravikState ... }
    }
    """
    events, version = _get_events_for_sak(sak_id)

    if not events:
        return not_found_response("Søknad", sak_id)

    state = fravik_service.compute_state(events)

    return jsonify(
        {
            "success": True,
            "sak_id": sak_id,
            "version": version,
            "state": state.model_dump(mode="json"),
        }
    )


# =============================================================================
# HENT EVENTS
# =============================================================================


@fravik_bp.route("/api/fravik/<sak_id>/events", methods=["GET"])
@require_magic_link
@require_project_access()
def get_fravik_events(sak_id: str):
    """
    Hent event-logg for en fravik-søknad.

    Response 200:
    {
        "success": true,
        "sak_id": "FRAVIK-20250115-ABC123",
        "version": 5,
        "events": [ ... events ... ]
    }
    """
    events, version = _get_events_for_sak(sak_id)

    if not events:
        return not_found_response("Søknad", sak_id)

    events_json = [e.model_dump(mode="json") for e in events]

    return jsonify(
        {"success": True, "sak_id": sak_id, "version": version, "events": events_json}
    )


# =============================================================================
# OPPDATER SØKNAD
# =============================================================================


@fravik_bp.route("/api/fravik/<sak_id>/oppdater", methods=["POST"])
@require_csrf
@require_magic_link
@require_project_access(min_role="member")
@handle_service_errors
def oppdater_soknad(sak_id: str):
    """
    Oppdater en fravik-søknad (kun i utkast-status).

    Request:
    {
        "prosjekt_navn": "Nytt prosjektnavn",
        "soker_navn": "Ny søker",
        "avbotende_tiltak": "Beskrivelse",
        "konsekvenser_ved_avslag": "Beskrivelse",
        "aktor": "Ola Nordmann",
        "expected_version": 2
    }
    """
    payload = request.json
    expected_version = payload.get("expected_version", 0)
    aktor = payload.get("aktor", "Ukjent")

    # Valider at søknaden finnes
    events, current_version = _get_events_for_sak(sak_id)
    if not events:
        return not_found_response("Søknad", sak_id)

    # Versjonskontroll
    if expected_version != current_version:
        return version_conflict_response(expected_version, current_version)

    # Bygg oppdateringsdata (kun inkluder felter som er satt)
    update_fields = {}
    allowed_fields = [
        "prosjekt_navn",
        "prosjekt_nummer",
        "rammeavtale",
        "hovedentreprenor",
        "soker_navn",
        "soker_epost",
        "frist_for_svar",
        "er_haste",
        "haste_begrunnelse",
        "avbotende_tiltak",
        "konsekvenser_ved_avslag",
    ]
    for field in allowed_fields:
        if field in payload and payload[field] is not None:
            update_fields[field] = payload[field]

    if not update_fields:
        return jsonify(
            {
                "success": False,
                "error": "VALIDATION_ERROR",
                "message": "Ingen felter å oppdatere",
            }
        ), 400

    # Opprett event
    event = SoknadOppdatertEvent(
        event_id=str(uuid4()),
        sak_id=sak_id,
        tidsstempel=datetime.now(UTC),
        aktor=aktor,
        aktor_rolle=FravikRolle.SOKER,
        data=SoknadOppdatertData(**update_fields),
    )

    # Lagre event
    try:
        new_version = _append_event(sak_id, event, expected_version)
    except ConcurrencyError as e:
        return handle_concurrency_error(e)

    logger.info(f"Søknad oppdatert: {sak_id}, versjon {new_version}")

    return jsonify(
        {
            "success": True,
            "sak_id": sak_id,
            "new_version": new_version,
            "message": "Søknad oppdatert",
        }
    )


# =============================================================================
# LEGG TIL MASKIN
# =============================================================================


@fravik_bp.route("/api/fravik/<sak_id>/maskin", methods=["POST"])
@require_csrf
@require_magic_link
@require_project_access(min_role="member")
@handle_service_errors
def legg_til_maskin(sak_id: str):
    """
    Legg til maskin i søknaden.

    Request:
    {
        "maskin_type": "Gravemaskin",
        "start_dato": "2025-02-01",
        "slutt_dato": "2025-03-15",
        "begrunnelse": "Ingen utslippsfrie alternativer tilgjengelig",
        "aktor": "Ola Nordmann",
        "expected_version": 1
    }
    """
    payload = request.json
    expected_version = payload.get("expected_version", 0)

    # Valider at søknaden finnes
    events, current_version = _get_events_for_sak(sak_id)
    if not events:
        return not_found_response("Søknad", sak_id)

    # Versjonskontroll
    if expected_version != current_version:
        return version_conflict_response(expected_version, current_version)

    # Opprett event
    maskin_id = str(uuid4())
    event = MaskinLagtTilEvent(
        sak_id=sak_id,
        event_type=FravikEventType.MASKIN_LAGT_TIL,
        aktor=payload.get("aktor", "Ukjent"),
        aktor_rolle=FravikRolle.SOKER,
        data=MaskinData(
            maskin_id=maskin_id,
            maskin_type=payload["maskin_type"],
            annet_type=payload.get("annet_type"),
            registreringsnummer=payload.get("registreringsnummer"),
            start_dato=payload["start_dato"],
            slutt_dato=payload["slutt_dato"],
            grunner=payload["grunner"],
            begrunnelse=payload["begrunnelse"],
            alternativer_vurdert=payload["alternativer_vurdert"],
            markedsundersokelse=payload.get("markedsundersokelse", False),
            undersøkte_leverandorer=payload.get("undersøkte_leverandorer"),
            erstatningsmaskin=payload["erstatningsmaskin"],
            erstatningsdrivstoff=payload["erstatningsdrivstoff"],
            arbeidsbeskrivelse=payload["arbeidsbeskrivelse"],
        ),
    )

    try:
        new_version = _append_event(sak_id, event, expected_version)
    except ConcurrencyError as e:
        return handle_concurrency_error(e)

    # Beregn ny state
    events, _ = _get_events_for_sak(sak_id)
    state = fravik_service.compute_state(events)

    return jsonify(
        {
            "success": True,
            "maskin_id": maskin_id,
            "version": new_version,
            "state": state.model_dump(mode="json"),
        }
    ), 201


# =============================================================================
# SEND INN SØKNAD
# =============================================================================


@fravik_bp.route("/api/fravik/<sak_id>/send-inn", methods=["POST"])
@require_csrf
@require_magic_link
@require_project_access(min_role="member")
@handle_service_errors
def send_inn_soknad(sak_id: str):
    """
    Send inn søknaden til vurdering.

    Request:
    {
        "aktor": "Ola Nordmann",
        "expected_version": 3
    }
    """
    payload = request.json
    expected_version = payload.get("expected_version", 0)

    events, current_version = _get_events_for_sak(sak_id)
    if not events:
        return not_found_response("Søknad", sak_id)

    # Sjekk at søknaden kan sendes inn
    state = fravik_service.compute_state(events)
    if not state.kan_sendes_inn:
        return jsonify(
            {
                "success": False,
                "error": "INVALID_STATE",
                "message": "Søknaden kan ikke sendes inn. Sjekk at alle felt er fylt ut.",
            }
        ), 400

    event = SoknadSendtInnEvent(
        sak_id=sak_id,
        event_type=FravikEventType.SOKNAD_SENDT_INN,
        aktor=payload.get("aktor", "Ukjent"),
        aktor_rolle=FravikRolle.SOKER,
    )

    try:
        new_version = _append_event(sak_id, event, expected_version)
    except ConcurrencyError as e:
        return handle_concurrency_error(e)

    events, _ = _get_events_for_sak(sak_id)
    state = fravik_service.compute_state(events)

    logger.info(f"✅ Søknad sendt inn: {sak_id}")

    return jsonify(
        {
            "success": True,
            "version": new_version,
            "state": state.model_dump(mode="json"),
        }
    )


# =============================================================================
# MILJØRÅDGIVER VURDERING
# =============================================================================


@fravik_bp.route("/api/fravik/<sak_id>/miljo-vurdering", methods=["POST"])
@require_csrf
@require_magic_link
@require_project_access(min_role="member")
@handle_service_errors
def miljo_vurdering(sak_id: str):
    """
    Miljørådgiver sender vurdering.

    Request:
    {
        "dokumentasjon_tilstrekkelig": true,
        "maskin_vurderinger": [
            {
                "maskin_id": "uuid",
                "beslutning": "godkjent",
                "kommentar": "OK"
            }
        ],
        "samlet_anbefaling": "godkjent",
        "kommentar": "Anbefaler godkjenning",
        "aktor": "Miljørådgiver",
        "expected_version": 5
    }
    """
    payload = request.json
    expected_version = payload.get("expected_version", 0)

    events, current_version = _get_events_for_sak(sak_id)
    if not events:
        return not_found_response("Søknad", sak_id)

    # Parse maskin-vurderinger
    maskin_vurderinger = [
        MaskinVurderingData(**mv) for mv in payload.get("maskin_vurderinger", [])
    ]

    event = MiljoVurderingEvent(
        sak_id=sak_id,
        event_type=FravikEventType.MILJO_VURDERING,
        aktor=payload.get("aktor", "Miljørådgiver"),
        aktor_rolle=FravikRolle.MILJO,
        data=MiljoVurderingData(
            dokumentasjon_tilstrekkelig=payload["dokumentasjon_tilstrekkelig"],
            maskin_vurderinger=maskin_vurderinger,
            samlet_anbefaling=payload.get("samlet_anbefaling"),
            kommentar=payload.get("kommentar"),
            manglende_dokumentasjon=payload.get("manglende_dokumentasjon"),
        ),
    )

    try:
        new_version = _append_event(sak_id, event, expected_version)
    except ConcurrencyError as e:
        return handle_concurrency_error(e)

    events, _ = _get_events_for_sak(sak_id)
    state = fravik_service.compute_state(events)

    logger.info(f"✅ Miljøvurdering registrert for: {sak_id}")

    return jsonify(
        {
            "success": True,
            "version": new_version,
            "state": state.model_dump(mode="json"),
        }
    )


# =============================================================================
# PL VURDERING
# =============================================================================


@fravik_bp.route("/api/fravik/<sak_id>/pl-vurdering", methods=["POST"])
@require_csrf
@require_magic_link
@require_project_access(min_role="member")
@handle_service_errors
def pl_vurdering(sak_id: str):
    """
    Prosjektleder sender vurdering.

    Request:
    {
        "dokumentasjon_tilstrekkelig": true,
        "anbefaling": "godkjent",
        "kommentar": "Godkjent",
        "aktor": "Prosjektleder",
        "expected_version": 6
    }
    """
    payload = request.json
    expected_version = payload.get("expected_version", 0)

    events, current_version = _get_events_for_sak(sak_id)
    if not events:
        return not_found_response("Søknad", sak_id)

    event = PLVurderingEvent(
        sak_id=sak_id,
        event_type=FravikEventType.PL_VURDERING,
        aktor=payload.get("aktor", "Prosjektleder"),
        aktor_rolle=FravikRolle.PL,
        data=PLVurderingData(
            dokumentasjon_tilstrekkelig=payload["dokumentasjon_tilstrekkelig"],
            anbefaling=payload["anbefaling"],
            kommentar=payload.get("kommentar"),
            manglende_dokumentasjon=payload.get("manglende_dokumentasjon"),
        ),
    )

    try:
        new_version = _append_event(sak_id, event, expected_version)
    except ConcurrencyError as e:
        return handle_concurrency_error(e)

    events, _ = _get_events_for_sak(sak_id)
    state = fravik_service.compute_state(events)

    return jsonify(
        {
            "success": True,
            "version": new_version,
            "state": state.model_dump(mode="json"),
        }
    )


# =============================================================================
# ARBEIDSGRUPPE VURDERING
# =============================================================================


@fravik_bp.route("/api/fravik/<sak_id>/arbeidsgruppe-vurdering", methods=["POST"])
@require_csrf
@require_magic_link
@require_project_access(min_role="member")
@handle_service_errors
def arbeidsgruppe_vurdering(sak_id: str):
    """
    Arbeidsgruppen sender vurdering.

    Request:
    {
        "maskin_vurderinger": [...],
        "samlet_innstilling": "godkjent",
        "kommentar": "Innstiller godkjenning",
        "deltakere": ["Navn 1", "Navn 2"],
        "aktor": "Arbeidsgruppen",
        "expected_version": 7
    }
    """
    payload = request.json
    expected_version = payload.get("expected_version", 0)

    events, current_version = _get_events_for_sak(sak_id)
    if not events:
        return not_found_response("Søknad", sak_id)

    maskin_vurderinger = [
        MaskinVurderingData(**mv) for mv in payload.get("maskin_vurderinger", [])
    ]

    event = ArbeidsgruppeVurderingEvent(
        sak_id=sak_id,
        event_type=FravikEventType.ARBEIDSGRUPPE_VURDERING,
        aktor=payload.get("aktor", "Arbeidsgruppen"),
        aktor_rolle=FravikRolle.ARBEIDSGRUPPE,
        data=ArbeidsgruppeVurderingData(
            maskin_vurderinger=maskin_vurderinger,
            samlet_innstilling=payload["samlet_innstilling"],
            kommentar=payload.get("kommentar"),
            deltakere=payload.get("deltakere"),
        ),
    )

    try:
        new_version = _append_event(sak_id, event, expected_version)
    except ConcurrencyError as e:
        return handle_concurrency_error(e)

    events, _ = _get_events_for_sak(sak_id)
    state = fravik_service.compute_state(events)

    return jsonify(
        {
            "success": True,
            "version": new_version,
            "state": state.model_dump(mode="json"),
        }
    )


# =============================================================================
# EIER BESLUTNING
# =============================================================================


@fravik_bp.route("/api/fravik/<sak_id>/eier-beslutning", methods=["POST"])
@require_csrf
@require_magic_link
@require_project_access(min_role="member")
@handle_service_errors
def eier_beslutning(sak_id: str):
    """
    Eier fatter endelig beslutning.

    Request:
    {
        "beslutning": "godkjent",  // "godkjent", "avslatt", "delvis_godkjent"
        "folger_arbeidsgruppen": true,
        "begrunnelse": "Godkjent i henhold til innstilling",
        "maskin_beslutninger": [...],  // Kun for delvis_godkjent
        "aktor": "Prosjekteier",
        "expected_version": 8
    }
    """
    payload = request.json
    expected_version = payload.get("expected_version", 0)

    events, current_version = _get_events_for_sak(sak_id)
    if not events:
        return not_found_response("Søknad", sak_id)

    beslutning = payload["beslutning"]
    maskin_beslutninger = None
    if payload.get("maskin_beslutninger"):
        maskin_beslutninger = [
            MaskinVurderingData(**mv) for mv in payload["maskin_beslutninger"]
        ]

    beslutning_data = EierBeslutningData(
        folger_arbeidsgruppen=payload.get("folger_arbeidsgruppen", True),
        beslutning=beslutning,
        begrunnelse=payload.get("begrunnelse"),
        maskin_beslutninger=maskin_beslutninger,
    )

    # Velg riktig event-type basert på beslutning
    if beslutning == "godkjent":
        event = EierGodkjentEvent(
            sak_id=sak_id,
            event_type=FravikEventType.EIER_GODKJENT,
            aktor=payload.get("aktor", "Prosjekteier"),
            aktor_rolle=FravikRolle.EIER,
            data=beslutning_data,
        )
    elif beslutning == "avslatt":
        event = EierAvslattEvent(
            sak_id=sak_id,
            event_type=FravikEventType.EIER_AVSLATT,
            aktor=payload.get("aktor", "Prosjekteier"),
            aktor_rolle=FravikRolle.EIER,
            data=beslutning_data,
        )
    else:
        event = EierDelvisGodkjentEvent(
            sak_id=sak_id,
            event_type=FravikEventType.EIER_DELVIS_GODKJENT,
            aktor=payload.get("aktor", "Prosjekteier"),
            aktor_rolle=FravikRolle.EIER,
            data=beslutning_data,
        )

    try:
        new_version = _append_event(sak_id, event, expected_version)
    except ConcurrencyError as e:
        return handle_concurrency_error(e)

    events, _ = _get_events_for_sak(sak_id)
    state = fravik_service.compute_state(events)

    logger.info(f"✅ Eier-beslutning ({beslutning}) for: {sak_id}")

    return jsonify(
        {
            "success": True,
            "version": new_version,
            "state": state.model_dump(mode="json"),
        }
    )


# =============================================================================
# LISTE SØKNADER
# =============================================================================


@fravik_bp.route("/api/fravik/liste", methods=["GET"])
@require_magic_link
@require_project_access()
def liste_fravik_soknader():
    """
    List alle fravik-søknader.

    Query parameters:
    - status: Filter på status (optional)

    Response 200:
    {
        "success": true,
        "soknader": [ ... FravikListeItem ... ],
        "total": 42
    }
    """
    try:
        # 1. Hent alle unike sak_ids fra fravik_events
        sak_ids = _get_event_repo().get_all_sak_ids(sakstype="fravik")

        # 2. Bygg state og konverter til liste-items
        soknader = []
        for sak_id in sak_ids:
            try:
                events_data, _ = _get_event_repo().get_events(sak_id, sakstype="fravik")
                if events_data:
                    events = [parse_fravik_event(e) for e in events_data]
                    state = fravik_service.compute_state(events)
                    liste_item = fravik_service.state_to_liste_item(state)
                    soknader.append(liste_item.model_dump())
            except Exception as e:
                logger.warning(f"Kunne ikke laste sak {sak_id}: {e}")
                continue

        # 3. Sorter etter siste aktivitet (nyeste først)
        soknader.sort(key=lambda x: x.get("siste_oppdatert") or "", reverse=True)

        return jsonify({"success": True, "soknader": soknader, "total": len(soknader)})

    except Exception as e:
        logger.error(f"Feil ved listing av søknader: {e}")
        return jsonify(
            {"success": False, "error": "INTERNAL_ERROR", "message": str(e)}
        ), 500
