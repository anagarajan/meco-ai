import { useRef, useState } from "react";
import { Play, Square, Trash2, ChevronRight, Pencil, Check, X, Bell, Search } from "lucide-react";
import type { MemoryItem, MemoryType } from "../../types/domain";
import { formatLongDate, parseFutureDate } from "../../utils/date";
import { getAssetByMessageId, getReminderForMemory } from "../../services/storage/localRepository";
import { scheduleMemoryReminder } from "../../services/reminders/reminderService";
import { MEMORY_TYPE_COLORS, MEMORY_TYPE_LABELS, ALL_MEMORY_TYPES } from "../../types/memoryTypes";
import { MemoryStats } from "./MemoryStats";
import { cn } from "@/lib/utils";

interface MemoryLedgerProps {
  memories: MemoryItem[];
  onDelete: (memoryId: string) => Promise<void>;
  onEdit: (memoryId: string, newText: string) => Promise<void>;
}

export function MemoryLedger({ memories, onDelete, onEdit }: MemoryLedgerProps) {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [reminderSet, setReminderSet] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<Set<MemoryType>>(new Set());
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);

  function stopCurrentPlayback(): void {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current = null;
    }
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    setPlayingId(null);
  }

  async function handlePlay(memory: MemoryItem): Promise<void> {
    if (playingId === memory.id) { stopCurrentPlayback(); return; }
    stopCurrentPlayback();
    const asset = await getAssetByMessageId(memory.message_id);
    if (!asset) return;
    const url = URL.createObjectURL(asset.blob);
    urlRef.current = url;
    const audio = new Audio(url);
    audioRef.current = audio;
    setPlayingId(memory.id);
    audio.onended = () => {
      URL.revokeObjectURL(url);
      urlRef.current = null;
      audioRef.current = null;
      setPlayingId(null);
    };
    audio.onerror = () => { stopCurrentPlayback(); };
    await audio.play();
  }

  function startEdit(memory: MemoryItem) {
    setEditingId(memory.id);
    setEditText(memory.canonical_text);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditText("");
  }

  async function saveEdit(memoryId: string): Promise<void> {
    if (!editText.trim()) return;
    setSavingEdit(true);
    try {
      await onEdit(memoryId, editText.trim());
      setEditingId(null);
      setEditText("");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleRemind(memory: MemoryItem): Promise<void> {
    const date = parseFutureDate(memory.canonical_text);
    if (!date) return;
    const existing = await getReminderForMemory(memory.id);
    if (existing) { setReminderSet((p) => ({ ...p, [memory.id]: true })); return; }
    const ok = await scheduleMemoryReminder(memory.id, date, memory.canonical_text);
    if (ok) setReminderSet((p) => ({ ...p, [memory.id]: true }));
  }

  function toggleFilter(type: MemoryType) {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type); else next.add(type);
      return next;
    });
  }

  const filtered = memories.filter((m) => {
    const matchSearch = searchQuery.trim() === "" ||
      m.canonical_text.toLowerCase().includes(searchQuery.toLowerCase());
    const matchType = activeFilters.size === 0 || activeFilters.has(m.memory_type);
    return matchSearch && matchType;
  });

  return (
    <div className="flex flex-col">
      {/* Stats */}
      <MemoryStats memories={memories} />

      {/* Search */}
      <div className="px-4 pb-2">
        <div className="flex items-center gap-2 px-3 h-10 rounded-[12px] bg-ios-gray-6 border border-ios-sep">
          <Search size={15} className="text-ios-gray-2 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search memories…"
            className="flex-1 bg-transparent text-[15px] text-ios-label placeholder:text-ios-gray-3 focus:outline-none"
          />
          {searchQuery && (
            <button type="button" onClick={() => setSearchQuery("")} className="text-ios-gray-2">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

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

      {/* Empty states */}
      {memories.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 py-16 px-6 text-center">
          <div className="w-14 h-14 rounded-[16px] bg-ios-gray-6 flex items-center justify-center">
            <span className="text-2xl">📋</span>
          </div>
          <p className="text-[15px] font-semibold text-ios-label">No memories yet</p>
          <p className="text-[13px] text-ios-gray-1 max-w-xs leading-relaxed">
            Switch to Remember mode and save your first memory.
          </p>
        </div>
      )}

      {memories.length > 0 && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 py-12 px-6 text-center">
          <p className="text-[15px] text-ios-gray-1">No memories match your search.</p>
        </div>
      )}

      {/* Memory list */}
      {filtered.length > 0 && (
        <div className="px-4 pb-6 space-y-1">
          <div className="rounded-ios-xl overflow-hidden border border-ios-sep bg-ios-surface">
            {filtered.map((memory, idx) => {
              const isExpanded = expandedId === memory.id;
              const isEditing = editingId === memory.id;
              const isLast = idx === filtered.length - 1;
              const typeColor = MEMORY_TYPE_COLORS[memory.memory_type] ?? MEMORY_TYPE_COLORS.other;
              const typeLabel = MEMORY_TYPE_LABELS[memory.memory_type] ?? "Note";
              const futureDate = memory.memory_type === "event" ? parseFutureDate(memory.canonical_text) : null;
              const hasReminder = reminderSet[memory.id] ?? false;

              return (
                <div key={memory.id}>
                  {/* Row */}
                  <button
                    type="button"
                    onClick={() => {
                      if (isEditing) return;
                      setExpandedId(isExpanded ? null : memory.id);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left bg-transparent border-0 hover:bg-ios-gray-6/50 transition-colors"
                  >
                    <span className={cn("shrink-0 px-2 py-[3px] rounded-[6px] text-[11px] font-semibold", typeColor)}>
                      {typeLabel}
                    </span>
                    <span className="flex-1 text-[15px] text-ios-label truncate min-w-0">
                      {memory.canonical_text}
                    </span>
                    <ChevronRight
                      size={16}
                      className={cn("text-ios-gray-2 shrink-0 transition-transform", isExpanded && "rotate-90")}
                    />
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="px-4 pb-3 bg-ios-gray-6/40 space-y-2">
                      {/* Text / edit form */}
                      {isEditing ? (
                        <div className="space-y-2">
                          <textarea
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            rows={3}
                            className={cn(
                              "w-full px-3 py-2 rounded-[10px] text-[15px] text-ios-label",
                              "bg-ios-surface border border-ios-sep resize-none",
                              "focus:outline-none focus:border-ios-purple/50",
                            )}
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              disabled={savingEdit}
                              onClick={() => void saveEdit(memory.id)}
                              className="flex items-center gap-1 px-3 py-[5px] rounded-full text-[13px] font-medium bg-ios-purple text-white border-0 disabled:opacity-50"
                            >
                              <Check size={11} />
                              {savingEdit ? "Saving…" : "Save"}
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              className="flex items-center gap-1 px-3 py-[5px] rounded-full text-[13px] font-medium bg-ios-fill text-ios-gray-1 border-0"
                            >
                              <X size={11} /> Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-[15px] text-ios-label leading-relaxed">
                          {memory.canonical_text}
                        </p>
                      )}

                      {/* Meta + actions */}
                      {!isEditing && (
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <span className="text-[12px] text-ios-gray-1">
                            {formatLongDate(memory.created_at)} · {Math.round(memory.confidence * 100)}% confidence
                          </span>
                          <div className="flex items-center gap-2 flex-wrap">
                            {/* Play (voice notes) */}
                            {memory.source_kind === "voice_note" && (
                              <button
                                type="button"
                                onClick={() => void handlePlay(memory)}
                                className={cn(
                                  "flex items-center gap-1 px-3 py-[5px] rounded-full text-[13px] font-medium border-0",
                                  playingId === memory.id ? "bg-ios-red/10 text-ios-red" : "bg-ios-purple/10 text-ios-purple",
                                )}
                              >
                                {playingId === memory.id ? <><Square size={11} />Stop</> : <><Play size={11} />Play</>}
                              </button>
                            )}
                            {/* Edit */}
                            <button
                              type="button"
                              onClick={() => startEdit(memory)}
                              className="flex items-center gap-1 px-3 py-[5px] rounded-full text-[13px] font-medium bg-ios-fill text-ios-gray-1 border-0 hover:bg-ios-gray-5"
                            >
                              <Pencil size={11} /> Edit
                            </button>
                            {/* Remind me (events with future dates) */}
                            {futureDate && (
                              <button
                                type="button"
                                disabled={hasReminder}
                                onClick={() => void handleRemind(memory)}
                                className={cn(
                                  "flex items-center gap-1 px-3 py-[5px] rounded-full text-[13px] font-medium border-0",
                                  hasReminder
                                    ? "bg-ios-green/10 text-ios-green"
                                    : "bg-[#FF9500]/10 text-[#FF9500] hover:bg-[#FF9500]/20",
                                )}
                              >
                                <Bell size={11} />
                                {hasReminder
                                  ? `Set ✓`
                                  : `Remind ${new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(futureDate)}`}
                              </button>
                            )}
                            {/* Delete */}
                            <button
                              type="button"
                              onClick={() => void onDelete(memory.id)}
                              className="flex items-center gap-1 px-3 py-[5px] rounded-full text-[13px] font-medium bg-ios-red/10 text-ios-red border-0 hover:bg-ios-red/20"
                            >
                              <Trash2 size={11} /> Delete
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {!isLast && <div className="h-px bg-ios-sep ml-4" />}
                </div>
              );
            })}
          </div>
          {filtered.length < memories.length && (
            <p className="text-center text-[12px] text-ios-gray-1 pt-1">
              Showing {filtered.length} of {memories.length} memories
            </p>
          )}
        </div>
      )}
    </div>
  );
}
