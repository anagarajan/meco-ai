import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { MemoryItem } from "../../types/domain";
import { MEMORY_TYPE_COLORS } from "../../types/memoryTypes";
import { cn } from "@/lib/utils";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_DOTS = 4;

interface TimelineCalendarProps {
  memoriesByDate: Map<string, MemoryItem[]>;
  selectedDate: string | null;
  year: number;
  month: number; // 0-indexed
  onSelectDate: (date: string) => void;
  onMonthChange: (year: number, month: number) => void;
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function toKey(y: number, m: number, d: number): string {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}

function todayKey(): string {
  const d = new Date();
  return toKey(d.getFullYear(), d.getMonth(), d.getDate());
}

function buildCalendarGrid(year: number, month: number): (number | null)[][] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weeks: (number | null)[][] = [];
  let week: (number | null)[] = Array.from({ length: firstDay }, () => null);

  for (let d = 1; d <= daysInMonth; d++) {
    week.push(d);
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }
  return weeks;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function TimelineCalendar({
  memoriesByDate,
  selectedDate,
  year,
  month,
  onSelectDate,
  onMonthChange,
}: TimelineCalendarProps) {
  const weeks = buildCalendarGrid(year, month);
  const today = todayKey();

  function prevMonth() {
    if (month === 0) onMonthChange(year - 1, 11);
    else onMonthChange(year, month - 1);
  }

  function nextMonth() {
    if (month === 11) onMonthChange(year + 1, 0);
    else onMonthChange(year, month + 1);
  }

  function goToday() {
    const now = new Date();
    onMonthChange(now.getFullYear(), now.getMonth());
    onSelectDate(today);
  }

  const gridRef = useRef<HTMLDivElement>(null);

  function handleGridKeyDown(e: React.KeyboardEvent) {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    if (!selectedDate) return;
    const currentDay = parseInt(selectedDate.slice(8), 10);
    let nextDay = currentDay;

    switch (e.key) {
      case "ArrowRight": nextDay = Math.min(currentDay + 1, daysInMonth); break;
      case "ArrowLeft": nextDay = Math.max(currentDay - 1, 1); break;
      case "ArrowDown": nextDay = Math.min(currentDay + 7, daysInMonth); break;
      case "ArrowUp": nextDay = Math.max(currentDay - 7, 1); break;
      default: return;
    }
    e.preventDefault();
    const nextKey = toKey(year, month, nextDay);
    onSelectDate(nextKey);

    // Move DOM focus to the new day button
    requestAnimationFrame(() => {
      const btn = gridRef.current?.querySelector(`[aria-label*="${MONTH_NAMES[month]} ${nextDay},"]`) as HTMLElement | null;
      btn?.focus();
    });
  }

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <button
          type="button"
          onClick={prevMonth}
          className="w-8 h-8 flex items-center justify-center rounded-full text-ios-gray-1 hover:bg-ios-fill transition-colors border-0"
          aria-label="Previous month"
        >
          <ChevronLeft size={18} />
        </button>
        <button
          type="button"
          onClick={goToday}
          className="text-[15px] font-semibold text-ios-label hover:text-ios-purple transition-colors border-0 bg-transparent"
        >
          {MONTH_NAMES[month]} {year}
        </button>
        <button
          type="button"
          onClick={nextMonth}
          className="w-8 h-8 flex items-center justify-center rounded-full text-ios-gray-1 hover:bg-ios-fill transition-colors border-0"
          aria-label="Next month"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-0" role="row">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} role="columnheader" className="text-center text-[11px] font-medium text-ios-gray-2 py-1">
            {label}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div ref={gridRef} role="grid" aria-label={`${MONTH_NAMES[month]} ${year}`} onKeyDown={handleGridKeyDown}>
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-0" role="row">
            {week.map((day, di) => {
              if (day === null) {
                return <div key={di} className="h-12" role="gridcell" />;
              }

              const key = toKey(year, month, day);
              const memories = memoriesByDate.get(key);
              const count = memories?.length ?? 0;
              const isToday = key === today;
              const isSelected = key === selectedDate;

              // Collect unique memory types for dots (up to MAX_DOTS)
              const uniqueTypes = memories
                ? [...new Set(memories.map((m) => m.memory_type))].slice(0, MAX_DOTS)
                : [];

              return (
                <button
                  key={di}
                  type="button"
                  role="gridcell"
                  aria-label={`${MONTH_NAMES[month]} ${day}, ${count} memories`}
                  aria-selected={isSelected}
                  onClick={() => onSelectDate(key)}
                  className={cn(
                    "flex flex-col items-center justify-start gap-0.5 h-12 pt-1 border-0 rounded-[10px] transition-colors",
                    isSelected
                      ? "bg-ios-purple/15"
                      : "bg-transparent hover:bg-ios-fill/50",
                  )}
                >
                  <span
                    className={cn(
                      "text-[13px] font-medium leading-none w-6 h-6 flex items-center justify-center rounded-full",
                      isToday && !isSelected && "bg-ios-purple text-white",
                      isToday && isSelected && "bg-ios-purple text-white",
                      !isToday && isSelected && "text-ios-purple font-semibold",
                      !isToday && !isSelected && "text-ios-label",
                    )}
                  >
                    {day}
                  </span>
                  {/* Type-colored dots */}
                  {uniqueTypes.length > 0 && (
                    <div className="flex items-center gap-[3px]">
                      {uniqueTypes.map((type) => {
                        // Extract the text color from the MEMORY_TYPE_COLORS string
                        const colorClass = MEMORY_TYPE_COLORS[type]
                          .split(" ")
                          .find((c) => c.startsWith("text-"));
                        return (
                          <span
                            key={type}
                            className={cn("w-[5px] h-[5px] rounded-full", colorClass)}
                            style={{ backgroundColor: "currentColor" }}
                          />
                        );
                      })}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
