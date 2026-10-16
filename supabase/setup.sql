-- Execute once in the Supabase SQL Editor. No secret belongs in this file.
create table if not exists public.roomora_projects (
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id uuid not null,
  name text not null check (length(name) between 1 and 500),
  revision uuid not null,
  document jsonb not null check (octet_length(document::text) <= 5242880),
  updated_at timestamptz not null default now(),
  primary key (owner_id, project_id)
);
alter table public.roomora_projects enable row level security;
revoke all on public.roomora_projects from anon;
grant select, insert, update, delete on public.roomora_projects to authenticated;
drop policy if exists "Own apartments only" on public.roomora_projects;
create policy "Own apartments only" on public.roomora_projects for all to authenticated
using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create or replace function public.roomora_touch_project() returns trigger language plpgsql
set search_path = '' as $$ begin new.updated_at = now(); return new; end; $$;
drop trigger if exists roomora_updated on public.roomora_projects;
create trigger roomora_updated before update on public.roomora_projects
for each row execute function public.roomora_touch_project();
-- 20 MiB chunks keep large 100 MiB models below individual free-tier upload limits.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('roomora-private', 'roomora-private', false, 20971520, array['application/octet-stream'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "Read own Roomora files" on storage.objects;
create policy "Read own Roomora files" on storage.objects for select to authenticated
using (bucket_id = 'roomora-private' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "Upload own Roomora files" on storage.objects;
create policy "Upload own Roomora files" on storage.objects for insert to authenticated
with check (bucket_id = 'roomora-private' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "Delete own Roomora files" on storage.objects;
create policy "Delete own Roomora files" on storage.objects for delete to authenticated
using (bucket_id = 'roomora-private' and (storage.foldername(name))[1] = (select auth.uid())::text);
