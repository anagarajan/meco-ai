import {
  createReminder,
  getPendingReminders,
  markReminderFired,
  snoozeReminder as snoozeReminderInDb,
  updateReminder,
} from "../storage/localRepository";
import { fireNotification, requestNotificationPermission, scheduleNotification } from "../../utils/notifications";
import { computeNextOccurrence } from "./recurrenceEngine";
import type { RecurrenceRule, Reminder } from "../../types/domain";
import { db } from "../storage/database";

// In-memory map of active timers so we can cancel them if needed
const activeTimers = new Map<string, ReturnType<typeof setTimeout>>();

export interface ScheduleReminderOptions {
  label?: string;
  recurrence?: RecurrenceRule;
  aiSuggested?: boolean;
}

export async function scheduleMemoryReminder(
  memoryId: string,
  remindAt: Date,
  label: string,
  options: Omit<ScheduleReminderOptions, "label"> = {},
): Promise<boolean> {
  const granted = await requestNotificationPermission();
  if (!granted) return false;

  const reminder = await createReminder(memoryId, remindAt, {
    label,
    recurrence: options.recurrence,
    aiSuggested: options.aiSuggested,
  });

  scheduleTimer(reminder, label);
  return true;
}

export async function snoozeReminder(reminderId: string, until: Date): Promise<void> {
  cancelTimer(reminderId);
  await snoozeReminderInDb(reminderId, until);

  const delayMs = until.getTime() - Date.now();
  if (delayMs <= 0) {
    fireNotification("Memory Reminder", "Snoozed reminder");
    await markReminderFired(reminderId);
  } else {
    const timerId = scheduleNotification("Memory Reminder", "Snoozed reminder", delayMs);
    activeTimers.set(reminderId, timerId);
    setTimeout(async () => {
      activeTimers.delete(reminderId);
      await handleFired(reminderId);
    }, delayMs);
  }
}

/** Called on app open — fires any past-due reminders that were missed (e.g. tab was closed). */
export async function checkAndFirePendingReminders(): Promise<void> {
  const pending = await getPendingReminders();
  const now = Date.now();

  for (const reminder of pending) {
    // Skip snoozed reminders whose snooze hasn't elapsed
    if (reminder.snoozed_until && new Date(reminder.snoozed_until).getTime() > now) {
      scheduleTimer(reminder, reminder.label || `Reminder: ${reminder.memory_id}`);
      continue;
    }

    const remindTime = new Date(reminder.remind_at).getTime();
    if (remindTime <= now) {
      fireNotification("Memory Reminder", reminder.label || `Reminder: ${reminder.memory_id}`);
      await handleFired(reminder.id);
    } else if (!activeTimers.has(reminder.id)) {
      scheduleTimer(reminder, reminder.label || `Reminder: ${reminder.memory_id}`);
    }
  }
}

// ── Internal helpers ──────────────────────────────────────────────

function scheduleTimer(reminder: Reminder, label: string): void {
  const delayMs = new Date(reminder.remind_at).getTime() - Date.now();
  if (delayMs <= 0) return;

  const timerId = scheduleNotification("Memory Reminder", label, delayMs);
  activeTimers.set(reminder.id, timerId);
  setTimeout(async () => {
    activeTimers.delete(reminder.id);
    await handleFired(reminder.id);
  }, delayMs);
}

function cancelTimer(reminderId: string): void {
  const existing = activeTimers.get(reminderId);
  if (existing) {
    clearTimeout(existing);
    activeTimers.delete(reminderId);
  }
}

/**
 * Handles a reminder that has just fired.
 * For recurring reminders: computes the next occurrence and reschedules.
 * For one-shot reminders: marks as fired.
 */
async function handleFired(reminderId: string): Promise<void> {
  const reminder = await db.reminders.get(reminderId);
  if (!reminder) return;

  await markReminderFired(reminderId);

  if (reminder.recurrence) {
    const lastFired = new Date();
    const next = computeNextOccurrence(reminder.recurrence, lastFired);
    if (next) {
      // Reset for next occurrence
      await updateReminder({
        ...reminder,
        remind_at: next.toISOString(),
        fired: false,
        snoozed_until: undefined,
        last_fired_at: lastFired.toISOString(),
      });
      scheduleTimer(
        { ...reminder, remind_at: next.toISOString() },
        reminder.label || `Reminder: ${reminder.memory_id}`,
      );
    }
  }
}
