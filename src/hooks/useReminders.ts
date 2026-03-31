import { useState, useEffect, useCallback } from "react";
import type { MemoryItem, Reminder } from "../types/domain";
import {
  listAllReminders,
  deleteReminder as deleteReminderInDb,
  toggleReminderActive as toggleInDb,
} from "../services/storage/localRepository";
import { snoozeReminder as snoozeInService } from "../services/reminders/reminderService";

export function useReminders(memories: MemoryItem[]) {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const all = await listAllReminders();
    setReminders(all);
    setLoading(false);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const memoryMap = new Map(memories.map((m) => [m.id, m]));

  function memoryForReminder(r: Reminder): MemoryItem | undefined {
    return memoryMap.get(r.memory_id);
  }

  async function remove(reminderId: string): Promise<void> {
    await deleteReminderInDb(reminderId);
    setReminders((prev) => prev.filter((r) => r.id !== reminderId));
  }

  async function toggle(reminderId: string): Promise<void> {
    await toggleInDb(reminderId);
    setReminders((prev) =>
      prev.map((r) => (r.id === reminderId ? { ...r, active: !r.active } : r)),
    );
  }

  async function snooze(reminderId: string, until: Date): Promise<void> {
    await snoozeInService(reminderId, until);
    await refresh();
  }

  const active = reminders.filter((r) => r.active && !r.fired);
  const snoozed = reminders.filter((r) => r.snoozed_until && !r.fired && r.active);
  const completed = reminders.filter((r) => r.fired && !r.recurrence);

  return {
    reminders,
    active,
    snoozed,
    completed,
    loading,
    refresh,
    remove,
    toggle,
    snooze,
    memoryForReminder,
  };
}
