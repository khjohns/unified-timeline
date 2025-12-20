"""
CloudEvents-støtte for unified-timeline.

Implementerer CloudEvents v1.0 spesifikasjonen:
https://github.com/cloudevents/spec/blob/v1.0.2/cloudevents/spec.md

Fase 1: Kompatibilitetslag
- Legger til CloudEvents-attributter via mixin
- Ingen breaking changes til eksisterende modeller
- Støtter eksport til CloudEvents-format via to_cloudevent()
- Støtter import fra CloudEvents-format via from_cloudevent()
"""
from pydantic import BaseModel, computed_field
from typing import Optional, Any, Dict
from datetime import datetime


# CloudEvents namespace for dette prosjektet
CLOUDEVENTS_NAMESPACE = "no.oslo.koe"
CLOUDEVENTS_SPECVERSION = "1.0"


class CloudEventMixin(BaseModel):
    """
    Mixin som legger til CloudEvents-attributter.

    Brukes sammen med SakEvent for å gi CloudEvents-kompatibilitet
    uten å endre eksisterende feltstruktur.

    CloudEvents v1.0 Required Attributes:
    - specversion: Versjon av CloudEvents spec (alltid "1.0")
    - id: Unik identifikator for eventen
    - source: URI som identifiserer kilden
    - type: Beskriver event-kategorien

    CloudEvents v1.0 Optional Attributes:
    - time: Tidsstempel i RFC 3339 format
    - subject: Spesifikt subjekt innen source
    - datacontenttype: Media type for data
    - dataschema: URI til schema for data

    Extension Attributes (prosjektspesifikke):
    - actor: Hvem som utførte handlingen
    - actorrole: Rolle (TE/BH)
    - referstoid: Referanse til annen event
    """

    # Valgfritt felt for prosjekt-ID (brukes i source URI)
    prosjekt_id: Optional[str] = None

    @computed_field
    @property
    def specversion(self) -> str:
        """CloudEvents specification version."""
        return CLOUDEVENTS_SPECVERSION

    @computed_field
    @property
    def ce_id(self) -> str:
        """CloudEvents id (maps to event_id)."""
        return getattr(self, 'event_id', '')

    @computed_field
    @property
    def ce_source(self) -> str:
        """
        CloudEvents source URI.

        Format: /projects/{prosjekt_id}/cases/{sak_id}
        Bruker 'unknown' som fallback hvis prosjekt_id ikke er satt.
        """
        proj_id = getattr(self, 'prosjekt_id', None) or 'unknown'
        sak_id = getattr(self, 'sak_id', 'unknown')
        return f"/projects/{proj_id}/cases/{sak_id}"

    @computed_field
    @property
    def ce_type(self) -> str:
        """
        CloudEvents type med namespace.

        Format: no.oslo.koe.{event_type}
        Følger reverse-DNS konvensjonen fra CloudEvents spec.
        """
        event_type = getattr(self, 'event_type', None)
        if event_type is None:
            return f"{CLOUDEVENTS_NAMESPACE}.unknown"
        # Håndter både Enum og string
        type_value = event_type.value if hasattr(event_type, 'value') else str(event_type)
        return f"{CLOUDEVENTS_NAMESPACE}.{type_value}"

    @computed_field
    @property
    def ce_time(self) -> str:
        """
        CloudEvents time i ISO 8601/RFC 3339 format.

        Returnerer tidsstempel med 'Z' suffix for UTC.
        """
        tidsstempel = getattr(self, 'tidsstempel', None)
        if tidsstempel is None:
            return datetime.utcnow().isoformat() + "Z"
        if isinstance(tidsstempel, datetime):
            # Bruk isoformat og legg til Z for UTC
            iso = tidsstempel.isoformat()
            # Fjern eventuell timezone info og legg til Z
            if '+' in iso:
                iso = iso.split('+')[0]
            elif iso.endswith('Z'):
                return iso
            return iso + "Z"
        return str(tidsstempel)

    @computed_field
    @property
    def ce_subject(self) -> str:
        """CloudEvents subject (maps to sak_id)."""
        return getattr(self, 'sak_id', '')

    @computed_field
    @property
    def ce_datacontenttype(self) -> str:
        """CloudEvents data content type."""
        return "application/json"

    def to_cloudevent(self) -> Dict[str, Any]:
        """
        Eksporter event som CloudEvents-format.

        Returns:
            dict: Event i CloudEvents v1.0 format

        Eksempel output:
        {
            "specversion": "1.0",
            "id": "550e8400-e29b-41d4-a716-446655440000",
            "source": "/projects/P-2025-001/cases/KOE-2025-042",
            "type": "no.oslo.koe.grunnlag_opprettet",
            "time": "2025-12-20T10:30:00Z",
            "subject": "KOE-2025-042",
            "datacontenttype": "application/json",
            "actor": "Ola Nordmann",
            "actorrole": "TE",
            "data": { ... }
        }
        """
        ce: Dict[str, Any] = {
            # Required attributes
            "specversion": self.specversion,
            "id": self.ce_id,
            "source": self.ce_source,
            "type": self.ce_type,

            # Optional attributes
            "time": self.ce_time,
            "subject": self.ce_subject,
            "datacontenttype": self.ce_datacontenttype,

            # Extension attributes
            "actor": getattr(self, 'aktor', None),
            "actorrole": getattr(self, 'aktor_rolle', None),
        }

        # Legg til kommentar som extension hvis den finnes
        kommentar = getattr(self, 'kommentar', None)
        if kommentar:
            ce["comment"] = kommentar

        # Legg til referanse hvis den finnes
        refererer_til = getattr(self, 'refererer_til_event_id', None)
        if refererer_til:
            ce["referstoid"] = refererer_til

        # Legg til data payload
        data = getattr(self, 'data', None)
        if data is not None:
            if hasattr(data, 'model_dump'):
                # Use mode='json' to convert enums to strings
                ce["data"] = data.model_dump(mode='json', exclude_none=True)
            elif isinstance(data, dict):
                ce["data"] = data
            else:
                ce["data"] = data

        # Fjern None-verdier fra ce dict (unntatt data som kan være tom dict)
        ce = {k: v for k, v in ce.items() if v is not None or k == 'data'}

        return ce

    @classmethod
    def from_cloudevent(cls, ce: Dict[str, Any], **kwargs):
        """
        Parse CloudEvent til intern event-struktur.

        Args:
            ce: CloudEvents dict
            **kwargs: Ekstra felter som ikke er i CloudEvent

        Returns:
            Event-instans

        Eksempel input:
        {
            "specversion": "1.0",
            "id": "550e8400-e29b-41d4-a716-446655440000",
            "source": "/projects/P-2025-001/cases/KOE-2025-042",
            "type": "no.oslo.koe.grunnlag_opprettet",
            "time": "2025-12-20T10:30:00Z",
            "subject": "KOE-2025-042",
            "actor": "Ola Nordmann",
            "actorrole": "TE",
            "data": { ... }
        }
        """
        # Map CloudEvents attributter til interne felter
        mapped: Dict[str, Any] = {
            "event_id": ce.get("id"),
            "sak_id": ce.get("subject"),
            "aktor": ce.get("actor"),
            "aktor_rolle": ce.get("actorrole"),
            "refererer_til_event_id": ce.get("referstoid"),
            "kommentar": ce.get("comment"),
        }

        # Parse tidsstempel
        time_str = ce.get("time")
        if time_str:
            # Fjern Z suffix og parse
            if time_str.endswith("Z"):
                time_str = time_str[:-1]
            try:
                mapped["tidsstempel"] = datetime.fromisoformat(time_str)
            except ValueError:
                mapped["tidsstempel"] = time_str

        # Ekstraher event_type fra type (fjern namespace)
        ce_type = ce.get("type", "")
        prefix = f"{CLOUDEVENTS_NAMESPACE}."
        if ce_type.startswith(prefix):
            mapped["event_type"] = ce_type[len(prefix):]
        else:
            mapped["event_type"] = ce_type

        # Ekstraher prosjekt_id fra source hvis mulig
        source = ce.get("source", "")
        if source.startswith("/projects/"):
            parts = source.split("/")
            if len(parts) >= 3:
                prosjekt_id = parts[2]
                if prosjekt_id != "unknown":
                    mapped["prosjekt_id"] = prosjekt_id

        # Legg til data
        if "data" in ce:
            mapped["data"] = ce["data"]

        # Merge med ekstra kwargs
        mapped.update(kwargs)

        # Filtrer ut None-verdier
        mapped = {k: v for k, v in mapped.items() if v is not None}

        return cls.model_validate(mapped)


def validate_cloudevent(ce: Dict[str, Any]) -> bool:
    """
    Validerer at en dict følger CloudEvents v1.0 spec.

    Args:
        ce: Dict som skal valideres

    Returns:
        True hvis gyldig CloudEvent

    Raises:
        ValueError: Hvis påkrevde felter mangler eller har ugyldig format
    """
    # Påkrevde felter
    required_fields = ["specversion", "id", "source", "type"]
    for field in required_fields:
        if field not in ce:
            raise ValueError(f"Mangler påkrevd CloudEvents-felt: {field}")

    # Valider specversion
    if ce["specversion"] != CLOUDEVENTS_SPECVERSION:
        raise ValueError(
            f"Ugyldig specversion: {ce['specversion']}. "
            f"Forventet: {CLOUDEVENTS_SPECVERSION}"
        )

    # Valider at id ikke er tom
    if not ce["id"]:
        raise ValueError("CloudEvents 'id' kan ikke være tom")

    # Valider at source er en URI (enkel sjekk)
    source = ce["source"]
    if not isinstance(source, str) or not source:
        raise ValueError("CloudEvents 'source' må være en ikke-tom URI string")

    # Valider at type følger vårt namespace (valgfritt, men nyttig)
    ce_type = ce["type"]
    if not isinstance(ce_type, str) or not ce_type:
        raise ValueError("CloudEvents 'type' må være en ikke-tom string")

    return True


# Type alias for CloudEvents dict
CloudEventDict = Dict[str, Any]
