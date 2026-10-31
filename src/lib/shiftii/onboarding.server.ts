import { nid, slugify } from "./ids";
import { q, qOne, withTransaction } from "./db.server";
import { initialsFrom, mapOrg, mapMembership } from "./context.server";
import { ConflictError, ConstraintError } from "./errors";

export type RegisterCompanyInput = {
  companyName: string;
  ownerName: string;
  timezone: string;
  contactEmail?: string;
  firstLocation?: string;
  firstPosition?: string;
  companyAddress?: string;
  companyCode?: string;
};

export async function registerCompany(userId: string, input: RegisterCompanyInput) {
  const companyName = input.companyName?.trim();
  const ownerName = input.ownerName?.trim();
  const email = input.contactEmail?.trim().toLowerCase() || null;
  const locationName = input.firstLocation?.trim() || "Main location";
  const positionName = input.firstPosition?.trim() || "Team member";
  const timezone = input.timezone?.trim();
  const companyAddress = input.companyAddress?.trim() || null;
  const companyCode = input.companyCode?.trim().toUpperCase() || null;
  if (companyAddress && companyAddress.length > 255) throw new ConstraintError(["Company address must be at most 255 characters."]);
  if (companyCode && !/^[A-Z0-9][A-Z0-9-]{3,19}$/.test(companyCode)) throw new ConstraintError(["Company access code must have 4–20 letters, digits or hyphens."]);
  if (!companyName || companyName.length < 2 || companyName.length > 120)
    throw new ConstraintError(["Company name must be between 2 and 120 characters."]);
  if (!ownerName || ownerName.length < 2 || ownerName.length > 120)
    throw new ConstraintError(["Your name must be between 2 and 120 characters."]);
  if (locationName.length > 100 || positionName.length > 100)
    throw new ConstraintError(["Location and position names must be under 100 characters."]);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new ConstraintError(["Enter a valid company email address."]);
  if (!timezone || timezone.length > 80) {
    throw new ConstraintError(["Choose a valid timezone."]);
  }
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format();
  } catch {
    throw new ConstraintError(["Choose a valid timezone."]);
  }

  return withTransaction(async () => {
    // Serialize concurrent sign-ups from the same authenticated identity.
    // Do not allow a second company registration on a user account until
    // multi-company switching has been added to the product.
    const user = await qOne<{ id: string }>(
      'select id from "user" where id = $1 for update',
      [userId],
    );
    if (!user) throw new ConflictError("Sign in before registering your company.");
    const existing = await qOne<{ organization_id: string }>(
      "select organization_id from memberships where user_id = $1 limit 1",
      [userId],
    );
    if (existing) throw new ConflictError("You already belong to a company.");

    if (companyCode) {
      const taken = await qOne<{ id: string }>("select id from organizations where upper(access_code) = $1", [companyCode]);
      if (taken) throw new ConflictError("This company code is already taken. Choose another.");
    }
    const orgId = nid("org");
    const membershipId = nid("mem");
    const locationId = nid("loc");
    const positionId = nid("pos");
    // The generated suffix makes the unique slug robust under companies
    // with identical names. It is not an authentication credential.
    const slug = `${slugify(companyName).slice(0, 30) || "company"}-${orgId.slice(-10)}`;

    const [org] = await q<Record<string, unknown>>(
      `insert into organizations
         (id, name, slug, contact_email, timezone, access_code, headquarters_address)
       values ($1,$2,$3,$4,$5,$6,$7) returning *`,
      [orgId, companyName, slug, email, timezone, companyCode, companyAddress],
    );
    const [membership] = await q<Record<string, unknown>>(
      `insert into memberships
         (id, organization_id, user_id, display_name, initials, role, status)
       values ($1,$2,$3,$4,$5,'OWNER','ACTIVE') returning *`,
      [membershipId, orgId, userId, ownerName, initialsFrom(ownerName)],
    );
    await q(
      "insert into locations (id, organization_id, name) values ($1,$2,$3)",
      [locationId, orgId, locationName],
    );
    await q(
      "insert into positions (id, organization_id, name) values ($1,$2,$3)",
      [positionId, orgId, positionName],
    );
    await q(
      `insert into membership_locations (id, membership_id, location_id, is_primary)
       values ($1,$2,$3,true)`,
      [nid("mloc"), membershipId, locationId],
    );
    await q(
      `insert into employee_positions (id, membership_id, position_id)
       values ($1,$2,$3)`,
      [nid("epos"), membershipId, positionId],
    );
    await q(
      `insert into audit_logs
         (id, organization_id, actor_user_id, actor_membership_id, action, entity_type, entity_id)
       values ($1,$2,$3,$4,'ORGANIZATION_CREATED','organization',$2)`,
      [nid("aud"), orgId, userId, membershipId],
    );
    return { organization: mapOrg(org), membership: mapMembership(membership), locationId, positionId };
  });
}
