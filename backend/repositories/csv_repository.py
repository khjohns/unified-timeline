"""
CSV-based data repository for prototype/development.

⚠️ DEPRECATED - This repository is deprecated and will be removed.
Use Event Sourcing repository instead:
- repositories.event_repository.JsonFileEventRepository for event persistence

This file is kept temporarily for data migration purposes only.
DO NOT USE in new code.
"""
import warnings
import csv
import json
from datetime import datetime
from pathlib import Path
from threading import RLock
from typing import Optional, Dict, Any, List

from repositories.base_repository import BaseRepository
from utils.logger import get_logger

# Emit deprecation warning when module is imported
warnings.warn(
    "repositories.csv_repository is deprecated. Use repositories.event_repository instead.",
    DeprecationWarning,
    stacklevel=2
)

# Legacy constants (from deleted generated_constants.py)
SAK_STATUS = {
    'OPPRETTET': '100000000',
    'UNDER_VARSLING': '100000001',
    'SENDT': '100000002',
    'GODKJENT': '100000003'
}
KOE_STATUS = {
    'UTKAST': '100000000',
    'SENDT': '100000001',
    'GODKJENT': '100000002'
}

logger = get_logger(__name__)


class CSVRepository(BaseRepository):
    """
    CSV file-based repository implementation.

    Storage structure:
    - koe_data/saker.csv: Case overview (status, metadata)
    - koe_data/historikk.csv: Event history log
    - koe_data/form_data/{sak_id}.json: Detailed form data per case
    """

    SAKER_FIELDNAMES = [
        'sak_id', 'catenda_topic_id', 'catenda_project_id', 'catenda_board_id',
        'sakstittel', 'opprettet_dato', 'opprettet_av', 'status', 'te_navn', 'modus',
        'byggherre', 'entreprenor', 'prosjekt_navn'
    ]

    HISTORIKK_FIELDNAMES = [
        'timestamp', 'sak_id', 'hendelse_type', 'beskrivelse'
    ]

    def __init__(self, data_dir: str = "koe_data"):
        """
        Initialize CSV repository.

        Args:
            data_dir: Directory for data storage
        """
        self.data_dir = Path(data_dir)
        self.form_data_dir = self.data_dir / "form_data"

        # Create directories
        self.data_dir.mkdir(exist_ok=True)
        self.form_data_dir.mkdir(exist_ok=True)

        # CSV files
        self.saker_file = self.data_dir / "saker.csv"
        self.historikk_file = self.data_dir / "historikk.csv"

        # Thread-safe operations
        self.lock = RLock()  # Re-entrant lock for nested calls

        self._initialize_files()

    def _initialize_files(self):
        """Create CSV files with headers if they don't exist"""
        if not self.saker_file.exists():
            with open(self.saker_file, 'w', newline='', encoding='utf-8') as f:
                writer = csv.DictWriter(f, fieldnames=self.SAKER_FIELDNAMES)
                writer.writeheader()
            logger.info(f"Created saker.csv at {self.saker_file}")

        if not self.historikk_file.exists():
            with open(self.historikk_file, 'w', newline='', encoding='utf-8') as f:
                writer = csv.DictWriter(f, fieldnames=self.HISTORIKK_FIELDNAMES)
                writer.writeheader()
            logger.info(f"Created historikk.csv at {self.historikk_file}")

    # ========================================================================
    # BaseRepository Implementation
    # ========================================================================

    def get_case(self, case_id: str) -> Optional[Dict[str, Any]]:
        """
        Get case by ID (returns full JSON data).

        Args:
            case_id: Case identifier (GUID or KOE-ID)

        Returns:
            Complete case data from JSON file, or None if not found
        """
        file_path = self.form_data_dir / f"{case_id}.json"
        if not file_path.exists():
            return None

        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Error reading JSON for {case_id}: {e}")
            return None

    def update_case(self, case_id: str, data: Dict[str, Any]) -> None:
        """
        Update case data.

        Args:
            case_id: Case identifier
            data: Complete case data to store

        Raises:
            ValueError: If case doesn't exist
        """
        # Check if case exists
        if not self.case_exists(case_id):
            raise ValueError(f"Case not found: {case_id}")

        # Save to JSON
        file_path = self.form_data_dir / f"{case_id}.json"
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        # Sync status and modus to CSV
        sak_data = data.get('sak', {})
        if sak_data:
            status = sak_data.get('status')
            modus = sak_data.get('modus')
            if status or modus:
                self._update_sak_status(case_id, status, modus)

        logger.info(f"Updated case {case_id}")

    def create_case(self, case_data: Dict[str, Any]) -> str:
        """
        Create new case.

        Args:
            case_data: Initial case data (sak metadata)

        Returns:
            Created case_id
        """
        with self.lock:
            # Generate ID if not provided
            if 'sak_id' not in case_data:
                case_data['sak_id'] = f"KOE-{datetime.now().strftime('%Y%m%d-%H%M%S')}"

            # Set defaults
            case_data.setdefault('opprettet_dato', datetime.now().isoformat())
            case_data.setdefault('opprettet_av', case_data.get('te_navn', 'System'))
            case_data.setdefault('status', SAK_STATUS['UNDER_VARSLING'])
            case_data.setdefault('modus', 'varsel')

            # Save to CSV
            with open(self.saker_file, 'a', newline='', encoding='utf-8') as f:
                filtered_data = {k: case_data.get(k) for k in self.SAKER_FIELDNAMES}
                writer = csv.DictWriter(f, fieldnames=self.SAKER_FIELDNAMES)
                writer.writerow(filtered_data)

            case_data['sak_id_display'] = case_data['sak_id']

            # Create initial JSON file with first KOE revision
            initial_json = {
                "versjon": "5.0",
                "rolle": "TE",
                "sak": case_data,
                "varsel": {},
                "koe_revisjoner": [
                    {
                        "koe_revisjonsnr": "0",
                        "dato_krav_sendt": "",
                        "for_entreprenor": "",
                        "status": KOE_STATUS['UTKAST'],
                        "vederlag": {
                            "krav_vederlag": False,
                            "krav_produktivitetstap": False,
                            "saerskilt_varsel_rigg_drift": False,
                            "krav_vederlag_metode": "",
                            "krav_vederlag_belop": "",
                            "krav_vederlag_begrunnelse": "",
                        },
                        "frist": {
                            "krav_fristforlengelse": False,
                            "krav_frist_antall_dager": "",
                            "forsinkelse_kritisk_linje": False,
                            "krav_frist_begrunnelse": "",
                        },
                    }
                ],
                "bh_svar_revisjoner": []
            }

            # Save initial JSON
            file_path = self.form_data_dir / f"{case_data['sak_id']}.json"
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(initial_json, f, ensure_ascii=False, indent=2)

            # Log creation
            self._log_historikk(case_data['sak_id'], 'sak_opprettet', 'Ny sak opprettet fra Catenda')

            logger.info(f"Created case {case_data['sak_id']}")
            return case_data['sak_id']

    def list_cases(self, project_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        List cases, optionally filtered by project.

        Args:
            project_id: Optional project filter

        Returns:
            List of case data (from CSV, lightweight)
        """
        with self.lock:
            cases = []
            with open(self.saker_file, 'r', newline='', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    if project_id is None or row.get('catenda_project_id') == project_id:
                        cases.append(row)
            return cases

    def delete_case(self, case_id: str) -> None:
        """
        Delete case by ID.

        Args:
            case_id: Case identifier

        Raises:
            ValueError: If case not found
        """
        with self.lock:
            # Delete JSON file
            file_path = self.form_data_dir / f"{case_id}.json"
            if not file_path.exists():
                raise ValueError(f"Case not found: {case_id}")

            file_path.unlink()

            # Remove from CSV
            rows = []
            found = False
            with open(self.saker_file, 'r', newline='', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                fieldnames = reader.fieldnames
                for row in reader:
                    if row['sak_id'] != case_id:
                        rows.append(row)
                    else:
                        found = True

            if not found:
                logger.warning(f"Case {case_id} not found in CSV (but JSON existed)")

            # Rewrite CSV
            with open(self.saker_file, 'w', newline='', encoding='utf-8') as f:
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()
                writer.writerows(rows)

            logger.info(f"Deleted case {case_id}")

    def case_exists(self, case_id: str) -> bool:
        """
        Check if case exists.

        Args:
            case_id: Case identifier

        Returns:
            True if case exists
        """
        file_path = self.form_data_dir / f"{case_id}.json"
        return file_path.exists()

    def get_cases_by_catenda_topic(self, topic_id: str) -> List[Dict[str, Any]]:
        """
        Get cases linked to a Catenda topic.

        Args:
            topic_id: Catenda topic GUID

        Returns:
            List of case data (typically 0 or 1 case)
        """
        with self.lock:
            cases = []
            with open(self.saker_file, 'r', newline='', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    if row.get('catenda_topic_id') == topic_id:
                        # Get full JSON data
                        full_data = self.get_case(row['sak_id'])
                        if full_data:
                            cases.append(full_data)
            return cases

    def get_case_by_topic_id(self, topic_id: str) -> Optional[Dict[str, Any]]:
        """
        Get case metadata (CSV row) by Catenda topic ID.

        This is a lightweight lookup that returns only the CSV row,
        not the full JSON data. Use get_case() for full data.

        Args:
            topic_id: Catenda topic GUID

        Returns:
            Case metadata dict from CSV, or None if not found
        """
        with self.lock:
            with open(self.saker_file, 'r', newline='', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    if row.get('catenda_topic_id') == topic_id:
                        return row
            return None

    def update_case_status(self, case_id: str, status: str, modus: Optional[str] = None):
        """
        Public method to update status (wraps _update_sak_status).

        Args:
            case_id: Case identifier
            status: New status code
            modus: New modus (optional)
        """
        self._update_sak_status(case_id, status, modus)

    def log_historikk(self, sak_id: str, hendelse_type: str, beskrivelse: str):
        """
        Public method to log event (wraps _log_historikk).

        Args:
            sak_id: Case identifier
            hendelse_type: Event type
            beskrivelse: Event description
        """
        self._log_historikk(sak_id, hendelse_type, beskrivelse)

    # ========================================================================
    # Additional helper methods (not in BaseRepository)
    # ========================================================================

    def _update_sak_status(self, sak_id: str, status: str, modus: Optional[str] = None):
        """
        Update status and optionally modus in CSV.

        Args:
            sak_id: Case identifier
            status: New status code
            modus: New modus (optional)
        """
        with self.lock:
            rows = []
            updated = False
            fieldnames = self.SAKER_FIELDNAMES

            with open(self.saker_file, 'r', newline='', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                fieldnames = reader.fieldnames
                for row in reader:
                    if row['sak_id'] == sak_id:
                        if status:
                            row['status'] = status
                        if modus:
                            row['modus'] = modus
                        updated = True
                    rows.append(row)

            if updated:
                with open(self.saker_file, 'w', newline='', encoding='utf-8') as f:
                    writer = csv.DictWriter(f, fieldnames=fieldnames)
                    writer.writeheader()
                    writer.writerows(rows)
                logger.debug(f"Updated status for {sak_id}: status={status}, modus={modus}")

    def _log_historikk(self, sak_id: str, hendelse_type: str, beskrivelse: str):
        """
        Log event to historikk.csv.

        Args:
            sak_id: Case identifier
            hendelse_type: Event type
            beskrivelse: Event description
        """
        with open(self.historikk_file, 'a', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=self.HISTORIKK_FIELDNAMES)
            writer.writerow({
                'timestamp': datetime.now().isoformat(),
                'sak_id': sak_id,
                'hendelse_type': hendelse_type,
                'beskrivelse': beskrivelse
            })
        logger.debug(f"Logged event: {sak_id} - {hendelse_type}")

    def get_historikk(self, sak_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Get event history, optionally filtered by case.

        Args:
            sak_id: Optional case filter

        Returns:
            List of history entries
        """
        historikk = []
        with open(self.historikk_file, 'r', newline='', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                if sak_id is None or row.get('sak_id') == sak_id:
                    historikk.append(row)
        return historikk

    # ========================================================================
    # Backward-compatibility aliases (for routes that use old method names)
    # ========================================================================

    def save_form_data(self, sak_id: str, data: Dict[str, Any]):
        """
        Alias for update_case. Used by routes.

        Note: If case doesn't exist, this will save the JSON directly
        without creating a CSV entry (to match old DataManager behavior).
        """
        file_path = self.form_data_dir / f"{sak_id}.json"
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        # Sync status and modus to CSV if case exists
        sak_data = data.get('sak', {})
        if sak_data:
            status = sak_data.get('status')
            modus = sak_data.get('modus')
            if status or modus:
                self._update_sak_status(sak_id, status, modus)

        logger.debug(f"Saved form data for {sak_id}")

    def get_form_data(self, sak_id: str) -> Optional[Dict[str, Any]]:
        """Alias for get_case. Used by routes."""
        return self.get_case(sak_id)

    def get_sak_by_topic_id(self, topic_id: str) -> Optional[Dict[str, Any]]:
        """Alias for get_case_by_topic_id. Used by old code."""
        return self.get_case_by_topic_id(topic_id)

    def create_sak(self, sak_data: Dict[str, Any]) -> str:
        """Alias for create_case. Used by old code."""
        return self.create_case(sak_data)

    def update_sak_status(self, sak_id: str, status: str, modus: Optional[str] = None):
        """Alias for update_case_status. Used by old code."""
        self.update_case_status(sak_id, status, modus)
