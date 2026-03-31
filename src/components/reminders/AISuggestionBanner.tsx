import { Bell, X } from "lucide-react";
import type { ReminderSuggestion } from "../../services/reminders/smartReminderDetector";
import { formatTimestamp } from "../../utils/date";

interface AISuggestionBannerProps {
  suggestion: ReminderSuggestion;
  memoryId: string;
  onAccept: (memoryId: string, suggestion: ReminderSuggestion) => void;
  onDismiss: () => void;
}

export function AISuggestionBanner({ suggestion, memoryId, onAccept, onDismiss }: AISuggestionBannerProps) {
  const dateStr = formatTimestamp(suggestion.suggestedDate.toISOString());
  const recurrenceLabel = suggestion.recurrence
    ? ` (${suggestion.recurrence.pattern}${suggestion.recurrence.pattern === "custom" && suggestion.recurrence.interval ? `, every ${suggestion.recurrence.interval}d` : ""})`
    : "";

  return (
    <div className="mx-4 mb-2 rounded-[14px] bg-[#FF9500]/10 border border-[#FF9500]/20 px-4 py-3 space-y-2">
      <div className="flex items-start gap-2">
        <Bell size={16} className="text-[#FF9500] shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-medium text-ios-label leading-snug">
            Set a reminder?
          </p>
          <p className="text-[13px] text-ios-gray-1 leading-snug mt-0.5">
            {dateStr}{recurrenceLabel}
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-ios-gray-2 hover:bg-ios-fill transition-colors border-0"
          aria-label="Dismiss suggestion"
        >
          <X size={14} />
        </button>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onAccept(memoryId, suggestion)}
          className="flex items-center gap-1.5 px-4 py-[6px] rounded-full text-[13px] font-semibold bg-[#FF9500] text-white border-0 hover:bg-[#FF9500]/90 transition-colors"
        >
          <Bell size={12} />
          Set Reminder
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="px-4 py-[6px] rounded-full text-[13px] font-medium bg-ios-fill text-ios-gray-1 border-0 hover:bg-ios-gray-5 transition-colors"
        >
          Not now
        </button>
      </div>
    </div>
  );
}
