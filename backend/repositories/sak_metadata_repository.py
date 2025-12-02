"""
Repository for lightweight case metadata with cached fields.
"""
import csv
from pathlib import Path
from typing import Optional, List
from datetime import datetime
from models.sak_metadata import SakMetadata
from threading import RLock


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
            with open(self.csv_path, 'w', encoding='utf-8', newline='') as f:
                writer = csv.writer(f)
                writer.writerow([
                    'sak_id', 'prosjekt_id', 'catenda_topic_id',
                    'catenda_project_id', 'created_at', 'created_by',
                    'cached_title', 'cached_status', 'last_event_at'
                ])

    def create(self, metadata: SakMetadata) -> None:
        """Create new case metadata entry."""
        with self.lock:
            with open(self.csv_path, 'a', encoding='utf-8', newline='') as f:
                writer = csv.writer(f)
                writer.writerow([
                    metadata.sak_id,
                    metadata.prosjekt_id or '',
                    metadata.catenda_topic_id or '',
                    metadata.catenda_project_id or '',
                    metadata.created_at.isoformat(),
                    metadata.created_by,
                    metadata.cached_title or '',
                    metadata.cached_status or '',
                    metadata.last_event_at.isoformat() if metadata.last_event_at else ''
                ])

    def get(self, sak_id: str) -> Optional[SakMetadata]:
        """Get case metadata by ID."""
        with self.lock:
            if not self.csv_path.exists():
                return None

            with open(self.csv_path, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    if row['sak_id'] == sak_id:
                        return SakMetadata(
                            sak_id=row['sak_id'],
                            prosjekt_id=row['prosjekt_id'] or None,
                            catenda_topic_id=row['catenda_topic_id'] or None,
                            catenda_project_id=row['catenda_project_id'] or None,
                            created_at=datetime.fromisoformat(row['created_at']),
                            created_by=row['created_by'],
                            cached_title=row['cached_title'] or None,
                            cached_status=row['cached_status'] or None,
                            last_event_at=datetime.fromisoformat(row['last_event_at']) if row['last_event_at'] else None
                        )
            return None

    def update_cache(
        self,
        sak_id: str,
        cached_title: Optional[str] = None,
        cached_status: Optional[str] = None,
        last_event_at: Optional[datetime] = None
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
            with open(self.csv_path, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                fieldnames = reader.fieldnames
                for row in reader:
                    if row['sak_id'] == sak_id:
                        # Update cached fields
                        if cached_title is not None:
                            row['cached_title'] = cached_title
                        if cached_status is not None:
                            row['cached_status'] = cached_status
                        if last_event_at is not None:
                            row['last_event_at'] = last_event_at.isoformat()
                    rows.append(row)

            # Write back
            with open(self.csv_path, 'w', encoding='utf-8', newline='') as f:
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()
                writer.writerows(rows)

    def list_all(self) -> List[SakMetadata]:
        """List all cases (for case list view)."""
        with self.lock:
            if not self.csv_path.exists():
                return []

            cases = []
            with open(self.csv_path, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    cases.append(SakMetadata(
                        sak_id=row['sak_id'],
                        prosjekt_id=row['prosjekt_id'] or None,
                        catenda_topic_id=row['catenda_topic_id'] or None,
                        catenda_project_id=row['catenda_project_id'] or None,
                        created_at=datetime.fromisoformat(row['created_at']),
                        created_by=row['created_by'],
                        cached_title=row['cached_title'] or None,
                        cached_status=row['cached_status'] or None,
                        last_event_at=datetime.fromisoformat(row['last_event_at']) if row['last_event_at'] else None
                    ))
            return cases
