import type { MemoryItem, MemoryType } from "../../types/domain";
import { MEMORY_TYPE_COLORS, MEMORY_TYPE_LABELS, ALL_MEMORY_TYPES } from "../../types/memoryTypes";
import { cn } from "@/lib/utils";

interface MemoryStatsProps {
  memories: MemoryItem[];
}

export function MemoryStats({ memories }: MemoryStatsProps) {
  if (memories.length === 0) return null;

  const counts = Object.fromEntries(
    ALL_MEMORY_TYPES.map((t) => [t, memories.filter((m) => m.memory_type === t).length]),
  ) as Record<MemoryType, number>;

  const oldest = memories.reduce((a, b) =>
    new Date(a.created_at) < new Date(b.created_at) ? a : b,
  );
  const oldestDate = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" })
    .format(new Date(oldest.created_at));

  return (
    <div className="px-4 pt-4 pb-2 space-y-2">
      <div className="flex items-baseline gap-2">
        <span className="text-[28px] font-bold text-ios-label leading-none">{memories.length}</span>
        <span className="text-[15px] text-ios-gray-1">
          {memories.length === 1 ? "memory" : "memories"} · since {oldestDate}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {ALL_MEMORY_TYPES.map((type) => {
          const count = counts[type];
          if (count === 0) return null;
          return (
            <span
              key={type}
              className={cn("px-2 py-[3px] rounded-[6px] text-[12px] font-semibold", MEMORY_TYPE_COLORS[type])}
            >
              {MEMORY_TYPE_LABELS[type]} {count}
            </span>
          );
        })}
      </div>
    </div>
  );
}
