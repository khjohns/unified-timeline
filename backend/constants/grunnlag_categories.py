"""
Grunnlagskategorier for NS 8407 endringsordrer.

Disse kategoriene beskriver ÅRSAKEN til kravet og bestemmer hvilke
juridiske regler som gjelder. Kategoriseringen er kritisk for:
- Hvem som har ansvaret (TE vs BH)
- Hvilke varselfrister som gjelder
- Hvordan vederlag beregnes
- Om det gis rett til fristforlengelse

Strukturen følger NS 8407 og vanlig praksis i byggebransjen.
"""

from typing import Dict, List, TypedDict


class Underkategori(TypedDict):
    """Underkategori for grunnlag"""
    kode: str
    label: str
    paragraf: str
    beskrivelse: str


class Hovedkategori(TypedDict):
    """Hovedkategori for grunnlag"""
    kode: str
    label: str
    paragraf: str
    beskrivelse: str
    underkategorier: List[Underkategori]


# ============ HOVEDKATEGORIER ============

GRUNNLAG_KATEGORIER: Dict[str, Hovedkategori] = {
    "endring_initiert_bh": {
        "kode": "endring_initiert_bh",
        "label": "Endring initiert av BH",
        "paragraf": "§31.1",
        "beskrivelse": "Byggherre igangsetter endring av kontraktsarbeidene",
        "underkategorier": [
            {
                "kode": "regulaer_eo",
                "label": "Regulær endringsordre",
                "paragraf": "§31.1, §31.3",
                "beskrivelse": "BH har rett til å endre prosjektet. TE har rett til vederlag og fristforlengelse."
            },
            {
                "kode": "irregulaer_endring",
                "label": "Irregulær endring/pålegg uten EO",
                "paragraf": "§32.1",
                "beskrivelse": "BH gir ordre uten forutgående endringsordre. TE kan kreve etterfølgende EO."
            },
            {
                "kode": "mengdeendring",
                "label": "Mengdeendring",
                "paragraf": "§31.1 siste avsnitt, §34.3",
                "beskrivelse": "Endring i mengde av kontraktsarbeid som påvirker enhetspriser."
            },
        ]
    },
    "forsinkelse_bh": {
        "kode": "forsinkelse_bh",
        "label": "Forsinkelse eller svikt i BHs ytelser",
        "paragraf": "§22, §24",
        "beskrivelse": "BH oppfyller ikke sine forpliktelser, noe som hindrer TEs fremdrift",
        "underkategorier": [
            {
                "kode": "prosjektering",
                "label": "Svikt i prosjektering",
                "paragraf": "§24.1",
                "beskrivelse": "Mangler, feil eller forsinkelser i prosjekteringsunderlag fra BH."
            },
            {
                "kode": "arbeidsgrunnlag",
                "label": "Svikt i arbeidsgrunnlaget",
                "paragraf": "§22.3, §25",
                "beskrivelse": "BH har ikke levert komplett/korrekt arbeidsgrunnlag. TE har plikt til å undersøke og varsle."
            },
            {
                "kode": "materialer_bh",
                "label": "BH-leverte materialer",
                "paragraf": "§22.4",
                "beskrivelse": "Materialer som BH skal levere mangler eller er forsinkete."
            },
            {
                "kode": "tillatelser",
                "label": "Tillatelser og godkjenninger",
                "paragraf": "§16.3",
                "beskrivelse": "BH har ikke skaffet nødvendige tillatelser i tide."
            },
            {
                "kode": "fastmerker",
                "label": "Fastmerker og utstikking",
                "paragraf": "§18.4",
                "beskrivelse": "BH har ikke etablert korrekte fastmerker eller utført utstikking."
            },
            {
                "kode": "foreskrevne_losninger",
                "label": "Svikt i BHs foreskrevne løsninger",
                "paragraf": "§24.1",
                "beskrivelse": "BHs valgte løsninger er ikke egnet eller har feil."
            },
            {
                "kode": "koordinering",
                "label": "Koordinering av sideentreprenører",
                "paragraf": "§21",
                "beskrivelse": "BH koordinerer ikke andre entreprenører tilfredsstillende."
            },
        ]
    },
    "grunnforhold": {
        "kode": "grunnforhold",
        "label": "Risiko for grunnforhold",
        "paragraf": "§23.1",
        "beskrivelse": "Uforutsette eller uriktige grunnforhold som BH har risikoen for",
        "underkategorier": [
            {
                "kode": "uforutsette_grunnforhold",
                "label": "Uforutsette grunnforhold",
                "paragraf": "§23.1a",
                "beskrivelse": "Grunnforhold avviker fra det som var kjent eller kunne forventes."
            },
            {
                "kode": "uriktige_opplysninger",
                "label": "Uriktige grunnopplysninger fra BH",
                "paragraf": "§23.1b",
                "beskrivelse": "BH har gitt feil eller mangelfulle opplysninger om grunnforholdene."
            },
            {
                "kode": "forurensning",
                "label": "Forurensning i grunnen",
                "paragraf": "§23.1",
                "beskrivelse": "Uventet forurensning oppdages under utførelsen."
            },
            {
                "kode": "kulturminner",
                "label": "Kulturminner",
                "paragraf": "§23.3",
                "beskrivelse": "Funn av kulturminner som krever stans og varsling til myndigheter."
            },
        ]
    },
    "offentlige_paaleg": {
        "kode": "offentlige_paaleg",
        "label": "Offentlige pålegg",
        "paragraf": "§16.3",
        "beskrivelse": "Myndighetskrav som endrer forutsetningene for arbeidet",
        "underkategorier": [
            {
                "kode": "nye_krav",
                "label": "Nye myndighetskrav",
                "paragraf": "§16.3",
                "beskrivelse": "Nye lover, forskrifter eller pålegg som påvirker utførelsen."
            },
            {
                "kode": "endrede_vilkaar",
                "label": "Endrede tillatelsesvilkår",
                "paragraf": "§16.3",
                "beskrivelse": "Endringer i vilkår for byggetillatelse eller andre godkjenninger."
            },
        ]
    },
    "forsering": {
        "kode": "forsering",
        "label": "Forsering / Tidsmessig omlegging",
        "paragraf": "§31.2, §33.8",
        "beskrivelse": "BH pålegger endret tidsplan eller TE velger å forsere",
        "underkategorier": [
            {
                "kode": "paalegt_forsering",
                "label": "Pålagt forsering / omlegging",
                "paragraf": "§31.2",
                "beskrivelse": "BH pålegger endret tidsplan som en endring. TE har krav på vederlag."
            },
            {
                "kode": "forsering_etter_avslag",
                "label": "Forsering ved uberettiget avslag på fristkrav",
                "paragraf": "§33.8",
                "beskrivelse": "TE velger å forsere etter at BH har avslått fristkrav. TE kan ha krav på vederlag."
            },
        ]
    },
    "force_majeure": {
        "kode": "force_majeure",
        "label": "Force majeure",
        "paragraf": "§33.3",
        "beskrivelse": "Ekstraordinære hendelser utenfor partenes kontroll",
        "underkategorier": [
            {
                "kode": "naturkatastrofe",
                "label": "Naturkatastrofe",
                "paragraf": "§33.3",
                "beskrivelse": "Flom, ras, storm eller lignende ekstraordinære naturhendelser."
            },
            {
                "kode": "krig_opprør",
                "label": "Krig, opprør eller unntakstilstand",
                "paragraf": "§33.3",
                "beskrivelse": "Krig, militære aksjoner, opprør eller unntakstilstand."
            },
            {
                "kode": "streik",
                "label": "Streik eller lockout",
                "paragraf": "§33.3",
                "beskrivelse": "Arbeidskonflikter som hindrer utførelsen."
            },
        ]
    },
    "hindringer_bh_risiko": {
        "kode": "hindringer_bh_risiko",
        "label": "Hindringer BH har risikoen for",
        "paragraf": "§33.1c",
        "beskrivelse": "Forhold som hindrer fremdrift og som BH har risikoen for",
        "underkategorier": [
            {
                "kode": "fysiske_hindringer",
                "label": "Hindringer på byggeplassen",
                "paragraf": "§33.1c",
                "beskrivelse": "Fysiske hindringer på byggeplassen som BH har risikoen for."
            },
            {
                "kode": "offentlige_restriksjoner",
                "label": "Offentlige restriksjoner",
                "paragraf": "§33.1c",
                "beskrivelse": "Myndighetspålagte begrensninger i arbeidstid eller metode."
            },
            {
                "kode": "tilstotende_arbeider",
                "label": "Tilstøtende arbeider forsinket",
                "paragraf": "§33.1c",
                "beskrivelse": "Andre entreprenører forsinker arbeidet og påvirker TEs fremdrift."
            },
        ]
    },
    "ovrige": {
        "kode": "ovrige",
        "label": "Øvrige forhold",
        "paragraf": "Diverse",
        "beskrivelse": "Andre grunnlag for fristforlengelse eller vederlag",
        "underkategorier": [
            {
                "kode": "annet",
                "label": "Annet forhold",
                "paragraf": "Diverse",
                "beskrivelse": "Andre forhold som ikke passer i kategoriene over."
            },
        ]
    },
}


# ============ HELPER FUNCTIONS ============

def get_hovedkategori(kode: str) -> Hovedkategori | None:
    """Hent hovedkategori basert på kode"""
    return GRUNNLAG_KATEGORIER.get(kode)


def get_underkategori(hovedkategori_kode: str, underkategori_kode: str) -> Underkategori | None:
    """Hent underkategori basert på hoved- og underkategori-kode"""
    hovedkat = get_hovedkategori(hovedkategori_kode)
    if not hovedkat:
        return None

    for underkat in hovedkat["underkategorier"]:
        if underkat["kode"] == underkategori_kode:
            return underkat
    return None


def get_alle_hovedkategorier() -> List[str]:
    """Hent alle hovedkategori-koder"""
    return list(GRUNNLAG_KATEGORIER.keys())


def get_underkategorier_for_hovedkategori(hovedkategori_kode: str) -> List[str]:
    """Hent alle underkategori-koder for en hovedkategori"""
    hovedkat = get_hovedkategori(hovedkategori_kode)
    if not hovedkat:
        return []
    return [uk["kode"] for uk in hovedkat["underkategorier"]]


def validate_kategori_kombinasjon(hovedkategori: str, underkategori: str | List[str]) -> bool:
    """
    Valider at en kombinasjon av hoved- og underkategori er gyldig.

    Args:
        hovedkategori: Hovedkategori-kode
        underkategori: Underkategori-kode(r) - enkelt eller liste

    Returns:
        True hvis kombinasjonen er gyldig
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
