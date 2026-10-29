"use server";

import { requireAuthedUserId } from "@/lib/auth/middleware";
import { withOrg } from "./_run";

export async function getDemoDataStatus() {
  const userId = await requireAuthedUserId();
  return withOrg(userId, async (ctx) => {
    const { getDemoDataStatus } = await import("@/lib/shiftii/demo-data.server");
    return getDemoDataStatus(ctx);
  });
}

export async function loadDemoData() {
  const userId = await requireAuthedUserId();
  return withOrg(userId, async (ctx) => {
    const { loadDemoData } = await import("@/lib/shiftii/demo-data.server");
    return loadDemoData(ctx);
  });
}
