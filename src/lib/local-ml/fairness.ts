/**
 * Fairness scoring over a rolling window — hours, nights, weekends.
 * Pure local arithmetic.
 */

import type { FairnessRow, StaffPreferences } from "@/lib/shiftii/types";
import { hourInZone, isWeekend, paidHours, windowFromStartHour } from "@/lib/shiftii/time";

export type FairnessShift = {
  membershipId: string;
  date: string;
  startAt: string;
  endAt: string;
  breakMinutes: number;
  unitType: string | null;
};

export type FairnessStaff = {
  membershipId: string;
  displayName: string;
  role: string;
  preferences: StaffPreferences;
  openClaims: number;
};

export function computeFairness(opts: {
  timezone: string;
  staff: FairnessStaff[];
  shifts: FairnessShift[];
}): FairnessRow[] {
  const grouped = new Map<string, FairnessShift[]>();
  for (const s of opts.shifts) {
    const arr = grouped.get(s.membershipId) ?? [];
    arr.push(s);
    grouped.set(s.membershipId, arr);
  }

  const rows: Omit<FairnessRow, "hoursDeltaFromMedian">[] = opts.staff.map((st) => {
    const mine = grouped.get(st.membershipId) ?? [];
    const hours = round1(mine.reduce((n, s) => n + paidHours(s.startAt, s.endAt, s.breakMinutes), 0));
    const nights = mine.filter(
      (s) => windowFromStartHour(hourInZone(s.startAt, opts.timezone)) === "NIGHT",
    ).length;
    const weekends = mine.filter((s) => isWeekend(s.date)).length;
    let hits = 0;
    let considered = 0;
    for (const s of mine) {
      const win = windowFromStartHour(hourInZone(s.startAt, opts.timezone));
      const pref = st.preferences;
      if (pref.preferDays || pref.preferNights || pref.preferredUnitTypes?.length) {
        considered += 1;
        const dayHit = pref.preferDays ? win === "DAY" : true;
        const nightHit = pref.preferNights ? win === "NIGHT" : true;
        const unitHit = pref.preferredUnitTypes?.length
          ? pref.preferredUnitTypes.includes(s.unitType ?? "")
          : true;
        if (dayHit && nightHit && unitHit) hits += 1;
      }
    }
    return {
      membershipId: st.membershipId,
      displayName: st.displayName,
      role: st.role,
      hours,
      nights,
      weekends,
      openClaims: st.openClaims,
      preferenceHitRate: considered ? Math.round((hits / considered) * 100) / 100 : 1,
    };
  });

  const hours = [...rows.map((r) => r.hours)].sort((a, b) => a - b);
  const median = hours.length ? hours[Math.floor(hours.length / 2)] : 0;
  return rows
    .map((r) => ({ ...r, hoursDeltaFromMedian: round1(r.hours - median) }))
    .sort((a, b) => a.hours - b.hours);
}

export function fairnessDeficit(row: Pick<FairnessRow, "hoursDeltaFromMedian">): number {
  // Positive deficit = under-used (good candidate for the next assignment).
  // Negative = over-used.
  return -row.hoursDeltaFromMedian;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
