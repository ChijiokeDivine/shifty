import { toErrorPayload } from "@/lib/shiftii/errors";
import type { SessionContext } from "@/lib/shiftii/types";

export type Ok<T> = { ok: true; data: T };
export type Fail = ReturnType<typeof toErrorPayload>;
export type Result<T> = Ok<T> | Fail;

export async function withOrg<T>(
  userId: string,
  fn: (ctx: SessionContext) => Promise<T>,
): Promise<Result<T>> {
  try {
    const { requireContext } = await import("@/lib/shiftii/context.server");
    const ctx = await requireContext(userId);
    const data = await fn(ctx);
    return { ok: true, data };
  } catch (err) {
    return toErrorPayload(err);
  }
}
