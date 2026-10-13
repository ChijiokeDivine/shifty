import { bool, json, num, numOrNull, q, str } from "../db.server";
import { assertManager } from "../context.server";
import type { Location, Membership, Position, SessionContext, StaffPreferences } from "../types";

export async function listLocations(ctx: SessionContext): Promise<Location[]> {
  const rows = await q<Record<string, unknown>>(
    `select * from locations where organization_id = $1 and is_active = true order by name`,
    [ctx.organization.id],
  );
  return rows.map((r) => ({
    id: str(r.id),
    organizationId: str(r.organization_id),
    name: str(r.name),
    unitType: r.unit_type ? str(r.unit_type) : null,
    isActive: bool(r.is_active),
  }));
}

export async function listPositions(ctx: SessionContext): Promise<Position[]> {
  const rows = await q<Record<string, unknown>>(
    `select * from positions where organization_id = $1 and is_active = true order by name`,
    [ctx.organization.id],
  );
  return rows.map((r) => ({
    id: str(r.id),
    organizationId: str(r.organization_id),
    name: str(r.name),
    colorHex: r.color_hex ? str(r.color_hex) : null,
    isActive: bool(r.is_active),
  }));
}

export type StaffRow = Membership & {
  locationNames: string[];
  positionNames: string[];
  fatigueScore: number | null;
  hours7d: number | null;
};

export async function listStaff(ctx: SessionContext): Promise<StaffRow[]> {
  const rows = await q<Record<string, unknown>>(
    `select m.*,
            (select json_agg(l.name) from membership_locations ml
               join locations l on l.id = ml.location_id where ml.membership_id = m.id) as location_names,
            (select json_agg(p.name) from employee_positions ep
               join positions p on p.id = ep.position_id where ep.membership_id = m.id) as position_names,
            (select score from fatigue_snapshots f
              where f.membership_id = m.id order by date desc limit 1) as fatigue_score,
            (select (f.flags->>'hours7d') from fatigue_snapshots f
              where f.membership_id = m.id order by date desc limit 1) as hours7d
       from memberships m
      where m.organization_id = $1 and m.status = 'ACTIVE'
      order by m.display_name`,
    [ctx.organization.id],
  );
  return rows.map((r) => ({
    id: str(r.id),
    organizationId: str(r.organization_id),
    userId: str(r.user_id),
    displayName: str(r.display_name),
    initials: str(r.initials),
    role: str(r.role) as Membership["role"],
    status: str(r.status) as Membership["status"],
    targetWeeklyHours: numOrNull(r.target_weekly_hours),
    preferences: json<StaffPreferences>(r.preferences, {}),
    isSynthetic: bool(r.is_synthetic),
    locationNames: json<string[]>(r.location_names, []),
    positionNames: json<string[]>(r.position_names, []),
    fatigueScore: numOrNull(r.fatigue_score),
    hours7d: numOrNull(r.hours7d),
  }));
}

export async function updateOrgSettings(
  ctx: SessionContext,
  patch: {
    claimApprovalMode?: "AUTO" | "MANAGER_APPROVAL";
    swapApprovalMode?: "AUTO" | "MANAGER_APPROVAL";
    minRestHoursBetweenShifts?: number;
    maxWeeklyHours?: number | null;
    aiFeaturesEnabled?: boolean;
  },
) {
  assertManager(ctx);
  await q(
    `update organizations
        set claim_approval_mode = coalesce($1, claim_approval_mode),
            swap_approval_mode = coalesce($2, swap_approval_mode),
            min_rest_hours_between_shifts = coalesce($3, min_rest_hours_between_shifts),
            max_weekly_hours = coalesce($4, max_weekly_hours),
            ai_features_enabled = coalesce($5, ai_features_enabled),
            updated_at = now()
      where id = $6`,
    [
      patch.claimApprovalMode ?? null,
      patch.swapApprovalMode ?? null,
      patch.minRestHoursBetweenShifts ?? null,
      patch.maxWeeklyHours ?? null,
      patch.aiFeaturesEnabled ?? null,
      ctx.organization.id,
    ],
  );
  return { ok: true as const };
}
