"use server";

import { qOne } from "@/lib/shiftii/db.server";
import { requireAuthedUserId } from "@/lib/auth/middleware";
import { toErrorPayload } from "@/lib/shiftii/errors";

/** Company codes identify organizations; credentials still authenticate users. */
export async function lookupCompanyCode(rawCode: string) {
  try {
    const code = rawCode?.trim().toUpperCase();
    if (!code || !/^[A-Z0-9][A-Z0-9-]{3,19}$/.test(code)) {
      return { ok: false as const, error: "Enter a valid company code." };
    }
    const result = await qOne<{ name: string }>(
      "select name from organizations where upper(access_code) = $1 and is_active = true",
      [code],
    );
    if (!result) return { ok: false as const, error: "Company code not found. Check with your administrator." };
    return { ok: true as const, data: { companyName: result.name } };
  } catch {
    return { ok: false as const, error: "Unable to check the company code right now." };
  }
}

/** After sign-in, verify the company code belongs to the signed-in user. */
export async function checkSignedInCompany(rawCode: string) {
  try {
    const userId = await requireAuthedUserId();
    const code = rawCode?.trim().toUpperCase();
    if (!code || !/^[A-Z0-9][A-Z0-9-]{3,19}$/.test(code)) {
      return { ok: false as const, error: "Invalid company code." };
    }
    const result = await qOne<{ id: string }>(
      `select m.id from memberships m join organizations o on o.id = m.organization_id
       where m.user_id = $1 and m.status = 'ACTIVE' and o.is_active = true
       and upper(o.access_code) = $2`,
      [userId, code],
    );
    return result
      ? { ok: true as const, data: { allowed: true as const } }
      : { ok: false as const, error: "Your account is not a member of this company." };
  } catch (err) {
    return toErrorPayload(err);
  }
}
