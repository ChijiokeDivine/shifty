/**
 * Natural-language preference parser. Runs locally (no network).
 * Interprets phrases like "I can't do nights next week" into structured
 * availability exceptions / preference flags.
 */

import { addDays, dateInZone, weekdayIso } from "@/lib/shiftii/time";
import type { StaffPreferences } from "@/lib/shiftii/types";

export type ParsedPreference = {
  preferencesPatch: StaffPreferences;
  exceptions: Array<{
    date: string;
    isAvailable: boolean;
    startMinute: number | null;
    endMinute: number | null;
    reason: string;
  }>;
  summary: string;
  understood: boolean;
};

const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const DAY_SHORT: Record<string, number> = {
  sun: 0, sunday: 0,
  mon: 1, monday: 1,
  tue: 2, tues: 2, tuesday: 2,
  wed: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6,
};

export function parsePreferenceText(text: string, opts: {
  today: string;
  timezone: string;
}): ParsedPreference {
  const raw = text.trim();
  const t = raw.toLowerCase();
  if (!raw) {
    return { preferencesPatch: {}, exceptions: [], summary: "Empty input.", understood: false };
  }

  const preferencesPatch: StaffPreferences = {};
  const exceptions: ParsedPreference["exceptions"] = [];
  const bits: string[] = [];

  const nights = /\b(nights?|night shift|noc)\b/.test(t);
  const days = /\b(days?|day shift)\b/.test(t);
  const evenings = /\bevenings?\b/.test(t);
  const negated = /\b(can'?t|cannot|unavailable|off|no|don't|dont|not)\b/.test(t);
  const prefer = /\b(prefer|rather|like)\b/.test(t);

  if (nights && negated && !prefer) {
    preferencesPatch.noNights = true;
    bits.push("Marked no-nights preference");
  } else if (nights && prefer) {
    preferencesPatch.preferNights = true;
    bits.push("Prefers nights");
  } else if (days && prefer) {
    preferencesPatch.preferDays = true;
    bits.push("Prefers days");
  }

  const dates = resolveDates(t, opts.today);

  let startMinute: number | null = null;
  let endMinute: number | null = null;
  if (nights) {
    startMinute = 19 * 60;
    endMinute = 7 * 60;
  } else if (evenings) {
    startMinute = 15 * 60;
    endMinute = 23 * 60;
  } else if (days) {
    startMinute = 7 * 60;
    endMinute = 19 * 60;
  }

  if (dates.length && negated) {
    for (const date of dates) {
      exceptions.push({
        date,
        isAvailable: false,
        startMinute: startMinute,
        endMinute: endMinute,
        reason: raw.slice(0, 180),
      });
    }
    bits.push(`Blocked ${dates.length} date(s)${nights ? " (night window)" : ""}`);
  } else if (dates.length && !negated && !prefer) {
    for (const date of dates) {
      exceptions.push({
        date,
        isAvailable: true,
        startMinute,
        endMinute,
        reason: raw.slice(0, 180),
      });
    }
    bits.push(`Opened ${dates.length} date(s)`);
  }

  const understood = bits.length > 0;
  return {
    preferencesPatch,
    exceptions,
    summary: understood ? bits.join(". ") + "." : "Could not parse a concrete availability change.",
    understood,
  };
}

function resolveDates(t: string, today: string): string[] {
  if (/\bnext week\b/.test(t)) {
    const start = nextMonday(today);
    return range(start, 7);
  }
  if (/\bthis weekend\b/.test(t)) {
    const dow = weekdayIso(today);
    const sat = addDays(today, (6 - dow + 7) % 7);
    return [sat, addDays(sat, 1)];
  }
  if (/\bthis week\b/.test(t)) {
    const dow = weekdayIso(today);
    const monday = addDays(today, dow === 0 ? -6 : 1 - dow);
    return range(monday, 7).filter((d) => d >= today);
  }
  if (/\btomorrow\b/.test(t)) return [addDays(today, 1)];
  if (/\btoday\b/.test(t)) return [today];

  const found: string[] = [];
  for (const [name, dow] of Object.entries(DAY_SHORT)) {
    const re = new RegExp(`\\b${name}\\b`);
    if (re.test(t)) {
      const delta = (dow - weekdayIso(today) + 7) % 7;
      const date = addDays(today, delta === 0 ? 7 : delta);
      if (!found.includes(date)) found.push(date);
    }
  }
  void DAY_NAMES;
  void dateInZone;
  return found;
}

function nextMonday(today: string): string {
  const dow = weekdayIso(today);
  const delta = dow === 0 ? 1 : 8 - dow;
  return addDays(today, delta);
}

function range(start: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => addDays(start, i));
}
