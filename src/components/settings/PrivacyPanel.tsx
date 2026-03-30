import { useState, useEffect, useRef } from "react";
import { ShieldCheck, Download, Upload, Trash2, Cloud, CloudOff, TriangleAlert, HardDrive, ShieldAlert, FileText } from "lucide-react";
import type { AppSettings } from "../../types/domain";
import { downloadExport, importFromFile, wipeDeviceData, getStorageEstimate, type StorageEstimate } from "../../services/privacy/privacyService";
import { cn } from "@/lib/utils";

interface PrivacyPanelProps {
  settings: AppSettings;
  onAfterWipe: () => Promise<void>;
}

/** True when running inside Capacitor's native shell (iOS/Android). */
const isNativeApp = typeof window !== "undefined" && !!(window as unknown as Record<string, unknown>).Capacitor;

const bulletItems = isNativeApp
  ? [
      "All data is stored locally on your device within the app's private container.",
      "Cloud inference is optional and only active when you enable it and provide an API key.",
      "Raw media deletion is configurable via the retention days setting.",
      "API keys are stored in the app's local storage and are never sent to third parties other than the respective AI provider.",
    ]
  : [
      "Text, memory items, embeddings, images, and voice blobs are stored on-device in IndexedDB by default.",
      "Cloud inference is optional and only active when you enable it and provide an API key.",
      "Raw media deletion is configurable via the retention days setting.",
      "Secrets in browser state are vulnerable if your device or browser profile is compromised.",
    ];

export function PrivacyPanel({ settings, onAfterWipe }: PrivacyPanelProps) {
  const [storageEst, setStorageEst] = useState<StorageEstimate | null>(null);
  const [importState, setImportState] = useState<"idle" | "importing" | "done" | "error">("idle");
  const [importMsg, setImportMsg] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getStorageEstimate().then(setStorageEst).catch(() => undefined);
  }, []);

  async function handleImport(file: File) {
    setImportState("importing");
    try {
      const { imported, skipped } = await importFromFile(file);
      setImportMsg(`Imported ${imported} items. ${skipped > 0 ? `${skipped} already existed and were skipped.` : ""}`);
      setImportState("done");
      await onAfterWipe(); // refresh app state
    } catch (err) {
      setImportMsg(err instanceof Error ? err.message : "Import failed.");
      setImportState("error");
    }
  }

  return (
    <div className="px-4 py-4 pb-10">
      <h2 className="text-[28px] font-bold text-ios-label mb-6 px-1">Privacy</h2>

      {/* Status card */}
      <div className="rounded-ios-xl bg-ios-surface border border-ios-sep p-4 mb-4 flex items-start gap-3">
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

      {/* Info list */}
      <div className="rounded-ios-xl overflow-hidden border border-ios-sep bg-ios-surface divide-y divide-ios-sep mb-4">
        {bulletItems.map((item, i) => (
          <div key={i} className="flex items-start gap-3 px-4 py-3">
            <span className="w-[6px] h-[6px] rounded-full bg-ios-gray-3 mt-[7px] shrink-0" />
            <p className="text-[15px] text-ios-label leading-snug">{item}</p>
          </div>
        ))}
      </div>

      {/* Cloud status */}
      <div className="rounded-ios-xl overflow-hidden border border-ios-sep bg-ios-surface mb-6">
        <div className="flex items-center gap-3 px-4 py-3">
          {settings.cloud_inference_enabled
            ? <Cloud size={18} className="text-ios-blue shrink-0" />
            : <CloudOff size={18} className="text-ios-gray-2 shrink-0" />}
          <p className="text-[17px] text-ios-label flex-1">Cloud inference</p>
          <span className={cn(
            "text-[15px] font-medium",
            settings.cloud_inference_enabled ? "text-ios-blue" : "text-ios-gray-1",
          )}>
            {settings.cloud_inference_enabled ? "On" : "Off"}
          </span>
        </div>
      </div>

      {/* Storage warnings */}
      <p className="text-[13px] font-semibold text-ios-gray-1 uppercase tracking-wide px-1 mb-2">
        Storage Warnings
      </p>
      <div className="rounded-ios-xl overflow-hidden border border-[#FF9500]/30 bg-[#FF9500]/5 divide-y divide-[#FF9500]/20 mb-6">
        <div className="flex items-start gap-3 px-4 py-3">
          <TriangleAlert size={17} className="text-[#FF9500] shrink-0 mt-[2px]" />
          <div>
            <p className="text-[15px] font-semibold text-ios-label leading-snug mb-1">
              {isNativeApp ? "Uninstalling the app deletes all data" : "Removing the app deletes all data"}
            </p>
            <p className="text-[13px] text-ios-gray-1 leading-relaxed">
              {isNativeApp
                ? "Uninstalling MeCo AI permanently erases all memories, chat history, and settings. There is no recovery. Export your data first."
                : "On iOS, deleting MeCo.AI from your home screen permanently erases all memories, chat history, and settings from this device. There is no recovery. Export your data first."}
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
            <p className="text-[15px] font-semibold text-ios-label leading-snug mb-1">
              No cloud backup
            </p>
            <p className="text-[13px] text-ios-gray-1 leading-relaxed">
              Data exists only on this device. It is not synced across devices or backed up automatically. Use Export to save a local copy before switching devices or reinstalling.
            </p>
          </div>
        </div>
      </div>

      {/* Storage estimate */}
      {storageEst && (
        <>
          <p className="text-[13px] font-semibold text-ios-gray-1 uppercase tracking-wide px-1 mb-2">
            Storage
          </p>
          <div className="rounded-ios-xl overflow-hidden border border-ios-sep bg-ios-surface mb-6">
            <div className="flex items-center gap-3 px-4 py-3">
              <HardDrive size={18} className="text-ios-gray-1 shrink-0" />
              <p className="text-[17px] text-ios-label flex-1">Used</p>
              <span className="text-[15px] text-ios-gray-1">{storageEst.usedMB} MB of {storageEst.quotaMB} MB ({storageEst.percentUsed}%)</span>
            </div>
            <div className="flex items-center gap-3 px-4 py-3 border-t border-ios-sep">
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
          </div>
        </>
      )}

      {/* Actions */}
      <p className="text-[13px] font-semibold text-ios-gray-1 uppercase tracking-wide px-1 mb-2">
        Data Actions
      </p>
      <div className="rounded-ios-xl overflow-hidden border border-ios-sep bg-ios-surface divide-y divide-ios-sep">
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
            await onAfterWipe();
          }}
          className="w-full flex items-center gap-3 px-4 py-3 text-left bg-transparent border-0 hover:bg-ios-red/5 transition-colors"
        >
          <Trash2 size={18} className="text-ios-red shrink-0" />
          <span className="text-[17px] text-ios-red flex-1">Wipe this device</span>
        </button>
      </div>

      {/* Privacy Policy link */}
      <p className="text-[13px] font-semibold text-ios-gray-1 uppercase tracking-wide px-1 mb-2 mt-6">
        Legal
      </p>
      <div className="rounded-ios-xl overflow-hidden border border-ios-sep bg-ios-surface">
        <a
          href="/privacy-policy.html"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center gap-3 px-4 py-3 text-left bg-transparent no-underline hover:bg-ios-gray-6/50 transition-colors"
        >
          <FileText size={18} className="text-ios-purple shrink-0" />
          <span className="text-[17px] text-ios-purple flex-1">Privacy Policy</span>
        </a>
      </div>
    </div>
  );
}
