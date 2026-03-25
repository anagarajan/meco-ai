import type { AppSettings, MemoryType } from "../../types/domain";

export interface ExtractionResult {
  memoryType: MemoryType;
  canonicalText: string;
  payload: Record<string, unknown>;
  confidence: number;
}

export interface TranscriptionProvider {
  transcribeAudio(blob: Blob, settings: AppSettings): Promise<string>;
}

export interface ImageExtractionProvider {
  extractImageText(blob: Blob, settings: AppSettings): Promise<string[]>;
}

export interface EmbeddingProvider {
  embed(text: string, settings: AppSettings): Promise<number[]>;
}

export interface ReasoningProvider {
  answer(question: string, context: string[], settings: AppSettings): Promise<string>;
}

export interface MemoryExtractionProvider {
  extract(text: string, settings: AppSettings): Promise<ExtractionResult>;
}

