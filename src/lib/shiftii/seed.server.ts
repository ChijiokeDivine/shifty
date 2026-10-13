import { nid, slugify } from "./ids";
import { q, qOne } from "./db.server";
import { getAuthProfile, initialsFrom } from "./context.server";
import { addDays, dateInZone, hourInZone, windowFromStartHour, zonedIso } from "./time";
import { computeFatigue } from "@/lib/local-ml/fatigue";
import type { StaffPreferences } from "./types";

type StaffSeed = {
  slug: string;
  name: string;
  role: "MANAGER" | "EMPLOYEE";
  positions: string[];
  units: string[];
  primary: string;
  prefs: StaffPreferences;
  weekly: number;
};

const UNIT_DEFS = [
  { name: "ICU", unitType: "ICU" },
  { name: "Emergency", unitType: "ED" },
  { name: "Med-Surg 4W", unitType: "MED_SURG" },
  { name: "PACU", unitType: "PACU" },
  { name: "Labor & Delivery", unitType: "LD" },
];

const POSITION_DEFS = [
  { name: "Charge RN", color: "#7a96a8" },
  { name: "RN", color: "#7ea889" },
  { name: "CNA", color: "#8b958e" },
  { name: "Respiratory Therapist", color: "#c4a06a" },
];

const CRED_DEFS = [
  { name: "RN License", warn: 30 },
  { name: "ACLS", warn: 30 },
  { name: "BLS", warn: 30 },
  { name: "PALS", warn: 30 },
  { name: "NRP", warn: 30 },
];

const STAFF: StaffSeed[] = [
  { slug: "maya-chen", name: "Maya Chen", role: "EMPLOYEE", positions: ["RN"], units: ["ICU"], primary: "ICU", prefs: { preferNights: true, preferredUnitTypes: ["ICU"] }, weekly: 36 },
  { slug: "jordan-hale", name: "Jordan Hale", role: "EMPLOYEE", positions: ["RN"], units: ["ICU", "Emergency"], primary: "ICU", prefs: { preferDays: true, preferredUnitTypes: ["ICU"] }, weekly: 36 },
  { slug: "priya-shah", name: "Priya Shah", role: "EMPLOYEE", positions: ["RN"], units: ["ICU"], primary: "ICU", prefs: { preferredUnitTypes: ["ICU"] }, weekly: 36 },
  { slug: "deshawn-ward", name: "DeShawn Ward", role: "EMPLOYEE", positions: ["RN"], units: ["ICU"], primary: "ICU", prefs: { preferNights: true, preferredUnitTypes: ["ICU"] }, weekly: 36 },
  { slug: "luis-ortega", name: "Luis Ortega", role: "EMPLOYEE", positions: ["RN"], units: ["Emergency"], primary: "Emergency", prefs: { preferDays: true, preferredUnitTypes: ["ED"] }, weekly: 36 },
  { slug: "amina-farouk", name: "Amina Farouk", role: "EMPLOYEE", positions: ["RN"], units: ["Emergency"], primary: "Emergency", prefs: { preferredUnitTypes: ["ED"] }, weekly: 36 },
  { slug: "hannah-lindqvist", name: "Hannah Lindqvist", role: "MANAGER", positions: ["Charge RN", "RN"], units: ["Emergency"], primary: "Emergency", prefs: { preferDays: true, preferredUnitTypes: ["ED"] }, weekly: 40 },
  { slug: "chris-nguyen", name: "Chris Nguyen", role: "EMPLOYEE", positions: ["RN"], units: ["Med-Surg 4W"], primary: "Med-Surg 4W", prefs: { preferDays: true, preferredUnitTypes: ["MED_SURG"] }, weekly: 36 },
  { slug: "sam-okonkwo", name: "Sam Okonkwo", role: "EMPLOYEE", positions: ["RN"], units: ["Med-Surg 4W", "ICU"], primary: "Med-Surg 4W", prefs: { preferredUnitTypes: ["MED_SURG"] }, weekly: 36 },
  { slug: "riley-brooks", name: "Riley Brooks", role: "EMPLOYEE", positions: ["CNA"], units: ["ICU", "Med-Surg 4W"], primary: "ICU", prefs: {}, weekly: 36 },
  { slug: "elena-vasquez", name: "Elena Vasquez", role: "EMPLOYEE", positions: ["RN"], units: ["Labor & Delivery"], primary: "Labor & Delivery", prefs: { preferredUnitTypes: ["LD"] }, weekly: 36 },
  { slug: "grace-kim", name: "Grace Kim", role: "EMPLOYEE", positions: ["RN"], units: ["PACU"], primary: "PACU", prefs: { preferDays: true, preferredUnitTypes: ["PACU"] }, weekly: 32 },
  { slug: "noah-patel", name: "Noah Patel", role: "EMPLOYEE", positions: ["Respiratory Therapist"], units: ["ICU", "Emergency"], primary: "ICU", prefs: {}, weekly: 36 },
];

const BASELINE: Record<string, { DAY: number; NIGHT: number }> = {
  ICU: { DAY: 3, NIGHT: 2 },
  ED: { DAY: 3, NIGHT: 2 },
  MED_SURG: { DAY: 2, NIGHT: 2 },
  PACU: { DAY: 2, NIGHT: 0 },
  LD: { DAY: 2, NIGHT: 1 },
};

export async function ensureHospital(userId: string): Promise<{ organizationId: string; seeded: boolean }> {
  const existing = await qOne<{ organization_id: string }>(
    `select organization_id from memberships where user_id = $1 and status = 'ACTIVE' limit 1`,
    [userId],
  );
  if (existing) return { organizationId: String(existing.organization_id), seeded: false };
  return seedHospital(userId);
}

async function seedHospital(userId: string): Promise<{ organizationId: string; seeded: boolean }> {
  const profile = await getAuthProfile(userId);
  const orgId = nid("org");
  const slug = `harborview-${slugify(userId).slice(-10) || "demo"}`;
  const tz = "America/New_York";
  const today = dateInZone(new Date(), tz);

  await q(
    `insert into organizations (
       id, name, slug, timezone, week_start_day, default_shift_length_minutes,
       default_break_minutes, max_weekly_hours, min_rest_hours_between_shifts,
       claim_approval_mode, swap_approval_mode, ai_features_enabled
     ) values ($1,$2,$3,$4,1,720,30,60,10,'MANAGER_APPROVAL','MANAGER_APPROVAL', true)`,
    [orgId, "Harborview Memorial", slug, tz],
  );

  const locByName = new Map<string, string>();
  const locByType = new Map<string, string>();
  for (const u of UNIT_DEFS) {
    const id = nid("loc");
    await q(
      `insert into locations (id, organization_id, name, unit_type) values ($1,$2,$3,$4)`,
      [id, orgId, u.name, u.unitType],
    );
    locByName.set(u.name, id);
    locByType.set(u.unitType, id);
  }

  const posByName = new Map<string, string>();
  for (const p of POSITION_DEFS) {
    const id = nid("pos");
    await q(
      `insert into positions (id, organization_id, name, color_hex) values ($1,$2,$3,$4)`,
      [id, orgId, p.name, p.color],
    );
    posByName.set(p.name, id);
  }

  const credByName = new Map<string, string>();
  for (const c of CRED_DEFS) {
    const id = nid("cty");
    await q(
      `insert into credential_types (id, organization_id, name, warn_days_before_expiry)
       values ($1,$2,$3,$4)`,
      [id, orgId, c.name, c.warn],
    );
    credByName.set(c.name, id);
  }

  await q(
    `insert into position_credential_requirements (id, position_id, credential_type_id) values ($1,$2,$3),($4,$5,$6),($7,$8,$9),($10,$11,$12)`,
    [
      nid("pcr"), posByName.get("Charge RN"), credByName.get("RN License"),
      nid("pcr"), posByName.get("Charge RN"), credByName.get("ACLS"),
      nid("pcr"), posByName.get("RN"), credByName.get("RN License"),
      nid("pcr"), posByName.get("RN"), credByName.get("BLS"),
    ],
  );
  await q(
    `insert into position_credential_requirements (id, position_id, credential_type_id) values ($1,$2,$3),($4,$5,$6)`,
    [
      nid("pcr"), posByName.get("RN"), credByName.get("ACLS"),
      nid("pcr"), posByName.get("CNA"), credByName.get("BLS"),
    ],
  );

  const meId = nid("mem");
  const myName = profile.name?.trim() || "Charge Nurse";
  await insertMembership({
    id: meId,
    orgId,
    userId,
    name: myName,
    role: "MANAGER",
    weekly: 40,
    prefs: { preferDays: true, preferredUnitTypes: ["ICU"] },
    synthetic: false,
  });
  await linkPosLoc(meId, ["Charge RN", "RN"], ["ICU", "Emergency"], "ICU", posByName, locByName);
  await grantCreds(meId, credByName, today, { "RN License": 400, ACLS: 200, BLS: 500, PALS: 180 });

  const memBySlug = new Map<string, string>();
  memBySlug.set("me", meId);
  for (const s of STAFF) {
    const id = nid("mem");
    memBySlug.set(s.slug, id);
    await insertMembership({
      id,
      orgId,
      userId: `syn:${orgId}:${s.slug}`,
      name: s.name,
      role: s.role,
      weekly: s.weekly,
      prefs: s.prefs,
      synthetic: true,
    });
    await linkPosLoc(id, s.positions, s.units, s.primary, posByName, locByName);
    const exp: Record<string, number> = { "RN License": 300, ACLS: 220, BLS: 400 };
    if (s.slug === "maya-chen") exp["RN License"] = 11;
    if (s.slug === "deshawn-ward") exp.ACLS = 6;
    if (s.slug === "elena-vasquez") exp.NRP = 90;
    if (s.positions.includes("CNA")) {
      await grantCreds(id, credByName, today, { BLS: 250 });
    } else if (s.positions.includes("Respiratory Therapist")) {
      await grantCreds(id, credByName, today, { BLS: 250, ACLS: 140 });
    } else {
      await grantCreds(id, credByName, today, exp);
    }
  }

  const rosterId = nid("rst");
  const start = addDays(today, -4);
  const end = addDays(today, 10);
  await q(
    `insert into rosters (
       id, organization_id, name, start_date, end_date, status,
       created_by_id, published_by_id, published_at
     ) values ($1,$2,$3,$4,$5,'PUBLISHED',$6,$6, now())`,
    [rosterId, orgId, "Current cycle", start, end, meId],
  );

  type BuiltShift = {
    id: string;
    locationId: string;
    locationName: string;
    unitType: string;
    positionId: string;
    date: string;
    startAt: string;
    endAt: string;
    window: "DAY" | "NIGHT";
    employeeId: string | null;
    status: "OPEN" | "ASSIGNED";
    open: boolean;
  };
  const built: BuiltShift[] = [];

  const eligible = (unitName: string, positionName: string) => {
    const locId = locByName.get(unitName)!;
    const posId = posByName.get(positionName)!;
    const ids: string[] = [];
    if (positionName === "Charge RN" && unitName === "ICU") ids.push(meId);
    for (const s of STAFF) {
      if (s.units.includes(unitName) && s.positions.includes(positionName)) {
        ids.push(memBySlug.get(s.slug)!);
      }
    }
    if (positionName === "RN" && (unitName === "ICU" || unitName === "Emergency")) {
      if (!ids.includes(meId)) ids.push(meId);
    }
    return { locId, posId, ids };
  };

  let cursor = start;
  let slot = 0;
  while (cursor <= end) {
    for (const unit of UNIT_DEFS) {
      const need = BASELINE[unit.unitType] ?? { DAY: 1, NIGHT: 0 };
      for (const window of ["DAY", "NIGHT"] as const) {
        const count = window === "DAY" ? need.DAY : need.NIGHT;
        const { locId, posId, ids } = eligible(unit.name, "RN");
        if (!ids.length || count === 0) continue;
        for (let i = 0; i < count; i += 1) {
          const startAt =
            window === "DAY"
              ? zonedIso(cursor, 7, 0, tz)
              : zonedIso(cursor, 19, 0, tz);
          const endAt =
            window === "DAY"
              ? zonedIso(cursor, 19, 0, tz)
              : zonedIso(addDays(cursor, 1), 7, 0, tz);
          const forceOpen =
            (cursor > today && i === count - 1 && slot % 5 === 0) ||
            (cursor === addDays(today, 1) && unit.unitType === "ICU" && window === "NIGHT" && i === 1) ||
            (cursor === addDays(today, 2) && unit.unitType === "ED" && window === "NIGHT" && i === 0);
          const pick = ids[(slot + i) % ids.length];
          const employeeId = forceOpen ? null : pick;
          built.push({
            id: nid("sft"),
            locationId: locId,
            locationName: unit.name,
            unitType: unit.unitType,
            positionId: posId,
            date: cursor,
            startAt,
            endAt,
            window,
            employeeId,
            status: employeeId ? "ASSIGNED" : "OPEN",
            open: !employeeId,
          });
        }
        slot += 1;
      }
    }
    // Charge RN days on ICU for the signed-in manager, 3 upcoming day shifts.
    cursor = addDays(cursor, 1);
  }

  // Guarantee a handful of personal upcoming shifts for the manager.
  for (const offset of [0, 2, 5, 8]) {
    const d = addDays(today, offset);
    if (d > end) continue;
    built.push({
      id: nid("sft"),
      locationId: locByName.get("ICU")!,
      locationName: "ICU",
      unitType: "ICU",
      positionId: posByName.get("Charge RN")!,
      date: d,
      startAt: zonedIso(d, 7, 0, tz),
      endAt: zonedIso(d, 19, 0, tz),
      window: "DAY",
      employeeId: meId,
      status: "ASSIGNED",
      open: false,
    });
  }

  for (const s of built) {
    await q(
      `insert into shifts (
         id, organization_id, roster_id, location_id, position_id, employee_id,
         date, start_at, end_at, break_minutes, status, is_open_for_claim, created_by_id
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,30,$10,$11,$12)`,
      [
        s.id, orgId, rosterId, s.locationId, s.positionId, s.employeeId,
        s.date, s.startAt, s.endAt, s.status, s.open, meId,
      ],
    );
  }

  // Census history (aggregate only).
  let c = addDays(today, -20);
  while (c <= today) {
    for (const unit of UNIT_DEFS) {
      const locId = locByName.get(unit.name)!;
      const base =
        unit.unitType === "ICU" ? 14 :
        unit.unitType === "ED" ? 22 :
        unit.unitType === "MED_SURG" ? 18 :
        unit.unitType === "PACU" ? 8 : 10;
      const jitter = (c.charCodeAt(8) + unit.name.length) % 5;
      for (const window of ["DAY", "NIGHT"] as const) {
        if (unit.unitType === "PACU" && window === "NIGHT") continue;
        await q(
          `insert into unit_census_snapshots (
             id, organization_id, location_id, date, shift_window,
             patient_count, average_acuity, recorded_by_id
           ) values ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [
            nid("cen"), orgId, locId, c, window,
            base + jitter + (window === "NIGHT" ? -2 : 0),
            2.6 + (jitter % 3) * 0.4,
            meId,
          ],
        );
      }
    }
    c = addDays(c, 1);
  }

  // Fatigue snapshots for every member.
  const members = await q<{ id: string }>(
    `select id from memberships where organization_id = $1 and status = 'ACTIVE'`,
    [orgId],
  );
  for (const m of members) {
    const shifts = await q<{ date: string; start_at: string; end_at: string; break_minutes: number }>(
      `select date::text as date, start_at, end_at, break_minutes
         from shifts
        where organization_id = $1 and employee_id = $2 and status = 'ASSIGNED'
          and date >= $3 and date <= $4`,
      [orgId, m.id, addDays(today, -14), today],
    );
    const { score, flags } = computeFatigue({
      asOfDate: today,
      timezone: tz,
      minRestHours: 10,
      shifts: shifts.map((s) => ({
        date: String(s.date).slice(0, 10),
        startAt: new Date(s.start_at).toISOString(),
        endAt: new Date(s.end_at).toISOString(),
        breakMinutes: Number(s.break_minutes),
      })),
    });
    await q(
      `insert into fatigue_snapshots (id, organization_id, membership_id, date, score, flags)
       values ($1,$2,$3,$4,$5,$6::jsonb)
       on conflict (membership_id, date) do nothing`,
      [nid("ftg"), orgId, m.id, today, score, JSON.stringify(flags)],
    );
  }

  const openNight = built.find(
    (s) => s.open && s.unitType === "ICU" && s.window === "NIGHT" && s.date > today,
  ) ?? built.find((s) => s.open);
  if (openNight) {
    await q(
      `insert into shift_claims (
         id, organization_id, shift_id, membership_id, type, status, note
       ) values ($1,$2,$3,$4,'CLAIM','PENDING',$5)`,
      [
        nid("clm"), orgId, openNight.id, memBySlug.get("maya-chen"),
        "I can cover — already in ICU this week.",
      ],
    );
  }

  const jordanShift = built.find(
    (s) => s.employeeId === memBySlug.get("jordan-hale") && s.date >= today && s.window === "DAY",
  );
  const priyaShift = built.find(
    (s) => s.employeeId === memBySlug.get("priya-shah") && s.date >= today && s.window === "NIGHT",
  );
  if (jordanShift && priyaShift) {
    await q(
      `insert into shift_swap_requests (
         id, organization_id, initiator_membership_id, initiator_shift_id,
         target_membership_id, target_shift_id, status, note
       ) values ($1,$2,$3,$4,$5,$6,'PENDING_TARGET',$7)`,
      [
        nid("swp"), orgId,
        memBySlug.get("jordan-hale"), jordanShift.id,
        memBySlug.get("priya-shah"), priyaShift.id,
        "Childcare on that day — Priya said nights work better.",
      ],
    );
  }

  await q(
    `insert into leave_requests (
       id, organization_id, membership_id, type, start_date, end_date, reason, status
     ) values ($1,$2,$3,'VACATION',$4,$5,$6,'PENDING')`,
    [
      nid("lve"), orgId, memBySlug.get("grace-kim"),
      addDays(today, 6), addDays(today, 8), "Family in town",
    ],
  );
  await q(
    `insert into leave_requests (
       id, organization_id, membership_id, type, start_date, end_date, status, reviewed_by_id, reviewed_at
     ) values ($1,$2,$3,'SICK',$4,$4,'APPROVED',$5, now())`,
    [nid("lve"), orgId, memBySlug.get("chris-nguyen"), addDays(today, 1), meId],
  );

  const lastNightIcu = built
    .filter((s) => s.unitType === "ICU" && s.window === "NIGHT" && s.date < today && s.employeeId)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  if (lastNightIcu) {
    await q(
      `insert into handover_notes (
         id, organization_id, shift_id, location_id, author_id,
         pending_tasks_count, critical_alerts_count, equipment_issues_flag, free_text_note
       ) values ($1,$2,$3,$4,$5,3,1,false,$6)`,
      [
        nid("hnd"), orgId, lastNightIcu.id, lastNightIcu.locationId, lastNightIcu.employeeId,
        "Structured checklist only in counts. Free-text stored locally and never sent to AI.",
      ],
    );
  }

  await q(
    `insert into notifications (id, organization_id, recipient_id, type, title, message, link)
     values
       ($1,$2,$3,'GAP_FILL_SUGGESTED','ICU night short tomorrow','One RN slot is still open on ICU night. Three ranked fills are ready for review.','/app?view=gaps'),
       ($4,$2,$3,'CLAIM_SUBMITTED','Open-shift claim to review','Maya Chen claimed an open ICU night. Constraint check already passed.','/app?view=claims'),
       ($5,$2,$3,'CREDENTIAL_EXPIRING','License expiring','A staff RN license hits the 14-day warning window.','/app?view=credentials'),
       ($6,$2,$3,'HANDOVER_READY','Night handover waiting','ICU night left a structured handover for the oncoming shift.','/app?view=handover')`,
    [nid("ntf"), orgId, meId, nid("ntf"), nid("ntf"), nid("ntf")],
  );

  await q(
    `insert into audit_logs (
       id, organization_id, actor_user_id, actor_membership_id, action, entity_type, entity_id, metadata
     ) values ($1,$2,$3,$4,'ORG_SEEDED','organization',$2,$5::jsonb)`,
    [
      nid("aud"), orgId, userId, meId,
      JSON.stringify({ units: UNIT_DEFS.length, staff: STAFF.length + 1, shifts: built.length }),
    ],
  );

  void locByType;
  void hourInZone;
  void windowFromStartHour;

  return { organizationId: orgId, seeded: true };
}

async function insertMembership(opts: {
  id: string;
  orgId: string;
  userId: string;
  name: string;
  role: string;
  weekly: number;
  prefs: StaffPreferences;
  synthetic: boolean;
}) {
  await q(
    `insert into memberships (
       id, organization_id, user_id, display_name, initials, role, status,
       target_weekly_hours, preferences, is_synthetic
     ) values ($1,$2,$3,$4,$5,$6,'ACTIVE',$7,$8::jsonb,$9)`,
    [
      opts.id, opts.orgId, opts.userId, opts.name, initialsFrom(opts.name),
      opts.role, opts.weekly, JSON.stringify(opts.prefs), opts.synthetic,
    ],
  );
}

async function linkPosLoc(
  membershipId: string,
  positions: string[],
  units: string[],
  primary: string,
  posByName: Map<string, string>,
  locByName: Map<string, string>,
) {
  for (const p of positions) {
    const pid = posByName.get(p);
    if (!pid) continue;
    await q(
      `insert into employee_positions (id, membership_id, position_id) values ($1,$2,$3)`,
      [nid("epos"), membershipId, pid],
    );
  }
  for (const u of units) {
    const lid = locByName.get(u);
    if (!lid) continue;
    await q(
      `insert into membership_locations (id, membership_id, location_id, is_primary)
       values ($1,$2,$3,$4)`,
      [nid("mloc"), membershipId, lid, u === primary],
    );
  }
}

async function grantCreds(
  membershipId: string,
  credByName: Map<string, string>,
  today: string,
  expiries: Record<string, number>,
) {
  for (const [name, days] of Object.entries(expiries)) {
    const typeId = credByName.get(name);
    if (!typeId) continue;
    await q(
      `insert into employee_credentials (
         id, membership_id, credential_type_id, identifier_last4, issued_at, expires_at, verified_at
       ) values ($1,$2,$3,$4,$5,$6, now())
       on conflict (membership_id, credential_type_id) do nothing`,
      [nid("crd"), membershipId, typeId, String(1000 + (days % 9000)), addDays(today, -400), addDays(today, days)],
    );
  }
}
