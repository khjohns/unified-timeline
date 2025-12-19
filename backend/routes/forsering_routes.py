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
"""
from flask import Blueprint, request, jsonify
from typing import Optional

from services.forsering_service import ForseringService
from services.timeline_service import TimelineService
from repositories.event_repository import JsonFileEventRepository
from lib.catenda_factory import get_catenda_client
from lib.decorators import handle_service_errors
from lib.auth.magic_link import require_magic_link
from lib.auth.csrf_protection import require_csrf
from utils.logger import get_logger

logger = get_logger(__name__)

# Create Blueprint
forsering_bp = Blueprint('forsering', __name__)

# Dependencies
event_repo = JsonFileEventRepository()
timeline_service = TimelineService()


def _get_forsering_service() -> ForseringService:
    """Oppretter ForseringService med dependencies."""
    return ForseringService(
        catenda_client=get_catenda_client(),
        event_repository=event_repo,
        timeline_service=timeline_service
    )


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
        "begrunnelse": "Forsering nødvendig for å overholde delfrister...",
        "avslatte_dager": 15  // Valgfritt - beregnes automatisk hvis utelatt
    }

    Response 201:
    {
        "success": true,
        "sak_id": "ny-forsering-sak-guid",
        "sakstype": "forsering",
        "relaterte_saker": [...],
        "forsering_data": {...}
    }

    Response 400:
    {
        "success": false,
        "error": "VALIDATION_ERROR",
        "message": "Estimert kostnad overstiger dagmulkt + 30%"
    }
    """
    payload = request.json

    # Valider påkrevde felter
    required_fields = ['avslatte_sak_ids', 'estimert_kostnad', 'dagmulktsats', 'begrunnelse']
    missing = [f for f in required_fields if f not in payload]
    if missing:
        return jsonify({
            "success": False,
            "error": "MISSING_FIELDS",
            "message": f"Mangler påkrevde felter: {', '.join(missing)}"
        }), 400

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


@forsering_bp.route('/api/forsering/<sak_id>/relaterte', methods=['GET'])
@require_magic_link
@handle_service_errors
def hent_relaterte_saker(sak_id: str):
    """
    Hent alle saker relatert til en forseringssak.

    Response 200:
    {
        "success": true,
        "sak_id": "forsering-sak-guid",
        "relaterte_saker": [
            {
                "relatert_sak_id": "frist-sak-guid",
                "relatert_sak_tittel": "Fristforlengelse - Værforhold",
                "bimsync_issue_number": 42
            }
        ]
    }
    """
    service = _get_forsering_service()
    relasjoner = service.hent_relaterte_saker(sak_id)

    return jsonify({
        "success": True,
        "sak_id": sak_id,
        "relaterte_saker": [
            {
                "relatert_sak_id": r.relatert_sak_id,
                "relatert_sak_tittel": r.relatert_sak_tittel,
                "bimsync_issue_board_ref": r.bimsync_issue_board_ref,
                "bimsync_issue_number": r.bimsync_issue_number
            }
            for r in relasjoner
        ]
    }), 200


@forsering_bp.route('/api/forsering/<sak_id>/kontekst', methods=['GET'])
@require_magic_link
@handle_service_errors
def hent_forseringskontekst(sak_id: str):
    """
    Hent komplett kontekst for en forseringssak.

    Inkluderer:
    - Relaterte saker (avslåtte fristforlengelser)
    - State for hver relatert sak
    - Relevante hendelser (grunnlag, frist)
    - Oppsummering (totalt avslåtte dager, grunnlagsoversikt)

    Response 200:
    {
        "success": true,
        "sak_id": "forsering-sak-guid",
        "relaterte_saker": [...],
        "sak_states": {...},
        "hendelser": {...},
        "oppsummering": {
            "antall_relaterte_saker": 2,
            "total_krevde_dager": 45,
            "total_avslatte_dager": 30,
            "grunnlag_oversikt": [...]
        }
    }
    """
    service = _get_forsering_service()
    kontekst = service.hent_komplett_forseringskontekst(sak_id)

    # Konverter SakRelasjon objekter til dicts
    relaterte_dicts = [
        {
            "relatert_sak_id": r.relatert_sak_id,
            "relatert_sak_tittel": r.relatert_sak_tittel,
            "bimsync_issue_board_ref": r.bimsync_issue_board_ref,
            "bimsync_issue_number": r.bimsync_issue_number
        }
        for r in kontekst.get("relaterte_saker", [])
    ]

    # Konverter SakState objekter til dicts
    states_dicts = {
        sak_id: state.model_dump() if hasattr(state, 'model_dump') else state
        for sak_id, state in kontekst.get("sak_states", {}).items()
    }

    return jsonify({
        "success": True,
        "sak_id": sak_id,
        "relaterte_saker": relaterte_dicts,
        "sak_states": states_dicts,
        "hendelser": kontekst.get("hendelser", {}),
        "oppsummering": kontekst.get("oppsummering", {})
    }), 200


@forsering_bp.route('/api/forsering/valider', methods=['POST'])
@require_magic_link
@handle_service_errors
def valider_forseringskostnad():
    """
    Valider om estimert kostnad er innenfor 30%-grensen.

    Request:
    {
        "estimert_kostnad": 150000,
        "avslatte_dager": 15,
        "dagmulktsats": 10000
    }

    Response 200:
    {
        "success": true,
        "er_gyldig": true,
        "maks_kostnad": 195000,
        "differanse": -45000,
        "prosent_av_maks": 76.9,
        "dagmulkt_grunnlag": 150000,
        "tillegg_30_prosent": 45000
    }
    """
    payload = request.json

    required_fields = ['estimert_kostnad', 'avslatte_dager', 'dagmulktsats']
    missing = [f for f in required_fields if f not in payload]
    if missing:
        return jsonify({
            "success": False,
            "error": "MISSING_FIELDS",
            "message": f"Mangler påkrevde felter: {', '.join(missing)}"
        }), 400

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


@forsering_bp.route('/api/forsering/kandidater', methods=['GET'])
@handle_service_errors
def hent_kandidat_koe_saker():
    """
    Hent KOE-saker som kan brukes i en forseringssak.

    En KOE er kandidat for forsering hvis:
    - Den har sakstype='standard' (ikke forsering/endringsordre)
    - Fristkravet er avslått av BH (bh_resultat='avslatt')

    Response 200:
    {
        "success": true,
        "kandidat_saker": [
            {
                "sak_id": "koe-sak-guid",
                "tittel": "KOE - Fundamentarbeid",
                "avslatte_dager": 14,
                "catenda_topic_id": "topic-guid"
            }
        ]
    }
    """
    service = _get_forsering_service()
    kandidater = service.hent_kandidat_koe_saker()

    return jsonify({
        "success": True,
        "kandidat_saker": kandidater
    }), 200


@forsering_bp.route('/api/forsering/by-relatert/<sak_id>', methods=['GET'])
@require_magic_link
def finn_forseringer_for_sak(sak_id: str):
    """
    Finn forseringssaker som refererer til en gitt KOE-sak.

    Brukes for å vise back-links fra KOE-saker til deres forsering.

    Response 200:
    {
        "success": true,
        "forseringer": [
            {
                "forsering_sak_id": "forsering-sak-guid",
                "tittel": "Forsering - Fundamentarbeid",
                "status": "aktiv",
                "estimert_kostnad": 150000
            }
        ]
    }
    """
    try:
        service = _get_forsering_service()
        forseringer = service.finn_forseringer_for_sak(sak_id)

        return jsonify({
            "success": True,
            "forseringer": forseringer
        }), 200

    except Exception as e:
        # Return empty list instead of 500 - this is a non-critical feature
        logger.warning(f"Kunne ikke søke etter forseringer for {sak_id}: {e}")
        return jsonify({
            "success": True,
            "forseringer": []
        }), 200


@forsering_bp.route('/api/forsering/<sak_id>/relatert', methods=['POST'])
@require_csrf
@require_magic_link
@handle_service_errors
def legg_til_relatert_sak(sak_id: str):
    """
    Legg til en KOE-sak som relatert til forseringen.

    Request:
    {
        "koe_sak_id": "koe-guid"
    }

    Response 200:
    {
        "success": true,
        "message": "KOE lagt til forsering"
    }
    """
    payload = request.json

    koe_sak_id = payload.get('koe_sak_id')
    if not koe_sak_id:
        return jsonify({
            "success": False,
            "error": "MISSING_FIELD",
            "message": "koe_sak_id er påkrevd"
        }), 400

    service = _get_forsering_service()
    service.legg_til_relatert_sak(sak_id, koe_sak_id)

    logger.info(f"KOE {koe_sak_id} lagt til forsering {sak_id}")

    return jsonify({
        "success": True,
        "message": "KOE lagt til forsering"
    }), 200


@forsering_bp.route('/api/forsering/<sak_id>/relatert/<koe_sak_id>', methods=['DELETE'])
@require_csrf
@require_magic_link
@handle_service_errors
def fjern_relatert_sak(sak_id: str, koe_sak_id: str):
    """
    Fjern en KOE-sak fra forseringen.

    Response 200:
    {
        "success": true,
        "message": "KOE fjernet fra forsering"
    }
    """
    service = _get_forsering_service()
    service.fjern_relatert_sak(sak_id, koe_sak_id)

    logger.info(f"KOE {koe_sak_id} fjernet fra forsering {sak_id}")

    return jsonify({
        "success": True,
        "message": "KOE fjernet fra forsering"
    }), 200


@forsering_bp.route('/api/forsering/<sak_id>/bh-respons', methods=['POST'])
@require_csrf
@require_magic_link
@handle_service_errors
def registrer_bh_respons(sak_id: str):
    """
    Registrer BH respons på forseringsvarsel.

    Request:
    {
        "aksepterer": true,
        "godkjent_kostnad": 120000,  // Valgfritt - kan være lavere enn estimert
        "begrunnelse": "Forseringen aksepteres..."
    }

    Response 200:
    {
        "success": true,
        "message": "BH respons registrert"
    }
    """
    payload = request.json

    # Valider påkrevde felter
    required_fields = ['aksepterer', 'begrunnelse']
    missing = [f for f in required_fields if f not in payload]
    if missing:
        return jsonify({
            "success": False,
            "error": "MISSING_FIELDS",
            "message": f"Mangler påkrevde felter: {', '.join(missing)}"
        }), 400

    # Hent aktor fra magic link context
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

    Request:
    {
        "begrunnelse": "Forseringen stoppes fordi...",
        "paalopte_kostnader": 75000  // Valgfritt - påløpte kostnader ved stopp
    }

    Response 200:
    {
        "success": true,
        "message": "Forsering stoppet",
        "dato_stoppet": "2024-01-15"
    }
    """
    payload = request.json

    begrunnelse = payload.get('begrunnelse')
    if not begrunnelse:
        return jsonify({
            "success": False,
            "error": "MISSING_FIELD",
            "message": "begrunnelse er påkrevd"
        }), 400

    # Hent aktor fra magic link context
    aktor = getattr(request, 'magic_link_name', 'Ukjent TE')

    service = _get_forsering_service()
    result = service.stopp_forsering(
        sak_id=sak_id,
        begrunnelse=begrunnelse,
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

    Request:
    {
        "paalopte_kostnader": 85000,
        "kommentar": "Oppdatert med nye timer..."  // Valgfritt
    }

    Response 200:
    {
        "success": true,
        "message": "Kostnader oppdatert"
    }
    """
    payload = request.json

    paalopte_kostnader = payload.get('paalopte_kostnader')
    if paalopte_kostnader is None:
        return jsonify({
            "success": False,
            "error": "MISSING_FIELD",
            "message": "paalopte_kostnader er påkrevd"
        }), 400

    # Hent aktor fra magic link context
    aktor = getattr(request, 'magic_link_name', 'Ukjent TE')

    service = _get_forsering_service()
    result = service.oppdater_kostnader(
        sak_id=sak_id,
        paalopte_kostnader=float(paalopte_kostnader),
        kommentar=payload.get('kommentar'),
        aktor=aktor
    )

    logger.info(f"Forseringskostnader for {sak_id} oppdatert til {paalopte_kostnader}")

    return jsonify({
        "success": True,
        "message": "Kostnader oppdatert",
        **result
    }), 200
