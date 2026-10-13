/**
 * Hard-constraint checker. Pure local logic — no network, no AI.
 * Used by assign / claim / swap before any write.
 */

import type { AssignmentCheck, Shift, StaffPreferences } from "@/lib/shiftii/types";
import {
  hoursBetween,
  overlaps,
  paidHours,
  restHours,
  windowFromStartHour,
  hourInZone,
  addDays,
} from "@/lib/shiftii/time";

export type ConstraintInput = {
  timezone: string;
  minRestHours: number;
  maxWeeklyHours: number | null;
  shift: Pick<Shift, "id" | "date" | "startAt" | "endAt" | "breakMinutes" | "locationId" | "positionId">;
  candidate: {
    membershipId: string;
    status: string;
    positionIds: string[];
    locationIds: string[];
    preferences: StaffPreferences;
  };
  existingShifts: Array<{
    id: string;
    startAt: string;
    endAt: string;
    date: string;
    breakMinutes: number;
  }>;
  leave: Array<{ startDate: string; endDate: string }>;
  availabilityBlocked: boolean;
  credentialOk: boolean;
  missingCredentials: string[];
};

export function checkAssignment(input: ConstraintInput): AssignmentCheck {
  const violations: string[] = [];
  const warnings: string[] = [];

  if (input.candidate.status !== "ACTIVE") {
    violations.push("Staff member is not active.");
  }
  if (!input.candidate.positionIds.includes(input.shift.positionId)) {
    violations.push("Staff is not eligible for this position.");
  }
  if (!input.candidate.locationIds.includes(input.shift.locationId)) {
    violations.push("Staff is not rostered to this unit.");
  }
  if (!input.credentialOk) {
    const list = input.missingCredentials.length
      ? ` Missing: ${input.missingCredentials.join(", ")}.`
      : "";
    violations.push(`Required credentials are missing or expired.${list}`);
  }
  if (input.availabilityBlocked) {
    violations.push("Staff marked unavailable for this window.");
  }

  for (const lv of input.leave) {
    if (input.shift.date >= lv.startDate && input.shift.date <= lv.endDate) {
      violations.push("Staff is on approved leave for this date.");
      break;
    }
  }

  for (const other of input.existingShifts) {
    if (other.id === input.shift.id) continue;
    if (overlaps(input.shift.startAt, input.shift.endAt, other.startAt, other.endAt)) {
      violations.push("Overlaps an already assigned shift.");
      break;
    }
  }

  const neighbors = input.existingShifts
    .filter((s) => s.id !== input.shift.id)
    .sort((a, b) => a.startAt.localeCompare(b.startAt));

  for (const other of neighbors) {
    if (other.endAt <= input.shift.startAt) {
      const rest = restHours(other.endAt, input.shift.startAt);
      if (rest < input.minRestHours) {
        violations.push(
          `Only ${rest.toFixed(1)}h rest after previous shift (min ${input.minRestHours}h).`,
        );
      }
    }
    if (other.startAt >= input.shift.endAt) {
      const rest = restHours(input.shift.endAt, other.startAt);
      if (rest < input.minRestHours) {
        violations.push(
          `Only ${rest.toFixed(1)}h rest before next shift (min ${input.minRestHours}h).`,
        );
      }
    }
  }

  const weekStart = weekContaining(input.shift.date);
  const weekEnd = addDays(weekStart, 6);
  const hoursThisWeek = input.existingShifts
    .filter((s) => s.date >= weekStart && s.date <= weekEnd && s.id !== input.shift.id)
    .reduce((sum, s) => sum + paidHours(s.startAt, s.endAt, s.breakMinutes), 0);
  const add = paidHours(input.shift.startAt, input.shift.endAt, input.shift.breakMinutes);
  if (input.maxWeeklyHours != null && hoursThisWeek + add > input.maxWeeklyHours + 0.05) {
    violations.push(
      `Would exceed max weekly hours (${(hoursThisWeek + add).toFixed(1)}h / ${input.maxWeeklyHours}h).`,
    );
  } else if (input.maxWeeklyHours != null && hoursThisWeek + add > input.maxWeeklyHours - 4) {
    warnings.push("Near weekly hour cap.");
  }

  const pref = input.candidate.preferences;
  const hour = hourInZone(input.shift.startAt, input.timezone);
  const win = windowFromStartHour(hour);
  if (pref.noNights && win === "NIGHT") {
    violations.push("Staff preference: no night shifts.");
  }
  if (pref.preferDays && win === "NIGHT") {
    warnings.push("Prefers days; this is a night shift.");
  }
  if (pref.preferNights && win === "DAY") {
    warnings.push("Prefers nights; this is a day shift.");
  }

  return { ok: violations.length === 0, violations, warnings };
}

function weekContaining(isoDate: string): string {
  // Monday-start week, matching org default week_start_day=1.
  const d = new Date(`${isoDate}T12:00:00Z`);
  const dow = d.getUTCDay(); // 0 Sun
  const delta = dow === 0 ? -6 : 1 - dow;
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export function consecutiveNightsEnding(
  shifts: Array<{ startAt: string; date: string }>,
  timezone: string,
  asOfDate: string,
): number {
  const nightDates = new Set(
    shifts
      .filter((s) => windowFromStartHour(hourInZone(s.startAt, timezone)) === "NIGHT")
      .map((s) => s.date),
  );
  let count = 0;
  let cursor = asOfDate;
  while (nightDates.has(cursor)) {
    count += 1;
    cursor = addDays(cursor, -1);
  }
  return count;
}

export { hoursBetween };
