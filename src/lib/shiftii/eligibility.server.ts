import { checkAssignment, type ConstraintInput } from "@/lib/local-ml/constraints";
import type { AssignmentCheck, StaffPreferences } from "./types";
import { addDays } from "./time";
import { minutesOfDayInZone } from "./local-time";
import { bool, dateStr, iso, json, num, q, str } from "./db.server";
import { NotFoundError } from "./errors";
import type { SessionContext } from "./types";

export async function loadConstraintInput(opts: {
  ctx: SessionContext;
  membershipId: string;
  shiftId: string;
}): Promise<{ input: ConstraintInput; displayName: string; role: string; missing: string[] }> {
  const shift = await q<Record<string, unknown>>(
    `select s.*, l.unit_type
       from shifts s
       join locations l on l.id = s.location_id
      where s.id = $1 and s.organization_id = $2`,
    [opts.shiftId, opts.ctx.organization.id],
  );
  if (!shift[0]) throw new NotFoundError("Shift not found.");
  const s = shift[0];

  const mem = await q<Record<string, unknown>>(
    `select * from memberships where id = $1 and organization_id = $2`,
    [opts.membershipId, opts.ctx.organization.id],
  );
  if (!mem[0]) throw new NotFoundError("Staff member not found.");
  const m = mem[0];

  const pos = await q<{ position_id: string }>(
    `select position_id from employee_positions where membership_id = $1`,
    [opts.membershipId],
  );
  const locs = await q<{ location_id: string }>(
    `select location_id from membership_locations where membership_id = $1`,
    [opts.membershipId],
  );

  const required = await q<{ name: string; credential_type_id: string }>(
    `select ct.name, pcr.credential_type_id
       from position_credential_requirements pcr
       join credential_types ct on ct.id = pcr.credential_type_id
      where pcr.position_id = $1`,
    [str(s.position_id)],
  );
  const held = await q<{ credential_type_id: string; expires_at: string | null }>(
    `select credential_type_id, expires_at::text as expires_at
       from employee_credentials where membership_id = $1`,
    [opts.membershipId],
  );
  const heldOk = new Set(
    held
      .filter((h) => !h.expires_at || dateStr(h.expires_at) >= dateStr(s.date))
      .map((h) => str(h.credential_type_id)),
  );
  const missing = required.filter((r) => !heldOk.has(str(r.credential_type_id))).map((r) => str(r.name));

  const existing = await q<Record<string, unknown>>(
    `select id, start_at, end_at, date, break_minutes
       from shifts
      where organization_id = $1 and employee_id = $2 and status = 'ASSIGNED'`,
    [opts.ctx.organization.id, opts.membershipId],
  );

  const leave = await q<{ start_date: string; end_date: string }>(
    `select start_date::text as start_date, end_date::text as end_date
       from leave_requests
      where organization_id = $1 and membership_id = $2 and status = 'APPROVED'`,
    [opts.ctx.organization.id, opts.membershipId],
  );

  const shiftDate = dateStr(s.date);
  const startMin = minutesOfDayInZone(iso(s.start_at), opts.ctx.organization.timezone);
  const blocked = await isAvailabilityBlocked(opts.membershipId, shiftDate, startMin);

  const input: ConstraintInput = {
    timezone: opts.ctx.organization.timezone,
    minRestHours: opts.ctx.organization.minRestHoursBetweenShifts,
    maxWeeklyHours: opts.ctx.organization.maxWeeklyHours,
    shift: {
      id: str(s.id),
      date: shiftDate,
      startAt: iso(s.start_at),
      endAt: iso(s.end_at),
      breakMinutes: num(s.break_minutes),
      locationId: str(s.location_id),
      positionId: str(s.position_id),
    },
    candidate: {
      membershipId: opts.membershipId,
      status: str(m.status),
      positionIds: pos.map((p) => str(p.position_id)),
      locationIds: locs.map((l) => str(l.location_id)),
      preferences: json<StaffPreferences>(m.preferences, {}),
    },
    existingShifts: existing.map((e) => ({
      id: str(e.id),
      startAt: iso(e.start_at),
      endAt: iso(e.end_at),
      date: dateStr(e.date),
      breakMinutes: num(e.break_minutes),
    })),
    leave: leave.map((l) => ({ startDate: dateStr(l.start_date), endDate: dateStr(l.end_date) })),
    availabilityBlocked: blocked,
    credentialOk: missing.length === 0,
    missingCredentials: missing,
  };

  return {
    input,
    displayName: str(m.display_name),
    role: str(m.role),
    missing,
  };
}

export async function evaluateAssignment(
  ctx: SessionContext,
  membershipId: string,
  shiftId: string,
): Promise<AssignmentCheck & { displayName: string; missingCredentials: string[] }> {
  const loaded = await loadConstraintInput({ ctx, membershipId, shiftId });
  const check = checkAssignment(loaded.input);
  return { ...check, displayName: loaded.displayName, missingCredentials: loaded.missing };
}

async function isAvailabilityBlocked(
  membershipId: string,
  date: string,
  startMinute: number,
): Promise<boolean> {
  const exceptions = await q<Record<string, unknown>>(
    `select is_available, start_minute, end_minute
       from availability_exceptions
      where membership_id = $1 and date = $2`,
    [membershipId, date],
  );
  for (const ex of exceptions) {
    const from = ex.start_minute == null ? 0 : num(ex.start_minute);
    const to = ex.end_minute == null ? 24 * 60 : num(ex.end_minute);
    const covers = minuteCovers(from, to, startMinute);
    if (covers && !bool(ex.is_available)) return true;
    if (covers && bool(ex.is_available)) return false;
  }
  const dow = new Date(`${date}T12:00:00Z`).getUTCDay();
  const rules = await q<Record<string, unknown>>(
    `select is_available, start_minute, end_minute, effective_from, effective_until
       from availability_rules
      where membership_id = $1 and day_of_week = $2`,
    [membershipId, dow],
  );
  for (const rule of rules) {
    const fromD = rule.effective_from ? dateStr(rule.effective_from) : null;
    const toD = rule.effective_until ? dateStr(rule.effective_until) : null;
    if (fromD && date < fromD) continue;
    if (toD && date > toD) continue;
    const covers = minuteCovers(num(rule.start_minute), num(rule.end_minute), startMinute);
    if (covers && !bool(rule.is_available)) return true;
  }
  return false;
}

function minuteCovers(from: number, to: number, minute: number): boolean {
  if (from === to) return true;
  if (from < to) return minute >= from && minute < to;
  return minute >= from || minute < to;
}

export { addDays };
