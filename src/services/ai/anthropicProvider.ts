import type { AppSettings, MemoryType } from "../../types/domain";
import type {
  ConversationTurn,
  ExtractionResult,
  ImageExtractionProvider,
  MemoryExtractionProvider,
  ReasoningProvider,
} from "./types";

const VALID_MEMORY_TYPES: MemoryType[] = [
  "object_location", "person_fact", "commitment", "event", "preference", "other",
];

type AnthropicResponse = { content: Array<{ type: string; text: string }> };

async function anthropicFetch(body: Record<string, unknown>, apiKey: string): Promise<AnthropicResponse> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      // Required to allow direct browser-side calls (user supplies their own key)
      "anthropic-dangerous-allow-browser": "true",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text().catch(() => "");
    throw new Error(`Anthropic API error ${response.status}: ${err}`);
  }
  return response.json() as Promise<AnthropicResponse>;
}

function getText(res: AnthropicResponse): string {
  return res.content.find((b) => b.type === "text")?.text?.trim() ?? "";
}

// ── Reasoning ──────────────────────────────────────────────────────

export class AnthropicReasoningProvider implements ReasoningProvider {
  async answer(question: string, context: string[], settings: AppSettings, history?: ConversationTurn[]): Promise<string> {
    const apiKey = settings.anthropic_api_key;
    if (!apiKey) throw new Error("Missing Anthropic API key");

    const historyMessages = (history ?? []).map((t) => ({
      role: t.role,
      content: t.text,
    }));

    const res = await anthropicFetch({
      model: settings.anthropic_model ?? "claude-haiku-4-5-20251001",
      max_tokens: 512,
      system:
        "You are a personal memory assistant. Answer using ONLY the provided memory context. " +
        "Use the conversation history for follow-up questions and pronouns. " +
        "If the context doesn't contain the answer say so clearly. " +
        "Be concise and direct. State uncertainty explicitly.",
      messages: [
        ...historyMessages,
        {
          role: "user",
          content:
            `Question: ${question}\n\nMemory context:\n` +
            context.map((c, i) => `${i + 1}. ${c}`).join("\n"),
        },
      ],
    }, apiKey);

    return getText(res);
  }

  async generateHypotheticalAnswer(question: string, settings: AppSettings): Promise<string> {
    const apiKey = settings.anthropic_api_key;
    if (!apiKey) throw new Error("Missing Anthropic API key");

    const res = await anthropicFetch({
      model: settings.anthropic_model ?? "claude-haiku-4-5-20251001",
      max_tokens: 100,
      system:
        "You are a personal memory assistant. Given a question, write a short factual statement (1-2 sentences) that would be the ideal memory entry answering it. Write it as a stored fact, not as a question or explanation. Be specific and concise.",
      messages: [{ role: "user", content: question }],
    }, apiKey);

    return getText(res) || question;
  }

  async rerankCandidates(question: string, candidates: string[], settings: AppSettings): Promise<number[]> {
    const apiKey = settings.anthropic_api_key;
    if (!apiKey) throw new Error("Missing Anthropic API key");

    const numbered = candidates.map((c, i) => `${i + 1}. ${c}`).join("\n");

    const res = await anthropicFetch({
      model: settings.anthropic_model ?? "claude-haiku-4-5-20251001",
      max_tokens: 100,
      system:
        "You are a relevance scorer. Given a question and candidate memories, rate each memory's relevance to the question on a scale of 0-10 (10 = perfect answer, 0 = completely irrelevant). Respond with ONLY a JSON array of numbers in the same order as the candidates. Example: [8, 3, 6]",
      messages: [
        {
          role: "user",
          content: `Question: ${question}\n\nCandidate memories:\n${numbered}`,
        },
      ],
    }, apiKey);

    const raw = getText(res);
    try {
      const scores = JSON.parse(raw) as unknown;
      if (Array.isArray(scores) && scores.length === candidates.length) {
        return scores.map((s) => Math.min(10, Math.max(0, Number(s) || 0)));
      }
    } catch {
      // Parse failure — fall through
    }
    return candidates.map(() => 5);
  }
}

// ── Memory Extraction ───────────────────────────────────────────────

export class AnthropicMemoryExtractionProvider implements MemoryExtractionProvider {
  async extract(text: string, settings: AppSettings): Promise<ExtractionResult> {
    const apiKey = settings.anthropic_api_key;
    if (!apiKey) throw new Error("Anthropic API key is required.");

    try {
      const res = await anthropicFetch({
        model: settings.anthropic_model ?? "claude-haiku-4-5-20251001",
        max_tokens: 256,
        system: `Extract a memory from the user's text. Respond with a JSON object only (no markdown, no explanation):
{
  "memory_type": "object_location" | "person_fact" | "commitment" | "event" | "preference" | "other",
  "canonical_text": "clean, normalized version of the fact in third-person or factual form",
  "subject": "the main noun/person/thing this is about, or null",
  "confidence": 0.0 to 1.0
}`,
        messages: [{ role: "user", content: text }],
      }, apiKey);

      const raw = JSON.parse(getText(res)) as {
        memory_type?: string;
        canonical_text?: string;
        subject?: string | null;
        confidence?: number;
      };

      const memoryType: MemoryType = VALID_MEMORY_TYPES.includes(raw.memory_type as MemoryType)
        ? (raw.memory_type as MemoryType)
        : "other";

      return {
        memoryType,
        canonicalText: raw.canonical_text ?? text,
        payload: { subject: raw.subject ?? undefined },
        confidence: Math.min(1, Math.max(0, raw.confidence ?? 0.85)),
      };
    } catch (err) {
      throw err;
    }
  }
}

// ── Image Extraction ────────────────────────────────────────────────

export class AnthropicImageExtractionProvider implements ImageExtractionProvider {
  async extractImageText(blob: Blob, settings: AppSettings): Promise<string[]> {
    const apiKey = settings.anthropic_api_key;
    if (!apiKey) throw new Error("Missing Anthropic API key");

    const buffer = await blob.arrayBuffer();
    const uint8 = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < uint8.length; i += 8192) {
      binary += String.fromCharCode(...uint8.subarray(i, i + 8192));
    }
    const base64 = btoa(binary);
    const mediaType = (blob.type || "image/jpeg") as
      | "image/jpeg"
      | "image/png"
      | "image/gif"
      | "image/webp";

    const res = await anthropicFetch({
      model: settings.anthropic_model ?? "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
            {
              type: "text",
              text: "List every distinct memory-worthy item from this image, one item per line. If there is only a single item, return just one line. Plain text only — no bullets, no numbers, no labels.",
            },
          ],
        },
      ],
    }, apiKey);

    const raw = getText(res);
    return raw.split("\n").map((l) => l.trim()).filter(Boolean);
  }
}
