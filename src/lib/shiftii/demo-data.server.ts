import { nid } from "./ids";
import { q, qOne, withTransaction } from "./db.server";
import { audit } from "./audit.server";
import { initialsFrom } from "./context.server";
import { addCalendarDays, calendarDateInZone, shiftWindowFromClock, startOfCalendarWeek } from "./calendar";
import { ConflictError, ForbiddenError } from "./errors";
import { DEMO_EMPLOYEES, DEMO_LOCATIONS, DEMO_POSITIONS, demoWeekFixtures, demoFixtureSummary } from "./demo-fixtures";
import type { SessionContext } from "./types";

const DEMO_MARKER = "shiftii_demo_v1";
const DEMO_ROSTER_PREFIX = "[DEMO]";

export async function loadDemoData(ctx: SessionContext) {
  if (ctx.membership.role !== "OWNER") {
    throw new ForbiddenError("Only the company owner can load sample data.");
  }
  return withTransaction(async () => {
    // Serializes attempts to load demo data and protects against concurrency.
    const org = await qOne<{ id: string; is_active: boolean }>(
      "select id, is_active from organizations where id = $1 for update",
      [ctx.organization.id],
    );
    if (!org?.is_active) throw new ForbiddenError("Company is not active.");
    const demoExists = await qOne<{ id: string }>(
      "select id from memberships where organization_id = $1 and is_synthetic = true limit 1",
      [ctx.organization.id],
    );
    const priorRun = await qOne<{ id: string }>(
      "select id from audit_logs where organization_id = $1 and action = 'DEMO_DATA_LOADED' limit 1",
      [ctx.organization.id],
    );
    if (demoExists || priorRun) throw new ConflictError(
      "Demo data was already loaded for this company. No duplicate records were created.",
    );

    // Do not overwrite or rename a real company, its employees, or its locations.
    const locationIds = new Map<string, string>();
    for (const name of DEMO_LOCATIONS) {
      const existing = await qOne<{ id: string }>(
        "select id from locations where organization_id = $1 and name = $2",
        [ctx.organization.id, name],
      );
      if (existing) {
        locationIds.set(name, existing.id);
      } else {
        const id = nid("loc");
        await q("insert into locations (id, organization_id, name) values ($1,$2,$3)", [id, ctx.organization.id, name]);
        locationIds.set(name, id);
      }
    }
    const positionIds = new Map<string, string>();
    for (const name of DEMO_POSITIONS) {
      const existing = await qOne<{ id: string }>(
        "select id from positions where organization_id = $1 and name = $2",
        [ctx.organization.id, name],
      );
      if (existing) positionIds.set(name, existing.id);
      else {
        const id = nid("pos");
        await q("insert into positions (id, organization_id, name) values ($1,$2,$3)", [id, ctx.organization.id, name]);
        positionIds.set(name, id);
      }
    }

    const staffIds = new Map<string, string>();
    for (const person of DEMO_EMPLOYEES) {
      const id = nid("mem");
      // Synthetic members are NEVER real authenticated user accounts.
      const userId = `demo:${ctx.organization.id}:${person.key}`;
      await q(
        `insert into memberships
           (id, organization_id, user_id, display_name, initials, role, status,
            target_weekly_hours, is_synthetic)
         values ($1,$2,$3,$4,$5,$6,'ACTIVE',$7,true)`,
        [id, ctx.organization.id, userId, person.name, initialsFrom(person.name),
          person.role, person.weeklyHours],
      );
      await q(
        "insert into membership_locations (id, membership_id, location_id, is_primary) values ($1,$2,$3,true)",
        [nid("mloc"), id, locationIds.get(person.location)],
      );
      await q(
        "insert into employee_positions (id, membership_id, position_id) values ($1,$2,$3)",
        [nid("epos"), id, positionIds.get(person.position)],
      );
      staffIds.set(person.key, id);
    }

    const today = calendarDateInZone(new Date(), ctx.organization.timezone);
    const start = startOfCalendarWeek(today, ctx.organization.weekStartDay);
    const patterns = demoWeekFixtures();
    let totalShifts = 0;
    const rosterIds: string[] = [];

    for (let week = 0; week < 2; week++) {
      const rosterId = nid("rst");
      rosterIds.push(rosterId);
      const weekStart = addCalendarDays(start, week * 7);
      const weekEnd = addCalendarDays(weekStart, 6);
      const published = week === 0;
      await q(
        `insert into rosters
           (id, organization_id, name, start_date, end_date, status,
            created_by_id, published_by_id, published_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [rosterId, ctx.organization.id,
          `${DEMO_ROSTER_PREFIX} ${published ? "Current week" : "Next week"}`,
          weekStart, weekEnd, published ? "PUBLISHED" : "DRAFT", ctx.membership.id,
          published ? ctx.membership.id : null, published ? new Date() : null],
      );
      for (const item of patterns) {
        const date = addCalendarDays(weekStart, item.offset);
        const { startAt, endAt } = shiftWindowFromClock(
          date, item.start, item.end, ctx.organization.timezone,
        );
        const employeeId = item.employeeKey ? staffIds.get(item.employeeKey) : null;
        await q(
          `insert into shifts
             (id, organization_id, roster_id, location_id, position_id,
              employee_id, date, start_at, end_at, break_minutes, status,
              is_open_for_claim, created_by_id, notes)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
          [nid("sft"), ctx.organization.id, rosterId,
            locationIds.get(item.location), positionIds.get(item.position),
            employeeId ?? null, date, startAt, endAt, item.breakMinutes,
            employeeId ? "ASSIGNED" : item.openForClaim ? "OPEN" : "DRAFT",
            item.openForClaim, ctx.membership.id, "Fictional demonstration shift"],
        );
        totalShifts++;
      }
    }

    // Realistic sample availability and leave, without changing any real user.
    const fatima = staffIds.get("fatima-bello")!;
    const noah = staffIds.get("noah-sinclair")!;
    const chloe = staffIds.get("chloe-martin")!;
    await q(
      `insert into availability_exceptions
       (id, membership_id, date, is_available, reason)
       values ($1,$2,$3,false,$4),($5,$6,$7,false,$8)`,
      [nid("aex"), fatima, addCalendarDays(start, 9), "Demo: personal appointment",
        nid("aex"), noah, addCalendarDays(start, 10), "Demo: unavailable"],
    );
    await q(
      `insert into leave_requests
        (id, organization_id, membership_id, type, start_date, end_date,
         reason, status)
       values ($1,$2,$3,'VACATION',$4,$5,$6,'PENDING')`,
      [nid("lve"), ctx.organization.id, chloe,
        addCalendarDays(start, 11), addCalendarDays(start, 12),
        "Demo: time off request"],
    );
    await audit({
      ctx, action: "DEMO_DATA_LOADED", entityType: "organization",
      entityId: ctx.organization.id, metadata: { marker: DEMO_MARKER, rosters: rosterIds.length,
        syntheticStaff: DEMO_EMPLOYEES.length, shifts: totalShifts },
    });
    return {
      ...demoFixtureSummary(), shifts: totalShifts, alreadyLoaded: false,
      rosterIds, organizationId: ctx.organization.id,
    };
  });
}

export async function getDemoDataStatus(ctx: SessionContext) {
  const marker = await qOne<{ id: string }>(
    `select id from audit_logs where organization_id = $1 and action = 'DEMO_DATA_LOADED' limit 1`,
    [ctx.organization.id],
  );
  return { loaded: Boolean(marker), summary: demoFixtureSummary() };
}
