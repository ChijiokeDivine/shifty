import { nid } from "../ids";
import { iso, q, qOne, str, strOrNull, withTransaction } from "../db.server";
import { assertManager } from "../context.server";
import { audit } from "../audit.server";
import { managerIds, notify } from "../notify.server";
import { AppError, ConflictError, ConstraintError, NotFoundError } from "../errors";
import { evaluateAssignment } from "../eligibility.server";
import { getShift } from "./shifts.server";
import type { SessionContext, ShiftClaim, ShiftClaimStatus, ShiftClaimType } from "../types";

export async function listClaims(
  ctx: SessionContext,
  filters: { status?: ShiftClaimStatus; mine?: boolean } = {},
): Promise<ShiftClaim[]> {
  const params: unknown[] = [ctx.organization.id];
  let where = "c.organization_id = $1";
  if (filters.status) {
    params.push(filters.status);
    where += ` and c.status = $${params.length}`;
  }
  if (filters.mine) {
    params.push(ctx.membership.id);
    where += ` and c.membership_id = $${params.length}`;
  }
  const rows = await q<Record<string, unknown>>(
    `select c.*, m.display_name as membership_name
       from shift_claims c
       join memberships m on m.id = c.membership_id
      where ${where}
      order by c.created_at desc`,
    params,
  );
  const out: ShiftClaim[] = [];
  for (const r of rows) {
    let shift;
    try {
      shift = await getShift(ctx, str(r.shift_id));
    } catch {
      shift = undefined;
    }
    out.push({
      id: str(r.id),
      organizationId: str(r.organization_id),
      shiftId: str(r.shift_id),
      membershipId: str(r.membership_id),
      type: str(r.type) as ShiftClaimType,
      status: str(r.status) as ShiftClaimStatus,
      note: strOrNull(r.note),
      createdAt: iso(r.created_at),
      membershipName: strOrNull(r.membership_name) ?? undefined,
      shift,
    });
  }
  return out;
}

export async function claimOpenShift(
  ctx: SessionContext,
  input: { shiftId: string; note?: string },
): Promise<ShiftClaim> {
  return withTransaction(async () => {
    const locked = await q<{ id: string }>(
      `select id from memberships where id = $1 and organization_id = $2 and status = 'ACTIVE' for update`,
      [ctx.membership.id, ctx.organization.id],
    );
    if (!locked.length) throw new ConflictError("Your staff membership is not active.");
    const shift = await getShift(ctx, input.shiftId);
    if (shift.status === "CANCELLED") throw new ConflictError("Shift is cancelled.");
    if (!shift.isOpenForClaim || shift.employeeId) {
      throw new ConflictError("This shift is not open for claim.");
    }
    const existing = await qOne(
      `select id from shift_claims
        where shift_id = $1 and membership_id = $2 and status in ('PENDING', 'APPROVED') and type = 'CLAIM'`,
      [input.shiftId, ctx.membership.id],
    );
    if (existing) throw new ConflictError("You already have a pending claim on this shift.");
  
    const check = await evaluateAssignment(ctx, ctx.membership.id, input.shiftId);
    if (!check.ok) throw new ConstraintError(check.violations);
  
    const auto = ctx.organization.claimApprovalMode === "AUTO";
    const id = nid("clm");
    await q(
      `insert into shift_claims (
         id, organization_id, shift_id, membership_id, type, status, note
       ) values ($1,$2,$3,$4,'CLAIM',$5,$6)`,
      [id, ctx.organization.id, input.shiftId, ctx.membership.id, auto ? "APPROVED" : "PENDING", input.note ?? null],
    );
  
    if (auto) {
      await applyClaim(ctx, id, "APPROVED");
    } else {
      await notify({
        organizationId: ctx.organization.id,
        recipientIds: await managerIds(ctx.organization.id),
        type: "CLAIM_SUBMITTED",
        title: "Open-shift claim",
        message: `${ctx.membership.displayName} claimed ${shift.locationName ?? "a unit"} on ${shift.date}.`,
        link: "/app?view=claims",
      });
    }
    await audit({
      ctx,
      action: auto ? "CLAIM_AUTO_APPROVED" : "CLAIM_SUBMITTED",
      entityType: "shift_claim",
      entityId: id,
      after: { shiftId: input.shiftId, auto },
    });
    const rows = await listClaims(ctx, { mine: true });
    const found = rows.find((c) => c.id === id);
    if (!found) throw new AppError("Claim created but could not be reloaded.");
    return found;
  });
}

export async function releaseAssignedShift(
  ctx: SessionContext,
  input: { shiftId: string; note?: string },
): Promise<ShiftClaim> {
  const shift = await getShift(ctx, input.shiftId);
  if (shift.employeeId !== ctx.membership.id) {
    throw new ConflictError("You can only release a shift assigned to you.");
  }
  const id = nid("clm");
  const auto = ctx.organization.claimApprovalMode === "AUTO";
  await q(
    `insert into shift_claims (
       id, organization_id, shift_id, membership_id, type, status, note
     ) values ($1,$2,$3,$4,'RELEASE',$5,$6)`,
    [id, ctx.organization.id, input.shiftId, ctx.membership.id, auto ? "APPROVED" : "PENDING", input.note ?? null],
  );
  if (auto) {
    await applyClaim(ctx, id, "APPROVED");
  } else {
    await notify({
      organizationId: ctx.organization.id,
      recipientIds: await managerIds(ctx.organization.id),
      type: "CLAIM_SUBMITTED",
      title: "Shift release requested",
      message: `${ctx.membership.displayName} asked to release ${shift.date} ${shift.locationName ?? ""}.`,
    });
  }
  await audit({ ctx, action: "RELEASE_SUBMITTED", entityType: "shift_claim", entityId: id });
  const rows = await listClaims(ctx, { mine: true });
  const found = rows.find((c) => c.id === id);
  if (!found) throw new AppError("Release created but could not be reloaded.");
  return found;
}

export async function reviewClaim(
  ctx: SessionContext,
  input: { claimId: string; approve: boolean },
): Promise<ShiftClaim> {
  assertManager(ctx);
  const row = await qOne<Record<string, unknown>>(
    `select * from shift_claims where id = $1 and organization_id = $2`,
    [input.claimId, ctx.organization.id],
  );
  if (!row) throw new NotFoundError("Claim not found.");
  return withTransaction(async () => {
    const locked = await q<{ id: string }>(
      `select id from memberships where id = $1 and organization_id = $2 for update`,
      [str(row.membership_id), ctx.organization.id],
    );
    if (!locked.length) throw new NotFoundError("Staff member not found.");
    const latest = await qOne<Record<string, unknown>>(
      `select * from shift_claims where id = $1 and organization_id = $2 for update`,
      [input.claimId, ctx.organization.id],
    );
    if (!latest || str(latest.status) !== "PENDING") {
      throw new ConflictError("Claim is no longer pending.");
    }

  const status: ShiftClaimStatus = input.approve ? "APPROVED" : "REJECTED";
  if (input.approve) {
    if (str(row.type) === "CLAIM") {
      const check = await evaluateAssignment(ctx, str(row.membership_id), str(row.shift_id));
      if (!check.ok) throw new ConstraintError(check.violations);
    }
    await applyClaim(ctx, input.claimId, status);
  } else {
    await q(
      `update shift_claims
          set status = 'REJECTED', reviewed_by_id = $1, reviewed_at = now(), updated_at = now()
        where id = $2 and organization_id = $3 and status = 'PENDING'
        returning id`,
      [ctx.membership.id, input.claimId, ctx.organization.id],
    );
  }
  await notify({
    organizationId: ctx.organization.id,
    recipientIds: [str(row.membership_id)],
    type: "CLAIM_DECIDED",
    title: input.approve ? "Claim approved" : "Claim declined",
    message: input.approve
      ? "Your shift claim was approved."
      : "Your shift claim was declined.",
  });
  await audit({
    ctx,
    action: input.approve ? "CLAIM_APPROVED" : "CLAIM_REJECTED",
    entityType: "shift_claim",
    entityId: input.claimId,
  });
  const all = await listClaims(ctx, {});
  const found = all.find((c) => c.id === input.claimId);
  if (!found) throw new NotFoundError("Claim not found after review.");
  return found;
  });
}

export async function cancelClaim(ctx: SessionContext, claimId: string): Promise<void> {
  const row = await qOne<Record<string, unknown>>(
    `select * from shift_claims where id = $1 and organization_id = $2`,
    [claimId, ctx.organization.id],
  );
  if (!row) throw new NotFoundError("Claim not found.");
  if (str(row.membership_id) !== ctx.membership.id) {
    assertManager(ctx);
  }
  if (str(row.status) !== "PENDING") throw new ConflictError("Only pending claims can be cancelled.");
  await q(
    `update shift_claims set status = 'CANCELLED', updated_at = now() where id = $1`,
    [claimId],
  );
  await audit({ ctx, action: "CLAIM_CANCELLED", entityType: "shift_claim", entityId: claimId });
}

async function applyClaim(ctx: SessionContext, claimId: string, status: ShiftClaimStatus) {
  // Call inside withTransaction with the affected staff member locked first.
  const row = await qOne<Record<string, unknown>>(
    `select * from shift_claims where id = $1 and organization_id = $2 for update`,
    [claimId, ctx.organization.id],
  );
  if (!row) throw new NotFoundError("Claim not found.");
  if (!["PENDING", "APPROVED"].includes(str(row.status))) {
    throw new ConflictError("Claim is no longer actionable.");
  }
  const memberId = str(row.membership_id);
  const shiftId = str(row.shift_id);
  if (str(row.type) === "CLAIM") {
    const check = await evaluateAssignment(ctx, memberId, shiftId);
    if (!check.ok) throw new ConstraintError(check.violations);
  }
  const assigned = str(row.type) === "CLAIM";
  const changed = await q<{ id: string }>(
    assigned
      ? `update shifts
           set employee_id = $1, status = 'ASSIGNED', is_open_for_claim = false,
               version = version + 1, updated_at = now()
         where id = $2 and organization_id = $3 and employee_id is null
           and status = 'OPEN' and is_open_for_claim = true
         returning id`
      : `update shifts
           set employee_id = null, status = 'OPEN', is_open_for_claim = true,
               version = version + 1, updated_at = now()
         where id = $2 and organization_id = $3 and employee_id = $1
           and status = 'ASSIGNED'
         returning id`,
    [memberId, shiftId, ctx.organization.id],
  );
  if (!changed.length) {
    throw new ConflictError("Shift is no longer available for this claim. Reload and retry.");
  }
  const updated = await q<{ id: string }>(
    `update shift_claims
        set status = $1, reviewed_by_id = $2, reviewed_at = now(), updated_at = now()
      where id = $3 and organization_id = $4 and status in ('PENDING', 'APPROVED')
      returning id`,
    [status, ctx.membership.id, claimId, ctx.organization.id],
  );
  if (!updated.length) throw new ConflictError("Claim was already processed.");
}
