/**
 * Handover notes. `freeTextNote` is stored and returned to authorized org
 * members for clinical continuity — it is NEVER imported by lib/ai and is
 * redacted from audit payloads. Structured counts are safe to aggregate.
 */

import { nid } from "../ids";
import { bool, iso, num, q, qOne, str, strOrNull } from "../db.server";
import { audit } from "../audit.server";
import { notify } from "../notify.server";
import { ForbiddenError, NotFoundError } from "../errors";
import { getShift } from "./shifts.server";
import type { HandoverNote, SessionContext } from "../types";

function mapNote(r: Record<string, unknown>): HandoverNote {
  return {
    id: str(r.id),
    organizationId: str(r.organization_id),
    shiftId: str(r.shift_id),
    locationId: str(r.location_id),
    authorId: str(r.author_id),
    pendingTasksCount: num(r.pending_tasks_count),
    criticalAlertsCount: num(r.critical_alerts_count),
    equipmentIssuesFlag: bool(r.equipment_issues_flag),
    freeTextNote: strOrNull(r.free_text_note),
    acknowledgedById: strOrNull(r.acknowledged_by_id),
    acknowledgedAt: r.acknowledged_at ? iso(r.acknowledged_at) : null,
    createdAt: iso(r.created_at),
    authorName: strOrNull(r.author_name) ?? undefined,
    locationName: strOrNull(r.location_name) ?? undefined,
  };
}

export async function listHandovers(
  ctx: SessionContext,
  filters: { locationId?: string; unackedOnly?: boolean; limit?: number } = {},
): Promise<HandoverNote[]> {
  const params: unknown[] = [ctx.organization.id];
  let where = "h.organization_id = $1";
  if (filters.locationId) {
    params.push(filters.locationId);
    where += ` and h.location_id = $${params.length}`;
  }
  if (filters.unackedOnly) where += " and h.acknowledged_at is null";
  params.push(Math.min(filters.limit ?? 40, 100));
  const rows = await q<Record<string, unknown>>(
    `select h.*, m.display_name as author_name, l.name as location_name
       from handover_notes h
       join memberships m on m.id = h.author_id
       join locations l on l.id = h.location_id
      where ${where}
      order by h.created_at desc
      limit $${params.length}`,
    params,
  );
  return rows.map(mapNote);
}

export async function createHandover(
  ctx: SessionContext,
  input: {
    shiftId: string;
    pendingTasksCount: number;
    criticalAlertsCount: number;
    equipmentIssuesFlag: boolean;
    freeTextNote?: string | null;
  },
): Promise<HandoverNote> {
  const shift = await getShift(ctx, input.shiftId);
  if (shift.employeeId && shift.employeeId !== ctx.membership.id) {
    const { isManager } = await import("../context.server");
    if (!isManager(ctx.membership.role)) {
      throw new ForbiddenError("Only the assigned nurse or a manager can file this handover.");
    }
  }
  const id = nid("hnd");
  await q(
    `insert into handover_notes (
       id, organization_id, shift_id, location_id, author_id,
       pending_tasks_count, critical_alerts_count, equipment_issues_flag, free_text_note
     ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      id,
      ctx.organization.id,
      input.shiftId,
      shift.locationId,
      ctx.membership.id,
      input.pendingTasksCount,
      input.criticalAlertsCount,
      input.equipmentIssuesFlag,
      input.freeTextNote ?? null,
    ],
  );
  const oncoming = await q<{ employee_id: string }>(
    `select employee_id from shifts
      where organization_id = $1 and location_id = $2 and date >= $3
        and employee_id is not null and id <> $4
      order by start_at asc limit 3`,
    [ctx.organization.id, shift.locationId, shift.date, shift.id],
  );
  await notify({
    organizationId: ctx.organization.id,
    recipientIds: oncoming.map((r) => r.employee_id),
    type: "HANDOVER_READY",
    title: "Handover ready",
    message: `${shift.locationName ?? "Unit"} left a structured handover (${input.criticalAlertsCount} critical, ${input.pendingTasksCount} pending).`,
    link: "/app?view=handover",
  });
  await audit({
    ctx,
    action: "HANDOVER_CREATED",
    entityType: "handover_note",
    entityId: id,
    after: {
      pendingTasksCount: input.pendingTasksCount,
      criticalAlertsCount: input.criticalAlertsCount,
      equipmentIssuesFlag: input.equipmentIssuesFlag,
    },
  });
  return (await listHandovers(ctx, {})).find((h) => h.id === id)!;
}

export async function acknowledgeHandover(
  ctx: SessionContext,
  handoverId: string,
): Promise<HandoverNote> {
  const row = await qOne<Record<string, unknown>>(
    `select * from handover_notes where id = $1 and organization_id = $2`,
    [handoverId, ctx.organization.id],
  );
  if (!row) throw new NotFoundError("Handover not found.");
  await q(
    `update handover_notes
        set acknowledged_by_id = $1, acknowledged_at = now(), updated_at = now()
      where id = $2`,
    [ctx.membership.id, handoverId],
  );
  await audit({ ctx, action: "HANDOVER_ACKED", entityType: "handover_note", entityId: handoverId });
  return (await listHandovers(ctx, {})).find((h) => h.id === handoverId)!;
}

/** Structured-only projection — the only shape intelligence code is allowed to see. */
export function toStructuredHandover(note: HandoverNote) {
  return {
    id: note.id,
    locationId: note.locationId,
    pendingTasksCount: note.pendingTasksCount,
    criticalAlertsCount: note.criticalAlertsCount,
    equipmentIssuesFlag: note.equipmentIssuesFlag,
    acknowledged: Boolean(note.acknowledgedAt),
  };
}
