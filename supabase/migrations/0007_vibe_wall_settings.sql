-- ============================================================================
-- LowKey — Vibe wall settings on events
-- ============================================================================
-- Run AFTER 0006. Adds the optional vibe-wall toggle + auto-close timer.
-- ============================================================================

begin;

alter table if exists public.events
  add column if not exists vibe_wall_enabled boolean default true;

alter table if exists public.events
  add column if not exists vibe_wall_closes_at timestamptz;

commit;
