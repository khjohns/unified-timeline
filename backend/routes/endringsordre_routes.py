"""
Endringsordre Routes Blueprint

REST API for endringsordresaker (§31.3 NS 8407).

Endpoints:
- POST /api/endringsordre/opprett - Opprett ny endringsordresak
- GET /api/endringsordre/<sak_id>/relaterte - Hent relaterte KOE-saker
- GET /api/endringsordre/<sak_id>/kontekst - Hent komplett kontekst
- POST /api/endringsordre/<sak_id>/koe - Legg til KOE-sak
- DELETE /api/endringsordre/<sak_id>/koe/<koe_sak_id> - Fjern KOE-sak
- GET /api/endringsordre/kandidater - Hent kandidat-KOE-saker for ny EO
- GET /api/endringsordre/by-relatert/<sak_id> - Finn EO-er for en KOE-sak
"""
from flask import Blueprint, request, jsonify

from services.endringsordre_service import EndringsordreService
from services.timeline_service import TimelineService
from repositories import create_event_repository, create_metadata_repository
from lib.catenda_factory import get_catenda_client
from lib.decorators import handle_service_errors
from lib.auth.magic_link import require_magic_link
from lib.auth.csrf_protection import require_csrf
from routes.related_cases_utils import (
    build_relaterte_response,
    build_kontekst_response,
    build_kandidater_response,
    validate_required_fields,
    safe_find_related,
)
from utils.logger import get_logger

logger = get_logger(__name__)

# Create Blueprint
endringsordre_bp = Blueprint('endringsordre', __name__)

# Dependencies - use factory functions to respect EVENT_STORE_BACKEND/METADATA_STORE_BACKEND
event_repo = create_event_repository()
timeline_service = TimelineService()
metadata_repo = create_metadata_repository()


def _get_endringsordre_service() -> EndringsordreService:
    """Oppretter EndringsordreService med dependencies."""
    return EndringsordreService(
        catenda_client=get_catenda_client(),
        event_repository=event_repo,
        timeline_service=timeline_service,
        metadata_repository=metadata_repo
    )


@endringsordre_bp.route('/api/endringsordre/opprett', methods=['POST'])
@require_csrf
@require_magic_link
@handle_service_errors
def opprett_endringsordresak():
    """
    Opprett en ny endringsordresak.

    Request:
    {
        "eo_nummer": "EO-001",
        "beskrivelse": "Endring av fundamenter...",
        "koe_sak_ids": ["sak-guid-1", "sak-guid-2"],
        "konsekvenser": {...},
        "oppgjorsform": "ENHETSPRISER",
        "kompensasjon_belop": 150000,
        ...
    }
    """
    payload = request.json

    # Valider påkrevde felter
    error = validate_required_fields(payload, ['eo_nummer', 'beskrivelse'])
    if error:
        return error

    service = _get_endringsordre_service()

    result = service.opprett_endringsordresak(
        eo_nummer=payload['eo_nummer'],
        beskrivelse=payload['beskrivelse'],
        koe_sak_ids=payload.get('koe_sak_ids', []),
        konsekvenser=payload.get('konsekvenser'),
        konsekvens_beskrivelse=payload.get('konsekvens_beskrivelse'),
        oppgjorsform=payload.get('oppgjorsform'),
        kompensasjon_belop=payload.get('kompensasjon_belop'),
        fradrag_belop=payload.get('fradrag_belop'),
        er_estimat=payload.get('er_estimat', False),
        frist_dager=payload.get('frist_dager'),
        ny_sluttdato=payload.get('ny_sluttdato'),
        utstedt_av=payload.get('utstedt_av'),
    )

    logger.info(f"Endringsordresak opprettet: {result['sak_id']} (catenda_synced={result.get('catenda_synced')})")

    return jsonify({
        "success": True,
        **result
    }), 201


@endringsordre_bp.route('/api/endringsordre/<sak_id>/relaterte', methods=['GET'])
@require_magic_link
@handle_service_errors
def hent_relaterte_koe_saker(sak_id: str):
    """Hent alle KOE-saker relatert til en endringsordre."""
    service = _get_endringsordre_service()
    relasjoner = service.hent_relaterte_saker(sak_id)
    return build_relaterte_response(sak_id, relasjoner)


@endringsordre_bp.route('/api/endringsordre/<sak_id>/kontekst', methods=['GET'])
@require_magic_link
@handle_service_errors
def hent_eo_kontekst(sak_id: str):
    """
    Hent komplett kontekst for en endringsordresak.

    Inkluderer relaterte KOE-saker, states, hendelser og oppsummering.
    """
    service = _get_endringsordre_service()
    kontekst = service.hent_komplett_eo_kontekst(sak_id)

    # EO har ekstra felt: eo_hendelser
    return build_kontekst_response(
        sak_id,
        kontekst,
        extra_fields={"eo_hendelser": kontekst.get("eo_hendelser", [])}
    )


@endringsordre_bp.route('/api/endringsordre/<sak_id>/koe', methods=['POST'])
@require_csrf
@require_magic_link
@handle_service_errors
def legg_til_koe(sak_id: str):
    """Legg til en KOE-sak til endringsordren."""
    payload = request.json

    error = validate_required_fields(payload, ['koe_sak_id'])
    if error:
        return error

    service = _get_endringsordre_service()
    result = service.legg_til_koe(sak_id, payload['koe_sak_id'])

    logger.info(f"KOE {payload['koe_sak_id']} lagt til EO {sak_id} (catenda_synced={result.get('catenda_synced')})")
    return jsonify({
        "success": True,
        "message": "KOE lagt til endringsordre",
        "catenda_synced": result.get("catenda_synced", False),
    })


@endringsordre_bp.route('/api/endringsordre/<sak_id>/koe/<koe_sak_id>', methods=['DELETE'])
@require_csrf
@require_magic_link
@handle_service_errors
def fjern_koe(sak_id: str, koe_sak_id: str):
    """Fjern en KOE-sak fra endringsordren."""
    service = _get_endringsordre_service()
    result = service.fjern_koe(sak_id, koe_sak_id)

    logger.info(f"KOE {koe_sak_id} fjernet fra EO {sak_id} (catenda_synced={result.get('catenda_synced')})")
    return jsonify({
        "success": True,
        "message": "KOE fjernet fra endringsordre",
        "catenda_synced": result.get("catenda_synced", False),
    })


@endringsordre_bp.route('/api/endringsordre/kandidater', methods=['GET'])
@handle_service_errors
def hent_kandidat_koe_saker():
    """Hent KOE-saker som kan legges til i en endringsordre."""
    service = _get_endringsordre_service()
    kandidater = service.hent_kandidat_koe_saker()
    return build_kandidater_response(kandidater)


@endringsordre_bp.route('/api/endringsordre/by-relatert/<sak_id>', methods=['GET'])
@require_magic_link
def finn_eoer_for_koe(sak_id: str):
    """Finn endringsordrer som refererer til en gitt KOE-sak."""
    service = _get_endringsordre_service()
    return safe_find_related(
        service.finn_eoer_for_koe,
        sak_id,
        "endringsordrer"
    )
