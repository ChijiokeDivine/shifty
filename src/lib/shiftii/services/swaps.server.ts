import { nid } from "../ids";
import { iso, q, qOne, str, strOrNull } from "../db.server";
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
  const row = await qOne<Record<string, unknown>>(
    `select * from shift_swap_requests where id = $1 and organization_id = $2`,
    [input.swapId, ctx.organization.id],
  );
  if (!row) throw new NotFoundError("Swap not found.");
  if (str(row.target_membership_id) !== ctx.membership.id) {
    throw new ForbiddenError("Only the target can respond.");
  }
  if (str(row.status) !== "PENDING_TARGET") throw new ConflictError("Swap is not waiting on you.");

  if (!input.accept) {
    await q(
      `update shift_swap_requests
          set status = 'DECLINED', target_responded_at = now(), updated_at = now()
        where id = $1`,
      [input.swapId],
    );
    await notify({
      organizationId: ctx.organization.id,
      recipientIds: [str(row.initiator_membership_id)],
      type: "SWAP_TARGET_RESPONDED",
      title: "Swap declined",
      message: `${ctx.membership.displayName} declined the swap.`,
    });
  } else {
    const auto = ctx.organization.swapApprovalMode === "AUTO";
    const next: ShiftSwapStatus = auto ? "APPROVED" : "PENDING_MANAGER";
    await q(
      `update shift_swap_requests
          set status = $1, target_responded_at = now(), updated_at = now()
        where id = $2`,
      [next, input.swapId],
    );
    if (auto) {
      await executeSwap(ctx, input.swapId);
    } else {
      await notify({
        organizationId: ctx.organization.id,
        recipientIds: await managerIds(ctx.organization.id),
        type: "SWAP_TARGET_RESPONDED",
        title: "Swap ready for approval",
        message: "Both nurses agreed. Waiting on manager approval.",
      });
    }
    await notify({
      organizationId: ctx.organization.id,
      recipientIds: [str(row.initiator_membership_id)],
      type: "SWAP_TARGET_RESPONDED",
      title: "Swap accepted",
      message: auto
        ? "The other nurse accepted — swap is complete."
        : "The other nurse accepted. Waiting on a manager.",
    });
  }
  await audit({
    ctx,
    action: input.accept ? "SWAP_TARGET_ACCEPTED" : "SWAP_DECLINED",
    entityType: "shift_swap",
    entityId: input.swapId,
  });
  return (await listSwaps(ctx, {})).find((s) => s.id === input.swapId)!;
}

export async function reviewSwap(
  ctx: SessionContext,
  input: { swapId: string; approve: boolean },
): Promise<ShiftSwap> {
  assertManager(ctx);
  const row = await qOne<Record<string, unknown>>(
    `select * from shift_swap_requests where id = $1 and organization_id = $2`,
    [input.swapId, ctx.organization.id],
  );
  if (!row) throw new NotFoundError("Swap not found.");
  if (str(row.status) !== "PENDING_MANAGER" && str(row.status) !== "TARGET_ACCEPTED") {
    throw new ConflictError("Swap is not waiting on a manager.");
  }
  if (input.approve) {
    await executeSwap(ctx, input.swapId);
    await q(
      `update shift_swap_requests
          set status = 'APPROVED', reviewed_by_id = $1, reviewed_at = now(), updated_at = now()
        where id = $2`,
      [ctx.membership.id, input.swapId],
    );
  } else {
    await q(
      `update shift_swap_requests
          set status = 'REJECTED', reviewed_by_id = $1, reviewed_at = now(), updated_at = now()
        where id = $2`,
      [ctx.membership.id, input.swapId],
    );
  }
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
  return (await listSwaps(ctx, {})).find((s) => s.id === input.swapId)!;
}

export async function cancelSwap(ctx: SessionContext, swapId: string): Promise<void> {
  const row = await qOne<Record<string, unknown>>(
    `select * from shift_swap_requests where id = $1 and organization_id = $2`,
    [swapId, ctx.organization.id],
  );
  if (!row) throw new NotFoundError("Swap not found.");
  if (str(row.initiator_membership_id) !== ctx.membership.id) assertManager(ctx);
  const st = str(row.status);
  if (st === "APPROVED" || st === "CANCELLED") throw new ConflictError("Cannot cancel this swap.");
  await q(
    `update shift_swap_requests set status = 'CANCELLED', updated_at = now() where id = $1`,
    [swapId],
  );
  await audit({ ctx, action: "SWAP_CANCELLED", entityType: "shift_swap", entityId: swapId });
}

async function executeSwap(ctx: SessionContext, swapId: string) {
  const row = await qOne<Record<string, unknown>>(
    `select * from shift_swap_requests where id = $1`,
    [swapId],
  );
  if (!row) throw new NotFoundError("Swap not found.");
  const initiatorId = str(row.initiator_membership_id);
  const targetId = str(row.target_membership_id);
  const initiatorShift = str(row.initiator_shift_id);
  const targetShift = str(row.target_shift_id);

  // Temporarily clear so overlap checks don't see "self".
  await q(
    `update shifts set employee_id = null, status = 'OPEN', version = version + 1
      where id in ($1,$2) and organization_id = $3`,
    [initiatorShift, targetShift, ctx.organization.id],
  );

  const a = await evaluateAssignment(ctx, targetId, initiatorShift);
  const b = await evaluateAssignment(ctx, initiatorId, targetShift);
  if (!a.ok || !b.ok) {
    await q(
      `update shifts set employee_id = $1, status = 'ASSIGNED' where id = $2`,
      [initiatorId, initiatorShift],
    );
    await q(
      `update shifts set employee_id = $1, status = 'ASSIGNED' where id = $2`,
      [targetId, targetShift],
    );
    throw new ConstraintError([
      ...(a.ok ? [] : a.violations.map((v) => `Incoming for target: ${v}`)),
      ...(b.ok ? [] : b.violations.map((v) => `Incoming for initiator: ${v}`)),
    ]);
  }
  await q(
    `update shifts set employee_id = $1, status = 'ASSIGNED', is_open_for_claim = false, version = version + 1
      where id = $2`,
    [targetId, initiatorShift],
  );
  await q(
    `update shifts set employee_id = $1, status = 'ASSIGNED', is_open_for_claim = false, version = version + 1
      where id = $2`,
    [initiatorId, targetShift],
  );
}
