"use server";

import { requireAuthedUserId } from "@/lib/auth/middleware";
import { withOrg } from "./_run";

/** Bootstrap the caller's hospital (idempotent) and return session context. */

export async function getSessionContext() {
  const userId = await requireAuthedUserId();
  return withOrg(userId, async (ctx) => ({
      organization: ctx.organization,
      membership: ctx.membership,
      locationIds: ctx.locationIds,
      positionIds: ctx.positionIds,
      primaryLocationId: ctx.primaryLocationId,
    }));
}

export async function getDashboard() {
  const userId = await requireAuthedUserId();
  return withOrg(userId, async (ctx) => {
    const { getDashboard } = await import("@/lib/shiftii/services/dashboard.server");
    return getDashboard(ctx);
  });
}