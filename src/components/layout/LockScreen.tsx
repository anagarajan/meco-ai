import { useState } from "react";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

interface LockScreenProps {
  onUnlock: (passcode: string) => Promise<boolean>;
}

export function LockScreen({ onUnlock }: LockScreenProps) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);

  async function handleUnlock(): Promise<void> {
    if (!value.trim() || loading) return;
    setLoading(true);
    const ok = await onUnlock(value);
    setLoading(false);
    if (!ok) {
      setError("Incorrect passcode");
      setValue("");
      setShake(true);
      setTimeout(() => setShake(false), 500);
    } else {
      setError("");
      setValue("");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/40 backdrop-blur-[12px]">
      <div
        className={cn(
          "w-full max-w-[360px] bg-ios-surface rounded-[28px] overflow-hidden",
          "shadow-[0_32px_64px_rgba(0,0,0,0.3)]",
          shake && "animate-[shake_0.4s_ease-in-out]",
        )}
      >
        {/* Header */}
        <div className="flex flex-col items-center pt-8 pb-6 px-6 bg-ios-purple/5">
          <div className="w-14 h-14 rounded-full bg-ios-purple flex items-center justify-center mb-3">
            <Lock size={24} className="text-white" />
          </div>
          <h2 className="text-[20px] font-semibold text-ios-label text-center">App Locked</h2>
          <p className="text-[15px] text-ios-gray-1 text-center mt-1 leading-snug">
            Enter your passcode to continue
          </p>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-3">
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void handleUnlock(); }}
            placeholder="Passcode"
            type="password"
            autoFocus
            className={cn(
              "w-full h-12 px-4 rounded-[14px] border text-[17px] text-center tracking-[4px]",
              "bg-ios-gray-6 placeholder:text-ios-gray-3 placeholder:tracking-normal",
              "focus:outline-none transition-colors",
              error
                ? "border-ios-red/40 focus:border-ios-red"
                : "border-ios-sep focus:border-ios-purple/50",
            )}
          />

          {error && (
            <p className="text-[14px] text-ios-red text-center">{error}</p>
          )}

          <button
            type="button"
            disabled={!value.trim() || loading}
            onClick={() => void handleUnlock()}
            className={cn(
              "w-full h-12 rounded-[14px] text-[17px] font-semibold border-0 transition-all",
              value.trim() && !loading
                ? "bg-ios-purple text-white hover:bg-ios-purple-dk active:scale-[0.98]"
                : "bg-ios-gray-5 text-ios-gray-2",
            )}
          >
            {loading
              ? <span className="inline-block w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              : "Unlock"}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%       { transform: translateX(-8px); }
          40%       { transform: translateX(8px); }
          60%       { transform: translateX(-5px); }
          80%       { transform: translateX(5px); }
        }
      `}</style>
    </div>
  );
}
