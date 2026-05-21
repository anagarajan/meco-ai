import { useCallback, useEffect, useRef, useState } from "react";
import { App } from "@capacitor/app";
import { Clipboard } from "@capacitor/clipboard";
import type { AppSettings } from "../types/domain";

type DetectedProvider = "openai" | "anthropic" | "groq";

const KEY_PATTERNS: Array<{ pattern: RegExp; provider: DetectedProvider }> = [
  { pattern: /^sk-ant-[A-Za-z0-9\-_]{20,}$/, provider: "anthropic" },
  { pattern: /^gsk_[A-Za-z0-9]{20,}$/, provider: "groq" },
  // OpenAI last — prefix is a subset of sk-ant-, so order matters
  { pattern: /^sk-[A-Za-z0-9\-_]{20,}$/, provider: "openai" },
];

function detectKeyInText(text: string): { key: string; provider: DetectedProvider } | null {
  const trimmed = text.trim();
  for (const { pattern, provider } of KEY_PATTERNS) {
    if (pattern.test(trimmed)) return { key: trimmed, provider };
  }
  return null;
}

function alreadyStored(provider: DetectedProvider, settings: AppSettings): boolean {
  if (provider === "openai") return !!settings.openai_api_key;
  if (provider === "anthropic") return !!settings.anthropic_api_key;
  return !!settings.groq_api_key;
}

async function readClipboard(): Promise<string> {
  try {
    const { value } = await Clipboard.read();
    return value ?? "";
  } catch {
    return "";
  }
}

export function useClipboardKeyDetector(settings: AppSettings): {
  detectedKey: string | null;
  detectedProvider: DetectedProvider | null;
  dismiss: () => void;
} {
  const [detectedKey, setDetectedKey] = useState<string | null>(null);
  const [detectedProvider, setDetectedProvider] = useState<DetectedProvider | null>(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const check = useCallback(async () => {
    const text = await readClipboard();
    const found = detectKeyInText(text);
    if (found && !alreadyStored(found.provider, settingsRef.current)) {
      setDetectedKey(found.key);
      setDetectedProvider(found.provider);
    }
  }, []);

  // Check once on mount (covers settings panel open)
  useEffect(() => {
    void check();
  }, [check]);

  // Clear banner when the key gets saved
  useEffect(() => {
    if (detectedKey && detectedProvider && alreadyStored(detectedProvider, settings)) {
      setDetectedKey(null);
      setDetectedProvider(null);
    }
  }, [settings, detectedKey, detectedProvider]);

  // Re-check on app foreground (user returned from browser with a copied key)
  // Registered once — uses settingsRef so it always sees the latest settings.
  useEffect(() => {
    let removeListener: (() => void) | undefined;

    App.addListener("appStateChange", ({ isActive }) => {
      if (isActive) void check();
    })
      .then((handle) => {
        removeListener = () => void handle.remove();
      })
      .catch(() => undefined);

    return () => {
      removeListener?.();
    };
  }, [check]);

  const dismiss = useCallback(() => {
    setDetectedKey(null);
    setDetectedProvider(null);
  }, []);

  return { detectedKey, detectedProvider, dismiss };
}
