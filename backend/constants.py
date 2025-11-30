"""
Sentrale konstanter for KOE-systemet
Disse må holdes synkronisert med frontend (utils/statusHelpers.ts)

TODO: Generer denne filen fra shared/status-codes.json
"""

# ============ SAK STATUS ============
SAK_STATUS = {
    'UNDER_VARSLING': '100000000',
    'VARSLET': '100000001',
    'VENTER_PAA_SVAR': '100000002',
    'UNDER_AVKLARING': '100000003',
    'VURDERES_AV_TE': '100000007',
    'OMFORENT': '100000005',
    'PAAGAAR': '100000013',
    'UNDER_TVIST': '100000008',
    'LUKKET_IMPLEMENTERT': '100000011',
    'LUKKET_AVSLÅTT': '100000006',
    'LUKKET_TILBAKEKALT': '100000009',
    'LUKKET_ANNULLERT': '100000012',
}

# ============ KOE STATUS ============
KOE_STATUS = {
    'UTKAST': '100000001',
    'SENDT_TIL_BH': '100000002',
    'BESVART': '200000001',
    'TILBAKEKALT': '100000009',
}

# ============ BH SVAR STATUS ============
BH_SVAR_STATUS = {
    'UTKAST': '300000001',
    'GODKJENT': '100000004',
    'DELVIS_GODKJENT': '300000002',
    'AVSLÅTT_FOR_SENT': '100000010',
    'AVSLÅTT_UENIG': '100000006',
    'KREVER_AVKLARING': '100000003',
}

# ============ BH VEDERLAG SVAR ============
BH_VEDERLAG_SVAR = {
    'GODKJENT_FULLT': '100000000',
    'DELVIS_GODKJENT': '100000001',
    'AVSLÅTT_UENIG': '100000002',
    'AVSLÅTT_FOR_SENT': '100000003',
    'AVVENTER': '100000004',
    'GODKJENT_ANNEN_METODE': '100000005',
}

# ============ BH FRIST SVAR ============
BH_FRIST_SVAR = {
    'GODKJENT_FULLT': '100000000',
    'DELVIS_GODKJENT': '100000001',
    'AVSLÅTT_UENIG': '100000002',
    'AVSLÅTT_FOR_SENT': '100000003',
    'AVVENTER': '100000004',
}

# ============ VEDERLAGSMETODER ============
VEDERLAGSMETODER = {
    'ENTREPRENORENS_TILBUD': '100000000',
    'KONTRAKTENS_ENHETSPRISER': '100000001',
    'JUSTERTE_ENHETSPRISER': '100000002',
    'REGNINGSARBEID': '100000003',
}

# ============ LABEL MAPPINGS ============
def get_vederlag_svar_label(code: str) -> str:
    """Returnerer lesbar label for BH vederlag-svar kode"""
    labels = {
        '100000000': 'Godkjent fullt ut',
        '100000001': 'Delvis godkjent',
        '100000002': 'Avslått (uenig)',
        '100000003': 'Avslått (for sent)',
        '100000004': 'Avventer',
        '100000005': 'Godkjent med annen metode',
    }
    return labels.get(code, 'Uspesifisert')

def get_frist_svar_label(code: str) -> str:
    """Returnerer lesbar label for BH frist-svar kode"""
    labels = {
        '100000000': 'Godkjent fullt ut',
        '100000001': 'Delvis godkjent',
        '100000002': 'Avslått',
        '100000003': 'Avslått (for sent)',
        '100000004': 'Avventer',
    }
    return labels.get(code, 'Uspesifisert')

def krever_revisjon(vederlag_svar: str = None, frist_svar: str = None) -> bool:
    """Sjekker om BH-respons krever revisjon fra TE"""
    revisjon_koder = [
        BH_VEDERLAG_SVAR['DELVIS_GODKJENT'],
        BH_VEDERLAG_SVAR['AVSLÅTT_UENIG'],
        BH_VEDERLAG_SVAR['AVSLÅTT_FOR_SENT'],
        BH_FRIST_SVAR['DELVIS_GODKJENT'],
        BH_FRIST_SVAR['AVSLÅTT_UENIG'],
        BH_FRIST_SVAR['AVSLÅTT_FOR_SENT'],
    ]
    return vederlag_svar in revisjon_koder or frist_svar in revisjon_koder
