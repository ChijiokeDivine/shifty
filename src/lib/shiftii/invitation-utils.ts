import { createHash, randomBytes } from "node:crypto";

export type InvitableRole = "ADMIN" | "MANAGER" | "EMPLOYEE";

/** Never expose staff invites to the OWNER role. Ownership transfer is separate. */
export const INVITABLE_ROLES: readonly InvitableRole[] = ["ADMIN", "MANAGER", "EMPLOYEE"];
export const INVITATION_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

export function normalizeInviteEmail(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (normalized.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error("Enter a valid email address.");
  }
  return normalized;
}

export function assertInvitableRole(role: string, actorRole: string): asserts role is InvitableRole {
  if (!INVITABLE_ROLES.includes(role as InvitableRole)) {
    throw new Error("Invalid invite role.");
  }
  if (actorRole === "MANAGER" && role !== "EMPLOYEE") {
    throw new Error("Managers can invite employees only.");
  }
  if (actorRole === "ADMIN" && role === "ADMIN") {
    throw new Error("Only the owner can invite another administrator.");
  }
  if (!["OWNER", "ADMIN", "MANAGER"].includes(actorRole)) {
    throw new Error("Only managers or administrators can invite staff.");
  }
}

export function newInviteToken(): string {
  return randomBytes(32).toString("hex");
}

export function validInviteToken(token: string): boolean {
  return /^[a-f0-9]{64}$/.test(token);
}

export function hashInviteToken(token: string): string {
  if (!validInviteToken(token)) throw new Error("Invalid invitation token.");
  return createHash("sha256").update(token).digest("hex");
}
