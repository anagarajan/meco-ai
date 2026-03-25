import type { AppSettings, MemoryItem, MemoryType, RetrievalCandidate } from "../../types/domain";
import { extractQuerySubject } from "../ai/localHeuristicProvider";
import { getAIRegistry } from "../ai/registry";
import { getActiveMemories } from "../storage/localRepository";

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
  return 0; // no penalty — subject mismatch is not evidence against the memory
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

export async function answerMemoryQuestion(question: string, settings: AppSettings): Promise<string> {
  const registry = getAIRegistry(settings);
  const queryType = inferQueryType(question);
  const querySubject = extractQuerySubject(question);
  const queryEmbedding = await registry.embeddingProvider.embed(question, settings);

  const memories = await getActiveMemories();

  // All active memories with embeddings and non-empty text — no hard type filter
  const pool = memories.filter((m) => !m.deleted_at && m.embedding && m.embedding.length > 0 && m.canonical_text.trim());

  if (pool.length === 0) {
    return "You have no saved memories yet. Switch to Remember mode and start saving some facts!";
  }

  const candidates = pool
    .map((memory) => {
      const semanticScore = cosineSimilarity(queryEmbedding, memory.embedding ?? []);
      return {
        memory,
        semanticScore,
        finalScore: rerank(memory, semanticScore, querySubject, queryType),
      } satisfies RetrievalCandidate;
    })
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, 3);

  // If the best candidate scores very poorly on semantics, report no match.
  // Threshold is intentionally low (0.02) — the n-gram embedding with 256 buckets
  // already gives near-zero for truly unrelated texts, so anything above this
  // means some surface-level overlap exists and is worth reasoning over.
  if (candidates[0].semanticScore < 0.02) {
    const hint = pool.length > 0
      ? ` You have ${pool.length} saved ${pool.length === 1 ? "memory" : "memories"} — try rephrasing or check the Memories tab to see what's stored.`
      : "";
    return `I could not find a saved memory that answers "${question}".${hint}`;
  }

  const reasoningContext = candidates.map((c) => c.memory.canonical_text);

  const answerBody = await registry.reasoningProvider.answer(question, reasoningContext, settings);
  return formatAnswer(question, candidates, answerBody);
}
