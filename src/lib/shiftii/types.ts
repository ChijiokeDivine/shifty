/**
 * Domain types for Shiftii. Safe to import from client code.
 * Server services return these shapes; a later UI plugs in against this contract.
 */

export type MembershipRole = "OWNER" | "ADMIN" | "MANAGER" | "EMPLOYEE";
export type MembershipStatus = "PENDING" | "ACTIVE" | "INACTIVE";
export type ClaimApprovalMode = "AUTO" | "MANAGER_APPROVAL";
export type RosterStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type ShiftStatus = "DRAFT" | "OPEN" | "ASSIGNED" | "CANCELLED";
export type LeaveType = "VACATION" | "SICK" | "PERSONAL" | "UNPAID" | "OTHER";
export type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
export type ShiftClaimType = "CLAIM" | "RELEASE";
export type ShiftClaimStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
export type ShiftSwapStatus =
  | "PENDING_TARGET"
  | "TARGET_ACCEPTED"
  | "PENDING_MANAGER"
  | "APPROVED"
  | "REJECTED"
  | "DECLINED"
  | "CANCELLED";
export type ShiftWindow = "DAY" | "EVENING" | "NIGHT";

export type StaffPreferences = {
  preferDays?: boolean;
  preferNights?: boolean;
  noNights?: boolean;
  preferredUnitTypes?: string[];
  maxConsecutiveNights?: number;
};

export type Organization = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  weekStartDay: number;
  locale: string;
  defaultShiftLengthMinutes: number;
  defaultBreakMinutes: number;
  maxWeeklyHours: number | null;
  minRestHoursBetweenShifts: number;
  claimApprovalMode: ClaimApprovalMode;
  swapApprovalMode: ClaimApprovalMode;
  aiFeaturesEnabled: boolean;
  isActive: boolean;
};

export type Location = {
  id: string;
  organizationId: string;
  name: string;
  unitType: string | null;
  isActive: boolean;
};

export type Position = {
  id: string;
  organizationId: string;
  name: string;
  colorHex: string | null;
  isActive: boolean;
};

export type Membership = {
  id: string;
  organizationId: string;
  userId: string;
  displayName: string;
  initials: string;
  role: MembershipRole;
  status: MembershipStatus;
  targetWeeklyHours: number | null;
  preferences: StaffPreferences;
  isSynthetic: boolean;
};

export type SessionContext = {
  userId: string;
  organization: Organization;
  membership: Membership;
  locationIds: string[];
  positionIds: string[];
  primaryLocationId: string | null;
};

export type Shift = {
  id: string;
  organizationId: string;
  rosterId: string;
  locationId: string;
  positionId: string;
  employeeId: string | null;
  date: string;
  startAt: string;
  endAt: string;
  breakMinutes: number;
  notes: string | null;
  status: ShiftStatus;
  isOpenForClaim: boolean;
  version: number;
  locationName?: string;
  unitType?: string | null;
  positionName?: string;
  employeeName?: string | null;
};

export type ShiftClaim = {
  id: string;
  organizationId: string;
  shiftId: string;
  membershipId: string;
  type: ShiftClaimType;
  status: ShiftClaimStatus;
  note: string | null;
  createdAt: string;
  membershipName?: string;
  shift?: Shift;
};

export type ShiftSwap = {
  id: string;
  organizationId: string;
  initiatorMembershipId: string;
  initiatorShiftId: string;
  targetMembershipId: string;
  targetShiftId: string;
  status: ShiftSwapStatus;
  note: string | null;
  createdAt: string;
  initiatorName?: string;
  targetName?: string;
};

export type LeaveRequest = {
  id: string;
  organizationId: string;
  membershipId: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  reason: string | null;
  status: LeaveStatus;
  membershipName?: string;
};

export type Notification = {
  id: string;
  organizationId: string;
  recipientId: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
};

export type HandoverNote = {
  id: string;
  organizationId: string;
  shiftId: string;
  locationId: string;
  authorId: string;
  pendingTasksCount: number;
  criticalAlertsCount: number;
  equipmentIssuesFlag: boolean;
  /** Present only for authorized org members. Never sent to any AI provider. */
  freeTextNote: string | null;
  acknowledgedById: string | null;
  acknowledgedAt: string | null;
  createdAt: string;
  authorName?: string;
  locationName?: string;
};

export type CensusSnapshot = {
  id: string;
  organizationId: string;
  locationId: string;
  date: string;
  shiftWindow: ShiftWindow | string;
  patientCount: number;
  averageAcuity: number | null;
};

export type FatigueSnapshot = {
  membershipId: string;
  date: string;
  score: number;
  flags: FatigueFlags;
  displayName?: string;
};

export type FatigueFlags = {
  consecutiveNights: number;
  consecutiveDays: number;
  restViolations: number;
  hours7d: number;
  hours14d: number;
  nights7d: number;
};

export type FairnessRow = {
  membershipId: string;
  displayName: string;
  role: string;
  hours: number;
  nights: number;
  weekends: number;
  openClaims: number;
  preferenceHitRate: number;
  hoursDeltaFromMedian: number;
};

export type ForecastPoint = {
  date: string;
  locationId: string;
  locationName: string;
  shiftWindow: ShiftWindow;
  predictedHeadcount: number;
  assignedHeadcount: number;
  censusPatientCount: number | null;
  acuity: number | null;
};

export type CoverageGap = {
  id: string;
  date: string;
  locationId: string;
  locationName: string;
  unitType: string | null;
  positionId: string;
  positionName: string;
  shiftWindow: ShiftWindow;
  needed: number;
  assigned: number;
  shortfall: number;
  openShiftIds: string[];
};

export type FillCandidate = {
  membershipId: string;
  displayName: string;
  score: number;
  reasons: string[];
  warnings: string[];
  eligible: boolean;
  hours7d: number;
  consecutiveNights: number;
  credentialOk: boolean;
  restOk: boolean;
  fairnessDeficit: number;
};

export type AssignmentCheck = {
  ok: boolean;
  violations: string[];
  warnings: string[];
};

export type CredentialAlert = {
  membershipId: string;
  displayName: string;
  credentialType: string;
  expiresAt: string;
  daysUntil: number;
};

export type DashboardSnapshot = {
  organization: Organization;
  me: Membership;
  today: string;
  coverageTonight: {
    locationId: string;
    locationName: string;
    needed: number;
    assigned: number;
    open: number;
  }[];
  gaps: CoverageGap[];
  pendingClaims: number;
  pendingSwaps: number;
  pendingLeave: number;
  unreadNotifications: number;
  fatigueFlags: FatigueSnapshot[];
  credentialAlerts: CredentialAlert[];
  myUpcomingShifts: Shift[];
  openShiftsCount: number;
  aiAvailable: boolean;
  localMlNote: string;
};

export type AiExplainResult = {
  usedAi: boolean;
  provider: string | null;
  model: string | null;
  text: string;
  degraded: boolean;
};
