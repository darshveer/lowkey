-- ============================================================================
-- LowKey — Secure the host-only RSVP fields (cover_paid, checked_in)
-- Run AFTER 0013.
--
-- THREAT: 0012's rsvps write policy lets a guest write *any* column on their
-- OWN row (owner branch: auth.uid()::text = user_id). That includes
-- `cover_paid` and `checked_in` — the two fields that are supposed to be set
-- only by the host/co-host (payment approval and door check-in). A malicious
-- authenticated guest could therefore PATCH their own RSVP with
-- {cover_paid:true} and skip payment entirely, since the host's door scanner
-- trusts that flag.
--
-- RLS is row-level, not column-level, so a single USING/WITH CHECK clause
-- can't express "the owner may write every column EXCEPT these two". A
-- BEFORE INSERT/UPDATE trigger is the standard fix: it forces cover_paid /
-- checked_in to stay host-controlled while leaving the rest owner-writable.
--
-- The trigger is SECURITY DEFINER so it can read events.co_hosts regardless of
-- the caller; auth.uid() inside it still reflects the CALLER's JWT (it reads
-- request.jwt.claims), which is exactly what we want.
-- ============================================================================

begin;

create or replace function public.enforce_rsvp_manager_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_manager boolean;
begin
  select (
    e.host_id = auth.uid()::text
    or exists (
      select 1 from jsonb_array_elements(coalesce(e.co_hosts, '[]'::jsonb)) co
      where co ->> 'id' = auth.uid()::text
    )
  )
  into is_manager
  from public.events e
  where e.id = coalesce(new.event_id, old.event_id);

  is_manager := coalesce(is_manager, false);
  if is_manager then
    return new; -- host/co-host may set these fields freely
  end if;

  -- A non-manager (the guest who owns the row) may never flip these to TRUE.
  -- We only block false→true (the forge); setting them back to false is a
  -- harmless self-downgrade and is left alone, so the "edit RSVP to add a
  -- guest → re-pay the delta" flow (which resets cover_paid to false) still
  -- works. We revert rather than raise, so the guest's edit of OTHER fields
  -- still commits; the reverted value re-syncs to their client on next pull.
  if tg_op = 'INSERT' then
    -- A brand-new RSVP can never be created already paid/checked-in.
    new.cover_paid := false;
    new.checked_in := false;
  else
    if coalesce(new.cover_paid, false) and not coalesce(old.cover_paid, false) then
      new.cover_paid := old.cover_paid;
    end if;
    if coalesce(new.checked_in, false) and not coalesce(old.checked_in, false) then
      new.checked_in := old.checked_in;
    end if;
  end if;

  return new;
end;
$$;

-- Trigger runs as the table owner; never expose the function via PostgREST RPC.
revoke execute on function public.enforce_rsvp_manager_fields() from anon, authenticated, public;

drop trigger if exists trg_enforce_rsvp_manager_fields on public.rsvps;
create trigger trg_enforce_rsvp_manager_fields
  before insert or update on public.rsvps
  for each row execute function public.enforce_rsvp_manager_fields();

-- Defense in depth: a guest submitting a UTR may only insert a PENDING payment.
-- (Approving is an UPDATE, already host/co-host-only via 0012's payments_update.)
-- This stops a guest from inserting a pre-'approved' row that would pollute the
-- host's Approved tab. Host/co-hosts may still insert in any state.
drop policy if exists payments_insert on public.payments;
create policy payments_insert on public.payments
  for insert to authenticated
  with check (
    exists (select 1 from public.events e where e.id = event_id)
    and (
      coalesce(status, 'pending') = 'pending'
      or exists (
        select 1 from public.events e
        where e.id = event_id
          and (
            e.host_id = auth.uid()::text
            or exists (
              select 1 from jsonb_array_elements(coalesce(e.co_hosts, '[]'::jsonb)) co
              where co ->> 'id' = auth.uid()::text
            )
          )
      )
    )
  );

commit;
