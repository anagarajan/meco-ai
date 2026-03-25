import { useState } from "react";
import { BrainCircuit, MessageSquare, Mic, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    icon: BrainCircuit,
    title: "Remember anything",
    body: 'Switch to Remember mode and type "Remember that my keys are on the kitchen counter." Your memory is saved and searchable instantly.',
    color: "bg-ios-purple/10",
    iconColor: "text-ios-purple",
  },
  {
    icon: MessageSquare,
    title: "Ask questions",
    body: 'Switch to Ask mode and type "Where are my keys?" — the app searches your saved memories and answers using your AI provider.',
    color: "bg-ios-blue/10",
    iconColor: "text-ios-blue",
  },
  {
    icon: Mic,
    title: "Use your voice",
    body: "Tap the mic button to speak instead of typing. Works for both saving memories and asking questions.",
    color: "bg-[#FF9500]/10",
    iconColor: "text-[#FF9500]",
  },
];

interface OnboardingOverlayProps {
  onDismiss: () => void;
}

export function OnboardingOverlay({ onDismiss }: OnboardingOverlayProps) {
  const [step, setStep] = useState(0);
  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];
  const Icon = current.icon;

  return (
    <div className="absolute inset-0 z-30 flex items-end justify-center pb-6 px-4 pointer-events-none">
      <div
        className={cn(
          "w-full max-w-sm rounded-[24px] bg-ios-surface border border-ios-sep",
          "shadow-[0_8px_32px_rgba(0,0,0,0.12)] pointer-events-auto",
          "overflow-hidden",
        )}
      >
        {/* Step indicator */}
        <div className="flex justify-center gap-1.5 pt-4">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === step ? "w-5 bg-ios-purple" : "w-1.5 bg-ios-gray-4",
              )}
            />
          ))}
        </div>

        {/* Content */}
        <div className="px-6 pt-4 pb-2 text-center">
          <div className={cn("w-14 h-14 rounded-[16px] flex items-center justify-center mx-auto mb-3", current.color)}>
            <Icon size={26} className={current.iconColor} />
          </div>
          <h3 className="text-[18px] font-bold text-ios-label mb-2">{current.title}</h3>
          <p className="text-[14px] text-ios-gray-1 leading-relaxed">{current.body}</p>
        </div>

        {/* Actions — no Skip, must complete the tour */}
        <div className="px-6 pb-6 pt-4">
          <button
            type="button"
            onClick={() => isLast ? onDismiss() : setStep((s) => s + 1)}
            className="w-full h-11 rounded-[14px] text-[15px] font-semibold text-white bg-ios-purple border-0 transition-colors hover:bg-ios-purple-dk flex items-center justify-center gap-1"
          >
            {isLast ? "Get started" : <><span>Next</span><ChevronRight size={16} /></>}
          </button>
        </div>
      </div>
    </div>
  );
}
