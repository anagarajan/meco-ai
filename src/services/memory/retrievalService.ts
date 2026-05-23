import type { AppSettings, MemoryItem, MemoryType, RetrievalCandidate } from "../../types/domain";
import { extractQuerySubject } from "../ai/localHeuristicProvider";
import { getAIRegistry } from "../ai/registry";
import { getActiveMemories } from "../storage/localRepository";
import type { ConversationTurn } from "../ai/types";

function inferQueryType(question: string): MemoryType | undefined {
  const s = question.toLowerCase();
  if (/\bwhere\b/.test(s)) return "object_location";
  if (/\bpromised?\b|\bowe\b/.test(s)) return "commitment";
  if (/\bwhat do i know about\b|\btell me about\b/.test(s)) return "person_fact";
  if (/\blike\b|\bprefer\b|\bfavorite\b|\bfavourite\b|\beat\b|\bdrink\b/.test(s)) return "preference";
  if (/\bwhen\s+(is|was|did)\b|\bappointment\b|\bbirthday\b/.test(s)) return "event";
  return undefined;
}

export function cosineSimilarity(left: number[], right: number[]): number {
  let numerator = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  const len = Math.max(left.length, right.length);
  for (let i = 0; i < len; i++) {
    const a = left[i] ?? 0;
    const b = right[i] ?? 0;
    numerator += a * b;
    leftNorm += a * a;
    rightNorm += b * b;
  }
  return numerator / ((Math.sqrt(leftNorm) || 1) * (Math.sqrt(rightNorm) || 1));
}

function subjectBoost(querySubject?: string, candidateSubject?: unknown): number {
  const candidate = typeof candidateSubject === "string" ? candidateSubject.toLowerCase().trim() : "";
  const query = querySubject?.toLowerCase().trim() ?? "";
  if (!query || !candidate) return 0;
  if (query === candidate) return 0.5;
  if (candidate.includes(query) || query.includes(candidate)) return 0.25;
  return 0;
}

function typeBoost(queryType: MemoryType | undefined, memoryType: MemoryType): number {
  if (!queryType) return 0;
  return queryType === memoryType ? 0.15 : 0;
}

export function rerank(
  memory: MemoryItem,
  semanticScore: number,
  querySubject?: string,
  queryType?: MemoryType,
): number {
  const ageBoost = new Date(memory.created_at).getTime() / 10_000_000_000_000;
  const confidenceBoost = memory.confidence * 0.15;
  const supersededPenalty = memory.superseded_by ? 0.25 : 0;
  return (
    semanticScore
    + ageBoost
    + confidenceBoost
    + subjectBoost(querySubject, memory.payload_json.subject)
    + typeBoost(queryType, memory.memory_type)
    - supersededPenalty
  );
}

function formatAnswer(question: string, candidates: RetrievalCandidate[], answerBody: string): string {
  if (candidates.length === 0) {
    return `I could not find a saved memory that answers "${question}".`;
  }

  const body = answerBody.trim();
  if (!body) {
    return `I found a related memory but it has no text content (it may be a voice note saved before transcription was available). Try re-saving it using the Remember tab.`;
  }

  const lines = [body];

  if (candidates.length > 1 && Math.abs(candidates[0].finalScore - candidates[1].finalScore) < 0.06) {
    lines.push("Note: I found nearby memories — there may be some ambiguity.");
  }

  if (candidates[0].memory.confidence < 0.65) {
    lines.push("Note: This memory was saved with lower confidence.");
  }

  const date = new Intl.DateTimeFormat(undefined, { month: "long", day: "numeric", year: "numeric" }).format(
    new Date(candidates[0].memory.created_at),
  );
  const kind = candidates[0].memory.source_kind.replace("_", " ");
  lines.push(`Saved on ${date} from a ${kind}.`);

  return lines.join("\n");
}

/** Number of candidates to retrieve before LLM re-ranking. */
const RETRIEVAL_POOL_SIZE = 10;
/** Number of candidates to keep after LLM re-ranking. */
const FINAL_TOP_K = 3;

export async function answerMemoryQuestion(question: string, settings: AppSettings, history?: ConversationTurn[]): Promise<string> {
  const registry = getAIRegistry(settings);
  const queryType = inferQueryType(question);
  const querySubject = extractQuerySubject(question);

  // ── Step 1: HyDE — embed a hypothetical answer instead of the raw question ──
  // The LLM generates a short factual statement that would ideally answer
  // the question. This hypothetical answer lives in the same semantic space
  // as stored memories (declarative facts), improving retrieval for
  // short or ambiguous queries.
  let hydeText: string;
  try {
    hydeText = await registry.reasoningProvider.generateHypotheticalAnswer(question, settings);
  } catch {
    // Fallback to raw question if HyDE generation fails
    hydeText = question;
  }

  // Embed both the HyDE text and the original question, then average them.
  // This preserves the intent of the original query while gaining the
  // semantic alignment benefit of the hypothetical answer.
  const [hydeEmbedding, queryEmbedding] = await Promise.all([
    registry.embeddingProvider.embed(hydeText, settings),
    registry.embeddingProvider.embed(question, settings),
  ]);

  const combinedEmbedding = hydeEmbedding.map((v, i) => (v + (queryEmbedding[i] ?? 0)) / 2);

  const memories = await getActiveMemories();

  const pool = memories.filter((m) => !m.deleted_at && m.embedding && m.embedding.length > 0 && m.canonical_text.trim());

  if (pool.length === 0) {
    return "You have no saved memories yet. Switch to Remember mode and start saving some facts!";
  }

  // ── Step 2: Retrieve top candidates by cosine similarity + heuristic re-rank ──
  const initialCandidates = pool
    .map((memory) => {
      const semanticScore = cosineSimilarity(combinedEmbedding, memory.embedding ?? []);
      return {
        memory,
        semanticScore,
        finalScore: rerank(memory, semanticScore, querySubject, queryType),
      } satisfies RetrievalCandidate;
    })
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, RETRIEVAL_POOL_SIZE);

  // If the best candidate scores very poorly on semantics, report no match.
  if (initialCandidates[0].semanticScore < 0.02) {
    const hint = pool.length > 0
      ? ` You have ${pool.length} saved ${pool.length === 1 ? "memory" : "memories"} — try rephrasing or check the Memories tab to see what's stored.`
      : "";
    return `I could not find a saved memory that answers "${question}".${hint}`;
  }

  // ── Step 3: LLM cross-encoder re-ranking ──
  // Pass the top candidates through the LLM as a cross-encoder. It sees
  // both the question and each candidate together, catching relevance
  // that vector distance alone misses.
  let candidates: RetrievalCandidate[];
  try {
    const candidateTexts = initialCandidates.map((c) => c.memory.canonical_text);
    const llmScores = await registry.reasoningProvider.rerankCandidates(question, candidateTexts, settings);

    // Combine: 60% LLM score (normalized to 0-1) + 40% original heuristic score
    candidates = initialCandidates
      .map((c, i) => ({
        ...c,
        finalScore: (llmScores[i] / 10) * 0.6 + c.finalScore * 0.4,
      }))
      .sort((a, b) => b.finalScore - a.finalScore)
      .slice(0, FINAL_TOP_K);
  } catch {
    // Fallback: use heuristic-only ranking if LLM re-ranking fails
    candidates = initialCandidates.slice(0, FINAL_TOP_K);
  }

  const reasoningContext = candidates.map((c) => c.memory.canonical_text);

  const answerBody = await registry.reasoningProvider.answer(question, reasoningContext, settings, history);
  return formatAnswer(question, candidates, answerBody);
}
