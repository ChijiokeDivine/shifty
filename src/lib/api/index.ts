/**
 * Shiftii RPC surface — the plug point for a later UI.
 *
 * Import from `@/lib/api` in any client component:
 *
 *   import { getDashboard, claimOpenShift, listGaps } from "@/lib/api";
 *   const res = await getDashboard();
 *   if (!res.ok) { ... } else { use res.data }
 *
 * Every function:
 *   - requires a signed-in session (requireAuthedUserId)
 *   - scopes all SQL to the caller's organization
 *   - never trusts a client-supplied user id
 *
 * Sensitive analysis (fatigue, forecast, fairness, credentials, constraints)
 * is local-ML. External AI only sees anonymous candidate indices.
 */

export type { Result, Ok, Fail } from "./_run";

export { getSessionContext, getDashboard } from "./session";
export { getOnboardingStatus, registerCompany } from "./onboarding";
export { listInvitations, createInvitation, revokeInvitation, previewInvitation, acceptInvitation } from "./invitations";

export {
  listShifts,
  getShift,
  createShift,
  assignShift,
  rescheduleShift,
  moveAndAssignShift,
  unassignShift,
  cancelShift,
  setOpenForClaim,
  listRosters,
  createRoster,
  generateFairRoster,
  publishRoster,
  listClaims,
  claimOpenShift,
  releaseAssignedShift,
  reviewClaim,
  cancelClaim,
  listSwaps,
  proposeSwap,
  respondToSwap,
  reviewSwap,
  cancelSwap,
} from "./roster";

export {
  listStaff,
  updateStaffProfile,
  deactivateStaff,
  createLocation,
  createPosition,
  listLocations,
  listPositions,
  updateOrgSettings,
  listAvailabilityRules,
  upsertAvailabilityRule,
  listAvailabilityExceptions,
  addAvailabilityException,
  parsePreference,
  listLeave,
  submitLeave,
  reviewLeave,
  cancelLeave,
  listCredentials,
  listCredentialAlerts,
} from "./people";

export {
  listHandovers,
  createHandover,
  acknowledgeHandover,
  listCensus,
  recordCensus,
  listNotifications,
  markNotificationsRead,
  listAuditLog,
} from "./clinical";

export {
  listGaps,
  forecastDemand,
  suggestGapFills,
  applyGapFill,
  explainForecast,
  listFatigue,
  refreshFatigue,
  fairnessReport,
  checkAssignment,
} from "./intelligence";

export const API_CATALOG: { group: string; name: string; purpose: string }[] = [
  { group: "session", name: "getSessionContext", purpose: "Org + membership for the signed-in user (seeds hospital on first call)" },
  { group: "people", name: "createInvitation / acceptInvitation", purpose: "Invite and onboard staff securely with single-use links" },
  { group: "session", name: "getDashboard", purpose: "Tonight's coverage, gaps, pending work, fatigue, credentials, my shifts" },
  { group: "roster", name: "createRoster", purpose: "Manager creates a new organization-scoped draft roster" },
  { group: "roster", name: "rescheduleShift", purpose: "Move shifts across dates or times with timezone-safe conflict checks" },
  { group: "roster", name: "listShifts", purpose: "Filterable shift list (unit, date, mine, open claims)" },
  { group: "roster", name: "claimOpenShift", purpose: "Nurse claims an open shift; auto or manager approval" },
  { group: "roster", name: "releaseAssignedShift", purpose: "Ask to give up an assigned shift" },
  { group: "roster", name: "reviewClaim", purpose: "Manager approve/reject a claim" },
  { group: "roster", name: "proposeSwap / respondToSwap / reviewSwap", purpose: "Two-sided swap with optional manager gate" },
  { group: "roster", name: "assignShift / unassignShift / setOpenForClaim", purpose: "Manager assignment + marketplace toggle" },
  { group: "roster", name: "generateFairRoster", purpose: "Local constraint solver for unfilled slots" },
  { group: "people", name: "listStaff / listLocations / listPositions", purpose: "Directory" },
  { group: "people", name: "updateStaffProfile / deactivateStaff", purpose: "Manage staff profiles, roles, assignments and status" },
  { group: "people", name: "createLocation / createPosition", purpose: "Set up company locations and job roles" },
  { group: "people", name: "parsePreference", purpose: "Local NLP: 'I can't do nights next week'" },
  { group: "people", name: "submitLeave / reviewLeave", purpose: "Leave workflow" },
  { group: "people", name: "listCredentialAlerts", purpose: "Local expiry warnings (last-4 only, never full license)" },
  { group: "clinical", name: "createHandover / acknowledgeHandover", purpose: "Structured handover; free text never sent to AI" },
  { group: "clinical", name: "recordCensus", purpose: "Aggregate patient count + acuity only" },
  { group: "intel", name: "listGaps / suggestGapFills / applyGapFill", purpose: "Local rank + optional sanitized AI explanation" },
  { group: "intel", name: "forecastDemand / explainForecast", purpose: "Census-based headcount forecast" },
  { group: "intel", name: "listFatigue / fairnessReport", purpose: "Local wellbeing + fairness windows" },
  { group: "intel", name: "checkAssignment", purpose: "Hard-constraint preview before a write" },
  { group: "ops", name: "listNotifications / markNotificationsRead / listAuditLog", purpose: "Inbox + append-only audit" },
];
