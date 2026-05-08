import Dexie, { type Table } from "dexie";

import type { AppSettings, ChatMessage, MemoryEmbedding, MemoryItem, Reminder, StoredAsset } from "../../types/domain";

export class MemoryCompanionDatabase extends Dexie {
  messages!: Table<ChatMessage, string>;
  memory_items!: Table<MemoryItem, string>;
  memory_embeddings!: Table<MemoryEmbedding, string>;
  settings!: Table<AppSettings, string>;
  assets!: Table<StoredAsset, string>;
  reminders!: Table<Reminder, string>;

  constructor() {
    super("memory_companion");

    this.version(1).stores({
      messages: "id, role, modality, created_at",
      memory_items: "id, message_id, memory_type, created_at, superseded_by, deleted_at",
      memory_embeddings: "memory_id",
      settings: "id, updated_at",
      assets: "id, kind, created_at",
    });

    this.version(2).stores({
      messages: "id, role, modality, created_at",
      memory_items: "id, message_id, memory_type, created_at, superseded_by, deleted_at",
      memory_embeddings: "memory_id",
      settings: "id, updated_at",
      assets: "id, kind, created_at",
      reminders: "id, memory_id, remind_at, fired",
    });

    this.version(3).stores({
      messages: "id, role, modality, created_at",
      memory_items: "id, message_id, memory_type, created_at, superseded_by, deleted_at",
      memory_embeddings: "memory_id",
      settings: "id, updated_at",
      assets: "id, kind, created_at",
      reminders: "id, memory_id, remind_at, fired, active",
    }).upgrade((tx) =>
      tx.table("reminders").toCollection().modify((reminder) => {
        reminder.label = reminder.label ?? "";
        reminder.active = reminder.active ?? true;
        reminder.ai_suggested = reminder.ai_suggested ?? false;
      })
    );

    this.version(4).stores({
      messages: "id, role, modality, created_at, media_path_or_blob_ref",
      memory_items: "id, message_id, memory_type, created_at, superseded_by, deleted_at",
      memory_embeddings: "memory_id",
      settings: "id, updated_at",
      assets: "id, kind, created_at",
      reminders: "id, memory_id, remind_at, fired, active",
    });
  }
}

export const db = new MemoryCompanionDatabase();

// API keys are never read from env vars — they would be baked into the public
// bundle by Vite and exposed to anyone. Keys must be entered by the user in
// Settings and are stored only in IndexedDB on their device.
export const defaultSettings: AppSettings = {
  id: "singleton",
  cloud_inference_enabled: true,
  passcode_or_lock_enabled: false,
  auto_delete_raw_media_days: 7,
  autosave_mode: "explicit",
  default_ai_provider: "openai",
  openai_model: "gpt-4.1-mini",
  openai_embedding_model: "text-embedding-3-small",
  openai_transcription_model: "gpt-4o-mini-transcribe",
  anthropic_model: "claude-haiku-4-5-20251001",
  updated_at: new Date().toISOString(),
};
