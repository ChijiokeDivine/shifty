import { aiConfigured } from "@/lib/ai/client";
import { addDays, dateInZone, hourInZone, windowFromStartHour } from "../time";
import { iso } from "../db.server";
import { listShifts } from "./shifts.server";
import { listClaims } from "./claims.server";
import { listSwaps } from "./swaps.server";
import { listLeave } from "./leave.server";
import { unreadCount } from "../notify.server";
import { listFatigue } from "./wellbeing.server";
import { listCredentialAlerts } from "./credentials.server";
import { detectGaps } from "./forecast.server";
import { listLocations } from "./staff.server";
import type { DashboardSnapshot, SessionContext } from "../types";

export async function getDashboard(ctx: SessionContext): Promise<DashboardSnapshot> {
  const today = dateInZone(new Date(), ctx.organization.timezone);
  const [shifts, claims, swaps, leave, unread, fatigue, creds, gaps, locations] =
    await Promise.all([
      listShifts(ctx, { from: today, to: addDays(today, 10) }),
      listClaims(ctx, { status: "PENDING" }),
      listSwaps(ctx, {}),
      listLeave(ctx, { status: "PENDING" }),
      unreadCount(ctx.organization.id, ctx.membership.id),
      listFatigue(ctx),
      listCredentialAlerts(ctx),
      detectGaps(ctx, { from: today, to: addDays(today, 7) }),
      listLocations(ctx),
    ]);

  const tonight = locations.map((loc) => {
    const locShifts = shifts.filter((s) => s.locationId === loc.id && s.date === today);
    const night = locShifts.filter(
      (s) => windowFromStartHour(hourInZone(s.startAt, ctx.organization.timezone)) === "NIGHT",
    );
    return {
      locationId: loc.id,
      locationName: loc.name,
      needed: Math.max(night.length, loc.unitType === "PACU" ? 0 : loc.unitType === "ICU" || loc.unitType === "ED" ? 2 : 1),
      assigned: night.filter((s) => s.employeeId).length,
      open: night.filter((s) => !s.employeeId).length,
    };
  });

  const pendingSwaps = swaps.filter(
    (s) => s.status === "PENDING_TARGET" || s.status === "PENDING_MANAGER" || s.status === "TARGET_ACCEPTED",
  ).length;

  return {
    organization: ctx.organization,
    me: ctx.membership,
    today,
    coverageTonight: tonight,
    gaps: gaps.slice(0, 12),
    pendingClaims: claims.length,
    pendingSwaps,
    pendingLeave: leave.length,
    unreadNotifications: unread,
    fatigueFlags: fatigue.filter((f) => f.score >= 55).slice(0, 8),
    credentialAlerts: creds.slice(0, 8),
    myUpcomingShifts: shifts.filter((s) => s.employeeId === ctx.membership.id).slice(0, 8),
    openShiftsCount: shifts.filter((s) => s.isOpenForClaim && !s.employeeId).length,
    aiAvailable: aiConfigured() && ctx.organization.aiFeaturesEnabled,
    localMlNote:
      "Fatigue, demand forecast, fairness, credential expiry, and fill ranking run on-process. External models only receive anonymous candidate indices.",
  };
}

void iso;
