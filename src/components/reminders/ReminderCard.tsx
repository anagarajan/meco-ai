import { useState } from "react";
import { Bell, BellOff, Clock, Repeat, Trash2 } from "lucide-react";
import type { MemoryItem, Reminder } from "../../types/domain";
import { formatTimestamp } from "../../utils/date";
import { MEMORY_TYPE_COLORS, MEMORY_TYPE_LABELS } from "../../types/memoryTypes";
import { SnoozeMenu } from "./SnoozeMenu";
import { cn } from "@/lib/utils";

interface ReminderCardProps {
  reminder: Reminder;
  memory?: MemoryItem;
  onSnooze: (reminderId: string, until: Date) => void;
  onToggle: (reminderId: string) => void;
  onDelete: (reminderId: string) => void;
}

const RECURRENCE_LABELS: Record<string, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  custom: "Custom",
};

export function ReminderCard({ reminder, memory, onSnooze, onToggle, onDelete }: ReminderCardProps) {
  const [showSnooze, setShowSnooze] = useState(false);

  const isSnoozed = !!(reminder.snoozed_until && new Date(reminder.snoozed_until) > new Date());
  const isPastDue = !reminder.fired && new Date(reminder.remind_at) < new Date();
  const isInactive = !reminder.active;

  const label = reminder.label || memory?.canonical_text || "Reminder";
  const typeColor = memory ? (MEMORY_TYPE_COLORS[memory.memory_type] ?? MEMORY_TYPE_COLORS.other) : "bg-ios-fill text-ios-gray-1";
  const typeLabel = memory ? (MEMORY_TYPE_LABELS[memory.memory_type] ?? "Note") : "Note";

  return (
    <div
      className={cn(
        "rounded-[12px] border border-ios-sep bg-ios-surface overflow-hidden transition-opacity",
        isInactive && "opacity-50",
      )}
    >
      <div className="px-3 pt-2.5 pb-2 space-y-1.5">
        {/* Top row: type badge + status badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn("px-2 py-[2px] rounded-[6px] text-[11px] font-semibold", typeColor)}>
            {typeLabel}
          </span>
          {reminder.recurrence && (
            <span className="flex items-center gap-1 px-2 py-[2px] rounded-[6px] text-[11px] font-semibold bg-ios-purple/10 text-ios-purple">
              <Repeat size={10} />
              {RECURRENCE_LABELS[reminder.recurrence.pattern] ?? "Recurring"}
              {reminder.recurrence.pattern === "custom" && reminder.recurrence.interval
                ? ` (${reminder.recurrence.interval}d)`
                : ""}
            </span>
          )}
          {isSnoozed && (
            <span className="flex items-center gap-1 px-2 py-[2px] rounded-[6px] text-[11px] font-semibold bg-[#FF9500]/10 text-[#FF9500]">
              <Clock size={10} />
              Snoozed
            </span>
          )}
          {isPastDue && !isSnoozed && (
            <span className="px-2 py-[2px] rounded-[6px] text-[11px] font-semibold bg-ios-red/10 text-ios-red">
              Past due
            </span>
          )}
          {reminder.fired && !reminder.recurrence && (
            <span className="px-2 py-[2px] rounded-[6px] text-[11px] font-semibold bg-ios-green/10 text-ios-green">
              Completed
            </span>
          )}
          {reminder.ai_suggested && (
            <span className="px-2 py-[2px] rounded-[6px] text-[11px] font-semibold bg-ios-blue/10 text-ios-blue">
              AI suggested
            </span>
          )}
        </div>

        {/* Label */}
        <p className="text-[14px] text-ios-label leading-snug line-clamp-2">
          {label}
        </p>

        {/* Time info */}
        <div className="flex items-center gap-3 text-[12px] text-ios-gray-2">
          <span>
            {isSnoozed
              ? `Snoozed until ${formatTimestamp(reminder.snoozed_until!)}`
              : reminder.fired
                ? `Fired ${reminder.last_fired_at ? formatTimestamp(reminder.last_fired_at) : ""}`
                : `Due ${formatTimestamp(reminder.remind_at)}`}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 px-3 pb-2.5 flex-wrap relative">
        {/* Snooze */}
        {!reminder.fired && reminder.active && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowSnooze((p) => !p)}
              className="flex items-center gap-1 px-3 py-[5px] rounded-full text-[12px] font-medium bg-[#FF9500]/10 text-[#FF9500] border-0 hover:bg-[#FF9500]/20"
            >
              <Clock size={10} /> Snooze
            </button>
            {showSnooze && (
              <SnoozeMenu
                onSnooze={(until) => onSnooze(reminder.id, until)}
                onClose={() => setShowSnooze(false)}
              />
            )}
          </div>
        )}

        {/* Toggle active */}
        <button
          type="button"
          onClick={() => onToggle(reminder.id)}
          className={cn(
            "flex items-center gap-1 px-3 py-[5px] rounded-full text-[12px] font-medium border-0",
            reminder.active
              ? "bg-ios-fill text-ios-gray-1 hover:bg-ios-gray-5"
              : "bg-ios-purple/10 text-ios-purple hover:bg-ios-purple/20",
          )}
        >
          {reminder.active ? <><BellOff size={10} /> Disable</> : <><Bell size={10} /> Enable</>}
        </button>

        {/* Delete */}
        <button
          type="button"
          onClick={() => onDelete(reminder.id)}
          className="flex items-center gap-1 px-3 py-[5px] rounded-full text-[12px] font-medium bg-ios-red/10 text-ios-red border-0 hover:bg-ios-red/20"
        >
          <Trash2 size={10} /> Delete
        </button>
      </div>
    </div>
  );
}
