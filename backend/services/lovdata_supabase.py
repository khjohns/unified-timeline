"""
Lovdata Supabase Service - Persistent cache using Supabase PostgreSQL.

Replaces SQLite with Supabase for cloud deployment compatibility.
Uses PostgreSQL full-text search for efficient querying.

Requires:
    - SUPABASE_URL and SUPABASE_SECRET_KEY environment variables
    - Migration: supabase/migrations/20260203_create_lovdata_tables.sql

Usage:
    service = LovdataSupabaseService()
    service.sync_all()  # Download and index from Lovdata API
    results = service.search("erstatning bolig")
"""

import bz2
import io
import os
import tarfile
from dataclasses import dataclass
from datetime import datetime

import httpx
from bs4 import BeautifulSoup

from utils.logger import get_logger

logger = get_logger(__name__)


# =============================================================================
# Supabase Client
# =============================================================================

try:
    from supabase import Client, create_client
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False
    Client = None


# =============================================================================
# Configuration
# =============================================================================

LOVDATA_API_BASE = "https://api.lovdata.no/v1/publicData/get"

DATASETS = {
    "lover": "gjeldende-lover.tar.bz2",
    "forskrifter": "gjeldende-sentrale-forskrifter.tar.bz2",
}

# Token estimation: ~3.5 chars per token for Norwegian text
CHARS_PER_TOKEN = 3.5
DEFAULT_MAX_TOKENS = 2000  # Default max tokens for responses
LARGE_RESPONSE_THRESHOLD = 5000  # Warn if response exceeds this


# =============================================================================
# Data Models
# =============================================================================

@dataclass
class LawDocument:
    """Parsed law document from XML."""
    dok_id: str
    ref_id: str
    title: str
    short_title: str
    date_in_force: str | None
    ministry: str | None
    content: str


@dataclass
class LawSection:
    """A specific section (paragraph) of a law."""
    dok_id: str
    section_id: str
    title: str | None
    content: str
    address: str | None
    char_count: int = 0

    @property
    def estimated_tokens(self) -> int:
        """Estimate token count for this section."""
        return int(len(self.content) / CHARS_PER_TOKEN)


@dataclass
class SearchResult:
    """Search result with token-awareness."""
    dok_id: str
    title: str
    short_title: str
    doc_type: str
    snippet: str
    rank: float

    @property
    def estimated_tokens(self) -> int:
        """Estimate token count for this result."""
        total = len(self.title or '') + len(self.snippet or '')
        return int(total / CHARS_PER_TOKEN)


# =============================================================================
# Supabase Service
# =============================================================================

class LovdataSupabaseService:
    """
    Lovdata service using Supabase PostgreSQL for persistent storage.

    Advantages over SQLite:
    - Persistent across deploys (Render, Vercel, etc.)
    - Shared cache across instances
    - PostgreSQL full-text search with Norwegian stemming
    - No local disk requirements
    """

    def __init__(self, url: str | None = None, key: str | None = None):
        """
        Initialize Supabase service.

        Args:
            url: Supabase project URL (defaults to SUPABASE_URL env var)
            key: Supabase service role key (defaults to SUPABASE_SECRET_KEY)
        """
        if not SUPABASE_AVAILABLE:
            raise ImportError("Supabase client not installed. Run: pip install supabase")

        self.url = url or os.environ.get("SUPABASE_URL")
        self.key = key or os.environ.get("SUPABASE_SECRET_KEY") or os.environ.get("SUPABASE_KEY")

        if not self.url or not self.key:
            raise ValueError(
                "Supabase credentials required. "
                "Set SUPABASE_URL and SUPABASE_SECRET_KEY environment variables."
            )

        self.client: Client = create_client(self.url, self.key)
        logger.info("LovdataSupabaseService initialized")

    # -------------------------------------------------------------------------
    # Sync Methods
    # -------------------------------------------------------------------------

    def sync_all(self, force: bool = False) -> dict[str, int]:
        """
        Sync all datasets from Lovdata API.

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

    def sync_dataset(self, dataset_name: str, filename: str, force: bool = False) -> int:
        """Sync a single dataset."""
        url = f"{LOVDATA_API_BASE}/{filename}"
        doc_type = "lov" if dataset_name == "lover" else "forskrift"

        logger.info(f"Syncing dataset: {dataset_name}")

        # Check if we need to sync
        if not force:
            status = self._get_sync_status(dataset_name)
            if status and status.get('status') == 'idle':
                remote_modified = self._get_remote_last_modified(url)
                local_modified = status.get('last_modified')
                if remote_modified and local_modified:
                    if datetime.fromisoformat(local_modified.replace('Z', '+00:00')) >= remote_modified:
                        logger.info(f"Dataset {dataset_name} is up-to-date")
                        return status.get('file_count', 0)

        # Update sync status
        self._set_sync_status(dataset_name, 'syncing')

        try:
            # Download and extract
            logger.info(f"Downloading {filename}...")
            archive_data = self._download_archive(url)

            logger.info("Extracting and parsing XML files...")
            documents, sections = self._extract_and_parse(archive_data, doc_type)

            logger.info(f"Inserting {len(documents)} documents into Supabase...")
            self._upsert_documents(documents, doc_type)
            self._upsert_sections(sections)

            # Update sync metadata
            self._set_sync_status(
                dataset_name,
                'idle',
                last_modified=self._get_remote_last_modified(url),
                file_count=len(documents)
            )

            logger.info(f"Sync complete: {len(documents)} documents")
            return len(documents)

        except Exception:
            self._set_sync_status(dataset_name, 'error')
            raise

    def _download_archive(self, url: str) -> bytes:
        """Download tar.bz2 archive."""
        with httpx.Client(timeout=300.0) as client:
            response = client.get(url, follow_redirects=True)
            response.raise_for_status()
            return response.content

    def _extract_and_parse(
        self,
        data: bytes,
        doc_type: str
    ) -> tuple[list[dict], list[dict]]:
        """Extract archive and parse XML files."""
        documents = []
        sections = []

        decompressed = bz2.decompress(data)

        with tarfile.open(fileobj=io.BytesIO(decompressed), mode='r') as tar:
            for member in tar.getmembers():
                if not member.isfile() or not member.name.endswith('.xml'):
                    continue

                try:
                    f = tar.extractfile(member)
                    if f is None:
                        continue

                    content = f.read().decode('utf-8')
                    doc, secs = self._parse_xml(content, doc_type)

                    if doc:
                        documents.append(doc)
                        sections.extend(secs)

                except Exception as e:
                    logger.warning(f"Failed to parse {member.name}: {e}")

        return documents, sections

    def _parse_xml(self, content: str, doc_type: str) -> tuple[dict | None, list[dict]]:
        """Parse XML/HTML content."""
        try:
            soup = BeautifulSoup(content, 'html.parser')

            header = soup.find('header', class_='documentHeader') or soup.find('header')

            dok_id = self._extract_meta(header, 'dokid')
            if not dok_id:
                return None, []

            # Normalize dok_id
            if dok_id.startswith('NL/'):
                dok_id = dok_id[3:]

            doc = {
                'dok_id': dok_id,
                'ref_id': self._extract_meta(header, 'refid') or dok_id,
                'title': self._extract_meta(header, 'title') or '',
                'short_title': self._extract_meta(header, 'titleShort') or '',
                'date_in_force': self._extract_meta(header, 'dateInForce'),
                'ministry': self._extract_meta(header, 'ministry'),
                'doc_type': doc_type,
            }

            # Parse sections
            sections = []
            for article in soup.find_all('article', class_='legalArticle'):
                value_span = article.find('span', class_='legalArticleValue')
                if not value_span:
                    continue

                section_id = value_span.get_text(strip=True).replace('§', '').strip()

                title_span = article.find('span', class_='legalArticleTitle')
                title = title_span.get_text(strip=True) if title_span else None

                content_parts = []
                for ledd in article.find_all('article', class_='legalP'):
                    content_parts.append(ledd.get_text(strip=True))

                if not content_parts:
                    content_parts.append(article.get_text(strip=True))

                sections.append({
                    'dok_id': dok_id,
                    'section_id': section_id,
                    'title': title,
                    'content': '\n\n'.join(content_parts),
                    'address': article.get('data-absoluteaddress'),
                })

            return doc, sections

        except Exception as e:
            logger.error(f"Parse error: {e}")
            return None, []

    def _extract_meta(self, header, class_name: str) -> str | None:
        """Extract metadata value from header."""
        if not header:
            return None

        dt = header.find('dt', class_=class_name)
        if dt:
            dd = dt.find_next_sibling('dd')
            if dd:
                return dd.get_text(strip=True)

        dd = header.find('dd', class_=class_name)
        return dd.get_text(strip=True) if dd else None

    def _upsert_documents(self, documents: list[dict], doc_type: str) -> None:
        """Insert or update documents in Supabase."""
        if not documents:
            return

        # Delete existing documents of this type first
        self.client.table('lovdata_documents').delete().eq('doc_type', doc_type).execute()

        # Insert in batches
        batch_size = 100
        for i in range(0, len(documents), batch_size):
            batch = documents[i:i + batch_size]
            self.client.table('lovdata_documents').insert(batch).execute()

    def _upsert_sections(self, sections: list[dict]) -> None:
        """Insert sections in Supabase."""
        if not sections:
            return

        # Get unique dok_ids
        dok_ids = list(set(s['dok_id'] for s in sections))

        # Delete existing sections for these documents
        for dok_id in dok_ids:
            self.client.table('lovdata_sections').delete().eq('dok_id', dok_id).execute()

        # Insert in batches
        batch_size = 500
        for i in range(0, len(sections), batch_size):
            batch = sections[i:i + batch_size]
            self.client.table('lovdata_sections').insert(batch).execute()

    def _get_remote_last_modified(self, url: str) -> datetime | None:
        """Get Last-Modified header from URL."""
        try:
            with httpx.Client(timeout=30.0) as client:
                response = client.head(url, follow_redirects=True)
                if 'last-modified' in response.headers:
                    from email.utils import parsedate_to_datetime
                    return parsedate_to_datetime(response.headers['last-modified'])
        except Exception as e:
            logger.warning(f"Could not get Last-Modified: {e}")
        return None

    def _get_sync_status(self, dataset: str) -> dict | None:
        """Get sync status from database."""
        try:
            result = self.client.table('lovdata_sync_meta').select('*').eq('dataset', dataset).execute()
            return result.data[0] if result.data else None
        except Exception:
            return None

    def _set_sync_status(
        self,
        dataset: str,
        status: str,
        last_modified: datetime | None = None,
        file_count: int | None = None
    ) -> None:
        """Update sync status in database."""
        data = {
            'dataset': dataset,
            'status': status,
            'synced_at': datetime.now().isoformat(),
        }
        if last_modified:
            data['last_modified'] = last_modified.isoformat()
        if file_count is not None:
            data['file_count'] = file_count

        self.client.table('lovdata_sync_meta').upsert(data).execute()

    # -------------------------------------------------------------------------
    # Query Methods with Token Awareness
    # -------------------------------------------------------------------------

    def get_section(
        self,
        dok_id: str,
        section_id: str,
        max_tokens: int | None = None
    ) -> LawSection | None:
        """
        Get a specific section with optional token limit.

        Args:
            dok_id: Document ID or short title
            section_id: Section number (e.g., "3-9")
            max_tokens: Maximum tokens to return (truncates if exceeded)

        Returns:
            LawSection or None if not found
        """
        section_id = section_id.replace('§', '').strip()

        # Try to find document first
        doc = self._find_document(dok_id)
        if not doc:
            return None

        # Get section
        result = self.client.table('lovdata_sections').select('*').eq(
            'dok_id', doc['dok_id']
        ).eq('section_id', section_id).execute()

        if not result.data:
            return None

        row = result.data[0]
        content = row['content']
        char_count = len(content)

        # Apply token limit if specified
        if max_tokens:
            max_chars = int(max_tokens * CHARS_PER_TOKEN)
            if char_count > max_chars:
                content = content[:max_chars] + f"\n\n... [Avkortet: {char_count} tegn totalt, vis mer med høyere token-grense]"

        return LawSection(
            dok_id=row['dok_id'],
            section_id=row['section_id'],
            title=row.get('title'),
            content=content,
            address=row.get('address'),
            char_count=char_count
        )

    def get_section_size(self, dok_id: str, section_id: str) -> dict | None:
        """
        Get section size info without content.

        Useful for Claude to decide whether to fetch full content.

        Returns:
            Dict with char_count and estimated_tokens, or None
        """
        section_id = section_id.replace('§', '').strip()

        doc = self._find_document(dok_id)
        if not doc:
            return None

        result = self.client.table('lovdata_sections').select(
            'char_count'
        ).eq('dok_id', doc['dok_id']).eq('section_id', section_id).execute()

        if not result.data:
            return None

        char_count = result.data[0]['char_count'] or 0
        return {
            'char_count': char_count,
            'estimated_tokens': int(char_count / CHARS_PER_TOKEN)
        }

    def search(
        self,
        query: str,
        limit: int = 10,
        max_tokens_per_result: int = 100
    ) -> list[SearchResult]:
        """
        Full-text search with token-aware snippets.

        Args:
            query: Search query
            limit: Maximum number of results
            max_tokens_per_result: Maximum tokens per snippet

        Returns:
            List of SearchResult objects
        """
        # Use PostgreSQL function for search
        result = self.client.rpc('search_lovdata', {
            'query_text': query,
            'max_results': limit
        }).execute()

        if not result.data:
            return []

        results = []
        for row in result.data:
            snippet = row.get('snippet', '')

            # Truncate snippet if needed
            max_chars = int(max_tokens_per_result * CHARS_PER_TOKEN)
            if len(snippet) > max_chars:
                snippet = snippet[:max_chars] + '...'

            results.append(SearchResult(
                dok_id=row['dok_id'],
                title=row.get('title', ''),
                short_title=row.get('short_title', ''),
                doc_type=row.get('doc_type', 'lov'),
                snippet=snippet,
                rank=row.get('rank', 0.0)
            ))

        return results

    def get_document(self, dok_id: str) -> dict | None:
        """Get document metadata by ID."""
        return self._find_document(dok_id)

    def get_sync_status(self) -> dict:
        """Get sync status for all datasets."""
        try:
            result = self.client.table('lovdata_sync_meta').select('*').execute()
            return {row['dataset']: row for row in result.data} if result.data else {}
        except Exception:
            return {}

    def is_synced(self) -> bool:
        """Check if any data has been synced."""
        status = self.get_sync_status()
        return len(status) > 0 and any(s.get('file_count', 0) > 0 for s in status.values())

    def _find_document(self, identifier: str) -> dict | None:
        """Find document by ID or short title."""
        # Normalize identifier
        normalized = identifier.lower().replace('lov-', 'lov/').replace('for-', 'forskrift/')

        # Try exact match on dok_id
        result = self.client.table('lovdata_documents').select('*').eq('dok_id', normalized).execute()
        if result.data:
            return result.data[0]

        # Try short_title match
        result = self.client.table('lovdata_documents').select('*').ilike(
            'short_title', f'%{identifier}%'
        ).execute()
        if result.data:
            return result.data[0]

        return None


# =============================================================================
# Token Estimation Utilities
# =============================================================================

def estimate_tokens(text: str) -> int:
    """Estimate token count for text."""
    return int(len(text) / CHARS_PER_TOKEN)


def format_size_warning(char_count: int, threshold: int = LARGE_RESPONSE_THRESHOLD) -> str | None:
    """Generate warning message for large responses."""
    estimated = int(char_count / CHARS_PER_TOKEN)
    if estimated > threshold:
        return (
            f"**Advarsel:** Denne teksten er ca. {estimated:,} tokens. "
            f"Vil du at jeg skal vise hele, eller bare et sammendrag?"
        )
    return None
