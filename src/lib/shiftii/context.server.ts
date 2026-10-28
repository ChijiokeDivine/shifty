import type { Membership, MembershipRole, Organization, SessionContext, StaffPreferences } from "./types";
import { ForbiddenError, NotFoundError } from "./errors";
import { bool, json, num, numOrNull, q, qOne, str, strOrNull } from "./db.server";

type OrgRow = Record<string, unknown>;
type MemRow = Record<string, unknown>;

export function mapOrg(row: OrgRow): Organization {
  return {
    id: str(row.id),
    name: str(row.name),
    slug: str(row.slug),
    timezone: str(row.timezone) || "America/New_York",
    weekStartDay: num(row.week_start_day) || 1,
    locale: str(row.locale) || "en",
    defaultShiftLengthMinutes: num(row.default_shift_length_minutes) || 720,
    defaultBreakMinutes: num(row.default_break_minutes) || 30,
    maxWeeklyHours: numOrNull(row.max_weekly_hours),
    minRestHoursBetweenShifts: num(row.min_rest_hours_between_shifts) || 10,
    claimApprovalMode: (str(row.claim_approval_mode) as Organization["claimApprovalMode"]) || "MANAGER_APPROVAL",
    swapApprovalMode: (str(row.swap_approval_mode) as Organization["swapApprovalMode"]) || "MANAGER_APPROVAL",
    aiFeaturesEnabled: bool(row.ai_features_enabled),
    isActive: bool(row.is_active),
  };
}

export function mapMembership(row: MemRow): Membership {
  return {
    id: str(row.id),
    organizationId: str(row.organization_id),
    userId: str(row.user_id),
    displayName: str(row.display_name),
    initials: str(row.initials) || initialsFrom(str(row.display_name)),
    role: str(row.role) as MembershipRole,
    status: str(row.status) as Membership["status"],
    targetWeeklyHours: numOrNull(row.target_weekly_hours),
    preferences: json<StaffPreferences>(row.preferences, {}),
    isSynthetic: bool(row.is_synthetic),
  };
}

export function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export async function findMembershipForUser(userId: string): Promise<{
  org: Organization;
  membership: Membership;
} | null> {
  const row = await qOne<OrgRow & MemRow>(
    `select m.*, o.id as org_id, o.name as org_name, o.slug, o.timezone, o.week_start_day,
            o.locale, o.default_shift_length_minutes, o.default_break_minutes,
            o.max_weekly_hours, o.min_rest_hours_between_shifts,
            o.claim_approval_mode, o.swap_approval_mode, o.ai_features_enabled, o.is_active
       from memberships m
       join organizations o on o.id = m.organization_id
      where m.user_id = $1 and m.status = 'ACTIVE'
      order by m.created_at asc
      limit 1`,
    [userId],
  );
  if (!row) return null;
  return {
    org: mapOrg({
      id: row.org_id ?? row.organization_id,
      name: row.org_name ?? row.name,
      slug: row.slug,
      timezone: row.timezone,
      week_start_day: row.week_start_day,
      locale: row.locale,
      default_shift_length_minutes: row.default_shift_length_minutes,
      default_break_minutes: row.default_break_minutes,
      max_weekly_hours: row.max_weekly_hours,
      min_rest_hours_between_shifts: row.min_rest_hours_between_shifts,
      claim_approval_mode: row.claim_approval_mode,
      swap_approval_mode: row.swap_approval_mode,
      ai_features_enabled: row.ai_features_enabled,
      is_active: row.is_active,
    }),
    membership: mapMembership(row),
  };
}

export async function loadSessionContext(userId: string): Promise<SessionContext | null> {
  const found = await findMembershipForUser(userId);
  if (!found) return null;
  const locRows = await q<{ location_id: string; is_primary: boolean }>(
    `select location_id, is_primary from membership_locations where membership_id = $1`,
    [found.membership.id],
  );
  const posRows = await q<{ position_id: string }>(
    `select position_id from employee_positions where membership_id = $1`,
    [found.membership.id],
  );
  const primary = locRows.find((r) => bool(r.is_primary));
  return {
    userId,
    organization: found.org,
    membership: found.membership,
    locationIds: locRows.map((r) => str(r.location_id)),
    positionIds: posRows.map((r) => str(r.position_id)),
    primaryLocationId: primary ? str(primary.location_id) : strOrNull(locRows[0]?.location_id),
  };
}

export async function requireContext(userId: string): Promise<SessionContext> {
  let ctx = await loadSessionContext(userId);
  // Preserve the old seeded demo ONLY for the local auth-disabled preview.
  // Real users must register or accept a company invitation instead.
  const demoMode =
    process.env.NEXT_PUBLIC_AUTH_ENABLED === "false" &&
    !process.env.DATABASE_URL?.trim();
  if (!ctx && demoMode) {
    const { ensureHospital } = await import("./seed.server");
    await ensureHospital(userId);
    ctx = await loadSessionContext(userId);
  }
  if (!ctx) {
    throw new NotFoundError("No company membership yet. Complete company registration or accept an invitation.");
  }
  if (!ctx.organization.isActive) {
    throw new ForbiddenError("This company is inactive. Contact your administrator.");
  }
  return ctx;
}

export function isManager(role: MembershipRole): boolean {
  return role === "OWNER" || role === "ADMIN" || role === "MANAGER";
}

export function assertManager(ctx: SessionContext): void {
  if (!isManager(ctx.membership.role)) {
    throw new ForbiddenError("This action is limited to charge nurses and managers.");
  }
}

export async function getAuthProfile(userId: string): Promise<{
  name: string;
  email: string | null;
}> {
  const row = await qOne<{ name: string; email: string }>(
    `select name, email from "user" where id = $1`,
    [userId],
  );
  if (row) return { name: str(row.name) || "Charge Nurse", email: strOrNull(row.email) };
  return { name: "Charge Nurse", email: null };
}
