import { nid } from "./ids";
import { q, qOne, withTransaction, str } from "./db.server";
import { audit } from "./audit.server";
import { initialsFrom } from "./context.server";
import { AppError, ConflictError, ConstraintError, ForbiddenError, NotFoundError } from "./errors";
import {
  assertInvitableRole, hashInviteToken, INVITATION_EXPIRY_MS,
  newInviteToken, normalizeInviteEmail, validInviteToken,
  type InvitableRole,
} from "./invitation-utils";
import type { SessionContext } from "./types";

export type CreateInvitationInput = {
  email: string;
  role: InvitableRole;
  locationId?: string | null;
  positionIds?: string[];
};

export async function listInvitations(ctx: SessionContext) {
  if (!["OWNER", "ADMIN", "MANAGER"].includes(ctx.membership.role))
    throw new ForbiddenError("You cannot manage invitations.");
  const rows = await q<{
    id: string; email: string; role: string; status: string; expires_at: Date | string;
    created_at: Date | string; accepted_at: Date | string | null; location_id: string | null;
  }>(
    `select id, email, role, status, expires_at, created_at, accepted_at, location_id
       from invitations where organization_id = $1 order by created_at desc limit 100`,
    [ctx.organization.id],
  );
  // Do not return token_hash in list responses.
  return rows.map((r) => ({
    id: r.id, email: r.email, role: r.role,
    status: r.status === "PENDING" && new Date(r.expires_at).getTime() <= Date.now()
      ? "EXPIRED" : r.status,
    expiresAt: new Date(r.expires_at).toISOString(),
    createdAt: new Date(r.created_at).toISOString(),
    acceptedAt: r.accepted_at ? new Date(r.accepted_at).toISOString() : null,
    locationId: r.location_id,
  }));
}

export async function createInvitation(ctx: SessionContext, input: CreateInvitationInput) {
  const role = input.role;
  try { assertInvitableRole(role, ctx.membership.role); }
  catch (err) { throw new ForbiddenError(err instanceof Error ? err.message : "Not permitted."); }
  let email: string;
  try { email = normalizeInviteEmail(input.email); }
  catch (err) { throw new ConstraintError([err instanceof Error ? err.message : "Invalid email."]); }
  const positionIds = [...new Set(input.positionIds ?? [])];
  if (positionIds.length > 20) throw new ConstraintError(["Choose no more than 20 positions."]);
  return withTransaction(async () => {
    // Serialize invitation creation for this organization, including duplicate
    // pending invitation checks.
    await q(
      `select id from organizations where id = $1 and is_active = true for update`,
      [ctx.organization.id],
    );
    const current = await qOne<{ id: string }>(
      `select m.id from memberships m join "user" u on u.id = m.user_id
       where m.organization_id = $1 and lower(u.email) = $2 and m.status = 'ACTIVE'`,
      [ctx.organization.id, email],
    );
    if (current) throw new ConflictError("This person is already on your team.");
    const previous = await qOne<{ id: string }>(
      `select id from invitations
       where organization_id = $1 and lower(email) = $2
         and status = 'PENDING' and expires_at > now() limit 1`,
      [ctx.organization.id, email],
    );
    if (previous) throw new ConflictError("This email already has a pending invitation.");
    if (input.locationId) {
      const location = await qOne<{ id: string }>(
        `select id from locations where id = $1 and organization_id = $2 and is_active = true`,
        [input.locationId, ctx.organization.id],
      );
      if (!location) throw new ConstraintError(["Location does not belong to your company."]);
    }
    if (positionIds.length) {
      const rows = await q<{ id: string }>(
        `select id from positions where organization_id = $1 and is_active = true
         and id = any($2::text[])`,
        [ctx.organization.id, positionIds],
      );
      if (rows.length !== positionIds.length)
        throw new ConstraintError(["One or more positions do not belong to your company."]);
    }
    const token = newInviteToken();
    const id = nid("inv");
    const expiresAt = new Date(Date.now() + INVITATION_EXPIRY_MS);
    await q(
      `insert into invitations
         (id, organization_id, email, role, location_id, position_ids, token_hash,
          status, invited_by_id, expires_at)
       values ($1,$2,$3,$4,$5,$6::jsonb,$7,'PENDING',$8,$9)`,
      [id, ctx.organization.id, email, role, input.locationId ?? null,
       JSON.stringify(positionIds), hashInviteToken(token), ctx.membership.id, expiresAt],
    );
    await audit({
      ctx, action: "INVITATION_CREATED", entityType: "invitation", entityId: id,
      metadata: { role }, // Never log token or invited person's address.
    });
    // The link can be copied once; the database stores only its SHA-256 digest.
    // No email was sent: the owner must deliver it securely to the invitee.
    return { id, token, expiresAt: expiresAt.toISOString(), email, role };
  });
}

export async function revokeInvitation(ctx: SessionContext, id: string) {
  if (!["OWNER", "ADMIN", "MANAGER"].includes(ctx.membership.role))
    throw new ForbiddenError("You cannot manage invitations.");
  return withTransaction(async () => {
    const row = await qOne<{ id: string; role: string }>(
      `select id, role from invitations
       where id = $1 and organization_id = $2 and status = 'PENDING' for update`,
      [id, ctx.organization.id],
    );
    if (!row) throw new NotFoundError("Pending invitation not found.");
    try { assertInvitableRole(row.role, ctx.membership.role); }
    catch { throw new ForbiddenError("You cannot revoke an invitation for this role."); }
    await q(`update invitations set status = 'REVOKED', revoked_at = now()
      where id = $1 and organization_id = $2`, [id, ctx.organization.id]);
    await audit({ ctx, action: "INVITATION_REVOKED", entityType: "invitation", entityId: id });
    return { ok: true as const };
  });
}

export async function getInvitationPreview(token: string) {
  if (!validInviteToken(token)) throw new NotFoundError("Invitation not found.");
  const row = await qOne<{ organization_name: string; role: string; email: string; expires_at: string }>(
    `select o.name as organization_name, i.role, i.email, i.expires_at
       from invitations i join organizations o on o.id = i.organization_id
      where i.token_hash = $1 and i.status = 'PENDING'
        and i.expires_at > now() and o.is_active = true`,
    [hashInviteToken(token)],
  );
  if (!row) throw new NotFoundError("This invitation has expired or is no longer valid.");
  // Email is intentionally omitted from unauthenticated previews.
  return { organizationName: row.organization_name, role: row.role };
}

export async function acceptInvitation(userId: string, token: string) {
  if (!validInviteToken(token)) throw new NotFoundError("Invitation not found.");
  return withTransaction(async () => {
    const user = await qOne<{ id: string; name: string; email: string; emailVerified: boolean }>(
      `select id, name, email, "emailVerified" from "user" where id = $1 for update`,
      [userId],
    );
    if (!user) throw new ForbiddenError("Sign in to accept this invitation.");
    if (!user.emailVerified) {
      throw new ForbiddenError("Verify your account email before accepting the invitation.");
    }
    const prior = await qOne<{ id: string }>(
      `select id from memberships where user_id = $1 limit 1`, [userId],
    );
    if (prior) throw new ConflictError("Your account already belongs to a company.");
    const invitation = await qOne<{
      id: string; organization_id: string; role: string; location_id: string | null;
      position_ids: unknown; email: string;
    }>(
      `select i.* from invitations i join organizations o on o.id = i.organization_id
       where i.token_hash = $1 and i.status = 'PENDING'
         and i.expires_at > now() and o.is_active = true for update of i`,
      [hashInviteToken(token)],
    );
    if (!invitation) throw new NotFoundError("This invitation has expired or was already used.");
    if (user.email.trim().toLowerCase() !== invitation.email.trim().toLowerCase())
      throw new ForbiddenError("Sign in with the email address this invitation was sent to.");

    const membershipId = nid("mem");
    await q(
      `insert into memberships
         (id, organization_id, user_id, display_name, initials, role, status)
       values ($1,$2,$3,$4,$5,$6,'ACTIVE')`,
      [membershipId, invitation.organization_id, userId, user.name,
       initialsFrom(user.name), invitation.role],
    );
    if (invitation.location_id) {
      const location = await qOne<{ id: string }>(
        `select id from locations where id = $1 and organization_id = $2 and is_active = true`,
        [invitation.location_id, invitation.organization_id],
      );
      if (location) await q(
        `insert into membership_locations (id, membership_id, location_id, is_primary)
         values ($1,$2,$3,true)`,
        [nid("mloc"), membershipId, location.id],
      );
    }
    const positions: unknown = typeof invitation.position_ids === "string"
      ? JSON.parse(invitation.position_ids) : invitation.position_ids;
    if (Array.isArray(positions)) {
      for (const id of positions) {
        if (typeof id !== "string") continue;
        const position = await qOne<{ id: string }>(
          `select id from positions where id = $1 and organization_id = $2 and is_active = true`,
          [id, invitation.organization_id],
        );
        if (position) await q(
          "insert into employee_positions (id, membership_id, position_id) values ($1,$2,$3)",
          [nid("epos"), membershipId, id],
        );
      }
    }
    await q(`update invitations set status = 'ACCEPTED', accepted_at = now()
      where id = $1 and status = 'PENDING'`, [invitation.id]);
    await q(
      `insert into audit_logs
         (id, organization_id, actor_user_id, actor_membership_id, action, entity_type, entity_id)
       values ($1,$2,$3,$4,'INVITATION_ACCEPTED','invitation',$5)`,
      [nid("aud"), invitation.organization_id, userId, membershipId, invitation.id],
    );
    return { organizationId: invitation.organization_id, membershipId };
  });
}
