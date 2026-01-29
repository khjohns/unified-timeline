"""
Generiske hjelpefunksjoner for HTTP-responser.

Disse funksjonene standardiserer JSON-responser på tvers av alle routes.
"""

from typing import Any, Optional, Tuple
from flask import jsonify


def error_response(
    error_code: str,
    message: str,
    status_code: int = 400,
    **extra_fields
) -> Tuple[Any, int]:
    """
    Bygger standard feilrespons.

    Args:
        error_code: Feilkode (f.eks. "VALIDATION_ERROR", "INVALID_STATE")
        message: Brukervennlig feilmelding
        status_code: HTTP statuskode (default 400)
        **extra_fields: Ekstra felt å inkludere i responsen

    Returns:
        tuple: (jsonify response, status_code)

    Example:
        return error_response(
            "VALIDATION_ERROR",
            "Manglende felt: tittel",
            400,
            missing_fields=["tittel"]
        )
    """
    response = {
        "success": False,
        "error": error_code,
        "message": message,
        **extra_fields
    }
    return jsonify(response), status_code


def success_response(
    status_code: int = 200,
    message: Optional[str] = None,
    **data
) -> Tuple[Any, int]:
    """
    Bygger standard suksess-respons.

    Args:
        status_code: HTTP statuskode (default 200)
        message: Valgfri suksessmelding
        **data: Data å inkludere i responsen

    Returns:
        tuple: (jsonify response, status_code)

    Example:
        return success_response(
            201,
            message="Søknad opprettet",
            sak_id=sak_id,
            version=new_version
        )
    """
    response = {"success": True, **data}
    if message:
        response["message"] = message
    return jsonify(response), status_code
