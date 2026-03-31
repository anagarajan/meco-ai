import type { RecurrenceRule } from "../../types/domain";

/**
 * Given a recurrence rule and the last time the reminder fired,
 * computes the next occurrence. Returns null if the recurrence
 * has ended (past end_date) or the rule is invalid.
 */
export function computeNextOccurrence(rule: RecurrenceRule, lastFired: Date): Date | null {
  const next = new Date(lastFired);

  switch (rule.pattern) {
    case "daily":
      next.setDate(next.getDate() + 1);
      break;
    case "weekly":
      next.setDate(next.getDate() + 7);
      break;
    case "monthly":
      next.setMonth(next.getMonth() + 1);
      break;
    case "custom": {
      const interval = rule.interval ?? 1;
      next.setDate(next.getDate() + interval);
      break;
    }
    default:
      return null;
  }

  if (rule.end_date && next > new Date(rule.end_date)) {
    return null;
  }

  return next;
}
