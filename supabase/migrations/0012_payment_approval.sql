-- ============================================================================
-- LowKey — UTR payment approval workflow + entry-QR gating
-- Run AFTER 0011.
--
-- Feature: guests submit a UPI UTR as proof of payment; the host (or a
-- co-host) manually approves or declines it. `payments.status` moves through
-- 'pending' -> 'approved' | 'declined' (no schema change needed — the column
-- is already free text with no CHECK constraint). Approving a cover-charge
-- payment (payments.rsvp_id is not null) flips the new rsvps.cover_paid flag,
-- which — together with a 1-day-out time window — gates the guest's entry QR.
--
-- Also fixes a real pre-existing gap: rsvps_owner_write only ever let the
-- RSVP's OWNER write to it, so every host-side mutation of a GUEST's row
-- (check-in toggle, settled toggle, +1 approve/deny, and now cover_paid) was
-- silently rejected by RLS and never reached the cloud. Co-hosts (stored as
-- {email,id,username,name} entries in events.co_hosts jsonb) need the same
-- write access since they run the door alongside the host.
-- ============================================================================

begin;

alter table if exists public.rsvps add column if not exists cover_paid boolean default false;

-- Shared predicate: true if auth.uid() is the event's host OR listed as a
-- co-host by id. Expressed inline (Postgres has no reusable RLS macros)
-- rather than a function, to keep this a single self-contained migration.

-- RSVPs: owner keeps write access to their own row; host/co-hosts gain write
-- access to every RSVP under their event (needed for check-in, settlement,
-- +1 decisions, and cover_paid).
drop policy if exists rsvps_owner_write on public.rsvps;
drop policy if exists rsvps_owner_or_manager_write on public.rsvps;
create policy rsvps_owner_or_manager_write on public.rsvps
  for all to authenticated
  using (
    auth.uid()::text = user_id
    or exists (
      select 1 from public.events e
      where e.id = rsvps.event_id
        and (
          e.host_id = auth.uid()::text
          or exists (
            select 1 from jsonb_array_elements(coalesce(e.co_hosts, '[]'::jsonb)) co
            where co ->> 'id' = auth.uid()::text
          )
        )
    )
  )
  with check (
    auth.uid()::text = user_id
    or exists (
      select 1 from public.events e
      where e.id = rsvps.event_id
        and (
          e.host_id = auth.uid()::text
          or exists (
            select 1 from jsonb_array_elements(coalesce(e.co_hosts, '[]'::jsonb)) co
            where co ->> 'id' = auth.uid()::text
          )
        )
    )
  );

-- Payments: host/co-hosts may approve/decline (update); insert stays as-is
-- (0006) since a guest submitting their own UTR is still an insert.
drop policy if exists payments_update on public.payments;
create policy payments_update on public.payments
  for update to authenticated
  using (
    exists (
      select 1 from public.events e
      where e.id = payments.event_id
        and (
          e.host_id = auth.uid()::text
          or exists (
            select 1 from jsonb_array_elements(coalesce(e.co_hosts, '[]'::jsonb)) co
            where co ->> 'id' = auth.uid()::text
          )
        )
    )
  )
  with check (
    exists (
      select 1 from public.events e
      where e.id = payments.event_id
        and (
          e.host_id = auth.uid()::text
          or exists (
            select 1 from jsonb_array_elements(coalesce(e.co_hosts, '[]'::jsonb)) co
            where co ->> 'id' = auth.uid()::text
          )
        )
    )
  );

commit;
