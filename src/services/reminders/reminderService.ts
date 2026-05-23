import {
  createReminder,
  getPendingReminders,
  markReminderFired,
  snoozeReminder as snoozeReminderInDb,
  updateReminder,
} from "../storage/localRepository";
import {
  cancelReminderNotification,
  fireNotification,
  requestNotificationPermission,
  scheduleNotification,
  scheduleReminderNotification,
} from "../../utils/notifications";
import { Capacitor } from "@capacitor/core";
import { computeNextOccurrence } from "./recurrenceEngine";
import type { RecurrenceRule, Reminder } from "../../types/domain";
import { db } from "../storage/database";

const isNative = Capacitor.isNativePlatform();

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

  if (isNative) {
    await scheduleReminderNotification(reminder.id, "MeCo Reminder", label, remindAt);
  } else {
    scheduleTimer(reminder, label);
  }
  return true;
}

export async function snoozeReminder(reminderId: string, until: Date): Promise<void> {
  if (isNative) {
    await cancelReminderNotification(reminderId);
    await snoozeReminderInDb(reminderId, until);
    const delayMs = until.getTime() - Date.now();
    if (delayMs <= 0) {
      await markReminderFired(reminderId);
    } else {
      const reminder = await db.reminders.get(reminderId);
      const label = reminder?.label ?? "Snoozed reminder";
      await scheduleReminderNotification(reminderId, "MeCo Reminder", label, until);
    }
    return;
  }

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

/** Called on app open — reconciles Dexie reminders with the OS notification scheduler. */
export async function checkAndFirePendingReminders(): Promise<void> {
  const pending = await getPendingReminders();
  const now = Date.now();

  if (isNative) {
    for (const reminder of pending) {
      if (reminder.snoozed_until && new Date(reminder.snoozed_until).getTime() > now) continue;

      const remindTime = new Date(reminder.remind_at).getTime();
      if (remindTime <= now) {
        // Notification already delivered by OS while app was closed — update DB state
        await handleFired(reminder.id);
      }
      // Future reminders: OS already has them scheduled (or will after scheduleMemoryReminder)
    }
    return;
  }

  // Web / PWA path — use in-memory timers
  for (const reminder of pending) {
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

/** Cancels the OS-scheduled notification for a reminder (native only; no-op on web). */
export async function cancelScheduledReminder(reminderId: string): Promise<void> {
  if (isNative) {
    await cancelReminderNotification(reminderId);
  } else {
    cancelTimer(reminderId);
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
      await updateReminder({
        ...reminder,
        remind_at: next.toISOString(),
        fired: false,
        snoozed_until: undefined,
        last_fired_at: lastFired.toISOString(),
      });
      const label = reminder.label || `Reminder: ${reminder.memory_id}`;
      if (isNative) {
        await scheduleReminderNotification(reminder.id, "MeCo Reminder", label, next);
      } else {
        scheduleTimer({ ...reminder, remind_at: next.toISOString() }, label);
      }
    }
  }
}
