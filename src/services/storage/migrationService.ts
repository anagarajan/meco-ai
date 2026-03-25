import type { AppSettings } from "../../types/domain";
import { getAIRegistry } from "../ai/registry";
import { db } from "./database";
import { getActiveMemories, saveSettings } from "./localRepository";

/** Force re-embed every active memory with the current provider. */
export async function reindexAllMemories(settings: AppSettings): Promise<number> {
  const memories = await getActiveMemories();
  const registry = getAIRegistry(settings);
  for (const memory of memories) {
    const embedding = await registry.embeddingProvider.embed(memory.canonical_text, settings);
    await db.memory_embeddings.put({ memory_id: memory.id, embedding });
  }
  const updated = { ...settings, embedding_version: CURRENT_EMBEDDING_VERSION };
  await saveSettings(updated);
  return memories.length;
}

// Increment this when the embedding format changes.
const CURRENT_EMBEDDING_VERSION = 2;

export async function migrateEmbeddingsIfNeeded(settings: AppSettings): Promise<AppSettings> {
  if ((settings.embedding_version ?? 1) >= CURRENT_EMBEDDING_VERSION) {
    return settings;
  }

  const memories = await getActiveMemories();
  if (memories.length === 0) {
    const updated = { ...settings, embedding_version: CURRENT_EMBEDDING_VERSION };
    await saveSettings(updated);
    return updated;
  }

  const registry = getAIRegistry(settings);

  // Re-embed in batches to avoid blocking the main thread for large collections
  for (const memory of memories) {
    const newEmbedding = await registry.embeddingProvider.embed(memory.canonical_text, settings);
    await db.memory_embeddings.put({ memory_id: memory.id, embedding: newEmbedding });
  }

  const updated = { ...settings, embedding_version: CURRENT_EMBEDDING_VERSION };
  await saveSettings(updated);
  return updated;
}
