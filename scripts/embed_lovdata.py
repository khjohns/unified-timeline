#!/usr/bin/env python3
"""
Generate embeddings for all Lovdata sections using Gemini API.

Usage:
    python scripts/embed_lovdata.py --dry-run   # Verify cost first!
    python scripts/embed_lovdata.py             # Run embedding
    python scripts/embed_lovdata.py --batch-size 50 --limit 1000
"""

import os
import sys
import math
import hashlib
import argparse
import time
from typing import Generator

# Add backend to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from google import genai
from google.genai import types
from supabase import create_client

# Configuration
EMBEDDING_MODEL = "gemini-embedding-001"
EMBEDDING_DIM = 1536
BATCH_SIZE = 100  # Google API batch limit
TASK_TYPE_DOCUMENT = "RETRIEVAL_DOCUMENT"  # Optimized for document retrieval
RPM_LIMIT = 100  # Free tier rate limit

# Global client
_genai_client = None


def get_supabase_client():
    """Create Supabase client."""
    url = os.environ.get("SUPABASE_URL")
    key = (os.environ.get("SUPABASE_SECRET_KEY")
           or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
           or os.environ.get("SUPABASE_KEY"))
    if not url or not key:
        raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set")
    return create_client(url, key)


def get_gemini_client() -> genai.Client:
    """Get or create Gemini API client."""
    global _genai_client
    if _genai_client is not None:
        return _genai_client

    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY or GOOGLE_API_KEY must be set")
    _genai_client = genai.Client(api_key=api_key)
    return _genai_client


def content_hash(text: str) -> str:
    """Generate hash of content for change tracking."""
    return hashlib.sha256(text.encode()).hexdigest()[:16]


def normalize_embedding(embedding: list[float]) -> list[float]:
    """Normalize embedding to unit length for correct cosine similarity."""
    norm = math.sqrt(sum(x * x for x in embedding))
    if norm == 0:
        return embedding
    return [x / norm for x in embedding]


def create_embedding_text(doc: dict, section: dict) -> str:
    """
    Enrich section with context for better embedding.

    Includes:
    - Law name (provides legal context)
    - Section number (identification)
    - Title (semantic hint)
    - Content (main text)
    """
    parts = [f"{doc.get('short_title', '')} § {section['section_id']}"]
    if section.get('title'):
        parts.append(section['title'])
    parts.append("")  # Blank line
    parts.append(section['content'])
    return "\n".join(parts)


def fetch_sections_needing_embedding(
    supabase,
    batch_size: int = 1000
) -> Generator[list[dict], None, None]:
    """
    Fetch sections that need embedding (missing or outdated).
    Yields batches for memory efficiency.
    """
    offset = 0
    while True:
        # Fetch sections without embedding
        result = supabase.table('lovdata_sections').select(
            'id, dok_id, section_id, title, content, content_hash'
        ).is_('embedding', 'null').range(offset, offset + batch_size - 1).execute()

        if not result.data:
            break

        yield result.data
        offset += batch_size

        if len(result.data) < batch_size:
            break


def fetch_document_metadata(supabase) -> dict[str, dict]:
    """Fetch metadata for all documents (for context enrichment)."""
    result = supabase.table('lovdata_documents').select(
        'dok_id, short_title, title, doc_type'
    ).execute()
    return {doc['dok_id']: doc for doc in result.data}


def generate_embeddings_batch(
    texts: list[str],
    task_type: str = TASK_TYPE_DOCUMENT
) -> list[list[float]]:
    """
    Generate embeddings for a batch of texts.

    Args:
        texts: List of texts to embed
        task_type: RETRIEVAL_DOCUMENT for law texts, RETRIEVAL_QUERY for search
    """
    client = get_gemini_client()
    result = client.models.embed_content(
        model=EMBEDDING_MODEL,
        contents=texts,
        config=types.EmbedContentConfig(
            task_type=task_type,
            output_dimensionality=EMBEDDING_DIM
        )
    )
    # Normalize embeddings (required for 768/1536 dim)
    return [normalize_embedding(list(emb.values)) for emb in result.embeddings]


def update_section_embeddings(supabase, updates: list[dict]) -> None:
    """Update embeddings in database."""
    for update in updates:
        supabase.table('lovdata_sections').update({
            'embedding': update['embedding'],
            'content_hash': update['content_hash']
        }).eq('id', update['id']).execute()


def main():
    parser = argparse.ArgumentParser(
        description='Generate Lovdata embeddings',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    # Always run dry-run first to verify cost
    python scripts/embed_lovdata.py --dry-run

    # Generate all embeddings
    python scripts/embed_lovdata.py

    # Test with limited sections
    python scripts/embed_lovdata.py --limit 100
        """
    )
    parser.add_argument('--dry-run', action='store_true',
                        help='Show what would be done without calling API')
    parser.add_argument('--batch-size', type=int, default=BATCH_SIZE,
                        help=f'Batch size for API calls (default: {BATCH_SIZE})')
    parser.add_argument('--limit', type=int,
                        help='Max number of sections to process')
    args = parser.parse_args()

    print("Initializing clients...")
    supabase = get_supabase_client()

    if not args.dry_run:
        get_gemini_client()

    print("Fetching document metadata...")
    docs = fetch_document_metadata(supabase)
    print(f"  Found {len(docs)} documents")

    total_processed = 0
    total_tokens = 0
    request_count = 0
    start_time = time.time()

    print("Starting embedding generation...")
    for section_batch in fetch_sections_needing_embedding(supabase):
        if args.limit and total_processed >= args.limit:
            break

        # Prepare texts for embedding
        texts = []
        section_ids = []
        sections_to_process = []

        for section in section_batch:
            if args.limit and total_processed + len(texts) >= args.limit:
                break

            doc = docs.get(section['dok_id'], {})
            text = create_embedding_text(doc, section)
            texts.append(text)
            section_ids.append(section['id'])
            sections_to_process.append(section)
            total_tokens += len(text) // 4  # Rough token estimate

        if args.dry_run:
            print(f"  [DRY RUN] Would process {len(texts)} sections")
            total_processed += len(texts)
            continue

        # Generate embeddings in sub-batches (API limit)
        for i in range(0, len(texts), args.batch_size):
            batch_texts = texts[i:i + args.batch_size]
            batch_ids = section_ids[i:i + args.batch_size]
            batch_sections = sections_to_process[i:i + args.batch_size]

            # Rate limiting - wait if needed
            request_count += 1
            if request_count > 1 and request_count % RPM_LIMIT == 0:
                elapsed = time.time() - start_time
                if elapsed < 60:
                    wait_time = 60 - elapsed
                    print(f"  Rate limit reached, waiting {wait_time:.0f}s...")
                    time.sleep(wait_time)
                start_time = time.time()

            embeddings = generate_embeddings_batch(batch_texts)

            # Prepare updates
            # IMPORTANT: Hash must include context enrichment to detect changes
            updates = []
            for section_id, embedding, section, text in zip(
                batch_ids, embeddings, batch_sections, batch_texts
            ):
                updates.append({
                    'id': section_id,
                    'embedding': embedding,
                    'content_hash': content_hash(text)
                })

            update_section_embeddings(supabase, updates)
            total_processed += len(updates)

            print(f"  Processed {total_processed} sections...")

    # Calculate estimates
    num_requests = (total_processed + args.batch_size - 1) // args.batch_size
    est_minutes = num_requests / RPM_LIMIT

    print(f"\nDone!")
    print(f"  Total processed: {total_processed} sections")
    print(f"  Estimated tokens: {total_tokens:,}")
    print(f"  Estimated cost: ${total_tokens * 0.15 / 1_000_000:.2f}")
    print(f"  Estimated time: ~{est_minutes:.0f} min ({RPM_LIMIT} RPM)")


if __name__ == "__main__":
    main()
