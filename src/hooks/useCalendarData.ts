import { useMemo } from "react";
import type { MemoryItem, MemoryType } from "../types/domain";

/**
 * Groups memories by date string (YYYY-MM-DD), optionally filtered by type.
 */
export function useCalendarData(
  memories: MemoryItem[],
  activeFilters: Set<MemoryType>,
): Map<string, MemoryItem[]> {
  return useMemo(() => {
    const map = new Map<string, MemoryItem[]>();
    for (const m of memories) {
      if (activeFilters.size > 0 && !activeFilters.has(m.memory_type)) continue;
      const key = m.created_at.slice(0, 10); // "YYYY-MM-DD"
      const list = map.get(key);
      if (list) {
        list.push(m);
      } else {
        map.set(key, [m]);
      }
    }
    return map;
  }, [memories, activeFilters]);
}
