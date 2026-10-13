import { computeFatigue } from "@/lib/local-ml/fatigue";
import { computeFairness } from "@/lib/local-ml/fairness";
import { dateStr, iso, json, num, q, str } from "../db.server";
import { addDays, dateInZone } from "../time";
import { nid } from "../ids";
import type { FairnessRow, FatigueFlags, FatigueSnapshot, SessionContext, StaffPreferences } from "../types";

export async function refreshFatigue(ctx: SessionContext, asOfDate?: string): Promise<FatigueSnapshot[]> {
  const today = asOfDate ?? dateInZone(new Date(), ctx.organization.timezone);
  const members = await q<{ id: string; display_name: string }>(
    `select id, display_name from memberships
      where organization_id = $1 and status = 'ACTIVE'`,
    [ctx.organization.id],
  );
  const out: FatigueSnapshot[] = [];
  for (const m of members) {
    const shifts = await q<Record<string, unknown>>(
      `select date, start_at, end_at, break_minutes
         from shifts
        where organization_id = $1 and employee_id = $2 and status = 'ASSIGNED'
          and date >= $3 and date <= $4`,
      [ctx.organization.id, m.id, addDays(today, -14), today],
    );
    const { score, flags } = computeFatigue({
      asOfDate: today,
      timezone: ctx.organization.timezone,
      minRestHours: ctx.organization.minRestHoursBetweenShifts,
      shifts: shifts.map((s) => ({
        date: dateStr(s.date),
        startAt: iso(s.start_at),
        endAt: iso(s.end_at),
        breakMinutes: num(s.break_minutes),
      })),
    });
    await q(
      `insert into fatigue_snapshots (id, organization_id, membership_id, date, score, flags)
       values ($1,$2,$3,$4,$5,$6::jsonb)
       on conflict (membership_id, date) do update set score = excluded.score, flags = excluded.flags`,
      [nid("ftg"), ctx.organization.id, m.id, today, score, JSON.stringify(flags)],
    );
    out.push({ membershipId: m.id, date: today, score, flags, displayName: m.display_name });
  }
  return out.sort((a, b) => b.score - a.score);
}

export async function listFatigue(ctx: SessionContext): Promise<FatigueSnapshot[]> {
  const today = dateInZone(new Date(), ctx.organization.timezone);
  const rows = await q<Record<string, unknown>>(
    `select f.*, m.display_name
       from fatigue_snapshots f
       join memberships m on m.id = f.membership_id
      where f.organization_id = $1 and f.date = $2
      order by f.score desc`,
    [ctx.organization.id, today],
  );
  if (!rows.length) return refreshFatigue(ctx, today);
  return rows.map((r) => ({
    membershipId: str(r.membership_id),
    date: dateStr(r.date),
    score: num(r.score),
    flags: json<FatigueFlags>(r.flags, {
      consecutiveNights: 0,
      consecutiveDays: 0,
      restViolations: 0,
      hours7d: 0,
      hours14d: 0,
      nights7d: 0,
    }),
    displayName: str(r.display_name),
  }));
}

export async function fairnessReport(ctx: SessionContext, from?: string, to?: string): Promise<FairnessRow[]> {
  const today = dateInZone(new Date(), ctx.organization.timezone);
  const start = from ?? addDays(today, -13);
  const end = to ?? addDays(today, 14);
  const staffRows = await q<Record<string, unknown>>(
    `select id, display_name, role, preferences from memberships
      where organization_id = $1 and status = 'ACTIVE'`,
    [ctx.organization.id],
  );
  const claims = await q<{ membership_id: string; n: number }>(
    `select membership_id, count(*)::int as n from shift_claims
      where organization_id = $1 and status = 'PENDING'
      group by membership_id`,
    [ctx.organization.id],
  );
  const claimMap = new Map(claims.map((c) => [c.membership_id, num(c.n)]));
  const shifts = await q<Record<string, unknown>>(
    `select s.employee_id, s.date, s.start_at, s.end_at, s.break_minutes, l.unit_type
       from shifts s
       join locations l on l.id = s.location_id
      where s.organization_id = $1 and s.status = 'ASSIGNED' and s.employee_id is not null
        and s.date >= $2 and s.date <= $3`,
    [ctx.organization.id, start, end],
  );
  return computeFairness({
    timezone: ctx.organization.timezone,
    staff: staffRows.map((s) => ({
      membershipId: str(s.id),
      displayName: str(s.display_name),
      role: str(s.role),
      preferences: json<StaffPreferences>(s.preferences, {}),
      openClaims: claimMap.get(str(s.id)) ?? 0,
    })),
    shifts: shifts.map((s) => ({
      membershipId: str(s.employee_id),
      date: dateStr(s.date),
      startAt: iso(s.start_at),
      endAt: iso(s.end_at),
      breakMinutes: num(s.break_minutes),
      unitType: s.unit_type ? str(s.unit_type) : null,
    })),
  });
}
