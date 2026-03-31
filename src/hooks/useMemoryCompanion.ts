import { useEffect, useState } from "react";

import type { AppSettings, ChatMessage, ComposerMode, MemoryItem } from "../types/domain";
import { verifySecret } from "../utils/crypto";
import { getAIRegistry } from "../services/ai/registry";
import { answerMemoryQuestion } from "../services/memory/retrievalService";
import { maybeCreateMemory } from "../services/memory/extractor";
import { checkAndFirePendingReminders, scheduleMemoryReminder } from "../services/reminders/reminderService";
import { detectReminderOpportunity, type ReminderSuggestion } from "../services/reminders/smartReminderDetector";
import {
  clearChatMessages,
  createMessage,
  deleteMemory,
  ensureSettings,
  listMemoryItems,
  listMessages,
  saveAsset,
  saveSettings,
  sweepRawMedia,
  updateMemoryWithEmbedding,
} from "../services/storage/localRepository";
import { migrateEmbeddingsIfNeeded, reindexAllMemories } from "../services/storage/migrationService";

interface SubmitPayload {
  mode: ComposerMode;
  text: string;
  imageBlob?: Blob;
  audioBlob?: Blob;
}

export function useMemoryCompanion() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [activePanel, setActivePanel] = useState<"chat" | "memories" | "privacy" | "settings">("chat");
  const [locked, setLocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reindexing, setReindexing] = useState(false);
  const [reminderSuggestion, setReminderSuggestion] = useState<{ memoryId: string; suggestion: ReminderSuggestion } | null>(null);

  async function refresh() {
    let nextSettings = await ensureSettings();
    nextSettings = await migrateEmbeddingsIfNeeded(nextSettings);
    setSettings(nextSettings);
    setMessages(await listMessages());
    setMemories(await listMemoryItems());
    await sweepRawMedia(nextSettings.auto_delete_raw_media_days);
    await checkAndFirePendingReminders();
  }

  useEffect(() => {
    refresh().catch(() => undefined);
    // Request persistent storage so the browser does not evict IndexedDB data.
    // Chrome/Android: granted silently. Firefox: may prompt the user.
    // iOS Safari: returns true on installed PWA (home screen); no-op in browser tab.
    if (navigator.storage?.persist) {
      navigator.storage.persist().catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    if (settings?.passcode_or_lock_enabled) {
      setLocked(true);
    }
  }, [settings?.passcode_or_lock_enabled]);

  async function submit(payload: SubmitPayload): Promise<void> {
    if (!settings) return;
    setBusy(true);

    try {
      let mediaRef: string | undefined;
      let modality: ChatMessage["modality"] = "text";
      if (payload.imageBlob) {
        mediaRef = (await saveAsset(payload.imageBlob, "image")).id;
        modality = "image";
      } else if (payload.audioBlob) {
        mediaRef = (await saveAsset(payload.audioBlob, "audio")).id;
        modality = "voice";
      }

      const userMessage = await createMessage({
        role: "user",
        modality,
        text_content: payload.text,
        media_path_or_blob_ref: mediaRef,
      });

      if (payload.mode === "remember") {
        const results = await maybeCreateMemory(
          {
            text: payload.text,
            modality,
            mediaBlob: payload.imageBlob ?? payload.audioBlob,
            mediaKind: payload.imageBlob ? "image" : payload.audioBlob ? "audio" : undefined,
          },
          userMessage.id,
          settings,
          true,
        );

        let reply: string;
        if (results && results.length > 0) {
          if (results.length === 1) {
            const { memory, duplicateWarning } = results[0];
            const subjectLine = memory.payload_json.subject
              ? "\nSubject: " + String(memory.payload_json.subject)
              : "";
            reply = "Memory saved.\nType: " + memory.memory_type + subjectLine + "\nConfidence: " + memory.confidence.toFixed(2);
            if (duplicateWarning) {
              reply += `\n\n⚠️ Similar memory exists: "${duplicateWarning}"`;
            }
          } else {
            reply = `${results.length} memories saved from image.\n`;
            reply += results
              .map(({ memory, duplicateWarning }) => {
                let line = `• ${memory.canonical_text} (${memory.memory_type}, ${memory.confidence.toFixed(2)})`;
                if (duplicateWarning) line += ` ⚠️ similar: "${duplicateWarning}"`;
                return line;
              })
              .join("\n");
          }
        } else {
          reply = "Could not save memory. Try rephrasing or switch to Assisted mode in Settings.";
        }

        await createMessage({ role: "assistant", modality: "text", text_content: reply });

        // Check saved memories for reminder opportunities
        if (results && results.length > 0) {
          for (const { memory } of results) {
            const opportunity = detectReminderOpportunity(memory.canonical_text, memory.memory_type);
            if (opportunity) {
              setReminderSuggestion({ memoryId: memory.id, suggestion: opportunity });
              break; // show at most one suggestion per save
            }
          }
        }
      } else {
        const effectiveQuestion =
          payload.text ||
          (payload.audioBlob
            ? await getAIRegistry(settings).transcriptionProvider.transcribeAudio(payload.audioBlob, settings)
            : "");
        const answer = effectiveQuestion
          ? await answerMemoryQuestion(effectiveQuestion, settings)
          : "Please type your question or use the voice button to ask by speaking.";
        await createMessage({ role: "assistant", modality: "text", text_content: answer });
      }

      await refresh();
    } catch (error) {
      let errorMessage = "An unexpected error occurred.";
      if (error instanceof Error) {
        const msg = error.message.toLowerCase();
        if (msg.includes("load failed") || msg.includes("failed to fetch") || msg.includes("network")) {
          errorMessage = "Could not reach the AI provider. Check your internet connection and API key in Settings.";
        } else if (msg.includes("401") || msg.includes("invalid api key") || msg.includes("unauthorized")) {
          errorMessage = "Invalid API key. Go to Settings and update your key.";
        } else if (msg.includes("429") || msg.includes("rate limit")) {
          errorMessage = "API rate limit reached. Wait a moment and try again.";
        } else {
          errorMessage = error.message;
        }
      }
      await createMessage({ role: "assistant", modality: "text", text_content: "⚠️ " + errorMessage });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function reindex(): Promise<void> {
    if (!settings || reindexing) return;
    setReindexing(true);
    try {
      await reindexAllMemories(settings);
    } finally {
      setReindexing(false);
    }
  }

  async function updateSettings(nextSettings: AppSettings): Promise<void> {
    await saveSettings(nextSettings);
    setSettings(nextSettings);

    // Re-embed all memories when the AI provider or API key changes so that
    // future similarity searches use the new embedding model.
    const prev = settings;
    const providerChanged =
      prev?.default_ai_provider !== nextSettings.default_ai_provider ||
      prev?.cloud_inference_enabled !== nextSettings.cloud_inference_enabled;
    const keyChanged =
      prev?.openai_api_key !== nextSettings.openai_api_key ||
      prev?.anthropic_api_key !== nextSettings.anthropic_api_key;

    if ((providerChanged || keyChanged) && !reindexing) {
      setReindexing(true);
      reindexAllMemories(nextSettings).finally(() => setReindexing(false));
    }
  }

  async function removeMemory(memoryId: string): Promise<void> {
    await deleteMemory(memoryId);
    await refresh();
  }

  async function editMemory(memoryId: string, newText: string): Promise<void> {
    if (!settings) return;
    const memory = memories.find((m) => m.id === memoryId);
    if (!memory) return;
    const embedding = await getAIRegistry(settings).embeddingProvider.embed(newText, settings);
    await updateMemoryWithEmbedding({ ...memory, canonical_text: newText }, embedding);
    await refresh();
  }

  async function clearChat(): Promise<void> {
    await clearChatMessages();
    setMessages([]);
  }

  async function acceptReminderSuggestion(memoryId: string, suggestion: ReminderSuggestion): Promise<void> {
    await scheduleMemoryReminder(memoryId, suggestion.suggestedDate, suggestion.label, {
      recurrence: suggestion.recurrence,
      aiSuggested: true,
    });
    setReminderSuggestion(null);
    await createMessage({ role: "assistant", modality: "text", text_content: "Reminder set." });
    await refresh();
  }

  function dismissReminderSuggestion(): void {
    setReminderSuggestion(null);
  }

  async function unlock(passcode: string): Promise<boolean> {
    const ok = await verifySecret(passcode, settings?.passcode_hash);
    if (ok) setLocked(false);
    return ok;
  }

  return {
    acceptReminderSuggestion,
    activePanel,
    busy,
    clearChat,
    dismissReminderSuggestion,
    editMemory,
    locked,
    memories,
    messages,
    reindex,
    reindexing,
    reminderSuggestion,
    settings,
    setActivePanel,
    removeMemory,
    submit,
    unlock,
    updateSettings,
    refresh,
  };
}
