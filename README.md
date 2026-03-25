# MeCo.AI

A privacy-first, local-first PWA for storing and retrieving personal memories from text, images, and voice notes. No account, no backend, no data leaving your device.

---

## Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| [Node.js](https://nodejs.org) | 18+ (22 recommended) | Required to build and run locally |
| [npm](https://www.npmjs.com) | 9+ | Comes bundled with Node.js |
| [Git](https://git-scm.com) | Any recent version | Required to clone the repo |
| A modern browser | Chrome 90+, Safari 16.4+, Firefox 90+ | For local development |
| [Vercel CLI](https://vercel.com/cli) | Latest | Only needed for deployment (`npm i -g vercel`) |
| An API key | — | **Required** — OpenAI or Anthropic (see below) |

### API key (required)

The app requires at least one AI provider key to function. You will be prompted to enter it on first launch.

| Provider | Where to get a key | Key format |
|---|---|---|
| OpenAI | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) | `sk-…` |
| Anthropic | [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys) | `sk-ant-…` |

Keys are entered inside the app — never in config files or environment variables. They are stored only in IndexedDB on your device.

---

## Quick start

### Option 1 — Run locally (laptop/desktop)

```bash
git clone https://github.com/YOUR_USERNAME/ai-meco-ai.git
cd ai-meco-ai
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

---

### Option 2 — Deploy to Vercel (recommended for phone)

Get your own free instance at `*.vercel.app` in under a minute:

```bash
git clone https://github.com/YOUR_USERNAME/ai-meco-ai.git
cd ai-meco-ai
npm install -g vercel
vercel login
vercel --prod
```

Vercel auto-detects Vite. No server config needed. Free tier is sufficient.

---

### Option 3 — Install on your phone

Once you have a Vercel URL (from Option 2):

**iOS — Safari only**
1. Open your `*.vercel.app` URL in **Safari**
2. Tap the **Share** button → **Add to Home Screen** → **Add**

**Android — Chrome**
1. Open your `*.vercel.app` URL in **Chrome**
2. Tap the **three-dot menu** → **Install app** → **Install**

Launches fullscreen from your home screen.

> iOS requires Safari — Chrome and Firefox on iOS cannot install PWAs.

---

## First-time setup

When you open the app without an API key, you will see a setup screen. The app will not function until a key is entered.

1. Tap **Add API key**
2. Paste your **OpenAI** or **Anthropic** key into the relevant field
3. Use the **Test key** button to confirm it works
4. The app unlocks automatically once a valid key is saved

**API keys are stored only in your browser's IndexedDB — they never leave your device or touch any server.**

---

## How to use it

```
Remember that my passport is in the blue drawer
```
```
Where is my passport?
→ Passport is in the blue drawer. (saved March 20, 2026 · text)
```
```
[attach photo] Remember this parking spot
```
```
Where did I park?
→ Blue Honda, Level 3, spot B-14. (saved today · image)
```

- **Remember mode** — saves a memory (text, image, or voice note)
- **Ask mode** — searches your memories and answers using RAG
- **Memories tab** — browse, search, filter by type, edit, or delete saved memories

---

## Data & storage

All data lives in IndexedDB on your device. The app requests **persistent storage** on first launch so the browser does not evict it.

### Storage persistence by platform

| Platform | Risk | Notes |
|---|---|---|
| iOS Safari (browser tab) | High | Evicted after ~7 days of inactivity |
| iOS PWA (installed) | Low | Protected storage from iOS 16.4+ |
| Android Chrome (installed PWA) | Low | Persistent storage granted on install |
| Mac / Windows browser | Very low | Desktop browsers rarely evict |
| Mac / Windows PWA (installed) | Essentially zero | OS-level app storage |

> **Installing as a PWA is the most important thing you can do to protect your data on iOS.**

### What causes data loss

- Deleting the app from your iOS home screen wipes all data permanently
- Safari → Settings → Clear History and Website Data deletes everything
- Factory resetting your device
- There is no cloud backup or cross-device sync

### Backup and restore

Use the **Privacy tab** to:
- **Export** — downloads a `.json` file with all memories, messages, and settings
- **Import** — restores from a previous export without overwriting existing records
- **Storage estimate** — shows how much space is used and whether persistent storage is active

Export regularly if you rely on this app for important information.

---

## Privacy

- No server, no analytics, no hidden sync
- All data (memories, chat, embeddings, media blobs) stored in IndexedDB on your device
- API keys stored in IndexedDB, never transmitted to our servers
- Raw media auto-deleted after a configurable number of days (default 7)
- Optional passcode lock (PBKDF2-hashed, stored locally)
- Cloud inference is always active — an API key is required to use the app

See [PRIVACY.md](PRIVACY.md) and [THREAT_MODEL.md](THREAT_MODEL.md) for full details.

---

## AI providers

Content is sent directly from your browser to your chosen provider using your own API key — nothing passes through our servers.

| Provider | Embedding | Reasoning | Extraction | Vision | Transcription |
|---|---|---|---|---|---|
| OpenAI | ✓ | ✓ | ✓ | ✓ | Whisper |
| Anthropic | Local n-gram | Claude | Claude | Claude | Whisper (if OpenAI key also set), otherwise OS speech recognition |

Use the **Test key** button in Settings to verify a key is working.

---

## Stack

| Layer | Technology |
|---|---|
| UI | React 19 + TypeScript |
| Build | Vite |
| Styling | Tailwind CSS v4 |
| Storage | Dexie 4 + IndexedDB |
| AI | OpenAI API or Anthropic Claude API (user-supplied key, required) |
| Embeddings (Anthropic) | Local n-gram hashing (256-dim) — Anthropic has no embedding API |
| Media | Browser File API, MediaRecorder, getUserMedia, Web Speech API |
| Security | Web Crypto API (PBKDF2 passcode hashing) |
| PWA | Web App Manifest + Service Worker (cache-first) |
| Storage persistence | Storage API (`navigator.storage.persist()`) |

---

## Features

### Core
- Messenger-style chat UI optimized for iOS and desktop
- Remember mode (save) and Ask mode (retrieve)
- Text, image, and voice note input
- Local blob storage for images and audio
- Soft-delete with supersession support

### Memory Intelligence
- RAG pipeline: embed → cosine similarity → rerank by recency + confidence → reason
- Duplicate detection (cosine threshold 0.82) with inline warning
- Smart context chips — surfaces a related memory as you type
- Scheduled reminders for time-sensitive memories
- Memory search, type filtering, and inline editing
- Re-index button in the chat header — re-embeds all memories with the current provider
- Auto re-index triggered whenever the API key or AI provider changes

### Settings & Safety
- API key validation with live test button per provider
- Storage usage estimate with persistent storage status indicator
- Export to JSON backup and import from backup (merge, no overwrites)
- Storage risk warnings for PWA deletion and browser data clearing
- Raw media retention period (configurable, default 7 days)
- Passcode app lock

### UX
- Dark mode with Sun/Moon toggle (persisted across sessions)
- Collapsible sidebar on desktop (hamburger icon)
- Composer pinned to bottom on mobile; only messages scroll
- Onboarding overlay for first-time users (3-step tour)
- Memory stats dashboard (total count, oldest date, type breakdown)
- Clear chat without losing memories

### PWA
- Installable on iOS (Add to Home Screen) and Android (adaptive maskable icon)
- Service worker caches static assets for fast loading
- `theme-color` meta adapts to light/dark system preference
- Requests persistent storage on first launch

---

## Project Structure

```
src/
├── app/                    Application shell (App.tsx)
├── components/
│   ├── chat/               Composer, Conversation
│   ├── layout/             Sidebar, TabBar, LockScreen
│   ├── memory/             MemoryLedger, MemoryStats
│   ├── onboarding/         OnboardingOverlay
│   ├── settings/           SettingsPanel, PrivacyPanel
│   └── ui/                 Shared primitives (Switch)
├── hooks/                  useMemoryCompanion, useTheme, useOnboarding,
│                           useRelatedMemory, useSpeechRecognition, useVoiceRecorder
├── services/
│   ├── ai/                 Provider interfaces, OpenAI / Anthropic
│   │                       implementations, key validator, local embeddings
│   ├── memory/             Extraction, duplicate detection, RAG retrieval
│   ├── reminders/          Scheduled reminder persistence and firing
│   ├── storage/            Dexie schema, repository, import/export, migrations
│   └── privacy/            Export, import, wipe, passcode, storage estimate
├── types/                  Domain models (AppSettings, MemoryItem, Reminder…)
└── utils/                  ids, date parsing, crypto, notifications
public/
├── icons/                  SVG icons (192, 512, maskable, apple-touch)
├── manifest.json           PWA manifest
└── sw.js                   Service worker (static asset caching)
```
