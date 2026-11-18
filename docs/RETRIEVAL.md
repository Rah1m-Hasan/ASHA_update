# Retrieval for ASHA's app guides

ASHA answers "how does the app work" questions from eight short app guides (`okf/`). Patient speech pairs that a caregiver confirmed are also used as evidence, but they never leave the ASHA server.

## Pipeline

1. **Corpus.** `scripts/build-knowledge-corpus.mjs` turns the OKF guides into `supabase/functions/asha-knowledge/corpus.ts` (8 concepts, 52 sentences, corpus version `3b618589e5fbfe47`). Each guide keeps its provenance and verification note.
2. **Semantic chunking.** Sentences are embedded with `gte-small` (384 dimensions, mean pooled, normalised). A chunk ends where the similarity between neighbouring sentences drops below that guide's 30th percentile, within 120 to 480 characters. Long guides are embedded in windows of 6 sentences to stay inside the edge function's compute limit.
3. **Contextual chunk headers.** Every chunk is embedded and indexed with a header such as "ASHA app guide: Caregiver (caregiver module)." so that a short passage still carries its topic.
4. **Deduplication.** Chunks with cosine similarity of 0.97 or more across guides are merged. None were found in this corpus.
5. **Knowledge graph.** `asha_knowledge_edges` holds 28 edges: 12 "mentions" edges (one guide names another module) and 16 "similar" edges (guide centroids with cosine of 0.8 or more, top two per guide).
6. **Index.** Supabase Postgres with pgvector (HNSW, cosine) and a full-text GIN index (`english` configuration), in tables prefixed `asha_knowledge_` with row-level security on and no anon access.
7. **Query rewriting.** `rewriteQuery` in `src/server/lib/retrieval.js` maps Bangla and colloquial words to the canonical English terms of the app's existing curated lexicon (for example জেগে → wake, অনুরোধ → request). The English-only embedder and full-text index then see the English terms.
8. **Hybrid search.** `asha_hybrid_search` fuses the semantic and full-text rankings with reciprocal rank fusion (k = 50).
9. **Graph expansion.** The app serves the top two hybrid passages, then the best passage from a graph neighbour of the top guides.
10. **Fallback.** The app calls the `asha-knowledge` edge function with a 1.5 second timeout and a 10 minute cache. Any error, timeout or missing configuration falls back to the in-app BM25 ranking over the same guides. `ASHA_HYBRID_RETRIEVAL=0` keeps everything local.

Last index run, 2026-11-18: 8 guides, 52 sentences, 20 chunks (205 characters on average), 0 merged duplicates, 28 edges, 13.2 seconds of embedding time in total.

## Evaluation

`okf/eval/retrieval-cases.json` holds 34 paraphrased questions (23 English, 11 Bangla), each with the guides that answer it. `node scripts/retrieval-eval.mjs` scores every method at passage level: recall@3 counts a question as answered when one of the top three passages comes from an expected guide, and MRR uses the first such passage within the top five. Full results are in [`retrieval-eval.json`](retrieval-eval.json).

| Method                              | All recall@3 | All MRR   | English MRR | Bangla recall@3 | Bangla MRR |
| ----------------------------------- | ------------ | --------- | ----------- | --------------- | ---------- |
| In-app BM25 with lexicon (fallback) | 0.941        | 0.882     | 0.826       | 1.000           | 1.000      |
| Full text only, rewritten           | 0.941        | 0.877     | 0.841       | 1.000           | 0.955      |
| Semantic only, rewritten            | **1.000**    | **0.966** | **0.978**   | 1.000           | 0.939      |
| Hybrid RRF, rewritten               | **1.000**    | 0.941     | 0.935       | 1.000           | 0.955      |
| Hybrid + graph, rewritten (served)  | **1.000**    | 0.956     | 0.957       | 1.000           | 0.955      |
| Hybrid + graph, no rewriting        | 0.765        | 0.701     | 0.957       | 0.273           | 0.167      |

What the numbers say:

- Every rewritten Supabase method finds an answering passage in the top three for all 34 questions. The in-app BM25 fallback misses 2 of 34.
- Query rewriting matters most. Without it, the served ranking answers only 3 of 11 Bangla questions, because `gte-small` and the `english` full-text configuration do not understand Bangla. English results do not change.
- Semantic search alone ranks best on English (MRR 0.978). Full text misses two English paraphrases entirely ("My father cannot see the screen" and "slumping in my chair"), and that pulls the fused ranking down a little.
- Graph expansion lifts the hybrid MRR from 0.941 to 0.956. The served ordering uses it.
- On Bangla, the in-app BM25 scores 1.000 because both it and the rewriting use the same curated lexicon. The hybrid index gives no gain there yet.

Limits of this evaluation: the questions were written by the ASHA team and not by patients, the set is small, and the eight guides are short. Treat the numbers as a check that the pipeline works, not as a benchmark. A larger set of real, consented caregiver questions is the next step.

## Reproducing

```bash
node scripts/build-knowledge-corpus.mjs          # rebuild corpus.ts from okf/
node scripts/retrieval-eval.mjs --payloads       # print the eval batches (6 cases each)
SUPABASE_URL=... SUPABASE_SECRET_KEY=... node scripts/retrieval-eval.mjs
node scripts/retrieval-eval.mjs --rows rows.json # score saved rows from the edge function
```

The edge function runs at most 6 cases per request. Larger batches, or several batches in parallel, hit the Supabase worker compute limit.
