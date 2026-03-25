import type { AppSettings, MemoryType } from "../../types/domain";
import type {
  EmbeddingProvider,
  ExtractionResult,
  ImageExtractionProvider,
  MemoryExtractionProvider,
  ReasoningProvider,
  TranscriptionProvider,
} from "./types";

const VALID_MEMORY_TYPES: MemoryType[] = [
  "object_location",
  "person_fact",
  "commitment",
  "event",
  "preference",
  "other",
];

async function openAiFetch<T>(endpoint: string, apiKey: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`https://api.openai.com/v1/${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`OpenAI request failed with ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  async embed(text: string, settings: AppSettings): Promise<number[]> {
    const apiKey = settings.openai_api_key;
    if (!apiKey) throw new Error("Missing OpenAI API key");
    const result = await openAiFetch<{ data: Array<{ embedding: number[] }> }>("embeddings", apiKey, {
      input: text,
      model: settings.openai_embedding_model,
    });
    return result.data[0]?.embedding ?? [];
  }
}

export class OpenAIReasoningProvider implements ReasoningProvider {
  async answer(question: string, context: string[], settings: AppSettings): Promise<string> {
    const apiKey = settings.openai_api_key;
    if (!apiKey) throw new Error("Missing OpenAI API key");

    const result = await openAiFetch<{ choices: Array<{ message: { content: string } }> }>(
      "chat/completions",
      apiKey,
      {
        model: settings.openai_model,
        messages: [
          {
            role: "system",
            content:
              "Answer using only the provided memory context. State uncertainty and conflicts explicitly. Keep provenance outside the answer body.",
          },
          {
            role: "user",
            content: `Question: ${question}\n\nMemory context:\n${context.map((item, index) => `${index + 1}. ${item}`).join("\n")}`,
          },
        ],
      },
    );

    return result.choices[0]?.message.content?.trim() ?? "";
  }
}

export class OpenAITranscriptionProvider implements TranscriptionProvider {
  async transcribeAudio(blob: Blob, settings: AppSettings): Promise<string> {
    const apiKey = settings.openai_api_key;
    if (!apiKey) throw new Error("Missing OpenAI API key");

    const formData = new FormData();
    formData.append("file", blob, "voice.webm");
    formData.append("model", settings.openai_transcription_model ?? "gpt-4o-mini-transcribe");

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    });
    if (!response.ok) throw new Error(`OpenAI transcription failed with ${response.status}`);
    const result = (await response.json()) as { text?: string };
    return result.text ?? "";
  }
}

export class OpenAIImageExtractionProvider implements ImageExtractionProvider {
  async extractImageText(blob: Blob, settings: AppSettings): Promise<string[]> {
    const apiKey = settings.openai_api_key;
    if (!apiKey) throw new Error("Missing OpenAI API key");

    const buffer = await blob.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
    const result = await openAiFetch<{ choices: Array<{ message: { content: string } }> }>(
      "chat/completions",
      apiKey,
      {
        model: settings.openai_model,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "List every distinct memory-worthy item from this image, one item per line. If there is only a single item, return just one line. Plain text only — no bullets, no numbers, no labels.",
              },
              { type: "image_url", image_url: { url: `data:${blob.type};base64,${base64}` } },
            ],
          },
        ],
      },
    );
    const raw = result.choices[0]?.message.content?.trim() ?? "";
    return raw.split("\n").map((l) => l.trim()).filter(Boolean);
  }
}

export class OpenAIMemoryExtractionProvider implements MemoryExtractionProvider {
  async extract(text: string, settings: AppSettings): Promise<ExtractionResult> {
    const apiKey = settings.openai_api_key;
    if (!apiKey) throw new Error("OpenAI API key is required.");

    try {
      const result = await openAiFetch<{ choices: Array<{ message: { content: string } }> }>(
        "chat/completions",
        apiKey,
        {
          model: settings.openai_model ?? "gpt-4.1-mini",
          messages: [
            {
              role: "system",
              content: `Extract a memory from the user's text. Respond with a JSON object only (no markdown):
{
  "memory_type": "object_location" | "person_fact" | "commitment" | "event" | "preference" | "other",
  "canonical_text": "clean normalized version of the fact",
  "subject": "the main noun/person/thing this is about, or null",
  "confidence": 0.0 to 1.0
}`,
            },
            { role: "user", content: text },
          ],
        },
      );

      const raw = JSON.parse(result.choices[0]?.message.content ?? "{}") as {
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

export const openAIMemoryExtractionProvider: MemoryExtractionProvider = new OpenAIMemoryExtractionProvider();

