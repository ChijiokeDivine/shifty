import { nid } from "../ids";
import { moveShiftWindow, shiftWindowFromClock } from "../calendar";
import { bool, dateStr, iso, num, q, str, strOrNull, withTransaction } from "../db.server";
import { assertManager } from "../context.server";
import { audit } from "../audit.server";
import { managerIds, notify } from "../notify.server";
import { ConflictError, ConstraintError, NotFoundError } from "../errors";
import { evaluateAssignment } from "../eligibility.server";
import type { SessionContext, Shift, ShiftStatus } from "../types";

export function mapShift(r: Record<string, unknown>): Shift {
  return {
    id: str(r.id),
    organizationId: str(r.organization_id),
    rosterId: str(r.roster_id),
    locationId: str(r.location_id),
    positionId: str(r.position_id),
    employeeId: strOrNull(r.employee_id),
    date: dateStr(r.date),
    startAt: iso(r.start_at),
    endAt: iso(r.end_at),
    breakMinutes: num(r.break_minutes),
    notes: strOrNull(r.notes),
    status: str(r.status) as ShiftStatus,
    isOpenForClaim: bool(r.is_open_for_claim),
    version: num(r.version),
    locationName: strOrNull(r.location_name) ?? undefined,
    unitType: (r.unit_type as string | null) ?? undefined,
    positionName: strOrNull(r.position_name) ?? undefined,
    employeeName: strOrNull(r.employee_name) ?? undefined,
  };
}

const SHIFT_SELECT = `
  select s.*, l.name as location_name, l.unit_type,
         p.name as position_name, m.display_name as employee_name
    from shifts s
    join locations l on l.id = s.location_id
    join positions p on p.id = s.position_id
    left join memberships m on m.id = s.employee_id
`;

export async function listShifts(
  ctx: SessionContext,
  filters: {
    from?: string;
    to?: string;
    locationId?: string;
    employeeId?: string;
    status?: ShiftStatus;
    openOnly?: boolean;
    mine?: boolean;
  },
): Promise<Shift[]> {
  const params: unknown[] = [ctx.organization.id];
  let where = "s.organization_id = $1";
  // Staff never receive unpublished draft shifts from another team member.
  if (!["OWNER", "ADMIN", "MANAGER"].includes(ctx.membership.role)) {
    where += " and exists (select 1 from rosters r where r.id = s.roster_id and r.organization_id = s.organization_id and r.status = 'PUBLISHED')";
  }
  if (filters.from) {
    params.push(filters.from);
    where += ` and s.date >= $${params.length}`;
  }
  if (filters.to) {
    params.push(filters.to);
    where += ` and s.date <= $${params.length}`;
  }
  if (filters.locationId) {
    params.push(filters.locationId);
    where += ` and s.location_id = $${params.length}`;
  }
  if (filters.employeeId) {
    params.push(filters.employeeId);
    where += ` and s.employee_id = $${params.length}`;
  }
  if (filters.mine) {
    params.push(ctx.membership.id);
    where += ` and s.employee_id = $${params.length}`;
  }
  if (filters.status) {
    params.push(filters.status);
    where += ` and s.status = $${params.length}`;
  }
  if (filters.openOnly) {
    where += ` and s.is_open_for_claim = true and s.employee_id is null and s.status <> 'CANCELLED'`;
  }
  const rows = await q<Record<string, unknown>>(
    `${SHIFT_SELECT} where ${where} order by s.start_at asc, l.name asc`,
    params,
  );
  return rows.map(mapShift);
}

export async function getShift(ctx: SessionContext, id: string): Promise<Shift> {
  const rows = await q<Record<string, unknown>>(
    `${SHIFT_SELECT} where s.id = $1 and s.organization_id = $2`,
    [id, ctx.organization.id],
  );
  if (!rows[0]) throw new NotFoundError("Shift not found.");
  return mapShift(rows[0]);
}

export async function createShift(
  ctx: SessionContext,
  input: {
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
  },
): Promise<Shift> {
  assertManager(ctx);
  if (
    !Number.isFinite(Date.parse(input.startAt)) ||
    !Number.isFinite(Date.parse(input.endAt)) ||
    Date.parse(input.endAt) <= Date.parse(input.startAt) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(input.date)
  ) {
    throw new ConstraintError(["Shift must have a valid date and an end time after its start."]);
  }
  const breakMinutes = input.breakMinutes ?? ctx.organization.defaultBreakMinutes;
  const durationMinutes = (Date.parse(input.endAt) - Date.parse(input.startAt)) / 60_000;
  if (!Number.isInteger(breakMinutes) || breakMinutes < 0 || breakMinutes >= durationMinutes) {
    throw new ConstraintError(["Break must be a nonnegative number of minutes shorter than the shift."]);
  }
  return withTransaction(async () => {
    // The roster, unit, and position must all belong to the caller's organization.
    const roster = await q<{ id: string }>(
      `select id from rosters where id = $1 and organization_id = $2 and status = 'DRAFT'
         and start_date <= $3 and end_date >= $3 and (location_id is null or location_id = $4)`,
      [input.rosterId, ctx.organization.id, input.date, input.locationId],
    );
    const location = await q<{ id: string }>(
      `select id from locations where id = $1 and organization_id = $2 and is_active = true`,
      [input.locationId, ctx.organization.id],
    );
    const position = await q<{ id: string }>(
      `select id from positions where id = $1 and organization_id = $2 and is_active = true`,
      [input.positionId, ctx.organization.id],
    );
    if (!roster.length || !location.length || !position.length) {
      throw new ConstraintError(["Roster, location, or position is invalid for this organization and date."]);
    }
    if (input.employeeId) {
      // Serialize assignments for a staff member across manager requests.
      const members = await q<{ id: string }>(
        `select id from memberships where id = $1 and organization_id = $2 for update`,
        [input.employeeId, ctx.organization.id],
      );
      if (!members.length) throw new NotFoundError("Staff member not found.");
    }
    const id = nid("sft");
    const assigned = Boolean(input.employeeId);
    const status = assigned ? "ASSIGNED" : input.openForClaim ? "OPEN" : "DRAFT";
    await q(
      `insert into shifts (
         id, organization_id, roster_id, location_id, position_id, employee_id,
         date, start_at, end_at, break_minutes, notes, status, is_open_for_claim, created_by_id
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [id, ctx.organization.id, input.rosterId, input.locationId, input.positionId,
       input.employeeId ?? null, input.date, input.startAt, input.endAt, breakMinutes,
       input.notes ?? null, status, Boolean(input.openForClaim) && !assigned, ctx.membership.id],
    );
    if (input.employeeId) {
      const check = await evaluateAssignment(ctx, input.employeeId, id);
      if (!check.ok) throw new ConstraintError(check.violations);
    }
    await audit({
      ctx,
      action: "SHIFT_CREATED",
      entityType: "shift",
      entityId: id,
      after: { locationId: input.locationId, date: input.date, employeeId: input.employeeId ?? null },
    });
    return getShift(ctx, id);
  });
}

export async function assignShift(
  ctx: SessionContext,
  input: { shiftId: string; membershipId: string; expectedVersion?: number },
): Promise<Shift> {
  assertManager(ctx);
  return withTransaction(async () => {
    // Lock the staff row before eligibility evaluation. Otherwise two requests
    // could both pass overlap/rest checks before either writes an assignment.
    const members = await q<{ id: string }>(
      `select id from memberships where id = $1 and organization_id = $2 for update`,
      [input.membershipId, ctx.organization.id],
    );
    if (!members.length) throw new NotFoundError("Staff member not found.");
    const current = await getShift(ctx, input.shiftId);
    if (current.status === "CANCELLED") throw new ConflictError("Shift is cancelled.");
    if (input.expectedVersion != null && current.version !== input.expectedVersion) {
      throw new ConflictError("Shift was updated by someone else. Reload and retry.");
    }
    const check = await evaluateAssignment(ctx, input.membershipId, input.shiftId);
    if (!check.ok) throw new ConstraintError(check.violations);
    const updated = await q<{ id: string }>(
      `update shifts
          set employee_id = $1, status = 'ASSIGNED', is_open_for_claim = false,
              version = version + 1, updated_at = now()
        where id = $2 and organization_id = $3 and version = $4 and status <> 'CANCELLED'
        returning id`,
      [input.membershipId, input.shiftId, ctx.organization.id, current.version],
    );
    if (!updated.length) {
      throw new ConflictError("Shift was updated by someone else. Reload and retry.");
    }
    await audit({
      ctx,
      action: "SHIFT_ASSIGNED",
      entityType: "shift",
      entityId: input.shiftId,
      before: { employeeId: current.employeeId },
      after: { employeeId: input.membershipId },
    });
    await notify({
      organizationId: ctx.organization.id,
      recipientIds: [input.membershipId],
      type: "SHIFT_ASSIGNED",
      title: "Shift assigned",
      message: `You were assigned ${current.locationName ?? "a unit"} on ${current.date}.`,
      link: "/app?view=me",
    });
    return getShift(ctx, input.shiftId);
  });
}

export async function unassignShift(
  ctx: SessionContext,
  input: { shiftId: string; openForClaim?: boolean },
): Promise<Shift> {
  assertManager(ctx);
  const current = await getShift(ctx, input.shiftId);
  await q(
    `update shifts
        set employee_id = null,
            status = $1,
            is_open_for_claim = $2,
            version = version + 1,
            updated_at = now()
      where id = $3 and organization_id = $4`,
    [
      input.openForClaim === false ? "DRAFT" : "OPEN",
      input.openForClaim !== false,
      input.shiftId,
      ctx.organization.id,
    ],
  );
  if (current.employeeId) {
    await notify({
      organizationId: ctx.organization.id,
      recipientIds: [current.employeeId],
      type: "SHIFT_REMOVED",
      title: "Shift removed",
      message: `Your ${current.date} ${current.locationName ?? "unit"} shift was released.`,
      link: "/app?view=me",
    });
  }
  await audit({
    ctx,
    action: "SHIFT_UNASSIGNED",
    entityType: "shift",
    entityId: input.shiftId,
    before: { employeeId: current.employeeId },
  });
  return getShift(ctx, input.shiftId);
}

export async function cancelShift(ctx: SessionContext, shiftId: string): Promise<Shift> {
  assertManager(ctx);
  const current = await getShift(ctx, shiftId);
  await q(
    `update shifts
        set status = 'CANCELLED', is_open_for_claim = false, version = version + 1, updated_at = now()
      where id = $1 and organization_id = $2`,
    [shiftId, ctx.organization.id],
  );
  const managers = await managerIds(ctx.organization.id);
  await notify({
    organizationId: ctx.organization.id,
    recipientIds: [...new Set([current.employeeId, ...managers].filter(Boolean) as string[])],
    type: "SHIFT_UPDATED",
    title: "Shift cancelled",
    message: `${current.locationName ?? "Unit"} on ${current.date} was cancelled.`,
  });
  await audit({ ctx, action: "SHIFT_CANCELLED", entityType: "shift", entityId: shiftId });
  return getShift(ctx, shiftId);
}

export async function setOpenForClaim(
  ctx: SessionContext,
  input: { shiftId: string; open: boolean },
): Promise<Shift> {
  assertManager(ctx);
  const current = await getShift(ctx, input.shiftId);
  if (current.employeeId && input.open) {
    throw new ConflictError("Release the assignee before opening the shift for claim.");
  }
  await q(
    `update shifts
        set is_open_for_claim = $1,
            status = case when $1 and employee_id is null then 'OPEN' else status end,
            version = version + 1,
            updated_at = now()
      where id = $2 and organization_id = $3`,
    [input.open, input.shiftId, ctx.organization.id],
  );
  await audit({
    ctx,
    action: input.open ? "SHIFT_OPENED" : "SHIFT_CLOSED",
    entityType: "shift",
    entityId: input.shiftId,
  });
  return getShift(ctx, input.shiftId);
}

/** Change a draft shift's start/end times and/or calendar date atomically. */
export async function rescheduleShift(
  ctx: SessionContext,
  input: { shiftId: string; date: string; expectedVersion: number; startTime?: string; endTime?: string },
): Promise<Shift> {
  assertManager(ctx);
  return withTransaction(async () => {
    const old = await getShift(ctx, input.shiftId);
    if (old.version !== input.expectedVersion) throw new ConflictError("Shift has changed. Refresh the roster.");
    const roster = await q<{ id: string }>(
      `select id from rosters where id = $1 and organization_id = $2 and status = 'DRAFT'
         and start_date <= $3 and end_date >= $3
         and (location_id is null or location_id = $4) for update`,
      [old.rosterId, ctx.organization.id, input.date, old.locationId],
    );
    if (!roster.length || old.status === "CANCELLED") throw new ConflictError("Only active shifts on draft rosters can be rescheduled.");
    let window: { startAt: string; endAt: string };
    try {
      window = input.startTime && input.endTime
        ? shiftWindowFromClock(input.date, input.startTime, input.endTime, ctx.organization.timezone)
        : moveShiftWindow(old.startAt, old.endAt, input.date, ctx.organization.timezone);
    } catch (err) {
      throw new ConstraintError([err instanceof Error ? err.message : "Invalid shift times."]);
    }
    if ((Date.parse(window.endAt) - Date.parse(window.startAt)) / 60000 <= old.breakMinutes) {
      throw new ConstraintError(["Shift must be longer than its break."]);
    }
    if (old.employeeId) {
      const employees = await q<{ id: string }>(
        `select id from memberships where id = $1 and organization_id = $2 for update`,
        [old.employeeId, ctx.organization.id],
      );
      if (!employees.length) throw new ConflictError("Assigned employee is unavailable.");
    }
    const changed = await q<{ id: string }>(
      `update shifts set date = $1, start_at = $2, end_at = $3,
           version = version + 1, updated_at = now()
         where id = $4 and organization_id = $5 and version = $6 returning id`,
      [input.date, window.startAt, window.endAt, input.shiftId, ctx.organization.id, input.expectedVersion],
    );
    if (!changed.length) throw new ConflictError("Shift changed while saving. Refresh and retry.");
    if (old.employeeId) {
      const check = await evaluateAssignment(ctx, old.employeeId, input.shiftId);
      if (!check.ok) throw new ConstraintError(check.violations);
    }
    await audit({ ctx, action: "SHIFT_RESCHEDULED", entityType: "shift", entityId: input.shiftId,
      before: { date: old.date, startAt: old.startAt, endAt: old.endAt },
      after: { date: input.date, ...window } });
    return getShift(ctx, input.shiftId);
  });
}

/** Atomically move a shift to a date and optionally assign another employee. */
export async function moveAndAssignShift(
  ctx: SessionContext,
  input: { shiftId: string; date: string; expectedVersion: number; membershipId?: string },
): Promise<Shift> {
  assertManager(ctx);
  return withTransaction(async () => {
    // Reuse the existing roster lock, version check and eligibility logic.
    // Both edits share one connection and either fully commit or fully rollback.
    const moved = await rescheduleShift(ctx, {
      shiftId: input.shiftId, date: input.date, expectedVersion: input.expectedVersion,
    });
    if (!input.membershipId || input.membershipId === moved.employeeId) return moved;
    return assignShift(ctx, {
      shiftId: moved.id,
      membershipId: input.membershipId,
      expectedVersion: moved.version,
    });
  });
}
