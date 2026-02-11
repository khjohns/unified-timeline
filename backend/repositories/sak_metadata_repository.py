"""
Repository for lightweight case metadata with cached fields.
"""

import csv
from datetime import datetime
from pathlib import Path
from threading import RLock

from models.sak_metadata import SakMetadata


class SakMetadataRepository:
    """
    Manages case metadata in CSV format.

    Handles cache updates when events are created.
    """

    def __init__(self, csv_path: str = "koe_data/saker.csv"):
        self.csv_path = Path(csv_path)
        self.lock = RLock()
        self.csv_path.parent.mkdir(parents=True, exist_ok=True)

        # Ensure file exists with headers
        if not self.csv_path.exists():
            with open(self.csv_path, "w", encoding="utf-8", newline="") as f:
                writer = csv.writer(f)
                writer.writerow(
                    [
                        "sak_id",
                        "prosjekt_id",
                        "catenda_topic_id",
                        "catenda_board_id",
                        "catenda_project_id",
                        "created_at",
                        "created_by",
                        "cached_title",
                        "cached_status",
                        "last_event_at",
                    ]
                )

    def create(self, metadata: SakMetadata) -> None:
        """Create new case metadata entry."""
        with self.lock:
            with open(self.csv_path, "a", encoding="utf-8", newline="") as f:
                writer = csv.writer(f)
                writer.writerow(
                    [
                        metadata.sak_id,
                        metadata.prosjekt_id or "",
                        metadata.catenda_topic_id or "",
                        metadata.catenda_board_id or "",
                        metadata.catenda_project_id or "",
                        metadata.created_at.isoformat(),
                        metadata.created_by,
                        metadata.cached_title or "",
                        metadata.cached_status or "",
                        metadata.last_event_at.isoformat()
                        if metadata.last_event_at
                        else "",
                    ]
                )

    def get(self, sak_id: str) -> SakMetadata | None:
        """Get case metadata by ID."""
        with self.lock:
            if not self.csv_path.exists():
                return None

            with open(self.csv_path, encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    if row["sak_id"] == sak_id:
                        return SakMetadata(
                            sak_id=row["sak_id"],
                            prosjekt_id=row["prosjekt_id"] or None,
                            catenda_topic_id=row["catenda_topic_id"] or None,
                            catenda_board_id=row.get("catenda_board_id") or None,
                            catenda_project_id=row["catenda_project_id"] or None,
                            created_at=datetime.fromisoformat(row["created_at"]),
                            created_by=row["created_by"],
                            cached_title=row["cached_title"] or None,
                            cached_status=row["cached_status"] or None,
                            last_event_at=datetime.fromisoformat(row["last_event_at"])
                            if row["last_event_at"]
                            else None,
                        )
            return None

    def update_cache(
        self,
        sak_id: str,
        cached_title: str | None = None,
        cached_status: str | None = None,
        last_event_at: datetime | None = None,
    ) -> None:
        """
        Update cached fields for a case.

        Called after every event submission to keep metadata in sync.
        """
        with self.lock:
            if not self.csv_path.exists():
                return

            # Read all rows
            rows = []
            with open(self.csv_path, encoding="utf-8") as f:
                reader = csv.DictReader(f)
                fieldnames = reader.fieldnames
                for row in reader:
                    if row["sak_id"] == sak_id:
                        # Update cached fields
                        if cached_title is not None:
                            row["cached_title"] = cached_title
                        if cached_status is not None:
                            row["cached_status"] = cached_status
                        if last_event_at is not None:
                            row["last_event_at"] = last_event_at.isoformat()
                    rows.append(row)

            # Write back
            with open(self.csv_path, "w", encoding="utf-8", newline="") as f:
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()
                writer.writerows(rows)

    def get_by_topic_id(self, topic_id: str) -> SakMetadata | None:
        """Get case metadata by Catenda topic ID."""
        with self.lock:
            if not self.csv_path.exists():
                return None

            with open(self.csv_path, encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    if row.get("catenda_topic_id") == topic_id:
                        return SakMetadata(
                            sak_id=row["sak_id"],
                            prosjekt_id=row["prosjekt_id"] or None,
                            catenda_topic_id=row["catenda_topic_id"] or None,
                            catenda_board_id=row.get("catenda_board_id") or None,
                            catenda_project_id=row["catenda_project_id"] or None,
                            created_at=datetime.fromisoformat(row["created_at"]),
                            created_by=row["created_by"],
                            cached_title=row["cached_title"] or None,
                            cached_status=row["cached_status"] or None,
                            last_event_at=datetime.fromisoformat(row["last_event_at"])
                            if row["last_event_at"]
                            else None,
                        )
            return None

    def _get_project_id(self, prosjekt_id: str | None = None) -> str | None:
        """Get project ID from parameter or Flask context. Returns None outside Flask."""
        if prosjekt_id:
            return prosjekt_id
        try:
            from flask import has_request_context

            if has_request_context():
                from lib.project_context import get_project_id

                return get_project_id()
        except ImportError:
            pass
        return None

    def list_all(self, prosjekt_id: str | None = None) -> list[SakMetadata]:
        """List all cases for a project (for case list view)."""
        pid = self._get_project_id(prosjekt_id)
        with self.lock:
            if not self.csv_path.exists():
                return []

            cases = []
            with open(self.csv_path, encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    if pid and (row.get("prosjekt_id") or "oslobygg") != pid:
                        continue
                    cases.append(
                        SakMetadata(
                            sak_id=row["sak_id"],
                            prosjekt_id=row["prosjekt_id"] or None,
                            catenda_topic_id=row["catenda_topic_id"] or None,
                            catenda_board_id=row.get("catenda_board_id") or None,
                            catenda_project_id=row["catenda_project_id"] or None,
                            created_at=datetime.fromisoformat(row["created_at"]),
                            created_by=row["created_by"],
                            cached_title=row["cached_title"] or None,
                            cached_status=row["cached_status"] or None,
                            last_event_at=datetime.fromisoformat(row["last_event_at"])
                            if row["last_event_at"]
                            else None,
                        )
                    )
            return cases

    def count_by_sakstype(self, sakstype: str, prosjekt_id: str | None = None) -> int:
        """Count cases by sakstype within a project."""
        pid = self._get_project_id(prosjekt_id)
        with self.lock:
            if not self.csv_path.exists():
                return 0

            count = 0
            with open(self.csv_path, encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    if pid and (row.get("prosjekt_id") or "oslobygg") != pid:
                        continue
                    if row.get("sakstype", "standard") == sakstype:
                        count += 1
            return count

    def delete(self, sak_id: str) -> bool:
        """Delete case metadata by ID."""
        with self.lock:
            if not self.csv_path.exists():
                return False

            # Read all rows except the one to delete
            rows = []
            found = False
            fieldnames = None

            with open(self.csv_path, encoding="utf-8") as f:
                reader = csv.DictReader(f)
                fieldnames = reader.fieldnames
                for row in reader:
                    if row["sak_id"] == sak_id:
                        found = True
                    else:
                        rows.append(row)

            if not found:
                return False

            # Write back without deleted row
            with open(self.csv_path, "w", encoding="utf-8", newline="") as f:
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()
                writer.writerows(rows)

            return True
