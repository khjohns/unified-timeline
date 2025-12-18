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
from integrations.catenda import CatendaClient
from core.config import settings
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
    """
    Oppretter ForseringService med dependencies.

    Catenda client opprettes kun hvis konfigurert.
    """
    catenda_client = None

    if settings.catenda_client_id:
        catenda_client = CatendaClient(
            client_id=settings.catenda_client_id,
            client_secret=settings.catenda_client_secret
        )
        if settings.catenda_topic_board_id:
            catenda_client.topic_board_id = settings.catenda_topic_board_id

        # Set access token for authentication
        if settings.catenda_access_token:
            catenda_client.set_access_token(settings.catenda_access_token)
        elif settings.catenda_client_secret:
            catenda_client.authenticate()

    return ForseringService(
        catenda_client=catenda_client,
        event_repository=event_repo,
        timeline_service=timeline_service
    )


@forsering_bp.route('/api/forsering/opprett', methods=['POST'])
@require_csrf
@require_magic_link
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
    try:
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

    except ValueError as e:
        logger.warning(f"Validering feilet: {e}")
        return jsonify({
            "success": False,
            "error": "VALIDATION_ERROR",
            "message": str(e)
        }), 400

    except RuntimeError as e:
        logger.error(f"Catenda-feil: {e}")
        return jsonify({
            "success": False,
            "error": "CATENDA_ERROR",
            "message": str(e)
        }), 502

    except Exception as e:
        logger.exception(f"Uventet feil ved opprettelse av forseringssak: {e}")
        return jsonify({
            "success": False,
            "error": "INTERNAL_ERROR",
            "message": "En uventet feil oppstod"
        }), 500


@forsering_bp.route('/api/forsering/<sak_id>/relaterte', methods=['GET'])
@require_magic_link
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
    try:
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

    except Exception as e:
        logger.exception(f"Feil ved henting av relaterte saker for {sak_id}: {e}")
        return jsonify({
            "success": False,
            "error": "INTERNAL_ERROR",
            "message": "Kunne ikke hente relaterte saker"
        }), 500


@forsering_bp.route('/api/forsering/<sak_id>/kontekst', methods=['GET'])
@require_magic_link
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
    try:
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

    except Exception as e:
        logger.exception(f"Feil ved henting av kontekst for {sak_id}: {e}")
        return jsonify({
            "success": False,
            "error": "INTERNAL_ERROR",
            "message": "Kunne ikke hente forseringskontekst"
        }), 500


@forsering_bp.route('/api/forsering/valider', methods=['POST'])
@require_magic_link
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
    try:
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

    except Exception as e:
        logger.exception(f"Feil ved validering: {e}")
        return jsonify({
            "success": False,
            "error": "INTERNAL_ERROR",
            "message": "Kunne ikke validere"
        }), 500


@forsering_bp.route('/api/forsering/kandidater', methods=['GET'])
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
    try:
        service = _get_forsering_service()
        kandidater = service.hent_kandidat_koe_saker()

        return jsonify({
            "success": True,
            "kandidat_saker": kandidater
        }), 200

    except Exception as e:
        logger.exception(f"Feil ved henting av kandidat-KOE-saker for forsering: {e}")
        return jsonify({
            "success": False,
            "error": "INTERNAL_ERROR",
            "message": "Kunne ikke hente kandidat-saker"
        }), 500


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
