-- ============================================================================
-- LowKey — Vibe wall moderation: allow deleting comments
-- Run AFTER 0010.
--
-- Who may delete a comment:
--   • its author (comments.author_id is a uuid = auth.uid()), or
--   • the host of the event it belongs to (events.host_id is text holding
--     the host's auth uuid, hence the ::text cast).
-- Anonymous guests (author_id is null) have no identity to authorize, so
-- their posts can only be removed by the host.
-- ============================================================================

begin;

drop policy if exists comments_delete on public.comments;
create policy comments_delete on public.comments
  for delete to authenticated
  using (
    auth.uid() = author_id
    or exists (
      select 1 from public.events e
      where e.id = comments.event_id
        and e.host_id = auth.uid()::text
    )
  );

commit;
