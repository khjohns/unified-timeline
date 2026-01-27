"""
Grunnlagskategorier for NS 8407 endringsordrer.

Struktur basert på NS 8407 §33 (Fristforlengelse) og §34 (Vederlagsjustering).

Hovedkategorier følger §33.1 bokstav a), b), c) og §33.3:
- ENDRING: §33.1 a) - Endringer (jf. punkt 31 og 32)
- SVIKT: §33.1 b) - Forsinkelse eller svikt ved byggherrens ytelser (punkt 22, 23, 24)
- ANDRE: §33.1 c) - Andre forhold byggherren har risikoen for
- FORCE_MAJEURE: §33.3 - Force majeure

Navnekonvensjon: SCREAMING_SNAKE_CASE (f.eks. 'ENDRING', 'LOV_GJENSTAND', 'FM_EGEN')
Synkronisert med frontend: src/constants/categories.ts
"""

from typing import Dict, List, TypedDict, Literal


# ============ TYPE DEFINITIONS ============

class Underkategori(TypedDict):
    """Underkategori for grunnlag med juridiske referanser."""
    kode: str
    label: str
    hjemmel_basis: str      # Den utløsende paragrafen
    beskrivelse: str
    varselkrav_ref: str     # Juridisk referanse for varselkrav


class Hovedkategori(TypedDict):
    """Hovedkategori for grunnlag med full juridisk kontekst."""
    kode: str
    label: str
    beskrivelse: str
    hjemmel_frist: str                          # Referanse i §33
    hjemmel_vederlag: str | None                # Referanse i §34 (None for FM)
    standard_vederlagsmetode: str               # F.eks. 'Enhetspriser (34.3)'
    type_krav: Literal['Tid', 'Penger', 'Tid og Penger']
    underkategorier: List[Underkategori]


# ============ HOVEDKATEGORIER MED UNDERKATEGORIER ============

GRUNNLAG_KATEGORIER: Dict[str, Hovedkategori] = {
    # ========== §33.1 a) ENDRINGER ==========
    "ENDRING": {
        "kode": "ENDRING",
        "label": "Endringer",
        "beskrivelse": "Avvik fra det opprinnelig avtalte, enten ved formell ordre, endrede rammebetingelser eller pålegg.",
        "hjemmel_frist": "33.1 a)",
        "hjemmel_vederlag": "34.1.1",
        "standard_vederlagsmetode": "Enhetspriser (34.3)",
        "type_krav": "Tid og Penger",
        "underkategorier": [
            {
                "kode": "EO",
                "label": "Formell endringsordre",
                "hjemmel_basis": "31.3",
                "beskrivelse": "Skriftlig endringsordre utstedt av byggherren iht. §31.3.",
                "varselkrav_ref": "33.4 / 34.2",
            },
            {
                "kode": "IRREG",
                "label": "Irregulær endring (Pålegg)",
                "hjemmel_basis": "32.1",
                "beskrivelse": "Pålegg/anvisning som entreprenøren mener er endring, men som ikke er gitt som endringsordre.",
                "varselkrav_ref": "32.2",
            },
            {
                "kode": "VALGRETT",
                "label": "Begrensning av valgrett",
                "hjemmel_basis": "14.6",
                "beskrivelse": "Pålegg (jf. §32.1) som begrenser entreprenørens rett til å velge materiale, utførelse eller løsning.",
                "varselkrav_ref": "32.2",
            },
            {
                "kode": "SVAR_VARSEL",
                "label": "Endring via svar på varsel",
                "hjemmel_basis": "24.2.2",
                # NB: §24.2.2 forutsetter avtalt risikoovergang etter §24.2.1
                "beskrivelse": "Ved avtalt risikoovergang (§24.2.1): Byggherrens svar på varsel innebærer en endring uten at endringsordre er utstedt.",
                "varselkrav_ref": "32.2",
            },
            {
                "kode": "LOV_GJENSTAND",
                "label": "Endring i lover/vedtak (Gjenstand)",
                "hjemmel_basis": "14.4",
                "beskrivelse": "Nye offentlige krav som krever fysisk endring av kontraktsgjenstanden.",
                "varselkrav_ref": "32.2",
            },
            {
                "kode": "LOV_PROSESS",
                "label": "Endring i lover/vedtak (Prosess)",
                "hjemmel_basis": "15.2",
                "beskrivelse": "Nye offentlige krav som endrer måten arbeidet må utføres på.",
                "varselkrav_ref": "32.2",
            },
            {
                "kode": "GEBYR",
                "label": "Endring i gebyrer/avgifter",
                "hjemmel_basis": "26.3",
                "beskrivelse": "Endringer i offentlige gebyrer/avgifter etter tilbudstidspunktet.",
                "varselkrav_ref": "32.2",
            },
            {
                "kode": "SAMORD",
                "label": "Samordning/Omlegging",
                "hjemmel_basis": "21.4",
                "beskrivelse": "Pålagt omlegging som følge av samordning utover det påregnelige.",
                "varselkrav_ref": "32.2",
            },
        ],
    },

    # ========== §33.1 b) FORSINKELSE/SVIKT ==========
    "SVIKT": {
        "kode": "SVIKT",
        "label": "Forsinkelse eller svikt ved byggherrens ytelser",
        "beskrivelse": "Forhold definert som byggherrens ytelser eller risiko i kapittel V.",
        "hjemmel_frist": "33.1 b)",
        "hjemmel_vederlag": "34.1.2",
        "standard_vederlagsmetode": "Regningsarbeid (34.4)",
        "type_krav": "Tid og Penger",
        "underkategorier": [
            {
                "kode": "MEDVIRK",
                "label": "Manglende medvirkning/leveranser",
                "hjemmel_basis": "22",
                "beskrivelse": "Forsinkede tegninger, beslutninger, fysisk arbeidsgrunnlag (§22.3) eller materialer (§22.4).",
                "varselkrav_ref": "34.1.2 / 25.1.2",
            },
            {
                "kode": "GRUNN",
                "label": "Uforutsette grunnforhold",
                "hjemmel_basis": "23.1",
                "beskrivelse": "Forhold ved grunnen som avviker fra det entreprenøren hadde grunn til å regne med.",
                "varselkrav_ref": "34.1.2 / 25.1.2",
            },
            {
                "kode": "KULTURMINNER",
                "label": "Funn av kulturminner",
                "hjemmel_basis": "23.3",
                "beskrivelse": "Stans i arbeidet som følge av funn av ukjente kulturminner.",
                "varselkrav_ref": "34.1.2 / 23.3 annet ledd",
            },
            {
                "kode": "PROSJ_RISIKO",
                "label": "Svikt i byggherrens prosjektering",
                "hjemmel_basis": "24.1",
                "beskrivelse": "Feil, mangler eller uklarheter i prosjektering/løsninger byggherren har risikoen for.",
                "varselkrav_ref": "34.1.2 / 25.1.2",
            },
        ],
    },

    # ========== §33.1 c) ANDRE FORHOLD ==========
    "ANDRE": {
        "kode": "ANDRE",
        "label": "Andre forhold byggherren har risikoen for",
        "beskrivelse": "Sekkepost for risikoforhold som ikke er endringer eller 'ytelser'.",
        "hjemmel_frist": "33.1 c)",
        "hjemmel_vederlag": "34.1.2",
        "standard_vederlagsmetode": "Regningsarbeid (34.4)",
        "type_krav": "Tid og Penger",
        "underkategorier": [
            {
                "kode": "NEKT_MH",
                "label": "Nektelse av kontraktsmedhjelper",
                "hjemmel_basis": "10.2",
                "beskrivelse": "Byggherren nekter å godta valgt medhjelper uten saklig grunn.",
                "varselkrav_ref": "34.1.2",
            },
            {
                "kode": "SKADE_BH",
                "label": "Skade forårsaket av byggherren/sideentreprenør",
                "hjemmel_basis": "19.1",
                "beskrivelse": "Skade på kontraktsgjenstanden forårsaket av byggherren eller hans kontraktsmedhjelpere.",
                "varselkrav_ref": "34.1.2 / 20.5",
            },
            {
                "kode": "BRUKSTAKELSE",
                "label": "Urettmessig brukstakelse",
                "hjemmel_basis": "38.1 annet ledd",
                "beskrivelse": "Byggherren tar kontraktsgjenstanden i bruk før overtakelse/avtalt tid.",
                "varselkrav_ref": "34.1.2 / 33.4",
            },
            {
                "kode": "STANS_BET",
                "label": "Stans ved betalingsmislighold",
                "hjemmel_basis": "29.2",
                "beskrivelse": "Konsekvenser av rettmessig stans grunnet manglende betaling/sikkerhet.",
                "varselkrav_ref": "34.1.2 / 29.2",
            },
        ],
    },

    # ========== §33.3 FORCE MAJEURE ==========
    "FORCE_MAJEURE": {
        "kode": "FORCE_MAJEURE",
        "label": "Force Majeure",
        "beskrivelse": "Ekstraordinære hendelser utenfor partenes kontroll (værforhold, offentlige påbud, streik, lockout etc.).",
        "hjemmel_frist": "33.3",
        "hjemmel_vederlag": None,
        "standard_vederlagsmetode": "Ingen (Kun fristforlengelse)",
        "type_krav": "Tid",
        "underkategorier": [],  # Ingen underkategorier - Force Majeure er en selvstendig kategori
    },
}


# ============ HELPER FUNCTIONS ============

def get_hovedkategori(kode: str) -> Hovedkategori | None:
    """
    Hent hovedkategori basert på kode.

    Args:
        kode: Hovedkategori-kode (f.eks. 'ENDRING', 'SVIKT')

    Returns:
        Hovedkategori dict eller None hvis ikke funnet
    """
    return GRUNNLAG_KATEGORIER.get(kode)


def get_underkategori(hovedkategori_kode: str, underkategori_kode: str) -> Underkategori | None:
    """
    Hent underkategori basert på hoved- og underkategori-kode.

    Args:
        hovedkategori_kode: Hovedkategori-kode (f.eks. 'ENDRING')
        underkategori_kode: Underkategori-kode (f.eks. 'EO')

    Returns:
        Underkategori dict eller None hvis ikke funnet
    """
    hovedkat = get_hovedkategori(hovedkategori_kode)
    if not hovedkat:
        return None

    for underkat in hovedkat["underkategorier"]:
        if underkat["kode"] == underkategori_kode:
            return underkat
    return None


def get_alle_hovedkategorier() -> List[str]:
    """
    Hent alle hovedkategori-koder.

    Returns:
        Liste med koder: ['ENDRING', 'SVIKT', 'ANDRE', 'FORCE_MAJEURE']
    """
    return list(GRUNNLAG_KATEGORIER.keys())


def get_underkategorier_for_hovedkategori(hovedkategori_kode: str) -> List[str]:
    """
    Hent alle underkategori-koder for en hovedkategori.

    Args:
        hovedkategori_kode: Hovedkategori-kode

    Returns:
        Liste med underkategori-koder, eller tom liste hvis hovedkategori ikke finnes
    """
    hovedkat = get_hovedkategori(hovedkategori_kode)
    if not hovedkat:
        return []
    return [uk["kode"] for uk in hovedkat["underkategorier"]]


def validate_kategori_kombinasjon(hovedkategori: str, underkategori: str | List[str]) -> bool:
    """
    Valider at en kombinasjon av hoved- og underkategori er gyldig.

    Args:
        hovedkategori: Hovedkategori-kode (f.eks. 'ENDRING')
        underkategori: Underkategori-kode(r) - enkelt string eller liste

    Returns:
        True hvis kombinasjonen er gyldig

    Examples:
        >>> validate_kategori_kombinasjon('ENDRING', 'EO')
        True
        >>> validate_kategori_kombinasjon('ENDRING', ['EO', 'IRREG'])
        True
        >>> validate_kategori_kombinasjon('ENDRING', 'MEDVIRK')  # MEDVIRK hører til SVIKT
        False
    """
    hovedkat = get_hovedkategori(hovedkategori)
    if not hovedkat:
        return False

    gyldige_underkategorier = get_underkategorier_for_hovedkategori(hovedkategori)

    # Håndter både enkelt string og liste
    if isinstance(underkategori, str):
        return underkategori in gyldige_underkategorier

    # Liste av underkategorier
    return all(uk in gyldige_underkategorier for uk in underkategori)


def get_hovedkategori_label(kode: str) -> str:
    """
    Hent lesbar label for en hovedkategori.

    Args:
        kode: Hovedkategori-kode (f.eks. 'ENDRING')

    Returns:
        Lesbar label (f.eks. 'Endringer') eller koden selv hvis ikke funnet
    """
    hovedkat = get_hovedkategori(kode)
    if hovedkat:
        return hovedkat["label"]
    return kode


def get_underkategori_label(hovedkategori_kode: str, underkategori_kode: str) -> str:
    """
    Hent lesbar label for en underkategori.

    Args:
        hovedkategori_kode: Hovedkategori-kode (f.eks. 'ENDRING')
        underkategori_kode: Underkategori-kode (f.eks. 'IRREG')

    Returns:
        Lesbar label (f.eks. 'Irregulær endring (Pålegg)') eller koden selv hvis ikke funnet
    """
    underkat = get_underkategori(hovedkategori_kode, underkategori_kode)
    if underkat:
        return underkat["label"]
    return underkategori_kode


def get_grunnlag_sammendrag(hovedkategori_kode: str, underkategori: str | List[str]) -> str:
    """
    Generer lesbart sammendrag for grunnlag.

    Args:
        hovedkategori_kode: Hovedkategori-kode (f.eks. 'ENDRING')
        underkategori: Underkategori-kode(r) - enkelt string eller liste

    Returns:
        Lesbart sammendrag (f.eks. 'Endringer: Irregulær endring (Pålegg)')
        eller 'Endringer: Irregulær endring (Pålegg), Formell endringsordre' for flere

    Examples:
        >>> get_grunnlag_sammendrag('ENDRING', 'IRREG')
        'Endringer: Irregulær endring (Pålegg)'
        >>> get_grunnlag_sammendrag('ENDRING', ['IRREG', 'EO'])
        'Endringer: Irregulær endring (Pålegg), Formell endringsordre'
    """
    hovedkat_label = get_hovedkategori_label(hovedkategori_kode)

    # Håndter både enkelt string og liste
    if isinstance(underkategori, str):
        underkat_labels = [get_underkategori_label(hovedkategori_kode, underkategori)]
    else:
        underkat_labels = [
            get_underkategori_label(hovedkategori_kode, uk)
            for uk in underkategori
        ]

    return f"{hovedkat_label}: {', '.join(underkat_labels)}"


def er_lovendring(underkategori_kode: str) -> bool:
    """
    Sjekk om underkategori er en lovendring (krever spesiell håndtering iht. §14.4).

    Args:
        underkategori_kode: Underkategori-kode

    Returns:
        True hvis lovendring (LOV_GJENSTAND, LOV_PROSESS, GEBYR)
    """
    return underkategori_kode in ['LOV_GJENSTAND', 'LOV_PROSESS', 'GEBYR']


def er_force_majeure(hovedkategori_kode: str) -> bool:
    """
    Sjekk om hovedkategori er Force Majeure (ingen vederlag, kun tid).

    Args:
        hovedkategori_kode: Hovedkategori-kode

    Returns:
        True hvis FORCE_MAJEURE
    """
    return hovedkategori_kode == 'FORCE_MAJEURE'


def er_irregulaer_endring(hovedkategori_kode: str, underkategori_kode: str) -> bool:
    """
    Sjekk om dette er en irregulær endring (spesielle passivitetsregler gjelder).

    Args:
        hovedkategori_kode: Hovedkategori-kode
        underkategori_kode: Underkategori-kode

    Returns:
        True hvis irregulær endring (ENDRING + IRREG)
    """
    return hovedkategori_kode == 'ENDRING' and underkategori_kode == 'IRREG'


def get_type_krav(hovedkategori_kode: str) -> str | None:
    """
    Hent type krav for en hovedkategori.

    Args:
        hovedkategori_kode: Hovedkategori-kode

    Returns:
        'Tid', 'Penger', eller 'Tid og Penger', eller None hvis ikke funnet
    """
    kategori = get_hovedkategori(hovedkategori_kode)
    return kategori["type_krav"] if kategori else None


def get_hjemmel_referanser(
    hovedkategori_kode: str,
    underkategori_kode: str | None = None
) -> Dict[str, str | None]:
    """
    Hent hjemmelreferanser for et krav.

    Args:
        hovedkategori_kode: Hovedkategori-kode
        underkategori_kode: Valgfri underkategori-kode

    Returns:
        Dict med 'frist', 'vederlag', og 'varsel' referanser
    """
    hovedkategori = get_hovedkategori(hovedkategori_kode)
    underkategori = get_underkategori(hovedkategori_kode, underkategori_kode) if underkategori_kode else None

    return {
        "frist": hovedkategori["hjemmel_frist"] if hovedkategori else "",
        "vederlag": hovedkategori["hjemmel_vederlag"] if hovedkategori else None,
        "varsel": underkategori["varselkrav_ref"] if underkategori else "",
    }
