-- ============================================================================
-- LowKey — Server-side payment/waitlist sweeps on a schedule (+ keep-alive)
-- ============================================================================
-- Run AFTER 0016.
--
-- The app's payment-deadline / reminder / waitlist-promotion logic normally runs
-- LAZILY in the browser (checkPaymentDeadlines, on page load) — so a party nobody
-- opens never sweeps. This ports that logic to SQL and runs it on a schedule via
-- pg_cron, so unpaid RSVPs expire and the waitlist promotes even with no visitors.
-- Because the job reads+writes every 15 minutes, it also doubles as a keep-alive
-- that stops a free-tier project from pausing on inactivity.
--
-- PREREQUISITE (Supabase dashboard → Database → Extensions): enable `pg_cron`.
-- (This file also tries `create extension`, which works if your role may.)
--
-- Mirrors src/utils/storage.js:
--   • reminder lead      = 2 hours   (PAYMENT_REMINDER_LEAD_HOURS)
--   • promoted deadline  = 1 hour    (PROMOTED_PAYMENT_DEADLINE_HOURS)
--   • "unpaid" = rsvps.cover_paid is not true
-- ============================================================================

begin;

-- One id generator matching the app's text primary keys (nanoid-ish is fine; the
-- app only needs uniqueness, not a specific shape).
create extension if not exists pgcrypto;

create or replace function public.run_payment_sweeps()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 1) One-time reminders for 'going' guests who owe a cover and whose deadline
  --    is within the 2-hour lead window.
  with reminded as (
    update public.rsvps r
       set payment_reminder_sent = true, updated_at = now()
     where r.status = 'going'
       and coalesce(r.cover_paid, false) = false
       and r.payment_deadline_at is not null
       and coalesce(r.payment_reminder_sent, false) = false
       and r.payment_deadline_at > now()
       and r.payment_deadline_at <= now() + interval '2 hours'
    returning r.id, r.user_id, r.event_id
  )
  insert into public.notifications (id, recipient_id, event_id, type, title, body, link, read, created_at)
  select 'ntf_remind_' || id, user_id, event_id, 'payment',
         'Payment reminder', 'Submit your UTR soon to keep your spot.',
         '/invite/' || event_id, false, now()
  from reminded
  where user_id is not null
  on conflict (id) do nothing;  -- deterministic id shared with the client sweep → no dupes

  -- 2) Expire 'going' RSVPs whose deadline passed without an approved payment,
  --    freeing the spot; notify the guest.
  with expired as (
    delete from public.rsvps r
     where r.status = 'going'
       and coalesce(r.cover_paid, false) = false
       and r.payment_deadline_at is not null
       and r.payment_deadline_at < now()
    returning r.id, r.user_id, r.event_id
  )
  insert into public.notifications (id, recipient_id, event_id, type, title, body, link, read, created_at)
  select 'ntf_expired_' || id, user_id, event_id, 'payment',
         'Spot released',
         'Your RSVP was removed — payment wasn''t confirmed in time. RSVP again if there''s room.',
         '/invite/' || event_id, false, now()
  from expired
  where user_id is not null
  on conflict (id) do nothing;  -- matches the client's ntf_expired_<rsvp> id → no dupes

  -- 3) Promote the oldest fitting waitlisted guest wherever a spot is now free.
  --    (Runs after step 2, so it sees the freed capacity.) One per event per run.
  with room as (
    select e.id as event_id,
           e.capacity,
           coalesce(e.cover_charge, 0) as cover_charge,
           e.capacity - coalesce((
             select sum(coalesce(r2.guest_count, 1)) from public.rsvps r2
             where r2.event_id = e.id and r2.status = 'going'
           ), 0) as free
    from public.events e
    where e.capacity is not null
  ),
  pick as (
    select distinct on (w.event_id) w.id, w.event_id, room.cover_charge
    from public.rsvps w
    join room on room.event_id = w.event_id
    where w.status = 'waitlist'
      and room.free > 0
      and coalesce(w.guest_count, 1) <= room.free
    order by w.event_id, w.created_at asc
  ),
  promoted as (
    update public.rsvps r
       set status = 'going',
           cover_paid = case when p.cover_charge > 0 then false else r.cover_paid end,
           payment_reminder_sent = case when p.cover_charge > 0 then false else r.payment_reminder_sent end,
           payment_deadline_at = case when p.cover_charge > 0 then now() + interval '1 hour' else r.payment_deadline_at end,
           updated_at = now()
      from pick p
     where r.id = p.id
    returning r.id, r.user_id, r.event_id, p.cover_charge
  )
  insert into public.notifications (id, recipient_id, event_id, type, title, body, link, read, created_at)
  select 'ntf_promoted_' || id, user_id, event_id, 'waitlist',
         'You''re off the waitlist!',
         case when cover_charge > 0
              then 'A spot opened up — pay within 1 hour to keep it.'
              else 'A spot opened up — you''re in.' end,
         '/invite/' || event_id, false, now()
  from promoted
  where user_id is not null
  on conflict (id) do nothing;  -- matches the client's ntf_promoted_<rsvp> id → no dupes
end;
$$;

-- Cron may trigger it; app clients never call it (they sweep client-side).
revoke all on function public.run_payment_sweeps() from public, anon, authenticated;

-- Schedule every 15 minutes. Requires the pg_cron extension (enable it in the
-- dashboard if `create extension` is not permitted for your role).
create extension if not exists pg_cron;

-- Replace any prior schedule of the same name, then (re)create it.
select cron.unschedule('lowkey-payment-sweeps')
where exists (select 1 from cron.job where jobname = 'lowkey-payment-sweeps');

select cron.schedule('lowkey-payment-sweeps', '*/15 * * * *', $$ select public.run_payment_sweeps(); $$);

commit;
