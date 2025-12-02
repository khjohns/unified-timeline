"""
AUTO-GENERERT FIL - IKKE REDIGER MANUELT
Generert fra: shared/status-codes.json
Generert: 2025-12-02T11:35:10.975Z

Versjon: 1.0.0
"""
from typing import Dict

SAK_STATUS = {
    "UNDER_VARSLING": "100000000",
    "VARSLET": "100000001",
    "VENTER_PAA_SVAR": "100000002",
    "UNDER_AVKLARING": "100000003",
    "VURDERES_AV_TE": "100000007",
    "OMFORENT": "100000005",
    "PAAGAAR": "100000013",
    "UNDER_TVIST": "100000008",
    "LUKKET_IMPLEMENTERT": "100000011",
    "LUKKET_AVSLÅTT": "100000006",
    "LUKKET_TILBAKEKALT": "100000009",
    "LUKKET_ANNULLERT": "100000012",
}

KOE_STATUS = {
    "UTKAST": "100000001",
    "SENDT_TIL_BH": "100000002",
    "BESVART": "200000001",
    "TILBAKEKALT": "100000009",
}

BH_SVAR_STATUS = {
    "UTKAST": "300000001",
    "GODKJENT": "100000004",
    "DELVIS_GODKJENT": "300000002",
    "AVSLÅTT_FOR_SENT": "100000010",
    "AVSLÅTT_UENIG": "100000006",
    "KREVER_AVKLARING": "100000003",
}

BH_VEDERLAG_SVAR = {
    "GODKJENT_FULLT": "100000000",
    "DELVIS_GODKJENT": "100000001",
    "AVSLÅTT_UENIG": "100000002",
    "AVSLÅTT_FOR_SENT": "100000003",
    "AVVENTER": "100000004",
    "GODKJENT_ANNEN_METODE": "100000005",
}

BH_FRIST_SVAR = {
    "GODKJENT_FULLT": "100000000",
    "DELVIS_GODKJENT": "100000001",
    "AVSLÅTT_UENIG": "100000002",
    "AVSLÅTT_FOR_SENT": "100000003",
    "AVVENTER": "100000004",
}

VEDERLAGSMETODER = {
    "ENTREPRENORENS_TILBUD": "100000000",
    "KONTRAKTENS_ENHETSPRISER": "100000001",
    "JUSTERTE_ENHETSPRISER": "100000002",
    "REGNINGSARBEID": "100000003",
}

# ============ LABEL LOOKUP FUNCTIONS ============
def get_sak_status_label(code: str) -> str:
    """Returnerer lesbar label for sakStatus-kode"""
    labels: Dict[str, str] = {
        "100000000": "Under varsling",
        "100000001": "Varslet",
        "100000002": "Venter på svar",
        "100000003": "Under avklaring",
        "100000007": "Vurderes av TE",
        "100000005": "Omforent (EO utstedes)",
        "100000013": "Pågår - Under utførelse",
        "100000008": "Under tvist",
        "100000011": "Lukket (Implementert)",
        "100000006": "Lukket (Avslått)",
        "100000009": "Lukket (Tilbakekalt)",
        "100000012": "Lukket (Annullert)",
    }
    return labels.get(code, "Ukjent")

def get_koe_status_label(code: str) -> str:
    """Returnerer lesbar label for koeStatus-kode"""
    labels: Dict[str, str] = {
        "100000001": "Utkast",
        "100000002": "Sendt til BH",
        "200000001": "Besvart",
        "100000009": "Tilbakekalt",
    }
    return labels.get(code, "Ukjent")

def get_bh_svar_status_label(code: str) -> str:
    """Returnerer lesbar label for bhSvarStatus-kode"""
    labels: Dict[str, str] = {
        "300000001": "Utkast",
        "100000004": "Godkjent",
        "300000002": "Delvis Godkjent",
        "100000010": "Avslått (For sent)",
        "100000006": "Avslått (Uenig)",
        "100000003": "Krever avklaring",
    }
    return labels.get(code, "Ukjent")

def get_bh_vederlag_svar_label(code: str) -> str:
    """Returnerer lesbar label for bhVederlagSvar-kode"""
    labels: Dict[str, str] = {
        "100000000": "Godkjent fullt ut",
        "100000001": "Delvis godkjent",
        "100000002": "Avslått (uenig i grunnlag)",
        "100000003": "Avslått (for sent varslet)",
        "100000004": "Avventer (ber om nærmere spesifikasjon)",
        "100000005": "Godkjent med annen metode",
    }
    return labels.get(code, "Ukjent")

def get_bh_frist_svar_label(code: str) -> str:
    """Returnerer lesbar label for bhFristSvar-kode"""
    labels: Dict[str, str] = {
        "100000000": "Godkjent fullt ut",
        "100000001": "Delvis godkjent (enig i grunnlag, bestrider beregning)",
        "100000002": "Avslått (uenig i grunnlag)",
        "100000003": "Avslått (for sent varslet)",
        "100000004": "Avventer (ber om nærmere spesifikasjon)",
    }
    return labels.get(code, "Ukjent")

def get_vederlagsmetoder_label(code: str) -> str:
    """Returnerer lesbar label for vederlagsmetoder-kode"""
    labels: Dict[str, str] = {
        "100000000": "Entreprenørens tilbud (§34.2.1)",
        "100000001": "Kontraktens enhetspriser (§34.3.1)",
        "100000002": "Justerte enhetspriser (§34.3.2)",
        "100000003": "Regningsarbeid (§30.1)",
    }
    return labels.get(code, "Ukjent")

