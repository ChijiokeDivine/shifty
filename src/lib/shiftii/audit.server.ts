import { nid } from "./ids";
import { q } from "./db.server";
import type { SessionContext } from "./types";

const REDACT = new Set(["free_text_note", "freeTextNote", "passwordHash", "tokenHash", "email"]);

function redact(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(redact);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = REDACT.has(k) ? "[redacted]" : redact(v);
    }
    return out;
  }
  return value;
}

export async function audit(opts: {
  ctx: SessionContext;
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  metadata?: unknown;
}): Promise<void> {
  await q(
    `insert into audit_logs (
       id, organization_id, actor_user_id, actor_membership_id,
       action, entity_type, entity_id, before, after, metadata
     ) values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10::jsonb)`,
    [
      nid("aud"),
      opts.ctx.organization.id,
      opts.ctx.userId,
      opts.ctx.membership.id,
      opts.action,
      opts.entityType,
      opts.entityId,
      opts.before == null ? null : JSON.stringify(redact(opts.before)),
      opts.after == null ? null : JSON.stringify(redact(opts.after)),
      opts.metadata == null ? null : JSON.stringify(redact(opts.metadata)),
    ],
  );
}

export async function listAudit(opts: {
  organizationId: string;
  entityType?: string;
  action?: string;
  limit?: number;
}): Promise<
  Array<{
    id: string;
    action: string;
    entityType: string;
    entityId: string;
    actorMembershipId: string | null;
    createdAt: string;
    metadata: unknown;
  }>
> {
  const params: unknown[] = [opts.organizationId];
  let where = "organization_id = $1";
  if (opts.entityType) {
    params.push(opts.entityType);
    where += ` and entity_type = $${params.length}`;
  }
  if (opts.action) {
    params.push(opts.action);
    where += ` and action = $${params.length}`;
  }
  params.push(Math.min(opts.limit ?? 80, 200));
  const rows = await q<Record<string, unknown>>(
    `select id, action, entity_type, entity_id, actor_membership_id, created_at, metadata
       from audit_logs
      where ${where}
      order by created_at desc
      limit $${params.length}`,
    params,
  );
  return rows.map((r) => ({
    id: String(r.id),
    action: String(r.action),
    entityType: String(r.entity_type),
    entityId: String(r.entity_id),
    actorMembershipId: r.actor_membership_id ? String(r.actor_membership_id) : null,
    createdAt: new Date(String(r.created_at)).toISOString(),
    metadata: r.metadata ?? null,
  }));
}
