"""
Vector search for Lovdata with hybrid FTS+embedding search.

Combines semantic vector search with PostgreSQL full-text search
for best results on both natural language and legal terminology.
"""

import os
import math
import logging
from dataclasses import dataclass
from functools import lru_cache

from google import genai
from google.genai import types

from lib.supabase import get_shared_client, with_retry


logger = logging.getLogger(__name__)

EMBEDDING_MODEL = "gemini-embedding-001"
EMBEDDING_DIM = 1536
DEFAULT_FTS_WEIGHT = 0.5  # Configurable starting point
TASK_TYPE_QUERY = "RETRIEVAL_QUERY"  # Optimized for search queries


@dataclass
class VectorSearchResult:
    """Result from hybrid vector search."""
    dok_id: str
    section_id: str
    title: str | None
    content: str
    short_title: str
    doc_type: str
    similarity: float
    fts_rank: float
    combined_score: float

    @property
    def reference(self) -> str:
        """Format as legal reference."""
        return f"{self.short_title} § {self.section_id}"

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            'dok_id': self.dok_id,
            'section_id': self.section_id,
            'title': self.title,
            'content': self.content,
            'short_title': self.short_title,
            'doc_type': self.doc_type,
            'similarity': self.similarity,
            'fts_rank': self.fts_rank,
            'combined_score': self.combined_score,
            'reference': self.reference,
        }


class LovdataVectorSearch:
    """
    Hybrid vector search for Lovdata.

    Combines semantic vector search with PostgreSQL FTS for
    best results on both natural language and legal terminology.
    """

    def __init__(self):
        self.supabase = get_shared_client()
        self._genai_client = None

    def _get_genai_client(self) -> genai.Client:
        """Get or create Gemini API client lazily."""
        if self._genai_client is not None:
            return self._genai_client

        api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY must be set for vector search")
        self._genai_client = genai.Client(api_key=api_key)
        return self._genai_client

    @staticmethod
    def _normalize(embedding: list[float]) -> list[float]:
        """Normalize embedding to unit length."""
        norm = math.sqrt(sum(x * x for x in embedding))
        return [x / norm for x in embedding] if norm > 0 else embedding

    @lru_cache(maxsize=1000)
    def _generate_query_embedding(self, query: str) -> tuple[float, ...]:
        """
        Generate embedding for search query.

        Caches results to avoid repeated API calls for same query.
        Returns tuple (immutable) for caching compatibility.
        Uses RETRIEVAL_QUERY task type for optimized search quality.
        """
        client = self._get_genai_client()

        result = client.models.embed_content(
            model=EMBEDDING_MODEL,
            contents=query,
            config=types.EmbedContentConfig(
                task_type=TASK_TYPE_QUERY,
                output_dimensionality=EMBEDDING_DIM
            )
        )
        # Normalize for correct cosine similarity (required for 1536 dim)
        normalized = self._normalize(list(result.embeddings[0].values))
        return tuple(normalized)

    def _fallback_fts_search(
        self,
        query: str,
        limit: int
    ) -> list[VectorSearchResult]:
        """Fallback to pure FTS on embedding API error."""
        logger.warning(f"Fallback to FTS for query: {query[:50]}...")

        # Use existing FTS search
        result = self.supabase.rpc('search_lovdata', {
            'query_text': query,
            'max_results': limit
        }).execute()

        if not result.data:
            return []

        return [
            VectorSearchResult(
                dok_id=row['dok_id'],
                section_id='',  # FTS returns document-level
                title=row.get('title'),
                content=row.get('snippet', ''),
                short_title=row.get('short_title', ''),
                doc_type=row.get('doc_type', ''),
                similarity=0.0,
                fts_rank=row.get('rank', 0.0),
                combined_score=row.get('rank', 0.0)
            )
            for row in result.data
        ]

    @with_retry()
    def search(
        self,
        query: str,
        limit: int = 10,
        fts_weight: float = DEFAULT_FTS_WEIGHT,
        ef_search: int = 100
    ) -> list[VectorSearchResult]:
        """
        Perform hybrid search.

        Args:
            query: Search query (natural language)
            limit: Max number of results
            fts_weight: Weight for FTS vs vector (0-1, default 0.5)
            ef_search: HNSW recall (higher = better recall, slower, default 100)

        Returns:
            List of VectorSearchResult sorted by relevance
        """
        # Generate query embedding with fallback to FTS on error
        try:
            query_embedding = list(self._generate_query_embedding(query))
        except Exception as e:
            logger.error(f"Embedding API error: {e}")
            return self._fallback_fts_search(query, limit)

        # Call hybrid search function
        result = self.supabase.rpc('search_lovdata_hybrid', {
            'query_text': query,
            'query_embedding': query_embedding,
            'match_count': limit,
            'fts_weight': fts_weight,
            'ef_search': ef_search
        }).execute()

        if not result.data:
            return []

        return [
            VectorSearchResult(
                dok_id=row['dok_id'],
                section_id=row['section_id'],
                title=row.get('title'),
                content=row['content'],
                short_title=row['short_title'],
                doc_type=row['doc_type'],
                similarity=row['similarity'],
                fts_rank=row['fts_rank'],
                combined_score=row['combined_score']
            )
            for row in result.data
        ]

    def search_semantic_only(
        self,
        query: str,
        limit: int = 10,
        ef_search: int = 100
    ) -> list[VectorSearchResult]:
        """Pure vector search (for testing/comparison)."""
        try:
            query_embedding = list(self._generate_query_embedding(query))
        except Exception as e:
            logger.error(f"Embedding API error: {e}")
            return []

        result = self.supabase.rpc('search_lovdata_vector', {
            'query_embedding': query_embedding,
            'match_count': limit,
            'ef_search': ef_search
        }).execute()

        if not result.data:
            return []

        return [
            VectorSearchResult(
                dok_id=row['dok_id'],
                section_id=row['section_id'],
                title=row.get('title'),
                content=row['content'],
                short_title=row['short_title'],
                doc_type=row['doc_type'],
                similarity=row['similarity'],
                fts_rank=0.0,
                combined_score=row['similarity']
            )
            for row in result.data
        ]

    def search_fts_only(
        self,
        query: str,
        limit: int = 10
    ) -> list[VectorSearchResult]:
        """Pure FTS search (for testing/comparison)."""
        return self.search(query, limit, fts_weight=1.0)

    def get_embedding_stats(self) -> dict:
        """Get statistics about embeddings in database."""
        total = self.supabase.table('lovdata_sections').select(
            'id', count='exact'
        ).execute()

        embedded = self.supabase.table('lovdata_sections').select(
            'id', count='exact'
        ).not_.is_('embedding', 'null').execute()

        return {
            'total_sections': total.count,
            'embedded_sections': embedded.count,
            'coverage_pct': (embedded.count / total.count * 100) if total.count > 0 else 0
        }
