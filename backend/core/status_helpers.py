"""
Status Helper Functions

Business logic for status calculations and workflow decisions.
These functions are used by route handlers and services.

IMPORTANT: This file contains business logic, not generated constants.
          Do NOT confuse with generated_constants.py which is auto-generated.
"""
from core.generated_constants import (
    BH_SVAR_STATUS, BH_VEDERLAG_SVAR, BH_FRIST_SVAR
)


def krever_revisjon(vederlag_svar: str = None, frist_svar: str = None) -> bool:
    """
    Sjekker om BH-respons krever revisjon fra TE.

    Args:
        vederlag_svar: BH sitt svar på vederlagskrav (BH_VEDERLAG_SVAR kode)
        frist_svar: BH sitt svar på fristforlengelse (BH_FRIST_SVAR kode)

    Returns:
        True hvis TE må sende revidert krav, False ellers

    Business Logic:
        Revidering kreves hvis BH har:
        - Delvis godkjent vederlag eller frist
        - Avslått vederlag eller frist (uenig eller for sent)
    """
    revisjon_koder = [
        BH_VEDERLAG_SVAR['DELVIS_GODKJENT'],
        BH_VEDERLAG_SVAR['AVSLÅTT_UENIG'],
        BH_VEDERLAG_SVAR['AVSLÅTT_FOR_SENT'],
        BH_FRIST_SVAR['DELVIS_GODKJENT'],
        BH_FRIST_SVAR['AVSLÅTT_UENIG'],
        BH_FRIST_SVAR['AVSLÅTT_FOR_SENT'],
    ]
    return vederlag_svar in revisjon_koder or frist_svar in revisjon_koder


def beregn_bh_svar_status(vederlag_svar: str = None, frist_svar: str = None) -> str:
    """
    Beregner BH_SVAR_STATUS basert på vederlag og frist svar.

    Args:
        vederlag_svar: BH sitt svar på vederlagskrav (BH_VEDERLAG_SVAR kode)
        frist_svar: BH sitt svar på fristforlengelse (BH_FRIST_SVAR kode)

    Returns:
        BH_SVAR_STATUS kode som best representerer det totale svaret

    Business Logic - Prioritet (høyeste prioritet først):
        1. AVSLÅTT_FOR_SENT - hvis noen er for sent varslet
        2. AVSLÅTT_UENIG - hvis noen er avslått pga uenighet
        3. KREVER_AVKLARING - hvis noen avventer spesifikasjon
        4. DELVIS_GODKJENT - hvis noen er delvis godkjent
        5. GODKJENT - hvis alt er godkjent fullt ut (eller ikke aktuelt)
    """
    # Samle alle svar i en liste
    svar = [s for s in [vederlag_svar, frist_svar] if s]

    # Prioritet 1: For sent varslet
    if BH_VEDERLAG_SVAR['AVSLÅTT_FOR_SENT'] in svar or BH_FRIST_SVAR['AVSLÅTT_FOR_SENT'] in svar:
        return BH_SVAR_STATUS['AVSLÅTT_FOR_SENT']

    # Prioritet 2: Avslått pga uenighet
    if BH_VEDERLAG_SVAR['AVSLÅTT_UENIG'] in svar or BH_FRIST_SVAR['AVSLÅTT_UENIG'] in svar:
        return BH_SVAR_STATUS['AVSLÅTT_UENIG']

    # Prioritet 3: Avventer spesifikasjon
    if BH_VEDERLAG_SVAR['AVVENTER'] in svar or BH_FRIST_SVAR['AVVENTER'] in svar:
        return BH_SVAR_STATUS['KREVER_AVKLARING']

    # Prioritet 4: Delvis godkjent
    if BH_VEDERLAG_SVAR['DELVIS_GODKJENT'] in svar or BH_FRIST_SVAR['DELVIS_GODKJENT'] in svar:
        return BH_SVAR_STATUS['DELVIS_GODKJENT']

    # Prioritet 5: Fullt godkjent (default hvis ingen avslag/delvis)
    return BH_SVAR_STATUS['GODKJENT']
