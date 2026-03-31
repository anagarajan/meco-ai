import { Bell } from "lucide-react";
import type { MemoryItem } from "../../types/domain";
import { useReminders } from "../../hooks/useReminders";
import { ReminderCard } from "./ReminderCard";

interface ReminderManagerProps {
  memories: MemoryItem[];
}

export function ReminderManager({ memories }: ReminderManagerProps) {
  const { reminders, loading, remove, toggle, snooze, memoryForReminder } = useReminders(memories);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-[15px] text-ios-gray-1">Loading reminders…</p>
      </div>
    );
  }

  const activeReminders = reminders.filter((r) => r.active && !r.fired);
  const completedReminders = reminders.filter((r) => r.fired && !r.recurrence);
  const inactiveReminders = reminders.filter((r) => !r.active);

  if (reminders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 px-6 text-center">
        <div className="w-14 h-14 rounded-[16px] bg-ios-gray-6 flex items-center justify-center">
          <Bell size={24} className="text-ios-gray-2" />
        </div>
        <p className="text-[15px] font-semibold text-ios-label">No reminders</p>
        <p className="text-[13px] text-ios-gray-1 max-w-xs leading-relaxed">
          Set a reminder from the Memory Ledger or Timeline by tapping the bell icon on any memory with a future date.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Active */}
      {activeReminders.length > 0 && (
        <Section title={`Active (${activeReminders.length})`}>
          {activeReminders.map((r) => (
            <ReminderCard
              key={r.id}
              reminder={r}
              memory={memoryForReminder(r)}
              onSnooze={snooze}
              onToggle={toggle}
              onDelete={remove}
            />
          ))}
        </Section>
      )}

      {/* Completed */}
      {completedReminders.length > 0 && (
        <Section title={`Completed (${completedReminders.length})`}>
          {completedReminders.map((r) => (
            <ReminderCard
              key={r.id}
              reminder={r}
              memory={memoryForReminder(r)}
              onSnooze={snooze}
              onToggle={toggle}
              onDelete={remove}
            />
          ))}
        </Section>
      )}

      {/* Inactive */}
      {inactiveReminders.length > 0 && (
        <Section title={`Disabled (${inactiveReminders.length})`}>
          {inactiveReminders.map((r) => (
            <ReminderCard
              key={r.id}
              reminder={r}
              memory={memoryForReminder(r)}
              onSnooze={snooze}
              onToggle={toggle}
              onDelete={remove}
            />
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-[13px] font-semibold text-ios-gray-1 px-1">{title}</h3>
      {children}
    </div>
  );
}
