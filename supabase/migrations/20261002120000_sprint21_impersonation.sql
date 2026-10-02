-- Lets a platform admin impersonate a regular tenant user: a real session
-- swap (see src/app/api/admin/impersonate/route.ts), not a permissions
-- bypass, so every existing RLS policy and page just works unchanged. This
-- table is the audit/session record: who impersonated whom, when it
-- started, and when it ended.
create table impersonation_sessions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references profiles(id),
  target_user_id uuid not null references profiles(id),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  ip_address text,
  user_agent text
);

alter table impersonation_sessions enable row level security;

-- All writes go through the service-role client in the impersonate API
-- routes (same as tenant branding/status writes already do) -- no
-- INSERT/UPDATE policy needed for 'authenticated'.
create policy "impersonation sessions readable by platform admins" on impersonation_sessions
  for select to authenticated
  using ((select is_platform_admin()));
