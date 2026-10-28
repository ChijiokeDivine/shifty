import { nid } from "../ids";
import { dateStr, q, str, withTransaction } from "../db.server";
import { assertManager } from "../context.server";
import { audit } from "../audit.server";
import { ConflictError, ConstraintError, NotFoundError } from "../errors";
import { managerIds, notify } from "../notify.server";
import { evaluateAssignment } from "../eligibility.server";
import { listShifts, assignShift } from "./shifts.server";
import type { SessionContext } from "../types";

export async function listRosters(ctx: SessionContext) {
  const rows = await q<Record<string, unknown>>(
    `select * from rosters where organization_id = $1 order by start_date desc`,
    [ctx.organization.id],
  );
  return rows.map((r) => ({
    id: str(r.id),
    name: str(r.name),
    startDate: dateStr(r.start_date),
    endDate: dateStr(r.end_date),
    status: str(r.status),
    locationId: r.location_id ? str(r.location_id) : null,
  }));
}

/** Create a draft roster for an organization, optionally scoped to a unit. */
export async function createRoster(
  ctx: SessionContext,
  input: { name: string; startDate: string; endDate: string; locationId?: string | null },
) {
  assertManager(ctx);
  const name = input.name.trim();
  if (!name || name.length > 120) {
    throw new ConstraintError(["Roster name must contain 1 to 120 characters."]);
  }
  const datePattern = /^\\d{4}-\\d{2}-\\d{2}$/;
  const validDate = (date: string): boolean =>
    datePattern.test(date) && !Number.isNaN(Date.parse(`${date}T12:00:00Z`)) &&
    new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) === date;
  if (!validDate(input.startDate) || !validDate(input.endDate) || input.endDate < input.startDate) {
    throw new ConstraintError(["Roster dates must be valid and the end date must not precede the start date."]);
  }
  const id = nid("rst");
  return withTransaction(async () => {
    if (input.locationId) {
      const location = await q<{ id: string }>(
        `select id from locations where id = $1 and organization_id = $2 and is_active = true`,
        [input.locationId, ctx.organization.id],
      );
      if (!location.length) throw new NotFoundError("Location not found in this organization.");
    }
    const rows = await q<{ id: string }>(
      `insert into rosters (
         id, organization_id, location_id, name, start_date, end_date,
         status, created_by_id
       ) values ($1,$2,$3,$4,$5,$6,'DRAFT',$7) returning id`,
      [id, ctx.organization.id, input.locationId ?? null, name,
       input.startDate, input.endDate, ctx.membership.id],
    );
    if (!rows.length) throw new ConflictError("Could not create roster.");
    await audit({
      ctx, action: "ROSTER_CREATED", entityType: "roster", entityId: id,
      after: { name, startDate: input.startDate, endDate: input.endDate,
               locationId: input.locationId ?? null },
    });
    return {
      id, name, startDate: input.startDate, endDate: input.endDate,
      status: "DRAFT" as const, locationId: input.locationId ?? null,
    };
  });
}

export async function publishRoster(ctx: SessionContext, rosterId: string) {
  assertManager(ctx);
  const published = await q<{ id: string }>(
    `update rosters
        set status = 'PUBLISHED', published_by_id = $1, published_at = now(), updated_at = now()
      where id = $2 and organization_id = $3 and status = 'DRAFT'
      returning id`,
    [ctx.membership.id, rosterId, ctx.organization.id],
  );
  if (!published.length) {
    throw new ConflictError("Roster not found or it has already been published or archived.");
  }
  const staff = await q<{ id: string }>(
    `select id from memberships where organization_id = $1 and status = 'ACTIVE' and is_synthetic = false`,
    [ctx.organization.id],
  );
  await notify({
    organizationId: ctx.organization.id,
    recipientIds: staff.length ? staff.map((s) => s.id) : await managerIds(ctx.organization.id),
    type: "ROSTER_PUBLISHED",
    title: "Roster published",
    message: "A roster cycle is live. Check your upcoming shifts.",
  });
  await audit({ ctx, action: "ROSTER_PUBLISHED", entityType: "roster", entityId: rosterId });
  return { ok: true as const };
}

export async function generateFairAssignments(
  ctx: SessionContext,
  input: { rosterId?: string; apply?: boolean },
): Promise<{
  proposals: Array<{
    shiftId: string;
    membershipId: string;
    displayName: string;
    date: string;
    locationName?: string;
  }>;
  skipped: Array<{ shiftId: string; reason: string }>;
  applied: number;
}> {
  assertManager(ctx);
  const shifts = (await listShifts(ctx, {})).filter(
    (s) => !s.employeeId && s.status !== "CANCELLED" && (!input.rosterId || s.rosterId === input.rosterId),
  );
  const staff = await q<{ id: string }>(
    `select id from memberships where organization_id = $1 and status = 'ACTIVE'`,
    [ctx.organization.id],
  );
  const used = new Map<string, number>();
  const proposals: Array<{
    shiftId: string;
    membershipId: string;
    displayName: string;
    date: string;
    locationName?: string;
  }> = [];
  const skipped: Array<{ shiftId: string; reason: string }> = [];

  const hardestFirst = [...shifts].sort((a, b) => a.date.localeCompare(b.date));
  for (const shift of hardestFirst) {
    let best: { membershipId: string; displayName: string; score: number } | null = null;
    for (const st of staff) {
      const already = used.get(st.id) ?? 0;
      const check = await evaluateAssignment(ctx, st.id, shift.id);
      if (!check.ok) continue;
      const score = 100 - already * 8 - check.warnings.length * 4;
      if (!best || score > best.score) {
        best = { membershipId: st.id, displayName: check.displayName, score };
      }
    }
    if (!best) {
      skipped.push({ shiftId: shift.id, reason: "No eligible staff after constraints." });
      continue;
    }
    used.set(best.membershipId, (used.get(best.membershipId) ?? 0) + 1);
    proposals.push({
      shiftId: shift.id,
      membershipId: best.membershipId,
      displayName: best.displayName,
      date: shift.date,
      locationName: shift.locationName,
    });
  }

  let applied = 0;
  if (input.apply) {
    for (const p of proposals) {
      await assignShift(ctx, { shiftId: p.shiftId, membershipId: p.membershipId });
      applied += 1;
    }
  }
  await audit({
    ctx,
    action: input.apply ? "ROSTER_GENERATED_APPLIED" : "ROSTER_GENERATED",
    entityType: "roster",
    entityId: input.rosterId ?? "all",
    metadata: { proposals: proposals.length, skipped: skipped.length, applied },
  });
  void nid;
  return { proposals, skipped, applied };
}
