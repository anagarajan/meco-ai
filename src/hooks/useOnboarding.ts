import { useState, useCallback } from "react";

const WELCOME_KEY = "welcome_dismissed";
const ONBOARDING_KEY = "onboarding_dismissed";
const NUDGE_KEY = "first_memory_nudge_shown";

function getFlag(key: string): boolean {
  try { return localStorage.getItem(key) === "true"; } catch { return false; }
}

function setFlag(key: string): void {
  try { localStorage.setItem(key, "true"); } catch { /* ignore */ }
}

export function useOnboarding(memoryCount: number, messageCount: number) {
  const [welcomeDismissed, setWelcomeDismissed] = useState(() => getFlag(WELCOME_KEY));
  const [dismissed, setDismissed] = useState(() => getFlag(ONBOARDING_KEY));
  const [nudgeDismissed, setNudgeDismissed] = useState(() => getFlag(NUDGE_KEY));

  // Only shown to users who haven't set up a key yet (App.tsx gates on !hasApiKey)
  const showWelcome = !welcomeDismissed;

  // Show overlay when user has landed on chat but hasn't done anything yet
  const showOnboarding = !dismissed && memoryCount === 0 && messageCount === 0;

  // Show once after the very first memory is saved
  const showFirstMemoryNudge = !nudgeDismissed && memoryCount === 1 && messageCount >= 1;

  const dismissWelcome = useCallback(() => {
    setFlag(WELCOME_KEY);
    setWelcomeDismissed(true);
  }, []);

  const dismiss = useCallback(() => {
    setFlag(ONBOARDING_KEY);
    setDismissed(true);
  }, []);

  const dismissNudge = useCallback(() => {
    setFlag(NUDGE_KEY);
    setNudgeDismissed(true);
  }, []);

  return {
    showWelcome,
    showOnboarding,
    showFirstMemoryNudge,
    dismissWelcome,
    dismiss,
    dismissNudge,
  };
}
