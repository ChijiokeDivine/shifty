import { nid } from "../ids";
import { dateStr, q, qOne, str, strOrNull } from "../db.server";
import { assertManager } from "../context.server";
import { audit } from "../audit.server";
import { managerIds, notify } from "../notify.server";
import { ConflictError, NotFoundError } from "../errors";
import type { LeaveRequest, LeaveStatus, LeaveType, SessionContext } from "../types";

function mapLeave(r: Record<string, unknown>): LeaveRequest {
  return {
    id: str(r.id),
    organizationId: str(r.organization_id),
    membershipId: str(r.membership_id),
    type: str(r.type) as LeaveType,
    startDate: dateStr(r.start_date),
    endDate: dateStr(r.end_date),
    reason: strOrNull(r.reason),
    status: str(r.status) as LeaveStatus,
    membershipName: strOrNull(r.membership_name) ?? undefined,
  };
}

export async function listLeave(
  ctx: SessionContext,
  filters: { status?: LeaveStatus; mine?: boolean } = {},
): Promise<LeaveRequest[]> {
  const params: unknown[] = [ctx.organization.id];
  let where = "l.organization_id = $1";
  if (filters.status) {
    params.push(filters.status);
    where += ` and l.status = $${params.length}`;
  }
  if (filters.mine) {
    params.push(ctx.membership.id);
    where += ` and l.membership_id = $${params.length}`;
  }
  const rows = await q<Record<string, unknown>>(
    `select l.*, m.display_name as membership_name
       from leave_requests l
       join memberships m on m.id = l.membership_id
      where ${where}
      order by l.start_date desc`,
    params,
  );
  return rows.map(mapLeave);
}

export async function submitLeave(
  ctx: SessionContext,
  input: { type: LeaveType; startDate: string; endDate: string; reason?: string },
): Promise<LeaveRequest> {
  if (input.endDate < input.startDate) throw new ConflictError("End date is before start date.");
  const id = nid("lve");
  await q(
    `insert into leave_requests (
       id, organization_id, membership_id, type, start_date, end_date, reason, status
     ) values ($1,$2,$3,$4,$5,$6,$7,'PENDING')`,
    [id, ctx.organization.id, ctx.membership.id, input.type, input.startDate, input.endDate, input.reason ?? null],
  );
  await notify({
    organizationId: ctx.organization.id,
    recipientIds: await managerIds(ctx.organization.id),
    type: "LEAVE_SUBMITTED",
    title: "Leave request",
    message: `${ctx.membership.displayName} requested ${input.type.toLowerCase()} ${input.startDate}–${input.endDate}.`,
  });
  await audit({ ctx, action: "LEAVE_SUBMITTED", entityType: "leave_request", entityId: id });
  return (await listLeave(ctx, { mine: true })).find((l) => l.id === id)!;
}

export async function reviewLeave(
  ctx: SessionContext,
  input: { leaveId: string; approve: boolean; managerNote?: string },
): Promise<LeaveRequest> {
  assertManager(ctx);
  const row = await qOne<Record<string, unknown>>(
    `select * from leave_requests where id = $1 and organization_id = $2`,
    [input.leaveId, ctx.organization.id],
  );
  if (!row) throw new NotFoundError("Leave request not found.");
  if (str(row.status) !== "PENDING") throw new ConflictError("Leave is no longer pending.");
  const status: LeaveStatus = input.approve ? "APPROVED" : "REJECTED";
  await q(
    `update leave_requests
        set status = $1, reviewed_by_id = $2, reviewed_at = now(), manager_note = $3, updated_at = now()
      where id = $4`,
    [status, ctx.membership.id, input.managerNote ?? null, input.leaveId],
  );
  await notify({
    organizationId: ctx.organization.id,
    recipientIds: [str(row.membership_id)],
    type: "LEAVE_DECIDED",
    title: input.approve ? "Leave approved" : "Leave declined",
    message: input.approve ? "Your leave was approved." : "Your leave was declined.",
  });
  await audit({
    ctx,
    action: input.approve ? "LEAVE_APPROVED" : "LEAVE_REJECTED",
    entityType: "leave_request",
    entityId: input.leaveId,
  });
  return (await listLeave(ctx, {})).find((l) => l.id === input.leaveId)!;
}

export async function cancelLeave(ctx: SessionContext, leaveId: string): Promise<void> {
  const row = await qOne<Record<string, unknown>>(
    `select * from leave_requests where id = $1 and organization_id = $2`,
    [leaveId, ctx.organization.id],
  );
  if (!row) throw new NotFoundError("Leave request not found.");
  if (str(row.membership_id) !== ctx.membership.id) assertManager(ctx);
  if (str(row.status) === "CANCELLED") return;
  await q(
    `update leave_requests
        set status = 'CANCELLED', cancelled_at = now(), updated_at = now()
      where id = $1`,
    [leaveId],
  );
  await audit({ ctx, action: "LEAVE_CANCELLED", entityType: "leave_request", entityId: leaveId });
}
