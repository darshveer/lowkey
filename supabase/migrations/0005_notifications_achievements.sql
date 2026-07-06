-- ============================================================================
-- LowKey — Notifications + profile achievements
-- ============================================================================
-- Run AFTER 0004.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Notifications (recipient_id holds the auth uid as text)
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id text primary key,
  recipient_id text,
  type text,
  title text,
  body text,
  event_id text,
  link text,
  read boolean default false,
  created_at timestamptz default now()
);

create index if not exists notifications_recipient_idx
  on public.notifications (recipient_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists notifications_own_read on public.notifications;
drop policy if exists notifications_own_update on public.notifications;
drop policy if exists notifications_insert on public.notifications;

-- A user only reads their own notifications…
create policy notifications_own_read on public.notifications
  for select to authenticated using (auth.uid()::text = recipient_id);
-- …and only marks their own as read.
create policy notifications_own_update on public.notifications
  for update to authenticated using (auth.uid()::text = recipient_id) with check (auth.uid()::text = recipient_id);
-- Any signed-in user may create one for someone else (guest → host).
create policy notifications_insert on public.notifications
  for insert to authenticated with check (true);

alter publication supabase_realtime add table public.notifications;

-- ---------------------------------------------------------------------------
-- 2. Achievements — earned badges stored on the profile
--    Array of { key, earned_at } objects.
-- ---------------------------------------------------------------------------
alter table if exists public.profiles
  add column if not exists achievements jsonb not null default '[]'::jsonb;

commit;
