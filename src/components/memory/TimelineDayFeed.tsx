import { useState } from "react";
import { Play, Square, Trash2, Pencil, Check, X, Bell } from "lucide-react";
import type { MemoryItem } from "../../types/domain";
import { formatTimestamp, parseFutureDate } from "../../utils/date";
import { getAssetByMessageId, getReminderForMemory } from "../../services/storage/localRepository";
import { scheduleMemoryReminder } from "../../services/reminders/reminderService";
import { MEMORY_TYPE_COLORS, MEMORY_TYPE_LABELS } from "../../types/memoryTypes";
import { cn } from "@/lib/utils";

interface TimelineDayFeedProps {
  memories: MemoryItem[];
  selectedDate: string | null;
  onDelete: (memoryId: string) => Promise<void>;
  onEdit: (memoryId: string, newText: string) => Promise<void>;
}

export function TimelineDayFeed({ memories, selectedDate, onDelete, onEdit }: TimelineDayFeedProps) {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [reminderSet, setReminderSet] = useState<Record<string, boolean>>({});

  if (!selectedDate) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 px-6 text-center">
        <p className="text-[15px] text-ios-gray-1">Select a day to view memories</p>
      </div>
    );
  }

  if (memories.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 px-6 text-center">
        <p className="text-[15px] text-ios-gray-1">No memories on this day</p>
      </div>
    );
  }

  // Sort by time ascending within the day
  const sorted = [...memories].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  async function handlePlay(memory: MemoryItem): Promise<void> {
    if (playingId === memory.id) { setPlayingId(null); return; }
    const asset = await getAssetByMessageId(memory.message_id);
    if (!asset) return;
    const url = URL.createObjectURL(asset.blob);
    const audio = new Audio(url);
    setPlayingId(memory.id);
    audio.onended = () => { URL.revokeObjectURL(url); setPlayingId(null); };
    audio.onerror = () => { URL.revokeObjectURL(url); setPlayingId(null); };
    await audio.play();
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

  const formattedDate = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(selectedDate + "T12:00:00"));

  return (
    <div className="space-y-2">
      <h3 className="text-[13px] font-semibold text-ios-gray-1 px-1">{formattedDate}</h3>

      <div className="space-y-2">
        {sorted.map((memory) => {
          const typeColor = MEMORY_TYPE_COLORS[memory.memory_type] ?? MEMORY_TYPE_COLORS.other;
          const typeLabel = MEMORY_TYPE_LABELS[memory.memory_type] ?? "Note";
          const isEditing = editingId === memory.id;
          const futureDate = parseFutureDate(memory.canonical_text);
          const hasReminder = reminderSet[memory.id] ?? false;

          return (
            <div
              key={memory.id}
              className="rounded-[12px] border border-ios-sep bg-ios-surface overflow-hidden"
            >
              {/* Header row */}
              <div className="flex items-center gap-2 px-3 pt-2.5 pb-1">
                <span className={cn("px-2 py-[2px] rounded-[6px] text-[11px] font-semibold", typeColor)}>
                  {typeLabel}
                </span>
                <span className="text-[11px] text-ios-gray-2 ml-auto">
                  {formatTimestamp(memory.created_at)}
                </span>
              </div>

              {/* Content */}
              <div className="px-3 pb-2.5">
                {isEditing ? (
                  <div className="space-y-2 pt-1">
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      rows={3}
                      className={cn(
                        "w-full px-3 py-2 rounded-[10px] text-[15px] text-ios-label",
                        "bg-ios-bg border border-ios-sep resize-none",
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
                        onClick={() => { setEditingId(null); setEditText(""); }}
                        className="flex items-center gap-1 px-3 py-[5px] rounded-full text-[13px] font-medium bg-ios-fill text-ios-gray-1 border-0"
                      >
                        <X size={11} /> Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-[15px] text-ios-label leading-relaxed pt-1">
                      {memory.canonical_text}
                    </p>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-wrap pt-2">
                      {memory.source_kind === "voice_note" && (
                        <button
                          type="button"
                          onClick={() => void handlePlay(memory)}
                          className={cn(
                            "flex items-center gap-1 px-3 py-[5px] rounded-full text-[12px] font-medium border-0",
                            playingId === memory.id ? "bg-ios-red/10 text-ios-red" : "bg-ios-purple/10 text-ios-purple",
                          )}
                        >
                          {playingId === memory.id ? <><Square size={10} />Stop</> : <><Play size={10} />Play</>}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => { setEditingId(memory.id); setEditText(memory.canonical_text); }}
                        className="flex items-center gap-1 px-3 py-[5px] rounded-full text-[12px] font-medium bg-ios-fill text-ios-gray-1 border-0 hover:bg-ios-gray-5"
                      >
                        <Pencil size={10} /> Edit
                      </button>
                      {futureDate && (
                        <button
                          type="button"
                          disabled={hasReminder}
                          onClick={() => void handleRemind(memory)}
                          className={cn(
                            "flex items-center gap-1 px-3 py-[5px] rounded-full text-[12px] font-medium border-0",
                            hasReminder
                              ? "bg-ios-green/10 text-ios-green"
                              : "bg-[#FF9500]/10 text-[#FF9500] hover:bg-[#FF9500]/20",
                          )}
                        >
                          <Bell size={10} />
                          {hasReminder ? "Set" : "Remind"}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void onDelete(memory.id)}
                        className="flex items-center gap-1 px-3 py-[5px] rounded-full text-[12px] font-medium bg-ios-red/10 text-ios-red border-0 hover:bg-ios-red/20"
                      >
                        <Trash2 size={10} /> Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
