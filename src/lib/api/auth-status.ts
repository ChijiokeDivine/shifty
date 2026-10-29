"use server";

import { isAuthEmailConfigured } from "@/lib/auth/transactional-email.server";

/** Public readiness flag, never return provider secrets or config values. */
export async function emailDeliveryStatus() {
  return { configured: isAuthEmailConfigured() };
}
