-- ============================================================================
-- LowKey — Backfill the FULL column schema for the core tables
-- ============================================================================
-- Root cause of "parties don't sync between environments": the base tables
-- (events, rsvps, expenses, photos, payments) were created with a minimal
-- schema, so `upsert(fullObject)` was failing on missing columns (e.g.
-- `discoverable`) and rows never reached Supabase. This adds every column the
-- app writes. Idempotent — re-runnable, and skips columns that already exist.
--
-- Text is used for date/time fields because the app treats them as strings
-- (and may send empty strings); jsonb for objects/arrays.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- events
-- ---------------------------------------------------------------------------
alter table if exists public.events add column if not exists host_id text;
alter table if exists public.events add column if not exists host_name text;
alter table if exists public.events add column if not exists name text;
alter table if exists public.events add column if not exists tagline text;
alter table if exists public.events add column if not exists date text;
alter table if exists public.events add column if not exists time_start text;
alter table if exists public.events add column if not exists time_end text;
alter table if exists public.events add column if not exists time_end_next_day boolean;
alter table if exists public.events add column if not exists city text;
alter table if exists public.events add column if not exists location_name text;
alter table if exists public.events add column if not exists location_address text;
alter table if exists public.events add column if not exists location_lat double precision;
alter table if exists public.events add column if not exists location_lng double precision;
alter table if exists public.events add column if not exists theme text;
alter table if exists public.events add column if not exists poster_url text;
alter table if exists public.events add column if not exists spotify_playlist_url text;
alter table if exists public.events add column if not exists upi_id text;
alter table if exists public.events add column if not exists cover_charge numeric;
alter table if exists public.events add column if not exists capacity numeric;
alter table if exists public.events add column if not exists discoverable boolean default true;
alter table if exists public.events add column if not exists vibe_tags jsonb;
alter table if exists public.events add column if not exists has_personal_dj boolean;
alter table if exists public.events add column if not exists dj_name text;
alter table if exists public.events add column if not exists dj_genre text;
alter table if exists public.events add column if not exists dj_profile_url text;
alter table if exists public.events add column if not exists dj_instagram text;
alter table if exists public.events add column if not exists status text;
alter table if exists public.events add column if not exists photo_dump_unlocked boolean;
alter table if exists public.events add column if not exists contains_alcohol boolean;
alter table if exists public.events add column if not exists external_photo_link text;
alter table if exists public.events add column if not exists vibe_wall_enabled boolean default true;
alter table if exists public.events add column if not exists vibe_wall_closes_at timestamptz;
alter table if exists public.events add column if not exists co_hosts jsonb default '[]'::jsonb;
alter table if exists public.events add column if not exists started boolean default false;
alter table if exists public.events add column if not exists started_at timestamptz;
alter table if exists public.events add column if not exists archived boolean default false;
alter table if exists public.events add column if not exists created_at timestamptz default now();
alter table if exists public.events add column if not exists updated_at timestamptz default now();

-- ---------------------------------------------------------------------------
-- rsvps
-- ---------------------------------------------------------------------------
alter table if exists public.rsvps add column if not exists event_id text;
alter table if exists public.rsvps add column if not exists guest_name text;
alter table if exists public.rsvps add column if not exists user_id text;
alter table if exists public.rsvps add column if not exists guest_phone text;
alter table if exists public.rsvps add column if not exists status text;
alter table if exists public.rsvps add column if not exists poll_food jsonb;
alter table if exists public.rsvps add column if not exists poll_drinks jsonb;
alter table if exists public.rsvps add column if not exists poll_staying text;
alter table if exists public.rsvps add column if not exists guest_birthdate text;
alter table if exists public.rsvps add column if not exists guest_count numeric;
alter table if exists public.rsvps add column if not exists plus_one_requested boolean;
alter table if exists public.rsvps add column if not exists plus_one_name text;
alter table if exists public.rsvps add column if not exists plus_one_approved boolean;
alter table if exists public.rsvps add column if not exists plus_one_status text;
alter table if exists public.rsvps add column if not exists settled boolean default false;
alter table if exists public.rsvps add column if not exists checked_in boolean default false;
alter table if exists public.rsvps add column if not exists created_at timestamptz default now();
alter table if exists public.rsvps add column if not exists updated_at timestamptz default now();

-- ---------------------------------------------------------------------------
-- expenses
-- ---------------------------------------------------------------------------
alter table if exists public.expenses add column if not exists event_id text;
alter table if exists public.expenses add column if not exists description text;
alter table if exists public.expenses add column if not exists amount numeric;
alter table if exists public.expenses add column if not exists paid_by text;
alter table if exists public.expenses add column if not exists split_type text default 'equal';
alter table if exists public.expenses add column if not exists split_shares jsonb;
alter table if exists public.expenses add column if not exists receipt_url text;
alter table if exists public.expenses add column if not exists upi_id text;
alter table if exists public.expenses add column if not exists created_at timestamptz default now();

-- ---------------------------------------------------------------------------
-- photos
-- ---------------------------------------------------------------------------
alter table if exists public.photos add column if not exists event_id text;
alter table if exists public.photos add column if not exists uploaded_by text;
alter table if exists public.photos add column if not exists uploaded_by_id text;
alter table if exists public.photos add column if not exists storage_path text;
alter table if exists public.photos add column if not exists photo_url text;
alter table if exists public.photos add column if not exists caption text;
alter table if exists public.photos add column if not exists filter text;
alter table if exists public.photos add column if not exists created_at timestamptz default now();

-- ---------------------------------------------------------------------------
-- payments
-- ---------------------------------------------------------------------------
alter table if exists public.payments add column if not exists event_id text;
alter table if exists public.payments add column if not exists rsvp_id text;
alter table if exists public.payments add column if not exists amount numeric;
alter table if exists public.payments add column if not exists paid_by text;
alter table if exists public.payments add column if not exists transaction_id text;
alter table if exists public.payments add column if not exists gateway text;
alter table if exists public.payments add column if not exists status text;
alter table if exists public.payments add column if not exists created_at timestamptz default now();

commit;
