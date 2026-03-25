# Privacy

## Summary

MeCo.AI is local-first. Messages, memory items, embeddings, and raw media blobs are stored in the browser using IndexedDB by default. No backend is required for core functionality.

## What Stays Local

- chat messages
- normalized memory items
- embeddings
- images and voice-note blobs
- settings
- optional passcode hash

## What Leaves The Device

Nothing leaves the device unless the user explicitly enables cloud inference and supplies a provider key. If they do, selected text, image, or audio content may be sent to that provider for inference only.

## Defaults

- explicit-save mode
- no analytics
- no hidden background sync
- cloud inference disabled
- local storage only

## Browser Storage Tradeoffs

Browser-local storage is practical and cheap, but it is not equivalent to hardware-backed secure storage. A stolen or compromised device, shared browser profile, or malicious extension may expose locally stored data.

## Secrets

Provider keys can be stored locally for convenience, but this is a tradeoff. The safest path is short-lived session entry rather than long-term browser storage.

## Raw Media Retention

Images and audio are stored locally when attached. Retention can be shortened in settings, and export / wipe features are available in-app.

## Logging

The app avoids sensitive-content logging by design. Developers should preserve that rule when adding instrumentation.

