import { bool, json, numOrNull, q, qOne, str, withTransaction } from "../db.server";
import { nid } from "../ids";
import { initialsFrom } from "../context.server";
import { audit } from "../audit.server";
import { ConflictError, ConstraintError, ForbiddenError, NotFoundError } from "../errors";
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

export type StaffProfilePatch = {
  displayName?: string;
  targetWeeklyHours?: number | null;
  role?: "ADMIN" | "MANAGER" | "EMPLOYEE";
  locationIds?: string[];
  positionIds?: string[];
  primaryLocationId?: string | null;
};

function requireRoleEditor(ctx: SessionContext): void {
  assertManager(ctx);
}

function canManageTarget(actor: Membership["role"], target: Membership["role"]): boolean {
  if (target === "OWNER") return actor === "OWNER";
  if (actor === "MANAGER") return target === "EMPLOYEE";
  if (actor === "ADMIN") return target === "MANAGER" || target === "EMPLOYEE";
  return actor === "OWNER";
}

export async function updateStaffProfile(ctx: SessionContext, membershipId: string, patch: StaffProfilePatch) {
  requireRoleEditor(ctx);
  if (!membershipId) throw new ConstraintError(["Choose a team member."]);
  if (Object.keys(patch).length === 0) throw new ConstraintError(["No changes supplied."]);
  return withTransaction(async () => {
    const current = await qOne<{ id: string; role: Membership["role"]; user_id: string; status: string }>(
      `select id, role, user_id, status from memberships where id = $1 and organization_id = $2 for update`,
      [membershipId, ctx.organization.id],
    );
    if (!current) throw new NotFoundError("Team member not found.");
    if (!canManageTarget(ctx.membership.role, current.role)) {
      throw new ForbiddenError("You cannot edit this team member.");
    }
    if (current.status !== "ACTIVE") throw new ConflictError("This team member is inactive.");
    if (patch.role !== undefined) {
      if (!["ADMIN", "MANAGER", "EMPLOYEE"].includes(patch.role)) {
        throw new ConstraintError(["Invalid role."]);
      }
      if (ctx.membership.role === "MANAGER" && patch.role !== "EMPLOYEE") throw new ForbiddenError("Managers can only assign employee access.");
      if (ctx.membership.role === "ADMIN" && patch.role === "ADMIN") throw new ForbiddenError("Only owners can promote administrators.");
      if (current.role === "OWNER") throw new ForbiddenError("Ownership cannot be changed here.");
    }
    const displayName = patch.displayName === undefined ? undefined : patch.displayName.trim();
    if (displayName !== undefined && (displayName.length < 2 || displayName.length > 120)) {
      throw new ConstraintError(["Name must be between 2 and 120 characters."]);
    }
    const hours = patch.targetWeeklyHours;
    if (hours !== undefined && hours !== null && (!Number.isFinite(hours) || hours < 0 || hours > 168)) {
      throw new ConstraintError(["Weekly target hours must be between 0 and 168."]);
    }
    const locationIds = patch.locationIds === undefined ? undefined : [...new Set(patch.locationIds)];
    const positionIds = patch.positionIds === undefined ? undefined : [...new Set(patch.positionIds)];
    if ((locationIds?.length ?? 0) > 50 || (positionIds?.length ?? 0) > 50) throw new ConstraintError(["Too many assignments."]);
    if (patch.primaryLocationId && locationIds === undefined) {
      throw new ConstraintError(["Include location assignments when changing the primary location."]);
    }
    if (patch.primaryLocationId && !locationIds?.includes(patch.primaryLocationId)) {
      throw new ConstraintError(["Primary location must be one of the assigned locations."]);
    }
    if (locationIds) {
      const eligible = await q<{ id: string }>(
        `select id from locations where organization_id = $1 and is_active = true and id = any($2::text[])`,
        [ctx.organization.id, locationIds],
      );
      if (eligible.length !== locationIds.length) throw new ConstraintError(["One or more locations are invalid."]);
    }
    if (positionIds) {
      const eligible = await q<{ id: string }>(
        `select id from positions where organization_id = $1 and is_active = true and id = any($2::text[])`,
        [ctx.organization.id, positionIds],
      );
      if (eligible.length !== positionIds.length) throw new ConstraintError(["One or more positions are invalid."]);
    }
    await q(
      `update memberships
          set display_name = coalesce($1, display_name), initials = coalesce($2, initials),
              target_weekly_hours = case when $3 then $4::double precision else target_weekly_hours end,
              role = coalesce($5, role), updated_at = now()
        where id = $6 and organization_id = $7`,
      [displayName ?? null, displayName === undefined ? null : initialsFrom(displayName),
        hours !== undefined, hours ?? null, patch.role ?? null, membershipId, ctx.organization.id],
    );
    if (locationIds) {
      await q("delete from membership_locations where membership_id = $1", [membershipId]);
      for (let i = 0; i < locationIds.length; i++) {
        await q(
          `insert into membership_locations (id, membership_id, location_id, is_primary)
           values ($1,$2,$3,$4)`,
          [nid("mloc"), membershipId, locationIds[i], locationIds[i] === (patch.primaryLocationId ?? locationIds[0])],
        );
      }
    }
    if (positionIds) {
      await q("delete from employee_positions where membership_id = $1", [membershipId]);
      for (const positionId of positionIds) {
        await q(
          "insert into employee_positions (id, membership_id, position_id) values ($1,$2,$3)",
          [nid("epos"), membershipId, positionId],
        );
      }
    }
    await audit({
      ctx, action: "STAFF_UPDATED", entityType: "membership", entityId: membershipId,
      metadata: { fields: Object.keys(patch) },
    });
    return { ok: true as const };
  });
}

export async function deactivateStaff(ctx: SessionContext, membershipId: string) {
  assertManager(ctx);
  return withTransaction(async () => {
    const member = await qOne<{ role: Membership["role"]; status: string }>(
      `select role, status from memberships where id = $1 and organization_id = $2 for update`,
      [membershipId, ctx.organization.id],
    );
    if (!member) throw new NotFoundError("Team member not found.");
    if (membershipId === ctx.membership.id) throw new ForbiddenError("You cannot deactivate your own account.");
    if (member.role === "OWNER") throw new ForbiddenError("The owner cannot be deactivated.");
    if (!canManageTarget(ctx.membership.role, member.role)) throw new ForbiddenError("You cannot deactivate this account.");
    if (member.status !== "ACTIVE") throw new ConflictError("Team member is already inactive.");
    const future = await qOne<{ id: string }>(
      `select id from shifts where organization_id = $1 and employee_id = $2
          and end_at > now() and status = 'ASSIGNED' limit 1`,
      [ctx.organization.id, membershipId],
    );
    if (future) throw new ConflictError("Reassign or cancel this employee's future shifts before deactivation.");
    await q(
      `update memberships set status = 'INACTIVE', deactivated_at = now(), updated_at = now()
        where id = $1 and organization_id = $2`,
      [membershipId, ctx.organization.id],
    );
    await audit({ ctx, action: "STAFF_DEACTIVATED", entityType: "membership", entityId: membershipId });
    return { ok: true as const };
  });
}

export async function createLocation(ctx: SessionContext, nameValue: string) {
  assertManager(ctx);
  const name = nameValue?.trim();
  if (!name || name.length > 100) throw new ConstraintError(["Location name must be 1 to 100 characters."]);
  const id = nid("loc");
  const result = await q<{ id: string }>(
    `insert into locations (id, organization_id, name)
      values ($1,$2,$3) on conflict (organization_id,name) do nothing returning id`,
    [id, ctx.organization.id, name],
  );
  if (!result.length) throw new ConflictError("That location already exists.");
  await audit({ ctx, action: "LOCATION_CREATED", entityType: "location", entityId: id });
  return { id, name };
}

export async function createPosition(ctx: SessionContext, nameValue: string) {
  assertManager(ctx);
  const name = nameValue?.trim();
  if (!name || name.length > 100) throw new ConstraintError(["Position name must be 1 to 100 characters."]);
  const id = nid("pos");
  const result = await q<{ id: string }>(
    `insert into positions (id, organization_id, name)
      values ($1,$2,$3) on conflict (organization_id,name) do nothing returning id`,
    [id, ctx.organization.id, name],
  );
  if (!result.length) throw new ConflictError("That position already exists.");
  await audit({ ctx, action: "POSITION_CREATED", entityType: "position", entityId: id });
  return { id, name };
}
