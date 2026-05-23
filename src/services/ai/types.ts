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

export interface ConversationTurn {
  role: "user" | "assistant";
  text: string;
}

export interface ReasoningProvider {
  answer(question: string, context: string[], settings: AppSettings, history?: ConversationTurn[]): Promise<string>;
  /** Generate a hypothetical memory that would answer the question (HyDE). */
  generateHypotheticalAnswer(question: string, settings: AppSettings): Promise<string>;
  /** Score each candidate memory's relevance to the question (0–10). Returns scores in same order as candidates. */
  rerankCandidates(question: string, candidates: string[], settings: AppSettings): Promise<number[]>;
}

export interface MemoryExtractionProvider {
  extract(text: string, settings: AppSettings): Promise<ExtractionResult>;
}

