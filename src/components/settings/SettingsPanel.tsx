import { useState, useEffect, useRef } from "react";
import {
  ChevronRight, CheckCircle, XCircle, WifiOff, Loader2, X, ClipboardCheck,
  ShieldCheck, Download, Upload, Trash2, Cloud, CloudOff, TriangleAlert,
  HardDrive, ShieldAlert, FileText,
} from "lucide-react";
import type { AppSettings } from "../../types/domain";
import { updatePasscode, downloadExport, importFromFile, wipeDeviceData, getStorageEstimate, type StorageEstimate } from "../../services/privacy/privacyService";
import { reindexAllMemories } from "../../services/storage/migrationService";
import { validateOpenAIKey, validateAnthropicKey, validateGroqKey, type KeyValidationStatus } from "../../services/ai/keyValidator";
import { useClipboardKeyDetector } from "../../hooks/useClipboardKeyDetector";
import { GetApiKeyButton } from "./GetApiKeyButton";
import { cn } from "@/lib/utils";

interface SettingsPanelProps {
  settings: AppSettings;
  onChange: (settings: AppSettings) => Promise<void>;
  onAfterWipe?: () => Promise<void>;
}

const isNativeApp = typeof window !== "undefined" && !!(window as unknown as Record<string, unknown>).Capacitor;

const dataStorageBullets = isNativeApp
  ? [
      "All data is stored locally on your device within the app's private container.",
      "Cloud inference is optional and only active when you enable it and provide an API key.",
      "API keys are stored in the app's local storage and are never sent to third parties other than the respective AI provider.",
    ]
  : [
      "Text, memories, embeddings, images, and voice blobs are stored on-device in IndexedDB.",
      "Cloud inference is optional and only active when you enable it and provide an API key.",
      "Secrets in browser state are vulnerable if your device or browser profile is compromised.",
    ];

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
    groq: [
      { label: "Local embed", color: "bg-ios-green/10 text-ios-green" },
      { label: "Extraction", color: "bg-ios-blue/10 text-ios-blue" },
      { label: "Reasoning", color: "bg-ios-purple/10 text-ios-purple" },
      { label: "Transcription", color: "bg-ios-red/10 text-ios-red" },
      { label: "No vision", color: "bg-ios-gray-5 text-ios-gray-1" },
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
      {provider === "groq" && (
        <p className="w-full text-[11px] text-ios-gray-1 mt-1">
          Free tier · no credit card required · 14,400 req/day. Images are not supported — use OpenAI or Anthropic for image memories.
        </p>
      )}
    </div>
  );
}

export function SettingsPanel({ settings, onChange, onAfterWipe }: SettingsPanelProps) {
  const [passcode, setPasscode] = useState("");
  const [savedPasscode, setSavedPasscode] = useState(false);
  const [reindexState, setReindexState] = useState<"idle" | "running" | "done">("idle");

  const [openaiStatus, setOpenaiStatus] = useState<KeyValidationStatus>("idle");
  const [openaiMessage, setOpenaiMessage] = useState("");
  const [anthropicStatus, setAnthropicStatus] = useState<KeyValidationStatus>("idle");
  const [anthropicMessage, setAnthropicMessage] = useState("");
  const [groqStatus, setGroqStatus] = useState<KeyValidationStatus>("idle");
  const [groqMessage, setGroqMessage] = useState("");

  const [storageEst, setStorageEst] = useState<StorageEstimate | null>(null);
  const [importState, setImportState] = useState<"idle" | "importing" | "done" | "error">("idle");
  const [importMsg, setImportMsg] = useState("");
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { detectedKey, detectedProvider, dismiss: dismissClipboard } = useClipboardKeyDetector(settings);

  useEffect(() => {
    getStorageEstimate().then(setStorageEst).catch(() => undefined);
  }, []);

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

  async function testGroqKey() {
    setGroqStatus("testing");
    const result = await validateGroqKey(settings.groq_api_key ?? "");
    setGroqStatus(result.status);
    setGroqMessage(result.message);
  }

  async function fillDetectedKey() {
    if (!detectedKey || !detectedProvider) return;
    const keyField = detectedProvider === "openai" ? "openai_api_key"
      : detectedProvider === "anthropic" ? "anthropic_api_key"
      : "groq_api_key";
    await onChange({ ...settings, [keyField]: detectedKey });
    dismissClipboard();
    if (detectedProvider === "openai") {
      setOpenaiStatus("testing");
      const result = await validateOpenAIKey(detectedKey);
      setOpenaiStatus(result.status);
      setOpenaiMessage(result.message);
    } else if (detectedProvider === "anthropic") {
      setAnthropicStatus("testing");
      const result = await validateAnthropicKey(detectedKey);
      setAnthropicStatus(result.status);
      setAnthropicMessage(result.message);
    } else {
      setGroqStatus("testing");
      const result = await validateGroqKey(detectedKey);
      setGroqStatus(result.status);
      setGroqMessage(result.message);
    }
  }

  async function handleImport(file: File) {
    setImportState("importing");
    try {
      const { imported, skipped } = await importFromFile(file);
      setImportMsg(`Imported ${imported} items.${skipped > 0 ? ` ${skipped} already existed and were skipped.` : ""}`);
      setImportState("done");
      await onAfterWipe?.();
    } catch (err) {
      setImportMsg(err instanceof Error ? err.message : "Import failed.");
      setImportState("error");
    }
  }

  return (
    <div className="px-4 py-4 pb-10">
      <h2 className="text-[28px] font-bold text-ios-label mb-4 px-1">Settings</h2>

      {/* Clipboard key detection banner */}
      {detectedKey && detectedProvider && (
        <div className="flex items-center gap-3 bg-ios-blue/8 border border-ios-blue/20 rounded-ios-xl px-4 py-3 mb-4">
          <ClipboardCheck size={18} className="text-ios-blue shrink-0 mt-0.5" />
          <p className="text-[14px] text-ios-blue leading-snug flex-1">
            <span className="font-semibold capitalize">{detectedProvider}</span> key detected in clipboard
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => void fillDetectedKey()}
              className="px-3 h-7 rounded-[8px] bg-ios-blue text-white text-[13px] font-semibold border-0"
            >
              Fill
            </button>
            <button
              type="button"
              onClick={dismissClipboard}
              className="w-6 h-6 flex items-center justify-center rounded-full text-ios-blue hover:bg-ios-blue/10 border-0"
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Privacy notice */}
      <div className="flex gap-3 bg-ios-green/8 border border-ios-green/20 rounded-ios-xl px-4 py-3 mb-6">
        <span className="text-ios-green text-[18px] leading-none mt-0.5">🔒</span>
        <p className="text-[13px] text-ios-green leading-relaxed">
          {isNativeApp
            ? "API keys are stored in the app's private container on your device — they never leave your device or touch our servers."
            : "API keys are stored only in your browser's local storage — they never leave your device or touch our servers."}
        </p>
      </div>

      {/* ── AI Provider ───────────────────────────────────────────── */}
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
            <option value="groq">Groq (free tier)</option>
          </select>
        </SettingsRow>
        <ProviderCapabilities provider={settings.default_ai_provider} />
      </SettingsGroup>

      {/* ── OpenAI ───────────────────────────────────────────────── */}
      <SectionHeader title="OpenAI" />
      <SettingsGroup>
        <div className="px-4 py-3 space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[15px] text-ios-label">API Key</p>
              <GetApiKeyButton provider="openai" />
            </div>
            <input
              type="password"
              value={settings.openai_api_key ?? ""}
              onChange={(e) => { setOpenaiStatus("idle"); void onChange({ ...settings, openai_api_key: e.target.value }); }}
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

      {/* ── Anthropic ────────────────────────────────────────────── */}
      {settings.default_ai_provider === "anthropic" && <SectionHeader title="Anthropic (Claude)" />}
      {settings.default_ai_provider === "anthropic" && (
        <SettingsGroup>
          <div className="px-4 py-3 space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[15px] text-ios-label">API Key</p>
                <GetApiKeyButton provider="anthropic" />
              </div>
              <input
                type="password"
                value={settings.anthropic_api_key ?? ""}
                onChange={(e) => { setAnthropicStatus("idle"); void onChange({ ...settings, anthropic_api_key: e.target.value }); }}
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
      )}

      {/* ── Groq ─────────────────────────────────────────────────── */}
      {settings.default_ai_provider === "groq" && <SectionHeader title="Groq" />}
      {settings.default_ai_provider === "groq" && (
        <SettingsGroup>
          <div className="px-4 py-3 space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[15px] text-ios-label">API Key</p>
                <GetApiKeyButton provider="groq" />
              </div>
              <input
                type="password"
                value={settings.groq_api_key ?? ""}
                onChange={(e) => { setGroqStatus("idle"); void onChange({ ...settings, groq_api_key: e.target.value }); }}
                placeholder="gsk_… stored locally"
                className={inputClass}
              />
              <KeyStatusBadge status={groqStatus} message={groqMessage} />
            </div>
            <button
              type="button"
              disabled={groqStatus === "testing" || !settings.groq_api_key}
              onClick={() => void testGroqKey()}
              className={cn(
                "w-full h-9 rounded-ios-sm text-[14px] font-medium border-0 transition-colors",
                groqStatus === "testing" || !settings.groq_api_key
                  ? "bg-ios-gray-5 text-ios-gray-2 cursor-not-allowed"
                  : "bg-ios-purple/10 text-ios-purple hover:bg-ios-purple/20",
              )}
            >
              {groqStatus === "testing" ? "Testing…" : "Test key"}
            </button>
            <div>
              <p className="text-[15px] text-ios-label mb-1.5">Model</p>
              <select
                value={settings.groq_model ?? "llama-3.3-70b-versatile"}
                onChange={(e) => void onChange({ ...settings, groq_model: e.target.value })}
                className={cn(selectClass, "w-full")}
              >
                <option value="llama-3.3-70b-versatile">Llama 3.3 70B (default)</option>
                <option value="llama-3.1-8b-instant">Llama 3.1 8B (fastest)</option>
                <option value="gemma2-9b-it">Gemma 2 9B</option>
              </select>
            </div>
            <p className="text-[12px] text-ios-gray-1 leading-relaxed">
              Get a free key at console.groq.com — no credit card required. Free tier includes 14,400 requests/day, sufficient for personal use.
            </p>
          </div>
        </SettingsGroup>
      )}

      {/* ── Privacy & Data ───────────────────────────────────────── */}
      <SectionHeader title="Privacy & Data" />

      {/* Local-first status */}
      <div className="rounded-ios-xl bg-ios-surface border border-ios-sep p-4 mb-3 flex items-start gap-3">
        <div className="w-10 h-10 rounded-[10px] bg-ios-purple/10 flex items-center justify-center shrink-0 mt-[1px]">
          <ShieldCheck size={20} className="text-ios-purple" />
        </div>
        <div>
          <p className="text-[17px] font-semibold text-ios-label">Local-first storage</p>
          <p className="text-[15px] text-ios-gray-1 mt-[2px] leading-snug">
            No analytics, hidden sync, or backend required for the core app.
          </p>
        </div>
      </div>

      {/* Data storage bullets */}
      <div className="rounded-ios-xl overflow-hidden border border-ios-sep bg-ios-surface divide-y divide-ios-sep mb-3">
        {dataStorageBullets.map((item, i) => (
          <div key={i} className="flex items-start gap-3 px-4 py-3">
            <span className="w-[6px] h-[6px] rounded-full bg-ios-gray-3 mt-[7px] shrink-0" />
            <p className="text-[15px] text-ios-label leading-snug">{item}</p>
          </div>
        ))}
      </div>

      {/* Cloud inference status */}
      <div className="rounded-ios-xl overflow-hidden border border-ios-sep bg-ios-surface mb-3">
        <div className="flex items-center gap-3 px-4 py-3">
          {settings.cloud_inference_enabled
            ? <Cloud size={18} className="text-ios-blue shrink-0" />
            : <CloudOff size={18} className="text-ios-gray-2 shrink-0" />}
          <p className="text-[17px] text-ios-label flex-1">Cloud inference</p>
          <span className={cn("text-[15px] font-medium", settings.cloud_inference_enabled ? "text-ios-blue" : "text-ios-gray-1")}>
            {settings.cloud_inference_enabled ? "On" : "Off"}
          </span>
        </div>
      </div>

      {/* Raw media retention */}
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

      {/* Storage warnings */}
      <SectionHeader title="Storage Warnings" />
      <div className="rounded-ios-xl overflow-hidden border border-[#FF9500]/30 bg-[#FF9500]/5 divide-y divide-[#FF9500]/20 mb-3">
        <div className="flex items-start gap-3 px-4 py-3">
          <TriangleAlert size={17} className="text-[#FF9500] shrink-0 mt-[2px]" />
          <div>
            <p className="text-[15px] font-semibold text-ios-label leading-snug mb-1">
              {isNativeApp ? "Uninstalling the app deletes all data" : "Removing the app deletes all data"}
            </p>
            <p className="text-[13px] text-ios-gray-1 leading-relaxed">
              {isNativeApp
                ? "Uninstalling MeCo AI permanently erases all memories, chat history, and settings. There is no recovery. Export your data first."
                : "Deleting MeCo.AI from your home screen permanently erases all memories, chat history, and settings from this device. There is no recovery. Export your data first."}
            </p>
          </div>
        </div>
        {!isNativeApp && (
          <div className="flex items-start gap-3 px-4 py-3">
            <TriangleAlert size={17} className="text-[#FF9500] shrink-0 mt-[2px]" />
            <div>
              <p className="text-[15px] font-semibold text-ios-label leading-snug mb-1">
                Clearing browser storage wipes everything
              </p>
              <p className="text-[13px] text-ios-gray-1 leading-relaxed">
                Using "Clear history", "Clear website data", or resetting your browser will delete all stored memories. This includes Safari's Settings → Safari → Clear History and Website Data.
              </p>
            </div>
          </div>
        )}
        <div className="flex items-start gap-3 px-4 py-3">
          <TriangleAlert size={17} className="text-[#FF9500] shrink-0 mt-[2px]" />
          <div>
            <p className="text-[15px] font-semibold text-ios-label leading-snug mb-1">No cloud backup</p>
            <p className="text-[13px] text-ios-gray-1 leading-relaxed">
              Data exists only on this device. It is not synced across devices or backed up automatically. Use Export to save a local copy before switching devices or reinstalling.
            </p>
          </div>
        </div>
      </div>

      {/* Storage estimate */}
      {storageEst && (
        <>
          <SectionHeader title="Storage" />
          <SettingsGroup>
            <div className="flex items-center gap-3 px-4 py-3">
              <HardDrive size={18} className="text-ios-gray-1 shrink-0" />
              <p className="text-[17px] text-ios-label flex-1">Used</p>
              <span className="text-[15px] text-ios-gray-1">{storageEst.usedMB} MB of {storageEst.quotaMB} MB ({storageEst.percentUsed}%)</span>
            </div>
            <div className="flex items-center gap-3 px-4 py-3">
              {(storageEst.persisted || isNativeApp)
                ? <ShieldCheck size={18} className="text-ios-green shrink-0" />
                : <ShieldAlert size={18} className="text-[#FF9500] shrink-0" />}
              <div className="flex-1">
                <p className="text-[17px] text-ios-label">Persistent storage</p>
                {!storageEst.persisted && !isNativeApp && (
                  <p className="text-[12px] text-[#FF9500] leading-snug mt-[2px]">
                    Not granted — data may be evicted by the browser. Install as a PWA to protect it.
                  </p>
                )}
                {isNativeApp && (
                  <p className="text-[12px] text-ios-green leading-snug mt-[2px]">
                    App storage is managed by iOS and protected from eviction.
                  </p>
                )}
              </div>
              <span className={cn("text-[15px] font-medium", (storageEst.persisted || isNativeApp) ? "text-ios-green" : "text-[#FF9500]")}>
                {(storageEst.persisted || isNativeApp) ? "Yes" : "No"}
              </span>
            </div>
          </SettingsGroup>
        </>
      )}

      {/* ── Data Actions ─────────────────────────────────────────── */}
      <SectionHeader title="Data Actions" />
      <SettingsGroup>
        <button
          type="button"
          onClick={() => void downloadExport()}
          className="w-full flex items-center gap-3 px-4 py-3 text-left bg-transparent border-0 hover:bg-ios-gray-6/50 transition-colors"
        >
          <Download size={18} className="text-ios-purple shrink-0" />
          <span className="text-[17px] text-ios-purple flex-1">Export local data</span>
        </button>
        <button
          type="button"
          disabled={importState === "importing"}
          onClick={() => fileInputRef.current?.click()}
          className="w-full flex items-center gap-3 px-4 py-3 text-left bg-transparent border-0 hover:bg-ios-gray-6/50 transition-colors"
        >
          <Upload size={18} className="text-ios-blue shrink-0" />
          <div className="flex-1">
            <span className="text-[17px] text-ios-blue block">
              {importState === "importing" ? "Importing…" : "Import from backup"}
            </span>
            {(importState === "done" || importState === "error") && (
              <span className={cn("text-[13px] leading-snug", importState === "done" ? "text-ios-green" : "text-ios-red")}>
                {importMsg}
              </span>
            )}
          </div>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleImport(file);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={async () => {
            if (!window.confirm("Wipe all local data? This cannot be undone.")) return;
            await wipeDeviceData();
            await onAfterWipe?.();
          }}
          className="w-full flex items-center gap-3 px-4 py-3 text-left bg-transparent border-0 hover:bg-ios-red/5 transition-colors"
        >
          <Trash2 size={18} className="text-ios-red shrink-0" />
          <span className="text-[17px] text-ios-red flex-1">Wipe this device</span>
        </button>
      </SettingsGroup>

      {/* ── App Lock ─────────────────────────────────────────────── */}
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

      {/* ── Diagnostics ──────────────────────────────────────────── */}
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

      {/* ── Legal ────────────────────────────────────────────────── */}
      <SectionHeader title="Legal" />
      <SettingsGroup>
        <button
          type="button"
          onClick={() => setShowPrivacyPolicy(true)}
          className="w-full flex items-center gap-3 px-4 py-3 text-left bg-transparent border-0 hover:bg-ios-gray-6/50 transition-colors"
        >
          <FileText size={18} className="text-ios-purple shrink-0" />
          <span className="text-[17px] text-ios-purple flex-1">Privacy Policy</span>
        </button>
      </SettingsGroup>

      {/* ── About ────────────────────────────────────────────────── */}
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

      {/* Privacy Policy modal */}
      {showPrivacyPolicy && (
        <div className="fixed inset-0 z-50 bg-ios-bg flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-ios-sep bg-ios-surface">
            <span className="text-[17px] font-semibold text-ios-label">Privacy Policy</span>
            <button
              type="button"
              onClick={() => setShowPrivacyPolicy(false)}
              className="text-[17px] text-ios-purple font-medium bg-transparent border-0"
            >
              Done
            </button>
          </div>
          <iframe
            src="/privacy-policy.html"
            title="Privacy Policy"
            className="flex-1 w-full border-0"
          />
        </div>
      )}
    </div>
  );
}
