/**
 * Fatigue / burnout risk — computed entirely on-process.
 * Never delegated to an external model. Never reads handover notes or PHI.
 */

import type { FatigueFlags } from "@/lib/shiftii/types";
import { addDays, hourInZone, paidHours, restHours, windowFromStartHour } from "@/lib/shiftii/time";

export type FatigueShift = {
  date: string;
  startAt: string;
  endAt: string;
  breakMinutes: number;
};

export function computeFatigue(opts: {
  asOfDate: string;
  timezone: string;
  minRestHours: number;
  shifts: FatigueShift[];
}): { score: number; flags: FatigueFlags } {
  const from7 = addDays(opts.asOfDate, -6);
  const from14 = addDays(opts.asOfDate, -13);
  const in7 = opts.shifts.filter((s) => s.date >= from7 && s.date <= opts.asOfDate);
  const in14 = opts.shifts.filter((s) => s.date >= from14 && s.date <= opts.asOfDate);

  const hours7d = round1(in7.reduce((n, s) => n + paidHours(s.startAt, s.endAt, s.breakMinutes), 0));
  const hours14d = round1(in14.reduce((n, s) => n + paidHours(s.startAt, s.endAt, s.breakMinutes), 0));

  const nights7 = in7.filter(
    (s) => windowFromStartHour(hourInZone(s.startAt, opts.timezone)) === "NIGHT",
  );
  const nights7d = nights7.length;

  const nightDates = new Set(
    opts.shifts
      .filter((s) => windowFromStartHour(hourInZone(s.startAt, opts.timezone)) === "NIGHT")
      .map((s) => s.date),
  );
  let consecutiveNights = 0;
  let cursor = opts.asOfDate;
  while (nightDates.has(cursor)) {
    consecutiveNights += 1;
    cursor = addDays(cursor, -1);
  }

  const workDates = new Set(opts.shifts.map((s) => s.date));
  let consecutiveDays = 0;
  cursor = opts.asOfDate;
  while (workDates.has(cursor)) {
    consecutiveDays += 1;
    cursor = addDays(cursor, -1);
  }

  const ordered = [...opts.shifts].sort((a, b) => a.startAt.localeCompare(b.startAt));
  let restViolations = 0;
  for (let i = 1; i < ordered.length; i += 1) {
    const gap = restHours(ordered[i - 1].endAt, ordered[i].startAt);
    if (gap >= 0 && gap < opts.minRestHours) restViolations += 1;
  }

  // Weighted 0–100. Tuned so a normal 36h week with mixed days sits ~20–35,
  // 3 consecutive nights + 48h week sits ~65–80, 4 nights + rest violations ~90+.
  let score = 0;
  score += clamp((hours7d - 36) * 1.6, 0, 28);
  score += clamp((hours14d - 72) * 0.7, 0, 14);
  score += consecutiveNights * 9;
  score += Math.max(0, nights7d - 2) * 6;
  score += Math.max(0, consecutiveDays - 4) * 5;
  score += restViolations * 12;
  score = Math.round(clamp(score, 0, 100));

  return {
    score,
    flags: {
      consecutiveNights,
      consecutiveDays,
      restViolations,
      hours7d,
      hours14d,
      nights7d,
    },
  };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
