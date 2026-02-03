"""
LovdataService - Client for Lovdata's public API.

Provides access to Norwegian laws and regulations via the free Lovdata API
released November 2025 under NLOD 2.0 license.

API Documentation: https://api.lovdata.no/
Data source: tar.bz2 archives containing XML documents

Storage backends:
    - Supabase PostgreSQL (default when SUPABASE_URL is set) - for cloud deploy
    - Local SQLite (fallback) - for local development

Usage:
    service = LovdataService()
    text = service.lookup_law("avhendingslova", "3-9")

    # Sync data from Lovdata API
    service.sync()
"""

import os
from pathlib import Path

from utils.logger import get_logger

logger = get_logger(__name__)


# =============================================================================
# Configuration
# =============================================================================

# Cache directory for SQLite fallback
CACHE_DIR = Path(os.getenv("LOVDATA_CACHE_DIR", "/tmp/lovdata-cache"))

# Use Supabase if available
USE_SUPABASE = bool(os.getenv("SUPABASE_URL"))

# Token estimation: ~3.5 chars per token for Norwegian text
CHARS_PER_TOKEN = 3.5
LARGE_RESPONSE_THRESHOLD = 5000  # tokens

# Lazy service singletons
_supabase_service = None
_sqlite_service = None


def _get_backend_service():
    """
    Get appropriate backend service based on configuration.

    Uses Supabase when SUPABASE_URL is set, otherwise SQLite.
    """
    global _supabase_service, _sqlite_service

    if USE_SUPABASE:
        if _supabase_service is None:
            try:
                from services.lovdata_supabase import LovdataSupabaseService
                _supabase_service = LovdataSupabaseService()
                logger.info("Using Supabase backend for Lovdata")
            except Exception as e:
                logger.warning(f"Supabase unavailable, falling back to SQLite: {e}")
                return _get_sqlite_service()
        return _supabase_service
    else:
        return _get_sqlite_service()


def _get_sqlite_service():
    """Get SQLite backend service."""
    global _sqlite_service
    if _sqlite_service is None:
        from services.lovdata_sync import LovdataSyncService
        _sqlite_service = LovdataSyncService(cache_dir=CACHE_DIR)
        logger.info("Using SQLite backend for Lovdata")
    return _sqlite_service


def estimate_tokens(text: str) -> int:
    """Estimate token count for Norwegian text."""
    return int(len(text) / CHARS_PER_TOKEN)


class LovdataService:
    """
    Client for Lovdata's public API.

    Fetches and caches Norwegian laws and regulations from api.lovdata.no.
    The API provides ZIP files containing XML documents for all laws
    published in Norsk Lovtidend since 2001.
    """

    BASE_URL = "https://api.lovdata.no"

    # Common law aliases -> Lovdata IDs
    # Format: LOV-YYYY-MM-DD-NR
    LOV_ALIASES: dict[str, str] = {
        # Entreprise og bygg
        "bustadoppføringslova": "LOV-1997-06-13-43",
        "buofl": "LOV-1997-06-13-43",
        "avhendingslova": "LOV-1992-07-03-93",
        "avhl": "LOV-1992-07-03-93",
        "plan-og-bygningsloven": "LOV-2008-06-27-71",
        "pbl": "LOV-2008-06-27-71",
        "byggherreforskriften": "FOR-2009-08-03-1028",

        # Kontraktsrett
        "kjøpsloven": "LOV-1988-05-13-27",
        "forbrukerkjøpsloven": "LOV-2002-06-21-34",
        "fkjl": "LOV-2002-06-21-34",
        "håndverkertjenesteloven": "LOV-1989-06-16-63",
        "hvtjl": "LOV-1989-06-16-63",
        "angrerettloven": "LOV-2014-06-20-27",

        # Arbeidsrett
        "arbeidsmiljøloven": "LOV-2005-06-17-62",
        "aml": "LOV-2005-06-17-62",
        "ferieloven": "LOV-1988-04-29-21",
        "folketrygdloven": "LOV-1997-02-28-19",
        "ftrl": "LOV-1997-02-28-19",

        # Forvaltning
        "forvaltningsloven": "LOV-1967-02-10",
        "fvl": "LOV-1967-02-10",
        "offentleglova": "LOV-2006-05-19-16",
        "offl": "LOV-2006-05-19-16",
        "kommuneloven": "LOV-2018-06-22-83",
        "koml": "LOV-2018-06-22-83",

        # Tvisteløsning
        "tvisteloven": "LOV-2005-06-17-90",
        "tvl": "LOV-2005-06-17-90",
        "voldgiftsloven": "LOV-2004-05-14-25",
        "domstolloven": "LOV-1915-08-13-5",

        # Anskaffelser
        "anskaffelsesloven": "LOV-2016-06-17-73",
        "anskaffelsesforskriften": "FOR-2016-08-12-974",

        # Erstatning
        "skadeserstatningsloven": "LOV-1969-06-13-26",
        "skl": "LOV-1969-06-13-26",

        # Generelt
        "avtaleloven": "LOV-1918-05-31-4",
        "avtl": "LOV-1918-05-31-4",
        "straffeloven": "LOV-2005-05-20-28",
        "strl": "LOV-2005-05-20-28",
        "personopplysningsloven": "LOV-2018-06-15-38",
        "popplyl": "LOV-2018-06-15-38",
    }

    # Human-readable names
    LOV_NAMES: dict[str, str] = {
        "LOV-1997-06-13-43": "Lov om avtalar med forbrukar om oppføring av ny bustad m.m. (bustadoppføringslova)",
        "LOV-1992-07-03-93": "Lov om avhending av fast eigedom (avhendingslova)",
        "LOV-2008-06-27-71": "Lov om planlegging og byggesaksbehandling (plan- og bygningsloven)",
        "LOV-2005-06-17-62": "Lov om arbeidsmiljø, arbeidstid og stillingsvern mv. (arbeidsmiljøloven)",
        "LOV-2005-06-17-90": "Lov om mekling og rettergang i sivile tvister (tvisteloven)",
        "LOV-1967-02-10": "Lov om behandlingsmåten i forvaltningssaker (forvaltningsloven)",
        "LOV-2002-06-21-34": "Lov om forbrukerkjøp (forbrukerkjøpsloven)",
        "LOV-1988-05-13-27": "Lov om kjøp (kjøpsloven)",
        "LOV-1918-05-31-4": "Lov om avslutning av avtaler, om fuldmagt og om ugyldige viljeserklæringer (avtaleloven)",
        "LOV-1969-06-13-26": "Lov om skadeserstatning (skadeserstatningsloven)",
        "LOV-2016-06-17-73": "Lov om offentlige anskaffelser (anskaffelsesloven)",
    }

    def __init__(self):
        """Initialize LovdataService."""
        # Backend is lazily initialized on first use via _get_backend_service()
        pass

    def _resolve_id(self, alias: str) -> str:
        """
        Resolve alias to Lovdata ID.

        Args:
            alias: Law name, abbreviation, or ID

        Returns:
            Lovdata ID (e.g., LOV-1992-07-03-93)
        """
        normalized = alias.lower().replace(" ", "-").replace("_", "-")
        return self.LOV_ALIASES.get(normalized, alias.upper())

    def _get_law_name(self, lov_id: str) -> str:
        """Get human-readable name for a law ID."""
        return self.LOV_NAMES.get(lov_id, lov_id)

    def _format_lovdata_url(self, lov_id: str, paragraf: str | None = None) -> str:
        """
        Format URL to lovdata.no for a law/section.

        Args:
            lov_id: Lovdata ID (e.g., LOV-1992-07-03-93)
            paragraf: Optional section number (e.g., "3-9")

        Returns:
            URL to lovdata.no
        """
        # Convert LOV-1992-07-03-93 to lov/1992-07-03-93
        if lov_id.startswith("LOV-"):
            path = "lov/" + lov_id[4:].lower()
        elif lov_id.startswith("FOR-"):
            path = "forskrift/" + lov_id[4:].lower()
        else:
            path = lov_id.lower()

        url = f"https://lovdata.no/{path}"

        if paragraf:
            # Normalize section format
            section = paragraf.lstrip("§").strip()
            url += f"/§{section}"

        return url

    def lookup_law(
        self,
        lov_id: str,
        paragraf: str | None = None,
        max_tokens: int | None = None
    ) -> str:
        """
        Look up a Norwegian law or specific section.

        Args:
            lov_id: Law identifier or alias (e.g., "avhendingslova", "LOV-1992-07-03-93")
            paragraf: Optional section number (e.g., "3-9", "§ 3-9")
            max_tokens: Optional token limit for truncating long responses

        Returns:
            Formatted law text with metadata and source link
        """
        resolved_id = self._resolve_id(lov_id)
        law_name = self._get_law_name(resolved_id)
        url = self._format_lovdata_url(resolved_id, paragraf)

        logger.info(f"Looking up law: {resolved_id}, section: {paragraf}, max_tokens: {max_tokens}")

        # Try to fetch from cache/API
        content = self._fetch_law_content(resolved_id, paragraf, max_tokens=max_tokens)

        if content:
            return self._format_response(
                law_name=law_name,
                law_id=resolved_id,
                paragraf=paragraf,
                content=content,
                url=url
            )
        else:
            # Fallback: Return link with metadata
            return self._format_fallback_response(
                law_name=law_name,
                law_id=resolved_id,
                paragraf=paragraf,
                url=url
            )

    def _fetch_law_content(
        self,
        lov_id: str,
        paragraf: str | None = None,
        max_tokens: int | None = None
    ) -> str | None:
        """
        Fetch law content from cache (Supabase or SQLite).

        Args:
            lov_id: Lovdata ID or alias
            paragraf: Optional section number
            max_tokens: Optional token limit (truncates if exceeded)

        Returns:
            Law text content or None if not available
        """
        backend = _get_backend_service()

        try:
            if paragraf:
                # Get specific section
                section = backend.get_section(lov_id, paragraf)
                if section:
                    content = ""
                    if section.title:
                        content = f"**{section.title}**\n\n"
                    content += section.content

                    # Apply token limit if specified
                    if max_tokens:
                        max_chars = int(max_tokens * CHARS_PER_TOKEN)
                        if len(content) > max_chars:
                            content = content[:max_chars] + "\n\n... [avkortet]"

                    return content
            else:
                # Get document overview
                doc = backend.get_document(lov_id)
                if doc:
                    return "*Dokument lastet fra cache. Bruk paragraf-parameter for spesifikke bestemmelser.*"

        except Exception as e:
            logger.warning(f"Failed to fetch law content for {lov_id}: {e}")

        return None

    def get_section_size(self, lov_id: str, paragraf: str) -> dict | None:
        """
        Get section size without fetching content.

        Useful for Claude to decide whether to fetch full content.

        Args:
            lov_id: Law ID or alias
            paragraf: Section number

        Returns:
            Dict with char_count and estimated_tokens, or None
        """
        backend = _get_backend_service()

        try:
            # Try Supabase method first
            if hasattr(backend, 'get_section_size'):
                return backend.get_section_size(lov_id, paragraf)

            # Fallback: fetch section and measure
            section = backend.get_section(lov_id, paragraf)
            if section:
                char_count = len(section.content)
                return {
                    'char_count': char_count,
                    'estimated_tokens': estimate_tokens(section.content)
                }
        except Exception as e:
            logger.warning(f"Failed to get section size: {e}")

        return None

    def sync(self, force: bool = False) -> dict[str, int]:
        """
        Sync law data from Lovdata API.

        Downloads and indexes all laws and regulations.

        Args:
            force: Force re-download even if up-to-date

        Returns:
            Dict with counts of synced documents
        """
        backend = _get_backend_service()
        return backend.sync_all(force=force)

    def get_sync_status(self) -> dict:
        """
        Get sync status for cached data.

        Returns:
            Dict with sync timestamps and file counts
        """
        backend = _get_backend_service()
        return backend.get_sync_status()

    def is_synced(self) -> bool:
        """Check if any data has been synced."""
        backend = _get_backend_service()
        return backend.is_synced()

    def get_backend_type(self) -> str:
        """Return which backend is in use."""
        return "supabase" if USE_SUPABASE else "sqlite"

    def _format_response(
        self,
        law_name: str,
        law_id: str,
        paragraf: str | None,
        content: str,
        url: str
    ) -> str:
        """Format successful lookup response."""
        section_header = f"§ {paragraf}" if paragraf else "(hele loven)"

        return f"""## {law_name}

**Paragraf:** {section_header}
**Lovdata ID:** {law_id}

---

{content}

---

**Kilde:** [{url}]({url})
**Lisens:** NLOD 2.0 - Norsk lisens for offentlige data
"""

    def _format_fallback_response(
        self,
        law_name: str,
        law_id: str,
        paragraf: str | None,
        url: str
    ) -> str:
        """Format fallback response when content is not cached."""
        section_header = f"§ {paragraf}" if paragraf else "(hele loven)"

        # Check sync status for better message
        sync_status = self.get_sync_status()
        if sync_status:
            tip_msg = "*Lovdata er synkronisert, men denne loven ble ikke funnet i cache.*"
        else:
            tip_msg = "*Tips: Kjør `python -m services.lovdata_sync` for å laste ned lovdata.*"

        return f"""## {law_name}

**Paragraf:** {section_header}
**Lovdata ID:** {law_id}

---

Lovteksten er ikke tilgjengelig i lokal cache.

**Se fullstendig tekst på Lovdata:**
[{url}]({url})

---

{tip_msg}
**Lisens:** NLOD 2.0 - Norsk lisens for offentlige data
"""

    def lookup_regulation(self, forskrift_id: str, paragraf: str | None = None) -> str:
        """
        Look up a Norwegian regulation.

        Args:
            forskrift_id: Regulation identifier or alias
            paragraf: Optional section number

        Returns:
            Formatted regulation text with metadata
        """
        resolved_id = self._resolve_id(forskrift_id)
        url = self._format_lovdata_url(resolved_id, paragraf)
        section_header = f"§ {paragraf}" if paragraf else "(hele forskriften)"

        logger.info(f"Looking up regulation: {resolved_id}, section: {paragraf}")

        return f"""## Forskrift: {forskrift_id}

**Paragraf:** {section_header}
**ID:** {resolved_id}

---

Se fullstendig tekst på Lovdata:

**Lenke:** [{url}]({url})

---

**Lisens:** NLOD 2.0 - Norsk lisens for offentlige data
"""

    def search(self, query: str, limit: int = 10) -> str:
        """
        Search Norwegian laws and regulations.

        Uses full-text search if data is synced, otherwise falls back to alias matching.

        Args:
            query: Search query
            limit: Maximum number of results

        Returns:
            Formatted search results
        """
        logger.info(f"Searching laws for: {query} (limit={limit})")

        # Try FTS search first if data is synced
        if self.is_synced():
            backend = _get_backend_service()
            try:
                fts_results = backend.search(query, limit=limit)
                if fts_results:
                    return self._format_fts_results(query, fts_results)
            except Exception as e:
                logger.warning(f"FTS search failed, falling back to alias search: {e}")

        # Fallback: Simple keyword matching against known laws
        results = []
        query_lower = query.lower()

        for alias, lov_id in self.LOV_ALIASES.items():
            law_name = self._get_law_name(lov_id)
            if query_lower in alias or query_lower in law_name.lower():
                if lov_id not in [r["id"] for r in results]:
                    results.append({
                        "id": lov_id,
                        "name": law_name,
                        "url": self._format_lovdata_url(lov_id)
                    })

            if len(results) >= limit:
                break

        if not results:
            return f"""## Søkeresultater for "{query}"

Ingen treff i indekserte lover.

**Tips:** Kjør `service.sync()` for å laste ned lovdata, eller søk direkte på Lovdata:
https://lovdata.no/sok?q={query.replace(' ', '+')}
"""

        result_lines = []
        for r in results:
            result_lines.append(f"- **{r['name']}**\n  ID: `{r['id']}`\n  [{r['url']}]({r['url']})")

        return f"""## Søkeresultater for "{query}"

Fant {len(results)} treff (alias-søk):

{chr(10).join(result_lines)}

---

*For fulltekstsøk, kjør `service.sync()` først.*
**Søk på Lovdata:** https://lovdata.no/sok?q={query.replace(' ', '+')}
"""

    def _format_fts_results(self, query: str, results: list[dict]) -> str:
        """Format full-text search results."""
        result_lines = []

        for r in results:
            doc_type = "Lov" if r.get('doc_type') == 'lov' else "Forskrift"
            title = r.get('title') or r.get('short_title') or r.get('dok_id')
            snippet = r.get('snippet', '')

            # Clean up snippet (remove HTML if present)
            snippet = snippet.replace('<mark>', '**').replace('</mark>', '**')

            result_lines.append(f"""### {doc_type}: {title}
**ID:** `{r['dok_id']}`

{snippet}
""")

        return f"""## Søkeresultater for "{query}"

Fant {len(results)} treff (fulltekstsøk):

{chr(10).join(result_lines)}

---

**Søk på Lovdata:** https://lovdata.no/sok?q={query.replace(' ', '+')}
"""

    def list_available_laws(self) -> str:
        """
        List all available law aliases and their IDs.

        Returns:
            Formatted list of available laws
        """
        categories = {
            "Entreprise og bygg": ["bustadoppføringslova", "avhendingslova", "plan-og-bygningsloven"],
            "Kontraktsrett": ["kjøpsloven", "forbrukerkjøpsloven", "håndverkertjenesteloven", "avtaleloven"],
            "Arbeidsrett": ["arbeidsmiljøloven", "ferieloven", "folketrygdloven"],
            "Tvisteløsning": ["tvisteloven", "voldgiftsloven", "domstolloven"],
            "Forvaltning": ["forvaltningsloven", "offentleglova", "kommuneloven"],
            "Anskaffelser": ["anskaffelsesloven", "anskaffelsesforskriften"],
        }

        lines = ["## Tilgjengelige lover og forskrifter\n"]

        for category, laws in categories.items():
            lines.append(f"### {category}\n")
            for alias in laws:
                lov_id = self.LOV_ALIASES.get(alias, "")
                if lov_id:
                    name = self._get_law_name(lov_id)
                    lines.append(f"- `{alias}` → {name}")
            lines.append("")

        lines.append("---")
        lines.append("*Bruk alias eller full ID i oppslag, f.eks. `lov('avhendingslova', '3-9')`*")

        return "\n".join(lines)
