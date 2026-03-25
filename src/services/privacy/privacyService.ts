import { hashSecret } from "../../utils/crypto";
import { exportData, importData, saveSettings, wipeAllData } from "../storage/localRepository";
import type { AppSettings } from "../../types/domain";

export async function downloadExport(): Promise<void> {
  const payload = await exportData();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `meco-ai-export-${new Date().toISOString()}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function wipeDeviceData(): Promise<void> {
  await wipeAllData();
}

export async function importFromFile(file: File): Promise<{ imported: number; skipped: number }> {
  const text = await file.text();
  const data: unknown = JSON.parse(text);
  return importData(data);
}

export interface StorageEstimate {
  usedMB: string;
  quotaMB: string;
  percentUsed: string;
  persisted: boolean;
}

export async function getStorageEstimate(): Promise<StorageEstimate | null> {
  if (!navigator.storage) return null;
  try {
    const [estimate, persisted] = await Promise.all([
      navigator.storage.estimate(),
      navigator.storage.persisted?.() ?? Promise.resolve(false),
    ]);
    const used  = ((estimate.usage  ?? 0) / 1024 / 1024).toFixed(1);
    const quota = ((estimate.quota  ?? 0) / 1024 / 1024).toFixed(0);
    const pct   = estimate.quota ? ((estimate.usage ?? 0) / estimate.quota * 100).toFixed(1) : "0";
    return { usedMB: used, quotaMB: quota, percentUsed: pct, persisted };
  } catch {
    return null;
  }
}

export async function updatePasscode(settings: AppSettings, passcode: string): Promise<AppSettings> {
  const nextSettings: AppSettings = {
    ...settings,
    passcode_or_lock_enabled: Boolean(passcode),
    passcode_hash: passcode ? await hashSecret(passcode) : undefined,
  };
  await saveSettings(nextSettings);
  return nextSettings;
}

