import type { AppSettings, MemoryType } from "../../types/domain";
import type { EmbeddingProvider } from "./types";

// ─── Embedding ────────────────────────────────────────────────────────────────
// Used by the Anthropic path — Anthropic has no embedding endpoint, so we use
// local n-gram hashing (256-dim, zero-bundle) for semantic search.

const EMBEDDING_DIMENSION = 256;

const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "been", "by", "do", "for",
  "from", "had", "has", "have", "he", "her", "here", "him", "his", "how",
  "i", "if", "in", "is", "it", "its", "me", "my", "near", "no", "not",
  "of", "on", "or", "our", "out", "she", "so", "that", "the", "their",
  "them", "then", "there", "they", "this", "to", "up", "us", "was",
  "we", "were", "what", "when", "where", "who", "will", "with", "you",
]);

function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
}

function stableIndex(token: string): number {
  let hash = 5381;
  for (let i = 0; i < token.length; i++) {
    hash = ((hash << 5) + hash + token.charCodeAt(i)) >>> 0;
  }
  return hash % EMBEDDING_DIMENSION;
}

function getCharNgrams(text: string, n: number): string[] {
  const cleaned = text.toLowerCase().replace(/[^a-z0-9]/g, "_");
  const padded = `_${cleaned}_`;
  const ngrams: string[] = [];
  for (let i = 0; i <= padded.length - n; i++) {
    ngrams.push(padded.slice(i, i + n));
  }
  return ngrams;
}

export class LocalEmbeddingProvider implements EmbeddingProvider {
  async embed(text: string): Promise<number[]> {
    const vector = new Array<number>(EMBEDDING_DIMENSION).fill(0);
    const lower = text.toLowerCase();

    // Weighted content words (2x)
    for (const token of tokenize(lower)) {
      if (!STOPWORDS.has(token)) {
        vector[stableIndex(token)] += 2;
      }
    }

    // Character 3-grams (1x) — captures partial word overlap
    for (const ngram of getCharNgrams(lower, 3)) {
      vector[stableIndex(ngram)] += 1;
    }

    // Character 4-grams (1x) — captures word-shape similarity
    for (const ngram of getCharNgrams(lower, 4)) {
      vector[stableIndex(ngram)] += 1;
    }

    const norm = Math.hypot(...vector) || 1;
    return vector.map((v) => v / norm);
  }
}

// ─── Query Subject Extraction ─────────────────────────────────────────────────
// Used by the retrieval service to boost memories whose subject matches the
// query subject (e.g. "where are my keys?" → subject: "keys").

function normalizeSubject(raw: string): string | undefined {
  const subject = raw
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t && !STOPWORDS.has(t))
    .join(" ")
    .trim();
  return subject || undefined;
}

export function extractQuerySubject(text: string): string | undefined {
  const s = text.toLowerCase().trim();

  // "where is my passport?" / "where did I leave my keys?"
  const whereMatch = s.match(/\bwhere\s+(?:is|are|did i (?:keep|leave|put|store|park)|can i find)\s+(?:my |the )?([a-z0-9][a-z0-9 ]{0,30}?)(?:\?|$|\b(?:now|today|again)\b)/);
  if (whereMatch?.[1]) return normalizeSubject(whereMatch[1].trim());

  // "what do I know about Sarah?" / "tell me about John"
  const aboutMatch = s.match(/\b(?:what do i know about|tell me about|anything about|info(?:rmation)? (?:about|on))\s+([a-z][a-z0-9 ]{0,25})/);
  if (aboutMatch?.[1]) return normalizeSubject(aboutMatch[1]);

  // "what did I promise Sarah?" / "what do I owe John?"
  const promiseMatch = s.match(/\b(?:what did i (?:promise|owe|tell)|do i owe)\s+([a-z][a-z0-9 ]{0,20})/);
  if (promiseMatch?.[1]) return normalizeSubject(promiseMatch[1]);

  // "does Sarah like X?" / "what does Sarah prefer?"
  const personPreferenceMatch = s.match(/\b(?:does|what does|do)\s+([a-z][a-z0-9 ]{0,20}?)\s+(?:like|prefer|love|hate|enjoy|eat|drink)/);
  if (personPreferenceMatch?.[1]) return normalizeSubject(personPreferenceMatch[1].trim());

  // "when is my dentist appointment?"
  const eventMatch = s.match(/\b(?:when is|when was|when did)\s+(?:my |the )?([a-z0-9][a-z0-9 ]{0,30}?)(?:\?|$)/);
  if (eventMatch?.[1]) return normalizeSubject(eventMatch[1].trim());

  // Fallback: pull the most meaningful noun phrase (skip question words)
  const questionWords = new Set(["what", "when", "where", "who", "why", "how", "did", "do", "does", "is", "are", "was", "were", "can", "could", "should", "would"]);
  const contentWords = tokenize(s).filter((t) => !questionWords.has(t) && !STOPWORDS.has(t));
  if (contentWords.length > 0) return contentWords.slice(0, 2).join(" ");

  return undefined;
}

// Needed to satisfy the AppSettings import (used indirectly by EmbeddingProvider interface)
export type { AppSettings, MemoryType };
