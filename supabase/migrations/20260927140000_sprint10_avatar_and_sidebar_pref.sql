-- Sprint 10: profile picture upload and a per-user sidebar display
-- preference (collapsed vs expanded).

alter table profiles add column avatar_url text;
alter table profiles add column sidebar_collapsed boolean not null default false;

-- The self-update policy on profiles is real, but a separate column-level
-- grant restricts what "self" can actually change (previously name only —
-- see 20260919174923_fix_profile_role_escalation.sql). Extend it to the two
-- new columns; role and tenant_id stay out of reach on purpose.
grant update (avatar_url, sidebar_collapsed) on public.profiles to authenticated;

-- Avatars are shown as plain <img> tags across the app, so the bucket is
-- public-read; avatar images aren't sensitive. Writes are restricted below to
-- each user's own folder (their auth uid as the first path segment).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 3145728, array['image/jpeg', 'image/png', 'image/webp']);

create policy "avatar images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "users can upload their own avatar"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "users can replace their own avatar"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "users can delete their own avatar"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
