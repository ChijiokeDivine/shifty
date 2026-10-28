import { nid } from "../ids";
import { iso, q, qOne, str, strOrNull, withTransaction } from "../db.server";
import { assertManager } from "../context.server";
import { audit } from "../audit.server";
import { managerIds, notify } from "../notify.server";
import { AppError, ConflictError, ConstraintError, ForbiddenError, NotFoundError } from "../errors";
import { evaluateAssignment } from "../eligibility.server";
import { getShift } from "./shifts.server";
import type { SessionContext, ShiftSwap, ShiftSwapStatus } from "../types";

function mapSwap(r: Record<string, unknown>): ShiftSwap {
  return {
    id: str(r.id),
    organizationId: str(r.organization_id),
    initiatorMembershipId: str(r.initiator_membership_id),
    initiatorShiftId: str(r.initiator_shift_id),
    targetMembershipId: str(r.target_membership_id),
    targetShiftId: str(r.target_shift_id),
    status: str(r.status) as ShiftSwapStatus,
    note: strOrNull(r.note),
    createdAt: iso(r.created_at),
    initiatorName: strOrNull(r.initiator_name) ?? undefined,
    targetName: strOrNull(r.target_name) ?? undefined,
  };
}

export async function listSwaps(
  ctx: SessionContext,
  filters: { status?: ShiftSwapStatus; mine?: boolean } = {},
): Promise<ShiftSwap[]> {
  const params: unknown[] = [ctx.organization.id];
  let where = "s.organization_id = $1";
  if (filters.status) {
    params.push(filters.status);
    where += ` and s.status = $${params.length}`;
  }
  if (filters.mine) {
    params.push(ctx.membership.id);
    where += ` and (s.initiator_membership_id = $${params.length} or s.target_membership_id = $${params.length})`;
  }
  const rows = await q<Record<string, unknown>>(
    `select s.*,
            i.display_name as initiator_name,
            t.display_name as target_name
       from shift_swap_requests s
       join memberships i on i.id = s.initiator_membership_id
       join memberships t on t.id = s.target_membership_id
      where ${where}
      order by s.created_at desc`,
    params,
  );
  return rows.map(mapSwap);
}

export async function proposeSwap(
  ctx: SessionContext,
  input: { initiatorShiftId: string; targetShiftId: string; note?: string },
): Promise<ShiftSwap> {
  const mine = await getShift(ctx, input.initiatorShiftId);
  const theirs = await getShift(ctx, input.targetShiftId);
  if (mine.employeeId !== ctx.membership.id) {
    throw new ForbiddenError("You can only swap a shift assigned to you.");
  }
  if (!theirs.employeeId) throw new ConflictError("Target shift has no assignee.");
  if (theirs.employeeId === ctx.membership.id) {
    throw new ConflictError("Pick someone else's shift to swap with.");
  }
  if (mine.status === "CANCELLED" || theirs.status === "CANCELLED") {
    throw new ConflictError("Cannot swap a cancelled shift.");
  }

  const id = nid("swp");
  await q(
    `insert into shift_swap_requests (
       id, organization_id, initiator_membership_id, initiator_shift_id,
       target_membership_id, target_shift_id, status, note
     ) values ($1,$2,$3,$4,$5,$6,'PENDING_TARGET',$7)`,
    [
      id,
      ctx.organization.id,
      ctx.membership.id,
      input.initiatorShiftId,
      theirs.employeeId,
      input.targetShiftId,
      input.note ?? null,
    ],
  );
  await notify({
    organizationId: ctx.organization.id,
    recipientIds: [theirs.employeeId],
    type: "SWAP_REQUESTED",
    title: "Shift swap request",
    message: `${ctx.membership.displayName} wants to swap ${mine.date} for your ${theirs.date} shift.`,
    link: "/app?view=swaps",
  });
  await audit({ ctx, action: "SWAP_PROPOSED", entityType: "shift_swap", entityId: id });
  const all = await listSwaps(ctx, { mine: true });
  const found = all.find((s) => s.id === id);
  if (!found) throw new AppError("Swap created but could not be reloaded.");
  return found;
}

export async function respondToSwap(
  ctx: SessionContext,
  input: { swapId: string; accept: boolean },
): Promise<ShiftSwap> {
  return withTransaction(async () => {
    const row = await lockSwap(ctx, input.swapId);
    if (str(row.target_membership_id) !== ctx.membership.id) {
      throw new ForbiddenError("Only the target can respond.");
    }
    if (str(row.status) !== "PENDING_TARGET") {
      throw new ConflictError("Swap is no longer waiting on you.");
    }

    const auto = input.accept && ctx.organization.swapApprovalMode === "AUTO";
    // Do the actual reassignment BEFORE recording approval. If eligibility
    // fails, the transaction rolls back the swap request and both shifts.
    if (auto) await executeSwap(ctx, row);

    const status: ShiftSwapStatus = input.accept
      ? auto ? "APPROVED" : "PENDING_MANAGER"
      : "DECLINED";
    await q(
      `update shift_swap_requests
          set status = $1, target_responded_at = now(), updated_at = now()
        where id = $2 and organization_id = $3`,
      [status, input.swapId, ctx.organization.id],
    );

    if (input.accept && !auto) {
      await notify({
        organizationId: ctx.organization.id,
        recipientIds: await managerIds(ctx.organization.id),
        type: "SWAP_TARGET_RESPONDED",
        title: "Swap ready for approval",
        message: "Both employees agreed. Waiting on manager approval.",
      });
    }
    await notify({
      organizationId: ctx.organization.id,
      recipientIds: [str(row.initiator_membership_id)],
      type: "SWAP_TARGET_RESPONDED",
      title: input.accept ? "Swap accepted" : "Swap declined",
      message: input.accept
        ? auto ? "Your shift swap is complete." : "The swap is waiting for manager approval."
        : "The other employee declined your shift swap.",
    });
    await audit({
      ctx,
      action: input.accept ? "SWAP_TARGET_ACCEPTED" : "SWAP_DECLINED",
      entityType: "shift_swap",
      entityId: input.swapId,
    });
    const found = (await listSwaps(ctx, {})).find((swap) => swap.id === input.swapId);
    if (!found) throw new NotFoundError("Swap not found after response.");
    return found;
  });
}

export async function reviewSwap(
  ctx: SessionContext,
  input: { swapId: string; approve: boolean },
): Promise<ShiftSwap> {
  assertManager(ctx);
  return withTransaction(async () => {
    const row = await lockSwap(ctx, input.swapId);
    if (!["PENDING_MANAGER", "TARGET_ACCEPTED"].includes(str(row.status))) {
      throw new ConflictError("Swap is not waiting on a manager.");
    }
    if (input.approve) await executeSwap(ctx, row);

    await q(
      `update shift_swap_requests
          set status = $1, reviewed_by_id = $2, reviewed_at = now(), updated_at = now()
        where id = $3 and organization_id = $4`,
      [input.approve ? "APPROVED" : "REJECTED", ctx.membership.id, input.swapId, ctx.organization.id],
    );
    await notify({
      organizationId: ctx.organization.id,
      recipientIds: [str(row.initiator_membership_id), str(row.target_membership_id)],
      type: "SWAP_DECIDED",
      title: input.approve ? "Swap approved" : "Swap rejected",
      message: input.approve ? "Your swap is on the roster." : "A manager declined the swap.",
    });
    await audit({
      ctx,
      action: input.approve ? "SWAP_APPROVED" : "SWAP_REJECTED",
      entityType: "shift_swap",
      entityId: input.swapId,
    });
    const found = (await listSwaps(ctx, {})).find((swap) => swap.id === input.swapId);
    if (!found) throw new NotFoundError("Swap not found after review.");
    return found;
  });
}

export async function cancelSwap(ctx: SessionContext, swapId: string): Promise<void> {
  await withTransaction(async () => {
    const row = await qOne<Record<string, unknown>>(
      `select * from shift_swap_requests where id = $1 and organization_id = $2 for update`,
      [swapId, ctx.organization.id],
    );
    if (!row) throw new NotFoundError("Swap not found.");
    if (str(row.initiator_membership_id) !== ctx.membership.id) assertManager(ctx);
    if (!["PENDING_TARGET", "PENDING_MANAGER", "TARGET_ACCEPTED"].includes(str(row.status))) {
      throw new ConflictError("Only pending swaps can be cancelled.");
    }
    await q(
      `update shift_swap_requests set status = 'CANCELLED', updated_at = now()
        where id = $1 and organization_id = $2`,
      [swapId, ctx.organization.id],
    );
    await audit({ ctx, action: "SWAP_CANCELLED", entityType: "shift_swap", entityId: swapId });
  });
}

/**
 * Lock both staff members first, then both shifts, then the request.
 * All mutating swap operations share this order, preventing concurrent
 * approvals from acting on stale assignments.
 */
async function lockSwap(ctx: SessionContext, swapId: string): Promise<Record<string, unknown>> {
  const candidate = await qOne<Record<string, unknown>>(
    `select * from shift_swap_requests where id = $1 and organization_id = $2`,
    [swapId, ctx.organization.id],
  );
  if (!candidate) throw new NotFoundError("Swap not found.");
  const members = [str(candidate.initiator_membership_id), str(candidate.target_membership_id)].sort();
  const lockedMembers = await q<{ id: string }>(
    `select id from memberships
      where id in ($1,$2) and organization_id = $3
      order by id for update`,
    [members[0], members[1], ctx.organization.id],
  );
  if (lockedMembers.length !== 2) throw new ConflictError("Swap staff membership has changed.");

  const shifts = [str(candidate.initiator_shift_id), str(candidate.target_shift_id)].sort();
  const lockedShifts = await q<{ id: string }>(
    `select id from shifts
      where id in ($1,$2) and organization_id = $3
      order by id for update`,
    [shifts[0], shifts[1], ctx.organization.id],
  );
  if (lockedShifts.length !== 2) throw new ConflictError("One of the swap shifts is missing.");

  const row = await qOne<Record<string, unknown>>(
    `select * from shift_swap_requests where id = $1 and organization_id = $2 for update`,
    [swapId, ctx.organization.id],
  );
  if (!row) throw new NotFoundError("Swap not found.");
  // Request participants and shifts must remain unchanged since the initial read.
  for (const key of ["initiator_membership_id", "target_membership_id", "initiator_shift_id", "target_shift_id"]) {
    if (str(candidate[key]) !== str(row[key])) {
      throw new ConflictError("Swap participants changed. Reload and retry.");
    }
  }
  return row;
}

/** Must run inside the transaction opened by respondToSwap or reviewSwap. */
async function executeSwap(ctx: SessionContext, row: Record<string, unknown>): Promise<void> {
  const initiatorId = str(row.initiator_membership_id);
  const targetId = str(row.target_membership_id);
  const initiatorShiftId = str(row.initiator_shift_id);
  const targetShiftId = str(row.target_shift_id);

  const shifts = await q<{ id: string; employee_id: string | null; status: string }>(
    `select id, employee_id, status from shifts
      where id in ($1,$2) and organization_id = $3`,
    [initiatorShiftId, targetShiftId, ctx.organization.id],
  );
  const initiator = shifts.find((shift) => shift.id === initiatorShiftId);
  const target = shifts.find((shift) => shift.id === targetShiftId);
  if (
    !initiator || !target ||
    initiator.status !== "ASSIGNED" || target.status !== "ASSIGNED" ||
    initiator.employee_id !== initiatorId || target.employee_id !== targetId
  ) {
    throw new ConflictError("Shift assignments have changed since the swap was proposed.");
  }

  // Within one transaction, temporarily remove both old assignments so
  // eligibility checks evaluate the incoming staff without false overlaps.
  await q(
    `update shifts
        set employee_id = null, status = 'DRAFT', is_open_for_claim = false,
            version = version + 1, updated_at = now()
      where id in ($1,$2) and organization_id = $3`,
    [initiatorShiftId, targetShiftId, ctx.organization.id],
  );
  // Use one query at a time on the transaction's single database connection.
  const incomingTarget = await evaluateAssignment(ctx, targetId, initiatorShiftId);
  const incomingInitiator = await evaluateAssignment(ctx, initiatorId, targetShiftId);
  if (!incomingTarget.ok || !incomingInitiator.ok) {
    // Throwing rolls back BOTH temporary removals, instead of trying to
    // repair the shifts with separate best-effort updates.
    throw new ConstraintError([
      ...(incomingTarget.ok ? [] : incomingTarget.violations.map((v) => `Incoming for target: ${v}`)),
      ...(incomingInitiator.ok ? [] : incomingInitiator.violations.map((v) => `Incoming for initiator: ${v}`)),
    ]);
  }

  const incoming = [
    { shiftId: initiatorShiftId, membershipId: targetId },
    { shiftId: targetShiftId, membershipId: initiatorId },
  ];
  for (const assignment of incoming) {
    const applied = await q<{ id: string }>(
      `update shifts
          set employee_id = $1, status = 'ASSIGNED', is_open_for_claim = false,
              version = version + 1, updated_at = now()
        where id = $2 and organization_id = $3 and employee_id is null
          and status = 'DRAFT'
        returning id`,
      [assignment.membershipId, assignment.shiftId, ctx.organization.id],
    );
    if (applied.length !== 1) throw new ConflictError("Swap assignment changed unexpectedly.");
  }
}

