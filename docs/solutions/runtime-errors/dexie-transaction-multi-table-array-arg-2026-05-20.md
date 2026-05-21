---
title: "Dexie transaction() Requires Tables as Array, Not Spread Arguments"
date: 2026-05-20
category: runtime-errors
module: Storage
problem_type: runtime_error
component: database
symptoms:
  - wipeAllData() fails at runtime when clearing all stores atomically
  - Dexie transaction does not execute or silently skips tables
root_cause: wrong_api
resolution_type: code_fix
severity: high
related_components:
  - localRepository
tags:
  - dexie
  - indexeddb
  - transactions
  - pwa
  - multi-table
---

# Dexie transaction() Requires Tables as Array, Not Spread Arguments

## Problem

`wipeAllData()` called `db.transaction("rw", ...)` with five table references as individual positional arguments. Dexie's multi-table overload requires tables wrapped in an array — the spread form hits a different (or mismatched) overload, causing the transaction to fail or behave incorrectly at runtime.

## Symptoms

- `wipeAllData()` fails at runtime; data is not cleared
- The callback function may be silently misidentified as a table argument when too many positional args are passed

## What Didn't Work

The spread form passes each table as a separate variadic argument. When Dexie receives more positional arguments than expected, it may parse the callback as one of the table arguments or fail to construct the transaction scope correctly. No TypeScript error is produced because the spread matches a valid (but wrong) overload.

## Solution

Wrap the table references in an explicit array:

```typescript
// Before — tables as individual spread arguments (wrong overload)
await db.transaction("rw",
  db.messages, db.memory_items, db.memory_embeddings, db.assets, db.reminders,
  async () => { ... }
);

// After — tables as an array (correct Dexie multi-table overload)
await db.transaction("rw",
  [db.messages, db.memory_items, db.memory_embeddings, db.assets, db.reminders],
  async () => { ... }
);
```

The `importData()` function in the same file correctly uses the array form and serves as the reference pattern.

## Why This Works

Dexie's TypeScript overloads for `transaction()` accept `tables: Table[]` (array) as the second argument for multi-table transactions. The array form is unambiguous and correctly enumerates all stores that should participate in the transaction's scope.

## Prevention

- **Use the array form for all multi-table transactions.** Single-table transactions (`db.transaction("rw", db.messages, ...)`) work with a direct table reference, but two or more tables must always be wrapped in an array.
- **Reference `importData()` in `localRepository.ts`** as the in-repo example of the correct pattern.

## Related Issues

- Fix applied in commit `eb0c9f1`: `overflow issue fixed`
- Source file: `src/services/storage/localRepository.ts` — `wipeAllData()`
