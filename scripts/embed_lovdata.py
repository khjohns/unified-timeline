#!/usr/bin/env python3
"""
Generate embeddings for all Lovdata sections using Gemini API.

Usage:
    python scripts/embed_lovdata.py --dry-run      # Verify cost first!
    python scripts/embed_lovdata.py                # Run embedding
    python scripts/embed_lovdata.py --workers 2    # Parallel processing
    python scripts/embed_lovdata.py --delay 1      # Throttle to avoid IO exhaustion
    python scripts/embed_lovdata.py --max-time 25  # Stop after 25 minutes
    python scripts/embed_lovdata.py --batch-size 50 --limit 1000

Recommended for Supabase free/micro tier (30 min burst/day):
    python scripts/embed_lovdata.py --workers 1 --max-time 25
"""

import os
import sys
import math
import hashlib
import argparse
import time
import threading
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Generator


def log(msg: str):
    """Print message with timestamp."""
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"[{ts}] {msg}")

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

# Global client (thread-safe for reads)
_genai_client = None
_genai_lock = threading.Lock()

# Thread-local storage for Supabase clients
_thread_local = threading.local()


def get_supabase_client():
    """Create Supabase client (one per thread for thread safety)."""
    # Check thread-local storage first
    if hasattr(_thread_local, 'supabase_client'):
        return _thread_local.supabase_client

    url = os.environ.get("SUPABASE_URL")
    key = (os.environ.get("SUPABASE_SECRET_KEY")
           or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
           or os.environ.get("SUPABASE_KEY"))
    if not url or not key:
        raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set")

    # Create and store in thread-local
    _thread_local.supabase_client = create_client(url, key)
    return _thread_local.supabase_client


def get_gemini_client() -> genai.Client:
    """Get or create Gemini API client (thread-safe singleton)."""
    global _genai_client
    if _genai_client is not None:
        return _genai_client

    with _genai_lock:
        # Double-check after acquiring lock
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


def update_section_embeddings(supabase, updates: list[dict], max_retries: int = 3) -> int:
    """Update embeddings one by one with retry logic."""
    success = 0
    for update in updates:
        for attempt in range(max_retries):
            try:
                supabase.table('lovdata_sections').update({
                    'embedding': update['embedding'],
                    'content_hash': update['content_hash']
                }).eq('id', update['id']).execute()
                success += 1
                break
            except Exception:
                if attempt < max_retries - 1:
                    time.sleep(1 * (attempt + 1))  # Increasing backoff
                # Skip after all retries exhausted
    return success


def process_batch(batch_texts: list[str], batch_ids: list[str]) -> int:
    """
    Process a single batch: generate embeddings and update database.
    This function is designed to be called from multiple threads.
    """
    # Get thread-local Supabase client
    supabase = get_supabase_client()

    # Generate embeddings (Gemini client is thread-safe for reads)
    try:
        embeddings = generate_embeddings_batch(batch_texts)
    except Exception as e:
        print(f"    [ERROR] Embedding generation failed: {e}")
        return 0

    # Prepare updates
    updates = []
    for section_id, embedding, text in zip(batch_ids, embeddings, batch_texts):
        updates.append({
            'id': section_id,
            'embedding': embedding,
            'content_hash': content_hash(text)
        })

    # Update database
    return update_section_embeddings(supabase, updates)


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

    # Adjust parallelism
    python scripts/embed_lovdata.py --workers 4
        """
    )
    parser.add_argument('--dry-run', action='store_true',
                        help='Show what would be done without calling API')
    parser.add_argument('--batch-size', type=int, default=BATCH_SIZE,
                        help=f'Batch size for API calls (default: {BATCH_SIZE})')
    parser.add_argument('--limit', type=int,
                        help='Max number of sections to process')
    parser.add_argument('--workers', type=int, default=1,
                        help='Number of parallel workers (default: 1)')
    parser.add_argument('--delay', type=float, default=0,
                        help='Delay in seconds between batches (default: 0)')
    parser.add_argument('--max-time', type=int, default=0,
                        help='Stop after N minutes (default: 0 = unlimited)')
    args = parser.parse_args()

    log("Initializing clients...")
    supabase = get_supabase_client()

    if not args.dry_run:
        get_gemini_client()

    log("Fetching document metadata...")
    docs = fetch_document_metadata(supabase)
    log(f"Found {len(docs)} documents")

    total_processed = 0
    total_tokens = 0
    start_time = time.time()

    log(f"Starting embedding generation with {args.workers} worker(s)...")

    # Collect all batches to process
    all_batches = []

    for section_batch in fetch_sections_needing_embedding(supabase):
        if args.limit and total_processed + len(all_batches) * args.batch_size >= args.limit:
            break

        # Prepare texts for embedding
        for section in section_batch:
            if args.limit and total_processed + len(all_batches) * args.batch_size >= args.limit:
                break

            doc = docs.get(section['dok_id'], {})
            text = create_embedding_text(doc, section)
            all_batches.append({
                'id': section['id'],
                'text': text
            })
            total_tokens += len(text) // 4

    stopped_early = False

    if args.dry_run:
        log(f"[DRY RUN] Would process {len(all_batches):,} sections")
        total_processed = len(all_batches)
    else:
        # Split into sub-batches of batch_size
        sub_batches = []
        for i in range(0, len(all_batches), args.batch_size):
            batch_slice = all_batches[i:i + args.batch_size]
            batch_texts = [b['text'] for b in batch_slice]
            batch_ids = [b['id'] for b in batch_slice]
            sub_batches.append((batch_texts, batch_ids))

        log(f"Total: {len(all_batches):,} sections in {len(sub_batches)} batches")

        try:
            # Process batches with thread pool
            if args.workers > 1:
                with ThreadPoolExecutor(max_workers=args.workers) as executor:
                    futures = {
                        executor.submit(process_batch, texts, ids): (texts, ids)
                        for texts, ids in sub_batches
                    }

                    for future in as_completed(futures):
                        # Check time limit
                        if args.max_time > 0:
                            elapsed_min = (time.time() - start_time) / 60
                            if elapsed_min >= args.max_time:
                                log(f"⏱ Time limit reached ({args.max_time} min)")
                                executor.shutdown(wait=False, cancel_futures=True)
                                stopped_early = True
                                break

                        try:
                            successful = future.result()
                            total_processed += successful
                            elapsed_min = (time.time() - start_time) / 60
                            rate = total_processed / elapsed_min if elapsed_min > 0 else 0
                            remaining = len(all_batches) - total_processed
                            eta_min = remaining / rate if rate > 0 else 0
                            log(f"Processed {total_processed:,} / {len(all_batches):,} ({rate:.0f}/min, ETA {eta_min:.0f} min)")
                        except Exception as e:
                            log(f"[ERROR] Batch failed: {e}")
                        if args.delay > 0:
                            time.sleep(args.delay)
            else:
                # Sequential processing (original behavior)
                for batch_texts, batch_ids in sub_batches:
                    # Check time limit
                    if args.max_time > 0:
                        elapsed_min = (time.time() - start_time) / 60
                        if elapsed_min >= args.max_time:
                            log(f"⏱ Time limit reached ({args.max_time} min)")
                            stopped_early = True
                            break

                    successful = process_batch(batch_texts, batch_ids)
                    total_processed += successful
                    elapsed_min = (time.time() - start_time) / 60
                    rate = total_processed / elapsed_min if elapsed_min > 0 else 0
                    remaining = len(all_batches) - total_processed
                    eta_min = remaining / rate if rate > 0 else 0
                    log(f"Processed {total_processed:,} / {len(all_batches):,} ({rate:.0f}/min, ETA {eta_min:.0f} min)")
                    if args.delay > 0:
                        time.sleep(args.delay)

        except KeyboardInterrupt:
            log("⚠ Interrupted by user (Ctrl+C)")
            stopped_early = True

    elapsed = time.time() - start_time
    rate = total_processed / (elapsed / 60) if elapsed > 0 else 0

    print("")  # blank line
    log(f"{'STOPPED' if stopped_early else 'DONE'} in {elapsed/60:.1f} minutes")
    log(f"Processed: {total_processed:,} sections ({rate:.0f}/min avg)")
    if stopped_early:
        remaining = len(all_batches) - total_processed
        log(f"Remaining: {remaining:,} sections")
    log(f"Tokens used: ~{total_tokens:,} (${total_tokens * 0.15 / 1_000_000:.2f})")


if __name__ == "__main__":
    main()
