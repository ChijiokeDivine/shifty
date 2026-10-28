"use server";

import { requireAuthedUserId } from "@/lib/auth/middleware";
import { withOrg } from "./_run";
import type { ShiftStatus } from "@/lib/shiftii/types";

export async function listShifts(input: {
      from?: string;
      to?: string;
      locationId?: string;
      employeeId?: string;
      status?: ShiftStatus;
      openOnly?: boolean;
      mine?: boolean;
    }) {
  const data = input ?? {};
  const userId = await requireAuthedUserId();
  return withOrg(userId, async (ctx) => {
      const { listShifts } = await import("@/lib/shiftii/services/shifts.server");
      return listShifts(ctx, data ?? {});
    });
}

export async function getShift(input: { id: string }) {
  const data = input;
  const userId = await requireAuthedUserId();
  return withOrg(userId, async (ctx) => {
      const { getShift } = await import("@/lib/shiftii/services/shifts.server");
      return getShift(ctx, data.id);
    });
}

export async function assignShift(input: { shiftId: string; membershipId: string; expectedVersion?: number }) {
  const data = input;
  const userId = await requireAuthedUserId();
  return withOrg(userId, async (ctx) => {
      const { assignShift } = await import("@/lib/shiftii/services/shifts.server");
      return assignShift(ctx, data);
    });
}

export async function unassignShift(input: { shiftId: string; openForClaim?: boolean }) {
  const data = input;
  const userId = await requireAuthedUserId();
  return withOrg(userId, async (ctx) => {
      const { unassignShift } = await import("@/lib/shiftii/services/shifts.server");
      return unassignShift(ctx, data);
    });
}

export async function cancelShift(input: { shiftId: string }) {
  const data = input;
  const userId = await requireAuthedUserId();
  return withOrg(userId, async (ctx) => {
      const { cancelShift } = await import("@/lib/shiftii/services/shifts.server");
      return cancelShift(ctx, data.shiftId);
    });
}

export async function setOpenForClaim(input: { shiftId: string; open: boolean }) {
  const data = input;
  const userId = await requireAuthedUserId();
  return withOrg(userId, async (ctx) => {
      const { setOpenForClaim } = await import("@/lib/shiftii/services/shifts.server");
      return setOpenForClaim(ctx, data);
    });
}

export async function createShift(input: {
      rosterId: string;
      locationId: string;
      positionId: string;
      date: string;
      startAt: string;
      endAt: string;
      breakMinutes?: number;
      employeeId?: string | null;
      openForClaim?: boolean;
      notes?: string | null;
    }) {
  const data = input;
  const userId = await requireAuthedUserId();
  return withOrg(userId, async (ctx) => {
      const { createShift } = await import("@/lib/shiftii/services/shifts.server");
      return createShift(ctx, data);
    });
}

export async function createRoster(input: {
  name: string;
  startDate: string;
  endDate: string;
  locationId?: string | null;
}) {
  const userId = await requireAuthedUserId();
  return withOrg(userId, async (ctx) => {
    const { createRoster } = await import("@/lib/shiftii/services/roster.server");
    return createRoster(ctx, input);
  });
}

export async function listRosters() {
  const userId = await requireAuthedUserId();
  return withOrg(userId, async (ctx) => {
      const { listRosters } = await import("@/lib/shiftii/services/roster.server");
      return listRosters(ctx);
    });
}

export async function generateFairRoster(input: { rosterId?: string; apply?: boolean }) {
  const data = input ?? {};
  const userId = await requireAuthedUserId();
  return withOrg(userId, async (ctx) => {
      const { generateFairAssignments } = await import("@/lib/shiftii/services/roster.server");
      return generateFairAssignments(ctx, data ?? {});
    });
}

export async function publishRoster(input: { rosterId: string }) {
  const data = input;
  const userId = await requireAuthedUserId();
  return withOrg(userId, async (ctx) => {
      const { publishRoster } = await import("@/lib/shiftii/services/roster.server");
      return publishRoster(ctx, data.rosterId);
    });
}

export async function listClaims(input: { status?: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED"; mine?: boolean }) {
  const data = input ?? {};
  const userId = await requireAuthedUserId();
  return withOrg(userId, async (ctx) => {
      const { listClaims } = await import("@/lib/shiftii/services/claims.server");
      return listClaims(ctx, data ?? {});
    });
}

export async function claimOpenShift(input: { shiftId: string; note?: string }) {
  const data = input;
  const userId = await requireAuthedUserId();
  return withOrg(userId, async (ctx) => {
      const { claimOpenShift } = await import("@/lib/shiftii/services/claims.server");
      return claimOpenShift(ctx, data);
    });
}

export async function releaseAssignedShift(input: { shiftId: string; note?: string }) {
  const data = input;
  const userId = await requireAuthedUserId();
  return withOrg(userId, async (ctx) => {
      const { releaseAssignedShift } = await import("@/lib/shiftii/services/claims.server");
      return releaseAssignedShift(ctx, data);
    });
}

export async function reviewClaim(input: { claimId: string; approve: boolean }) {
  const data = input;
  const userId = await requireAuthedUserId();
  return withOrg(userId, async (ctx) => {
      const { reviewClaim } = await import("@/lib/shiftii/services/claims.server");
      return reviewClaim(ctx, data);
    });
}

export async function cancelClaim(input: { claimId: string }) {
  const data = input;
  const userId = await requireAuthedUserId();
  return withOrg(userId, async (ctx) => {
      const { cancelClaim } = await import("@/lib/shiftii/services/claims.server");
      await cancelClaim(ctx, data.claimId);
      return { ok: true as const };
    });
}

export async function listSwaps(input: { mine?: boolean }) {
  const data = input ?? {};
  const userId = await requireAuthedUserId();
  return withOrg(userId, async (ctx) => {
      const { listSwaps } = await import("@/lib/shiftii/services/swaps.server");
      return listSwaps(ctx, data ?? {});
    });
}

export async function proposeSwap(input: { initiatorShiftId: string; targetShiftId: string; note?: string }) {
  const data = input;
  const userId = await requireAuthedUserId();
  return withOrg(userId, async (ctx) => {
      const { proposeSwap } = await import("@/lib/shiftii/services/swaps.server");
      return proposeSwap(ctx, data);
    });
}

export async function respondToSwap(input: { swapId: string; accept: boolean }) {
  const data = input;
  const userId = await requireAuthedUserId();
  return withOrg(userId, async (ctx) => {
      const { respondToSwap } = await import("@/lib/shiftii/services/swaps.server");
      return respondToSwap(ctx, data);
    });
}

export async function reviewSwap(input: { swapId: string; approve: boolean }) {
  const data = input;
  const userId = await requireAuthedUserId();
  return withOrg(userId, async (ctx) => {
      const { reviewSwap } = await import("@/lib/shiftii/services/swaps.server");
      return reviewSwap(ctx, data);
    });
}

export async function cancelSwap(input: { swapId: string }) {
  const data = input;
  const userId = await requireAuthedUserId();
  return withOrg(userId, async (ctx) => {
      const { cancelSwap } = await import("@/lib/shiftii/services/swaps.server");
      await cancelSwap(ctx, data.swapId);
      return { ok: true as const };
    });
}