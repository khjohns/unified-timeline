"""
Sak Creation Service - Felles service for saksopprettelse.

Samler all saksopprettelse-logikk med Unit of Work for atomisk
metadata + event opprettelse. Brukes av:
- catenda_webhook_service.py (KOE/Forsering via Catenda webhook)
- endringsordre_service.py (Endringsordre)
- event_routes.py (KOE via batch API)

Fordeler:
- DRY: Én implementasjon av UoW-logikk
- Konsistent: Alle sakstyper opprettes på samme måte
- Testbar: Kan mocke SakCreationService i tester
"""

from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from dataclasses import dataclass

from models.sak_metadata import SakMetadata
from utils.logger import get_logger

logger = get_logger(__name__)


@dataclass
class SakCreationResult:
    """Resultat fra saksopprettelse."""
    sak_id: str
    version: int
    metadata: SakMetadata
    success: bool = True
    error: Optional[str] = None


class SakCreationService:
    """
    Service for å opprette saker med atomisk metadata + event lagring.

    Bruker Unit of Work for å sikre at metadata og events lagres
    atomisk. Ved feil rulles begge tilbake.

    Usage:
        service = SakCreationService()
        result = service.create_sak(
            sak_id="SAK-20260201-001",
            sakstype="standard",
            events=[sak_opprettet_event, grunnlag_event],
            metadata_kwargs={
                "cached_title": "Min sak",
                "created_by": "bruker@example.com",
            }
        )
        if result.success:
            print(f"Sak {result.sak_id} opprettet med versjon {result.version}")
    """

    def create_sak(
        self,
        sak_id: str,
        sakstype: str,
        events: List[Any],
        metadata_kwargs: Optional[Dict[str, Any]] = None,
        catenda_topic_id: Optional[str] = None,
        catenda_board_id: Optional[str] = None,
        catenda_project_id: Optional[str] = None,
        prosjekt_id: Optional[str] = None,
    ) -> SakCreationResult:
        """
        Opprett en ny sak med metadata og events atomisk.

        Args:
            sak_id: Unik sak-ID (f.eks. "SAK-20260201-001")
            sakstype: Type sak ("standard", "forsering", "endringsordre")
            events: Liste med events som skal lagres
            metadata_kwargs: Ekstra felter for SakMetadata (cached_title, created_by, etc.)
            catenda_topic_id: Valgfri Catenda topic GUID
            catenda_board_id: Valgfri Catenda board GUID
            catenda_project_id: Valgfri Catenda project GUID
            prosjekt_id: Valgfri intern prosjekt-ID

        Returns:
            SakCreationResult med sak_id, version, metadata og success-status

        Raises:
            Ingen - feil returneres i result.error
        """
        from core.container import get_container

        if not events:
            return SakCreationResult(
                sak_id=sak_id,
                version=0,
                metadata=None,
                success=False,
                error="Ingen events å lagre"
            )

        # Bygg metadata
        now = datetime.now(timezone.utc)
        meta_kwargs = metadata_kwargs or {}

        metadata = SakMetadata(
            sak_id=sak_id,
            sakstype=sakstype,
            prosjekt_id=prosjekt_id,
            catenda_topic_id=catenda_topic_id,
            catenda_board_id=catenda_board_id,
            catenda_project_id=catenda_project_id,
            created_at=meta_kwargs.get("created_at", now),
            created_by=meta_kwargs.get("created_by", "unknown"),
            cached_title=meta_kwargs.get("cached_title", f"Sak {sak_id}"),
            cached_status=meta_kwargs.get("cached_status", "UNDER_VARSLING"),
            last_event_at=now,
        )

        # Bruk Unit of Work for atomisk lagring
        container = get_container()

        try:
            with container.create_unit_of_work() as uow:
                # 1. Opprett metadata
                uow.metadata.create(metadata)
                logger.info(f"✅ Metadata opprettet for {sak_id}")

                # 2. Lagre events
                if len(events) == 1:
                    new_version = uow.events.append(events[0], expected_version=0)
                else:
                    new_version = uow.events.append_batch(events, expected_version=0)

                logger.info(f"✅ {len(events)} event(s) lagret for {sak_id}, versjon: {new_version}")

            return SakCreationResult(
                sak_id=sak_id,
                version=new_version,
                metadata=metadata,
                success=True
            )

        except Exception as e:
            logger.error(f"❌ Feil ved opprettelse av sak {sak_id}: {e}")
            return SakCreationResult(
                sak_id=sak_id,
                version=0,
                metadata=None,
                success=False,
                error=str(e)
            )

    def create_sak_with_metadata(
        self,
        metadata: SakMetadata,
        events: List[Any],
    ) -> SakCreationResult:
        """
        Opprett sak med ferdig konstruert metadata.

        Brukes når kalleren allerede har bygget SakMetadata-objektet.

        Args:
            metadata: Ferdig konstruert SakMetadata
            events: Liste med events som skal lagres

        Returns:
            SakCreationResult med sak_id, version, metadata og success-status
        """
        from core.container import get_container

        if not events:
            return SakCreationResult(
                sak_id=metadata.sak_id,
                version=0,
                metadata=None,
                success=False,
                error="Ingen events å lagre"
            )

        container = get_container()

        try:
            with container.create_unit_of_work() as uow:
                uow.metadata.create(metadata)
                logger.info(f"✅ Metadata opprettet for {metadata.sak_id}")

                if len(events) == 1:
                    new_version = uow.events.append(events[0], expected_version=0)
                else:
                    new_version = uow.events.append_batch(events, expected_version=0)

                logger.info(f"✅ {len(events)} event(s) lagret for {metadata.sak_id}, versjon: {new_version}")

            return SakCreationResult(
                sak_id=metadata.sak_id,
                version=new_version,
                metadata=metadata,
                success=True
            )

        except Exception as e:
            logger.error(f"❌ Feil ved opprettelse av sak {metadata.sak_id}: {e}")
            return SakCreationResult(
                sak_id=metadata.sak_id,
                version=0,
                metadata=None,
                success=False,
                error=str(e)
            )


# Singleton instance for enkel tilgang
_sak_creation_service: Optional[SakCreationService] = None


def get_sak_creation_service() -> SakCreationService:
    """Hent singleton SakCreationService instans."""
    global _sak_creation_service
    if _sak_creation_service is None:
        _sak_creation_service = SakCreationService()
    return _sak_creation_service
