import {
  createReminder,
  getPendingReminders,
  markReminderFired,
} from "../storage/localRepository";
import { fireNotification, requestNotificationPermission, scheduleNotification } from "../../utils/notifications";

// In-memory map of active timers so we can cancel them if needed
const activeTimers = new Map<string, ReturnType<typeof setTimeout>>();

export async function scheduleMemoryReminder(memoryId: string, remindAt: Date, label: string): Promise<boolean> {
  const granted = await requestNotificationPermission();
  if (!granted) return false;

  const reminder = await createReminder(memoryId, remindAt);
  const delayMs = remindAt.getTime() - Date.now();

  if (delayMs <= 0) {
    // Already past — fire immediately
    fireNotification("Memory Reminder", label);
    await markReminderFired(reminder.id);
  } else {
    const timerId = scheduleNotification("Memory Reminder", label, delayMs);
    activeTimers.set(reminder.id, timerId);
    // Mark fired after the timer fires
    setTimeout(async () => {
      activeTimers.delete(reminder.id);
      await markReminderFired(reminder.id);
    }, delayMs);
  }

  return true;
}

/** Called on app open — fires any past-due reminders that were missed (e.g. tab was closed). */
export async function checkAndFirePendingReminders(): Promise<void> {
  const pending = await getPendingReminders();
  const now = Date.now();

  for (const reminder of pending) {
    const remindTime = new Date(reminder.remind_at).getTime();
    if (remindTime <= now) {
      // Past due — fire immediately
      fireNotification("Memory Reminder", `Reminder: ${reminder.memory_id}`);
      await markReminderFired(reminder.id);
    } else if (!activeTimers.has(reminder.id)) {
      // Future reminder — reschedule the timer (page was refreshed)
      const delayMs = remindTime - now;
      const timerId = scheduleNotification("Memory Reminder", `Reminder`, delayMs);
      activeTimers.set(reminder.id, timerId);
      setTimeout(async () => {
        activeTimers.delete(reminder.id);
        await markReminderFired(reminder.id);
      }, delayMs);
    }
  }
}
