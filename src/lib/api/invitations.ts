"use server";

import { requireAuthedUserId } from "@/lib/auth/middleware";
import { toErrorPayload } from "@/lib/shiftii/errors";
import { requireContext } from "@/lib/shiftii/context.server";
import type { CreateInvitationInput } from "@/lib/shiftii/invitations.server";

export async function listInvitations() {
  try {
    const userId = await requireAuthedUserId();
    const { listInvitations } = await import("@/lib/shiftii/invitations.server");
    return { ok: true as const, data: await listInvitations(await requireContext(userId)) };
  } catch (error) { return toErrorPayload(error); }
}

export async function createInvitation(input: CreateInvitationInput) {
  try {
    const userId = await requireAuthedUserId();
    const { createInvitation } = await import("@/lib/shiftii/invitations.server");
    return { ok: true as const, data: await createInvitation(await requireContext(userId), input) };
  } catch (error) { return toErrorPayload(error); }
}

export async function revokeInvitation(id: string) {
  try {
    const userId = await requireAuthedUserId();
    const { revokeInvitation } = await import("@/lib/shiftii/invitations.server");
    return { ok: true as const, data: await revokeInvitation(await requireContext(userId), id) };
  } catch (error) { return toErrorPayload(error); }
}

export async function previewInvitation(token: string) {
  try {
    const { getInvitationPreview } = await import("@/lib/shiftii/invitations.server");
    return { ok: true as const, data: await getInvitationPreview(token) };
  } catch (error) { return toErrorPayload(error); }
}

export async function acceptInvitation(token: string) {
  try {
    const userId = await requireAuthedUserId();
    const { acceptInvitation } = await import("@/lib/shiftii/invitations.server");
    return { ok: true as const, data: await acceptInvitation(userId, token) };
  } catch (error) { return toErrorPayload(error); }
}
