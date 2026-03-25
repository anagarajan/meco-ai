import { useState } from "react";

const KEY = "onboarding_dismissed";

function isDismissed(): boolean {
  try { return localStorage.getItem(KEY) === "true"; } catch { return false; }
}

export function useOnboarding(memoryCount: number, messageCount: number) {
  const [dismissed, setDismissed] = useState(isDismissed);

  const showOnboarding = !dismissed && memoryCount === 0 && messageCount === 0;

  function dismiss() {
    try { localStorage.setItem(KEY, "true"); } catch { /* ignore */ }
    setDismissed(true);
  }

  return { showOnboarding, dismiss };
}
