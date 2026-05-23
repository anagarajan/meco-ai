import { useEffect, useRef, useState } from "react";
import { Mic, Send, Image, Square, X } from "lucide-react";
import type { AppSettings, ComposerMode } from "../../types/domain";
import { useSpeechRecognition } from "../../hooks/useSpeechRecognition";
import { useRelatedMemory } from "../../hooks/useRelatedMemory";
import { VoiceRecordingPanel } from "./VoiceRecordingPanel";
import { cn } from "@/lib/utils";

interface ComposerProps {
  busy: boolean;
  useCloudTranscription: boolean;
  settings: AppSettings | null;
  prefillText?: string;
  onSubmit: (payload: { mode: ComposerMode; text: string; imageBlob?: Blob; audioBlob?: Blob }) => Promise<void>;
}

export function Composer({ busy, useCloudTranscription, settings, prefillText, onSubmit }: ComposerProps) {
  const [mode, setMode] = useState<ComposerMode>("remember");
  const [text, setText] = useState("");
  const [imageBlob, setImageBlob] = useState<Blob | undefined>();
  const [voiceMode, setVoiceMode] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { isListening, interimTranscript, isSupported, error: speechError, startListening, stopListening, resetTranscript } = useSpeechRecognition();
  const { relatedMemory, dismiss: dismissRelated } = useRelatedMemory(text, mode, settings);

  useEffect(() => {
    if (isListening) stopListening();
    setVoiceMode(false);
    setVoiceError(null);
    resetTranscript();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(() => {
    if (prefillText) setText(prefillText);
  }, [prefillText]);

  async function submitWith(overrideText: string, audioBlob?: Blob): Promise<void> {
    if (!overrideText.trim() && !imageBlob && !audioBlob) return;
    await onSubmit({ mode, text: overrideText, imageBlob, audioBlob });
    setText("");
    setImageBlob(undefined);
    resetTranscript();
    setVoiceError(null);
  }

  async function handleSubmit(): Promise<void> {
    await submitWith(text);
  }

  function handleVoiceButton(): void {
    setVoiceError(null);

    if (useCloudTranscription) {
      // Enter voice recording mode — panel handles recording
      setVoiceMode(true);
      return;
    }

    // Local speech recognition path (unchanged)
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
        if (!busy) void submitWith(spoken);
      } else {
        setText((prev) => (prev.trim() ? prev + " " + spoken : spoken));
      }
    }
  }

  function handleVoiceSend(blob: Blob): void {
    setVoiceMode(false);
    void submitWith("", blob);
  }

  function handleVoiceDiscard(): void {
    setVoiceMode(false);
  }

  const voiceSupported = useCloudTranscription || isSupported;
  const displayError = voiceError ?? speechError;
  const canSend = !busy && (text.trim().length > 0 || !!imageBlob);
  const imageSupported = settings?.default_ai_provider !== "groq";

  // Show voice recording panel (cloud transcription)
  if (voiceMode && useCloudTranscription) {
    return (
      <div className="px-3 py-3 space-y-2">
        {/* Mode toggle */}
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

        <VoiceRecordingPanel onSend={handleVoiceSend} onDiscard={handleVoiceDiscard} />
      </div>
    );
  }

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

      {/* Listening indicator (local speech) */}
      {isListening && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-ios bg-ios-purple/5 border border-ios-purple/15">
          <span className="w-2 h-2 rounded-full bg-ios-purple animate-blink shrink-0" />
          <span className="text-[13px] text-ios-purple italic flex-1 truncate">
            {interimTranscript || "Listening…"}
          </span>
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
          onClick={handleVoiceButton}
          className={cn(
            "flex items-center justify-center w-[42px] h-[42px] rounded-full border-0 shrink-0 transition-all",
            isListening
              ? "bg-ios-red text-white animate-pulse-record"
              : "bg-ios-gray-5 text-ios-gray-1 hover:bg-ios-gray-4",
            !voiceSupported && "opacity-30",
          )}
        >
          {isListening
            ? <Square size={16} />
            : <Mic size={18} />}
        </button>

        {/* Photo button (remember mode only) */}
        {mode === "remember" && (
          <button
            type="button"
            disabled={!imageSupported}
            title={imageSupported ? undefined : "Image not supported with Groq — switch to OpenAI or Anthropic in Settings"}
            onClick={() => imageSupported && fileInputRef.current?.click()}
            className={cn(
              "flex items-center justify-center w-[42px] h-[42px] rounded-full border-0 shrink-0 transition-colors",
              imageSupported
                ? "bg-ios-gray-5 text-ios-gray-1 hover:bg-ios-gray-4"
                : "bg-ios-gray-5 text-ios-gray-3 opacity-40 cursor-not-allowed",
            )}
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
      {(imageBlob || displayError) && (
        <div className="flex flex-wrap gap-2 px-1">
          {imageBlob && (
            <span className="text-[13px] text-ios-gray-1 flex items-center gap-1">
              🖼 Photo attached
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
