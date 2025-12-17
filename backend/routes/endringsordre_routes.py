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
"""
from flask import Blueprint, request, jsonify
from typing import Optional

from services.endringsordre_service import EndringsordreService
from services.timeline_service import TimelineService
from repositories.event_repository import JsonFileEventRepository
from integrations.catenda import CatendaClient
from core.config import settings
from lib.auth.magic_link import require_magic_link
from lib.auth.csrf_protection import require_csrf
from utils.logger import get_logger

logger = get_logger(__name__)

# Create Blueprint
endringsordre_bp = Blueprint('endringsordre', __name__)

# Dependencies
event_repo = JsonFileEventRepository()
timeline_service = TimelineService()


def _get_endringsordre_service() -> EndringsordreService:
    """
    Oppretter EndringsordreService med dependencies.

    Catenda client opprettes kun hvis konfigurert.
    """
    catenda_client = None

    if settings.CATENDA_CLIENT_ID:
        catenda_client = CatendaClient(
            client_id=settings.CATENDA_CLIENT_ID,
            client_secret=settings.CATENDA_CLIENT_SECRET
        )
        if settings.CATENDA_TOPIC_BOARD_ID:
            catenda_client.topic_board_id = settings.CATENDA_TOPIC_BOARD_ID

    return EndringsordreService(
        catenda_client=catenda_client,
        event_repository=event_repo,
        timeline_service=timeline_service
    )


@endringsordre_bp.route('/api/endringsordre/opprett', methods=['POST'])
@require_csrf
@require_magic_link
def opprett_endringsordresak():
    """
    Opprett en ny endringsordresak.

    Request:
    {
        "eo_nummer": "EO-001",
        "beskrivelse": "Endring av fundamenter...",
        "koe_sak_ids": ["sak-guid-1", "sak-guid-2"],
        "konsekvenser": {
            "sha": false,
            "kvalitet": false,
            "fremdrift": true,
            "pris": true,
            "annet": false
        },
        "konsekvens_beskrivelse": "Forsinket leveranse og økte kostnader",
        "oppgjorsform": "ENHETSPRISER",
        "kompensasjon_belop": 150000,
        "fradrag_belop": null,
        "er_estimat": false,
        "frist_dager": 10,
        "ny_sluttdato": "2025-03-15",
        "utstedt_av": "Ola Nordmann"
    }

    Response 201:
    {
        "success": true,
        "sak_id": "ny-eo-sak-guid",
        "sakstype": "endringsordre",
        "relaterte_saker": [...],
        "endringsordre_data": {...}
    }

    Response 400:
    {
        "success": false,
        "error": "VALIDATION_ERROR",
        "message": "EO-nummer er påkrevd"
    }
    """
    try:
        payload = request.json

        # Valider påkrevde felter
        required_fields = ['eo_nummer', 'beskrivelse']
        missing = [f for f in required_fields if not payload.get(f)]
        if missing:
            return jsonify({
                "success": False,
                "error": "MISSING_FIELDS",
                "message": f"Mangler påkrevde felter: {', '.join(missing)}"
            }), 400

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

        logger.info(f"Endringsordresak opprettet: {result['sak_id']}")

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
        logger.exception(f"Uventet feil ved opprettelse av endringsordresak: {e}")
        return jsonify({
            "success": False,
            "error": "INTERNAL_ERROR",
            "message": "En uventet feil oppstod"
        }), 500


@endringsordre_bp.route('/api/endringsordre/<sak_id>/relaterte', methods=['GET'])
@require_magic_link
def hent_relaterte_koe_saker(sak_id: str):
    """
    Hent alle KOE-saker relatert til en endringsordre.

    Response 200:
    {
        "success": true,
        "sak_id": "eo-sak-guid",
        "relaterte_saker": [
            {
                "relatert_sak_id": "koe-sak-guid",
                "relatert_sak_tittel": "KOE - Fundamentendring",
                "bimsync_issue_number": 42
            }
        ]
    }
    """
    try:
        service = _get_endringsordre_service()
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
        logger.exception(f"Feil ved henting av relaterte KOE-saker for {sak_id}: {e}")
        return jsonify({
            "success": False,
            "error": "INTERNAL_ERROR",
            "message": "Kunne ikke hente relaterte saker"
        }), 500


@endringsordre_bp.route('/api/endringsordre/<sak_id>/kontekst', methods=['GET'])
@require_magic_link
def hent_eo_kontekst(sak_id: str):
    """
    Hent komplett kontekst for en endringsordresak.

    Inkluderer:
    - Relaterte KOE-saker
    - State for hver KOE-sak
    - Hendelser fra KOE-sakene
    - EO-sakens egne hendelser
    - Oppsummering (totalt vederlag, frist, etc.)

    Response 200:
    {
        "success": true,
        "sak_id": "eo-sak-guid",
        "relaterte_saker": [...],
        "sak_states": {...},
        "hendelser": {...},
        "eo_hendelser": [...],
        "oppsummering": {
            "antall_koe_saker": 2,
            "total_krevd_vederlag": 300000,
            "total_godkjent_vederlag": 250000,
            "total_krevd_dager": 20,
            "total_godkjent_dager": 15,
            "koe_oversikt": [...]
        }
    }
    """
    try:
        service = _get_endringsordre_service()
        kontekst = service.hent_komplett_eo_kontekst(sak_id)

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
            "eo_hendelser": kontekst.get("eo_hendelser", []),
            "oppsummering": kontekst.get("oppsummering", {})
        }), 200

    except Exception as e:
        logger.exception(f"Feil ved henting av kontekst for EO {sak_id}: {e}")
        return jsonify({
            "success": False,
            "error": "INTERNAL_ERROR",
            "message": "Kunne ikke hente endringsordre-kontekst"
        }), 500


@endringsordre_bp.route('/api/endringsordre/<sak_id>/koe', methods=['POST'])
@require_csrf
@require_magic_link
def legg_til_koe(sak_id: str):
    """
    Legg til en KOE-sak til endringsordren.

    Request:
    {
        "koe_sak_id": "koe-sak-guid"
    }

    Response 200:
    {
        "success": true,
        "message": "KOE lagt til endringsordre"
    }
    """
    try:
        payload = request.json
        koe_sak_id = payload.get('koe_sak_id')

        if not koe_sak_id:
            return jsonify({
                "success": False,
                "error": "MISSING_FIELDS",
                "message": "koe_sak_id er påkrevd"
            }), 400

        service = _get_endringsordre_service()
        service.legg_til_koe(sak_id, koe_sak_id)

        logger.info(f"KOE {koe_sak_id} lagt til EO {sak_id}")

        return jsonify({
            "success": True,
            "message": "KOE lagt til endringsordre"
        }), 200

    except RuntimeError as e:
        logger.error(f"Catenda-feil: {e}")
        return jsonify({
            "success": False,
            "error": "CATENDA_ERROR",
            "message": str(e)
        }), 502

    except Exception as e:
        logger.exception(f"Feil ved tillegging av KOE til EO {sak_id}: {e}")
        return jsonify({
            "success": False,
            "error": "INTERNAL_ERROR",
            "message": "Kunne ikke legge til KOE"
        }), 500


@endringsordre_bp.route('/api/endringsordre/<sak_id>/koe/<koe_sak_id>', methods=['DELETE'])
@require_csrf
@require_magic_link
def fjern_koe(sak_id: str, koe_sak_id: str):
    """
    Fjern en KOE-sak fra endringsordren.

    Response 200:
    {
        "success": true,
        "message": "KOE fjernet fra endringsordre"
    }
    """
    try:
        service = _get_endringsordre_service()
        service.fjern_koe(sak_id, koe_sak_id)

        logger.info(f"KOE {koe_sak_id} fjernet fra EO {sak_id}")

        return jsonify({
            "success": True,
            "message": "KOE fjernet fra endringsordre"
        }), 200

    except RuntimeError as e:
        logger.error(f"Catenda-feil: {e}")
        return jsonify({
            "success": False,
            "error": "CATENDA_ERROR",
            "message": str(e)
        }), 502

    except Exception as e:
        logger.exception(f"Feil ved fjerning av KOE fra EO {sak_id}: {e}")
        return jsonify({
            "success": False,
            "error": "INTERNAL_ERROR",
            "message": "Kunne ikke fjerne KOE"
        }), 500


@endringsordre_bp.route('/api/endringsordre/kandidater', methods=['GET'])
@require_magic_link
def hent_kandidat_koe_saker():
    """
    Hent KOE-saker som kan legges til i en endringsordre.

    Response 200:
    {
        "success": true,
        "kandidat_saker": [
            {
                "sak_id": "koe-sak-guid",
                "tittel": "KOE - Fundamentendring",
                "overordnet_status": "OMFORENT",
                "sum_godkjent": 150000,
                "godkjent_dager": 10
            }
        ]
    }
    """
    try:
        service = _get_endringsordre_service()
        kandidater = service.hent_kandidat_koe_saker()

        return jsonify({
            "success": True,
            "kandidat_saker": kandidater
        }), 200

    except Exception as e:
        logger.exception(f"Feil ved henting av kandidat-KOE-saker: {e}")
        return jsonify({
            "success": False,
            "error": "INTERNAL_ERROR",
            "message": "Kunne ikke hente kandidat-saker"
        }), 500


@endringsordre_bp.route('/api/endringsordre/by-relatert/<sak_id>', methods=['GET'])
@require_magic_link
def finn_eoer_for_koe(sak_id: str):
    """
    Finn endringsordrer som refererer til en gitt KOE-sak.

    Brukes for å vise back-links fra KOE-saker til deres EO.

    Response 200:
    {
        "success": true,
        "endringsordrer": [
            {
                "eo_sak_id": "eo-sak-guid",
                "eo_nummer": "EO-001",
                "dato_utstedt": "2025-02-15",
                "status": "utstedt"
            }
        ]
    }
    """
    try:
        service = _get_endringsordre_service()
        eoer = service.finn_eoer_for_koe(sak_id)

        return jsonify({
            "success": True,
            "endringsordrer": eoer
        }), 200

    except Exception as e:
        logger.exception(f"Feil ved søk etter EOer for KOE {sak_id}: {e}")
        return jsonify({
            "success": False,
            "error": "INTERNAL_ERROR",
            "message": "Kunne ikke finne endringsordrer"
        }), 500
