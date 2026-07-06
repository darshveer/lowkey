-- ============================================================================
-- LowKey — Remove placeholder parties + demo user from the database
-- ============================================================================
-- Deletes the seeded demo parties (Rooftop Sundowner / Midnight Terrace Jam)
-- and the "Arjun Mehta" placeholder profile, so only real user-created parties
-- remain. Safe to run multiple times.
-- ============================================================================

begin;

-- Child rows first (in case FKs exist)
delete from public.rsvps    where event_id in ('party_xK9mQ2', 'party_aB3nY7');
delete from public.expenses where event_id in ('party_xK9mQ2', 'party_aB3nY7');
delete from public.photos   where event_id in ('party_xK9mQ2', 'party_aB3nY7');
delete from public.payments where event_id in ('party_xK9mQ2', 'party_aB3nY7');
delete from public.comments where event_id in ('party_xK9mQ2', 'party_aB3nY7');

-- The demo parties themselves
delete from public.events   where id in ('party_xK9mQ2', 'party_aB3nY7');

-- The placeholder host profile (only matches the old seeded row, never a real
-- signed-up user, since real profiles are keyed to auth.users uuids).
delete from public.profiles where username = 'arjun' or lower(name) = 'arjun mehta';

commit;
