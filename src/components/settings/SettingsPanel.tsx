import { useState } from "react";
import { ChevronRight, CheckCircle, XCircle, WifiOff, Loader2 } from "lucide-react";
import type { AppSettings } from "../../types/domain";
import { updatePasscode } from "../../services/privacy/privacyService";
import { reindexAllMemories } from "../../services/storage/migrationService";
import { validateOpenAIKey, validateAnthropicKey, type KeyValidationStatus } from "../../services/ai/keyValidator";
import { cn } from "@/lib/utils";

interface SettingsPanelProps {
  settings: AppSettings;
  onChange: (settings: AppSettings) => Promise<void>;
}

function SectionHeader({ title }: { title: string }) {
  return (
    <p className="text-[13px] font-semibold text-ios-gray-1 uppercase tracking-wide px-1 mb-2 mt-6 first:mt-0">
      {title}
    </p>
  );
}

function SettingsGroup({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-ios-xl overflow-hidden border border-ios-sep bg-ios-surface divide-y divide-ios-sep">
      {children}
    </div>
  );
}

function SettingsRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-[11px] min-h-[44px]">
      <div className="min-w-0">
        <p className="text-[17px] text-ios-label leading-snug">{label}</p>
        {hint && <p className="text-[13px] text-ios-gray-1 leading-snug">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

const selectClass = cn(
  "h-8 px-2 rounded-ios-sm border border-ios-sep bg-ios-surface",
  "text-[15px] text-ios-label appearance-none",
  "focus:outline-none focus:border-ios-purple/50",
);

const inputClass = cn(
  "h-10 px-3 rounded-ios-sm border border-ios-sep bg-ios-surface w-full",
  "text-[15px] text-ios-label placeholder:text-ios-gray-3",
  "focus:outline-none focus:border-ios-purple/50",
  "transition-colors",
);

function KeyStatusBadge({ status, message }: { status: KeyValidationStatus; message?: string }) {
  if (status === "idle") return null;
  if (status === "testing") {
    return (
      <div className="flex items-center gap-1.5 text-ios-gray-1 text-[13px] mt-2">
        <Loader2 size={13} className="animate-spin" />
        <span>Testing key…</span>
      </div>
    );
  }
  const configs = {
    valid:         { icon: CheckCircle, color: "text-ios-green",  bg: "bg-ios-green/8  border-ios-green/20"  },
    invalid:       { icon: XCircle,     color: "text-ios-red",    bg: "bg-ios-red/8    border-ios-red/20"    },
    network_error: { icon: WifiOff,     color: "text-[#FF9500]",  bg: "bg-[#FF9500]/8  border-[#FF9500]/20"  },
  };
  const { icon: Icon, color, bg } = configs[status];
  return (
    <div className={cn("flex items-center gap-2 px-3 py-2 rounded-ios-sm border mt-2", bg)}>
      <Icon size={14} className={cn("shrink-0", color)} />
      <span className={cn("text-[13px] leading-snug", color)}>{message}</span>
    </div>
  );
}

// Badge showing which capabilities each provider covers
function ProviderCapabilities({ provider }: { provider: AppSettings["default_ai_provider"] }) {
  const caps: Record<string, { label: string; color: string }[]> = {
    openai: [
      { label: "Embedding", color: "bg-ios-green/10 text-ios-green" },
      { label: "Extraction", color: "bg-ios-blue/10 text-ios-blue" },
      { label: "Reasoning", color: "bg-ios-purple/10 text-ios-purple" },
      { label: "Vision", color: "bg-[#FF9500]/10 text-[#FF9500]" },
      { label: "Transcription", color: "bg-ios-red/10 text-ios-red" },
    ],
    anthropic: [
      { label: "Local embed", color: "bg-ios-green/10 text-ios-green" },
      { label: "Extraction", color: "bg-ios-blue/10 text-ios-blue" },
      { label: "Reasoning", color: "bg-ios-purple/10 text-ios-purple" },
      { label: "Vision", color: "bg-[#FF9500]/10 text-[#FF9500]" },
      { label: "Transcription*", color: "bg-ios-gray-5 text-ios-gray-1" },
    ],
  };

  return (
    <div className="px-4 pb-3 flex flex-wrap gap-1.5">
      {caps[provider]?.map((c) => (
        <span key={c.label} className={cn("px-2 py-[3px] rounded-[6px] text-[11px] font-semibold", c.color)}>
          {c.label}
        </span>
      ))}
      {provider === "anthropic" && (
        <p className="w-full text-[11px] text-ios-gray-1 mt-1">
          * Transcription uses OpenAI Whisper if an OpenAI key is also provided, otherwise browser speech.
        </p>
      )}
    </div>
  );
}

export function SettingsPanel({ settings, onChange }: SettingsPanelProps) {
  const [passcode, setPasscode] = useState("");
  const [savedPasscode, setSavedPasscode] = useState(false);
  const [reindexState, setReindexState] = useState<"idle" | "running" | "done">("idle");

  const [openaiStatus, setOpenaiStatus] = useState<KeyValidationStatus>("idle");
  const [openaiMessage, setOpenaiMessage] = useState("");
  const [anthropicStatus, setAnthropicStatus] = useState<KeyValidationStatus>("idle");
  const [anthropicMessage, setAnthropicMessage] = useState("");

  async function testOpenAIKey() {
    setOpenaiStatus("testing");
    const result = await validateOpenAIKey(settings.openai_api_key ?? "");
    setOpenaiStatus(result.status);
    setOpenaiMessage(result.message);
  }

  async function testAnthropicKey() {
    setAnthropicStatus("testing");
    const result = await validateAnthropicKey(settings.anthropic_api_key ?? "");
    setAnthropicStatus(result.status);
    setAnthropicMessage(result.message);
  }

  return (
    <div className="px-4 py-4 pb-10">
      <h2 className="text-[28px] font-bold text-ios-label mb-4 px-1">Settings</h2>

      {/* Privacy notice */}
      <div className="flex gap-3 bg-ios-green/8 border border-ios-green/20 rounded-ios-xl px-4 py-3 mb-6">
        <span className="text-ios-green text-[18px] leading-none mt-0.5">🔒</span>
        <p className="text-[13px] text-ios-green leading-relaxed">
          API keys are stored only in your browser's local storage — they never leave your device or touch our servers.
        </p>
      </div>

      {/* AI Behaviour */}
      <SectionHeader title="AI Behaviour" />
      <SettingsGroup>
        <SettingsRow label="Autosave mode" hint="Explicit only saves when you say &quot;remember that…&quot;">
          <select
            value={settings.autosave_mode}
            onChange={(e) =>
              void onChange({ ...settings, autosave_mode: e.target.value as AppSettings["autosave_mode"] })
            }
            className={selectClass}
          >
            <option value="explicit">Explicit only</option>
            <option value="assisted">Assisted</option>
          </select>
        </SettingsRow>
        <SettingsRow label="Provider">
          <select
            value={settings.default_ai_provider}
            onChange={(e) =>
              void onChange({ ...settings, default_ai_provider: e.target.value as AppSettings["default_ai_provider"] })
            }
            className={selectClass}
          >
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic (Claude)</option>
          </select>
        </SettingsRow>
        <ProviderCapabilities provider={settings.default_ai_provider} />
      </SettingsGroup>

      {/* OpenAI */}
      <SectionHeader title="OpenAI" />
      <SettingsGroup>
        <div className="px-4 py-3 space-y-3">
          <div>
            <p className="text-[15px] text-ios-label mb-1.5">API Key</p>
            <input
              type="password"
              value={settings.openai_api_key ?? ""}
              onChange={(e) => {
                setOpenaiStatus("idle");
                void onChange({ ...settings, openai_api_key: e.target.value });
              }}
              placeholder="sk-… stored locally"
              className={inputClass}
            />
            <KeyStatusBadge status={openaiStatus} message={openaiMessage} />
          </div>
          <button
            type="button"
            disabled={openaiStatus === "testing" || !settings.openai_api_key}
            onClick={() => void testOpenAIKey()}
            className={cn(
              "w-full h-9 rounded-ios-sm text-[14px] font-medium border-0 transition-colors",
              openaiStatus === "testing" || !settings.openai_api_key
                ? "bg-ios-gray-5 text-ios-gray-2 cursor-not-allowed"
                : "bg-ios-purple/10 text-ios-purple hover:bg-ios-purple/20",
            )}
          >
            {openaiStatus === "testing" ? "Testing…" : "Test key"}
          </button>
          <div>
            <p className="text-[15px] text-ios-label mb-1.5">Model</p>
            <select
              value={settings.openai_model ?? "gpt-4.1-mini"}
              onChange={(e) => void onChange({ ...settings, openai_model: e.target.value })}
              className={cn(selectClass, "w-full")}
            >
              <option value="gpt-4.1-nano">GPT-4.1 Nano (fastest)</option>
              <option value="gpt-4.1-mini">GPT-4.1 Mini (default)</option>
              <option value="gpt-4.1">GPT-4.1 (best)</option>
              <option value="gpt-4o">GPT-4o</option>
              <option value="gpt-4o-mini">GPT-4o Mini</option>
            </select>
          </div>
        </div>
      </SettingsGroup>

      {/* Anthropic */}
      <SectionHeader title="Anthropic (Claude)" />
      <SettingsGroup>
        <div className="px-4 py-3 space-y-3">
          <div>
            <p className="text-[15px] text-ios-label mb-1.5">API Key</p>
            <input
              type="password"
              value={settings.anthropic_api_key ?? ""}
              onChange={(e) => {
                setAnthropicStatus("idle");
                void onChange({ ...settings, anthropic_api_key: e.target.value });
              }}
              placeholder="sk-ant-… stored locally"
              className={inputClass}
            />
            <KeyStatusBadge status={anthropicStatus} message={anthropicMessage} />
          </div>
          <button
            type="button"
            disabled={anthropicStatus === "testing" || !settings.anthropic_api_key}
            onClick={() => void testAnthropicKey()}
            className={cn(
              "w-full h-9 rounded-ios-sm text-[14px] font-medium border-0 transition-colors",
              anthropicStatus === "testing" || !settings.anthropic_api_key
                ? "bg-ios-gray-5 text-ios-gray-2 cursor-not-allowed"
                : "bg-ios-purple/10 text-ios-purple hover:bg-ios-purple/20",
            )}
          >
            {anthropicStatus === "testing" ? "Testing…" : "Test key"}
          </button>
          <div>
            <p className="text-[15px] text-ios-label mb-1.5">Model</p>
            <select
              value={settings.anthropic_model ?? "claude-haiku-4-5-20251001"}
              onChange={(e) => void onChange({ ...settings, anthropic_model: e.target.value })}
              className={cn(selectClass, "w-full")}
            >
              <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5 (fastest)</option>
              <option value="claude-sonnet-4-5">Claude Sonnet 4.5</option>
              <option value="claude-sonnet-4-6">Claude Sonnet 4.6 (best)</option>
              <option value="claude-opus-4-6">Claude Opus 4.6 (most capable)</option>
            </select>
          </div>
          <p className="text-[12px] text-ios-gray-1 leading-relaxed">
            Claude handles reasoning, memory extraction, and image understanding. Embeddings use a local n-gram engine (no API call needed). Audio transcription uses OpenAI Whisper if an OpenAI key is also configured.
          </p>
        </div>
      </SettingsGroup>

      {/* Privacy */}
      <SectionHeader title="Privacy" />
      <SettingsGroup>
        <div className="px-4 py-3">
          <p className="text-[15px] text-ios-label mb-2">Raw media retention (days)</p>
          <input
            min={1}
            step={1}
            type="number"
            value={settings.auto_delete_raw_media_days}
            onChange={(e) => void onChange({ ...settings, auto_delete_raw_media_days: Number(e.target.value) })}
            className={inputClass}
          />
        </div>
      </SettingsGroup>

      {/* App Lock */}
      <SectionHeader title="App Lock" />
      <SettingsGroup>
        <div className="px-4 py-3 space-y-2">
          <p className="text-[15px] text-ios-label">Passcode</p>
          <input
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            type="password"
            placeholder="4+ digits"
            className={inputClass}
          />
          <button
            type="button"
            onClick={async () => {
              const updated = await updatePasscode(settings, passcode);
              await onChange(updated);
              setPasscode("");
              setSavedPasscode(true);
              setTimeout(() => setSavedPasscode(false), 2000);
            }}
            className={cn(
              "w-full h-11 rounded-ios-sm text-[17px] font-semibold transition-colors border-0",
              savedPasscode
                ? "bg-ios-green/10 text-ios-green"
                : "bg-ios-purple text-white hover:bg-ios-purple-dk",
            )}
          >
            {savedPasscode ? "Saved ✓" : "Save Passcode"}
          </button>
        </div>
      </SettingsGroup>

      {/* Diagnostics */}
      <SectionHeader title="Diagnostics" />
      <SettingsGroup>
        <div className="px-4 py-3 space-y-1">
          <p className="text-[15px] text-ios-label">Re-index memories</p>
          <p className="text-[13px] text-ios-gray-1 leading-snug">
            Rebuilds all embeddings with the current provider. Run this after switching providers.
          </p>
          <button
            type="button"
            disabled={reindexState !== "idle"}
            onClick={async () => {
              setReindexState("running");
              await reindexAllMemories(settings);
              setReindexState("done");
              setTimeout(() => setReindexState("idle"), 3000);
            }}
            className={cn(
              "mt-2 h-10 w-full rounded-ios-sm text-[15px] font-medium border-0 transition-colors",
              reindexState === "idle"    && "bg-ios-purple/10 text-ios-purple hover:bg-ios-purple/20",
              reindexState === "running" && "bg-ios-gray-5 text-ios-gray-1",
              reindexState === "done"    && "bg-ios-green/10 text-ios-green",
            )}
          >
            {reindexState === "idle"    ? "Re-index now" :
             reindexState === "running" ? "Re-indexing…" : "Done ✓"}
          </button>
        </div>
      </SettingsGroup>

      {/* About */}
      <SectionHeader title="About" />
      <SettingsGroup>
        <div className="flex items-center justify-between px-4 py-3">
          <p className="text-[17px] text-ios-label">MeCo.AI</p>
          <div className="flex items-center gap-1 text-ios-gray-1">
            <span className="text-[15px]">Local-first PWA</span>
            <ChevronRight size={14} />
          </div>
        </div>
      </SettingsGroup>
    </div>
  );
}
