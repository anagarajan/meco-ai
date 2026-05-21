---
title: "Dexie KeyPath Not Indexed: Adding Schema Fields for where() Queries"
date: 2026-05-20
category: database-issues
module: Storage
problem_type: database_issue
component: database
symptoms:
  - Runtime exception thrown when calling where() on a field not in the Dexie schema string
  - sweep function fails with an unhandled exception and produces no user-visible feedback
  - No compile-time error — the code compiles and appears correct until runtime
root_cause: missing_index
resolution_type: code_fix
severity: high
related_components:
  - localRepository
  - sweepRawMedia
tags:
  - dexie
  - indexeddb
  - schema-migration
  - pwa
  - offline-storage
---

# Dexie KeyPath Not Indexed: Adding Schema Fields for where() Queries

## Problem

When `sweepRawMedia()` called `db.messages.where("media_path_or_blob_ref").equals(asset.id)`, Dexie threw `Uncaught Error: KeyPath not indexed`, completely breaking the media retention sweep. The field existed on the `ChatMessage` TypeScript type and was stored in IndexedDB records, but had never been declared as an index in the Dexie schema string — so it was physically stored but unreachable via `.where()`.

## Symptoms

- `Uncaught Error: KeyPath not indexed` at runtime when `.where("media_path_or_blob_ref")` is called
- `sweepRawMedia()` fails with an unhandled exception; media assets cannot be dereferenced from parent messages

## What Didn't Work

The field `media_path_or_blob_ref` was already present on the `ChatMessage` domain type and written to IndexedDB records. But Dexie requires every field used in `.where()` to be explicitly declared in the schema index string — **storing a value in a record does not make it queryable**. Fields present in stored objects but absent from the schema string are unindexed and cannot be used as `.where()` predicates.

## Solution

Add a new `version(4)` block in `src/services/storage/database.ts`. Existing version declarations **cannot be amended** in Dexie — you must add a new `version(N)` entry and repeat all store definitions. The only change between v3 and v4 is `media_path_or_blob_ref` appended to the `messages` schema string:

```typescript
// Before: version(3) — messages lacks the media_path_or_blob_ref index
this.version(3).stores({
  messages: "id, role, modality, created_at",
  memory_items: "id, message_id, memory_type, created_at, superseded_by, deleted_at",
  memory_embeddings: "memory_id",
  settings: "id, updated_at",
  assets: "id, kind, created_at",
  reminders: "id, memory_id, remind_at, fired, active",
}).upgrade((tx) => /* backfill reminders.active */);

// After: version(4) — all stores copied verbatim from v3; messages gets the new field
this.version(4).stores({
  messages: "id, role, modality, created_at, media_path_or_blob_ref",
  memory_items: "id, message_id, memory_type, created_at, superseded_by, deleted_at",
  memory_embeddings: "memory_id",
  settings: "id, updated_at",
  assets: "id, kind, created_at",
  reminders: "id, memory_id, remind_at, fired, active",
});
// No .upgrade() callback needed when only adding an index — Dexie rebuilds
// indexes on existing records automatically during the upgrade transaction.
```

> **Critical:** copy store definitions verbatim from the previous version block when authoring a new one. Do not abbreviate from memory — omitting a store's index string silently drops those indexes.

## Why This Works

Dexie's `.where("fieldName")` requires the field to exist as an IndexedDB key path index. The schema string (comma-separated values in `.stores()`) is the complete index manifest for that object store. Incrementing the version triggers an IndexedDB `versionchange` transaction that creates the missing index from all existing records automatically.

**Multi-tab upgrade risk (PWA):** In a PWA, multiple browser tabs may hold open connections to the same IndexedDB database. When version 4 is deployed, any tab still running version 3 receives a `versionchange` event. If that tab does not release its connection promptly, the upgrading tab fires `onblocked` and the upgrade stalls indefinitely. Register a Dexie `on('versionchange')` handler that calls `db.close()` (and optionally reloads the page) to prevent this.

**Sparse index behavior:** IndexedDB does not index `undefined` values, so this index is sparse — records where `media_path_or_blob_ref` is absent are simply excluded from the index. `.where("media_path_or_blob_ref").equals(someId)` correctly finds only records with that value set.

**No rollback path:** IndexedDB spec does not support downgrading a schema version. If version 4 needs to be reverted, the only options are deleting the database (data loss) or adding a version 5 that removes the index. Plan version bumps with this constraint in mind.

## Prevention

- **Same-PR rule:** whenever you add a `.where("field")` call on a new or existing field, add the field to the Dexie schema string and bump the version in the same PR. This is the only reliable safeguard — TypeScript cannot verify that a string argument to `.where()` matches the schema.
- **Copy, don't recreate:** when authoring a new `version(N)` block, copy all store definitions from the previous version block as the starting point, then apply your change. Never reconstruct from memory or a simplified example.
- **Integration test:** add a test that opens a real Dexie instance (use [`fake-indexeddb`](https://github.com/dumbmatter/fakeIndexedDB) — Dexie's officially supported in-memory IndexedDB backend for Vitest/Jest), populates `messages` with a record that has `media_path_or_blob_ref` set, and calls `sweepRawMedia()`. A mock would not reproduce the index-lookup path and would not catch this class of error.

## Related Issues

- Fix applied in commit `f9735e7`: `fix: add media_path_or_blob_ref index to messages store`
- Schema definition: `src/services/storage/database.ts`
- Calling site: `src/services/storage/localRepository.ts` — `sweepRawMedia()`
