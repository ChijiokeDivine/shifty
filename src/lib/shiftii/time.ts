/** Time helpers that work in org-local timezones without extra deps. */

export type ShiftWindow = "DAY" | "EVENING" | "NIGHT";

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function partsInZone(ms: number, timeZone: string) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const bag: Record<string, string> = {};
  for (const p of dtf.formatToParts(new Date(ms))) {
    if (p.type !== "literal") bag[p.type] = p.value;
  }
  const hour = bag.hour === "24" ? 0 : Number(bag.hour);
  return {
    year: Number(bag.year),
    month: Number(bag.month),
    day: Number(bag.day),
    hour,
    minute: Number(bag.minute),
    second: Number(bag.second),
  };
}

/** YYYY-MM-DD in the given IANA timezone. */
export function dateInZone(now: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function weekdayIso(isoDate: string): number {
  // 0=Sun .. 6=Sat, using the calendar date itself (noon UTC avoids DST edges).
  return new Date(`${isoDate}T12:00:00Z`).getUTCDay();
}

/** Wall-clock in `timeZone` → UTC ISO string. DST-safe. */
export function zonedIso(
  isoDate: string,
  hour: number,
  minute: number,
  timeZone: string,
): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const utcGuess = Date.UTC(y, m - 1, d, hour, minute, 0);
  const p = partsInZone(utcGuess, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return new Date(utcGuess + (utcGuess - asUtc)).toISOString();
}

export function minutesBetween(startIso: string, endIso: string): number {
  return Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000);
}

export function hoursBetween(startIso: string, endIso: string): number {
  return minutesBetween(startIso, endIso) / 60;
}

export function windowFromStartHour(hour: number): ShiftWindow {
  if (hour >= 6 && hour < 14) return "DAY";
  if (hour >= 14 && hour < 18) return "EVENING";
  return "NIGHT";
}

export function windowHours(window: ShiftWindow): { start: number; end: number } {
  if (window === "DAY") return { start: 7, end: 19 };
  if (window === "EVENING") return { start: 15, end: 23 };
  return { start: 19, end: 7 };
}

export function isWeekend(isoDate: string): boolean {
  const d = weekdayIso(isoDate);
  return d === 0 || d === 6;
}

export function paidHours(startIso: string, endIso: string, breakMinutes: number): number {
  return Math.max(0, (minutesBetween(startIso, endIso) - breakMinutes) / 60);
}

export function overlaps(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return new Date(aStart) < new Date(bEnd) && new Date(bStart) < new Date(aEnd);
}

export function restHours(prevEndIso: string, nextStartIso: string): number {
  return hoursBetween(prevEndIso, nextStartIso);
}

export function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  let cur = from;
  while (cur <= to) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

export function hourInZone(iso: string, timeZone: string): number {
  return partsInZone(new Date(iso).getTime(), timeZone).hour;
}

export function formatRangeLabel(startIso: string, endIso: string, timeZone: string): string {
  const a = partsInZone(new Date(startIso).getTime(), timeZone);
  const b = partsInZone(new Date(endIso).getTime(), timeZone);
  const fmt = (h: number, m: number) => {
    const suffix = h >= 12 ? "p" : "a";
    const hr = h % 12 === 0 ? 12 : h % 12;
    return m === 0 ? `${hr}${suffix}` : `${hr}:${pad(m)}${suffix}`;
  };
  return `${fmt(a.hour, a.minute)}–${fmt(b.hour, b.minute)}`;
}
