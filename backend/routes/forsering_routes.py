"""
Forsering Routes Blueprint

REST API for forseringssaker (§ 33.8 NS 8407).

Endpoints:
- POST /api/forsering/opprett - Opprett ny forseringssak
- GET /api/forsering/<sak_id>/relaterte - Hent relaterte saker
- GET /api/forsering/<sak_id>/kontekst - Hent komplett kontekst
- POST /api/forsering/valider - Valider 30%-regelen
- GET /api/forsering/kandidater - Hent KOE-saker med avslått frist (for ny forsering)
- GET /api/forsering/by-relatert/<sak_id> - Finn forseringer for en KOE-sak
- POST /api/forsering/<sak_id>/relatert - Legg til KOE
- DELETE /api/forsering/<sak_id>/relatert/<koe_sak_id> - Fjern KOE
- POST /api/forsering/<sak_id>/bh-respons - BH respons
- POST /api/forsering/<sak_id>/stopp - Stopp forsering
- PUT /api/forsering/<sak_id>/kostnader - Oppdater kostnader
"""
from typing import Optional, Dict, Any
from flask import Blueprint, request, jsonify

from services.forsering_service import ForseringService
from services.timeline_service import TimelineService
from services.catenda_sync_service import CatendaSyncService, CatendaSyncResult
from repositories import create_event_repository, create_metadata_repository
from repositories.event_repository import ConcurrencyError
from lib.helpers.version_control import handle_concurrency_error
from lib.catenda_factory import get_catenda_client
from lib.decorators import handle_service_errors
from lib.auth.magic_link import require_magic_link
from lib.auth.csrf_protection import require_csrf
from routes.related_cases_utils import (
    build_relaterte_response,
    build_kontekst_response,
    build_kandidater_response,
    build_success_message,
    validate_required_fields,
    safe_find_related,
)
from utils.logger import get_logger
from models.sak_state import SakState

logger = get_logger(__name__)

# Create Blueprint
forsering_bp = Blueprint('forsering', __name__)

# Dependencies - use factory functions to respect EVENT_STORE_BACKEND/METADATA_STORE_BACKEND
event_repo = create_event_repository()
timeline_service = TimelineService()
metadata_repo = create_metadata_repository()


def _get_forsering_service() -> ForseringService:
    """Oppretter ForseringService med dependencies."""
    return ForseringService(
        catenda_client=get_catenda_client(),
        event_repository=event_repo,
        timeline_service=timeline_service,
        metadata_repository=metadata_repo
    )


def _sync_forsering_to_catenda(
    sak_id: str,
    service_result: Dict[str, Any]
) -> Optional[CatendaSyncResult]:
    """
    Synkroniser forsering-event til Catenda hvis mulig.

    Args:
        sak_id: Forseringssakens ID
        service_result: Resultat fra ForseringService (inneholder event, state, old_status)

    Returns:
        CatendaSyncResult hvis synkronisering ble forsøkt, None hvis hoppet over
    """
    # Sjekk at vi har metadata med topic_id
    metadata = metadata_repo.get(sak_id)
    if not metadata or not metadata.catenda_topic_id:
        logger.debug(f"Ingen Catenda topic_id for {sak_id}, hopper over synkronisering")
        return CatendaSyncResult(
            success=False,
            comment_posted=False,
            status_updated=False,
            skipped_reason='no_topic_id'
        )

    # Hent event og state fra resultat
    event = service_result.get('event')
    state_data = service_result.get('state')
    old_status = service_result.get('old_status')

    if not event or not state_data:
        logger.warning(f"Mangler event eller state for Catenda-synk av {sak_id}")
        return None

    # Konverter state_data dict til SakState
    try:
        state = SakState(**state_data)
    except Exception as e:
        logger.error(f"Kunne ikke konvertere state for {sak_id}: {e}")
        return None

    # Synkroniser til Catenda
    sync_service = CatendaSyncService()
    result = sync_service.sync_event_to_catenda(
        sak_id=sak_id,
        state=state,
        event=event,
        topic_id=metadata.catenda_topic_id,
        old_status=old_status
    )

    if result.success:
        logger.info(f"Catenda-synk vellykket for forsering {sak_id}")
    else:
        logger.warning(f"Catenda-synk feilet for forsering {sak_id}: {result.error or result.skipped_reason}")

    return result


def _build_catenda_response(catenda_result: Optional[CatendaSyncResult]) -> Dict[str, Any]:
    """Bygg Catenda-del av API-respons."""
    if catenda_result is None:
        return {
            "catenda_synced": False,
            "catenda_skipped_reason": "sync_not_attempted"
        }

    return {
        "catenda_synced": catenda_result.success,
        "catenda_comment_posted": catenda_result.comment_posted,
        "catenda_status_updated": catenda_result.status_updated,
        "catenda_skipped_reason": catenda_result.skipped_reason,
        "catenda_error": catenda_result.error
    }


# =============================================================================
# OPPRETT
# =============================================================================

@forsering_bp.route('/api/forsering/opprett', methods=['POST'])
@require_csrf
@require_magic_link
@handle_service_errors
def opprett_forseringssak():
    """
    Opprett en ny forseringssak basert på avslåtte fristforlengelser.

    Request:
    {
        "avslatte_sak_ids": ["sak-guid-1", "sak-guid-2"],
        "estimert_kostnad": 150000,
        "dagmulktsats": 10000,
        "begrunnelse": "Forsering nødvendig...",
        "avslatte_dager": 15  // Valgfritt
    }
    """
    payload = request.json

    # Valider påkrevde felter
    error = validate_required_fields(
        payload,
        ['avslatte_sak_ids', 'estimert_kostnad', 'dagmulktsats', 'begrunnelse']
    )
    if error:
        return error

    avslatte_sak_ids = payload['avslatte_sak_ids']
    if not isinstance(avslatte_sak_ids, list) or len(avslatte_sak_ids) == 0:
        return jsonify({
            "success": False,
            "error": "VALIDATION_ERROR",
            "message": "avslatte_sak_ids må være en liste med minst én sak-ID"
        }), 400

    service = _get_forsering_service()

    result = service.opprett_forseringssak(
        avslatte_sak_ids=avslatte_sak_ids,
        estimert_kostnad=float(payload['estimert_kostnad']),
        dagmulktsats=float(payload['dagmulktsats']),
        begrunnelse=payload['begrunnelse'],
        avslatte_dager=payload.get('avslatte_dager')
    )

    logger.info(f"Forseringssak opprettet: {result['sak_id']}")

    return jsonify({
        "success": True,
        **result
    }), 201


# =============================================================================
# RELATERTE SAKER (bruker felles utilities)
# =============================================================================

@forsering_bp.route('/api/forsering/<sak_id>/relaterte', methods=['GET'])
@require_magic_link
@handle_service_errors
def hent_relaterte_saker(sak_id: str):
    """Hent alle saker relatert til en forseringssak."""
    service = _get_forsering_service()
    relasjoner = service.hent_relaterte_saker(sak_id)
    return build_relaterte_response(sak_id, relasjoner)


@forsering_bp.route('/api/forsering/<sak_id>/kontekst', methods=['GET'])
@require_magic_link
@handle_service_errors
def hent_forseringskontekst(sak_id: str):
    """
    Hent komplett kontekst for en forseringssak.

    Inkluderer relaterte saker, states, hendelser og oppsummering.
    """
    service = _get_forsering_service()
    kontekst = service.hent_komplett_forseringskontekst(sak_id)

    # Ekstraher forsering_hendelser til extra_fields for riktig formatering
    extra_fields = {}
    if "forsering_hendelser" in kontekst:
        extra_fields["forsering_hendelser"] = kontekst.pop("forsering_hendelser")

    return build_kontekst_response(sak_id, kontekst, extra_fields=extra_fields)


@forsering_bp.route('/api/forsering/kandidater', methods=['GET'])
@handle_service_errors
def hent_kandidat_koe_saker():
    """Hent KOE-saker som kan brukes i en forseringssak."""
    service = _get_forsering_service()
    kandidater = service.hent_kandidat_koe_saker()
    return build_kandidater_response(kandidater)


@forsering_bp.route('/api/forsering/by-relatert/<sak_id>', methods=['GET'])
@require_magic_link
def finn_forseringer_for_sak(sak_id: str):
    """Finn forseringssaker som refererer til en gitt KOE-sak."""
    service = _get_forsering_service()
    return safe_find_related(
        service.finn_forseringer_for_sak,
        sak_id,
        "forseringer"
    )


@forsering_bp.route('/api/forsering/<sak_id>/relatert', methods=['POST'])
@require_csrf
@require_magic_link
@handle_service_errors
def legg_til_relatert_sak(sak_id: str):
    """Legg til en KOE-sak som relatert til forseringen."""
    payload = request.json

    error = validate_required_fields(payload, ['koe_sak_id'])
    if error:
        return error

    service = _get_forsering_service()
    service.legg_til_relatert_sak(sak_id, payload['koe_sak_id'])

    logger.info(f"KOE {payload['koe_sak_id']} lagt til forsering {sak_id}")
    return build_success_message("KOE lagt til forsering")


@forsering_bp.route('/api/forsering/<sak_id>/relatert/<koe_sak_id>', methods=['DELETE'])
@require_csrf
@require_magic_link
@handle_service_errors
def fjern_relatert_sak(sak_id: str, koe_sak_id: str):
    """Fjern en KOE-sak fra forseringen."""
    service = _get_forsering_service()
    service.fjern_relatert_sak(sak_id, koe_sak_id)

    logger.info(f"KOE {koe_sak_id} fjernet fra forsering {sak_id}")
    return build_success_message("KOE fjernet fra forsering")


# =============================================================================
# FORSERING-SPESIFIKKE ENDEPUNKTER
# =============================================================================

@forsering_bp.route('/api/forsering/valider', methods=['POST'])
@require_magic_link
@handle_service_errors
def valider_forseringskostnad():
    """
    Valider om estimert kostnad er innenfor 30%-grensen.

    Request: { "estimert_kostnad", "avslatte_dager", "dagmulktsats" }
    """
    payload = request.json

    error = validate_required_fields(
        payload,
        ['estimert_kostnad', 'avslatte_dager', 'dagmulktsats']
    )
    if error:
        return error

    service = _get_forsering_service()

    result = service.valider_30_prosent_regel(
        estimert_kostnad=float(payload['estimert_kostnad']),
        avslatte_dager=int(payload['avslatte_dager']),
        dagmulktsats=float(payload['dagmulktsats'])
    )

    return jsonify({
        "success": True,
        **result
    }), 200


@forsering_bp.route('/api/forsering/<sak_id>/bh-respons', methods=['POST'])
@require_csrf
@require_magic_link
@handle_service_errors
def registrer_bh_respons(sak_id: str):
    """
    Registrer BH respons på forseringsvarsel (tre-port modell).

    Request: {
        "aksepterer": bool,
        "godkjent_kostnad"?: number,
        "begrunnelse": string,
        "expected_version"?: number,

        // Port 1: Grunnlag
        "grunnlag_fortsatt_gyldig"?: bool,
        "grunnlag_begrunnelse"?: string,

        // Port 2: 30%-regel
        "trettiprosent_overholdt"?: bool,
        "trettiprosent_begrunnelse"?: string,

        // Særskilte krav (§34.1.3)
        "rigg_varslet_i_tide"?: bool,
        "produktivitet_varslet_i_tide"?: bool,
        "godkjent_rigg_drift"?: number,
        "godkjent_produktivitet"?: number,

        // Subsidiært
        "subsidiaer_triggers"?: string[],
        "subsidiaer_godkjent_belop"?: number,
        "subsidiaer_begrunnelse"?: string
    }
    """
    payload = request.json

    error = validate_required_fields(payload, ['aksepterer', 'begrunnelse'])
    if error:
        return error

    aktor = getattr(request, 'magic_link_name', 'Ukjent BH')
    expected_version = payload.get('expected_version')

    service = _get_forsering_service()
    try:
        result = service.registrer_bh_respons(
            sak_id=sak_id,
            aksepterer=payload['aksepterer'],
            godkjent_kostnad=payload.get('godkjent_kostnad'),
            begrunnelse=payload['begrunnelse'],
            aktor=aktor,
            expected_version=expected_version,
            # Tre-port felter
            grunnlag_fortsatt_gyldig=payload.get('grunnlag_fortsatt_gyldig'),
            grunnlag_begrunnelse=payload.get('grunnlag_begrunnelse'),
            trettiprosent_overholdt=payload.get('trettiprosent_overholdt'),
            trettiprosent_begrunnelse=payload.get('trettiprosent_begrunnelse'),
            # Særskilte krav (§34.1.3)
            rigg_varslet_i_tide=payload.get('rigg_varslet_i_tide'),
            produktivitet_varslet_i_tide=payload.get('produktivitet_varslet_i_tide'),
            godkjent_rigg_drift=payload.get('godkjent_rigg_drift'),
            godkjent_produktivitet=payload.get('godkjent_produktivitet'),
            # Subsidiært
            subsidiaer_triggers=payload.get('subsidiaer_triggers'),
            subsidiaer_godkjent_belop=payload.get('subsidiaer_godkjent_belop'),
            subsidiaer_begrunnelse=payload.get('subsidiaer_begrunnelse'),
        )
    except ConcurrencyError as e:
        return handle_concurrency_error(e)

    status = "akseptert" if payload['aksepterer'] else "avslått"
    logger.info(f"BH respons på forsering {sak_id}: {status}")

    # Catenda-synkronisering
    catenda_result = _sync_forsering_to_catenda(sak_id, result)

    # Fjern interne felter fra respons
    result.pop('event', None)
    result.pop('old_status', None)

    return jsonify({
        "success": True,
        "message": f"BH respons registrert ({status})",
        **result,
        **_build_catenda_response(catenda_result)
    }), 200


@forsering_bp.route('/api/forsering/<sak_id>/valider-grunnlag', methods=['GET'])
@require_magic_link
@handle_service_errors
def valider_forseringsgrunnlag(sak_id: str):
    """
    Validerer om grunnlaget for forsering fortsatt er gyldig.

    Brukes av BH for å sjekke Port 1 før de gir respons.
    Grunnlaget er ugyldig hvis BH har snudd på fristforlengelsen.

    Response: {
        "success": true,
        "er_gyldig": bool,
        "grunn"?: string,
        "pavirket_sak_id"?: string,
        "ny_status"?: string
    }
    """
    service = _get_forsering_service()
    result = service.valider_grunnlag_fortsatt_gyldig(sak_id)

    return jsonify({
        "success": True,
        **result
    }), 200


@forsering_bp.route('/api/forsering/<sak_id>/stopp', methods=['POST'])
@require_csrf
@require_magic_link
@handle_service_errors
def stopp_forsering(sak_id: str):
    """
    Stopp en pågående forsering.

    Request: { "begrunnelse", "paalopte_kostnader"?, "expected_version"? }
    """
    payload = request.json

    error = validate_required_fields(payload, ['begrunnelse'])
    if error:
        return error

    aktor = getattr(request, 'magic_link_name', 'Ukjent TE')
    expected_version = payload.get('expected_version')

    service = _get_forsering_service()
    try:
        result = service.stopp_forsering(
            sak_id=sak_id,
            begrunnelse=payload['begrunnelse'],
            paalopte_kostnader=payload.get('paalopte_kostnader'),
            aktor=aktor,
            expected_version=expected_version
        )
    except ConcurrencyError as e:
        return handle_concurrency_error(e)

    logger.info(f"Forsering {sak_id} stoppet")

    # Catenda-synkronisering
    catenda_result = _sync_forsering_to_catenda(sak_id, result)

    # Fjern interne felter fra respons
    result.pop('event', None)
    result.pop('old_status', None)

    return jsonify({
        "success": True,
        "message": "Forsering stoppet",
        **result,
        **_build_catenda_response(catenda_result)
    }), 200


@forsering_bp.route('/api/forsering/<sak_id>/kostnader', methods=['PUT'])
@require_csrf
@require_magic_link
@handle_service_errors
def oppdater_kostnader(sak_id: str):
    """
    Oppdater påløpte kostnader for en pågående forsering.

    Request: { "paalopte_kostnader", "kommentar"?, "expected_version"? }
    """
    payload = request.json

    error = validate_required_fields(payload, ['paalopte_kostnader'])
    if error:
        return error

    aktor = getattr(request, 'magic_link_name', 'Ukjent TE')
    expected_version = payload.get('expected_version')

    service = _get_forsering_service()
    try:
        result = service.oppdater_kostnader(
            sak_id=sak_id,
            paalopte_kostnader=float(payload['paalopte_kostnader']),
            kommentar=payload.get('kommentar'),
            aktor=aktor,
            expected_version=expected_version
        )
    except ConcurrencyError as e:
        return handle_concurrency_error(e)

    logger.info(f"Forseringskostnader for {sak_id} oppdatert til {payload['paalopte_kostnader']}")

    # Catenda-synkronisering
    catenda_result = _sync_forsering_to_catenda(sak_id, result)

    # Fjern interne felter fra respons
    result.pop('event', None)
    result.pop('old_status', None)

    return jsonify({
        "success": True,
        "message": "Kostnader oppdatert",
        **result,
        **_build_catenda_response(catenda_result)
    }), 200
