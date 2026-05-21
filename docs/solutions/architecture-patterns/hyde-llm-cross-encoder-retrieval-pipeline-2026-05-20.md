---
title: "Three-Stage Retrieval Pipeline: HyDE + Cosine Similarity + LLM Cross-Encoder"
date: 2026-05-20
category: architecture-patterns
module: Retrieval
problem_type: architecture_pattern
component: assistant
severity: high
applies_when:
  - Building a memory retrieval system where queries are short or ambiguous natural language
  - Vector similarity alone returns irrelevant results for queries like "what did I say about dinner?"
  - You need top-k precision, not recall — the answer goes directly to an LLM with a limited context window
tags:
  - retrieval
  - hyde
  - rag
  - embeddings
  - cross-encoder
  - reranking
  - llm
  - semantic-search
---

# Three-Stage Retrieval Pipeline: HyDE + Cosine Similarity + LLM Cross-Encoder

## Context

The original retrieval pipeline embedded the raw user query and found the top memories by cosine similarity, then applied a heuristic reranker (recency, confidence, subject match, type match). This worked for explicit queries ("where did I put my keys") but failed for short or ambiguous phrasing ("what about dinner?") — short queries produce embeddings far from the stored declarative facts that answer them. Only the top 3 memories reach the answer LLM, so precision matters more than recall.

## Guidance

The pipeline in `src/services/memory/retrievalService.ts` uses three sequential stages:

### Stage 1: HyDE — Hypothetical Document Embedding

Instead of embedding the raw question, ask the LLM to generate a short hypothetical answer, then embed that:

```typescript
// Generate hypothetical answer
let hydeText: string;
try {
  hydeText = await registry.reasoningProvider.generateHypotheticalAnswer(question, settings);
} catch {
  hydeText = question; // fallback to raw query on LLM failure
}

// Embed both, then average — preserves original intent while gaining semantic alignment
const [hydeEmbedding, queryEmbedding] = await Promise.all([
  registry.embeddingProvider.embed(hydeText, settings),
  registry.embeddingProvider.embed(question, settings),
]);
const combinedEmbedding = hydeEmbedding.map((v, i) => (v + (queryEmbedding[i] ?? 0)) / 2);
```

**Why this helps:** stored memories are declarative facts ("I prefer sushi"), not questions. The HyDE text ("The user prefers sushi for dinner") lives in the same semantic space and retrieves much better. Averaging with the raw query embedding prevents the hypothetical from drifting too far from the user's actual intent.

### Stage 2: Cosine Similarity + Heuristic Reranking

Rank all memories by the combined embedding, apply heuristic boosts, and take the top `RETRIEVAL_POOL_SIZE` (10) candidates:

```typescript
const RETRIEVAL_POOL_SIZE = 10;

const initialCandidates = pool
  .map((memory) => {
    const semanticScore = cosineSimilarity(combinedEmbedding, memory.embedding ?? []);
    return {
      memory,
      semanticScore,
      finalScore: rerank(memory, semanticScore, querySubject, queryType),
    };
  })
  .sort((a, b) => b.finalScore - a.finalScore)
  .slice(0, RETRIEVAL_POOL_SIZE);
```

The `rerank()` function adds: recency (age-based fraction), confidence, subject overlap, memory-type match, and subtracts a superseded-memory penalty. This stage is cheap (pure CPU, no API call) and narrows the field from hundreds of memories to 10.

Early exit: if the best candidate's raw semantic score is below `0.02`, the question is likely about something not stored at all — skip the LLM call and return an error message immediately.

### Stage 3: LLM Cross-Encoder Reranking

Pass the top 10 candidates through the LLM as a cross-encoder — it sees both the question and each candidate together (the joint-encoding guarantee is provider-dependent; `rerankCandidates()` must present them together for true cross-encoder scoring):

```typescript
const FINAL_TOP_K = 3;

try {
  const candidateTexts = initialCandidates.map((c) => c.memory.canonical_text);
  const llmScores = await registry.reasoningProvider.rerankCandidates(question, candidateTexts, settings);

  // 60% LLM score (normalized to 0–1) + 40% heuristic score
  candidates = initialCandidates
    .map((c, i) => ({ ...c, finalScore: (llmScores[i] / 10) * 0.6 + c.finalScore * 0.4 }))
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, FINAL_TOP_K);
} catch {
  candidates = initialCandidates.slice(0, FINAL_TOP_K); // fallback to heuristic-only
}
```

The cross-encoder catches relevance that vector distance alone misses (semantic overlap without the right answer, or near-synonyms). The 60/40 blend keeps the cheap heuristic signals (recency, superseded penalty) in play.

## Why This Matters

| Approach | Strength | Weakness |
|----------|----------|----------|
| Raw query embedding only | Fast, zero extra API calls | Short queries produce poor embeddings; semantic mismatch between question form and declarative stored facts |
| HyDE averaging | Bridges the query-fact semantic gap | Adds one LLM call and one extra embed; hypothetical can drift |
| Heuristic reranker only | CPU-only, handles recency/confidence | Cannot catch semantic relevance mismatches |
| LLM cross-encoder only | Highest precision | Expensive at scale; cannot run on all memories |
| **Three-stage (current)** | Best precision on top-3 with bounded cost | Two extra API calls per query; failure modes require fallbacks |

The architecture is designed for small-to-medium memory stores (hundreds, not millions). The `RETRIEVAL_POOL_SIZE = 10` cap ensures the LLM cross-encoder receives a tractable number of candidates regardless of total store size.

## When to Apply

- Use this pattern when queries are conversational and the stored facts are declarative (question-answer semantic mismatch)
- Adjust `RETRIEVAL_POOL_SIZE` upward if recall is poor; the LLM cross-encoder cost is linear in pool size
- Skip the LLM cross-encoder (fallback to heuristic-only) if latency is critical or the LLM is unavailable — the fallback is already wired in

## Examples

**Short ambiguous query:** "What about dinner?"
- Raw embedding → poor cosine match against declarative facts like "I prefer sushi"
- HyDE → "The user has a preference or memory related to dinner or food" → embeds near food-related memories → good pool
- LLM cross-encoder → picks the sushi memory over a memory about a dinner reservation date

**Explicit query:** "Where did I put my passport?"
- Both raw embedding and HyDE produce good vectors → stage 1 sufficient
- LLM cross-encoder still runs but makes little difference when semantic overlap is already strong

## Related

- Source: `src/services/memory/retrievalService.ts` — `answerMemoryQuestion()`
- Commit introducing this pattern: `e4fcce9`: `feat: add HyDE and LLM cross-encoder re-ranking to retrieval pipeline`
- Note: the README's "How RAG and Embeddings Work" section still describes the older heuristic-only pipeline and is now outdated — it does not mention HyDE or the LLM cross-encoder stage
