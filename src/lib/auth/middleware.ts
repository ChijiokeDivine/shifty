import { assertSameSiteRequest } from "./isolation.server";
import { requireUserId } from "./verify.server";

/**
 * Resolve the caller's verified user id inside a Next.js Server Action or
 * Route Handler — the standard way to get a trustworthy user id for
 * per-user data.
 *
 *   import { requireAuthedUserId } from "@/lib/auth/middleware";
 *
 *   export async function listTodos() {
 *     "use server";
 *     const userId = await requireAuthedUserId();
 *     ...
 *   }
 *
 * Signed out with auth on -> throws `UnauthorizedError` (see
 * `verify.server.ts`). With auth disabled (`NEXT_PUBLIC_AUTH_ENABLED=false`, the
 * shipped default) it resolves the shared dev user — but throws instead when
 * a `DATABASE_URL` is also set, so an app without sign-in must not use this
 * at all. On the auth-on path, use it in every Server Action that touches
 * per-user data and scope every query by the returned id.
 */
export async function requireAuthedUserId(): Promise<string> {
  // Reject scripted cross-site/sibling requests before touching per-user data.
  await assertSameSiteRequest();
  return requireUserId();
}
