-- Restore old Shiftii organization-code login and registration metadata.
-- All existing records keep their slug and remain accessible by slug as fallback.
alter table public.organizations
  add column if not exists access_code text,
  add column if not exists headquarters_address text;

create unique index if not exists organizations_access_code_unique
  on public.organizations (upper(access_code))
  where access_code is not null;

-- The access code is a public organization identifier, NOT an authentication secret.
alter table public.organizations
  add constraint organizations_access_code_format_chk
  check (access_code is null or access_code ~ '^[A-Z0-9][A-Z0-9-]{3,19}$');
