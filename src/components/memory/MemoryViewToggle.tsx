import { List, CalendarDays, Bell } from "lucide-react";
import { cn } from "@/lib/utils";

export type MemoryView = "list" | "timeline" | "reminders";

interface MemoryViewToggleProps {
  value: MemoryView;
  onChange: (view: MemoryView) => void;
}

const TABS: { view: MemoryView; label: string; icon: typeof List }[] = [
  { view: "list", label: "List", icon: List },
  { view: "timeline", label: "Timeline", icon: CalendarDays },
  { view: "reminders", label: "Reminders", icon: Bell },
];

export function MemoryViewToggle({ value, onChange }: MemoryViewToggleProps) {
  return (
    <div className="flex items-center gap-1 p-[3px] rounded-[10px] bg-ios-fill">
      {TABS.map(({ view, label, icon: Icon }) => (
        <button
          key={view}
          type="button"
          onClick={() => onChange(view)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-[5px] rounded-[8px] text-[13px] font-medium border-0 transition-colors",
            value === view
              ? "bg-ios-surface text-ios-label shadow-sm"
              : "bg-transparent text-ios-gray-1",
          )}
        >
          <Icon size={14} />
          {label}
        </button>
      ))}
    </div>
  );
}
