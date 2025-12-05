
### Oppdatert Datamodell

```python
from typing import TypedDict, List, Optional, Literal

Aktor = Literal["TE", "BH"]
FristType = Literal[
    "UTEN_UGRUNNET_OPPHOLD", # "UUO"
    "RIMELIG_TID",
    "SPESIFIKK_DAGER",
    "LOPENDE",
    "INNEN_FRIST_UTLOP"      # F.eks. innen betalingsfristen
]

KonsekvensType = Literal[
    "PREKLUSJON_KRAV",        # Kravet tapes
    "PREKLUSJON_INNSIGELSE",  # Motparten anses å ha godtatt (Passiv aksept)
    "REDUKSJON_SKJONN",       # Kravet reduseres til det "åpenbare"
    "ANSVAR_SKADE",           # Erstatningsansvar for tapet
    "BEVISBYRDE_TAP"          # Mister retten til å bruke faktura som bevis
]

class VarslingsRegel(TypedDict):
    kode: str
    paragraf: str
    beskrivelse: str
    aktor: Aktor
    trigger_beskrivelse: str    # Hva utløser plikten? (F.eks. "Mottak av faktura")
    frist_type: FristType
    frist_dager: Optional[int]  # Kun ved SPESIFIKK_DAGER
    konsekvens_type: KonsekvensType
    konsekvens_beskrivelse: str
    
class ProsessFlyt(TypedDict):
    navn: str
    regler: List[VarslingsRegel]
```

### Komplett Datasett (NS 8407)

Dette dekker hele livsløpet fra kontraktinngåelse til reklamasjonstid.

```python
komplett_regelsett_ns8407: List[ProsessFlyt] = [
    {
        "navn": "1. Endringshåndtering (Irregulær)",
        "regler": [
            {
                "kode": "VARSEL_IRREGULAER",
                "paragraf": "32.2",
                "beskrivelse": "TE må varsle hvis han mottar et pålegg han mener er en endring.",
                "aktor": "TE",
                "trigger_beskrivelse": "Mottak av instruks/pålegg/referat",
                "frist_type": "UTEN_UGRUNNET_OPPHOLD",
                "frist_dager": None,
                "konsekvens_type": "PREKLUSJON_KRAV",
                "konsekvens_beskrivelse": "TE taper retten til å kreve endring (arbeidet blir en del av kontrakten)."
            },
            {
                "kode": "SVAR_IRREGULAER",
                "paragraf": "32.3",
                "beskrivelse": "BH må ta stilling til varselet (Avslå, Godta, Frafalle).",
                "aktor": "BH",
                "trigger_beskrivelse": "Mottak av varsel etter 32.2",
                "frist_type": "UTEN_UGRUNNET_OPPHOLD",
                "frist_dager": None,
                "konsekvens_type": "PREKLUSJON_INNSIGELSE",
                "konsekvens_beskrivelse": "Pålegget ANSES som en endring (BH taper retten til å nekte)."
            }
        ]
    },
    {
        "navn": "2. Varsel om svikt/avvik (Startfasen)",
        "regler": [
            {
                "kode": "VARSEL_SVIKT_BH",
                "paragraf": "34.1.2 / 25.1.2",
                "beskrivelse": "TE må varsle om svikt ved BHs ytelser, forsinket leveranse, feil i underlag etc.",
                "aktor": "TE",
                "trigger_beskrivelse": "Oppdagelse av forholdet",
                "frist_type": "UTEN_UGRUNNET_OPPHOLD",
                "frist_dager": None,
                "konsekvens_type": "PREKLUSJON_KRAV",
                "konsekvens_beskrivelse": "Krav på vederlagsjustering tapes."
            },
            {
                "kode": "VARSEL_RIGG_DRIFT",
                "paragraf": "34.1.3",
                "beskrivelse": "Særskilt varsel hvis TE vil kreve dekning for rigg, drift eller nedsatt produktivitet.",
                "aktor": "TE",
                "trigger_beskrivelse": "Når det blir klart at slike utgifter påløper",
                "frist_type": "UTEN_UGRUNNET_OPPHOLD",
                "frist_dager": None,
                "konsekvens_type": "PREKLUSJON_KRAV",
                "konsekvens_beskrivelse": "Retten til å kreve disse spesifikke postene tapes."
            }
        ]
    },
    {
        "navn": "3. Fristforlengelse (Tid)",
        "regler": [
            {
                "kode": "FRIST_VARSEL_NOEYTRALT",
                "paragraf": "33.4",
                "beskrivelse": "Varsel om at en hendelse medfører behov for fristforlengelse.",
                "aktor": "TE",
                "trigger_beskrivelse": "Hendelsen inntreffer",
                "frist_type": "UTEN_UGRUNNET_OPPHOLD",
                "frist_dager": None,
                "konsekvens_type": "PREKLUSJON_KRAV",
                "konsekvens_beskrivelse": "Kravet på fristforlengelse tapes."
            },
            {
                "kode": "FRIST_SPESIFISERING",
                "paragraf": "33.6.1",
                "beskrivelse": "Beregning av antall dager.",
                "aktor": "TE",
                "trigger_beskrivelse": "Når grunnlag for beregning foreligger",
                "frist_type": "UTEN_UGRUNNET_OPPHOLD",
                "frist_dager": None,
                "konsekvens_type": "REDUKSJON_SKJONN",
                "konsekvens_beskrivelse": "Kravet reduseres til det BH måtte forstå."
            },
            {
                "kode": "SVAR_PA_ETTERLYSNING",
                "paragraf": "33.6.2",
                "beskrivelse": "Svar på BHs brev om etterlysning av beregning.",
                "aktor": "TE",
                "trigger_beskrivelse": "Mottak av brev fra BH",
                "frist_type": "UTEN_UGRUNNET_OPPHOLD",
                "frist_dager": None,
                "konsekvens_type": "PREKLUSJON_KRAV",
                "konsekvens_beskrivelse": "Total tap av fristkravet."
            },
            {
                "kode": "BH_SVAR_KRAV",
                "paragraf": "33.7",
                "beskrivelse": "BHs aksept/avslag på spesifisert krav.",
                "aktor": "BH",
                "trigger_beskrivelse": "Mottak av begrunnet krav (33.6.1)",
                "frist_type": "UTEN_UGRUNNET_OPPHOLD",
                "frist_dager": None,
                "konsekvens_type": "PREKLUSJON_INNSIGELSE",
                "konsekvens_beskrivelse": "BH taper sine innsigelser (kravet godtas)."
            }
        ]
    },
    {
        "navn": "4. Prisjustering (Enhetspriser)",
        "regler": [
            {
                "kode": "VARSEL_EP_JUSTERING",
                "paragraf": "34.3.3 første ledd",
                "beskrivelse": "Krav om justering av enhetspris pga endrede forutsetninger.",
                "aktor": "TE",
                "trigger_beskrivelse": "Når forholdet foreligger",
                "frist_type": "UTEN_UGRUNNET_OPPHOLD",
                "frist_dager": None,
                "konsekvens_type": "REDUKSJON_SKJONN",
                "konsekvens_beskrivelse": "Justering begrenses til det BH måtte forstå."
            },
            {
                "kode": "SVAR_EP_JUSTERING",
                "paragraf": "34.3.3 annet ledd",
                "beskrivelse": "BHs svar på krav om justering.",
                "aktor": "BH",
                "trigger_beskrivelse": "Mottak av varsel",
                "frist_type": "UTEN_UGRUNNET_OPPHOLD",
                "frist_dager": None,
                "konsekvens_type": "PREKLUSJON_INNSIGELSE",
                "konsekvens_beskrivelse": "BH mister sine innsigelser mot kravet."
            }
        ]
    },
    {
        "navn": "5. Regningsarbeid (Løpende kontroll)",
        "regler": [
            {
                "kode": "VARSEL_OPPSTART_REGNING",
                "paragraf": "34.4",
                "beskrivelse": "Varsel før regningsarbeid igangsettes (når enhetspriser ikke finnes).",
                "aktor": "TE",
                "trigger_beskrivelse": "Før arbeidet starter",
                "frist_type": "INNEN_OPPSTART",
                "frist_dager": None,
                "konsekvens_type": "BEVISBYRDE_TAP",
                "konsekvens_beskrivelse": "Strengere bevisbyrde for at arbeidet var nødvendig/kostnadene rimelige."
            },
            {
                "kode": "INNSENDING_OPPGAVER",
                "paragraf": "30.3.1",
                "beskrivelse": "Innsending av spesifiserte oppgaver (timer/materialer).",
                "aktor": "TE",
                "trigger_beskrivelse": "Ukentlig (evt månedlig)",
                "frist_type": "LOPENDE",
                "frist_dager": 7, # Implisitt i "ukentlig"
                "konsekvens_type": "REDUKSJON_SKJONN",
                "konsekvens_beskrivelse": "Dekning begrenses til utgifter BH måtte forstå + påslag."
            },
            {
                "kode": "KONTROLL_AV_OPPGAVER",
                "paragraf": "30.3.2",
                "beskrivelse": "BHs kontroll og protest på mottatte oppgaver.",
                "aktor": "BH",
                "trigger_beskrivelse": "Mottak av oppgaver",
                "frist_type": "SPESIFIKK_DAGER",
                "frist_dager": 14,
                "konsekvens_type": "PREKLUSJON_INNSIGELSE",
                "konsekvens_beskrivelse": "Oppgavene legges til grunn for oppgjøret (akseptert mengde)."
            }
        ]
    },
    {
        "navn": "6. Aktører og Kontraktsmedhjelpere",
        "regler": [
            {
                "kode": "NEKTELSE_VALG_MH",
                "paragraf": "10.2",
                "beskrivelse": "BH nekter å godta TEs valg av kontraktsmedhjelper.",
                "aktor": "BH",
                "trigger_beskrivelse": "Mottak av underretning om valg",
                "frist_type": "SPESIFIKK_DAGER",
                "frist_dager": 14,
                "konsekvens_type": "PREKLUSJON_INNSIGELSE",
                "konsekvens_beskrivelse": "Valget anses som godkjent."
            },
            {
                "kode": "NEKTELSE_TILTRANSPORT",
                "paragraf": "12.1.2",
                "beskrivelse": "TE nekter tiltransport av sideentreprenør.",
                "aktor": "TE",
                "trigger_beskrivelse": "Mottak av melding om tiltransport",
                "frist_type": "SPESIFIKK_DAGER",
                "frist_dager": 14,
                "konsekvens_type": "PREKLUSJON_INNSIGELSE",
                "konsekvens_beskrivelse": "Tiltransporten anses iverksatt."
            }
        ]
    },
    {
        "navn": "7. Sluttoppgjør",
        "regler": [
            {
                "kode": "INNSENDING_SLUTTOPPSTILLING",
                "paragraf": "39.1",
                "beskrivelse": "Innsending av komplett sluttoppstilling.",
                "aktor": "TE",
                "trigger_beskrivelse": "Overtakelse",
                "frist_type": "SPESIFIKK_DAGER",
                "frist_dager": 60, # 2 måneder
                "konsekvens_type": "INGEN_DIREKTE",
                "konsekvens_beskrivelse": "Ingen direkte tap, men BH kan sette preklusiv frist."
            },
            {
                "kode": "INNSIGELSER_SLUTTOPPSTILLING",
                "paragraf": "39.2",
                "beskrivelse": "BHs innsigelser mot krav i sluttoppstillingen.",
                "aktor": "BH",
                "trigger_beskrivelse": "Mottak av sluttoppstilling",
                "frist_type": "INNEN_FRIST_UTLOP", # Betalingsfristen (2 mnd)
                "frist_dager": None,
                "konsekvens_type": "PREKLUSJON_INNSIGELSE",
                "konsekvens_beskrivelse": "Innsigelser og motkrav tapes (må betale)."
            }
        ]
    },
    {
        "navn": "8. Mangel/Reklamasjon",
        "regler": [
            {
                "kode": "REKLAMASJON_OVERTAK",
                "paragraf": "42.2.1",
                "beskrivelse": "Mangler som kunne vært oppdaget ved overtakelse.",
                "aktor": "BH",
                "trigger_beskrivelse": "Avslutning av overtakelsesforretning",
                "frist_type": "INNEN_FRIST_UTLOP",
                "frist_dager": None, # Der og da
                "konsekvens_type": "PREKLUSJON_KRAV",
                "konsekvens_beskrivelse": "Kravet på utbedring/prisavslag tapes."
            },
            {
                "kode": "REKLAMASJON_SENERE",
                "paragraf": "42.2.2",
                "beskrivelse": "Skjulte mangler som oppdages senere.",
                "aktor": "BH",
                "trigger_beskrivelse": "Oppdagelse (eller burde oppdaget)",
                "frist_type": "RIMELIG_TID",
                "frist_dager": None,
                "konsekvens_type": "PREKLUSJON_KRAV",
                "konsekvens_beskrivelse": "Kravet tapes."
            }
        ]
    }
]
```

### Kvalitetssikring av Datasettet

1.  **Regningsarbeid (30.3.2):** Her har BH en hard frist på 14 dager for å protestere på timelister. Dette er nå inkludert. Passivitet betyr at timene er godkjent. Dette er en klassisk felle for BH som systemet ditt nå fanger opp.
2.  **Enhetspris-justering (34.3.3):** Også her har BH en svarplikt (UUO) som medfører tap av innsigelser. Dette er inkludert under punkt 4.
3.  **Sluttoppgjør:** Logikken er at 2-månedersfristen for TE (39.1) *ikke* er preklusiv i seg selv (det krever at BH setter en ny frist), mens BHs svarfrist (39.2) *er* preklusiv. Modellen reflekterer dette skillet korrekt.
4.  **Kontraktsmedhjelpere:** 14-dagersfristene for nektelse (10.2 / 12.1.2) er inkludert. Dette er viktig i oppstartsfasen.

Dette datasettet bør gi et solid fundament for logikken i saksbehandlingssystemet ditt.