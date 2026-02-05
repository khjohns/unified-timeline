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

from lib.supabase import safe_execute, with_retry  # noqa: E402, I001


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
    section_id: str | None = None

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
        """
        Sync a single dataset with streaming/chunked processing.

        Memory-efficient: processes files in batches to avoid loading everything
        into memory at once. Suitable for Render's 512MB free tier.
        """
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
            # Stream download to temp file to avoid memory issues
            logger.info(f"Downloading {filename}...")
            total_docs = self._stream_sync(url, doc_type)

            # Update sync metadata
            self._set_sync_status(
                dataset_name,
                'idle',
                last_modified=self._get_remote_last_modified(url),
                file_count=total_docs
            )

            logger.info(f"Sync complete: {total_docs} documents")
            return total_docs

        except Exception:
            self._set_sync_status(dataset_name, 'error')
            raise

    def _stream_sync(self, url: str, doc_type: str) -> int:
        """
        Stream download and process in chunks.

        Downloads to temp file, then processes XML files in batches
        to minimize memory usage.
        """
        import tempfile

        total_docs = 0
        batch_size = 50  # Process 50 documents at a time
        doc_batch = []
        section_batch = []
        seen_dok_ids = set()  # Track for deduplication

        # Download to temp file (streaming)
        with tempfile.NamedTemporaryFile(suffix='.tar.bz2', delete=True) as tmp:
            logger.info("Streaming download to temp file...")
            with httpx.Client(timeout=300.0) as client:
                with client.stream('GET', url, follow_redirects=True) as response:
                    response.raise_for_status()
                    for chunk in response.iter_bytes(chunk_size=65536):
                        tmp.write(chunk)
            tmp.flush()
            tmp.seek(0)

            logger.info("Processing XML files in batches...")

            # Open tar directly with bz2 decompression (streaming)
            with tarfile.open(fileobj=tmp, mode='r:bz2') as tar:
                for member in tar:
                    if not member.isfile() or not member.name.endswith('.xml'):
                        continue

                    try:
                        f = tar.extractfile(member)
                        if f is None:
                            continue

                        content = f.read().decode('utf-8')
                        doc, secs = self._parse_xml(content, doc_type)

                        if doc:
                            dok_id = doc['dok_id']
                            # Deduplicate in-memory
                            if dok_id in seen_dok_ids:
                                continue
                            seen_dok_ids.add(dok_id)

                            doc_batch.append(doc)
                            section_batch.extend(secs)
                            total_docs += 1

                            # Flush batch when full
                            if len(doc_batch) >= batch_size:
                                self._flush_batch(doc_batch, section_batch, doc_type)
                                doc_batch = []
                                section_batch = []
                                logger.info(f"Processed {total_docs} documents...")

                    except Exception as e:
                        logger.warning(f"Failed to parse {member.name}: {e}")

            # Flush remaining
            if doc_batch:
                self._flush_batch(doc_batch, section_batch, doc_type)
                logger.info(f"Processed {total_docs} documents (final batch)")

        return total_docs

    @with_retry()
    def _flush_batch(self, documents: list[dict], sections: list[dict], doc_type: str) -> None:
        """Insert a batch of documents and sections."""
        if documents:
            self.client.table('lovdata_documents').upsert(
                documents,
                on_conflict='dok_id'
            ).execute()

        if sections:
            # Deduplicate sections within batch
            seen = {}
            for sec in sections:
                key = (sec['dok_id'], sec['section_id'])
                seen[key] = sec
            unique_sections = list(seen.values())

            self.client.table('lovdata_sections').upsert(
                unique_sections,
                on_conflict='dok_id,section_id'
            ).execute()

    def _parse_xml(self, content: str, doc_type: str) -> tuple[dict | None, list[dict]]:
        """
        Parse XML/HTML content from Lovdata.

        Handles various XML structures used in Norwegian law documents.
        """
        try:
            soup = BeautifulSoup(content, 'html.parser')

            header = soup.find('header', class_='documentHeader') or soup.find('header')

            dok_id = self._extract_meta(header, 'dokid')
            if not dok_id:
                return None, []

            # Normalize dok_id - remove all known prefixes
            for prefix in ('NL/', 'SF/', 'LTI/', 'NLE/', 'NLO/'):
                if dok_id.startswith(prefix):
                    dok_id = dok_id[len(prefix):]
                    break

            doc = {
                'dok_id': dok_id,
                'ref_id': self._extract_meta(header, 'refid') or dok_id,
                'title': self._extract_meta(header, 'title') or '',
                'short_title': self._extract_meta(header, 'titleShort') or '',
                'date_in_force': self._parse_date(self._extract_meta(header, 'dateInForce')),
                'ministry': self._extract_meta(header, 'ministry'),
                'doc_type': doc_type,
            }

            # Parse sections - try multiple strategies
            sections = self._extract_sections(soup, dok_id)

            return doc, sections

        except Exception as e:
            logger.error(f"Parse error for {dok_id if 'dok_id' in dir() else 'unknown'}: {e}")
            return None, []

    def _extract_sections(self, soup: BeautifulSoup, dok_id: str) -> list[dict]:
        """
        Extract sections (paragraphs) from parsed HTML.

        Tries multiple extraction strategies to handle varying XML structures.
        """
        sections = []
        seen_ids = set()

        # Strategy 1: Find all legalArticle elements (standard structure)
        for article in soup.find_all('article', class_='legalArticle'):
            section = self._parse_legal_article(article, dok_id)
            if section and section['section_id'] not in seen_ids:
                sections.append(section)
                seen_ids.add(section['section_id'])

        # Strategy 2: Find elements with data-absoluteaddress containing /paragraf/
        if not sections:
            for elem in soup.find_all(attrs={'data-absoluteaddress': True}):
                addr = elem.get('data-absoluteaddress', '')
                if '/paragraf/' in addr and '/ledd/' not in addr:
                    section = self._parse_element_by_address(elem, dok_id, addr)
                    if section and section['section_id'] not in seen_ids:
                        sections.append(section)
                        seen_ids.add(section['section_id'])

        # Strategy 3: Look for headers with § symbol
        if not sections:
            for header in soup.find_all(['h2', 'h3', 'h4', 'h5', 'h6']):
                text = header.get_text()
                if '§' in text:
                    section = self._parse_header_section(header, dok_id)
                    if section and section['section_id'] not in seen_ids:
                        sections.append(section)
                        seen_ids.add(section['section_id'])

        # Strategy 4: Extract numberedLegalP as searchable sub-sections
        # These are "nummer" (§ 4-2 nr 1, nr 2, etc.) which are between paragraf and ledd
        import re
        for numbered in soup.find_all('article', class_='numberedLegalP'):
            parent_article = numbered.find_parent('article', class_='legalArticle')
            if not parent_article:
                continue

            # Get parent section ID
            parent_value = parent_article.find('span', class_='legalArticleValue')
            if not parent_value:
                continue

            parent_id = parent_value.get_text(strip=True).replace('§', '').strip()
            parent_id = ' '.join(parent_id.split())

            # Get number ID from the numbered element header
            num_header = numbered.find(['h2', 'h3', 'h4', 'h5', 'h6'])
            if num_header:
                num_text = num_header.get_text(strip=True)
                # Extract "nr 1", "nr 2", etc.
                nr_match = re.search(r'nr\.?\s*(\d+)', num_text, re.I)
                if nr_match:
                    sub_id = f"{parent_id} nr {nr_match.group(1)}"
                    content = numbered.get_text(strip=True)
                    if sub_id not in seen_ids and content:
                        sections.append({
                            'dok_id': dok_id,
                            'section_id': sub_id,
                            'title': num_text,
                            'content': content,
                            'address': numbered.get('data-absoluteaddress'),
                        })
                        seen_ids.add(sub_id)

        return sections

    def _parse_legal_article(self, article, dok_id: str) -> dict | None:
        """Parse a legalArticle element."""
        # Find section ID from legalArticleValue span
        value_span = article.find('span', class_='legalArticleValue')
        if not value_span:
            # Try finding in header
            header = article.find(['h2', 'h3', 'h4', 'h5', 'h6'], class_='legalArticleHeader')
            if header:
                value_span = header.find('span', class_='legalArticleValue')

        if not value_span:
            return None

        section_id = value_span.get_text(strip=True)
        # Normalize section_id: remove § and extra whitespace
        section_id = section_id.replace('§', '').strip()
        # Handle "§ 1-1" format -> "1-1"
        section_id = ' '.join(section_id.split())

        if not section_id:
            return None

        # Get title
        title_span = article.find('span', class_='legalArticleTitle')
        title = title_span.get_text(strip=True) if title_span else None

        # Get content from legalP elements (direct children only to avoid duplicates)
        content_parts = []

        # Legal paragraph classes to extract (per Lovdata XML documentation)
        # Includes: legalP, numberedLegalP, listLegalP, marginIdLegalP
        legal_p_classes = {'legalP', 'numberedLegalP', 'listLegalP', 'marginIdLegalP'}

        # Find direct legal paragraph children
        for child in article.children:
            if hasattr(child, 'get') and child.get('class'):
                classes = child.get('class', [])
                if isinstance(classes, str):
                    classes = [classes]
                class_set = set(classes)
                class_str = ' '.join(classes)

                # Match all legalP variants except footnote-related
                if class_set & legal_p_classes and 'footnote' not in class_str.lower():
                    content_parts.append(child.get_text(strip=True))

        # Also include leddfortsettelse (paragraph continuations after lists)
        for cont in article.find_all('p', class_='leddfortsettelse'):
            text = cont.get_text(strip=True)
            if text and text not in content_parts:
                content_parts.append(text)

        # Fallback: get all text from legalP descendants
        if not content_parts:
            for ledd in article.find_all('article', class_='legalP', recursive=True):
                text = ledd.get_text(strip=True)
                if text and text not in content_parts:
                    content_parts.append(text)

        # Last fallback: get all text from article (without mutating the tree)
        if not content_parts:
            header = article.find(['h2', 'h3', 'h4', 'h5', 'h6'])
            all_text = article.get_text(strip=True)
            if header:
                header_text = header.get_text(strip=True)
                # Remove header text from beginning if present
                if all_text.startswith(header_text):
                    text = all_text[len(header_text):].strip()
                else:
                    text = all_text
            else:
                text = all_text
            if text:
                content_parts.append(text)

        if not content_parts:
            return None

        return {
            'dok_id': dok_id,
            'section_id': section_id,
            'title': title,
            'content': '\n\n'.join(content_parts),
            'address': article.get('data-absoluteaddress'),
        }

    def _parse_element_by_address(self, elem, dok_id: str, addr: str) -> dict | None:
        """Parse element using data-absoluteaddress."""
        import re

        # Extract section number from address like /kapittel/1/paragraf/5/
        # Handle various formats: /paragraf/1/, /paragraf/3-9/, /paragraf/14-9/
        # Note: Lovdata uses ordinal numbering, so we can't directly derive section ID
        match = re.search(r'/paragraf/([\w-]+)/', addr)
        if not match:
            return None

        section_num = match.group(1)

        # Get content
        content = elem.get_text(strip=True)
        if not content:
            return None

        return {
            'dok_id': dok_id,
            'section_id': section_num,
            'title': None,
            'content': content,
            'address': addr,
        }

    def _parse_header_section(self, header, dok_id: str) -> dict | None:
        """Parse section from header element containing §."""
        import re

        text = header.get_text(strip=True)

        # Try to extract section number
        match = re.search(r'§\s*(\d+(?:-\d+)?(?:\s*[a-z])?)', text)
        if not match:
            return None

        section_id = match.group(1).strip()

        # Get content from following siblings
        content_parts = []
        for sibling in header.find_next_siblings():
            if sibling.name in ['h2', 'h3', 'h4', 'h5', 'h6']:
                break  # Stop at next header
            if sibling.name == 'article':
                content_parts.append(sibling.get_text(strip=True))

        if not content_parts:
            return None

        return {
            'dok_id': dok_id,
            'section_id': section_id,
            'title': None,
            'content': '\n\n'.join(content_parts),
            'address': None,
        }

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

    def _parse_date(self, date_str: str | None) -> str | None:
        """
        Parse date string, handling multiple dates.

        Some laws have multiple dates like "1965-07-01, 1967-04-23".
        We take the first valid date.
        """
        if not date_str:
            return None

        # Handle multiple dates separated by comma
        first_date = date_str.split(',')[0].strip()

        # Validate it looks like a date (YYYY-MM-DD)
        if len(first_date) >= 10 and first_date[4] == '-' and first_date[7] == '-':
            return first_date[:10]  # Take only YYYY-MM-DD part

        return None

    def _upsert_documents(self, documents: list[dict], doc_type: str) -> None:
        """Insert or update documents in Supabase using true upsert."""
        if not documents:
            return

        # Deduplicate by dok_id (keep last occurrence - usually most recent)
        seen = {}
        for doc in documents:
            seen[doc['dok_id']] = doc
        unique_docs = list(seen.values())
        logger.info(f"Deduped {len(documents)} -> {len(unique_docs)} unique documents")

        # Use upsert with ON CONFLICT DO UPDATE on dok_id
        batch_size = 100
        for i in range(0, len(unique_docs), batch_size):
            batch = unique_docs[i:i + batch_size]
            self.client.table('lovdata_documents').upsert(
                batch,
                on_conflict='dok_id'
            ).execute()
            logger.debug(f"Upserted documents batch {i//batch_size + 1}")

    def _upsert_sections(self, sections: list[dict]) -> None:
        """Insert or update sections in Supabase using true upsert."""
        if not sections:
            return

        # Deduplicate by (dok_id, section_id) - keep last occurrence
        seen = {}
        for sec in sections:
            key = (sec['dok_id'], sec['section_id'])
            seen[key] = sec
        unique_sections = list(seen.values())
        logger.info(f"Deduped {len(sections)} -> {len(unique_sections)} unique sections")

        # Use upsert with ON CONFLICT DO UPDATE on (dok_id, section_id)
        batch_size = 500
        for i in range(0, len(unique_sections), batch_size):
            batch = unique_sections[i:i + batch_size]
            self.client.table('lovdata_sections').upsert(
                batch,
                on_conflict='dok_id,section_id'
            ).execute()
            if i % 2000 == 0:
                logger.info(f"Upserted {i + len(batch)} sections...")

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

        @with_retry()
        def _execute() -> dict | None:
            result = self.client.table('lovdata_sync_meta').select('*').eq('dataset', dataset).execute()
            return result.data[0] if result.data else None

        return safe_execute(_execute, f"Failed to get sync status for {dataset}", default=None)

    @with_retry()
    def _set_sync_status(
        self,
        dataset: str,
        status: str,
        last_modified: datetime | None = None,
        file_count: int | None = None
    ) -> None:
        """Update sync status in database."""
        data: dict = {
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

    @with_retry()
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

    @with_retry()
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

    def get_sections_batch(
        self,
        dok_id: str,
        section_ids: list[str]
    ) -> list[LawSection]:
        """
        Fetch multiple sections in a single database call.

        Args:
            dok_id: Document ID or alias
            section_ids: List of section IDs to fetch

        Returns:
            List of LawSection objects (in same order as input)
        """
        doc = self._find_document(dok_id)
        if not doc:
            return []

        # Normalize section IDs
        normalized_ids = [s.replace('§', '').strip() for s in section_ids]

        @with_retry()
        def _execute():
            return self.client.table('lovdata_sections').select(
                'section_id, title, content, char_count'
            ).eq('dok_id', doc['dok_id']).in_('section_id', normalized_ids).execute()

        result = safe_execute(_execute, f"Failed to fetch sections batch for {dok_id}", default=None)
        if not result or not result.data:
            return []

        # Create lookup dict for ordering
        sections_dict = {row['section_id']: row for row in result.data}

        # Return in requested order
        sections = []
        for section_id in normalized_ids:
            if section_id in sections_dict:
                row = sections_dict[section_id]
                sections.append(LawSection(
                    dok_id=doc['dok_id'],
                    section_id=row['section_id'],
                    title=row.get('title'),
                    content=row['content'],
                    address=None,
                    char_count=row.get('char_count') or len(row['content'])
                ))

        return sections

    @with_retry()
    def search(
        self,
        query: str,
        limit: int = 20,
        max_tokens_per_result: int = 150
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
        # Use fast PostgreSQL function for search (avoids slow ts_headline)
        result = self.client.rpc('search_lovdata_fast', {
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
                rank=row.get('rank', 0.0),
                section_id=row.get('section_id')
            ))

        return results

    def get_document(self, dok_id: str) -> dict | None:
        """Get document metadata by ID."""
        return self._find_document(dok_id)

    def list_sections(self, dok_id: str) -> list[dict]:
        """
        List all sections for a document with metadata.

        Returns list of dicts with: section_id, title, char_count, estimated_tokens
        Sorted by section_id (natural sort for numbers like 1, 2, 10, 11).
        """
        doc = self._find_document(dok_id)
        if not doc:
            return []

        @with_retry()
        def _execute() -> list[dict]:
            result = self.client.table('lovdata_sections').select(
                'section_id, title, char_count'
            ).eq('dok_id', doc['dok_id']).execute()
            return result.data if result.data else []

        sections = safe_execute(_execute, f"Failed to list sections for {dok_id}", default=[]) or []

        # Add token estimates and sort naturally
        for sec in sections:
            char_count = sec.get('char_count') or 0
            sec['estimated_tokens'] = int(char_count / 4)  # ~4 chars per token

        # Natural sort: 1, 1a, 2, 3-1, 3-2, 10, 11 (not 1, 10, 11, 2, 3-1...)
        # Also handles suffixes like "1-1a", "3-9 a"
        import re
        def sort_key(s):
            section_id = s['section_id']
            # Split on '-' but preserve for subparts like "3-9"
            parts = section_id.replace('-', '.').split('.')
            result = []
            for p in parts:
                # Try to extract number and optional letter suffix
                # Examples: "1" -> (1, ""), "1a" -> (1, "a"), "6 a" -> (6, "a"), "abc" -> (inf, "abc")
                match = re.match(r'^(\d+)\s*([a-z]?)$', p.strip(), re.I)
                if match:
                    num = int(match.group(1))
                    suffix = match.group(2).lower()
                    result.append((num, suffix))
                else:
                    # Non-numeric parts sort at the end
                    result.append((float('inf'), p.lower()))
            return result

        sections.sort(key=sort_key)
        return sections

    def get_sync_status(self) -> dict:
        """Get sync status for all datasets."""

        @with_retry()
        def _execute() -> dict:
            result = self.client.table('lovdata_sync_meta').select('*').execute()
            return {row['dataset']: row for row in result.data} if result.data else {}

        return safe_execute(_execute, "Failed to get sync status", default={}) or {}

    def is_synced(self) -> bool:
        """Check if any data has been synced."""
        status = self.get_sync_status()
        return len(status) > 0 and any(s.get('file_count', 0) > 0 for s in status.values())

    @with_retry()
    def _find_document(self, identifier: str) -> dict | None:
        """Find document by ID or short title."""
        # Normalize identifier - handle various formats
        normalized = identifier.lower().replace('lov-', 'lov/').replace('for-', 'forskrift/')

        # Build list of possible dok_id formats to try
        candidates = [
            normalized,
            f"SF/{normalized}",  # SF prefix for forskrifter
            f"NL/{normalized}",  # NL prefix for laws (if not stripped)
        ]

        # Try exact match on dok_id with various formats
        for candidate in candidates:
            result = self.client.table('lovdata_documents').select('*').eq('dok_id', candidate).execute()
            if result.data:
                return result.data[0]

        # Try ILIKE match for partial dok_id (handles year variations)
        for candidate in candidates:
            result = self.client.table('lovdata_documents').select('*').ilike(
                'dok_id', f'%{candidate}%'
            ).limit(1).execute()
            if result.data:
                return result.data[0]

        # Try short_title match
        result = self.client.table('lovdata_documents').select('*').ilike(
            'short_title', f'%{identifier}%'
        ).limit(1).execute()
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
