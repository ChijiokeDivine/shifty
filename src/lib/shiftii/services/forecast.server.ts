import { forecastHeadcount } from "@/lib/local-ml/forecast";
import { rankFillCandidates, type RankableStaff } from "@/lib/local-ml/gap-rank";
import { completeJsonPrompt } from "@/lib/ai/client";
import { toSafeGapPayload } from "@/lib/ai/sanitize";
import { nid } from "../ids";
import { dateStr, iso, num, q, str } from "../db.server";
import { addDays, dateInZone, dateRange, hourInZone, windowFromStartHour } from "../time";
import { listLocations } from "./staff.server";
import { loadConstraintInput } from "../eligibility.server";
import { fairnessReport } from "./wellbeing.server";
import { assertManager } from "../context.server";
import { assignShift } from "./shifts.server";
import { audit } from "../audit.server";
import type {
  AiExplainResult,
  CoverageGap,
  FillCandidate,
  ForecastPoint,
  SessionContext,
  ShiftWindow,
} from "../types";

export async function forecastRange(
  ctx: SessionContext,
  input: { from?: string; to?: string; locationId?: string },
): Promise<ForecastPoint[]> {
  const today = dateInZone(new Date(), ctx.organization.timezone);
  const from = input.from ?? today;
  const to = input.to ?? addDays(today, 7);
  const locations = (await listLocations(ctx)).filter(
    (l) => !input.locationId || l.id === input.locationId,
  );
  const history = await q<Record<string, unknown>>(
    `select location_id, date, shift_window, patient_count, average_acuity
       from unit_census_snapshots
      where organization_id = $1 and date >= $2 and date <= $3`,
    [ctx.organization.id, addDays(from, -28), from],
  );
  const assigned = await q<Record<string, unknown>>(
    `select location_id, date, start_at, position_id
       from shifts
      where organization_id = $1 and status = 'ASSIGNED' and date >= $2 and date <= $3`,
    [ctx.organization.id, from, to],
  );

  const points: ForecastPoint[] = [];
  for (const loc of locations) {
    const baseline =
      loc.unitType === "ICU" || loc.unitType === "ED" ? 3 : loc.unitType === "PACU" ? 2 : 2;
    for (const date of dateRange(from, to)) {
      for (const window of ["DAY", "NIGHT"] as const) {
        const hist = history
          .filter((h) => str(h.location_id) === loc.id && str(h.shift_window) === window)
          .map((h) => ({
            date: dateStr(h.date),
            locationId: str(h.location_id),
            shiftWindow: str(h.shift_window),
            patientCount: num(h.patient_count),
            averageAcuity: h.average_acuity == null ? null : num(h.average_acuity),
          }));
        const fc = forecastHeadcount({
          date,
          locationId: loc.id,
          shiftWindow: window,
          history: hist,
          baselineHeadcount: window === "NIGHT" ? Math.max(1, baseline - 1) : baseline,
        });
        const assignedCount = assigned.filter((s) => {
          if (str(s.location_id) !== loc.id || dateStr(s.date) !== date) return false;
          return windowFromStartHour(hourInZone(iso(s.start_at), ctx.organization.timezone)) === window;
        }).length;
        const latest = hist.sort((a, b) => b.date.localeCompare(a.date))[0];
        points.push({
          date,
          locationId: loc.id,
          locationName: loc.name,
          shiftWindow: window,
          predictedHeadcount: fc.predictedHeadcount,
          assignedHeadcount: assignedCount,
          censusPatientCount: latest?.patientCount ?? fc.expectedPatients ?? null,
          acuity: latest?.averageAcuity ?? fc.expectedAcuity,
        });
      }
    }
  }
  return points;
}

export async function detectGaps(
  ctx: SessionContext,
  input: { from?: string; to?: string } = {},
): Promise<CoverageGap[]> {
  const today = dateInZone(new Date(), ctx.organization.timezone);
  const from = input.from ?? today;
  const to = input.to ?? addDays(today, 7);
  const forecast = await forecastRange(ctx, { from, to });
  const open = await q<Record<string, unknown>>(
    `select s.id, s.location_id, s.date, s.start_at, s.position_id, p.name as position_name,
            l.name as location_name, l.unit_type
       from shifts s
       join positions p on p.id = s.position_id
       join locations l on l.id = s.location_id
      where s.organization_id = $1 and s.date >= $2 and s.date <= $3
        and s.employee_id is null and s.status <> 'CANCELLED'`,
    [ctx.organization.id, from, to],
  );
  const gaps: CoverageGap[] = [];
  for (const pt of forecast) {
    const shortfall = Math.max(0, pt.predictedHeadcount - pt.assignedHeadcount);
    const matchingOpen = open.filter((s) => {
      if (str(s.location_id) !== pt.locationId || dateStr(s.date) !== pt.date) return false;
      return windowFromStartHour(hourInZone(iso(s.start_at), ctx.organization.timezone)) === pt.shiftWindow;
    });
    if (shortfall <= 0 && matchingOpen.length === 0) continue;
    const pos = matchingOpen[0];
    gaps.push({
      id: `gap:${pt.locationId}:${pt.date}:${pt.shiftWindow}`,
      date: pt.date,
      locationId: pt.locationId,
      locationName: pt.locationName,
      unitType: pos ? (pos.unit_type ? str(pos.unit_type) : null) : null,
      positionId: pos ? str(pos.position_id) : "",
      positionName: pos ? str(pos.position_name) : "RN",
      shiftWindow: pt.shiftWindow,
      needed: pt.predictedHeadcount,
      assigned: pt.assignedHeadcount,
      shortfall: Math.max(shortfall, matchingOpen.length),
      openShiftIds: matchingOpen.map((s) => str(s.id)),
    });
  }
  return gaps.sort((a, b) => b.shortfall - a.shortfall || a.date.localeCompare(b.date));
}

export async function suggestFills(
  ctx: SessionContext,
  input: { gapId?: string; shiftId?: string },
): Promise<{
  gap: CoverageGap | null;
  shiftId: string | null;
  candidates: FillCandidate[];
  explanation: AiExplainResult;
}> {
  const gaps = await detectGaps(ctx, {});
  const gap =
    (input.gapId ? gaps.find((g) => g.id === input.gapId) : null) ??
    gaps.find((g) => (input.shiftId ? g.openShiftIds.includes(input.shiftId) : g.openShiftIds.length > 0)) ??
    gaps[0] ??
    null;
  const shiftId = input.shiftId ?? gap?.openShiftIds[0] ?? null;
  if (!shiftId) {
    return {
      gap,
      shiftId: null,
      candidates: [],
      explanation: {
        usedAi: false,
        provider: null,
        model: null,
        text: "No open shift attached to this gap.",
        degraded: true,
      },
    };
  }

  const staff = await q<{ id: string; display_name: string; role: string }>(
    `select id, display_name, role from memberships
      where organization_id = $1 and status = 'ACTIVE'`,
    [ctx.organization.id],
  );
  const fair = await fairnessReport(ctx);
  const fairMap = new Map(fair.map((f) => [f.membershipId, f]));
  const rankable: RankableStaff[] = [];
  for (const st of staff) {
    try {
      const loaded = await loadConstraintInput({ ctx, membershipId: st.id, shiftId });
      const hours7d = loaded.input.existingShifts
        .filter((s) => s.date >= addDays(loaded.input.shift.date, -6) && s.date <= loaded.input.shift.date)
        .reduce((n, s) => n + (new Date(s.endAt).getTime() - new Date(s.startAt).getTime()) / 3600000, 0);
      rankable.push({
        membershipId: st.id,
        displayName: loaded.displayName,
        preferences: loaded.input.candidate.preferences,
        constraint: loaded.input,
        hours7d,
        hoursDeltaFromMedian: fairMap.get(st.id)?.hoursDeltaFromMedian ?? 0,
        preferUnit: Boolean(loaded.input.candidate.preferences.preferredUnitTypes?.length),
      });
    } catch {
      // skip staff that can't be evaluated
    }
  }
  const candidates = rankFillCandidates(rankable).slice(0, 8);

  const explanation = await explainFills(ctx, gap, candidates);
  return { gap, shiftId, candidates, explanation };
}

async function explainFills(
  ctx: SessionContext,
  gap: CoverageGap | null,
  candidates: FillCandidate[],
): Promise<AiExplainResult> {
  const local = localExplanation(candidates);
  if (!ctx.organization.aiFeaturesEnabled) {
    return { usedAi: false, provider: null, model: null, text: local, degraded: true };
  }
  const today = dateInZone(new Date(), ctx.organization.timezone);
  const payload = toSafeGapPayload({
    unitType: gap?.unitType ?? null,
    shiftWindow: gap?.shiftWindow ?? "DAY",
    date: gap?.date ?? today,
    today,
    needed: gap?.needed ?? 0,
    assigned: gap?.assigned ?? 0,
    candidates: candidates.slice(0, 5).map((c, i) => ({
      role: "RN",
      unitType: gap?.unitType ?? null,
      hours7d: c.hours7d,
      consecutiveNights: c.consecutiveNights,
      restOk: c.restOk,
      credentialOk: c.credentialOk,
      fairnessDeficit: c.fairnessDeficit,
      preferenceMatch: c.reasons.some((r) => r.toLowerCase().includes("preferred")),
      eligible: c.eligible,
      score: c.score,
    })),
  });
  const started = Date.now();
  const result = await completeJsonPrompt({
    agentName: "gap-fill-suggester",
    userPrompt:
      "Explain why candidate 0 is the best fill, then mention 1 and 2 as alternatives. Refer to candidates by index only.",
    payload,
  });
  await q(
    `insert into ai_interaction_logs (
       id, organization_id, agent_name, provider, model, prompt_tokens, completion_tokens,
       latency_ms, success, error_code
     ) values ($1,$2,'gap-fill-suggester',$3,$4,$5,$6,$7,$8,$9)`,
    [
      nid("ail"),
      ctx.organization.id,
      result.provider ?? "none",
      result.model ?? "none",
      result.promptTokens,
      result.completionTokens,
      result.latencyMs || Date.now() - started,
      result.ok,
      result.errorCode,
    ],
  );
  if (!result.ok) {
    return { usedAi: false, provider: result.provider, model: result.model, text: local, degraded: true };
  }
  return {
    usedAi: true,
    provider: result.provider,
    model: result.model,
    text: result.text,
    degraded: false,
  };
}

function localExplanation(candidates: FillCandidate[]): string {
  const top = candidates.filter((c) => c.eligible).slice(0, 3);
  if (!top.length) return "No eligible fill — every candidate fails a hard constraint (rest, credentials, overlap, or leave).";
  const lines = top.map((c, i) => {
    const why = c.reasons.slice(0, 2).join("; ") || "viable";
    const warn = c.warnings[0] ? ` Watch: ${c.warnings[0]}.` : "";
    return `${i + 1}. ${c.displayName} (score ${c.score}) — ${why}.${warn}`;
  });
  return `Ranked locally (no data left this hospital): ${lines.join(" ")}`;
}

export async function applyFill(
  ctx: SessionContext,
  input: { shiftId: string; membershipId: string },
) {
  assertManager(ctx);
  const shift = await assignShift(ctx, input);
  await audit({
    ctx,
    action: "GAP_FILL_APPLIED",
    entityType: "shift",
    entityId: input.shiftId,
    after: { membershipId: input.membershipId },
  });
  return shift;
}

export async function forecastNarrative(ctx: SessionContext): Promise<AiExplainResult> {
  const gaps = await detectGaps(ctx, {});
  const top = gaps.slice(0, 5).map((g) => ({
    unitType: g.unitType,
    shiftWindow: g.shiftWindow,
    dateOffsetDays: Math.round(
      (new Date(`${g.date}T12:00:00Z`).getTime() -
        new Date(`${dateInZone(new Date(), ctx.organization.timezone)}T12:00:00Z`).getTime()) /
        86400000,
    ),
    shortfall: g.shortfall,
    needed: g.needed,
    assigned: g.assigned,
  }));
  const local =
    top.length === 0
      ? "Coverage looks full for the next week on current census trajectory."
      : `Local forecast: ${top.length} gap window(s). Worst shortfall is ${top[0].shortfall} on ${top[0].unitType ?? "a unit"} ${top[0].shiftWindow}.`;
  if (!ctx.organization.aiFeaturesEnabled) {
    return { usedAi: false, provider: null, model: null, text: local, degraded: true };
  }
  const result = await completeJsonPrompt({
    agentName: "forecast-narrative",
    userPrompt: "Write a 3-sentence coverage briefing for a charge nurse from these anonymous gap stats.",
    payload: { gaps: top },
  });
  await q(
    `insert into ai_interaction_logs (
       id, organization_id, agent_name, provider, model, prompt_tokens, completion_tokens,
       latency_ms, success, error_code
     ) values ($1,$2,'forecast-narrative',$3,$4,$5,$6,$7,$8,$9)`,
    [
      nid("ail"),
      ctx.organization.id,
      result.provider ?? "none",
      result.model ?? "none",
      result.promptTokens,
      result.completionTokens,
      result.latencyMs,
      result.ok,
      result.errorCode,
    ],
  );
  if (!result.ok) {
    return { usedAi: false, provider: result.provider, model: result.model, text: local, degraded: true };
  }
  return { usedAi: true, provider: result.provider, model: result.model, text: result.text, degraded: false };
}

export type { ShiftWindow };
