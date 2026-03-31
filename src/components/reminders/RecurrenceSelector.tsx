import { useState } from "react";
import type { RecurrencePattern, RecurrenceRule } from "../../types/domain";
import { cn } from "@/lib/utils";

interface RecurrenceSelectorProps {
  value?: RecurrenceRule;
  onChange: (rule: RecurrenceRule | undefined) => void;
}

const OPTIONS: { label: string; pattern: RecurrencePattern | "none" }[] = [
  { label: "Once", pattern: "none" },
  { label: "Daily", pattern: "daily" },
  { label: "Weekly", pattern: "weekly" },
  { label: "Monthly", pattern: "monthly" },
  { label: "Custom", pattern: "custom" },
];

export function RecurrenceSelector({ value, onChange }: RecurrenceSelectorProps) {
  const activePattern = value?.pattern ?? "none";
  const [customDays, setCustomDays] = useState(value?.interval ?? 3);

  function select(pattern: RecurrencePattern | "none") {
    if (pattern === "none") {
      onChange(undefined);
    } else if (pattern === "custom") {
      onChange({ pattern: "custom", interval: customDays });
    } else {
      onChange({ pattern });
    }
  }

  function handleCustomDaysChange(days: number) {
    const clamped = Math.max(1, Math.min(365, days));
    setCustomDays(clamped);
    if (activePattern === "custom") {
      onChange({ pattern: "custom", interval: clamped });
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-1.5 flex-wrap">
        {OPTIONS.map(({ label, pattern }) => (
          <button
            key={pattern}
            type="button"
            onClick={() => select(pattern)}
            className={cn(
              "px-3 py-[5px] rounded-full text-[12px] font-medium border-0 transition-colors",
              activePattern === pattern
                ? "bg-ios-purple text-white"
                : "bg-ios-fill text-ios-gray-1 hover:bg-ios-gray-5",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {activePattern === "custom" && (
        <div className="flex items-center gap-2 text-[13px] text-ios-label">
          <span>Every</span>
          <input
            type="number"
            min={1}
            max={365}
            value={customDays}
            onChange={(e) => handleCustomDaysChange(parseInt(e.target.value, 10) || 1)}
            className="w-16 px-2 py-1 rounded-[8px] bg-ios-bg border border-ios-sep text-center text-[13px] text-ios-label focus:outline-none focus:border-ios-purple/50"
          />
          <span>days</span>
        </div>
      )}
    </div>
  );
}
