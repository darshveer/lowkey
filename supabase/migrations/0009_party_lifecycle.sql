-- ============================================================================
-- LowKey — Party lifecycle (start / archive)
-- ============================================================================
-- Run AFTER 0008. Deletion uses the existing events_host_write policy (which
-- covers DELETE for the host).
-- ============================================================================

begin;

alter table if exists public.events add column if not exists started boolean default false;
alter table if exists public.events add column if not exists started_at timestamptz;
alter table if exists public.events add column if not exists archived boolean default false;

commit;
