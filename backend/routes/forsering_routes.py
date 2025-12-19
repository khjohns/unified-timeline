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
from flask import Blueprint, request, jsonify

from services.forsering_service import ForseringService
from services.timeline_service import TimelineService
from repositories.event_repository import JsonFileEventRepository
from repositories.sak_metadata_repository import SakMetadataRepository
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

logger = get_logger(__name__)

# Create Blueprint
forsering_bp = Blueprint('forsering', __name__)

# Dependencies
event_repo = JsonFileEventRepository()
timeline_service = TimelineService()
metadata_repo = SakMetadataRepository()


def _get_forsering_service() -> ForseringService:
    """Oppretter ForseringService med dependencies."""
    return ForseringService(
        catenda_client=get_catenda_client(),
        event_repository=event_repo,
        timeline_service=timeline_service,
        metadata_repository=metadata_repo
    )


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
    return build_kontekst_response(sak_id, kontekst)


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
    Registrer BH respons på forseringsvarsel.

    Request: { "aksepterer", "godkjent_kostnad"?, "begrunnelse" }
    """
    payload = request.json

    error = validate_required_fields(payload, ['aksepterer', 'begrunnelse'])
    if error:
        return error

    aktor = getattr(request, 'magic_link_name', 'Ukjent BH')

    service = _get_forsering_service()
    result = service.registrer_bh_respons(
        sak_id=sak_id,
        aksepterer=payload['aksepterer'],
        godkjent_kostnad=payload.get('godkjent_kostnad'),
        begrunnelse=payload['begrunnelse'],
        aktor=aktor
    )

    status = "akseptert" if payload['aksepterer'] else "avslått"
    logger.info(f"BH respons på forsering {sak_id}: {status}")

    return jsonify({
        "success": True,
        "message": f"BH respons registrert ({status})",
        **result
    }), 200


@forsering_bp.route('/api/forsering/<sak_id>/stopp', methods=['POST'])
@require_csrf
@require_magic_link
@handle_service_errors
def stopp_forsering(sak_id: str):
    """
    Stopp en pågående forsering.

    Request: { "begrunnelse", "paalopte_kostnader"? }
    """
    payload = request.json

    error = validate_required_fields(payload, ['begrunnelse'])
    if error:
        return error

    aktor = getattr(request, 'magic_link_name', 'Ukjent TE')

    service = _get_forsering_service()
    result = service.stopp_forsering(
        sak_id=sak_id,
        begrunnelse=payload['begrunnelse'],
        paalopte_kostnader=payload.get('paalopte_kostnader'),
        aktor=aktor
    )

    logger.info(f"Forsering {sak_id} stoppet")

    return jsonify({
        "success": True,
        "message": "Forsering stoppet",
        **result
    }), 200


@forsering_bp.route('/api/forsering/<sak_id>/kostnader', methods=['PUT'])
@require_csrf
@require_magic_link
@handle_service_errors
def oppdater_kostnader(sak_id: str):
    """
    Oppdater påløpte kostnader for en pågående forsering.

    Request: { "paalopte_kostnader", "kommentar"? }
    """
    payload = request.json

    error = validate_required_fields(payload, ['paalopte_kostnader'])
    if error:
        return error

    aktor = getattr(request, 'magic_link_name', 'Ukjent TE')

    service = _get_forsering_service()
    result = service.oppdater_kostnader(
        sak_id=sak_id,
        paalopte_kostnader=float(payload['paalopte_kostnader']),
        kommentar=payload.get('kommentar'),
        aktor=aktor
    )

    logger.info(f"Forseringskostnader for {sak_id} oppdatert til {payload['paalopte_kostnader']}")

    return jsonify({
        "success": True,
        "message": "Kostnader oppdatert",
        **result
    }), 200
