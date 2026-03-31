import { useState } from "react";
import type { MemoryItem, MemoryType } from "../../types/domain";
import { useCalendarData } from "../../hooks/useCalendarData";
import { TimelineCalendar } from "./TimelineCalendar";
import { TimelineDayFeed } from "./TimelineDayFeed";
import { MemoryStats } from "./MemoryStats";
import { MEMORY_TYPE_COLORS, MEMORY_TYPE_LABELS, ALL_MEMORY_TYPES } from "../../types/memoryTypes";
import { cn } from "@/lib/utils";

interface MemoryTimelineProps {
  memories: MemoryItem[];
  onDelete: (memoryId: string) => Promise<void>;
  onEdit: (memoryId: string, newText: string) => Promise<void>;
}

export function MemoryTimeline({ memories, onDelete, onEdit }: MemoryTimelineProps) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] = useState<Set<MemoryType>>(new Set());

  const memoriesByDate = useCalendarData(memories, activeFilters);
  const dayMemories = selectedDate ? (memoriesByDate.get(selectedDate) ?? []) : [];

  function toggleFilter(type: MemoryType) {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type); else next.add(type);
      return next;
    });
  }

  function handleMonthChange(y: number, m: number) {
    setYear(y);
    setMonth(m);
  }

  return (
    <div className="flex flex-col">
      <MemoryStats memories={memories} />

      {/* Type filter chips */}
      <div className="flex gap-2 px-4 pb-3 overflow-x-auto no-scrollbar">
        {ALL_MEMORY_TYPES.map((type) => {
          const isActive = activeFilters.has(type);
          return (
            <button
              key={type}
              type="button"
              onClick={() => toggleFilter(type)}
              className={cn(
                "shrink-0 px-3 py-[5px] rounded-full text-[12px] font-semibold border-0 transition-colors",
                isActive
                  ? MEMORY_TYPE_COLORS[type]
                  : "bg-ios-fill text-ios-gray-1 hover:bg-ios-gray-5",
              )}
            >
              {MEMORY_TYPE_LABELS[type]}
            </button>
          );
        })}
      </div>

      {memories.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 px-6 text-center">
          <div className="w-14 h-14 rounded-[16px] bg-ios-gray-6 flex items-center justify-center">
            <span className="text-2xl">📋</span>
          </div>
          <p className="text-[15px] font-semibold text-ios-label">No memories yet</p>
          <p className="text-[13px] text-ios-gray-1 max-w-xs leading-relaxed">
            Switch to Remember mode and save your first memory.
          </p>
        </div>
      ) : (
        <>
          {/* Calendar + Day Feed — side-by-side on desktop, stacked on mobile */}
          <div className="flex flex-col lg:flex-row gap-4 px-4 pb-6">
            <div className="lg:w-[320px] shrink-0">
              <TimelineCalendar
                memoriesByDate={memoriesByDate}
                selectedDate={selectedDate}
                year={year}
                month={month}
                onSelectDate={setSelectedDate}
                onMonthChange={handleMonthChange}
              />
            </div>
            <div className="flex-1 min-w-0">
              <TimelineDayFeed
                memories={dayMemories}
                selectedDate={selectedDate}
                onDelete={onDelete}
                onEdit={onEdit}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
