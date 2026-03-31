export type MessageRole = "user" | "assistant" | "system";
export type MessageModality = "text" | "voice" | "image";
export type MemoryType =
  | "object_location"
  | "person_fact"
  | "commitment"
  | "event"
  | "preference"
  | "other";
export type ComposerMode = "remember" | "ask";
export type SourceKind = "text" | "voice_note" | "image" | "mixed";
export type ActivePanel = "chat" | "memories" | "privacy" | "settings";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  modality: MessageModality;
  text_content: string;
  media_path_or_blob_ref?: string;
  created_at: string;
}

export interface MemoryItem {
  id: string;
  message_id: string;
  memory_type: MemoryType;
  canonical_text: string;
  payload_json: Record<string, unknown>;
  confidence: number;
  source_kind: SourceKind;
  created_at: string;
  superseded_by?: string;
  deleted_at?: string;
}

export interface MemoryEmbedding {
  memory_id: string;
  embedding: number[];
}

export interface AppSettings {
  id: "singleton";
  cloud_inference_enabled: boolean;
  passcode_or_lock_enabled: boolean;
  passcode_hash?: string;
  auto_delete_raw_media_days: number;
  autosave_mode: "explicit" | "assisted";
  default_ai_provider: "openai" | "anthropic";
  openai_api_key?: string;
  openai_model?: string;
  openai_embedding_model?: string;
  openai_transcription_model?: string;
  anthropic_api_key?: string;
  anthropic_model?: string;
  embedding_version?: number;
  updated_at: string;
}

export interface StoredAsset {
  id: string;
  blob: Blob;
  mimeType: string;
  kind: "image" | "audio";
  created_at: string;
}

export interface RetrievalCandidate {
  memory: MemoryItem;
  semanticScore: number;
  finalScore: number;
}

export interface SourceRecord {
  text: string;
  modality: MessageModality;
  mediaBlob?: Blob;
  mediaKind?: "image" | "audio";
}

export type RecurrencePattern = "daily" | "weekly" | "monthly" | "custom";

export interface RecurrenceRule {
  pattern: RecurrencePattern;
  interval?: number;   // for "custom": every N days
  end_date?: string;   // optional ISO date string
}

export interface Reminder {
  id: string;
  memory_id: string;
  label: string;
  remind_at: string;          // ISO date string — next fire time
  fired: boolean;
  active: boolean;
  recurrence?: RecurrenceRule;
  snoozed_until?: string;     // ISO date string
  last_fired_at?: string;     // ISO date string
  ai_suggested: boolean;
  created_at: string;
}

