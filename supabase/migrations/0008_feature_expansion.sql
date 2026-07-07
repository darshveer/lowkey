-- ============================================================================
-- LowKey — Feature expansion
--   check-in, waitlist, plus-ones, custom splits + receipts, co-hosts,
--   announcements, song requests, follows
-- ============================================================================
-- Run AFTER 0007.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. New columns
-- ---------------------------------------------------------------------------
alter table if exists public.rsvps add column if not exists checked_in boolean default false;
alter table if exists public.rsvps add column if not exists plus_one_name text;
alter table if exists public.rsvps add column if not exists plus_one_status text; -- pending | approved | declined
-- rsvps.status may now also be 'waitlist'

alter table if exists public.expenses add column if not exists split_type text default 'equal'; -- equal | custom
alter table if exists public.expenses add column if not exists split_shares jsonb;              -- { guest: amount }
alter table if exists public.expenses add column if not exists receipt_url text;

alter table if exists public.events add column if not exists co_hosts jsonb not null default '[]'::jsonb;

-- ---------------------------------------------------------------------------
-- 2. Announcements (host broadcast)
-- ---------------------------------------------------------------------------
create table if not exists public.announcements (
  id text primary key,
  event_id text,
  body text,
  author_name text,
  created_at timestamptz default now()
);
alter table public.announcements enable row level security;
drop policy if exists announcements_read on public.announcements;
drop policy if exists announcements_insert on public.announcements;
create policy announcements_read on public.announcements for select using (true);
create policy announcements_insert on public.announcements
  for insert to authenticated
  with check (auth.uid()::text in (select host_id from public.events e where e.id = event_id));

-- ---------------------------------------------------------------------------
-- 3. Song requests (playlist queue)
-- ---------------------------------------------------------------------------
create table if not exists public.song_requests (
  id text primary key,
  event_id text,
  title text,
  requested_by text,
  votes int default 1,
  created_at timestamptz default now()
);
alter table public.song_requests enable row level security;
drop policy if exists song_requests_read on public.song_requests;
drop policy if exists song_requests_insert on public.song_requests;
drop policy if exists song_requests_update on public.song_requests;
create policy song_requests_read on public.song_requests for select using (true);
create policy song_requests_insert on public.song_requests
  for insert to anon, authenticated with check (event_id is not null and length(title) > 0);
create policy song_requests_update on public.song_requests
  for update to anon, authenticated using (true) with check (true); -- vote counter

-- ---------------------------------------------------------------------------
-- 4. Follows (follow a host)
-- ---------------------------------------------------------------------------
create table if not exists public.follows (
  id text primary key,
  follower_id text,
  host_id text,
  created_at timestamptz default now()
);
alter table public.follows enable row level security;
drop policy if exists follows_own_read on public.follows;
drop policy if exists follows_own_write on public.follows;
create policy follows_own_read on public.follows
  for select to authenticated using (auth.uid()::text = follower_id);
create policy follows_own_write on public.follows
  for all to authenticated using (auth.uid()::text = follower_id) with check (auth.uid()::text = follower_id);

-- ---------------------------------------------------------------------------
-- 5. Realtime for the live surfaces
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.announcements;
alter publication supabase_realtime add table public.song_requests;

commit;
