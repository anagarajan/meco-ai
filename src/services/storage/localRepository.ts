import { db, defaultSettings } from "./database";
import type { AppSettings, ChatMessage, MemoryEmbedding, MemoryItem, RecurrenceRule, Reminder, StoredAsset } from "../../types/domain";
import { createId } from "../../utils/ids";

export async function ensureSettings(): Promise<AppSettings> {
  const existing = await db.settings.get("singleton");
  if (existing) return existing;
  await db.settings.put(defaultSettings);
  return defaultSettings;
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await db.settings.put({ ...settings, updated_at: new Date().toISOString() });
}

export async function createMessage(message: Omit<ChatMessage, "id" | "created_at">): Promise<ChatMessage> {
  const stored: ChatMessage = {
    ...message,
    id: createId("msg"),
    created_at: new Date().toISOString(),
  };
  await db.messages.put(stored);
  return stored;
}

export async function listMessages(): Promise<ChatMessage[]> {
  return db.messages.orderBy("created_at").toArray();
}

export async function saveAsset(blob: Blob, kind: "image" | "audio"): Promise<StoredAsset> {
  const asset: StoredAsset = {
    id: createId(kind === "image" ? "img" : "aud"),
    blob,
    mimeType: blob.type,
    kind,
    created_at: new Date().toISOString(),
  };
  await db.assets.put(asset);
  return asset;
}

export async function createMemory(memory: Omit<MemoryItem, "id" | "created_at">, embedding: number[]): Promise<MemoryItem> {
  const stored: MemoryItem = {
    ...memory,
    id: createId("mem"),
    created_at: new Date().toISOString(),
  };
  const vector: MemoryEmbedding = {
    memory_id: stored.id,
    embedding,
  };
  await db.transaction("rw", db.memory_items, db.memory_embeddings, async () => {
    await db.memory_items.put(stored);
    await db.memory_embeddings.put(vector);
  });
  return stored;
}

export async function updateMemory(memory: MemoryItem): Promise<void> {
  await db.memory_items.put(memory);
}

export async function updateMemoryWithEmbedding(memory: MemoryItem, embedding: number[]): Promise<void> {
  await db.transaction("rw", db.memory_items, db.memory_embeddings, async () => {
    await db.memory_items.put(memory);
    await db.memory_embeddings.put({ memory_id: memory.id, embedding });
  });
}

export async function getActiveMemories(): Promise<Array<MemoryItem & { embedding?: number[] }>> {
  const memories = await db.memory_items.filter((item) => !item.deleted_at).toArray();
  const embeddings = await db.memory_embeddings.toArray();
  const embeddingMap = new Map(embeddings.map((item) => [item.memory_id, item.embedding]));
  return memories.map((memory) => ({ ...memory, embedding: embeddingMap.get(memory.id) }));
}

export async function listMemoryItems(): Promise<MemoryItem[]> {
  return db.memory_items
    .orderBy("created_at")
    .reverse()
    .filter((item) => !item.deleted_at)
    .toArray();
}

export async function getAssetByMessageId(messageId: string): Promise<StoredAsset | undefined> {
  const message = await db.messages.get(messageId);
  if (!message?.media_path_or_blob_ref) return undefined;
  return db.assets.get(message.media_path_or_blob_ref);
}

export async function deleteMemory(memoryId: string): Promise<void> {
  const memory = await db.memory_items.get(memoryId);
  if (!memory) return;
  await db.memory_items.put({ ...memory, deleted_at: new Date().toISOString() });
}

export async function clearChatMessages(): Promise<void> {
  await db.messages.clear();
}

export async function wipeAllData(): Promise<void> {
  await db.transaction("rw", db.messages, db.memory_items, db.memory_embeddings, db.assets, db.reminders, async () => {
    await db.messages.clear();
    await db.memory_items.clear();
    await db.memory_embeddings.clear();
    await db.assets.clear();
    await db.reminders.clear();
  });
}

export async function exportData(): Promise<Record<string, unknown>> {
  return {
    exported_at: new Date().toISOString(),
    schema_version: 3,
    messages: await db.messages.toArray(),
    memory_items: await db.memory_items.toArray(),
    memory_embeddings: await db.memory_embeddings.toArray(),
    settings: await db.settings.toArray(),
    assets: await db.assets.toArray(),
    reminders: await db.reminders.toArray(),
  };
}

export async function importData(raw: unknown): Promise<{ imported: number; skipped: number }> {
  if (!raw || typeof raw !== "object") throw new Error("Invalid export file.");
  const data = raw as Record<string, unknown>;

  const memories: MemoryItem[]       = Array.isArray(data.memory_items)      ? (data.memory_items as MemoryItem[])           : [];
  const embeddings: MemoryEmbedding[] = Array.isArray(data.memory_embeddings) ? (data.memory_embeddings as MemoryEmbedding[]) : [];
  const messages: ChatMessage[]       = Array.isArray(data.messages)           ? (data.messages as ChatMessage[])             : [];
  const assets: StoredAsset[]         = Array.isArray(data.assets)             ? (data.assets as StoredAsset[])               : [];
  const reminders: Reminder[]         = Array.isArray(data.reminders)          ? (data.reminders as Reminder[])               : [];

  let imported = 0;
  let skipped = 0;

  await db.transaction("rw",
    [db.memory_items, db.memory_embeddings, db.messages, db.assets, db.reminders],
    async () => {
      for (const m of memories) {
        const exists = await db.memory_items.get(m.id);
        if (!exists) { await db.memory_items.put(m); imported++; } else skipped++;
      }
      for (const e of embeddings) {
        const exists = await db.memory_embeddings.get(e.memory_id);
        if (!exists) await db.memory_embeddings.put(e);
      }
      for (const msg of messages) {
        const exists = await db.messages.get(msg.id);
        if (!exists) { await db.messages.put(msg); imported++; } else skipped++;
      }
      for (const a of assets) {
        const exists = await db.assets.get(a.id);
        if (!exists) await db.assets.put(a);
      }
      for (const r of reminders) {
        const exists = await db.reminders.get(r.id);
        if (!exists) await db.reminders.put(r);
      }
    }
  );

  return { imported, skipped };
}

// ── Reminders ──────────────────────────────────────────────────────

export async function createReminder(
  memoryId: string,
  remindAt: Date,
  options: { label?: string; recurrence?: RecurrenceRule; aiSuggested?: boolean } = {},
): Promise<Reminder> {
  const reminder: Reminder = {
    id: createId("rem"),
    memory_id: memoryId,
    label: options.label ?? "",
    remind_at: remindAt.toISOString(),
    fired: false,
    active: true,
    recurrence: options.recurrence,
    ai_suggested: options.aiSuggested ?? false,
    created_at: new Date().toISOString(),
  };
  await db.reminders.put(reminder);
  return reminder;
}

export async function getPendingReminders(): Promise<Reminder[]> {
  return db.reminders.filter((r) => !r.fired && r.active !== false).toArray();
}

export async function markReminderFired(reminderId: string): Promise<void> {
  const r = await db.reminders.get(reminderId);
  if (r) await db.reminders.put({ ...r, fired: true, last_fired_at: new Date().toISOString() });
}

export async function getReminderForMemory(memoryId: string): Promise<Reminder | undefined> {
  return db.reminders.filter((r) => r.memory_id === memoryId && !r.fired).first();
}

export async function listAllReminders(): Promise<Reminder[]> {
  return db.reminders.orderBy("remind_at").reverse().toArray();
}

export async function updateReminder(reminder: Reminder): Promise<void> {
  await db.reminders.put(reminder);
}

export async function deleteReminder(reminderId: string): Promise<void> {
  await db.reminders.delete(reminderId);
}

export async function snoozeReminder(reminderId: string, until: Date): Promise<void> {
  const r = await db.reminders.get(reminderId);
  if (!r) return;
  await db.reminders.put({
    ...r,
    snoozed_until: until.toISOString(),
    remind_at: until.toISOString(),
    fired: false,
  });
}

export async function toggleReminderActive(reminderId: string): Promise<void> {
  const r = await db.reminders.get(reminderId);
  if (!r) return;
  await db.reminders.put({ ...r, active: !r.active });
}

export async function sweepRawMedia(retentionDays: number): Promise<void> {
  if (retentionDays <= 0) return;
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const staleAssets = await db.assets.filter((asset) => new Date(asset.created_at).getTime() < cutoff).toArray();
  if (staleAssets.length === 0) return;

  await db.transaction("rw", db.assets, db.messages, async () => {
    for (const asset of staleAssets) {
      await db.assets.delete(asset.id);
      const messages = await db.messages.where("media_path_or_blob_ref").equals(asset.id).toArray();
      for (const message of messages) {
        await db.messages.put({ ...message, media_path_or_blob_ref: undefined });
      }
    }
  });
}

