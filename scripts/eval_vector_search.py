#!/usr/bin/env python3
"""
Evaluate vector search vs FTS with test queries.

Usage:
    python scripts/eval_vector_search.py
    python scripts/eval_vector_search.py --verbose
"""

import os
import sys
import argparse

# Add backend to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from services.lovdata_vector_search import LovdataVectorSearch

# Test queries with expected paragraphs
# 25+ diverse queries across categories for robust evaluation
TEST_QUERIES = [
    # === Natural language (non-lawyers) ===
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
        "query": "Hvor lenge kan arbeidsgiver ansette midlertidig?",
        "expected": ["arbeidsmiljøloven § 14-9"],
        "category": "naturlig_språk"
    },
    {
        "query": "Hva skjer hvis entreprenøren leverer for sent?",
        "expected": ["bustadoppføringslova § 17", "bustadoppføringslova § 18"],
        "category": "naturlig_språk"
    },
    {
        "query": "Når må arbeidsgiver varsle om oppsigelse?",
        "expected": ["arbeidsmiljøloven § 15-3", "arbeidsmiljøloven § 15-4"],
        "category": "naturlig_språk"
    },
    {
        "query": "Må jeg betale for feil som var der da jeg kjøpte boligen?",
        "expected": ["avhendingslova § 3-9", "avhendingslova § 3-7"],
        "category": "naturlig_språk"
    },
    {
        "query": "Hvor mye kan jeg kreve i erstatning for byggeprosjektfeil?",
        "expected": ["bustadoppføringslova § 35", "bustadoppføringslova § 36"],
        "category": "naturlig_språk"
    },

    # === Legal terms ===
    {
        "query": "mangel fast eiendom",
        "expected": ["avhendingslova § 3-9"],
        "category": "juridisk_term"
    },
    {
        "query": "reklamasjonsfrist boligkjøp",
        "expected": ["avhendingslova § 4-19"],
        "category": "juridisk_term"
    },
    {
        "query": "opplysningsplikt selger",
        "expected": ["avhendingslova § 3-7", "avhendingslova § 3-8"],
        "category": "juridisk_term"
    },
    {
        "query": "utbedring mangel",
        "expected": ["avhendingslova § 4-10", "bustadoppføringslova § 32"],
        "category": "juridisk_term"
    },
    {
        "query": "prisavslag bolig",
        "expected": ["avhendingslova § 4-12"],
        "category": "juridisk_term"
    },
    {
        "query": "heving kjøp bolig",
        "expected": ["avhendingslova § 4-13"],
        "category": "juridisk_term"
    },
    {
        "query": "kontraktsbrudd entreprenør",
        "expected": ["bustadoppføringslova § 17", "bustadoppføringslova § 28"],
        "category": "juridisk_term"
    },

    # === Exact references ===
    {
        "query": "erstatning § 4-14",
        "expected": ["avhendingslova § 4-14"],
        "category": "eksakt_referanse"
    },
    {
        "query": "arbeidsmiljøloven § 14-9",
        "expected": ["arbeidsmiljøloven § 14-9"],
        "category": "eksakt_referanse"
    },
    {
        "query": "avhendingslova § 3-9 mangel",
        "expected": ["avhendingslova § 3-9"],
        "category": "eksakt_referanse"
    },
    {
        "query": "forvaltningsloven § 11 veiledningsplikt",
        "expected": ["forvaltningsloven § 11"],
        "category": "eksakt_referanse"
    },

    # === Construction law (primary use case) ===
    {
        "query": "krav om endring byggeprosjekt",
        "expected": ["bustadoppføringslova § 9"],
        "category": "entreprise"
    },
    {
        "query": "overtakelse nybygg",
        "expected": ["bustadoppføringslova § 14", "bustadoppføringslova § 15"],
        "category": "entreprise"
    },
    {
        "query": "sluttoppgjør entreprise",
        "expected": ["bustadoppføringslova § 48"],
        "category": "entreprise"
    },
    {
        "query": "garantistillelse entreprenør",
        "expected": ["bustadoppføringslova § 12"],
        "category": "entreprise"
    },
]


def evaluate(verbose: bool = False):
    """Run evaluation comparing hybrid, semantic, and FTS search."""
    search = LovdataVectorSearch()

    # Check embedding coverage
    stats = search.get_embedding_stats()
    print(f"Embedding coverage: {stats['embedded_sections']}/{stats['total_sections']} "
          f"({stats['coverage_pct']:.1f}%)")

    if stats['coverage_pct'] < 50:
        print("\n⚠️  Warning: Less than 50% of sections have embeddings.")
        print("   Run 'python scripts/embed_lovdata.py' first.\n")

    results = {
        "hybrid": {"hits": 0, "total": 0},
        "semantic": {"hits": 0, "total": 0},
        "fts": {"hits": 0, "total": 0},
    }

    category_results = {}

    for test in TEST_QUERIES:
        query = test["query"]
        expected = set(test["expected"])
        category = test["category"]

        if category not in category_results:
            category_results[category] = {
                "hybrid": {"hits": 0, "total": 0},
                "semantic": {"hits": 0, "total": 0},
                "fts": {"hits": 0, "total": 0},
            }

        if verbose:
            print(f"\n{'='*60}")
            print(f"Query: {query}")
            print(f"Expected: {expected}")

        # Test hybrid
        hybrid_results = search.search(query, limit=5)
        hybrid_refs = {r.reference for r in hybrid_results}
        hybrid_hit = bool(expected & hybrid_refs)
        results["hybrid"]["hits"] += int(hybrid_hit)
        results["hybrid"]["total"] += 1
        category_results[category]["hybrid"]["hits"] += int(hybrid_hit)
        category_results[category]["hybrid"]["total"] += 1

        if verbose:
            print(f"\nHybrid: {'✅' if hybrid_hit else '❌'}")
            for r in hybrid_results[:3]:
                print(f"  {r.reference} (score: {r.combined_score:.3f})")

        # Test semantic only
        sem_results = search.search_semantic_only(query, limit=5)
        sem_refs = {r.reference for r in sem_results}
        sem_hit = bool(expected & sem_refs)
        results["semantic"]["hits"] += int(sem_hit)
        results["semantic"]["total"] += 1
        category_results[category]["semantic"]["hits"] += int(sem_hit)
        category_results[category]["semantic"]["total"] += 1

        if verbose:
            print(f"\nSemantic: {'✅' if sem_hit else '❌'}")
            for r in sem_results[:3]:
                print(f"  {r.reference} (sim: {r.similarity:.3f})")

        # Test FTS only
        fts_results = search.search_fts_only(query, limit=5)
        fts_refs = {r.reference for r in fts_results}
        fts_hit = bool(expected & fts_refs)
        results["fts"]["hits"] += int(fts_hit)
        results["fts"]["total"] += 1
        category_results[category]["fts"]["hits"] += int(fts_hit)
        category_results[category]["fts"]["total"] += 1

        if verbose:
            print(f"\nFTS: {'✅' if fts_hit else '❌'}")
            for r in fts_results[:3]:
                print(f"  {r.reference} (rank: {r.fts_rank:.3f})")

    # Summary
    print(f"\n{'='*60}")
    print("SUMMARY - Overall")
    print(f"{'='*60}")
    for method, data in results.items():
        pct = data["hits"] / data["total"] * 100 if data["total"] > 0 else 0
        bar = "█" * int(pct / 5) + "░" * (20 - int(pct / 5))
        print(f"{method:12} {data['hits']:2}/{data['total']:2} ({pct:5.1f}%) {bar}")

    print(f"\n{'='*60}")
    print("SUMMARY - By Category")
    print(f"{'='*60}")
    for category, cat_data in category_results.items():
        print(f"\n{category}:")
        for method, data in cat_data.items():
            pct = data["hits"] / data["total"] * 100 if data["total"] > 0 else 0
            print(f"  {method:12} {data['hits']:2}/{data['total']:2} ({pct:5.1f}%)")

    # Success criteria check
    print(f"\n{'='*60}")
    print("SUCCESS CRITERIA")
    print(f"{'='*60}")
    hybrid_pct = results["hybrid"]["hits"] / results["hybrid"]["total"] * 100
    semantic_pct = results["semantic"]["hits"] / results["semantic"]["total"] * 100
    fts_pct = results["fts"]["hits"] / results["fts"]["total"] * 100

    criteria = [
        (f"Recall@5 > 80%", hybrid_pct > 80, f"{hybrid_pct:.1f}%"),
        (f"Hybrid > FTS", hybrid_pct > fts_pct, f"{hybrid_pct:.1f}% vs {fts_pct:.1f}%"),
        (f"Semantic > 60%", semantic_pct > 60, f"{semantic_pct:.1f}%"),
    ]

    all_passed = True
    for name, passed, value in criteria:
        status = "✅" if passed else "❌"
        print(f"{status} {name}: {value}")
        if not passed:
            all_passed = False

    return all_passed


def main():
    parser = argparse.ArgumentParser(description='Evaluate Lovdata vector search')
    parser.add_argument('--verbose', '-v', action='store_true',
                        help='Show detailed results for each query')
    args = parser.parse_args()

    success = evaluate(verbose=args.verbose)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
