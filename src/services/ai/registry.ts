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
  // Resolve effective provider: if the configured provider has no key, fall
  // back to whichever key is actually present so Anthropic-only users still
  // work even when the default_ai_provider is "openai".
  const wantsOpenAI = settings.default_ai_provider === "openai";
  const hasOpenAI = !!settings.openai_api_key;
  const hasAnthropic = !!settings.anthropic_api_key;

  const useOpenAI = (wantsOpenAI && hasOpenAI) || (!wantsOpenAI && !hasAnthropic && hasOpenAI);
  const useAnthropic = (!wantsOpenAI && hasAnthropic) || (wantsOpenAI && !hasOpenAI && hasAnthropic);

  // ── Anthropic ──────────────────────────────────────────────────
  // Reasoning + extraction + image via Claude.
  // Embedding: local hashing (Anthropic has no embedding endpoint).
  // Transcription: OpenAI Whisper if key provided, otherwise returns empty
  // string (voice note is saved without transcription text).
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
  if (useOpenAI) {
    return {
      embeddingProvider: new OpenAIEmbeddingProvider(),
      imageProvider: new OpenAIImageExtractionProvider(),
      transcriptionProvider: new OpenAITranscriptionProvider(),
      memoryExtractionProvider: openAIMemoryExtractionProvider,
      reasoningProvider: new OpenAIReasoningProvider(),
    };
  }

  throw new Error("No valid API key configured. Go to Settings and add an OpenAI or Anthropic key.");
}
