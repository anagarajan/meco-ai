export type KeyValidationStatus = "idle" | "testing" | "valid" | "invalid" | "network_error";

export interface KeyValidationResult {
  status: Exclude<KeyValidationStatus, "idle" | "testing">;
  message: string;
}

function checkOpenAIFormat(key: string): boolean {
  return key.startsWith("sk-") && key.length > 20;
}

function checkAnthropicFormat(key: string): boolean {
  return key.startsWith("sk-ant-") && key.length > 20;
}

export async function validateOpenAIKey(apiKey: string): Promise<KeyValidationResult> {
  if (!apiKey.trim()) {
    return { status: "invalid", message: "No key entered." };
  }
  if (!checkOpenAIFormat(apiKey)) {
    return { status: "invalid", message: "Key format looks wrong — OpenAI keys start with sk-" };
  }

  try {
    const response = await fetch("https://api.openai.com/v1/models", {
      credentials: "omit",
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (response.ok) return { status: "valid", message: "Key is valid and working." };
    if (response.status === 401) return { status: "invalid", message: "Invalid key — authentication failed." };
    if (response.status === 429) return { status: "valid",   message: "Key is valid but rate-limited (quota may be reached)." };
    return { status: "invalid", message: `Unexpected response (HTTP ${response.status}).` };
  } catch {
    // CORS or network failure — format already passed, warn instead of blocking
    if (checkOpenAIFormat(apiKey)) {
      return {
        status: "network_error",
        message: "Live test blocked by browser security (CORS). Key format looks correct — save it and try asking a question to confirm.",
      };
    }
    return { status: "network_error", message: "Could not reach OpenAI. Check your connection." };
  }
}

export async function validateAnthropicKey(apiKey: string): Promise<KeyValidationResult> {
  if (!apiKey.trim()) {
    return { status: "invalid", message: "No key entered." };
  }
  if (!checkAnthropicFormat(apiKey)) {
    return { status: "invalid", message: "Key format looks wrong — Anthropic keys start with sk-ant-" };
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      credentials: "omit",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-allow-browser": "true",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1,
        messages: [{ role: "user", content: "hi" }],
      }),
    });

    if (response.ok)              return { status: "valid",   message: "Key is valid and working." };
    if (response.status === 401)  return { status: "invalid", message: "Invalid key — authentication failed." };
    if (response.status === 403)  return { status: "invalid", message: "Key does not have permission for this API." };
    if (response.status === 429)  return { status: "valid",   message: "Key is valid but rate-limited (quota may be reached)." };
    // 400 often means the request was understood — key is likely fine
    if (response.status === 400)  return { status: "valid",   message: "Key accepted by Anthropic." };
    return { status: "invalid", message: `Unexpected response (HTTP ${response.status}).` };
  } catch {
    // CORS preflight or network failure — custom headers trigger preflight which can be blocked
    // by Safari/iOS even when the key itself is valid
    return {
      status: "network_error",
      message: "Live test blocked by browser (CORS). Key format looks correct — save it and ask a question to confirm it works.",
    };
  }
}
