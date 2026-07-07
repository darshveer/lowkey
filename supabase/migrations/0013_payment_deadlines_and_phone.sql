-- ============================================================================
-- LowKey — Payment deadlines, waitlist auto-promotion, phone capture
-- Run AFTER 0012.
--
-- events.payment_deadline_hours — host-configurable window (default 12h) a
--   guest has to submit an approved UTR before their RSVP auto-expires.
-- rsvps.payment_deadline_at — the computed deadline for a specific RSVP
--   (12h from RSVP, or 1h from waitlist promotion — tighter since a spot
--   was freed for them).
-- rsvps.payment_reminder_sent — guards the one-time reminder notification so
--   it doesn't refire on every client-side sweep.
-- payments.phone — collected at submission time so a host can cross-check a
--   UTR against the guest's own bank app, and so the Approvals tab can be
--   searched by phone number.
-- ============================================================================

begin;

alter table if exists public.events add column if not exists payment_deadline_hours numeric default 12;
alter table if exists public.rsvps add column if not exists payment_deadline_at timestamptz;
alter table if exists public.rsvps add column if not exists payment_reminder_sent boolean default false;
alter table if exists public.payments add column if not exists phone text;

commit;
