"use server";

import { requireAuthedUserId } from "@/lib/auth/middleware";
import { withOrg } from "./_run";
import type { ShiftWindow } from "@/lib/shiftii/types";

export async function listHandovers(input: { locationId?: string; unackedOnly?: boolean }) {
  const data = input ?? {};
  const userId = await requireAuthedUserId();
  return withOrg(userId, async (ctx) => {
      const { listHandovers } = await import("@/lib/shiftii/services/handover.server");
      return listHandovers(ctx, data ?? {});
    });
}

export async function createHandover(input: {
      shiftId: string;
      pendingTasksCount: number;
      criticalAlertsCount: number;
      equipmentIssuesFlag: boolean;
      freeTextNote?: string | null;
    }) {
  const data = input;
  const userId = await requireAuthedUserId();
  return withOrg(userId, async (ctx) => {
      const { createHandover } = await import("@/lib/shiftii/services/handover.server");
      return createHandover(ctx, data);
    });
}

export async function acknowledgeHandover(input: { handoverId: string }) {
  const data = input;
  const userId = await requireAuthedUserId();
  return withOrg(userId, async (ctx) => {
      const { acknowledgeHandover } = await import("@/lib/shiftii/services/handover.server");
      return acknowledgeHandover(ctx, data.handoverId);
    });
}

export async function listCensus(input: { locationId?: string; from?: string; to?: string }) {
  const data = input ?? {};
  const userId = await requireAuthedUserId();
  return withOrg(userId, async (ctx) => {
      const { listCensus } = await import("@/lib/shiftii/services/census.server");
      return listCensus(ctx, data ?? {});
    });
}

export async function recordCensus(input: {
      locationId: string;
      date: string;
      shiftWindow: ShiftWindow | string;
      patientCount: number;
      averageAcuity?: number | null;
    }) {
  const data = input;
  const userId = await requireAuthedUserId();
  return withOrg(userId, async (ctx) => {
      const { recordCensus } = await import("@/lib/shiftii/services/census.server");
      return recordCensus(ctx, data);
    });
}

export async function listNotifications(input: { unreadOnly?: boolean }) {
  const data = input ?? {};
  const userId = await requireAuthedUserId();
  return withOrg(userId, async (ctx) => {
      const { listNotifications } = await import("@/lib/shiftii/notify.server");
      return listNotifications({
        organizationId: ctx.organization.id,
        membershipId: ctx.membership.id,
        unreadOnly: data.unreadOnly,
      });
    });
}

export async function markNotificationsRead(input: { id?: string }) {
  const data = input ?? {};
  const userId = await requireAuthedUserId();
  return withOrg(userId, async (ctx) => {
      const { markRead } = await import("@/lib/shiftii/notify.server");
      const n = await markRead({
        organizationId: ctx.organization.id,
        membershipId: ctx.membership.id,
        id: data.id,
      });
      return { updated: n };
    });
}

export async function listAuditLog(input: { entityType?: string; action?: string; limit?: number }) {
  const data = input ?? {};
  const userId = await requireAuthedUserId();
  return withOrg(userId, async (ctx) => {
      const { assertManager } = await import("@/lib/shiftii/context.server");
      assertManager(ctx);
      const { listAudit } = await import("@/lib/shiftii/audit.server");
      return listAudit({ organizationId: ctx.organization.id, ...data });
    });
}