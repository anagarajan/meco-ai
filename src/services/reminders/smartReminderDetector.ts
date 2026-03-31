import type { MemoryType, RecurrenceRule } from "../../types/domain";
import { parseFutureDate } from "../../utils/date";

export interface ReminderSuggestion {
  suggestedDate: Date;
  label: string;
  recurrence?: RecurrenceRule;
}

const DEADLINE_KEYWORDS = /\b(expires?|expir(?:ing|ation)|due|deadline|renew(?:al)?|appointment|meeting|interview|flight|checkout|check-out|check[\s-]?in)\b/i;
const RECURRING_KEYWORDS = /\b(every\s+(?:day|week|month|year)|daily|weekly|monthly|yearly|annual(?:ly)?)\b/i;

/**
 * Inspects memory text for future dates paired with deadline-like language.
 * Returns a suggestion if a clear opportunity is found, null otherwise.
 */
export function detectReminderOpportunity(memoryText: string, memoryType: MemoryType): ReminderSuggestion | null {
  const futureDate = parseFutureDate(memoryText);
  if (!futureDate) return null;

  // Only suggest for types that naturally have time sensitivity
  const timeSensitiveTypes: ReadonlySet<MemoryType> = new Set(["event", "commitment", "other"]);
  if (!timeSensitiveTypes.has(memoryType) && !DEADLINE_KEYWORDS.test(memoryText)) {
    return null;
  }

  const label = buildLabel(memoryText);
  const recurrence = detectRecurrence(memoryText);

  // For expiry-type reminders, suggest reminding 1 day before
  if (/\b(expires?|expir(?:ing|ation)|renew(?:al)?)\b/i.test(memoryText)) {
    const dayBefore = new Date(futureDate);
    dayBefore.setDate(dayBefore.getDate() - 1);
    if (dayBefore > new Date()) {
      return { suggestedDate: dayBefore, label, recurrence };
    }
  }

  return { suggestedDate: futureDate, label, recurrence };
}

function buildLabel(text: string): string {
  // Take the first ~80 characters, trimmed to a word boundary
  const trimmed = text.length > 80 ? text.slice(0, 80).replace(/\s+\S*$/, "…") : text;
  return trimmed;
}

function detectRecurrence(text: string): RecurrenceRule | undefined {
  const match = RECURRING_KEYWORDS.exec(text);
  if (!match) return undefined;

  const phrase = match[1].toLowerCase();
  if (/daily|every\s+day/.test(phrase)) return { pattern: "daily" };
  if (/weekly|every\s+week/.test(phrase)) return { pattern: "weekly" };
  if (/monthly|every\s+month/.test(phrase)) return { pattern: "monthly" };
  return undefined;
}
