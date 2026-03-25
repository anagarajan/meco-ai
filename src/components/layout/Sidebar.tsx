import { useState } from "react";
import { BrainCircuit, BookMarked, ShieldCheck, Settings, Moon, Sun, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActivePanel } from "../../types/domain";

interface NavItem {
  id: ActivePanel;
  label: string;
  icon: typeof BrainCircuit;
}

const NAV_ITEMS: NavItem[] = [
  { id: "chat",     label: "Chat",     icon: BrainCircuit },
  { id: "memories", label: "Memories", icon: BookMarked },
  { id: "privacy",  label: "Privacy",  icon: ShieldCheck },
  { id: "settings", label: "Settings", icon: Settings },
];

interface SidebarProps {
  active: ActivePanel;
  onChange: (panel: ActivePanel) => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
}

export function Sidebar({ active, onChange, theme, onToggleTheme }: SidebarProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <aside
      className={cn(
        "flex flex-col h-full shrink-0 bg-mac-sidebar border-r border-ios-sep select-none",
        "overflow-hidden transition-[width] duration-200 ease-in-out",
        expanded ? "w-[220px]" : "w-[56px]",
      )}
    >
      {/* Header: hamburger + app name when expanded */}
      <div className="flex items-center gap-2 h-10 px-3 shrink-0">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="w-8 h-8 flex items-center justify-center rounded-ios-sm text-ios-gray-1 hover:bg-ios-fill transition-colors shrink-0"
          aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
        >
          <Menu size={16} />
        </button>
        {expanded && (
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="w-6 h-6 rounded-[6px] bg-ios-purple flex items-center justify-center shrink-0">
              <BrainCircuit size={13} className="text-white" />
            </div>
            <p className="text-[13px] font-semibold text-ios-label whitespace-nowrap overflow-hidden">
              MeCo.AI
            </p>
          </div>
        )}
      </div>

      <div className="h-px bg-ios-sep mx-2 mb-1 shrink-0" />

      {/* Nav items */}
      <nav className="flex-1 px-2 py-1 space-y-[2px] overflow-hidden">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              type="button"
              title={!expanded ? item.label : undefined}
              className={cn(
                "w-full flex items-center gap-2 py-[7px] rounded-ios-sm text-[13px] font-medium border-0 transition-colors",
                expanded ? "px-3 justify-start" : "px-0 justify-center",
                isActive
                  ? "bg-ios-purple text-white"
                  : "text-ios-label hover:bg-mac-sidebar-hover bg-transparent",
              )}
              onClick={() => onChange(item.id)}
            >
              <Icon size={16} strokeWidth={isActive ? 2 : 1.5} className="shrink-0" />
              {expanded && (
                <span className="whitespace-nowrap overflow-hidden">{item.label}</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer: theme toggle */}
      <div
        className={cn(
          "px-3 pb-4 flex items-center shrink-0",
          expanded ? "justify-between" : "justify-center",
        )}
      >
        {expanded && (
          <p className="text-[11px] text-ios-gray-1 leading-snug">Local-first. No backend.</p>
        )}
        <button
          type="button"
          onClick={onToggleTheme}
          className="w-7 h-7 flex items-center justify-center rounded-full text-ios-gray-1 hover:bg-ios-fill transition-colors"
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
        </button>
      </div>
    </aside>
  );
}
