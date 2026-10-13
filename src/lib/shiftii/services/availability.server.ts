import { nid } from "../ids";
import { bool, dateStr, json, num, numOrNull, q, str } from "../db.server";
import { dateInZone } from "../time";
import { audit } from "../audit.server";
import { parsePreferenceText } from "@/lib/local-ml/preference-nlp";
import type { SessionContext, StaffPreferences } from "../types";

export async function listRules(ctx: SessionContext, membershipId?: string) {
  const id = membershipId ?? ctx.membership.id;
  await assertSelfOrManager(ctx, id);
  const rows = await q<Record<string, unknown>>(
    `select * from availability_rules where membership_id = $1 order by day_of_week, start_minute`,
    [id],
  );
  return rows.map((r) => ({
    id: str(r.id),
    membershipId: str(r.membership_id),
    dayOfWeek: num(r.day_of_week),
    startMinute: num(r.start_minute),
    endMinute: num(r.end_minute),
    isAvailable: bool(r.is_available),
    effectiveFrom: r.effective_from ? dateStr(r.effective_from) : null,
    effectiveUntil: r.effective_until ? dateStr(r.effective_until) : null,
  }));
}

export async function upsertRule(
  ctx: SessionContext,
  input: {
    membershipId?: string;
    dayOfWeek: number;
    startMinute: number;
    endMinute: number;
    isAvailable: boolean;
    effectiveFrom?: string | null;
    effectiveUntil?: string | null;
  },
) {
  const membershipId = input.membershipId ?? ctx.membership.id;
  await assertSelfOrManager(ctx, membershipId);
  const id = nid("avl");
  await q(
    `insert into availability_rules (
       id, membership_id, day_of_week, start_minute, end_minute, is_available, effective_from, effective_until
     ) values ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      id,
      membershipId,
      input.dayOfWeek,
      input.startMinute,
      input.endMinute,
      input.isAvailable,
      input.effectiveFrom ?? null,
      input.effectiveUntil ?? null,
    ],
  );
  await audit({ ctx, action: "AVAILABILITY_RULE_SET", entityType: "availability_rule", entityId: id });
  return { id };
}

export async function listExceptions(
  ctx: SessionContext,
  input: { membershipId?: string; from?: string; to?: string },
) {
  const membershipId = input.membershipId ?? ctx.membership.id;
  await assertSelfOrManager(ctx, membershipId);
  const params: unknown[] = [membershipId];
  let where = "membership_id = $1";
  if (input.from) {
    params.push(input.from);
    where += ` and date >= $${params.length}`;
  }
  if (input.to) {
    params.push(input.to);
    where += ` and date <= $${params.length}`;
  }
  const rows = await q<Record<string, unknown>>(
    `select * from availability_exceptions where ${where} order by date`,
    params,
  );
  return rows.map((r) => ({
    id: str(r.id),
    date: dateStr(r.date),
    isAvailable: bool(r.is_available),
    startMinute: numOrNull(r.start_minute),
    endMinute: numOrNull(r.end_minute),
    reason: r.reason ? str(r.reason) : null,
    parsedFromText: bool(r.parsed_from_text),
  }));
}

export async function addException(
  ctx: SessionContext,
  input: {
    membershipId?: string;
    date: string;
    isAvailable: boolean;
    startMinute?: number | null;
    endMinute?: number | null;
    reason?: string | null;
    parsedFromText?: boolean;
  },
) {
  const membershipId = input.membershipId ?? ctx.membership.id;
  await assertSelfOrManager(ctx, membershipId);
  const id = nid("aex");
  await q(
    `insert into availability_exceptions (
       id, membership_id, date, is_available, start_minute, end_minute, reason, parsed_from_text
     ) values ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      id,
      membershipId,
      input.date,
      input.isAvailable,
      input.startMinute ?? null,
      input.endMinute ?? null,
      input.reason ?? null,
      Boolean(input.parsedFromText),
    ],
  );
  await audit({ ctx, action: "AVAILABILITY_EXCEPTION", entityType: "availability_exception", entityId: id });
  return { id };
}

export async function parseAndApplyPreference(
  ctx: SessionContext,
  text: string,
): Promise<{ summary: string; understood: boolean; exceptionsCreated: number; preferences: StaffPreferences }> {
  const today = dateInZone(new Date(), ctx.organization.timezone);
  const parsed = parsePreferenceText(text, { today, timezone: ctx.organization.timezone });
  if (Object.keys(parsed.preferencesPatch).length) {
    const merged = { ...ctx.membership.preferences, ...parsed.preferencesPatch };
    await q(
      `update memberships set preferences = $1::jsonb, updated_at = now() where id = $2`,
      [JSON.stringify(merged), ctx.membership.id],
    );
  }
  for (const ex of parsed.exceptions) {
    await addException(ctx, {
      date: ex.date,
      isAvailable: ex.isAvailable,
      startMinute: ex.startMinute,
      endMinute: ex.endMinute,
      reason: ex.reason,
      parsedFromText: true,
    });
  }
  await audit({
    ctx,
    action: "PREFERENCE_NLP",
    entityType: "membership",
    entityId: ctx.membership.id,
    metadata: { understood: parsed.understood, exceptionCount: parsed.exceptions.length },
  });
  const row = await q<{ preferences: unknown }>(
    `select preferences from memberships where id = $1`,
    [ctx.membership.id],
  );
  return {
    summary: parsed.summary,
    understood: parsed.understood,
    exceptionsCreated: parsed.exceptions.length,
    preferences: json<StaffPreferences>(row[0]?.preferences, ctx.membership.preferences),
  };
}

async function assertSelfOrManager(ctx: SessionContext, membershipId: string) {
  if (membershipId === ctx.membership.id) return;
  const { assertManager } = await import("../context.server");
  assertManager(ctx);
}
