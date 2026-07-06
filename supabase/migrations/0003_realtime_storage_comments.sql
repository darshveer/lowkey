-- ============================================================================
-- LowKey — Vibe wall (comments), photo storage, settlement + realtime
-- ============================================================================
-- Run AFTER 0002.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. New columns used by the app
-- ---------------------------------------------------------------------------
alter table if exists public.rsvps  add column if not exists settled boolean default false;
alter table if exists public.photos add column if not exists uploaded_by_id text;
alter table if exists public.photos add column if not exists storage_path text;

-- ---------------------------------------------------------------------------
-- 2. Comments / vibe wall
-- ---------------------------------------------------------------------------
create table if not exists public.comments (
  id text primary key,
  event_id text,
  author_name text,
  author_id uuid,
  body text,
  created_at timestamptz default now()
);

alter table public.comments enable row level security;

drop policy if exists comments_public_read on public.comments;
drop policy if exists comments_insert on public.comments;
create policy comments_public_read on public.comments for select using (true);
create policy comments_insert on public.comments for insert to anon, authenticated with check (true);

-- ---------------------------------------------------------------------------
-- 3. Storage bucket for party photos (public read)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('party-photos', 'party-photos', true)
on conflict (id) do nothing;

drop policy if exists party_photos_read on storage.objects;
drop policy if exists party_photos_insert on storage.objects;
create policy party_photos_read on storage.objects
  for select using (bucket_id = 'party-photos');
create policy party_photos_insert on storage.objects
  for insert to authenticated with check (bucket_id = 'party-photos');

-- ---------------------------------------------------------------------------
-- 4. Enable realtime broadcasts for the live views
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.rsvps;
alter publication supabase_realtime add table public.photos;
alter publication supabase_realtime add table public.comments;

commit;
