"use server";

import { requireAuthedUserId } from "@/lib/auth/middleware";
import { withOrg } from "./_run";

export async function listGaps(input: { from?: string; to?: string }) {
  const data = input ?? {};
  const userId = await requireAuthedUserId();
  return withOrg(userId, async (ctx) => {
      const { detectGaps } = await import("@/lib/shiftii/services/forecast.server");
      return detectGaps(ctx, data ?? {});
    });
}

export async function forecastDemand(input: { from?: string; to?: string; locationId?: string }) {
  const data = input ?? {};
  const userId = await requireAuthedUserId();
  return withOrg(userId, async (ctx) => {
      const { forecastRange } = await import("@/lib/shiftii/services/forecast.server");
      return forecastRange(ctx, data ?? {});
    });
}

export async function suggestGapFills(input: { gapId?: string; shiftId?: string }) {
  const data = input ?? {};
  const userId = await requireAuthedUserId();
  return withOrg(userId, async (ctx) => {
      const { suggestFills } = await import("@/lib/shiftii/services/forecast.server");
      return suggestFills(ctx, data ?? {});
    });
}

export async function applyGapFill(input: { shiftId: string; membershipId: string }) {
  const data = input;
  const userId = await requireAuthedUserId();
  return withOrg(userId, async (ctx) => {
      const { applyFill } = await import("@/lib/shiftii/services/forecast.server");
      return applyFill(ctx, data);
    });
}

export async function explainForecast() {
  const userId = await requireAuthedUserId();
  return withOrg(userId, async (ctx) => {
      const { forecastNarrative } = await import("@/lib/shiftii/services/forecast.server");
      return forecastNarrative(ctx);
    });
}

export async function listFatigue() {
  const userId = await requireAuthedUserId();
  return withOrg(userId, async (ctx) => {
      const { listFatigue } = await import("@/lib/shiftii/services/wellbeing.server");
      return listFatigue(ctx);
    });
}

export async function refreshFatigue() {
  const userId = await requireAuthedUserId();
  return withOrg(userId, async (ctx) => {
      const { refreshFatigue } = await import("@/lib/shiftii/services/wellbeing.server");
      return refreshFatigue(ctx);
    });
}

export async function fairnessReport(input: { from?: string; to?: string }) {
  const data = input ?? {};
  const userId = await requireAuthedUserId();
  return withOrg(userId, async (ctx) => {
      const { fairnessReport } = await import("@/lib/shiftii/services/wellbeing.server");
      return fairnessReport(ctx, data.from, data.to);
    });
}

export async function checkAssignment(input: { membershipId: string; shiftId: string }) {
  const data = input;
  const userId = await requireAuthedUserId();
  return withOrg(userId, async (ctx) => {
      const { evaluateAssignment } = await import("@/lib/shiftii/eligibility.server");
      return evaluateAssignment(ctx, data.membershipId, data.shiftId);
    });
}