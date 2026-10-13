-- Shiftii hospital shift-management schema.
-- Every business table carries organization_id (or is reached only through a
-- membership that does). Application code MUST filter by the caller's org.
--
-- Compliance: no patient identifiers. unit_census_snapshots holds aggregate
-- counts/acuity only. handover_notes.free_text_note is the sole field that
-- may hold clinical detail and is excluded from every AI code path.

create table if not exists organizations (
  id text primary key,
  name text not null,
  slug text not null unique,
  contact_email text,
  contact_phone text,
  timezone text not null default 'America/New_York',
  week_start_day integer not null default 1,
  locale text not null default 'en',
  default_shift_length_minutes integer not null default 720,
  default_break_minutes integer not null default 30,
  max_weekly_hours double precision,
  min_rest_hours_between_shifts double precision not null default 10,
  claim_approval_mode text not null default 'MANAGER_APPROVAL',
  swap_approval_mode text not null default 'MANAGER_APPROVAL',
  ai_features_enabled boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organizations_claim_mode_chk
    check (claim_approval_mode in ('AUTO', 'MANAGER_APPROVAL')),
  constraint organizations_swap_mode_chk
    check (swap_approval_mode in ('AUTO', 'MANAGER_APPROVAL'))
);

create table if not exists locations (
  id text primary key,
  organization_id text not null references organizations(id) on delete cascade,
  name text not null,
  address text,
  unit_type text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);
create index if not exists locations_org_idx on locations (organization_id);

create table if not exists positions (
  id text primary key,
  organization_id text not null references organizations(id) on delete cascade,
  name text not null,
  color_hex text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);
create index if not exists positions_org_idx on positions (organization_id);

create table if not exists memberships (
  id text primary key,
  organization_id text not null references organizations(id) on delete cascade,
  user_id text not null,
  display_name text not null,
  initials text,
  role text not null default 'EMPLOYEE',
  status text not null default 'ACTIVE',
  target_weekly_hours double precision,
  pay_rate_cents integer,
  pay_currency text default 'USD',
  start_date date,
  deactivated_at timestamptz,
  preferences jsonb not null default '{}'::jsonb,
  is_synthetic boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id),
  constraint memberships_role_chk
    check (role in ('OWNER', 'ADMIN', 'MANAGER', 'EMPLOYEE')),
  constraint memberships_status_chk
    check (status in ('PENDING', 'ACTIVE', 'INACTIVE'))
);
create index if not exists memberships_org_status_idx on memberships (organization_id, status);
create index if not exists memberships_org_role_idx on memberships (organization_id, role);
create index if not exists memberships_user_idx on memberships (user_id);

create table if not exists employee_positions (
  id text primary key,
  membership_id text not null references memberships(id) on delete cascade,
  position_id text not null references positions(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (membership_id, position_id)
);
create index if not exists employee_positions_position_idx on employee_positions (position_id);

create table if not exists membership_locations (
  id text primary key,
  membership_id text not null references memberships(id) on delete cascade,
  location_id text not null references locations(id) on delete cascade,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique (membership_id, location_id)
);
create index if not exists membership_locations_location_idx on membership_locations (location_id);

create table if not exists credential_types (
  id text primary key,
  organization_id text not null references organizations(id) on delete cascade,
  name text not null,
  description text,
  warn_days_before_expiry integer not null default 30,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);
create index if not exists credential_types_org_idx on credential_types (organization_id);

create table if not exists employee_credentials (
  id text primary key,
  membership_id text not null references memberships(id) on delete cascade,
  credential_type_id text not null references credential_types(id) on delete cascade,
  identifier_last4 text,
  issued_at date,
  expires_at date,
  document_path text,
  verified_by_id text,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (membership_id, credential_type_id)
);
create index if not exists employee_credentials_expires_idx on employee_credentials (expires_at);

create table if not exists position_credential_requirements (
  id text primary key,
  position_id text not null references positions(id) on delete cascade,
  credential_type_id text not null references credential_types(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (position_id, credential_type_id)
);

create table if not exists invitations (
  id text primary key,
  organization_id text not null references organizations(id) on delete cascade,
  email text not null,
  role text not null default 'EMPLOYEE',
  location_id text,
  position_ids jsonb not null default '[]'::jsonb,
  token_hash text not null unique,
  status text not null default 'PENDING',
  invited_by_id text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  resend_count integer not null default 0,
  last_sent_at timestamptz not null default now(),
  constraint invitations_status_chk
    check (status in ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED'))
);
create index if not exists invitations_org_status_idx on invitations (organization_id, status);
create index if not exists invitations_email_idx on invitations (email);

create table if not exists rosters (
  id text primary key,
  organization_id text not null references organizations(id) on delete cascade,
  location_id text references locations(id),
  name text not null,
  start_date date not null,
  end_date date not null,
  status text not null default 'DRAFT',
  availability_lock_at timestamptz,
  created_by_id text not null,
  published_by_id text,
  published_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rosters_status_chk
    check (status in ('DRAFT', 'PUBLISHED', 'ARCHIVED'))
);
create index if not exists rosters_org_status_idx on rosters (organization_id, status);
create index if not exists rosters_org_dates_idx on rosters (organization_id, start_date, end_date);

create table if not exists shifts (
  id text primary key,
  organization_id text not null references organizations(id) on delete cascade,
  roster_id text not null references rosters(id) on delete cascade,
  location_id text not null references locations(id),
  position_id text not null references positions(id),
  employee_id text references memberships(id),
  date date not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  break_minutes integer not null default 30,
  notes text,
  status text not null default 'DRAFT',
  is_open_for_claim boolean not null default false,
  created_by_id text not null,
  version integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shifts_status_chk
    check (status in ('DRAFT', 'OPEN', 'ASSIGNED', 'CANCELLED'))
);
create index if not exists shifts_org_roster_idx on shifts (organization_id, roster_id);
create index if not exists shifts_org_employee_date_idx on shifts (organization_id, employee_id, date);
create index if not exists shifts_org_date_idx on shifts (organization_id, date);
create index if not exists shifts_org_claim_idx on shifts (organization_id, status, is_open_for_claim);
create index if not exists shifts_location_date_idx on shifts (location_id, date);

create table if not exists availability_rules (
  id text primary key,
  membership_id text not null references memberships(id) on delete cascade,
  day_of_week integer not null,
  start_minute integer not null,
  end_minute integer not null,
  is_available boolean not null default true,
  effective_from date,
  effective_until date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists availability_rules_member_dow_idx
  on availability_rules (membership_id, day_of_week);

create table if not exists availability_exceptions (
  id text primary key,
  membership_id text not null references memberships(id) on delete cascade,
  date date not null,
  is_available boolean not null,
  start_minute integer,
  end_minute integer,
  reason text,
  parsed_from_text boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists availability_exceptions_member_date_idx
  on availability_exceptions (membership_id, date);

create table if not exists leave_requests (
  id text primary key,
  organization_id text not null references organizations(id) on delete cascade,
  membership_id text not null references memberships(id) on delete cascade,
  type text not null,
  custom_type_label text,
  start_date date not null,
  end_date date not null,
  reason text,
  attachment_path text,
  status text not null default 'PENDING',
  reviewed_by_id text,
  reviewed_at timestamptz,
  manager_note text,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leave_type_chk
    check (type in ('VACATION', 'SICK', 'PERSONAL', 'UNPAID', 'OTHER')),
  constraint leave_status_chk
    check (status in ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'))
);
create index if not exists leave_org_member_status_idx
  on leave_requests (organization_id, membership_id, status);
create index if not exists leave_org_dates_idx
  on leave_requests (organization_id, start_date, end_date);

create table if not exists shift_claims (
  id text primary key,
  organization_id text not null,
  shift_id text not null references shifts(id) on delete cascade,
  membership_id text not null references memberships(id) on delete cascade,
  type text not null,
  status text not null default 'PENDING',
  note text,
  reviewed_by_id text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint claim_type_chk check (type in ('CLAIM', 'RELEASE')),
  constraint claim_status_chk
    check (status in ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'))
);
create index if not exists shift_claims_org_shift_idx on shift_claims (organization_id, shift_id, status);
create index if not exists shift_claims_org_member_idx on shift_claims (organization_id, membership_id, status);

create table if not exists shift_swap_requests (
  id text primary key,
  organization_id text not null,
  initiator_membership_id text not null references memberships(id) on delete cascade,
  initiator_shift_id text not null references shifts(id) on delete cascade,
  target_membership_id text not null references memberships(id) on delete cascade,
  target_shift_id text not null references shifts(id) on delete cascade,
  status text not null default 'PENDING_TARGET',
  note text,
  target_responded_at timestamptz,
  reviewed_by_id text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint swap_status_chk check (status in (
    'PENDING_TARGET', 'TARGET_ACCEPTED', 'PENDING_MANAGER',
    'APPROVED', 'REJECTED', 'DECLINED', 'CANCELLED'
  ))
);
create index if not exists swaps_org_status_idx on shift_swap_requests (organization_id, status);
create index if not exists swaps_org_initiator_idx on shift_swap_requests (organization_id, initiator_membership_id);
create index if not exists swaps_org_target_idx on shift_swap_requests (organization_id, target_membership_id);

create table if not exists notifications (
  id text primary key,
  organization_id text not null references organizations(id) on delete cascade,
  recipient_id text not null references memberships(id) on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  link text,
  metadata jsonb,
  is_read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_org_recipient_idx
  on notifications (organization_id, recipient_id, is_read);
create index if not exists notifications_recipient_created_idx
  on notifications (recipient_id, created_at);

create table if not exists organization_notification_preferences (
  id text primary key,
  organization_id text not null references organizations(id) on delete cascade,
  type text not null,
  email_enabled boolean not null default true,
  in_app_enabled boolean not null default true,
  unique (organization_id, type)
);

create table if not exists unit_census_snapshots (
  id text primary key,
  organization_id text not null references organizations(id) on delete cascade,
  location_id text not null references locations(id) on delete cascade,
  date date not null,
  shift_window text not null,
  patient_count integer not null,
  average_acuity double precision,
  recorded_by_id text not null,
  created_at timestamptz not null default now(),
  unique (organization_id, location_id, date, shift_window)
);
create index if not exists census_org_loc_date_idx
  on unit_census_snapshots (organization_id, location_id, date);

create table if not exists handover_notes (
  id text primary key,
  organization_id text not null references organizations(id) on delete cascade,
  shift_id text not null references shifts(id) on delete cascade,
  location_id text not null references locations(id) on delete cascade,
  author_id text not null references memberships(id),
  pending_tasks_count integer not null default 0,
  critical_alerts_count integer not null default 0,
  equipment_issues_flag boolean not null default false,
  -- Sensitive. Never selected by lib/ai or any payload leaving this process.
  free_text_note text,
  acknowledged_by_id text references memberships(id),
  acknowledged_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists handover_org_shift_idx on handover_notes (organization_id, shift_id);
create index if not exists handover_org_loc_created_idx
  on handover_notes (organization_id, location_id, created_at);

create table if not exists fatigue_snapshots (
  id text primary key,
  organization_id text not null references organizations(id) on delete cascade,
  membership_id text not null references memberships(id) on delete cascade,
  date date not null,
  score integer not null,
  flags jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (membership_id, date)
);
create index if not exists fatigue_org_date_idx on fatigue_snapshots (organization_id, date);

create table if not exists ai_interaction_logs (
  id text primary key,
  organization_id text not null references organizations(id) on delete cascade,
  agent_name text not null,
  provider text not null,
  model text not null,
  prompt_tokens integer,
  completion_tokens integer,
  latency_ms integer not null,
  success boolean not null,
  error_code text,
  created_at timestamptz not null default now()
);
create index if not exists ai_logs_org_created_idx on ai_interaction_logs (organization_id, created_at);
create index if not exists ai_logs_org_agent_idx on ai_interaction_logs (organization_id, agent_name);

create table if not exists audit_logs (
  id text primary key,
  organization_id text not null references organizations(id) on delete cascade,
  actor_user_id text,
  actor_membership_id text,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  before jsonb,
  after jsonb,
  metadata jsonb,
  ip_address text,
  created_at timestamptz not null default now()
);
create index if not exists audit_org_entity_idx on audit_logs (organization_id, entity_type, entity_id);
create index if not exists audit_org_created_idx on audit_logs (organization_id, created_at);
create index if not exists audit_org_action_idx on audit_logs (organization_id, action);
