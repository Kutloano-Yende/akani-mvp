-- Super Admin Users page needs to flag which profiles are platform admins
-- (Kutloano currently shows as an ordinary Akani tenant admin, with nothing
-- distinguishing them as the platform super admin -- confusing/wrong).
-- platform_admins was RLS-enabled with zero policies (Phase 1, "nothing
-- reads this yet"). Now something does.
create policy "platform_admins readable by platform admins" on platform_admins
  for select to authenticated using (is_platform_admin());
