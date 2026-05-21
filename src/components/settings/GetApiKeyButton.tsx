import { ExternalLink } from "lucide-react";
import { Browser } from "@capacitor/browser";
import { cn } from "@/lib/utils";

type Provider = "openai" | "anthropic" | "groq";

const PROVIDER_KEY_URLS: Record<Provider, string> = {
  openai: "https://platform.openai.com/api-keys",
  anthropic: "https://console.anthropic.com/settings/keys",
  groq: "https://console.groq.com/keys",
};

const PROVIDER_LABELS: Record<Provider, string> = {
  openai: "Get OpenAI key",
  anthropic: "Get Anthropic key",
  groq: "Get free Groq key",
};

interface GetApiKeyButtonProps {
  provider: Provider;
  className?: string;
}

export function GetApiKeyButton({ provider, className }: GetApiKeyButtonProps) {
  async function open() {
    await Browser.open({
      url: PROVIDER_KEY_URLS[provider],
      presentationStyle: "popover",
    });
  }

  return (
    <button
      type="button"
      onClick={() => void open()}
      className={cn(
        "flex items-center gap-1.5 h-9 px-3 rounded-ios-sm border border-ios-sep",
        "text-[13px] font-medium text-ios-blue bg-ios-surface",
        "hover:bg-ios-blue/5 transition-colors shrink-0",
        className,
      )}
    >
      <ExternalLink size={13} />
      {PROVIDER_LABELS[provider]}
    </button>
  );
}
