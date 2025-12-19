"""
Felles utilities for routes som håndterer relaterte saker.

Brukes av forsering_routes.py og endringsordre_routes.py for å redusere
duplisert kode for felles operasjoner på container-saker.
"""
from typing import Any, Callable, Dict, List, Optional
from flask import jsonify

from models.sak_state import SakRelasjon, SakState
from utils.logger import get_logger

logger = get_logger(__name__)


def serialize_sak_relasjon(relasjon: SakRelasjon) -> Dict[str, Any]:
    """
    Konverterer en SakRelasjon til dict for JSON-respons.

    Args:
        relasjon: SakRelasjon objekt

    Returns:
        Dict egnet for JSON serialisering
    """
    return {
        "relatert_sak_id": relasjon.relatert_sak_id,
        "relatert_sak_tittel": relasjon.relatert_sak_tittel,
        "bimsync_issue_board_ref": relasjon.bimsync_issue_board_ref,
        "bimsync_issue_number": relasjon.bimsync_issue_number
    }


def serialize_relaterte_saker(relasjoner: List[SakRelasjon]) -> List[Dict[str, Any]]:
    """
    Konverterer en liste med SakRelasjon til dicts for JSON-respons.

    Args:
        relasjoner: Liste med SakRelasjon objekter

    Returns:
        Liste med dicts egnet for JSON serialisering
    """
    return [serialize_sak_relasjon(r) for r in relasjoner]


def serialize_sak_states(states: Dict[str, SakState]) -> Dict[str, Any]:
    """
    Konverterer dict med SakState til dict for JSON-respons.

    Args:
        states: Dict[sak_id, SakState]

    Returns:
        Dict[sak_id, dict] egnet for JSON serialisering
    """
    return {
        sak_id: state.model_dump() if hasattr(state, 'model_dump') else state
        for sak_id, state in states.items()
    }


def build_relaterte_response(
    sak_id: str,
    relasjoner: List[SakRelasjon]
) -> tuple:
    """
    Bygger standard respons for hent_relaterte_saker endepunkt.

    Args:
        sak_id: ID for containersaken
        relasjoner: Liste med relaterte saker

    Returns:
        Tuple (jsonify response, status_code)
    """
    return jsonify({
        "success": True,
        "sak_id": sak_id,
        "relaterte_saker": serialize_relaterte_saker(relasjoner)
    }), 200


def build_kontekst_response(
    sak_id: str,
    kontekst: Dict[str, Any],
    extra_fields: Optional[Dict[str, Any]] = None
) -> tuple:
    """
    Bygger standard respons for hent_kontekst endepunkt.

    Args:
        sak_id: ID for containersaken
        kontekst: Dict med kontekst-data fra service
        extra_fields: Eventuelle ekstra felter for spesifikk sakstype

    Returns:
        Tuple (jsonify response, status_code)
    """
    response = {
        "success": True,
        "sak_id": sak_id,
        "relaterte_saker": serialize_relaterte_saker(
            kontekst.get("relaterte_saker", [])
        ),
        "sak_states": serialize_sak_states(
            kontekst.get("sak_states", {})
        ),
        "hendelser": kontekst.get("hendelser", {}),
        "oppsummering": kontekst.get("oppsummering", {})
    }

    # Legg til ekstra felter hvis de finnes
    if extra_fields:
        response.update(extra_fields)

    return jsonify(response), 200


def build_kandidater_response(kandidater: List[Dict[str, Any]]) -> tuple:
    """
    Bygger standard respons for hent_kandidater endepunkt.

    Args:
        kandidater: Liste med kandidat-saker

    Returns:
        Tuple (jsonify response, status_code)
    """
    return jsonify({
        "success": True,
        "kandidat_saker": kandidater
    }), 200


def build_success_message(message: str, extra_data: Optional[Dict[str, Any]] = None) -> tuple:
    """
    Bygger standard suksess-respons med melding.

    Args:
        message: Suksessmelding
        extra_data: Eventuelle ekstra felter

    Returns:
        Tuple (jsonify response, status_code)
    """
    response = {
        "success": True,
        "message": message
    }
    if extra_data:
        response.update(extra_data)
    return jsonify(response), 200


def validate_required_fields(payload: Dict[str, Any], required: List[str]) -> Optional[tuple]:
    """
    Validerer at påkrevde felter finnes i payload.

    Args:
        payload: Request payload
        required: Liste med påkrevde feltnavn

    Returns:
        None hvis ok, ellers (error_response, status_code)
    """
    missing = [f for f in required if f not in payload or payload[f] is None]
    if missing:
        return jsonify({
            "success": False,
            "error": "MISSING_FIELDS",
            "message": f"Mangler påkrevde felter: {', '.join(missing)}"
        }), 400
    return None


def safe_find_related(
    service_method: Callable,
    sak_id: str,
    result_key: str
) -> tuple:
    """
    Trygt søk etter relaterte saker med graceful fallback.

    Brukes for by-relatert endepunkter som ikke bør feile med 500.

    Args:
        service_method: Service-metode å kalle (f.eks. service.finn_forseringer_for_sak)
        sak_id: Sak-ID å søke etter
        result_key: Nøkkel i respons (f.eks. "forseringer" eller "endringsordrer")

    Returns:
        Tuple (jsonify response, status_code)
    """
    try:
        results = service_method(sak_id)
        return jsonify({
            "success": True,
            result_key: results
        }), 200
    except Exception as e:
        logger.warning(f"Kunne ikke søke etter {result_key} for {sak_id}: {e}")
        return jsonify({
            "success": True,
            result_key: []
        }), 200
