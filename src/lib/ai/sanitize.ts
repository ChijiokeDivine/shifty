/**
 * Compliance gate for every outbound AI payload.
 *
 * Forbidden in any payload that leaves this process:
 *  - patient names, MRNs, room numbers, diagnoses
 *  - handover free-text notes
 *  - raw employee PII (email, phone, full license numbers)
 *  - staff display names (use opaque candidate indices instead)
 *
 * Sensitive analysis (fatigue, forecast, credential expiry, constraint
 * checks) is implemented in lib/local-ml and must never be reimplemented
 * here as a prompt.
 *
 * This module has NO function capable of reading HandoverNote.freeTextNote.
 */

const BANNED_KEY = /(mrn|patient|diagnos|ssn|free_?text|freetext|email|phone|license|password|note)\b/i;
const BANNED_VALUE =
  /\b(mrn|ssn|dob|date of birth|patient|diagnos|room\s?\d|#\d{5,}|license\s?(no|number))\b/i;

export type AiSafeCandidate = {
  idx: number;
  role: string;
  unitType: string | null;
  hours7d: number;
  consecutiveNights: number;
  restOk: boolean;
  credentialOk: boolean;
  fairnessDeficit: number;
  preferenceMatch: boolean;
  eligible: boolean;
  score: number;
};

export type AiSafeGap = {
  unitType: string | null;
  shiftWindow: string;
  dateOffsetDays: number;
  needed: number;
  assigned: number;
  shortfall: number;
  candidates: AiSafeCandidate[];
};

export type AiSafeFairness = {
  role: string;
  hoursDeltaFromMedian: number;
  nights: number;
  weekends: number;
  preferenceHitRate: number;
};

export class SanitizeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SanitizeError";
  }
}

export function assertSafePayload(payload: unknown, path = "root"): void {
  if (payload === null || payload === undefined) return;
  if (typeof payload === "string") {
    if (BANNED_VALUE.test(payload)) {
      throw new SanitizeError(`Refusing to send sensitive string at ${path}`);
    }
    return;
  }
  if (typeof payload !== "object") return;
  if (Array.isArray(payload)) {
    payload.forEach((item, i) => assertSafePayload(item, `${path}[${i}]`));
    return;
  }
  for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
    if (BANNED_KEY.test(key)) {
      throw new SanitizeError(`Refusing to send sensitive field '${key}' at ${path}`);
    }
    if (/(name|displayName|authorName|employeeName|membershipName)/i.test(key)) {
      throw new SanitizeError(`Refusing to send identity field '${key}' at ${path}`);
    }
    assertSafePayload(value, `${path}.${key}`);
  }
}

export function toSafeGapPayload(input: {
  unitType: string | null;
  shiftWindow: string;
  date: string;
  today: string;
  needed: number;
  assigned: number;
  candidates: Array<{
    role: string;
    unitType: string | null;
    hours7d: number;
    consecutiveNights: number;
    restOk: boolean;
    credentialOk: boolean;
    fairnessDeficit: number;
    preferenceMatch: boolean;
    eligible: boolean;
    score: number;
  }>;
}): AiSafeGap {
  const dateOffsetDays = Math.round(
    (new Date(`${input.date}T12:00:00Z`).getTime() -
      new Date(`${input.today}T12:00:00Z`).getTime()) /
      86400000,
  );
  const payload: AiSafeGap = {
    unitType: input.unitType,
    shiftWindow: input.shiftWindow,
    dateOffsetDays,
    needed: input.needed,
    assigned: input.assigned,
    shortfall: Math.max(0, input.needed - input.assigned),
    candidates: input.candidates.slice(0, 5).map((c, idx) => ({
      idx,
      role: c.role,
      unitType: c.unitType,
      hours7d: round1(c.hours7d),
      consecutiveNights: c.consecutiveNights,
      restOk: c.restOk,
      credentialOk: c.credentialOk,
      fairnessDeficit: round1(c.fairnessDeficit),
      preferenceMatch: c.preferenceMatch,
      eligible: c.eligible,
      score: c.score,
    })),
  };
  assertSafePayload(payload);
  return payload;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
