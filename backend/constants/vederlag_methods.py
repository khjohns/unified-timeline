"""
Vederlagsmetoder for NS 8407 endringsordrer.

Disse metodene beskriver HVORDAN vederlag skal beregnes.
Valg av metode har juridiske konsekvenser:
- Om indeksregulering gjelder
- Hvilke varselfrister som må overholdes
- Om BH må akseptere metoden på forhånd
- Dokumentasjonskrav

Strukturen følger NS 8407 kapittel 30 og 34.

UPDATED 2025-12-05: Simplified to 3 main methods (uppercase values)
- ENHETSPRISER: Covers both kontrakts- and justerte enhetspriser (§34.3)
- REGNINGSARBEID: Regningsarbeid with kostnadsoverslag (§30.2/§34.4)
- FASTPRIS_TILBUD: Fastpris / Tilbud (§34.2.1)
"""

from typing import Dict, TypedDict, Literal


# Type alias for the new simplified metode values
VederlagsMetodeType = Literal["ENHETSPRISER", "REGNINGSARBEID", "FASTPRIS_TILBUD"]


class VederlagsMetodeInfo(TypedDict):
    """Informasjon om en vederlagsmetode"""
    kode: str
    label: str
    paragraf: str
    beskrivelse: str
    indeksregulering: str  # "full", "delvis", "ingen"
    krever_varsel: bool
    varsel_tidspunkt: str | None  # Når varselet må sendes
    krever_bh_aksept: bool
    dokumentasjonskrav: str


# ============ VEDERLAGSMETODER (NEW - Uppercase) ============

VEDERLAG_METODER: Dict[str, VederlagsMetodeInfo] = {
    "ENHETSPRISER": {
        "kode": "ENHETSPRISER",
        "label": "Enhetspriser",
        "paragraf": "§34.3",
        "beskrivelse": "Kontraktens eller justerte enhetspriser. Indeksregulert iht. §26.2. Krever særskilt varsel ved justering (§34.3.3).",
        "indeksregulering": "full",
        "krever_varsel": False,  # Only if justert_ep
        "varsel_tidspunkt": "Uten ugrunnet opphold ved justering (§34.3.3)",
        "krever_bh_aksept": False,
        "dokumentasjonskrav": "Mengdeoversikt med referanse til enhetspriser. Ved justering: dokumentasjon av endrede forhold."
    },
    "REGNINGSARBEID": {
        "kode": "REGNINGSARBEID",
        "label": "Regningsarbeid med kostnadsoverslag",
        "paragraf": "§30.2, §34.4",
        "beskrivelse": "Oppgjør etter medgått tid og materialer med forhåndsoverslag. Krever varsel FØR oppstart.",
        "indeksregulering": "delvis",
        "krever_varsel": True,
        "varsel_tidspunkt": "FØR regningsarbeidet påbegynnes (§30.1, 3. ledd)",
        "krever_bh_aksept": False,
        "dokumentasjonskrav": "Kostnadsoverslag før oppstart, timelister, materialfakturaer, forklaring hvis overslag overskrides (§30.2)."
    },
    "FASTPRIS_TILBUD": {
        "kode": "FASTPRIS_TILBUD",
        "label": "Fastpris / Tilbud",
        "paragraf": "§34.2.1",
        "beskrivelse": "TE gir pristilbud som BH kan akseptere. Fast pris uten etterfølgende justering.",
        "indeksregulering": "ingen",
        "krever_varsel": False,
        "varsel_tidspunkt": None,
        "krever_bh_aksept": True,
        "dokumentasjonskrav": "Skriftlig tilbud med fast sum. BH må akseptere tilbudet før arbeid igangsettes."
    },
}

# ============ LEGACY METHODS (for backwards compatibility) ============

LEGACY_VEDERLAG_METODER: Dict[str, VederlagsMetodeInfo] = {
    "kontrakt_ep": {
        "kode": "kontrakt_ep",
        "label": "Kontraktens enhetspriser",
        "paragraf": "§34.3.1",
        "beskrivelse": "Anvendelse av eksisterende enhetspriser fra kontrakten på endringsarbeidet.",
        "indeksregulering": "full",
        "krever_varsel": False,
        "varsel_tidspunkt": None,
        "krever_bh_aksept": False,
        "dokumentasjonskrav": "Mengdeoversikt med referanse til kontrakt-enhetspriser. Beregning av totalkostnad."
    },
    "justert_ep": {
        "kode": "justert_ep",
        "label": "Justerte enhetspriser",
        "paragraf": "§34.3.2, §34.3.3",
        "beskrivelse": "Enhetspriser justert for endrede forhold (f.eks. økt omfang, vanskeliggjorte forhold).",
        "indeksregulering": "full",
        "krever_varsel": True,
        "varsel_tidspunkt": "Uten ugrunnet opphold etter at TE blir klar over at justering er nødvendig (§34.3.3)",
        "krever_bh_aksept": False,
        "dokumentasjonskrav": "Varsel om justering, dokumentasjon av endrede forhold, kalkyle over nye enhetspriser, mengdeoversikt."
    },
    "regning": {
        "kode": "regning",
        "label": "Regningsarbeid",
        "paragraf": "§30.1",
        "beskrivelse": "Oppgjør etter medgått tid (timer) og materialer. Timepriser fra kontrakt eller bransjestandarder.",
        "indeksregulering": "delvis",
        "krever_varsel": True,
        "varsel_tidspunkt": "FØR regningsarbeidet påbegynnes (§30.1, 3. ledd)",
        "krever_bh_aksept": False,
        "dokumentasjonskrav": "Varsel før oppstart, timelister, materialfakturaer, dokumentasjon av påslag (adm, rigg, drift)."
    },
    "overslag": {
        "kode": "overslag",
        "label": "Regningsarbeid med prisoverslag",
        "paragraf": "§30.2",
        "beskrivelse": "Regningsarbeid hvor TE har gitt et prisoverslag på forhånd. Endelig pris avregnes som regning.",
        "indeksregulering": "delvis",
        "krever_varsel": True,
        "varsel_tidspunkt": "FØR arbeidet påbegynnes - BH skal få prisoverslag",
        "krever_bh_aksept": False,
        "dokumentasjonskrav": "Prisoverslag før oppstart, timelister, materialfakturaer, forklaring hvis overslag overskrides."
    },
    "tilbud": {
        "kode": "tilbud",
        "label": "Entreprenørens tilbud (fastpris)",
        "paragraf": "§34.2.1",
        "beskrivelse": "TE gir pristilbud som BH kan akseptere. Fast pris uten etterfølgende justering.",
        "indeksregulering": "ingen",
        "krever_varsel": False,
        "varsel_tidspunkt": None,
        "krever_bh_aksept": True,
        "dokumentasjonskrav": "Skriftlig tilbud med fast sum. BH må akseptere tilbudet før arbeid igangsettes."
    },
}

# Mapping from legacy to new codes
LEGACY_TO_NEW_METODE: Dict[str, str] = {
    "kontrakt_ep": "ENHETSPRISER",
    "justert_ep": "ENHETSPRISER",
    "regning": "REGNINGSARBEID",
    "overslag": "REGNINGSARBEID",
    "tilbud": "FASTPRIS_TILBUD",
}


# ============ VARSLINGSKRAV (Spesifikke kostnadstyper) ============

class VarselKravInfo(TypedDict):
    """Informasjon om spesifikke varslingskrav for kostnader"""
    kode: str
    label: str
    paragraf: str
    beskrivelse: str
    tidsfrist: str
    konsekvens_ved_for_sent: str


VARSLING_KOSTNADSTYPER: Dict[str, VarselKravInfo] = {
    "rigg_drift": {
        "kode": "rigg_drift",
        "label": "Rigg og drift",
        "paragraf": "§34.1.3, 1. ledd",
        "beskrivelse": "Særskilte kostnader til rigg, drift og annen tidsbundet administrasjon ved endringsarbeid.",
        "tidsfrist": "Uten ugrunnet opphold etter at TE blir klar over at endringen medfører slike kostnader",
        "konsekvens_ved_for_sent": "Kravet tapes ved preklusjon hvis ikke varslet i tide."
    },
    "produktivitetstap": {
        "kode": "produktivitetstap",
        "label": "Produktivitetstap / nedsatt produktivitet",
        "paragraf": "§34.1.3, 2. ledd",
        "beskrivelse": "Vederlag for nedsatt produktivitet eller forstyrrelser på kontraktsarbeidene.",
        "tidsfrist": "Uten ugrunnet opphold etter at TE burde ha innsett at forstyrrelsene medførte merkostnader",
        "konsekvens_ved_for_sent": "Kravet tapes ved preklusjon hvis ikke varslet i tide."
    },
    "justerte_ep": {
        "kode": "justerte_ep",
        "label": "Justering av enhetspriser",
        "paragraf": "§34.3.3",
        "beskrivelse": "Varsel om at kontraktens enhetspriser må justeres pga. endrede forhold.",
        "tidsfrist": "Uten ugrunnet opphold etter at TE blir klar over nødvendigheten av justering",
        "konsekvens_ved_for_sent": "Kravet tapes ved preklusjon hvis ikke varslet i tide."
    },
    "regningsarbeid_oppstart": {
        "kode": "regningsarbeid_oppstart",
        "label": "Varsel før oppstart regningsarbeid",
        "paragraf": "§30.1, 3. ledd",
        "beskrivelse": "BH skal varsles FØR regningsarbeid påbegynnes, slik at BH kan føre kontroll.",
        "tidsfrist": "FØR arbeidet startes",
        "konsekvens_ved_for_sent": "BH kan nekte oppgjør etter regning hvis ikke varslet på forhånd (§30.1, 3. ledd)."
    },
}


# ============ HELPER FUNCTIONS ============

def normalize_metode(kode: str) -> str:
    """Convert legacy metode code to new uppercase format"""
    return LEGACY_TO_NEW_METODE.get(kode, kode)


def get_vederlag_metode(kode: str) -> VederlagsMetodeInfo | None:
    """Hent vederlagsmetode basert på kode (støtter både nye og legacy koder)"""
    # Try new codes first
    if kode in VEDERLAG_METODER:
        return VEDERLAG_METODER[kode]
    # Try legacy codes
    if kode in LEGACY_VEDERLAG_METODER:
        return LEGACY_VEDERLAG_METODER[kode]
    return None


def get_varsel_krav(kode: str) -> VarselKravInfo | None:
    """Hent varselkrav basert på kode"""
    return VARSLING_KOSTNADSTYPER.get(kode)


def krever_indeksregulering(metode_kode: str) -> bool:
    """Sjekk om metoden krever indeksregulering"""
    metode = get_vederlag_metode(metode_kode)
    if not metode:
        return False
    return metode["indeksregulering"] in ["full", "delvis"]


def krever_forhåndsvarsel(metode_kode: str) -> bool:
    """Sjekk om metoden krever forhåndsvarsel"""
    metode = get_vederlag_metode(metode_kode)
    if not metode:
        return False
    return metode["krever_varsel"]


def krever_bh_godkjenning(metode_kode: str) -> bool:
    """Sjekk om metoden krever BH-godkjenning før arbeid starter"""
    metode = get_vederlag_metode(metode_kode)
    if not metode:
        return False
    return metode["krever_bh_aksept"]


def get_alle_vederlag_metoder() -> list[str]:
    """Hent alle vederlagsmetode-koder (kun nye uppercase koder)"""
    return list(VEDERLAG_METODER.keys())


def get_alle_legacy_metoder() -> list[str]:
    """Hent alle legacy vederlagsmetode-koder"""
    return list(LEGACY_VEDERLAG_METODER.keys())


def get_alle_varsel_krav() -> list[str]:
    """Hent alle varselkrav-koder"""
    return list(VARSLING_KOSTNADSTYPER.keys())
