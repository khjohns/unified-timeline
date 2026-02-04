# Lovdata Vektorsøk - Implementeringsplan

> **Status:** Planlagt
> **Dato:** 2026-02-04
> **Forfatter:** Claude Code

## Sammendrag

Implementere semantisk vektorsøk for Lovdata-cachen for å muliggjøre en "Lovdata-chat" der ikke-jurister kan stille spørsmål med vanlig språk og få relevante lovhenvisninger.

## Formål og motivasjon

### Problem

Dagens FTS-løsning krever at brukeren kjenner juridisk terminologi:

```
Bruker søker: "erstatning for feil i bolig"
FTS finner:   ❌ Ingen treff (søker "mangel", ikke "feil")

Bruker søker: "mangel bolig"
FTS finner:   ✅ avhendingslova § 3-9
```

### Løsning

Vektorsøk forstår semantisk likhet:

```
Bruker spør:     "Kan jeg kreve penger tilbake hvis boligen har skjulte feil?"
Vektorsøk:       Finner paragrafer om mangel, erstatning, reklamasjon
LLM svarer:      "Etter avhendingslova § 4-14 kan du kreve erstatning..."
```

### Målgruppe

- Ikke-jurister i virksomheten (Oslobygg KF)
- Prosjektledere, økonomer, byggherrerepresentanter
- Alle som trenger å forstå regelverket uten juridisk bakgrunn

### Brukscase: Lovdata-chat

```
┌─────────────────────────────────────────────────────────────┐
│  Lovdata-chat for Oslobygg                                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Bruker: Hva er reglene for dagmulkt ved forsinkelse?       │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Vektorsøk → relevante paragrafer                    │    │
│  │ • NS 8407 § 40.1 (dagmulkt)                         │    │
│  │ • bustadoppføringslova § 18 (dagmulkt forbruker)    │    │
│  │ • avhendingslova § 4-14 (erstatning)                │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  Assistent: Dagmulkt ved forsinkelse reguleres av...        │
│  [svar med lovhenvisninger]                                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Arkitektur

### Systemdiagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                         Lovdata-chat                                 │
└──────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      Hybrid Search Layer                             │
│  ┌────────────────────────┐    ┌────────────────────────┐           │
│  │   Vektorsøk (70%)      │    │   FTS (30%)            │           │
│  │   Semantisk likhet     │    │   Eksakt match         │           │
│  │   cosine similarity    │    │   ts_rank              │           │
│  └────────────────────────┘    └────────────────────────┘           │
│                    └──────────┬───────────┘                         │
│                               ▼                                      │
│                    Kombinert ranking                                 │
└──────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     Supabase PostgreSQL                              │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ lovdata_sections                                                │ │
│  │ ├── id, dok_id, section_id, title, content                     │ │
│  │ ├── search_vector (tsvector) ← FTS                             │ │
│  │ └── embedding (vector(1536)) ← NY                              │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  Extensions: pgvector                                                │
└──────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    Google Gemini API                                 │
│                    gemini-embedding-001                              │
│                    (embedding-generering)                            │
└──────────────────────────────────────────────────────────────────────┘
```

### Dataflyt ved søk

```
1. Bruker stiller spørsmål
   │
   ▼
2. Generer embedding for spørsmålet
   │  POST gemini-embedding-001
   │  → vector(1536)
   │
   ▼
3. Hybrid søk i Supabase
   │  ├── Vektorsøk: embedding <=> query_embedding
   │  └── FTS: search_vector @@ plainto_tsquery(query)
   │
   ▼
4. Kombiner og ranker resultater
   │  score = 0.7 * semantic + 0.3 * fts
   │
   ▼
5. Returner topp-K relevante paragrafer
   │
   ▼
6. LLM genererer svar med lovhenvisninger
```

---

## Strategiske vurderinger

### Chunk-strategi

**Beslutning:** Behold eksisterende paragraf-struktur med context enrichment.

| Alternativ | Vurdering |
|------------|-----------|
| ❌ Re-chunk til 512 tokens | Mister naturlig juridisk struktur |
| ❌ Overlappende chunks | Kompleksitet, duplikater i resultater |
| ✅ **Paragraf + kontekst** | Beholder struktur, beriker med metadata |

**Context enrichment ved embedding:**

```python
def create_embedding_text(doc: dict, section: dict) -> str:
    """
    Berik paragraf med kontekst for bedre embedding.

    Inkluderer:
    - Lovnavn (gir juridisk kontekst)
    - Paragrafnummer (identifikasjon)
    - Tittel (semantisk hint)
    - Innhold (hovedtekst)
    """
    parts = [
        f"{doc['short_title']} § {section['section_id']}",
    ]
    if section.get('title'):
        parts.append(section['title'])
    parts.append("")  # Blank linje
    parts.append(section['content'])

    return "\n".join(parts)

# Eksempel output:
# "arbeidsmiljøloven § 14-9
#  Midlertidig ansettelse
#
#  Arbeidstaker skal ansettes fast. Avtale om midlertidig
#  ansettelse kan likevel inngås..."
```

### Embedding-modell

**Beslutning:** Google gemini-embedding-001

| Modell | MTEB Multi | Norsk | Gratis | Pris | Valg |
|--------|------------|-------|--------|------|------|
| gemini-embedding-001 | #1 | ✅ 100+ språk | ✅ | $0.15/1M | ✅ |
| text-embedding-3-small | #3 | ✅ God | ❌ | $0.02/1M | |
| BGE-M3 | #2 | ✅ 100+ språk | Self-host | $0 | Backup |

**Begrunnelse:**
- Topprangert på multilingual benchmarks
- Generøs gratis kvote for testing
- Fleksible dimensjoner (768/1536/3072)
- Enkel API, god dokumentasjon

### Dimensjonalitet

**Beslutning:** 1536 dimensjoner (balanse)

| Dimensjon | Lagring | Søkehastighet | Kvalitet |
|-----------|---------|---------------|----------|
| 768 | 3 KB/rad | Raskest | God |
| **1536** | 6 KB/rad | Rask | **Meget god** |
| 3072 | 12 KB/rad | Moderat | Best |

For 92 000 seksjoner:
- 768 dim: ~270 MB
- 1536 dim: ~540 MB
- 3072 dim: ~1.1 GB

### Hybrid vs ren vektorsøk

**Beslutning:** Hybrid search (70% vektor, 30% FTS)

**Begrunnelse:**
- Vektorsøk: Fanger semantisk likhet, synonymer, naturlig språk
- FTS: Fanger eksakte termer, paragrafnumre, juridiske begreper
- Kombinert: Best of both worlds

```sql
-- Hybrid scoring
combined_score = 0.7 * (1 - cosine_distance) + 0.3 * ts_rank
```

### Inkrementell vs full re-embedding

**Beslutning:** Full embedding ved første sync, deretter inkrementell.

```python
# Ved sync: sjekk om content har endret seg
if section.content_hash != stored_hash:
    # Re-embed kun endrede seksjoner
    new_embedding = generate_embedding(section)
    update_embedding(section.id, new_embedding)
```

---

## Kostnadsestimat

### Engangskost (initial embedding)

| Post | Beregning | Kostnad |
|------|-----------|---------|
| 92 000 seksjoner × ~150 tokens | 13.8M tokens | |
| gemini-embedding-001 | $0.15 / 1M tokens | **~$2.10** |
| Innenfor gratis kvote? | Sannsynligvis | **$0** |

### Løpende kostnader

| Post | Estimat | Kostnad/mnd |
|------|---------|-------------|
| Bruker-søk embeddings | 1000 søk × 50 tokens | ~$0.01 |
| Re-sync (månedlig) | ~1000 endrede seksjoner | ~$0.02 |
| pgvector lagring | Inkludert i Supabase | $0 |
| **Total** | | **< $1/mnd** |

---

## Implementeringsplan

### Fase 1: Database-forberedelse

**Fil:** `supabase/migrations/20260204_add_vector_search.sql`

```sql
-- 1. Aktiver pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Legg til embedding-kolonne
ALTER TABLE lovdata_sections
ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- 3. Legg til content hash for inkrementell sync
ALTER TABLE lovdata_sections
ADD COLUMN IF NOT EXISTS content_hash TEXT;

-- 4. Opprett IVFFlat indeks for rask søking
-- (kjøres ETTER embeddings er generert)
-- CREATE INDEX ON lovdata_sections
-- USING ivfflat (embedding vector_cosine_ops)
-- WITH (lists = 100);

-- 5. Hybrid søkefunksjon
CREATE OR REPLACE FUNCTION search_lovdata_hybrid(
    query_text TEXT,
    query_embedding vector(1536),
    match_count INT DEFAULT 10,
    fts_weight FLOAT DEFAULT 0.3
)
RETURNS TABLE (
    id UUID,
    dok_id TEXT,
    section_id TEXT,
    title TEXT,
    content TEXT,
    short_title TEXT,
    doc_type TEXT,
    similarity FLOAT,
    fts_rank FLOAT,
    combined_score FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH vector_search AS (
        SELECT
            s.id,
            s.dok_id,
            s.section_id,
            s.title,
            s.content,
            1 - (s.embedding <=> query_embedding) AS similarity
        FROM lovdata_sections s
        WHERE s.embedding IS NOT NULL
        ORDER BY s.embedding <=> query_embedding
        LIMIT match_count * 3  -- Hent flere for hybrid merge
    ),
    fts_search AS (
        SELECT
            s.id,
            ts_rank(s.search_vector, plainto_tsquery('norwegian', query_text)) AS fts_rank
        FROM lovdata_sections s
        WHERE s.search_vector @@ plainto_tsquery('norwegian', query_text)
        LIMIT match_count * 3
    )
    SELECT
        v.id,
        v.dok_id,
        v.section_id,
        v.title,
        v.content,
        d.short_title,
        d.doc_type,
        v.similarity,
        COALESCE(f.fts_rank, 0) AS fts_rank,
        ((1 - fts_weight) * v.similarity + fts_weight * COALESCE(f.fts_rank, 0)) AS combined_score
    FROM vector_search v
    LEFT JOIN fts_search f ON v.id = f.id
    JOIN lovdata_documents d ON v.dok_id = d.dok_id
    ORDER BY combined_score DESC
    LIMIT match_count;
END;
$$;
```

### Fase 2: Embedding-generering

**Fil:** `scripts/embed_lovdata.py`

```python
#!/usr/bin/env python3
"""
Generer embeddings for alle Lovdata-seksjoner.

Bruk:
    python scripts/embed_lovdata.py
    python scripts/embed_lovdata.py --dry-run
    python scripts/embed_lovdata.py --batch-size 50
"""

import os
import hashlib
import argparse
from typing import Generator

import google.generativeai as genai
from supabase import create_client

# Konfigurasjon
EMBEDDING_MODEL = "models/gemini-embedding-001"
EMBEDDING_DIM = 1536
BATCH_SIZE = 100  # Google API batch limit


def get_supabase_client():
    """Opprett Supabase-klient."""
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SECRET_KEY"]
    return create_client(url, key)


def get_gemini_client():
    """Konfigurer Gemini API."""
    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY eller GOOGLE_API_KEY må settes")
    genai.configure(api_key=api_key)


def content_hash(text: str) -> str:
    """Generer hash av innhold for endringssporing."""
    return hashlib.sha256(text.encode()).hexdigest()[:16]


def create_embedding_text(doc: dict, section: dict) -> str:
    """Berik seksjon med kontekst for bedre embedding."""
    parts = [f"{doc['short_title']} § {section['section_id']}"]
    if section.get('title'):
        parts.append(section['title'])
    parts.append("")
    parts.append(section['content'])
    return "\n".join(parts)


def fetch_sections_needing_embedding(
    supabase,
    batch_size: int = 1000
) -> Generator[list[dict], None, None]:
    """
    Hent seksjoner som mangler eller har utdatert embedding.
    Yielder batches for minneeffektivitet.
    """
    offset = 0
    while True:
        # Hent seksjoner uten embedding eller med endret content
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
    """Hent metadata for alle dokumenter (for context enrichment)."""
    result = supabase.table('lovdata_documents').select(
        'dok_id, short_title, title, doc_type'
    ).execute()
    return {doc['dok_id']: doc for doc in result.data}


def generate_embeddings_batch(texts: list[str]) -> list[list[float]]:
    """Generer embeddings for en batch med tekster."""
    result = genai.embed_content(
        model=EMBEDDING_MODEL,
        content=texts,
        output_dimensionality=EMBEDDING_DIM
    )
    return result['embedding']


def update_section_embeddings(
    supabase,
    updates: list[dict]
) -> None:
    """Oppdater embeddings i database."""
    for update in updates:
        supabase.table('lovdata_sections').update({
            'embedding': update['embedding'],
            'content_hash': update['content_hash']
        }).eq('id', update['id']).execute()


def main():
    parser = argparse.ArgumentParser(description='Generer Lovdata embeddings')
    parser.add_argument('--dry-run', action='store_true', help='Vis hva som ville blitt gjort')
    parser.add_argument('--batch-size', type=int, default=BATCH_SIZE, help='Batch-størrelse')
    parser.add_argument('--limit', type=int, help='Maks antall seksjoner å prosessere')
    args = parser.parse_args()

    print("Initialiserer klienter...")
    supabase = get_supabase_client()
    get_gemini_client()

    print("Henter dokument-metadata...")
    docs = fetch_document_metadata(supabase)
    print(f"  Fant {len(docs)} dokumenter")

    total_processed = 0
    total_tokens = 0

    print("Starter embedding-generering...")
    for section_batch in fetch_sections_needing_embedding(supabase):
        if args.limit and total_processed >= args.limit:
            break

        # Forbered tekster for embedding
        texts = []
        section_ids = []
        for section in section_batch:
            doc = docs.get(section['dok_id'], {})
            text = create_embedding_text(doc, section)
            texts.append(text)
            section_ids.append(section['id'])
            total_tokens += len(text) // 4  # Grovt token-estimat

        if args.dry_run:
            print(f"  [DRY RUN] Ville prosessert {len(texts)} seksjoner")
            total_processed += len(texts)
            continue

        # Generer embeddings i sub-batches (API-grense)
        for i in range(0, len(texts), args.batch_size):
            batch_texts = texts[i:i + args.batch_size]
            batch_ids = section_ids[i:i + args.batch_size]
            batch_sections = section_batch[i:i + args.batch_size]

            embeddings = generate_embeddings_batch(batch_texts)

            # Forbered oppdateringer
            updates = []
            for j, (section_id, embedding, section) in enumerate(
                zip(batch_ids, embeddings, batch_sections)
            ):
                updates.append({
                    'id': section_id,
                    'embedding': embedding,
                    'content_hash': content_hash(section['content'])
                })

            update_section_embeddings(supabase, updates)
            total_processed += len(updates)

            print(f"  Prosessert {total_processed} seksjoner...")

    print(f"\nFerdig!")
    print(f"  Totalt prosessert: {total_processed} seksjoner")
    print(f"  Estimert tokens: {total_tokens:,}")
    print(f"  Estimert kostnad: ${total_tokens * 0.15 / 1_000_000:.2f}")


if __name__ == "__main__":
    main()
```

### Fase 3: Søke-API

**Fil:** `backend/services/lovdata_vector_search.py`

```python
"""
Vektorsøk for Lovdata med hybrid FTS+embedding search.
"""

import os
from dataclasses import dataclass

import google.generativeai as genai

from lib.supabase import get_supabase_client, with_retry


EMBEDDING_MODEL = "models/gemini-embedding-001"
EMBEDDING_DIM = 1536


@dataclass
class VectorSearchResult:
    """Resultat fra hybrid vektorsøk."""
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
        """Formater som lovhenvisning."""
        return f"{self.short_title} § {self.section_id}"


class LovdataVectorSearch:
    """
    Hybrid vektorsøk for Lovdata.

    Kombinerer semantisk vektorsøk med PostgreSQL FTS for
    best mulig treff på både naturlig språk og juridiske termer.
    """

    def __init__(self):
        self.supabase = get_supabase_client()
        self._init_gemini()

    def _init_gemini(self):
        """Konfigurer Gemini API."""
        api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY må settes for vektorsøk")
        genai.configure(api_key=api_key)

    def _generate_query_embedding(self, query: str) -> list[float]:
        """Generer embedding for søkespørring."""
        result = genai.embed_content(
            model=EMBEDDING_MODEL,
            content=query,
            output_dimensionality=EMBEDDING_DIM
        )
        return result['embedding']

    @with_retry()
    def search(
        self,
        query: str,
        limit: int = 10,
        fts_weight: float = 0.3
    ) -> list[VectorSearchResult]:
        """
        Utfør hybrid søk.

        Args:
            query: Søkespørring (naturlig språk)
            limit: Maks antall resultater
            fts_weight: Vekting av FTS vs vektor (0-1)

        Returns:
            Liste med VectorSearchResult sortert etter relevans
        """
        # Generer query embedding
        query_embedding = self._generate_query_embedding(query)

        # Kall hybrid søkefunksjon
        result = self.supabase.rpc('search_lovdata_hybrid', {
            'query_text': query,
            'query_embedding': query_embedding,
            'match_count': limit,
            'fts_weight': fts_weight
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
        limit: int = 10
    ) -> list[VectorSearchResult]:
        """Kun vektorsøk (for testing/sammenligning)."""
        return self.search(query, limit, fts_weight=0.0)

    def search_fts_only(
        self,
        query: str,
        limit: int = 10
    ) -> list[VectorSearchResult]:
        """Kun FTS (for testing/sammenligning)."""
        return self.search(query, limit, fts_weight=1.0)
```

### Fase 4: Testing og evaluering

**Fil:** `scripts/eval_vector_search.py`

```python
#!/usr/bin/env python3
"""
Evaluer vektorsøk vs FTS med test-spørsmål.

Bruk:
    python scripts/eval_vector_search.py
"""

from backend.services.lovdata_vector_search import LovdataVectorSearch

# Test-spørsmål med forventede paragrafer
TEST_QUERIES = [
    {
        "query": "Kan jeg kreve penger tilbake for skjulte feil i boligen?",
        "expected": ["avhendingslova § 4-14", "avhendingslova § 3-9"],
        "category": "naturlig_språk"
    },
    {
        "query": "Regler for midlertidig ansettelse",
        "expected": ["arbeidsmiljøloven § 14-9"],
        "category": "naturlig_språk"
    },
    {
        "query": "Dagmulkt ved forsinkelse i byggeprosjekt",
        "expected": ["bustadoppføringslova § 18"],
        "category": "naturlig_språk"
    },
    {
        "query": "mangel fast eiendom",
        "expected": ["avhendingslova § 3-9"],
        "category": "juridisk_term"
    },
    {
        "query": "erstatning § 4-14",
        "expected": ["avhendingslova § 4-14"],
        "category": "eksakt_referanse"
    },
]


def evaluate():
    search = LovdataVectorSearch()

    results = {
        "hybrid": {"hits": 0, "total": 0},
        "semantic": {"hits": 0, "total": 0},
        "fts": {"hits": 0, "total": 0},
    }

    for test in TEST_QUERIES:
        query = test["query"]
        expected = set(test["expected"])

        print(f"\n{'='*60}")
        print(f"Query: {query}")
        print(f"Expected: {expected}")

        # Test hybrid
        hybrid_results = search.search(query, limit=5)
        hybrid_refs = {r.reference for r in hybrid_results}
        hybrid_hit = bool(expected & hybrid_refs)
        results["hybrid"]["hits"] += int(hybrid_hit)
        results["hybrid"]["total"] += 1
        print(f"\nHybrid: {'✅' if hybrid_hit else '❌'}")
        for r in hybrid_results[:3]:
            print(f"  {r.reference} (score: {r.combined_score:.3f})")

        # Test semantic only
        sem_results = search.search_semantic_only(query, limit=5)
        sem_refs = {r.reference for r in sem_results}
        sem_hit = bool(expected & sem_refs)
        results["semantic"]["hits"] += int(sem_hit)
        results["semantic"]["total"] += 1
        print(f"\nSemantic: {'✅' if sem_hit else '❌'}")
        for r in sem_results[:3]:
            print(f"  {r.reference} (sim: {r.similarity:.3f})")

        # Test FTS only
        fts_results = search.search_fts_only(query, limit=5)
        fts_refs = {r.reference for r in fts_results}
        fts_hit = bool(expected & fts_refs)
        results["fts"]["hits"] += int(fts_hit)
        results["fts"]["total"] += 1
        print(f"\nFTS: {'✅' if fts_hit else '❌'}")
        for r in fts_results[:3]:
            print(f"  {r.reference} (rank: {r.fts_rank:.3f})")

    print(f"\n{'='*60}")
    print("OPPSUMMERING")
    print(f"{'='*60}")
    for method, data in results.items():
        pct = data["hits"] / data["total"] * 100 if data["total"] > 0 else 0
        print(f"{method:12} {data['hits']}/{data['total']} ({pct:.0f}%)")


if __name__ == "__main__":
    evaluate()
```

---

## Implementeringsrekkefølge

```
Fase 1: Database (15 min)
├── Kjør migrasjon for pgvector og embedding-kolonne
└── Verifiser at extension er aktivert

Fase 2: Embedding-generering (30-60 min)
├── Sett GEMINI_API_KEY
├── Kjør scripts/embed_lovdata.py --dry-run
├── Kjør scripts/embed_lovdata.py
└── Opprett IVFFlat indeks etter embedding

Fase 3: Søke-API (15 min)
├── Implementer LovdataVectorSearch
└── Legg til endpoint i backend/routes/

Fase 4: Testing (15 min)
├── Kjør eval_vector_search.py
├── Sammenlign hybrid vs FTS vs semantic
└── Juster fts_weight basert på resultater

Fase 5: Integrasjon (valgfritt)
├── MCP-tool for vektorsøk
└── Chat-grensesnitt
```

---

## Miljøvariabler

```bash
# Påkrevd for embedding-generering
GEMINI_API_KEY=<din-api-nøkkel>

# Alternativt
GOOGLE_API_KEY=<din-api-nøkkel>

# Eksisterende Supabase-variabler
SUPABASE_URL=<prosjekt-url>
SUPABASE_SECRET_KEY=<service-role-key>
```

---

## Risiko og mitigering

| Risiko | Sannsynlighet | Konsekvens | Mitigering |
|--------|---------------|------------|------------|
| Gemini API utilgjengelig | Lav | Søk feiler | Fallback til FTS |
| Dårlig norsk embedding-kvalitet | Medium | Irrelevante treff | Test og juster, vurder BGE-M3 |
| Høy latens | Lav | Treg UX | Cache query embeddings |
| Kostnad overskrider estimat | Lav | Budsjett | Monitor bruk, sett alerts |

---

## Suksesskriterier

1. **Recall@5 > 80%** på test-spørsmål med naturlig språk
2. **Latens < 500ms** for hybrid søk
3. **Hybrid > FTS** på naturlig-språk-kategorien
4. **Kostnad < $5/mnd** ved normal bruk

---

## Neste steg

1. [ ] Opprett Gemini API-nøkkel (Google AI Studio)
2. [ ] Kjør database-migrasjon
3. [ ] Generer embeddings
4. [ ] Test og evaluer
5. [ ] Integrer i Lovdata-chat

---

## Referanser

- [Gemini Embedding-001 Launch](https://multilingual.com/gemini-embedding-001-launch/)
- [pgvector Documentation](https://github.com/pgvector/pgvector)
- [Supabase Vector Search](https://supabase.com/docs/guides/ai/vector-columns)
- [Scandinavian Embedding Benchmark](https://kennethenevoldsen.com/scandinavian-embedding-benchmark/)
- [MMTEB Multilingual Benchmark](https://arxiv.org/abs/2502.13595)
