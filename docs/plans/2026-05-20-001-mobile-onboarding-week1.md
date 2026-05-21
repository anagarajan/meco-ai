# Plan: Week 1 Mobile Onboarding Improvements
**Date:** 2026-05-20
**Status:** Approved
**Repo:** anagarajan/meco-ai

---

## Objective

Reduce mobile onboarding friction without removing the user-owned API key model. Four features ship in one week.

---

## Features

1. **Groq free tier provider** — third AI provider, free tier, no credit card required
2. **Clipboard auto-detection** — detect valid API key patterns on app resume / settings open and offer to auto-fill
3. **In-app browser guided setup** — "Get a key →" button opens provider key page inside the app
4. **OpenAI OAuth with PKCE** — "Connect with OpenAI" button, no manual key copy-paste

---

## Architecture Overview

```
Before:
  User → pastes sk-... key → IndexedDB → API calls

After:
  User → [A] Groq: paste gsk_... key (free, no card)
         [B] Any provider: tap "Get a key →" → in-app browser → copy → clipboard auto-fill
         [C] OpenAI: tap "Connect with OpenAI" → OAuth PKCE → token stored → calls work
```

**New Capacitor plugins:**
- `@capacitor/browser` — in-app browser + OAuth redirect
- `@capacitor/clipboard` — clipboard read on foreground / settings open
- `@capacitor/app` — `appStateChange` event for clipboard check on resume

**New backend:** one Vercel Edge Function (`api/oauth/openai/exchange.ts`) — stateless, exchanges auth code for token, stores nothing.

---

## Phase 1: Groq Free Tier Provider (Day 1–2)

Groq's API is OpenAI-compatible. Groq has no embedding API — local n-gram embeddings are used when Groq is active.

### Files

| File | Change |
|------|--------|
| `src/services/ai/groqProvider.ts` | **New** — `GroqReasoningProvider`, `GroqTranscriptionProvider`, `GroqMemoryExtractionProvider` |
| `src/types/domain.ts` | Add `groq_api_key?`, `groq_model?`, extend `default_ai_provider` union to include `"groq"` |
| `src/services/ai/registry.ts` | Add Groq branch: reasoning/extraction/transcription → Groq; embedding → `LocalEmbeddingProvider` |
| `src/services/ai/keyValidator.ts` | Add `validateGroqKey()`: format check (`gsk_...`), live test against `api.groq.com/openai/v1/models` |
| `src/components/settings/SettingsPanel.tsx` | Add Groq section: key input, Test button, model selector, "Free tier · no credit card" badge |

### Groq models
- `llama-3.3-70b-versatile` (default)
- `llama-3.1-8b-instant`
- `gemma2-9b-it`
- Transcription: `whisper-large-v3-turbo`

### Notes
- No Dexie schema version bump needed — new AppSettings fields are optional strings, settings store is queried only by `id`.
- Image extraction: use OpenAI vision if OpenAI key present, otherwise surface clear "not supported" message.
- Show capabilities badge: "Basic recall · No image support" vs OpenAI "Full capabilities".

---

## Phase 2: Capacitor Plugin Installation (Day 2)

```bash
npm install @capacitor/browser @capacitor/clipboard @capacitor/app
npx cap sync ios
```

### Files

| File | Change |
|------|--------|
| `capacitor.config.ts` | Enable `App.appUrlOpen` in plugins config |
| `ios/App/App/Info.plist` | Add `meco://` URL scheme under `CFBundleURLTypes` |
| `ios/App/App/AppDelegate.swift` | Verify Capacitor's `application(_:open:options:)` passthrough |

### Info.plist addition
```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array><string>meco</string></array>
  </dict>
</array>
```

---

## Phase 3: Clipboard Auto-Detection + In-App Browser Guided Setup (Day 2–3)

### 3A — Clipboard Auto-Detection

**New:** `src/hooks/useClipboardKeyDetector.ts`

Returns `{ detectedKey, detectedProvider, dismiss }`.

Logic:
1. On mount: read `Clipboard.read()`, test against key patterns
2. On `App.addListener('appStateChange', { isActive: true })`: re-read clipboard
3. Key patterns:
   - OpenAI: `/^sk-[A-Za-z0-9\-_]{20,}$/`
   - Anthropic: `/^sk-ant-[A-Za-z0-9\-_]{20,}$/`
   - Groq: `/^gsk_[A-Za-z0-9]{20,}$/`
4. If match and key not already set in settings: surface offer

**Modified:** `src/components/settings/SettingsPanel.tsx`
- Dismissible banner at top: "📋 OpenAI key detected in clipboard — Tap to fill [Fill] [✕]"
- On "Fill": call `onChange({ openai_api_key: detectedKey })` then trigger validation

### 3B — In-App Browser Guided Setup

**New:** `src/components/settings/GetApiKeyButton.tsx`

Props: `provider: "openai" | "anthropic" | "groq"`

On tap: `Browser.open({ url: PROVIDER_KEY_URLS[provider], presentationStyle: "popover" })`

URLs:
- OpenAI: `https://platform.openai.com/api-keys`
- Anthropic: `https://console.anthropic.com/settings/keys`
- Groq: `https://console.groq.com/keys`

Browser close triggers `appStateChange` → clipboard detection picks up key automatically.

**Modified:** `src/components/settings/SettingsPanel.tsx`
- Add `<GetApiKeyButton provider="openai" />` next to OpenAI key input
- Add `<GetApiKeyButton provider="anthropic" />` next to Anthropic key input
- Add `<GetApiKeyButton provider="groq" />` next to Groq key input

---

## Phase 4: OpenAI OAuth with PKCE (Day 3–5)

### 4A — Vercel Edge Function

**New:** `api/oauth/openai/exchange.ts`

- `POST { code, code_verifier, redirect_uri }`
- Exchanges with OpenAI token endpoint using `OPENAI_CLIENT_ID` + `OPENAI_CLIENT_SECRET` (Vercel env vars, never in app bundle)
- Returns `{ access_token, token_type, expires_in, scope }`
- Stateless — stores nothing
- CORS restricted to `meco://` and Vercel domain

### 4B — OAuth PKCE Service

**New:** `src/services/ai/openaiOAuth.ts`

```typescript
generatePKCE(): { codeVerifier: string, codeChallenge: string }
buildAuthURL(codeChallenge: string): string
  // → https://accounts.openai.com/oauth/authorize
  //   ?client_id=...&redirect_uri=meco://oauth/callback
  //   &response_type=code&scope=openai.api
  //   &code_challenge=...&code_challenge_method=S256
exchangeCode(code: string, codeVerifier: string): Promise<OAuthToken>
  // → calls POST /api/oauth/openai/exchange
```

**Modified:** `src/types/domain.ts`
```typescript
openai_oauth_token?: string;
openai_oauth_token_expiry?: string;   // ISO string
openai_oauth_refresh_token?: string;
```

### 4C — Deep Link Handler

**Modified:** `src/app/App.tsx`
```typescript
App.addListener('appUrlOpen', async (event) => {
  if (event.url.startsWith('meco://oauth/callback')) {
    const code = new URL(event.url).searchParams.get('code');
    const codeVerifier = sessionStorage.getItem('oauth_code_verifier')
                      ?? localStorage.getItem('oauth_code_verifier');
    const token = await exchangeCode(code, codeVerifier);
    await updateSettings({ openai_oauth_token: token.access_token, ... });
    sessionStorage.removeItem('oauth_code_verifier');
    localStorage.removeItem('oauth_code_verifier');
  }
});
```

### 4D — UI

**New:** `src/components/settings/OpenAIOAuthButton.tsx`

- "Connect with OpenAI" — shown when no key or token is set
- On tap: `generatePKCE()` → store `codeVerifier` → `Browser.open(buildAuthURL(...))`
- Connected state: "Connected via OpenAI ✓ · Disconnect"
- "Use API key instead" link for power users

**Modified:** `src/components/settings/SettingsPanel.tsx`
- OpenAI section: OAuth button (default) OR key input (manual fallback) OR connected state
- `openaiProvider.ts`: reads `settings.openai_api_key ?? settings.openai_oauth_token` for Authorization header

---

## Full File Change Summary

| File | Change | Phase |
|------|--------|-------|
| `src/services/ai/groqProvider.ts` | **New** | 1 |
| `src/services/ai/openaiOAuth.ts` | **New** | 4 |
| `src/hooks/useClipboardKeyDetector.ts` | **New** | 3 |
| `src/components/settings/GetApiKeyButton.tsx` | **New** | 3 |
| `src/components/settings/OpenAIOAuthButton.tsx` | **New** | 4 |
| `api/oauth/openai/exchange.ts` | **New** | 4 |
| `src/types/domain.ts` | Modified | 1 + 4 |
| `src/services/ai/registry.ts` | Modified | 1 |
| `src/services/ai/keyValidator.ts` | Modified | 1 + 4 |
| `src/services/ai/openaiProvider.ts` | Modified | 4 |
| `src/components/settings/SettingsPanel.tsx` | Modified | 1 + 3 + 4 |
| `src/app/App.tsx` | Modified | 4 |
| `capacitor.config.ts` | Modified | 2 |
| `ios/App/App/Info.plist` | Modified | 2 |
| `package.json` | Modified | 2 |

---

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| OpenAI OAuth `client_id` requires platform registration and approval | **High** — blocks Phase 4 if not approved | Register Day 1. If rejected, Phase 4 becomes guided setup (same browser flow, user copies key manually after logging in). |
| Clipboard permission denied on iOS | Medium | Show rationale before requesting; graceful fallback if denied |
| `meco://` deep link not firing on cold start (iOS) | Medium | Test on real device early; known Capacitor edge case |
| PKCE `codeVerifier` lost if app killed mid-OAuth | Low | Store in both `sessionStorage` and `localStorage`; clear after successful exchange |
| Groq free tier rate limits (14,400 req/day) | Low | Document in UI; sufficient for personal use |

---

## Day-by-Day Schedule

| Day | Work |
|-----|------|
| 1 | Phase 1: Groq provider, validator, settings UI. Test on simulator. Also: register app on OpenAI platform. |
| 2 | Phase 2: Install plugins, sync, URL scheme. Phase 3A: clipboard hook + banner. |
| 3 | Phase 3B: `GetApiKeyButton` + in-app browser. End-to-end test: open groq.com, copy key, return, banner fills. |
| 4 | Phase 4A + 4B: Vercel edge function + PKCE service. |
| 5 | Phase 4C + 4D: deep link handler + OAuth UI. End-to-end OAuth test on real device. |

---

## Effort Estimate

| Phase | Complexity | Hours |
|-------|-----------|-------|
| Groq provider | Low | 4–5 |
| Plugin install + URL scheme | Low | 1 |
| Clipboard detection | Low | 2–3 |
| In-app browser buttons | Low | 2 |
| OpenAI OAuth (PKCE + edge fn + deep link + UI) | High | 8–10 |
| **Total** | **Medium-High** | **~18–21 hrs** |
