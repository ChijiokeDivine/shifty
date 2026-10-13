import { dateStr, num, q, str } from "../db.server";
import { dateInZone } from "../time";
import type { CredentialAlert, SessionContext } from "../types";

export async function listCredentialAlerts(ctx: SessionContext): Promise<CredentialAlert[]> {
  const today = dateInZone(new Date(), ctx.organization.timezone);
  const rows = await q<Record<string, unknown>>(
    `select m.id as membership_id, m.display_name, ct.name as credential_type,
            ec.expires_at::text as expires_at, ct.warn_days_before_expiry
       from employee_credentials ec
       join memberships m on m.id = ec.membership_id
       join credential_types ct on ct.id = ec.credential_type_id
      where m.organization_id = $1
        and m.status = 'ACTIVE'
        and ec.expires_at is not null
        and ec.expires_at <= ($2::date + (ct.warn_days_before_expiry * interval '1 day'))
      order by ec.expires_at asc`,
    [ctx.organization.id, today],
  );
  return rows.map((r) => {
    const expiresAt = dateStr(r.expires_at);
    const daysUntil = Math.round(
      (new Date(`${expiresAt}T12:00:00Z`).getTime() - new Date(`${today}T12:00:00Z`).getTime()) /
        86400000,
    );
    return {
      membershipId: str(r.membership_id),
      displayName: str(r.display_name),
      credentialType: str(r.credential_type),
      expiresAt,
      daysUntil,
    };
  });
}

export async function listCredentials(ctx: SessionContext, membershipId?: string) {
  const params: unknown[] = [ctx.organization.id];
  let where = "m.organization_id = $1";
  if (membershipId) {
    params.push(membershipId);
    where += ` and m.id = $${params.length}`;
  }
  const rows = await q<Record<string, unknown>>(
    `select ec.*, m.display_name, ct.name as type_name, ct.warn_days_before_expiry
       from employee_credentials ec
       join memberships m on m.id = ec.membership_id
       join credential_types ct on ct.id = ec.credential_type_id
      where ${where}
      order by m.display_name, ct.name`,
    params,
  );
  return rows.map((r) => ({
    id: str(r.id),
    membershipId: str(r.membership_id),
    displayName: str(r.display_name),
    typeName: str(r.type_name),
    identifierLast4: r.identifier_last4 ? str(r.identifier_last4) : null,
    issuedAt: r.issued_at ? dateStr(r.issued_at) : null,
    expiresAt: r.expires_at ? dateStr(r.expires_at) : null,
    warnDays: num(r.warn_days_before_expiry),
  }));
}
