import { Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  "Remember that my WiFi password is [password]",
  "Remember I have a dentist appointment on [date]",
  "Remember that my emergency contact is [name and number]",
];

interface OnboardingOverlayProps {
  onDismiss: () => void;
  onSuggest: (text: string) => void;
}

export function OnboardingOverlay({ onDismiss, onSuggest }: OnboardingOverlayProps) {
  return (
    <div className="absolute inset-0 z-30 flex items-end justify-center pb-6 px-4 pointer-events-none">
      <div
        className={cn(
          "w-full max-w-sm rounded-[24px] bg-ios-surface border border-ios-sep",
          "shadow-[0_8px_32px_rgba(0,0,0,0.12)] pointer-events-auto overflow-hidden",
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-1">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <Sparkles size={13} className="text-ios-purple" />
              <span className="text-[11px] font-semibold text-ios-purple uppercase tracking-wider">Try it now</span>
            </div>
            <h3 className="text-[18px] font-bold text-ios-label">Save your first memory</h3>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className="text-ios-gray-2 hover:text-ios-gray-1 mt-0.5 border-0 bg-transparent"
          >
            <X size={18} />
          </button>
        </div>

        <p className="px-5 pb-3 text-[13px] text-ios-gray-1">Tap an example to fill it in:</p>

        {/* Suggestions */}
        <div className="px-3 pb-5 space-y-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => { onSuggest(s); onDismiss(); }}
              className={cn(
                "w-full text-left px-4 py-3 rounded-[14px] border border-ios-sep",
                "bg-ios-gray-6 hover:bg-ios-gray-5 active:scale-[0.98]",
                "text-[14px] text-ios-label transition-all border-0",
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
