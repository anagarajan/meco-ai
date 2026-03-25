import { BrainCircuit, BookMarked, ShieldCheck, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActivePanel } from "../../types/domain";

interface Tab {
  id: ActivePanel;
  label: string;
  icon: typeof BrainCircuit;
}

const TABS: Tab[] = [
  { id: "chat",     label: "Chat",     icon: BrainCircuit },
  { id: "memories", label: "Memories", icon: BookMarked },
  { id: "privacy",  label: "Privacy",  icon: ShieldCheck },
  { id: "settings", label: "Settings", icon: Settings },
];

interface TabBarProps {
  active: ActivePanel;
  onChange: (panel: ActivePanel) => void;
}

export function TabBar({ active, onChange }: TabBarProps) {
  return (
    <div
      className={cn(
        "fixed bottom-0 inset-x-0 z-50",
        "flex flex-col",
        "bg-ios-surface/80 backdrop-blur-[20px]",
        "border-t border-ios-sep",
      )}
    >
      <div className="flex h-[49px]">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-[2px] border-0 bg-transparent",
                "transition-colors",
                isActive ? "text-ios-purple" : "text-ios-gray-1",
              )}
              onClick={() => onChange(tab.id)}
            >
              <Icon size={24} strokeWidth={isActive ? 2 : 1.5} />
              <span className="text-[10px] font-medium leading-none">{tab.label}</span>
            </button>
          );
        })}
      </div>
      {/* Home indicator safe area */}
      <div style={{ height: "env(safe-area-inset-bottom)" }} />
    </div>
  );
}
