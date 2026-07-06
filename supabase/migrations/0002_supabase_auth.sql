-- ============================================================================
-- LowKey — Supabase Auth adoption
-- ============================================================================
-- Run AFTER 0001. This wires the app to real Supabase Auth:
--   • profiles.id becomes the auth user's uuid (FK -> auth.users)
--   • a trigger auto-creates a profile row on sign-up from user metadata
--   • email_for_username() lets users log in with a username
--   • production RLS policies replace the permissive demo policies from 0001
--
-- NOTE ON EMAIL CONFIRMATION:
--   For a smooth demo, in Dashboard → Authentication → Providers → Email,
--   turn OFF "Confirm email" so sign-up logs the user straight in. Leave it ON
--   for production — the app already handles the "check your email" state.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Profiles table keyed to auth.users (id is the auth uuid).
--
--    The original app created public.profiles with a TEXT id ('user_xxx'), which
--    is incompatible with auth.uid() (uuid). We drop and recreate it with a uuid
--    id so RLS policies like `auth.uid() = id` type-check.
--
--    ⚠️ This clears any rows in the old profiles table. Those rows came from the
--    pre-Auth localStorage flow and were never used for login, so it's safe — but
--    if you have real data there, back it up first.
-- ---------------------------------------------------------------------------
drop table if exists public.profiles cascade;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  name text,
  username text unique,
  birthdate date,
  phone text,
  profile_pic_b64 text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

-- Backfill profiles for any auth users that already exist.
insert into public.profiles (id, email, name, username, birthdate, phone)
select
  u.id,
  u.email,
  coalesce(u.raw_user_meta_data ->> 'name', split_part(u.email, '@', 1)),
  nullif(u.raw_user_meta_data ->> 'username', ''),
  (nullif(u.raw_user_meta_data ->> 'birthdate', ''))::date,
  nullif(u.raw_user_meta_data ->> 'phone', '')
from auth.users u
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Auto-create a profile whenever a new auth user signs up.
--    Reads the metadata passed to supabase.auth.signUp({ options: { data }}).
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, username, birthdate, phone)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    nullif(new.raw_user_meta_data ->> 'username', ''),
    (nullif(new.raw_user_meta_data ->> 'birthdate', ''))::date,
    nullif(new.raw_user_meta_data ->> 'phone', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 3. Username -> email lookup for login (security definer so the profiles
--    table itself can stay private). Returns the email or null.
-- ---------------------------------------------------------------------------
create or replace function public.email_for_username(p_username text)
returns text
language sql
security definer
set search_path = public
as $$
  select email from public.profiles where lower(username) = lower(p_username) limit 1;
$$;

grant execute on function public.email_for_username(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Production RLS — replace the permissive demo policies from 0001.
-- ---------------------------------------------------------------------------

-- Drop demo policies (safe if they don't exist)
drop policy if exists demo_profiles_select on public.profiles;
drop policy if exists demo_profiles_insert on public.profiles;
drop policy if exists demo_profiles_update on public.profiles;
drop policy if exists demo_events_select on public.events;
drop policy if exists demo_events_write  on public.events;
drop policy if exists demo_rsvps_select on public.rsvps;
drop policy if exists demo_rsvps_write  on public.rsvps;
drop policy if exists demo_expenses_select on public.expenses;
drop policy if exists demo_expenses_write  on public.expenses;
drop policy if exists demo_photos_select on public.photos;
drop policy if exists demo_photos_write  on public.photos;
drop policy if exists demo_payments_select on public.payments;
drop policy if exists demo_payments_insert on public.payments;

-- Profiles: a user manages only their own row.
create policy profiles_self_select on public.profiles
  for select to authenticated using (auth.uid() = id);
create policy profiles_self_update on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- Events: public read (invite links are shareable); only the host writes.
create policy events_public_read on public.events
  for select using (true);
create policy events_host_write on public.events
  for all to authenticated using (auth.uid()::text = host_id) with check (auth.uid()::text = host_id);

-- RSVPs: readable by all (the "who's going" list is public on the invite);
-- a guest may create/update only their own RSVP.
create policy rsvps_public_read on public.rsvps
  for select using (true);
create policy rsvps_owner_write on public.rsvps
  for all to authenticated using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);

-- Expenses & payments: limited to the event's host.
create policy expenses_host on public.expenses
  for all to authenticated
  using (auth.uid()::text in (select host_id from public.events e where e.id = event_id))
  with check (auth.uid()::text in (select host_id from public.events e where e.id = event_id));

create policy payments_read on public.payments
  for select to authenticated
  using (auth.uid()::text in (select host_id from public.events e where e.id = event_id));
create policy payments_insert on public.payments
  for insert to authenticated with check (true);

-- Ensure the column the delete policy references exists (also added in 0003).
alter table if exists public.photos add column if not exists uploaded_by_id text;

-- Photos: public read; anyone signed in can add to a party they can see.
create policy photos_public_read on public.photos
  for select using (true);
create policy photos_insert on public.photos
  for insert to authenticated with check (true);
create policy photos_owner_delete on public.photos
  for delete to authenticated using (auth.uid()::text = coalesce(uploaded_by_id, ''));

commit;
