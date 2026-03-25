import { useEffect, useRef, useState } from "react";
import { Mic, Send, Image, Square, X } from "lucide-react";
import type { AppSettings, ComposerMode } from "../../types/domain";
import { useVoiceRecorder } from "../../hooks/useVoiceRecorder";
import { useSpeechRecognition } from "../../hooks/useSpeechRecognition";
import { useRelatedMemory } from "../../hooks/useRelatedMemory";
import { cn } from "@/lib/utils";

function formatElapsed(secs: number): string {
  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

interface ComposerProps {
  busy: boolean;
  useCloudTranscription: boolean;
  settings: AppSettings | null;
  onSubmit: (payload: { mode: ComposerMode; text: string; imageBlob?: Blob; audioBlob?: Blob }) => Promise<void>;
}

export function Composer({ busy, useCloudTranscription, settings, onSubmit }: ComposerProps) {
  const [mode, setMode] = useState<ComposerMode>("remember");
  const [text, setText] = useState("");
  const [imageBlob, setImageBlob] = useState<Blob | undefined>();
  const [audioBlob, setAudioBlob] = useState<Blob | undefined>();
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | undefined>();
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { isRecording, elapsed, audioLevel, startRecording, stopRecording } = useVoiceRecorder();
  const { isListening, interimTranscript, isSupported, error: speechError, startListening, stopListening, resetTranscript } = useSpeechRecognition();
  const { relatedMemory, dismiss: dismissRelated } = useRelatedMemory(text, mode, settings);

  useEffect(() => {
    if (!audioBlob) { setAudioPreviewUrl(undefined); return; }
    const url = URL.createObjectURL(audioBlob);
    setAudioPreviewUrl(url);
    return () => { URL.revokeObjectURL(url); };
  }, [audioBlob]);

  useEffect(() => {
    if (isListening) stopListening();
    if (isRecording) stopRecording().catch(() => undefined);
    setAudioBlob(undefined);
    setVoiceError(null);
    resetTranscript();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  async function submitWith(overrideText: string, blob?: Blob): Promise<void> {
    if (!overrideText.trim() && !imageBlob && !blob) return;
    await onSubmit({ mode, text: overrideText, imageBlob, audioBlob: blob });
    setText("");
    setImageBlob(undefined);
    setAudioBlob(undefined);
    resetTranscript();
    setVoiceError(null);
  }

  async function handleSubmit(): Promise<void> {
    await submitWith(text, audioBlob);
  }

  async function handleVoiceButton(): Promise<void> {
    setVoiceError(null);

    if (useCloudTranscription) {
      if (!isRecording) {
        setAudioBlob(undefined);
        await startRecording();
      } else {
        const blob = await stopRecording();
        if (blob) setAudioBlob(blob);
      }
      return;
    }

    if (!isSupported) {
      setVoiceError("Voice input is not supported in this browser. Try Chrome, Edge, or Safari.");
      return;
    }

    if (!isListening) {
      resetTranscript();
      startListening();
    } else {
      const spoken = stopListening();
      if (!spoken.trim()) {
        setVoiceError("No speech detected. Please try again.");
        return;
      }
      if (mode === "ask") {
        if (!busy) await submitWith(spoken);
      } else {
        setText((prev) => (prev.trim() ? prev + " " + spoken : spoken));
      }
    }
  }

  const activeRecording = useCloudTranscription ? isRecording : isListening;
  const voiceSupported = useCloudTranscription || isSupported;
  const displayError = voiceError ?? speechError;
  const canSend = !busy && (text.trim().length > 0 || !!imageBlob || !!audioBlob);

  return (
    <div className="px-3 py-3 space-y-2">
      {/* Mode toggle — pill style */}
      <div className="flex gap-1 p-1 bg-ios-fill rounded-ios-sm w-fit">
        {(["remember", "ask"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={cn(
              "px-4 py-[5px] rounded-[8px] text-[13px] font-medium transition-all border-0",
              mode === m
                ? "bg-ios-surface text-ios-label shadow-sm"
                : "bg-transparent text-ios-gray-1",
            )}
          >
            {m === "remember" ? "Remember" : "Ask"}
          </button>
        ))}
      </div>

      {/* Recording indicator */}
      {isRecording && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-ios bg-red-50 border border-red-100">
          <span className="w-2 h-2 rounded-full bg-ios-red animate-blink shrink-0" />
          <span className="text-[13px] font-semibold tabular-nums text-ios-red w-9">{formatElapsed(elapsed)}</span>
          <div className="flex-1 h-[4px] rounded-full bg-red-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-ios-red transition-[width] duration-100"
              style={{ width: `${Math.max(4, Math.round(audioLevel * 100))}%` }}
            />
          </div>
          <span className="text-[12px] text-ios-red">Recording…</span>
        </div>
      )}

      {/* Listening indicator (local speech) */}
      {isListening && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-ios bg-ios-purple/5 border border-ios-purple/15">
          <span className="w-2 h-2 rounded-full bg-ios-purple animate-blink shrink-0" />
          <span className="text-[13px] text-ios-purple italic flex-1 truncate">
            {interimTranscript || "Listening…"}
          </span>
        </div>
      )}

      {/* Audio listen-back */}
      {audioPreviewUrl && (
        <div className="px-3 py-2 rounded-ios bg-ios-fill border border-ios-sep">
          <p className="text-[12px] text-ios-gray-1 mb-1">Recorded — listen back before saving</p>
          <audio src={audioPreviewUrl} controls className="w-full h-8" style={{ accentColor: "#5856D6" }} />
        </div>
      )}

      {/* Related memory chip */}
      {relatedMemory && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-ios bg-ios-purple/5 border border-ios-purple/15">
          <span className="text-[12px] text-ios-purple font-medium shrink-0">Related:</span>
          <span className="text-[12px] text-ios-gray-1 flex-1 truncate">
            {relatedMemory.canonical_text.length > 70
              ? relatedMemory.canonical_text.slice(0, 70) + "…"
              : relatedMemory.canonical_text}
          </span>
          <button type="button" onClick={dismissRelated} className="shrink-0 text-ios-gray-2 hover:text-ios-gray-1">
            <X size={13} />
          </button>
        </div>
      )}

      {/* Input row */}
      <div className="flex items-end gap-2">
        <div className="flex-1 relative">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={mode === "remember" ? "Remember that…" : "Ask something…"}
            rows={1}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSubmit();
              }
            }}
            className={cn(
              "w-full resize-none px-4 py-[10px] pr-2 rounded-[22px]",
              "bg-ios-gray-6 border border-ios-sep",
              "text-[17px] text-ios-label placeholder:text-ios-gray-2",
              "focus:outline-none focus:border-ios-purple/40 focus:bg-ios-surface",
              "transition-colors min-h-[42px] max-h-[120px]",
            )}
            style={{ overflowY: "auto", lineHeight: "1.4" }}
          />
        </div>

        {/* Mic button */}
        <button
          type="button"
          disabled={!voiceSupported}
          title={!voiceSupported ? "Not supported in this browser" : undefined}
          onClick={() => void handleVoiceButton()}
          className={cn(
            "flex items-center justify-center w-[42px] h-[42px] rounded-full border-0 shrink-0 transition-all",
            activeRecording
              ? "bg-ios-red text-white animate-pulse-record"
              : "bg-ios-gray-5 text-ios-gray-1 hover:bg-ios-gray-4",
            !voiceSupported && "opacity-30",
          )}
        >
          {activeRecording
            ? <Square size={16} />
            : <Mic size={18} />}
        </button>

        {/* Photo button (remember mode only) */}
        {mode === "remember" && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center w-[42px] h-[42px] rounded-full bg-ios-gray-5 text-ios-gray-1 hover:bg-ios-gray-4 border-0 shrink-0 transition-colors"
          >
            <Image size={18} />
          </button>
        )}

        {/* Send */}
        <button
          type="button"
          disabled={!canSend}
          onClick={() => void handleSubmit()}
          className={cn(
            "flex items-center justify-center w-[42px] h-[42px] rounded-full border-0 shrink-0 transition-all",
            canSend
              ? "bg-ios-purple text-white hover:bg-ios-purple-dk active:scale-95"
              : "bg-ios-gray-5 text-ios-gray-2",
          )}
        >
          {busy
            ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            : <Send size={16} />}
        </button>
      </div>

      {/* Status / errors */}
      {(imageBlob || audioBlob || displayError) && (
        <div className="flex flex-wrap gap-2 px-1">
          {imageBlob && (
            <span className="text-[13px] text-ios-gray-1 flex items-center gap-1">
              🖼 Photo attached
            </span>
          )}
          {audioBlob && (
            <span className="text-[13px] text-ios-gray-1 flex items-center gap-1">
              🎙 Voice note ready
            </span>
          )}
          {displayError && (
            <span className="text-[13px] text-ios-red">{displayError}</span>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        accept="image/*"
        capture="environment"
        hidden
        type="file"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) setImageBlob(file);
        }}
      />
    </div>
  );
}

