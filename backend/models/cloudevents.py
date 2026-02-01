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
from datetime import datetime, timezone


# CloudEvents namespace for dette prosjektet
CLOUDEVENTS_NAMESPACE = "no.oslo.koe"
CLOUDEVENTS_SPECVERSION = "1.0"


def parse_rfc3339(time_str: str) -> datetime:
    """
    Parser RFC 3339 timestamp (CloudEvents time-format).

    Støtter både UTC (Z-suffix) og offset-format (+/-HH:MM).

    Args:
        time_str: Timestamp i RFC 3339-format

    Returns:
        datetime med timezone-info

    Raises:
        ValueError: Hvis formatet er ugyldig

    Eksempler:
        >>> parse_rfc3339("2025-12-20T10:30:00Z")
        datetime(2025, 12, 20, 10, 30, 0, tzinfo=timezone.utc)
        >>> parse_rfc3339("2025-12-20T10:30:00+01:00")
        datetime(2025, 12, 20, 10, 30, 0, tzinfo=...)
    """
    if time_str.endswith("Z"):
        # UTC format: 2025-12-20T10:30:00Z
        return datetime.fromisoformat(time_str[:-1]).replace(tzinfo=timezone.utc)
    else:
        # Offset format: 2025-12-20T10:30:00+01:00
        # Python 3.11+ støtter dette direkte
        return datetime.fromisoformat(time_str)


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
        Bruker 'oslobygg' som default hvis prosjekt_id ikke er satt.
        """
        # TODO: prosjekt_id bør hentes fra sak-kontekst ved event-opprettelse.
        # Mulige løsninger:
        # 1. Hent fra database: SakRepository.get_prosjekt_id(sak_id)
        # 2. Inkluder prosjekt_id som required felt i API-requests
        # 3. Legg til prosjekt_id i SakState og hent derfra
        proj_id = getattr(self, 'prosjekt_id', None) or 'oslobygg'
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
        else:
            # For events without a 'data' field (like SakOpprettetEvent),
            # extract event-specific fields and put them in data
            # Standard fields that should NOT be in data payload
            standard_fields = {
                'event_id', 'sak_id', 'event_type', 'tidsstempel',
                'aktor', 'aktor_rolle', 'kommentar', 'refererer_til_event_id',
                # Computed fields from CloudEventMixin
                'specversion', 'ce_id', 'ce_source', 'ce_type', 'ce_time',
                'ce_subject', 'ce_datacontenttype',
            }
            event_data = {}
            for field_name, field_value in self.model_dump(mode='json').items():
                if field_name not in standard_fields and field_value is not None:
                    event_data[field_name] = field_value
            if event_data:
                ce["data"] = event_data

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

        Raises:
            ValueError: Hvis CloudEvent mangler påkrevde felter eller har ugyldig format

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
        # Valider CloudEvent først
        validate_cloudevent(ce)

        # Map CloudEvents attributter til interne felter
        mapped: Dict[str, Any] = {
            "event_id": ce.get("id"),
            "sak_id": ce.get("subject"),
            "aktor": ce.get("actor"),
            "aktor_rolle": ce.get("actorrole"),
            "refererer_til_event_id": ce.get("referstoid"),
            "kommentar": ce.get("comment"),
        }

        # Parse tidsstempel (RFC 3339)
        time_str = ce.get("time")
        if time_str:
            try:
                mapped["tidsstempel"] = parse_rfc3339(time_str)
            except ValueError as e:
                raise ValueError(f"Ugyldig RFC 3339 timestamp: {time_str}") from e

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
                # Ignorer default-verdier
                if prosjekt_id not in ("unknown", "oslobygg"):
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
