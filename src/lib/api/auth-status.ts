"use server";

import { isAuthEmailConfigured } from "@/lib/auth/transactional-email.server";
import { authEmailsEnabled } from "@/lib/auth/email-password";

/** Public readiness flag, never return provider secrets or config values. */
export async function emailDeliveryStatus() {
  return { configured: authEmailsEnabled && isAuthEmailConfigured() };
}
