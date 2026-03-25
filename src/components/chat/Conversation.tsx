import { useEffect, useRef } from "react";
import type { ChatMessage } from "../../types/domain";
import { formatTimestamp } from "../../utils/date";
import { cn } from "@/lib/utils";

interface ConversationProps {
  messages: ChatMessage[];
}

export function Conversation({ messages }: ConversationProps) {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
        <div className="w-16 h-16 rounded-[18px] bg-ios-purple/10 flex items-center justify-center">
          <span className="text-3xl">🧠</span>
        </div>
        <h2 className="text-[20px] font-semibold text-ios-label">MeCo.AI</h2>
        <p className="text-[15px] text-ios-gray-1 max-w-xs leading-relaxed">
          Your personal memory companion. Text, images, and voice notes — stored privately on your device.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 overscroll-y-contain">
      {messages.map((message) => {
        const isUser = message.role === "user";
        return (
          <div
            key={message.id}
            className={cn("flex flex-col gap-[3px]", isUser ? "items-end" : "items-start")}
          >
            <div
              className={cn(
                "max-w-[80%] px-[14px] py-[9px]",
                isUser
                  ? "bg-bubble-user text-white rounded-[20px] rounded-br-[5px]"
                  : "bg-bubble-asst text-ios-label rounded-[20px] rounded-bl-[5px]",
              )}
            >
              <p className="text-[17px] leading-[1.4] whitespace-pre-wrap m-0">
                {message.text_content || (message.modality === "voice" ? "🎙 Voice note" : "🖼 Image note")}
              </p>
              {message.media_path_or_blob_ref ? (
                <span
                  className={cn(
                    "inline-block mt-[5px] px-2 py-[2px] rounded-full text-[12px]",
                    isUser ? "bg-white/20 text-white" : "bg-ios-fill text-ios-gray-1",
                  )}
                >
                  {message.modality} attached
                </span>
              ) : null}
            </div>
            <time
              className={cn(
                "text-[11px] text-ios-gray-1 px-1",
                isUser ? "text-right" : "text-left",
              )}
            >
              {formatTimestamp(message.created_at)}
            </time>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
