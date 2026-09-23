-- The actual fix. Verified afterward with has_function_privilege() against
-- public/anon/authenticated directly rather than trusting the advisor
-- alone — the same PUBLIC-only revoke had looked sufficient before (Sprint
-- 1/3's handle_new_user and set_updated_at) but that was coincidental, not
-- because revoking from PUBLIC is generally enough.
revoke execute on function public.set_audit_user_id() from public, anon, authenticated;
