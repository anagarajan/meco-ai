import type { MemoryType } from "./domain";

export const MEMORY_TYPE_LABELS: Record<MemoryType, string> = {
  object_location: "Location",
  person_fact:     "Person",
  commitment:      "Commitment",
  event:           "Event",
  preference:      "Preference",
  other:           "Note",
};

export const MEMORY_TYPE_COLORS: Record<MemoryType, string> = {
  object_location: "bg-ios-blue/10 text-ios-blue",
  person_fact:     "bg-ios-green/10 text-ios-green",
  commitment:      "bg-ios-red/10 text-ios-red",
  event:           "bg-[#FF9500]/10 text-[#FF9500]",
  preference:      "bg-ios-purple/10 text-ios-purple",
  other:           "bg-ios-fill text-ios-gray-1",
};

export const ALL_MEMORY_TYPES: MemoryType[] = [
  "event",
  "commitment",
  "object_location",
  "person_fact",
  "preference",
  "other",
];
