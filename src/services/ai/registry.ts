import type { AppSettings } from "../../types/domain";
import { LocalEmbeddingProvider } from "./localHeuristicProvider";
import {
  OpenAIEmbeddingProvider,
  OpenAIImageExtractionProvider,
  OpenAIReasoningProvider,
  OpenAITranscriptionProvider,
  openAIMemoryExtractionProvider,
} from "./openaiProvider";
import {
  AnthropicReasoningProvider,
  AnthropicMemoryExtractionProvider,
  AnthropicImageExtractionProvider,
} from "./anthropicProvider";
import {
  GroqReasoningProvider,
  GroqTranscriptionProvider,
  GroqImageExtractionProvider,
  GroqMemoryExtractionProvider,
} from "./groqProvider";
import type {
  EmbeddingProvider,
  ImageExtractionProvider,
  MemoryExtractionProvider,
  ReasoningProvider,
  TranscriptionProvider,
} from "./types";

export interface AIRegistry {
  embeddingProvider: EmbeddingProvider;
  imageProvider: ImageExtractionProvider;
  transcriptionProvider: TranscriptionProvider;
  memoryExtractionProvider: MemoryExtractionProvider;
  reasoningProvider: ReasoningProvider;
}

export function getAIRegistry(settings: AppSettings): AIRegistry {
  const wantsOpenAI = settings.default_ai_provider === "openai";
  const wantsAnthropic = settings.default_ai_provider === "anthropic";
  const wantsGroq = settings.default_ai_provider === "groq";
  const hasOpenAI = !!settings.openai_api_key;
  const hasAnthropic = !!settings.anthropic_api_key;
  const hasGroq = !!settings.groq_api_key;

  // ── Groq ───────────────────────────────────────────────────────
  // Reasoning + extraction + transcription (Whisper) via Groq.
  // Embedding: local n-gram (Groq has no embedding endpoint).
  // Image: not supported — throws a user-visible error on attempt.
  const useGroq = (wantsGroq && hasGroq) || (!wantsOpenAI && !wantsAnthropic && !hasOpenAI && !hasAnthropic && hasGroq);
  if (useGroq) {
    return {
      embeddingProvider: new LocalEmbeddingProvider(),
      imageProvider: new GroqImageExtractionProvider(),
      transcriptionProvider: new GroqTranscriptionProvider(),
      memoryExtractionProvider: new GroqMemoryExtractionProvider(),
      reasoningProvider: new GroqReasoningProvider(),
    };
  }

  // ── Anthropic ──────────────────────────────────────────────────
  // Reasoning + extraction + image via Claude.
  // Embedding: local hashing (Anthropic has no embedding endpoint).
  // Transcription: OpenAI Whisper if key provided, otherwise returns empty
  // string (voice note is saved without transcription text).
  const useAnthropic =
    (wantsAnthropic && hasAnthropic) ||
    (!wantsOpenAI && !wantsGroq && hasAnthropic) ||
    (wantsOpenAI && !hasOpenAI && hasAnthropic);
  if (useAnthropic) {
    return {
      embeddingProvider: new LocalEmbeddingProvider(),
      imageProvider: new AnthropicImageExtractionProvider(),
      transcriptionProvider: hasOpenAI
        ? new OpenAITranscriptionProvider()
        : { transcribeAudio: async () => "" },
      memoryExtractionProvider: new AnthropicMemoryExtractionProvider(),
      reasoningProvider: new AnthropicReasoningProvider(),
    };
  }

  // ── OpenAI ─────────────────────────────────────────────────────
  // All capabilities via OpenAI (embeddings, reasoning, extraction, image, transcription).
  const useOpenAI = hasOpenAI;
  if (useOpenAI) {
    return {
      embeddingProvider: new OpenAIEmbeddingProvider(),
      imageProvider: new OpenAIImageExtractionProvider(),
      transcriptionProvider: new OpenAITranscriptionProvider(),
      memoryExtractionProvider: openAIMemoryExtractionProvider,
      reasoningProvider: new OpenAIReasoningProvider(),
    };
  }

  throw new Error("No valid API key configured. Go to Settings and add an OpenAI, Anthropic, or Groq key.");
}
