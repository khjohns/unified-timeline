"""
Constants module for Unified Timeline.

Exports category mappings and metadata for NS 8407 construction contracts.
"""

from .grunnlag_categories import (
    GRUNNLAG_KATEGORIER,
    get_alle_hovedkategorier,
    get_hovedkategori,
    get_underkategori,
    get_underkategorier_for_hovedkategori,
    validate_kategori_kombinasjon,
)
from .vederlag_methods import (
    VARSLING_KOSTNADSTYPER,
    VEDERLAG_METODER,
    get_alle_varsel_krav,
    get_alle_vederlag_metoder,
    get_varsel_krav,
    get_vederlag_metode,
    krever_bh_godkjenning,
    krever_forhåndsvarsel,
    krever_indeksregulering,
)

__all__ = [
    # Grunnlag
    "GRUNNLAG_KATEGORIER",
    "get_hovedkategori",
    "get_underkategori",
    "get_alle_hovedkategorier",
    "get_underkategorier_for_hovedkategori",
    "validate_kategori_kombinasjon",
    # Vederlag
    "VEDERLAG_METODER",
    "VARSLING_KOSTNADSTYPER",
    "get_vederlag_metode",
    "get_varsel_krav",
    "krever_indeksregulering",
    "krever_forhåndsvarsel",
    "krever_bh_godkjenning",
    "get_alle_vederlag_metoder",
    "get_alle_varsel_krav",
]
