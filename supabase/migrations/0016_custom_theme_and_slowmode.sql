-- ============================================================================
-- LowKey — Custom party gradient + vibe-wall slow mode
-- ============================================================================
-- Run AFTER 0015. The app writes the FULL event object on every save, so these
-- columns MUST exist or the whole upsert fails silently (see README gotcha).
--
--   • custom_gradient          — { from, to } hex stops for a 'custom' theme
--   • vibe_wall_cooldown_seconds — min seconds between a guest's vibe-wall posts
-- ============================================================================

begin;

alter table if exists public.events add column if not exists custom_gradient jsonb;
alter table if exists public.events add column if not exists vibe_wall_cooldown_seconds numeric default 0;

commit;
