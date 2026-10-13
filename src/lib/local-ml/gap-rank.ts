/**
 * Rank fill candidates for a coverage gap. Local scoring only.
 * Names stay here; the AI layer receives index+stats, never identities.
 */

import type { FillCandidate, StaffPreferences } from "@/lib/shiftii/types";
import { checkAssignment, consecutiveNightsEnding } from "./constraints";
import type { ConstraintInput } from "./constraints";

export type RankableStaff = {
  membershipId: string;
  displayName: string;
  preferences: StaffPreferences;
  constraint: ConstraintInput;
  hours7d: number;
  hoursDeltaFromMedian: number;
  preferUnit: boolean;
};

export function rankFillCandidates(staff: RankableStaff[]): FillCandidate[] {
  const scored = staff.map((s) => {
    const check = checkAssignment(s.constraint);
    const restOk = !check.violations.some((v) => v.toLowerCase().includes("rest"));
    const credentialOk = s.constraint.credentialOk;
    const nights = consecutiveNightsEnding(
      s.constraint.existingShifts,
      s.constraint.timezone,
      s.constraint.shift.date,
    );
    const fairnessDeficit = -s.hoursDeltaFromMedian;
    let score = 50;
    const reasons: string[] = [];
    const warnings = [...check.warnings];

    if (check.ok) {
      score += 20;
      reasons.push("Passes hard constraints");
    } else {
      score -= 40;
    }
    if (credentialOk) {
      score += 12;
      reasons.push("Credentials current");
    }
    if (restOk) {
      score += 10;
    } else {
      score -= 15;
    }
    if (fairnessDeficit > 4) {
      score += 14;
      reasons.push(`Under peer median by ${fairnessDeficit.toFixed(1)}h`);
    } else if (fairnessDeficit < -4) {
      score -= 10;
      warnings.push("Already above peer median hours");
    }
    if (s.preferUnit) {
      score += 8;
      reasons.push("Preferred unit");
    }
    if (s.hours7d > 48) {
      score -= 12;
      warnings.push("High hours in last 7 days");
    }
    if (nights >= 3) {
      score -= 10;
      warnings.push(`${nights} consecutive nights`);
    }

    return {
      membershipId: s.membershipId,
      displayName: s.displayName,
      score: Math.round(score),
      reasons,
      warnings,
      eligible: check.ok,
      hours7d: s.hours7d,
      consecutiveNights: nights,
      credentialOk,
      restOk,
      fairnessDeficit,
    } satisfies FillCandidate;
  });

  return scored.sort((a, b) => {
    if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
    return b.score - a.score;
  });
}
