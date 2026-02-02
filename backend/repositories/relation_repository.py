"""
RelationRepository - Manages sak_relations projection table.

This repository provides efficient lookups for case relationships:
- Find all forseringer that reference a KOE
- Find all endringsordrer that reference a KOE

The sak_relations table is a CQRS projection maintained in sync with events.
"""

from typing import List, Literal, Optional
import os

try:
    from supabase import create_client, Client
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False
    Client = None

from utils.logger import get_logger

logger = get_logger(__name__)

RelationType = Literal["forsering", "endringsordre"]


class RelationRepository:
    """
    Repository for managing sak_relations table.

    Provides O(1) lookups for case relationships instead of
    scanning all cases (O(n)).
    """

    TABLE_NAME = "sak_relations"

    def __init__(
        self,
        url: Optional[str] = None,
        key: Optional[str] = None,
    ):
        """
        Initialize RelationRepository.

        Args:
            url: Supabase URL (defaults to SUPABASE_URL env var)
            key: Supabase key (defaults to SUPABASE_SECRET_KEY or SUPABASE_KEY env var)
        """
        if not SUPABASE_AVAILABLE:
            raise ImportError(
                "Supabase client not installed. Run: pip install supabase"
            )

        self.url = url or os.environ.get("SUPABASE_URL")
        self.key = key or os.environ.get("SUPABASE_SECRET_KEY") or os.environ.get("SUPABASE_KEY")

        if not self.url or not self.key:
            raise ValueError(
                "Supabase credentials required. Set SUPABASE_URL and SUPABASE_KEY "
                "environment variables or pass them to constructor."
            )

        self.client: Client = create_client(self.url, self.key)

    def add_relation(
        self,
        source_sak_id: str,
        target_sak_id: str,
        relation_type: RelationType,
    ) -> bool:
        """
        Add a relation between two saker.

        Args:
            source_sak_id: The sak holding the reference (forsering/EO)
            target_sak_id: The sak being referenced (KOE)
            relation_type: Type of relation ('forsering' or 'endringsordre')

        Returns:
            True if added, False if already exists
        """
        try:
            self.client.table(self.TABLE_NAME).upsert(
                {
                    "source_sak_id": source_sak_id,
                    "target_sak_id": target_sak_id,
                    "relation_type": relation_type,
                },
                on_conflict="source_sak_id,target_sak_id,relation_type",
            ).execute()

            logger.debug(
                f"Added relation: {source_sak_id} -> {target_sak_id} ({relation_type})"
            )
            return True

        except Exception as e:
            logger.error(f"Failed to add relation: {e}")
            return False

    def add_relations_batch(
        self,
        source_sak_id: str,
        target_sak_ids: List[str],
        relation_type: RelationType,
    ) -> int:
        """
        Add multiple relations from one source to multiple targets.

        Args:
            source_sak_id: The sak holding the references (forsering/EO)
            target_sak_ids: List of saker being referenced (KOEs)
            relation_type: Type of relation ('forsering' or 'endringsordre')

        Returns:
            Number of relations added
        """
        if not target_sak_ids:
            return 0

        rows = [
            {
                "source_sak_id": source_sak_id,
                "target_sak_id": target_sak_id,
                "relation_type": relation_type,
            }
            for target_sak_id in target_sak_ids
        ]

        try:
            self.client.table(self.TABLE_NAME).upsert(
                rows,
                on_conflict="source_sak_id,target_sak_id,relation_type",
            ).execute()

            logger.debug(
                f"Added {len(target_sak_ids)} relations for {source_sak_id} ({relation_type})"
            )
            return len(target_sak_ids)

        except Exception as e:
            logger.error(f"Failed to add relations batch: {e}")
            return 0

    def remove_relation(
        self,
        source_sak_id: str,
        target_sak_id: str,
        relation_type: Optional[RelationType] = None,
    ) -> bool:
        """
        Remove a relation between two saker.

        Args:
            source_sak_id: The sak holding the reference
            target_sak_id: The sak being referenced
            relation_type: Optional type filter. If None, removes all types.

        Returns:
            True if removed, False if not found
        """
        try:
            query = (
                self.client.table(self.TABLE_NAME)
                .delete()
                .eq("source_sak_id", source_sak_id)
                .eq("target_sak_id", target_sak_id)
            )

            if relation_type:
                query = query.eq("relation_type", relation_type)

            result = query.execute()

            removed = len(result.data) > 0 if result.data else False

            if removed:
                logger.debug(
                    f"Removed relation: {source_sak_id} -> {target_sak_id}"
                )

            return removed

        except Exception as e:
            logger.error(f"Failed to remove relation: {e}")
            return False

    def get_containers_for_sak(
        self,
        target_sak_id: str,
        relation_type: RelationType,
    ) -> List[str]:
        """
        Find all saker that reference a given sak (reverse lookup).

        This is the key optimization: O(1) lookup instead of scanning all saker.

        Args:
            target_sak_id: The KOE sak being referenced
            relation_type: Filter by type ('forsering' or 'endringsordre')

        Returns:
            List of source_sak_ids (forseringer or EOs that reference this KOE)
        """
        try:
            result = (
                self.client.table(self.TABLE_NAME)
                .select("source_sak_id")
                .eq("target_sak_id", target_sak_id)
                .eq("relation_type", relation_type)
                .execute()
            )

            return [row["source_sak_id"] for row in result.data] if result.data else []

        except Exception as e:
            logger.error(f"Failed to get containers for {target_sak_id}: {e}")
            return []

    def get_related_saks(
        self,
        source_sak_id: str,
        relation_type: Optional[RelationType] = None,
    ) -> List[str]:
        """
        Find all saker that a given sak references (forward lookup).

        Args:
            source_sak_id: The forsering/EO sak
            relation_type: Optional filter by type

        Returns:
            List of target_sak_ids (KOEs referenced by this forsering/EO)
        """
        try:
            query = (
                self.client.table(self.TABLE_NAME)
                .select("target_sak_id")
                .eq("source_sak_id", source_sak_id)
            )

            if relation_type:
                query = query.eq("relation_type", relation_type)

            result = query.execute()

            return [row["target_sak_id"] for row in result.data] if result.data else []

        except Exception as e:
            logger.error(f"Failed to get related saks for {source_sak_id}: {e}")
            return []

    def get_all_relations(
        self,
        relation_type: Optional[RelationType] = None,
    ) -> List[dict]:
        """
        Get all relations (for debugging/backfill verification).

        Args:
            relation_type: Optional filter by type

        Returns:
            List of relation dicts with source_sak_id, target_sak_id, relation_type
        """
        try:
            query = self.client.table(self.TABLE_NAME).select("*")

            if relation_type:
                query = query.eq("relation_type", relation_type)

            result = query.execute()

            return result.data if result.data else []

        except Exception as e:
            logger.error(f"Failed to get all relations: {e}")
            return []

    def clear_all_relations(self, relation_type: Optional[RelationType] = None) -> int:
        """
        Clear all relations (for backfill/testing).

        Args:
            relation_type: Optional filter to only clear specific type

        Returns:
            Number of relations removed
        """
        try:
            query = self.client.table(self.TABLE_NAME).delete()

            if relation_type:
                query = query.eq("relation_type", relation_type)
            else:
                # Supabase requires a filter for delete, so use a truthy condition
                query = query.neq("id", -1)

            result = query.execute()

            count = len(result.data) if result.data else 0
            logger.info(f"Cleared {count} relations" + (f" (type={relation_type})" if relation_type else ""))
            return count

        except Exception as e:
            logger.error(f"Failed to clear relations: {e}")
            return 0


def create_relation_repository(**kwargs) -> RelationRepository:
    """
    Factory function for creating RelationRepository.

    Only creates repository if Supabase backend is enabled.

    Returns:
        RelationRepository instance

    Raises:
        ValueError: If Supabase is not configured
    """
    backend = os.environ.get("EVENT_STORE_BACKEND", "json")

    if backend != "supabase":
        raise ValueError(
            f"RelationRepository requires Supabase backend. "
            f"Current backend: {backend}"
        )

    return RelationRepository(**kwargs)
