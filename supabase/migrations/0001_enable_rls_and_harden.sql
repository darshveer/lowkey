-- ============================================================================
-- LowKey — Enable Row Level Security + remove exposed password column
-- ============================================================================
-- Run this in the Supabase Dashboard → SQL Editor (or `supabase db push`).
--
-- Fixes the Supabase linter ERRORs:
--   • rls_disabled_in_public   (profiles, events, rsvps, expenses, photos, payments)
--   • sensitive_columns_exposed (profiles.password)
--
-- IMPORTANT — READ THIS FIRST
-- ---------------------------------------------------------------------------
-- LowKey currently talks to Supabase using ONLY the publishable (anon) key,
-- with no signed-in Supabase Auth user. That means there is no `auth.uid()` to
-- key policies on, so the "DEMO" policies below are intentionally permissive:
-- they let the app keep working, and they satisfy the linter, but anyone with
-- the (public) key can still read/write these rows.
--
-- For real security you MUST adopt Supabase Auth and switch to the "PRODUCTION"
-- policies at the bottom (currently commented out). The one thing that is fixed
-- unconditionally here is the plaintext password leak — that column is dropped.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Remove the plaintext password column (never store passwords like this).
--    Passwords belong in Supabase Auth (auth.users), which hashes them.
-- ---------------------------------------------------------------------------
alter table if exists public.profiles drop column if exists password;

-- ---------------------------------------------------------------------------
-- 2. Enable Row Level Security on every exposed table.
--    (With RLS enabled and no policy, access is denied by default.)
-- ---------------------------------------------------------------------------
alter table if exists public.profiles enable row level security;
alter table if exists public.events   enable row level security;
alter table if exists public.rsvps    enable row level security;
alter table if exists public.expenses enable row level security;
alter table if exists public.photos   enable row level security;
alter table if exists public.payments enable row level security;

-- ===========================================================================
-- 3. DEMO POLICIES (permissive — keeps the current keyless app working)
--    Delete this whole block once you move to Supabase Auth (step 4).
-- ===========================================================================

-- events: public party data shared via invite links.
drop policy if exists demo_events_select on public.events;
drop policy if exists demo_events_write  on public.events;
create policy demo_events_select on public.events for select to anon, authenticated using (true);
create policy demo_events_write  on public.events for all    to anon, authenticated using (true) with check (true);

-- rsvps
drop policy if exists demo_rsvps_select on public.rsvps;
drop policy if exists demo_rsvps_write  on public.rsvps;
create policy demo_rsvps_select on public.rsvps for select to anon, authenticated using (true);
create policy demo_rsvps_write  on public.rsvps for all    to anon, authenticated using (true) with check (true);

-- expenses
drop policy if exists demo_expenses_select on public.expenses;
drop policy if exists demo_expenses_write  on public.expenses;
create policy demo_expenses_select on public.expenses for select to anon, authenticated using (true);
create policy demo_expenses_write  on public.expenses for all    to anon, authenticated using (true) with check (true);

-- photos
drop policy if exists demo_photos_select on public.photos;
drop policy if exists demo_photos_write  on public.photos;
create policy demo_photos_select on public.photos for select to anon, authenticated using (true);
create policy demo_photos_write  on public.photos for all    to anon, authenticated using (true) with check (true);

-- payments (references only — never store card/PAN data here)
drop policy if exists demo_payments_select on public.payments;
drop policy if exists demo_payments_write  on public.payments;
create policy demo_payments_select on public.payments for select to anon, authenticated using (true);
create policy demo_payments_insert on public.payments for insert to anon, authenticated with check (true);

-- profiles: still PII (email/phone/dob). Permissive here so host names + sync work.
-- WARNING: this exposes profile PII to anyone with the anon key — tighten via
-- step 4 in production.
drop policy if exists demo_profiles_select on public.profiles;
drop policy if exists demo_profiles_insert on public.profiles;
drop policy if exists demo_profiles_update on public.profiles;
create policy demo_profiles_select on public.profiles for select to anon, authenticated using (true);
create policy demo_profiles_insert on public.profiles for insert to anon, authenticated with check (true);
create policy demo_profiles_update on public.profiles for update to anon, authenticated using (true) with check (true);

commit;

-- ===========================================================================
-- 4. PRODUCTION POLICIES (recommended) — enable AFTER migrating to Supabase Auth
-- ---------------------------------------------------------------------------
-- Steps:
--   a) Replace the custom login in src/utils/storage.js with
--      supabase.auth.signUp() / supabase.auth.signInWithPassword().
--   b) Make profiles.id equal to auth.users.id (uuid).
--   c) Drop the demo_* policies above and enable the policies below.
--
-- -- Profiles: a user can read/update only their own row.
-- create policy profiles_self_select on public.profiles
--   for select to authenticated using (auth.uid() = id);
-- create policy profiles_self_upsert on public.profiles
--   for insert to authenticated with check (auth.uid() = id);
-- create policy profiles_self_update on public.profiles
--   for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
--
-- -- Events: anyone can read (invite links are public); only the host can write.
-- create policy events_public_read on public.events
--   for select using (true);
-- create policy events_host_write on public.events
--   for all to authenticated using (auth.uid() = host_id) with check (auth.uid() = host_id);
--
-- -- RSVPs: readable by the event host; a guest may write only their own RSVP.
-- create policy rsvps_read on public.rsvps
--   for select to authenticated using (
--     auth.uid() = user_id
--     or auth.uid() in (select host_id from public.events e where e.id = event_id)
--   );
-- create policy rsvps_owner_write on public.rsvps
--   for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
--
-- -- Expenses / payments: restricted to the event host.
-- create policy expenses_host on public.expenses
--   for all to authenticated using (
--     auth.uid() in (select host_id from public.events e where e.id = event_id)
--   ) with check (
--     auth.uid() in (select host_id from public.events e where e.id = event_id)
--   );
-- ===========================================================================
