import { Moon, Sun, Trash2, Key, RefreshCw } from "lucide-react";
import { Composer } from "../components/chat/Composer";
import { Conversation } from "../components/chat/Conversation";
import { LockScreen } from "../components/layout/LockScreen";
import { MemoryLedger } from "../components/memory/MemoryLedger";
import { OnboardingOverlay } from "../components/onboarding/OnboardingOverlay";
import { PrivacyPanel } from "../components/settings/PrivacyPanel";
import { SettingsPanel } from "../components/settings/SettingsPanel";
import { Sidebar } from "../components/layout/Sidebar";
import { TabBar } from "../components/layout/TabBar";
import { useMemoryCompanion } from "../hooks/useMemoryCompanion";
import { useOnboarding } from "../hooks/useOnboarding";
import { useTheme } from "../hooks/useTheme";

export function App() {
  const {
    activePanel,
    busy,
    clearChat,
    editMemory,
    locked,
    memories,
    messages,
    reindex,
    reindexing,
    removeMemory,
    settings,
    setActivePanel,
    submit,
    unlock,
    updateSettings,
    refresh,
  } = useMemoryCompanion();

  const { theme, toggle: toggleTheme } = useTheme();
  const { showOnboarding, dismiss: dismissOnboarding } = useOnboarding(memories.length, messages.length);

  if (!settings) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ios-bg">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-[14px] bg-ios-purple flex items-center justify-center">
            <span className="text-white text-2xl">🧠</span>
          </div>
          <p className="text-ios-gray-1 text-[15px]">Loading…</p>
        </div>
      </div>
    );
  }

  const useCloudTranscription = !!(settings.cloud_inference_enabled && settings.openai_api_key);
  const hasApiKey = !!(settings.openai_api_key || settings.anthropic_api_key);

  // Hard gate — app is unusable without at least one API key.
  // Once in setup mode, render the full settings panel so the user can enter their key.
  if (!hasApiKey) {
    if (activePanel === "settings") {
      return (
        <div className="h-screen flex flex-col overflow-hidden bg-ios-bg font-sans">
          <header className="shrink-0 bg-ios-surface/80 backdrop-blur-[20px] border-b border-ios-sep"
            style={{ paddingTop: "env(safe-area-inset-top)" }}>
            <div className="flex items-center h-11 px-4">
              <div className="w-8" />
              <h1 className="flex-1 text-[17px] font-semibold text-ios-label text-center">Add API Key</h1>
              <div className="w-8" />
            </div>
          </header>
          <div className="flex-1 overflow-y-auto">
            <SettingsPanel settings={settings} onChange={updateSettings} />
          </div>
        </div>
      );
    }
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-ios-bg px-6 gap-6 font-sans">
        <div className="w-16 h-16 rounded-[20px] bg-ios-purple flex items-center justify-center shadow-lg">
          <Key size={28} className="text-white" />
        </div>
        <div className="text-center max-w-xs">
          <h1 className="text-[22px] font-bold text-ios-label mb-2">API key required</h1>
          <p className="text-[15px] text-ios-gray-1 leading-relaxed">
            MeCo.AI requires an OpenAI or Anthropic API key to work. Your key is stored only on this device and never shared.
          </p>
        </div>
        <div className="w-full max-w-xs space-y-3">
          <button
            type="button"
            onClick={() => setActivePanel("settings")}
            className="w-full h-12 rounded-[14px] bg-ios-purple text-white text-[17px] font-semibold border-0 hover:bg-ios-purple-dk transition-colors"
          >
            Add API key
          </button>
          <p className="text-[12px] text-ios-gray-2 text-center leading-relaxed">
            Get a key at platform.openai.com or console.anthropic.com
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ios-bg font-sans">
      {locked ? <LockScreen onUnlock={unlock} /> : null}

      {/* ── Mobile layout (< lg) ────────────────────────────────────── */}
      <div className="h-screen flex flex-col overflow-hidden lg:hidden">
        {/* iOS Navigation Bar */}
        <header
          className="sticky top-0 z-40 bg-ios-surface/80 backdrop-blur-[20px] border-b border-ios-sep"
          style={{ paddingTop: "env(safe-area-inset-top)" }}
        >
          <div className="flex items-center h-11 px-4">
            {activePanel === "chat" && messages.length > 0 ? (
              <button
                type="button"
                onClick={() => void clearChat()}
                className="w-8 h-8 flex items-center justify-center rounded-full text-ios-gray-1 hover:bg-ios-fill transition-colors"
                aria-label="Clear chat"
              >
                <Trash2 size={17} />
              </button>
            ) : (
              <div className="w-8" />
            )}
            <h1 className="flex-1 text-[17px] font-semibold text-ios-label text-center">
              {activePanel === "chat"     ? "MeCo.AI" :
               activePanel === "memories" ? "Memories"         :
               activePanel === "privacy"  ? "Privacy"          : "Settings"}
            </h1>
            <div className="flex items-center gap-0.5">
              {activePanel === "chat" && memories.length > 0 && (
                <button
                  type="button"
                  onClick={() => void reindex()}
                  disabled={reindexing}
                  className="w-8 h-8 flex items-center justify-center rounded-full text-ios-gray-1 hover:bg-ios-fill transition-colors disabled:opacity-50"
                  aria-label="Re-index memories"
                  title="Re-index memories"
                >
                  <RefreshCw size={16} className={reindexing ? "animate-spin" : ""} />
                </button>
              )}
              <button
                type="button"
                onClick={toggleTheme}
                className="w-8 h-8 flex items-center justify-center rounded-full text-ios-gray-1 hover:bg-ios-fill transition-colors"
                aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              >
                {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
              </button>
            </div>
          </div>
        </header>

        {/* Content area */}
        <main className="flex-1 flex flex-col overflow-hidden min-h-0">
          {activePanel === "chat" && (
            <>
              {/* Scrollable messages */}
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
                <Conversation messages={messages} />
                {showOnboarding && <OnboardingOverlay onDismiss={dismissOnboarding} />}
              </div>
              {/* Composer pinned above the tab bar */}
              <div className="shrink-0 bg-ios-surface/80 backdrop-blur-[20px] border-t border-ios-sep pb-tab-bar">
                <Composer busy={busy} settings={settings} onSubmit={submit} useCloudTranscription={useCloudTranscription} />
              </div>
            </>
          )}
          {activePanel !== "chat" && (
            <div className="flex-1 overflow-y-auto pb-tab-bar">
              {activePanel === "memories" && (
                <MemoryLedger memories={memories} onDelete={removeMemory} onEdit={editMemory} />
              )}
              {activePanel === "privacy" && (
                <PrivacyPanel settings={settings} onAfterWipe={refresh} />
              )}
              {activePanel === "settings" && (
                <SettingsPanel settings={settings} onChange={updateSettings} />
              )}
            </div>
          )}
        </main>

        {/* iOS Tab Bar */}
        <TabBar active={activePanel} onChange={setActivePanel} />
      </div>

      {/* ── Desktop layout (≥ lg) ────────────────────────────────────── */}
      <div className="hidden lg:flex h-screen overflow-hidden">
        <Sidebar active={activePanel} onChange={setActivePanel} theme={theme} onToggleTheme={toggleTheme} />

        {/* Main content */}
        <div className="flex flex-col flex-1 min-w-0">
          {/* macOS title bar area */}
          <header className="flex items-center justify-between h-10 px-4 bg-mac-sidebar/80 border-b border-ios-sep shrink-0">
            <p className="text-[13px] text-ios-gray-1">
              {activePanel === "chat"     ? "Chat" :
               activePanel === "memories" ? "Memories" :
               activePanel === "privacy"  ? "Privacy" : "Settings"}
            </p>
            {activePanel === "chat" && (
              <div className="flex items-center gap-2">
                {memories.length > 0 && (
                  <button
                    type="button"
                    onClick={() => void reindex()}
                    disabled={reindexing}
                    className="flex items-center gap-1.5 px-2 h-6 rounded text-[12px] text-ios-gray-1 hover:bg-ios-fill transition-colors disabled:opacity-50"
                    aria-label="Re-index memories"
                  >
                    <RefreshCw size={12} className={reindexing ? "animate-spin" : ""} />
                    {reindexing ? "Indexing…" : "Re-index"}
                  </button>
                )}
                {messages.length > 0 && (
                  <button
                    type="button"
                    onClick={() => void clearChat()}
                    className="flex items-center gap-1.5 px-2 h-6 rounded text-[12px] text-ios-gray-1 hover:bg-ios-fill transition-colors"
                    aria-label="Clear chat"
                  >
                    <Trash2 size={12} />
                    Clear chat
                  </button>
                )}
              </div>
            )}
          </header>

          {/* Panel content */}
          <main className="flex-1 overflow-hidden">
            {activePanel === "chat" && (
              <div className="flex flex-col h-full">
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
                  <Conversation messages={messages} />
                  {showOnboarding && <OnboardingOverlay onDismiss={dismissOnboarding} />}
                </div>
                <div className="border-t border-ios-sep bg-ios-surface/60 backdrop-blur-sm shrink-0">
                  <Composer busy={busy} settings={settings} onSubmit={submit} useCloudTranscription={useCloudTranscription} />
                </div>
              </div>
            )}
            {activePanel === "memories" && (
              <div className="overflow-y-auto h-full p-4">
                <MemoryLedger memories={memories} onDelete={removeMemory} onEdit={editMemory} />
              </div>
            )}
            {activePanel === "privacy" && (
              <div className="overflow-y-auto h-full p-6 max-w-2xl">
                <PrivacyPanel settings={settings} onAfterWipe={refresh} />
              </div>
            )}
            {activePanel === "settings" && (
              <div className="overflow-y-auto h-full p-6 max-w-2xl">
                <SettingsPanel settings={settings} onChange={updateSettings} />
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
