import { useState } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface SnoozeMenuProps {
  onSnooze: (until: Date) => void;
  onClose: () => void;
}

function addMinutes(mins: number): Date {
  return new Date(Date.now() + mins * 60_000);
}

function tomorrowAt9(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d;
}

export function SnoozeMenu({ onSnooze, onClose }: SnoozeMenuProps) {
  const [showCustom, setShowCustom] = useState(false);
  const [customDatetime, setCustomDatetime] = useState("");

  const presets = [
    { label: "5 minutes", action: () => onSnooze(addMinutes(5)) },
    { label: "1 hour", action: () => onSnooze(addMinutes(60)) },
    { label: "Tomorrow 9am", action: () => onSnooze(tomorrowAt9()) },
  ];

  function handleCustomSubmit() {
    if (!customDatetime) return;
    const date = new Date(customDatetime);
    if (date > new Date()) {
      onSnooze(date);
    }
  }

  return (
    <div className="absolute right-0 top-full mt-1 z-20 w-52 rounded-[12px] bg-ios-surface border border-ios-sep shadow-lg overflow-hidden">
      <div className="px-3 py-2 border-b border-ios-sep">
        <div className="flex items-center gap-1.5 text-[13px] font-semibold text-ios-label">
          <Clock size={13} />
          Snooze until
        </div>
      </div>

      {presets.map(({ label, action }) => (
        <button
          key={label}
          type="button"
          onClick={() => { action(); onClose(); }}
          className="w-full px-3 py-2.5 text-left text-[14px] text-ios-label border-0 bg-transparent hover:bg-ios-fill transition-colors"
        >
          {label}
        </button>
      ))}

      <div className="border-t border-ios-sep">
        {!showCustom ? (
          <button
            type="button"
            onClick={() => setShowCustom(true)}
            className="w-full px-3 py-2.5 text-left text-[14px] text-ios-purple border-0 bg-transparent hover:bg-ios-fill transition-colors"
          >
            Custom time…
          </button>
        ) : (
          <div className="px-3 py-2 space-y-2">
            <input
              type="datetime-local"
              value={customDatetime}
              onChange={(e) => setCustomDatetime(e.target.value)}
              min={new Date().toISOString().slice(0, 16)}
              className={cn(
                "w-full px-2 py-1.5 rounded-[8px] text-[13px] text-ios-label",
                "bg-ios-bg border border-ios-sep focus:outline-none focus:border-ios-purple/50",
              )}
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { handleCustomSubmit(); onClose(); }}
                disabled={!customDatetime}
                className="flex-1 py-1.5 rounded-[8px] text-[12px] font-medium bg-ios-purple text-white border-0 disabled:opacity-50"
              >
                Set
              </button>
              <button
                type="button"
                onClick={() => setShowCustom(false)}
                className="flex-1 py-1.5 rounded-[8px] text-[12px] font-medium bg-ios-fill text-ios-gray-1 border-0"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
