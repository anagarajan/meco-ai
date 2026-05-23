import { useState } from "react";
import { BrainCircuit, ShieldCheck, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface WelcomeScreenProps {
  onDismiss: () => void;
}

const SLIDES = [
  {
    icon: BrainCircuit,
    iconBg: "bg-ios-purple/10",
    iconColor: "text-ios-purple",
    title: "Your second brain,\nprivately stored.",
    body: "Save anything — notes, ideas, reminders. Ask questions later. Everything lives only on your device.",
  },
  {
    icon: ShieldCheck,
    iconBg: "bg-[#34C759]/10",
    iconColor: "text-[#34C759]",
    title: "No account.\nNo cloud. Just you.",
    body: "Your memories never leave this device. You own your API key — we never see it.",
  },
];

export function WelcomeScreen({ onDismiss }: WelcomeScreenProps) {
  const [slide, setSlide] = useState(0);
  const current = SLIDES[slide];
  const isLast = slide === SLIDES.length - 1;
  const Icon = current.icon;

  return (
    <div
      className="h-screen flex flex-col items-center bg-ios-bg font-sans"
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex-1" />

      <div className="flex flex-col items-center text-center gap-7 px-8 max-w-sm">
        <div className={cn("w-24 h-24 rounded-[28px] flex items-center justify-center shadow-sm", current.iconBg)}>
          <Icon size={44} className={current.iconColor} />
        </div>
        <div className="space-y-3">
          <h1 className="text-[30px] font-bold text-ios-label leading-tight whitespace-pre-line">
            {current.title}
          </h1>
          <p className="text-[16px] text-ios-gray-1 leading-relaxed">
            {current.body}
          </p>
        </div>
      </div>

      <div className="flex-1" />

      <div className="w-full max-w-sm px-6 pb-10 space-y-5">
        {/* Progress dots */}
        <div className="flex justify-center gap-2">
          {SLIDES.map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                i === slide ? "w-6 bg-ios-purple" : "w-1.5 bg-ios-gray-4",
              )}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => (isLast ? onDismiss() : setSlide((s) => s + 1))}
          className="w-full rounded-[16px] text-[17px] font-semibold text-white bg-ios-purple border-0 flex items-center justify-center gap-2 hover:bg-ios-purple-dk transition-colors active:scale-[0.98]"
          style={{ height: "52px" }}
        >
          {isLast ? "Get started" : <><span>Next</span><ChevronRight size={18} /></>}
        </button>
      </div>
    </div>
  );
}
