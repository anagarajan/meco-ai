import { useEffect, useRef, useState } from "react";
import type { AppSettings, MemoryItem } from "../types/domain";
import { getAIRegistry } from "../services/ai/registry";
import { cosineSimilarity } from "../services/memory/retrievalService";
import { getActiveMemories } from "../services/storage/localRepository";

const MIN_SCORE = 0.12;

export function useRelatedMemory(text: string, mode: string, settings: AppSettings | null) {
  const [relatedMemory, setRelatedMemory] = useState<MemoryItem | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const dismissedIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Reset dismissal when text changes significantly
    if (relatedMemory && dismissed) {
      setDismissed(false);
      dismissedIdRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  useEffect(() => {
    if (mode !== "remember" || text.length < 20 || !settings) {
      setRelatedMemory(null);
      return;
    }

    // Longer debounce if using cloud (avoid excessive API calls)
    const debounce = settings.cloud_inference_enabled ? 1200 : 600;
    const timer = setTimeout(async () => {
      try {
        const embedding = await getAIRegistry(settings).embeddingProvider.embed(text, settings);
        const memories = await getActiveMemories();
        let bestScore = 0;
        let bestMemory: MemoryItem | null = null;
        for (const m of memories) {
          if (!m.embedding || m.embedding.length === 0) continue;
          const score = cosineSimilarity(embedding, m.embedding);
          if (score > bestScore) { bestScore = score; bestMemory = m; }
        }
        if (bestScore >= MIN_SCORE && bestMemory && bestMemory.id !== dismissedIdRef.current) {
          setRelatedMemory(bestMemory);
        } else {
          setRelatedMemory(null);
        }
      } catch {
        setRelatedMemory(null);
      }
    }, debounce);

    return () => clearTimeout(timer);
  }, [text, mode, settings]);

  function dismiss() {
    if (relatedMemory) dismissedIdRef.current = relatedMemory.id;
    setDismissed(true);
    setRelatedMemory(null);
  }

  return { relatedMemory: dismissed ? null : relatedMemory, dismiss };
}
