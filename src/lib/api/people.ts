"use server";

import { requireAuthedUserId } from "@/lib/auth/middleware";
import { withOrg } from "./_run";
import type { LeaveType, LeaveStatus } from "@/lib/shiftii/types";

export async function listStaff() {
  const userId = await requireAuthedUserId();
  return withOrg(userId, async (ctx) => {
      const { listStaff } = await import("@/lib/shiftii/services/staff.server");
      return listStaff(ctx);
    });
}

export async function listLocations() {
  const userId = await requireAuthedUserId();
  return withOrg(userId, async (ctx) => {
      const { listLocations } = await import("@/lib/shiftii/services/staff.server");
      return listLocations(ctx);
    });
}

export async function listPositions() {
  const userId = await requireAuthedUserId();
  return withOrg(userId, async (ctx) => {
      const { listPositions } = await import("@/lib/shiftii/services/staff.server");
      return listPositions(ctx);
    });
}

export async function updateOrgSettings(input: {
      claimApprovalMode?: "AUTO" | "MANAGER_APPROVAL";
      swapApprovalMode?: "AUTO" | "MANAGER_APPROVAL";
      minRestHoursBetweenShifts?: number;
      maxWeeklyHours?: number | null;
      aiFeaturesEnabled?: boolean;
    }) {
  const data = input;
  const userId = await requireAuthedUserId();
  return withOrg(userId, async (ctx) => {
      const { updateOrgSettings } = await import("@/lib/shiftii/services/staff.server");
      return updateOrgSettings(ctx, data);
    });
}

export async function listAvailabilityRules(input: { membershipId?: string }) {
  const data = input ?? {};
  const userId = await requireAuthedUserId();
  return withOrg(userId, async (ctx) => {
      const { listRules } = await import("@/lib/shiftii/services/availability.server");
      return listRules(ctx, data.membershipId);
    });
}

export async function upsertAvailabilityRule(input: {
      membershipId?: string;
      dayOfWeek: number;
      startMinute: number;
      endMinute: number;
      isAvailable: boolean;
      effectiveFrom?: string | null;
      effectiveUntil?: string | null;
    }) {
  const data = input;
  const userId = await requireAuthedUserId();
  return withOrg(userId, async (ctx) => {
      const { upsertRule } = await import("@/lib/shiftii/services/availability.server");
      return upsertRule(ctx, data);
    });
}

export async function listAvailabilityExceptions(input: { membershipId?: string; from?: string; to?: string }) {
  const data = input ?? {};
  const userId = await requireAuthedUserId();
  return withOrg(userId, async (ctx) => {
      const { listExceptions } = await import("@/lib/shiftii/services/availability.server");
      return listExceptions(ctx, data);
    });
}

export async function addAvailabilityException(input: {
      membershipId?: string;
      date: string;
      isAvailable: boolean;
      startMinute?: number | null;
      endMinute?: number | null;
      reason?: string | null;
    }) {
  const data = input;
  const userId = await requireAuthedUserId();
  return withOrg(userId, async (ctx) => {
      const { addException } = await import("@/lib/shiftii/services/availability.server");
      return addException(ctx, data);
    });
}

export async function parsePreference(input: { text: string }) {
  const data = input;
  const userId = await requireAuthedUserId();
  return withOrg(userId, async (ctx) => {
      const { parseAndApplyPreference } = await import("@/lib/shiftii/services/availability.server");
      return parseAndApplyPreference(ctx, data.text);
    });
}

export async function listLeave(input: { status?: LeaveStatus; mine?: boolean }) {
  const data = input ?? {};
  const userId = await requireAuthedUserId();
  return withOrg(userId, async (ctx) => {
      const { listLeave } = await import("@/lib/shiftii/services/leave.server");
      return listLeave(ctx, data ?? {});
    });
}

export async function submitLeave(input: { type: LeaveType; startDate: string; endDate: string; reason?: string }) {
  const data = input;
  const userId = await requireAuthedUserId();
  return withOrg(userId, async (ctx) => {
      const { submitLeave } = await import("@/lib/shiftii/services/leave.server");
      return submitLeave(ctx, data);
    });
}

export async function reviewLeave(input: { leaveId: string; approve: boolean; managerNote?: string }) {
  const data = input;
  const userId = await requireAuthedUserId();
  return withOrg(userId, async (ctx) => {
      const { reviewLeave } = await import("@/lib/shiftii/services/leave.server");
      return reviewLeave(ctx, data);
    });
}

export async function cancelLeave(input: { leaveId: string }) {
  const data = input;
  const userId = await requireAuthedUserId();
  return withOrg(userId, async (ctx) => {
      const { cancelLeave } = await import("@/lib/shiftii/services/leave.server");
      await cancelLeave(ctx, data.leaveId);
      return { ok: true as const };
    });
}

export async function listCredentials(input: { membershipId?: string }) {
  const data = input ?? {};
  const userId = await requireAuthedUserId();
  return withOrg(userId, async (ctx) => {
      const { listCredentials } = await import("@/lib/shiftii/services/credentials.server");
      return listCredentials(ctx, data.membershipId);
    });
}

export async function listCredentialAlerts() {
  const userId = await requireAuthedUserId();
  return withOrg(userId, async (ctx) => {
      const { listCredentialAlerts } = await import("@/lib/shiftii/services/credentials.server");
      return listCredentialAlerts(ctx);
    });
}