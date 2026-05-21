---
title: "Reminder Date Parser: Adding today/tonight and Time Expression Support"
date: 2026-05-20
category: logic-errors
module: Reminders
problem_type: logic_error
component: assistant
symptoms:
  - parseFutureDate returns null for today/tonight inputs with no error or user feedback
  - All reminders created at 9 AM regardless of any time specified by the user
root_cause: logic_error
resolution_type: code_fix
severity: medium
tags:
  - date-parsing
  - reminders
  - natural-language
  - time-expressions
  - silent-failure
---

# Reminder Date Parser: Adding today/tonight and Time Expression Support

## Problem

`parseFutureDate()` in `src/utils/date.ts` had two compounding gaps: no branch for "today" or "tonight" (returning `null` silently), and every branch that did match hardcoded `9:00 AM` because no `parseTime()` helper existed. Inputs like "remind me today at 6PM" or "tonight" produced no reminder at all, with no error or feedback.

## Symptoms

- `parseFutureDate("tonight")` or `parseFutureDate("today at 6PM")` returns `null` — no reminder created
- "tomorrow at 6pm" creates a reminder, but at 9:00 AM instead of 6:00 PM

## What Didn't Work

Without a `parseTime()` abstraction, each date branch had to independently handle time — and all of them chose to hardcode `d.setHours(9, 0, 0, 0)` instead. The "today"/"tonight" shortcut was simply never implemented as a pattern branch.

## Solution

Two helper functions added, then wired into every branch of `parseFutureDate()`.

**`parseTime(text)`** — extracts `[hours, minutes]` from free-form text:

```typescript
function parseTime(text: string): [number, number] | null {
  const t = text.toLowerCase();

  // "at 6pm", "6:30pm", "6 pm", "6:30 pm", "at 6:30 am"
  const twelveHour = /\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/.exec(t);
  if (twelveHour) {
    let hours = parseInt(twelveHour[1], 10);
    const minutes = twelveHour[2] ? parseInt(twelveHour[2], 10) : 0;
    if (twelveHour[3] === "pm" && hours !== 12) hours += 12;
    if (twelveHour[3] === "am" && hours === 12) hours = 0; // 12 AM → midnight
    return [hours, minutes];
  }

  // "at 18:00", "18:30"
  const twentyFourHour = /\b(?:at\s+)?(\d{1,2}):(\d{2})\b/.exec(t);
  if (twentyFourHour) {
    const hours = parseInt(twentyFourHour[1], 10);
    const minutes = parseInt(twentyFourHour[2], 10);
    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      return [hours, minutes];
    }
  }

  return null;
}
```

**`applyTime(d, text)`** — stamps the parsed time onto a date, defaulting to 9 AM. Note: mutates `d` in place:

```typescript
function applyTime(d: Date, text: string): Date {
  const time = parseTime(text);
  if (time) {
    d.setHours(time[0], time[1], 0, 0);
  } else {
    d.setHours(9, 0, 0, 0);
  }
  return d;
}
```

**New today/tonight branch** — first pattern in `parseFutureDate()`:

```typescript
if (/\btoday\b|\btonight\b/.test(t)) {
  const d = new Date(now);
  if (/\btonight\b/.test(t) && !parseTime(t)) {
    d.setHours(20, 0, 0, 0); // "tonight" with no explicit time → 8 PM semantic default
  } else {
    applyTime(d, t);          // explicit time or "today" → use parsed time or 9 AM
  }
  if (d > now) return d;      // past times on today/tonight return null — caller must handle
  return null;
}
```

All existing branches replaced their `d.setHours(9, 0, 0, 0)` with `applyTime(d, t)`. Adding this single extension point means all branches benefit automatically from any future time-format additions to `parseTime()` — never re-add bare `setHours()` calls in individual date branches.

## Why This Works

| Input | Current time | Result |
|-------|-------------|--------|
| `tonight` (no explicit time) | 7 PM | 8 PM same day (semantic default) |
| `tonight` (no explicit time) | 9 PM | `null` — 8 PM default is already past |
| `tonight at 9pm` | any | 9 PM same day |
| `today at 6pm` | 5 PM | 6 PM same day |
| `today at 6pm` | 7 PM | `null` — past time rejected |
| `tomorrow at 6:30 am` | any | next day, 6:30 AM |
| `next Monday at 14:00` | any | next Monday, 2:00 PM |
| `12pm` / `12am` | any | noon / midnight (correctly handled) |

Separating date calculation from time application means every date branch benefits automatically once wired to `applyTime()`. Previously each branch handled time independently — and none did.

## Prevention

- **Unit tests per branch × time-present/absent**: every `parseFutureDate` branch should be tested with and without a time component. Silent `null` returns are invisible without tests since no exception is thrown.
- **Document the "tonight" default**: `tonight` with no explicit time resolves to 8 PM — a semantic convention, not a technical constraint. The JSDoc on `parseFutureDate` should document this so future contributors do not remove the special case assuming it is a bug.
- **Single time-parsing path**: all time parsing runs through `parseTime()`. Extend only this function when adding new time formats; never re-add `setHours()` calls in individual date branches.
- **`nextWeekday` cleanup**: the private `nextWeekday()` helper still contains a now-redundant `d.setHours(9, 0, 0, 0)` that `applyTime()` immediately overwrites in the calling branch. Remove it to avoid misleading future readers.

## Related Issues

- Fix applied in commit `a324119`: `fix: add today/tonight support and time parsing to reminder date parser`
- Source file: `src/utils/date.ts` — `parseFutureDate()`, `parseTime()`, `applyTime()`
