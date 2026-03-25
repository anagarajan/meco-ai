export function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatLongDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

const MONTHS: Record<string, number> = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

const WEEKDAYS: Record<string, number> = {
  sunday: 0, sun: 0,
  monday: 1, mon: 1,
  tuesday: 2, tue: 2,
  wednesday: 3, wed: 3,
  thursday: 4, thu: 4,
  friday: 5, fri: 5,
  saturday: 6, sat: 6,
};

function nextWeekday(day: number): Date {
  const now = new Date();
  const d = new Date(now);
  const diff = ((day - now.getDay()) + 7) % 7 || 7;
  d.setDate(now.getDate() + diff);
  d.setHours(9, 0, 0, 0);
  return d;
}

/**
 * Attempts to parse a future date from free-form text.
 * Returns null if no recognisable future date is found.
 */
export function parseFutureDate(text: string): Date | null {
  const t = text.toLowerCase();
  const now = new Date();

  // "tomorrow"
  if (/\btomorrow\b/.test(t)) {
    const d = new Date(now);
    d.setDate(now.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    return d;
  }

  // "next week"
  if (/\bnext\s+week\b/.test(t)) {
    const d = new Date(now);
    d.setDate(now.getDate() + 7);
    d.setHours(9, 0, 0, 0);
    return d;
  }

  // "in N days" / "in N weeks"
  const inDaysMatch = /\bin\s+(\d+)\s+days?\b/.exec(t);
  if (inDaysMatch) {
    const d = new Date(now);
    d.setDate(now.getDate() + parseInt(inDaysMatch[1], 10));
    d.setHours(9, 0, 0, 0);
    return d;
  }
  const inWeeksMatch = /\bin\s+(\d+)\s+weeks?\b/.exec(t);
  if (inWeeksMatch) {
    const d = new Date(now);
    d.setDate(now.getDate() + parseInt(inWeeksMatch[1], 10) * 7);
    d.setHours(9, 0, 0, 0);
    return d;
  }

  // "next Monday/Tuesday/…"
  const nextDayMatch = /\bnext\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b/.exec(t);
  if (nextDayMatch) {
    const dayNum = WEEKDAYS[nextDayMatch[1]];
    if (dayNum !== undefined) return nextWeekday(dayNum);
  }

  // "April 20" / "Apr 20" / "April 20, 2026" / "April 20 2026" with optional "at Hpm"
  const namedMonthMatch =
    /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s*(\d{4})?\b/.exec(t);
  if (namedMonthMatch) {
    const month = MONTHS[namedMonthMatch[1]];
    const day = parseInt(namedMonthMatch[2], 10);
    let year = namedMonthMatch[3] ? parseInt(namedMonthMatch[3], 10) : now.getFullYear();
    const d = new Date(year, month, day, 9, 0, 0, 0);
    // if date has already passed this year, try next year
    if (d <= now && !namedMonthMatch[3]) {
      d.setFullYear(year + 1);
    }
    if (d > now) return d;
  }

  // "MM/DD" or "MM/DD/YYYY"
  const numericMatch = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/.exec(t);
  if (numericMatch) {
    const month = parseInt(numericMatch[1], 10) - 1;
    const day = parseInt(numericMatch[2], 10);
    let year = numericMatch[3] ? parseInt(numericMatch[3], 10) : now.getFullYear();
    if (year < 100) year += 2000;
    const d = new Date(year, month, day, 9, 0, 0, 0);
    if (d <= now && !numericMatch[3]) d.setFullYear(year + 1);
    if (d > now) return d;
  }

  return null;
}
