import { nid } from "../ids";
import { dateStr, num, numOrNull, q, str } from "../db.server";
import { assertManager } from "../context.server";
import { audit } from "../audit.server";
import type { CensusSnapshot, SessionContext, ShiftWindow } from "../types";

export async function listCensus(
  ctx: SessionContext,
  input: { locationId?: string; from?: string; to?: string } = {},
): Promise<CensusSnapshot[]> {
  const params: unknown[] = [ctx.organization.id];
  let where = "organization_id = $1";
  if (input.locationId) {
    params.push(input.locationId);
    where += ` and location_id = $${params.length}`;
  }
  if (input.from) {
    params.push(input.from);
    where += ` and date >= $${params.length}`;
  }
  if (input.to) {
    params.push(input.to);
    where += ` and date <= $${params.length}`;
  }
  const rows = await q<Record<string, unknown>>(
    `select * from unit_census_snapshots where ${where} order by date desc, shift_window`,
    params,
  );
  return rows.map((r) => ({
    id: str(r.id),
    organizationId: str(r.organization_id),
    locationId: str(r.location_id),
    date: dateStr(r.date),
    shiftWindow: str(r.shift_window) as ShiftWindow,
    patientCount: num(r.patient_count),
    averageAcuity: numOrNull(r.average_acuity),
  }));
}

export async function recordCensus(
  ctx: SessionContext,
  input: {
    locationId: string;
    date: string;
    shiftWindow: ShiftWindow | string;
    patientCount: number;
    averageAcuity?: number | null;
  },
): Promise<CensusSnapshot> {
  assertManager(ctx);
  if (!Number.isFinite(input.patientCount) || input.patientCount < 0) {
    throw new Error("patientCount must be a non-negative aggregate count.");
  }
  const id = nid("cen");
  await q(
    `insert into unit_census_snapshots (
       id, organization_id, location_id, date, shift_window, patient_count, average_acuity, recorded_by_id
     ) values ($1,$2,$3,$4,$5,$6,$7,$8)
     on conflict (organization_id, location_id, date, shift_window)
     do update set patient_count = excluded.patient_count,
                   average_acuity = excluded.average_acuity`,
    [
      id,
      ctx.organization.id,
      input.locationId,
      input.date,
      input.shiftWindow,
      Math.round(input.patientCount),
      input.averageAcuity ?? null,
      ctx.membership.id,
    ],
  );
  await audit({
    ctx,
    action: "CENSUS_RECORDED",
    entityType: "unit_census_snapshot",
    entityId: id,
    after: {
      locationId: input.locationId,
      date: input.date,
      shiftWindow: input.shiftWindow,
      patientCount: input.patientCount,
      averageAcuity: input.averageAcuity ?? null,
    },
  });
  const rows = await listCensus(ctx, {
    locationId: input.locationId,
    from: input.date,
    to: input.date,
  });
  return rows.find((r) => r.shiftWindow === input.shiftWindow) ?? rows[0];
}
