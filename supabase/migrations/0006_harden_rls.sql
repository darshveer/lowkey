-- ============================================================================
-- LowKey — Harden RLS & functions (clears Supabase security WARNINGs)
-- ============================================================================
-- Run AFTER 0005. Addresses:
--   • rls_policy_always_true  (comments/notifications/payments/photos INSERT)
--   • public_bucket_allows_listing (party-photos)
--   • anon/authenticated SECURITY DEFINER executable (handle_new_user, email_for_username)
--
-- NOTE: "Leaked password protection" is an Auth dashboard setting, not SQL —
-- enable it under Dashboard → Authentication → Policies → Password security.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Replace permissive `WITH CHECK (true)` INSERT policies with real predicates
-- ---------------------------------------------------------------------------

-- Comments: an author may only post as themselves (or as an anonymous guest).
drop policy if exists comments_insert on public.comments;
create policy comments_insert on public.comments
  for insert to anon, authenticated
  with check (author_id is null or auth.uid() = author_id);

-- Notifications: must target a real recipient (still cross-user by design).
drop policy if exists notifications_insert on public.notifications;
create policy notifications_insert on public.notifications
  for insert to authenticated
  with check (recipient_id is not null and length(recipient_id) > 0);

-- Payments: must reference an existing event.
drop policy if exists payments_insert on public.payments;
create policy payments_insert on public.payments
  for insert to authenticated
  with check (exists (select 1 from public.events e where e.id = event_id));

-- Photos: must reference an existing event and not spoof another uploader.
drop policy if exists photos_insert on public.photos;
create policy photos_insert on public.photos
  for insert to authenticated
  with check (
    exists (select 1 from public.events e where e.id = event_id)
    and (uploaded_by_id is null or auth.uid()::text = uploaded_by_id)
  );

-- ---------------------------------------------------------------------------
-- 2. Public bucket should not allow listing. Public object URLs still resolve
--    via the CDN without a broad SELECT policy, so we drop it.
-- ---------------------------------------------------------------------------
drop policy if exists party_photos_read on storage.objects;

-- ---------------------------------------------------------------------------
-- 3. Lock down SECURITY DEFINER functions exposed via PostgREST
-- ---------------------------------------------------------------------------

-- handle_new_user is a trigger function — it must never be callable via RPC.
-- Triggers still fire after revoking EXECUTE (they run as the table owner).
revoke execute on function public.handle_new_user() from anon, authenticated, public;

-- email_for_username enabled username login by resolving username -> email as a
-- SECURITY DEFINER RPC. That's an email-enumeration surface, so we drop it and
-- switch the app to email-only login (see src/utils/storage.js loginUser).
drop function if exists public.email_for_username(text);

commit;
