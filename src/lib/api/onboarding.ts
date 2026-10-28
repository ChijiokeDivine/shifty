"use server";

import { requireAuthedUserId } from "@/lib/auth/middleware";
import { toErrorPayload } from "@/lib/shiftii/errors";
import type { RegisterCompanyInput } from "@/lib/shiftii/onboarding.server";

export async function getOnboardingStatus() {
  try {
    const userId = await requireAuthedUserId();
    const { findMembershipForUser } = await import("@/lib/shiftii/context.server");
    const result = await findMembershipForUser(userId);
    return { ok: true as const, data: { hasCompany: Boolean(result), organizationName: result?.org.name ?? null } };
  } catch (err) {
    return toErrorPayload(err);
  }
}

export async function registerCompany(input: RegisterCompanyInput) {
  try {
    const userId = await requireAuthedUserId();
    const { registerCompany } = await import("@/lib/shiftii/onboarding.server");
    return { ok: true as const, data: await registerCompany(userId, input) };
  } catch (err) {
    return toErrorPayload(err);
  }
}
