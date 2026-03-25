import type { AppSettings, MemoryItem, SourceRecord } from "../../types/domain";
import { getAIRegistry } from "../ai/registry";
import { createMemory, getActiveMemories, updateMemory } from "../storage/localRepository";
import { findDuplicate } from "./duplicateDetector";

function isExplicitSave(text: string): boolean {
  const t = text.trim().toLowerCase();
  return (
    /^(remember|save)\b/.test(t) ||
    /\b(remember that|save that|note that|don't forget|dont forget|keep in mind|please remember|please save|please note)\b/.test(t)
  );
}

function normalizeExplicitText(text: string): string {
  return text
    .replace(/^(please\s+)?(remember|save|note)( that)?/i, "")
    .replace(/^(don'?t forget|keep in mind|please note|please remember|please save)( that)?/i, "")
    .trim();
}

export interface MemoryCreateResult {
  memory: MemoryItem;
  duplicateWarning?: string;
}

async function saveOneMemory(
  itemText: string,
  messageId: string,
  sourceKind: MemoryItem["source_kind"],
  registry: ReturnType<typeof getAIRegistry>,
  settings: AppSettings,
): Promise<MemoryCreateResult> {
  const extraction = await registry.memoryExtractionProvider.extract(normalizeExplicitText(itemText), settings);
  const embedding = await registry.embeddingProvider.embed(extraction.canonicalText, settings);

  const duplicate = await findDuplicate(embedding);
  const duplicateWarning = duplicate?.canonical_text;

  const activeMemories = await getActiveMemories();
  const subject = extraction.payload.subject;
  const conflicting = activeMemories.find(
    (m) =>
      !m.superseded_by &&
      !m.deleted_at &&
      m.memory_type === extraction.memoryType &&
      m.payload_json.subject &&
      subject &&
      m.payload_json.subject === subject &&
      m.canonical_text !== extraction.canonicalText,
  );

  const saved = await createMemory(
    {
      message_id: messageId,
      memory_type: extraction.memoryType,
      canonical_text: extraction.canonicalText,
      payload_json: extraction.payload,
      confidence: extraction.confidence,
      source_kind: sourceKind,
    },
    embedding,
  );

  if (conflicting) {
    await updateMemory({ ...conflicting, superseded_by: saved.id });
  }

  return { memory: saved, duplicateWarning };
}

export async function maybeCreateMemory(
  source: SourceRecord,
  messageId: string,
  settings: AppSettings,
  forceSave = false,
): Promise<MemoryCreateResult[] | null> {
  if (!forceSave && settings.autosave_mode !== "assisted" && !isExplicitSave(source.text)) return null;

  const registry = getAIRegistry(settings);
  const caption = source.text.trim();

  // ── Image: extract a list of items, one memory per item ──────────────
  if (source.mediaBlob && source.mediaKind === "image") {
    const imageItems = await registry.imageProvider.extractImageText(source.mediaBlob, settings);
    // Prepend user's caption to the first item so context isn't lost
    const items = imageItems.map((item, i) =>
      i === 0 && caption ? `${caption}. ${item}` : item,
    );
    if (items.length === 0) return null;
    const results = await Promise.all(
      items.map((item) => saveOneMemory(item, messageId, "image", registry, settings)),
    );
    return results;
  }

  // ── Audio: transcribe → single memory ────────────────────────────────
  let derivedText = caption;
  if (source.mediaBlob && source.mediaKind === "audio") {
    const transcription = await registry.transcriptionProvider.transcribeAudio(source.mediaBlob, settings);
    derivedText = [caption, transcription].filter(Boolean).join(". ");
  }

  if (!derivedText) return null;
  const result = await saveOneMemory(derivedText, messageId, source.modality === "voice" ? "voice_note" : "text", registry, settings);
  return [result];
}
