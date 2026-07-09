-- ============================================================================
-- LowKey — Self-service account deletion
-- ============================================================================
-- Run AFTER 0014.
--
-- This is a client-only SPA: the browser holds only the *publishable* key, so
-- `auth.admin.deleteUser()` (which needs the secret key) is not available. The
-- clean, architecture-consistent path — matching the trigger/RPC style of 0012
-- and 0014 — is a SECURITY DEFINER function that runs with the definer's
-- privileges (the `postgres` role, when created here), so it can delete both the
-- caller's app rows AND their `auth.users` row.
--
-- Safety: the function takes NO id argument. It always acts on `auth.uid()`, so a
-- caller can only ever delete THEMSELVES — there is nothing to forge. It is
-- granted to `authenticated` only (never anon), and the whole body runs in one
-- implicit transaction, so a failure part-way deletes nothing.
--
-- Scope (product decision: full wipe): deletes every party the user hosts and all
-- data on those parties, the user's own RSVPs (and payments linked to them), and
-- their photos / comments / follows / notifications. Finally it deletes the
-- auth.users row, which cascades to `profiles` via the FK from 0002.
-- ============================================================================

begin;

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid_text text := auth.uid()::text;
  uid_uuid uuid := auth.uid();
begin
  if uid_uuid is null then
    raise exception 'delete_my_account: not authenticated';
  end if;

  -- ----- Phase A: everything on parties this user HOSTS (child rows first) ---
  delete from public.payments      where event_id in (select id from public.events where host_id = uid_text);
  delete from public.expenses      where event_id in (select id from public.events where host_id = uid_text);
  delete from public.photos        where event_id in (select id from public.events where host_id = uid_text);
  delete from public.comments      where event_id in (select id from public.events where host_id = uid_text);
  delete from public.announcements where event_id in (select id from public.events where host_id = uid_text);
  delete from public.song_requests where event_id in (select id from public.events where host_id = uid_text);
  delete from public.rsvps         where event_id in (select id from public.events where host_id = uid_text);
  delete from public.events        where host_id = uid_text;

  -- ----- Phase B: this user's own activity on OTHER people's parties ---------
  -- Payments the user made are linked to their RSVP row — remove them before the
  -- RSVP so nothing dangles.
  delete from public.payments where rsvp_id in (select id from public.rsvps where user_id = uid_text);
  delete from public.rsvps    where user_id = uid_text;
  delete from public.photos   where uploaded_by_id = uid_text;
  delete from public.comments where author_id = uid_uuid;              -- author_id is uuid
  delete from public.follows  where follower_id = uid_text or host_id = uid_text;
  delete from public.notifications where recipient_id = uid_text;
  -- Note: expenses.paid_by, announcements.author_name and song_requests.requested_by
  -- are display names, not user ids, so there is no reliable per-user key to delete
  -- them by off a host's own events (already covered in Phase A).

  -- ----- Phase C: the auth user (cascades to public.profiles) ---------------
  delete from auth.users where id = uid_uuid;
end;
$$;

-- Only a signed-in user may call it, and only for themselves (auth.uid()).
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

commit;
