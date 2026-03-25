import type { MemoryItem } from "../../types/domain";
import { cosineSimilarity } from "./retrievalService";
import { getActiveMemories } from "../storage/localRepository";

const DUPLICATE_THRESHOLD = 0.82;

/**
 * Returns the most similar existing memory if its cosine similarity
 * to the given embedding exceeds DUPLICATE_THRESHOLD, otherwise null.
 */
export async function findDuplicate(embedding: number[]): Promise<MemoryItem | null> {
  const memories = await getActiveMemories();
  let bestScore = 0;
  let bestMemory: MemoryItem | null = null;

  for (const memory of memories) {
    if (!memory.embedding || memory.embedding.length === 0) continue;
    const score = cosineSimilarity(embedding, memory.embedding);
    if (score > bestScore) {
      bestScore = score;
      bestMemory = memory;
    }
  }

  return bestScore >= DUPLICATE_THRESHOLD ? bestMemory : null;
}
