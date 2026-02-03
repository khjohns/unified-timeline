"""
Lovdata Sync - Download and cache Norwegian laws and regulations.

Downloads bulk datasets from Lovdata's free Public Data API,
extracts XML files, and builds a SQLite FTS search index.

API: https://api.lovdata.no/v1/publicData/get/gjeldende-lover.tar.bz2
License: NLOD 2.0
"""

import bz2
import io
import os
import sqlite3
import tarfile
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Iterator

import httpx
from bs4 import BeautifulSoup

from utils.logger import get_logger

logger = get_logger(__name__)


# =============================================================================
# Configuration
# =============================================================================

LOVDATA_API_BASE = "https://api.lovdata.no/v1/publicData/get"

DATASETS = {
    "lover": "gjeldende-lover.tar.bz2",
    "forskrifter": "gjeldende-sentrale-forskrifter.tar.bz2",
}

# Default cache directory
DEFAULT_CACHE_DIR = Path(os.getenv("LOVDATA_CACHE_DIR", "/tmp/lovdata-cache"))


# =============================================================================
# Data Models
# =============================================================================

@dataclass
class LawDocument:
    """Parsed law document from XML."""
    dok_id: str  # e.g., "NL/lov/1992-07-03-93"
    ref_id: str  # e.g., "lov/1992-07-03-93"
    title: str
    short_title: str
    date_in_force: str | None
    ministry: str | None
    content: str  # Full text content
    xml_path: Path


@dataclass
class LawSection:
    """A specific section (paragraph) of a law."""
    section_id: str  # e.g., "3-9"
    title: str | None
    content: str
    address: str | None  # data-absoluteaddress


# =============================================================================
# Sync Service
# =============================================================================

class LovdataSyncService:
    """
    Service for syncing Lovdata datasets to local cache.

    Handles downloading, extracting, parsing and indexing of
    Norwegian laws and regulations.
    """

    def __init__(self, cache_dir: Path | None = None):
        """
        Initialize sync service.

        Args:
            cache_dir: Directory for cached data. Defaults to LOVDATA_CACHE_DIR env var.
        """
        self.cache_dir = cache_dir or DEFAULT_CACHE_DIR
        self.laws_dir = self.cache_dir / "lover"
        self.regulations_dir = self.cache_dir / "forskrifter"
        self.db_path = self.cache_dir / "lovdata.db"
        self.meta_path = self.cache_dir / "sync_meta.json"

        self._ensure_dirs()
        self._init_db()

    def _ensure_dirs(self) -> None:
        """Create cache directories if they don't exist."""
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.laws_dir.mkdir(exist_ok=True)
        self.regulations_dir.mkdir(exist_ok=True)

    def _init_db(self) -> None:
        """Initialize SQLite database with FTS index."""
        with sqlite3.connect(self.db_path) as conn:
            conn.executescript("""
                -- Main documents table
                CREATE TABLE IF NOT EXISTS documents (
                    dok_id TEXT PRIMARY KEY,
                    ref_id TEXT,
                    title TEXT,
                    short_title TEXT,
                    date_in_force TEXT,
                    ministry TEXT,
                    doc_type TEXT,  -- 'lov' or 'forskrift'
                    xml_path TEXT,
                    indexed_at TEXT
                );

                -- FTS index for full-text search
                CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
                    dok_id,
                    title,
                    short_title,
                    content,
                    content='documents',
                    content_rowid='rowid'
                );

                -- Sections table for paragraph lookup
                CREATE TABLE IF NOT EXISTS sections (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    dok_id TEXT,
                    section_id TEXT,
                    title TEXT,
                    content TEXT,
                    address TEXT,
                    FOREIGN KEY (dok_id) REFERENCES documents(dok_id)
                );

                -- Index for fast section lookup
                CREATE INDEX IF NOT EXISTS idx_sections_dok_section
                ON sections(dok_id, section_id);

                -- Sync metadata
                CREATE TABLE IF NOT EXISTS sync_meta (
                    dataset TEXT PRIMARY KEY,
                    last_modified TEXT,
                    synced_at TEXT,
                    file_count INTEGER
                );
            """)

    # -------------------------------------------------------------------------
    # Download & Extract
    # -------------------------------------------------------------------------

    def sync_all(self, force: bool = False) -> dict[str, int]:
        """
        Sync all datasets (laws and regulations).

        Args:
            force: Force re-download even if up-to-date

        Returns:
            Dict with counts of synced documents per dataset
        """
        results = {}

        for dataset_name, filename in DATASETS.items():
            try:
                count = self.sync_dataset(dataset_name, filename, force=force)
                results[dataset_name] = count
            except Exception as e:
                logger.error(f"Failed to sync {dataset_name}: {e}")
                results[dataset_name] = -1

        return results

    def sync_dataset(
        self,
        dataset_name: str,
        filename: str,
        force: bool = False
    ) -> int:
        """
        Sync a single dataset.

        Args:
            dataset_name: Name of dataset ('lover' or 'forskrifter')
            filename: Filename on API server
            force: Force re-download

        Returns:
            Number of documents indexed
        """
        url = f"{LOVDATA_API_BASE}/{filename}"
        target_dir = self.laws_dir if dataset_name == "lover" else self.regulations_dir

        logger.info(f"Syncing dataset: {dataset_name} from {url}")

        # Check if we need to download
        if not force:
            remote_modified = self._get_remote_last_modified(url)
            local_modified = self._get_local_last_modified(dataset_name)

            if remote_modified and local_modified and remote_modified <= local_modified:
                logger.info(f"Dataset {dataset_name} is up-to-date")
                return self._get_indexed_count(dataset_name)

        # Download and extract
        logger.info(f"Downloading {filename}...")
        archive_data = self._download_archive(url)

        logger.info(f"Extracting to {target_dir}...")
        file_count = self._extract_archive(archive_data, target_dir)

        logger.info(f"Extracted {file_count} files, indexing...")
        indexed_count = self._index_directory(target_dir, dataset_name)

        # Update sync metadata
        self._update_sync_meta(
            dataset_name,
            self._get_remote_last_modified(url),
            file_count
        )

        logger.info(f"Sync complete: {indexed_count} documents indexed")
        return indexed_count

    def _download_archive(self, url: str) -> bytes:
        """Download tar.bz2 archive from URL."""
        with httpx.Client(timeout=300.0) as client:
            response = client.get(url, follow_redirects=True)
            response.raise_for_status()
            return response.content

    def _extract_archive(self, data: bytes, target_dir: Path) -> int:
        """
        Extract tar.bz2 archive to target directory.

        Returns number of files extracted.
        """
        file_count = 0

        # Decompress bz2 and extract tar
        decompressed = bz2.decompress(data)

        with tarfile.open(fileobj=io.BytesIO(decompressed), mode='r') as tar:
            for member in tar.getmembers():
                if member.isfile() and member.name.endswith('.xml'):
                    # Extract to flat structure
                    member.name = Path(member.name).name
                    tar.extract(member, target_dir)
                    file_count += 1

        return file_count

    def _get_remote_last_modified(self, url: str) -> datetime | None:
        """Get Last-Modified header from remote URL."""
        try:
            with httpx.Client(timeout=30.0) as client:
                response = client.head(url, follow_redirects=True)
                if 'last-modified' in response.headers:
                    from email.utils import parsedate_to_datetime
                    return parsedate_to_datetime(response.headers['last-modified'])
        except Exception as e:
            logger.warning(f"Could not get Last-Modified for {url}: {e}")
        return None

    def _get_local_last_modified(self, dataset_name: str) -> datetime | None:
        """Get last sync time for dataset."""
        with sqlite3.connect(self.db_path) as conn:
            row = conn.execute(
                "SELECT last_modified FROM sync_meta WHERE dataset = ?",
                (dataset_name,)
            ).fetchone()
            if row and row[0]:
                return datetime.fromisoformat(row[0])
        return None

    def _update_sync_meta(
        self,
        dataset_name: str,
        last_modified: datetime | None,
        file_count: int
    ) -> None:
        """Update sync metadata in database."""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                INSERT OR REPLACE INTO sync_meta
                (dataset, last_modified, synced_at, file_count)
                VALUES (?, ?, ?, ?)
            """, (
                dataset_name,
                last_modified.isoformat() if last_modified else None,
                datetime.now().isoformat(),
                file_count
            ))

    def _get_indexed_count(self, dataset_name: str) -> int:
        """Get count of indexed documents for dataset."""
        doc_type = "lov" if dataset_name == "lover" else "forskrift"
        with sqlite3.connect(self.db_path) as conn:
            row = conn.execute(
                "SELECT COUNT(*) FROM documents WHERE doc_type = ?",
                (doc_type,)
            ).fetchone()
            return row[0] if row else 0

    # -------------------------------------------------------------------------
    # XML Parsing & Indexing
    # -------------------------------------------------------------------------

    def _index_directory(self, directory: Path, dataset_name: str) -> int:
        """
        Index all XML files in directory.

        Returns number of documents indexed.
        """
        doc_type = "lov" if dataset_name == "lover" else "forskrift"
        indexed = 0

        with sqlite3.connect(self.db_path) as conn:
            # Clear existing data for this type
            conn.execute("DELETE FROM sections WHERE dok_id IN (SELECT dok_id FROM documents WHERE doc_type = ?)", (doc_type,))
            conn.execute("DELETE FROM documents WHERE doc_type = ?", (doc_type,))

            for xml_path in directory.glob("*.xml"):
                try:
                    doc = self._parse_xml(xml_path)
                    if doc:
                        self._insert_document(conn, doc, doc_type)
                        indexed += 1
                except Exception as e:
                    logger.warning(f"Failed to parse {xml_path.name}: {e}")

            conn.commit()

            # Rebuild FTS index
            self._rebuild_fts_index(conn)

        return indexed

    def _parse_xml(self, xml_path: Path) -> LawDocument | None:
        """
        Parse Lovdata XML/HTML file.

        Uses BeautifulSoup for HTML5-compatible parsing.
        """
        try:
            with open(xml_path, 'r', encoding='utf-8') as f:
                content = f.read()

            soup = BeautifulSoup(content, 'html.parser')

            # Extract metadata from header
            header = soup.find('header', class_='documentHeader')
            if not header:
                header = soup.find('header')

            dok_id = self._extract_meta(header, 'dokid') or xml_path.stem
            ref_id = self._extract_meta(header, 'refid') or dok_id
            title = self._extract_meta(header, 'title') or ""
            short_title = self._extract_meta(header, 'titleShort') or ""
            date_in_force = self._extract_meta(header, 'dateInForce')
            ministry = self._extract_meta(header, 'ministry')

            # Extract main content
            main = soup.find('main', class_='documentBody')
            if not main:
                main = soup.find('main') or soup.find('body')

            full_content = main.get_text(separator='\n', strip=True) if main else ""

            return LawDocument(
                dok_id=dok_id,
                ref_id=ref_id,
                title=title,
                short_title=short_title,
                date_in_force=date_in_force,
                ministry=ministry,
                content=full_content,
                xml_path=xml_path
            )

        except Exception as e:
            logger.error(f"Parse error for {xml_path}: {e}")
            return None

    def _extract_meta(self, header, class_name: str) -> str | None:
        """Extract metadata value from header by class name."""
        if not header:
            return None

        # Find dt/dd pair with matching class
        dt = header.find('dt', class_=class_name)
        if dt:
            dd = dt.find_next_sibling('dd')
            if dd:
                return dd.get_text(strip=True)

        # Alternative: find dd directly
        dd = header.find('dd', class_=class_name)
        if dd:
            return dd.get_text(strip=True)

        return None

    def _insert_document(
        self,
        conn: sqlite3.Connection,
        doc: LawDocument,
        doc_type: str
    ) -> None:
        """Insert document and its sections into database."""
        # Insert main document
        conn.execute("""
            INSERT OR REPLACE INTO documents
            (dok_id, ref_id, title, short_title, date_in_force, ministry, doc_type, xml_path, indexed_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            doc.dok_id,
            doc.ref_id,
            doc.title,
            doc.short_title,
            doc.date_in_force,
            doc.ministry,
            doc_type,
            str(doc.xml_path),
            datetime.now().isoformat()
        ))

        # Parse and insert sections
        sections = self._parse_sections(doc.xml_path)
        for section in sections:
            conn.execute("""
                INSERT INTO sections (dok_id, section_id, title, content, address)
                VALUES (?, ?, ?, ?, ?)
            """, (
                doc.dok_id,
                section.section_id,
                section.title,
                section.content,
                section.address
            ))

    def _parse_sections(self, xml_path: Path) -> list[LawSection]:
        """Parse all sections (paragraphs) from XML file."""
        sections = []

        try:
            with open(xml_path, 'r', encoding='utf-8') as f:
                soup = BeautifulSoup(f.read(), 'html.parser')

            # Find all legalArticle elements (paragraphs)
            for article in soup.find_all('article', class_='legalArticle'):
                # Get section ID from legalArticleValue
                value_span = article.find('span', class_='legalArticleValue')
                if not value_span:
                    continue

                section_id = value_span.get_text(strip=True)
                # Clean up section ID (remove § and whitespace)
                section_id = section_id.replace('§', '').strip()

                # Get optional title
                title_span = article.find('span', class_='legalArticleTitle')
                title = title_span.get_text(strip=True) if title_span else None

                # Get content (all legalP elements)
                content_parts = []
                for ledd in article.find_all('article', class_='legalP'):
                    content_parts.append(ledd.get_text(strip=True))

                # Also get direct text content
                if not content_parts:
                    content_parts.append(article.get_text(strip=True))

                # Get absolute address
                address = article.get('data-absoluteaddress')

                sections.append(LawSection(
                    section_id=section_id,
                    title=title,
                    content='\n\n'.join(content_parts),
                    address=address
                ))

        except Exception as e:
            logger.warning(f"Failed to parse sections from {xml_path}: {e}")

        return sections

    def _rebuild_fts_index(self, conn: sqlite3.Connection) -> None:
        """Rebuild full-text search index."""
        conn.execute("DELETE FROM documents_fts")
        conn.execute("""
            INSERT INTO documents_fts (dok_id, title, short_title, content)
            SELECT
                d.dok_id,
                d.title,
                d.short_title,
                (SELECT GROUP_CONCAT(content, ' ') FROM sections WHERE dok_id = d.dok_id)
            FROM documents d
        """)

    # -------------------------------------------------------------------------
    # Query Methods
    # -------------------------------------------------------------------------

    def get_document(self, dok_id: str) -> dict | None:
        """
        Get document by ID.

        Args:
            dok_id: Document ID (e.g., "NL/lov/1992-07-03-93" or "LOV-1992-07-03-93")
        """
        # Normalize ID format
        normalized = self._normalize_id(dok_id)

        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            row = conn.execute(
                "SELECT * FROM documents WHERE dok_id = ? OR ref_id = ?",
                (normalized, normalized)
            ).fetchone()

            if row:
                return dict(row)
        return None

    def get_section(self, dok_id: str, section_id: str) -> LawSection | None:
        """
        Get specific section from a document.

        Args:
            dok_id: Document ID
            section_id: Section number (e.g., "3-9")
        """
        normalized = self._normalize_id(dok_id)
        section_id = section_id.replace('§', '').strip()

        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row

            # First find the document
            doc = conn.execute(
                "SELECT dok_id FROM documents WHERE dok_id = ? OR ref_id = ? OR short_title = ?",
                (normalized, normalized, dok_id.lower())
            ).fetchone()

            if not doc:
                return None

            # Then find the section
            row = conn.execute(
                "SELECT * FROM sections WHERE dok_id = ? AND section_id = ?",
                (doc['dok_id'], section_id)
            ).fetchone()

            if row:
                return LawSection(
                    section_id=row['section_id'],
                    title=row['title'],
                    content=row['content'],
                    address=row['address']
                )
        return None

    def search(self, query: str, limit: int = 10) -> list[dict]:
        """
        Full-text search across all documents.

        Args:
            query: Search query
            limit: Maximum results

        Returns:
            List of matching documents with snippets
        """
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row

            # FTS5 search
            rows = conn.execute("""
                SELECT
                    d.dok_id,
                    d.title,
                    d.short_title,
                    d.doc_type,
                    snippet(documents_fts, 3, '<mark>', '</mark>', '...', 32) as snippet
                FROM documents_fts
                JOIN documents d ON d.dok_id = documents_fts.dok_id
                WHERE documents_fts MATCH ?
                ORDER BY rank
                LIMIT ?
            """, (query, limit)).fetchall()

            return [dict(row) for row in rows]

    def list_documents(self, doc_type: str | None = None) -> list[dict]:
        """
        List all indexed documents.

        Args:
            doc_type: Optional filter ('lov' or 'forskrift')
        """
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row

            if doc_type:
                rows = conn.execute(
                    "SELECT dok_id, title, short_title, doc_type FROM documents WHERE doc_type = ? ORDER BY short_title",
                    (doc_type,)
                ).fetchall()
            else:
                rows = conn.execute(
                    "SELECT dok_id, title, short_title, doc_type FROM documents ORDER BY doc_type, short_title"
                ).fetchall()

            return [dict(row) for row in rows]

    def get_sync_status(self) -> dict:
        """Get sync status for all datasets."""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute("SELECT * FROM sync_meta").fetchall()

            status = {}
            for row in rows:
                status[row['dataset']] = {
                    'last_modified': row['last_modified'],
                    'synced_at': row['synced_at'],
                    'file_count': row['file_count']
                }
            return status

    def _normalize_id(self, id_str: str) -> str:
        """Normalize document ID to match database format."""
        # Handle various ID formats
        id_upper = id_str.upper()

        if id_upper.startswith("LOV-"):
            # Convert LOV-1992-07-03-93 to lov/1992-07-03-93
            return "lov/" + id_str[4:].lower()
        elif id_upper.startswith("FOR-"):
            return "forskrift/" + id_str[4:].lower()
        elif id_upper.startswith("NL/"):
            return id_str[3:]  # Remove NL/ prefix

        return id_str.lower()


# =============================================================================
# CLI Interface
# =============================================================================

def sync_cli():
    """Command-line interface for syncing Lovdata."""
    import argparse

    parser = argparse.ArgumentParser(description="Sync Lovdata to local cache")
    parser.add_argument("--force", "-f", action="store_true", help="Force re-download")
    parser.add_argument("--cache-dir", "-c", type=Path, help="Cache directory")
    parser.add_argument("--dataset", "-d", choices=["lover", "forskrifter"], help="Sync only specific dataset")

    args = parser.parse_args()

    service = LovdataSyncService(cache_dir=args.cache_dir)

    if args.dataset:
        filename = DATASETS[args.dataset]
        count = service.sync_dataset(args.dataset, filename, force=args.force)
        print(f"Synced {args.dataset}: {count} documents")
    else:
        results = service.sync_all(force=args.force)
        for dataset, count in results.items():
            print(f"Synced {dataset}: {count} documents")


if __name__ == "__main__":
    sync_cli()
