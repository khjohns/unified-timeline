"""
Hjelpefunksjoner for versjonskontroll og concurrency-håndtering.

Disse funksjonene standardiserer feilresponser for:
- ConcurrencyError (optimistisk låsing)
- NOT_FOUND (ressurs ikke funnet)
- VERSION_CONFLICT (versjonsmismatch)
"""

from typing import Any, Tuple
from flask import jsonify

from repositories.event_repository import ConcurrencyError


def handle_concurrency_error(error: ConcurrencyError) -> Tuple[Any, int]:
    """
    Bygger standard 409-respons for ConcurrencyError.

    Brukes i try/except blokker etter event_repo.append().

    Args:
        error: ConcurrencyError fra repository

    Returns:
        tuple: (jsonify response, 409 status code)

    Example:
        try:
            new_version = event_repo.append(event, expected_version)
        except ConcurrencyError as e:
            return handle_concurrency_error(e)
    """
    return jsonify({
        "success": False,
        "error": "VERSION_CONFLICT",
        "expected_version": error.expected,
        "current_version": error.actual,
        "message": "Samtidig endring oppdaget. Vennligst last inn på nytt."
    }), 409


def not_found_response(
    resource_type: str,
    resource_id: str
) -> Tuple[Any, int]:
    """
    Bygger standard 404-respons for ressurs ikke funnet.

    Args:
        resource_type: Type ressurs (f.eks. "Søknad", "Sak")
        resource_id: ID til ressursen

    Returns:
        tuple: (jsonify response, 404 status code)

    Example:
        if not events:
            return not_found_response("Søknad", sak_id)
    """
    return jsonify({
        "success": False,
        "error": "NOT_FOUND",
        "message": f"{resource_type} {resource_id} ikke funnet"
    }), 404


def version_conflict_response(
    expected_version: int,
    current_version: int
) -> Tuple[Any, int]:
    """
    Bygger standard 409-respons for versjonskonflikter.

    Brukes når expected_version != current_version før event append.

    Args:
        expected_version: Versjonen klienten forventet
        current_version: Faktisk versjon i database

    Returns:
        tuple: (jsonify response, 409 status code)

    Example:
        if expected_version != current_version:
            return version_conflict_response(expected_version, current_version)
    """
    return jsonify({
        "success": False,
        "error": "VERSION_CONFLICT",
        "expected_version": expected_version,
        "current_version": current_version,
        "message": "Tilstanden har endret seg. Vennligst last inn på nytt."
    }), 409
