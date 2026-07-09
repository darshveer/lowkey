# LowKey — House Parties, Simplified

LowKey is a mobile-first web app for planning and running house parties: create an
aesthetic invite, share it, collect RSVPs (with food/drink prefs, plus-ones, and a
waitlist), collect UPI cover-charge payments with host approval, scan guests in at
the door with a live camera QR scanner, drop a shared photo dump, and keep the hype
on a live vibe wall. Built for the Indian Gen-Z scene.

> **Status:** functional MVP. **localStorage-first** with best-effort Supabase cloud
> sync + realtime. Payments are UPI-only: a guest submits a UTR, the host (or a
> co-host) manually approves or declines it. Auth is real Supabase Auth.

> **📌 If you are a new agent picking this up, read [Architecture](#architecture),
> [Gotchas & hard-won lessons](#gotchas--hard-won-lessons), and [Notes for AI agents](#notes-for-ai-agents) first.**
> The single most important fact: the app writes the *entire* object to Supabase, so
> **the DB schema must contain every column** — run all migrations `0001 → 0017` or writes fail silently.

---

## Table of contents
- [Commands](#commands)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Entry points & data flow](#entry-points--data-flow)
- [Project structure](#project-structure)
- [Data model](#data-model)
- [Supabase migrations](#supabase-migrations)
- [Auth model](#auth-model)
- [Security model](#security-model)
- [Routes](#routes)
- [Features](#features)
- [The data layer (`storage.js`)](#the-data-layer-storagejs)
- [Utilities](#utilities)
- [Environment variables](#environment-variables)
- [Local development & Supabase setup](#local-development--supabase-setup)
- [Payments (UPI + host approval)](#payments-upi--host-approval)
- [Deployment (Vercel)](#deployment-vercel)
- [Design system & conventions](#design-system--conventions)
- [Gotchas & hard-won lessons](#gotchas--hard-won-lessons)
- [How to verify changes](#how-to-verify-changes)
- [Notes for AI agents](#notes-for-ai-agents)

---

## Commands
```bash
npm install
cp .env.example .env.local     # then fill in Supabase values; restart dev after edits
npm run dev                    # Vite dev server, --host (http://localhost:5173)
npm run lint                   # ESLint (flat config) — MUST pass
npm run build                  # production build → dist/
npm run preview                # serve the production build
```
There is **no test suite**. Verification is done by `lint` + `build` + driving the app
(see [How to verify changes](#how-to-verify-changes)). CI: none.

---

## Tech stack
- **React 19** + **Vite 8** — JSX, **no TypeScript**
- **React Router 7** — SPA routes, route-level code splitting (`React.lazy` + `Suspense`)
- **Supabase** (`@supabase/supabase-js`) — Postgres, Auth, Storage, Realtime
- **Leaflet** — interactive map pin-picker (Creator Studio)
- **OpenStreetMap / Nominatim** — address search, reverse geocoding, map embeds (keyless)
- **Open-Meteo** — weather forecast (keyless)
- `qrcode` (UPI + entry-pass QR generation), `qr-scanner` (camera-based QR decode for door check-in), `nanoid` (ids)
- **Vercel** — hosting (no serverless functions currently — Razorpay was removed; see [Payments](#payments-upi--host-approval))
- ESLint 9 flat config (`eslint.config.js`): `src/**` = browser globals, `api/**` = node globals
- No CSS framework — hand-rolled design system in `src/index.css` + per-component CSS.

---

## Architecture

**localStorage-first with best-effort cloud sync.** Everything goes through
`src/utils/storage.js`:
- Writes persist to `localStorage` **synchronously** (instant UI, works offline), then
  **mirror to Supabase in the background** (`.then(({error}) => …)`).
- On load, `syncWithSupabase()` pulls cloud rows and **merges** them into the local cache
  (`mergeById`). Called once in `main.jsx`.
- Supabase failures **never throw** — they now surface via `reportSyncError` → a
  `lowkey_sync_error` window event → a toast in `App.jsx` (previously they were silent).

**Consequences you must understand:**
1. **`localStorage` is per-origin.** `lowkey.vercel.app` and `localhost:5173` have
   *separate* storage. The **only** bridge between environments/devices is Supabase.
2. **A background write only lands if the DB schema has every column.** The app does
   `supabase.from('events').upsert(fullEventObject)`. If the table is missing *any*
   column the object has, the whole write errors → the row **never reaches Supabase** and
   only lives in the browser that created it. This caused a real bug where parties made on
   Vercel were invisible on localhost (the `events` table was missing `discoverable` and
   others). **Fix = migration [0010](supabase/migrations/0010_full_table_schema.sql)**,
   which backfills the full schema.
3. `getCurrentUser()` reads the **cached** session, so it is **synchronous** — that's why
   React state initializers can call it directly. Don't make it async.

**Auth.** Real **Supabase Auth** — email/password (`signUp` / `signInWithPassword`, **email-only**
login) **plus Google OAuth** (`signInWithOAuth`; see [Auth model](#auth-model)).
A DB trigger (`handle_new_user`) creates the `profiles` row from signup metadata. The
signed-in profile is cached in `localStorage['lowkey_session']`; `initAuth()` (in `App.jsx`)
hydrates it from the real session on load and subscribes to auth changes.

**Realtime.** `subscribeToEvent()` / `subscribeToNotifications()` use Supabase Realtime.
**Every subscription gets a UNIQUE channel topic** (a module counter, `event:<id>:<n>`) —
sharing a topic makes supabase-js throw "cannot add callbacks after subscribe()" and
crashes the page (this happened when the dashboard + embedded VibeWall both subscribed).

**Ambient FX.** Global animated background (`AnimatedBackground`), cursor-follow glow
(`CursorGlow`, disabled on touch), scroll-reveal (`Reveal`, IntersectionObserver). All
honor `prefers-reduced-motion`. FX accent colors retint per party theme via a
`data-party-theme` attribute set on `<html>` by GuestInvite/PartyDashboard.

**Page transitions.** `TransitionProvider` (mounted in `main.jsx`) exposes two APIs via
`useTransition()`:
- `playTransition(action)` — split-curtain: two panels sweep in to meet at center behind the
  LowKey logo, the (optionally async) `action` runs while fully covered, then the panels split
  apart to reveal the new state. Wired to email/password login & signup, logout, account
  deletion, and **profile completion** (first-time Google users, after they set username + DOB).
- `playReveal()` — reveal-only: the curtain mounts already covering the screen and just splits
  apart. Used for **Google OAuth return** (an "arrival" — there's no action to run, the app is
  already loaded). `main.jsx` sets a `sessionStorage['lowkey_oauth_return']` flag when the URL
  carries an OAuth `code`/`access_token` (before supabase-js strips it); `App.jsx` consumes it
  once the session hydrates and plays the reveal. Normal loads (no flag) get no curtain.

Every route change also replays a soft fade/slide-in (`.route-view`, keyed by pathname in
`App.jsx`). All of the above **skip entirely under `prefers-reduced-motion`** (the provider runs
the action instantly; no overlay). The curtain sits at `z-index: 3000`, above toasts
(`--z-toast: 2000`).

**Loading indicator.** `LogoLoader` (`components/LogoLoader.jsx`) is the brand loader — the logo
pulsing inside an orbiting conic-gradient ring. Used for the lazy-route fallback and the UPI-QR
generation state; reuse it for any new loading spot. Reduced-motion friendly.

---

## Entry points & data flow
- `src/main.jsx` — bootstraps: `clearLegacyPlaceholders()` → `syncWithSupabase()` →
  renders `<BrowserRouter><ToastProvider><TransitionProvider><App/></TransitionProvider></ToastProvider></BrowserRouter>`
  → registers the service worker (prod only).
- `src/App.jsx` — routes, `initAuth()` hydration, the `lowkey_sync_error` toast listener,
  global FX mount, lazy-loaded pages.
- **Representative flow — create a party:**
  `CreatorStudio.jsx` (multi-step wizard) builds the `event` object →
  `saveEvent(event)` [storage.js] writes `localStorage['lowkey_events']` **and**
  `supabase.from('events').upsert(...)` → `navigate('/party/:id')` →
  `PartyDashboard.jsx` reads it via `getEvent(eventId)` (sync, from cache).
- **Representative flow — RSVP:** `GuestInvite.jsx` `handleRSVP()` → age/capacity checks →
  builds `rsvpData` → if at capacity, status `waitlist`; if cover charge, opens
  `PaymentModal` → `submitRSVP()` → `addRSVP()` (writes + notifies host) → shows `QRTicket`
  (locked until the host presses **Start Party**).

---

## Project structure
```
.
├── public/                  # favicon.svg (brand mark), manifest.webmanifest, sw.js, _redirects
├── supabase/migrations/     # ordered SQL — run 0001 → 0017
├── src/
│   ├── main.jsx             # entry
│   ├── App.jsx              # routes + auth hydration + sync-error toast + FX
│   ├── index.css            # ★ design tokens, base styles, animations, per-theme FX vars
│   ├── App.css
│   ├── pages/
│   │   ├── Home.jsx         # discover (search/filter/follow/activity), auth forms, my-parties/RSVPs tabs
│   │   ├── CreatorStudio.jsx# 5-step create wizard (uses LocationPicker + AddressSearch)
│   │   ├── GuestInvite.jsx  # /invite/:id — public invite: RSVP, +1, waitlist, QR ticket, calendar,
│   │   │                    #   weather, songs, vibe wall, announcements, follow, map, UPI payment
│   │   ├── PartyDashboard.jsx# /party/:id — host tools: guests/check-in/scan, kitty (custom split+receipt),
│   │   │                    #   payment approvals, photos, announcements, co-hosts, recap, lifecycle
│   │   └── ProfilePage.jsx  # /profile — insights, achievements, hosted list (active/archived tabs + search), duplicate, re-sync
│   ├── components/          # ~30 components, each with a paired .css (see below)
│   ├── context/toast-context.js  # ToastContext (paired with hooks/useToast.js + ToastProvider.jsx)
│   ├── hooks/useToast.js
│   ├── data/
│   │   ├── mockData.js      # DISCOVERY_CITIES, PARTY_THEMES, clearLegacyPlaceholders()  (NO mock parties)
│   │   └── achievements.js  # ACHIEVEMENTS defs + computeStats() + earnedKeys()
│   └── utils/               # storage.js ★, supabase.js, geo.js, calendar.js, qr.js, upi.js, helpers.js
├── eslint.config.js         # flat config (src=browser, api=node)
├── vercel.json              # framework=vite + SPA rewrites
└── vite.config.js
```
There is no `api/` directory — the Razorpay serverless functions that used to live there
were removed; payments are UPI-only now (see [Payments](#payments-upi--host-approval)).

**Key components** (all have a matching `.css` imported at the top):
`Navbar` (glass capsule + profile dropdown + notifications badge), `NotificationsModal`,
`ToastProvider`, `PaymentModal` (UPI QR + UTR submission — host-approved, not instant),
`ConfirmDialog` (in-app confirm, replaces `window.confirm`), `ProfilePeek` (view a party
member's profile), `QRScanner` (camera-based entry-QR decode for the door), `UPIQRCode`,
`QRTicket` (entry pass, gated on payment approval + 1-day-out window — see
[Gotchas](#gotchas--hard-won-lessons)), `VibeWall` (realtime comments + optional close
timer + delete), `SongRequestQueue`, `AnnouncementsPanel` (host broadcast), `AddressSearch`
(Nominatim autocomplete), `LocationPicker` (Leaflet draggable pin + live reverse-geocode +
confirm), `MapPreview` (OSM embed + Google-Maps directions), `WeatherWidget` (Open-Meteo),
`CalendarButton` (.ics + Google), `AchievementBadge` (SVG medals), `PhotoGrid`,
`Logo` (brand mark, `useId` for unique gradient ids), `AnimatedBackground`, `CursorGlow`,
`Reveal`, `GlassCard`, `GlowButton`, `AvatarStack`, `CountdownTimer`, `SvgDecor`,
`SpotifyEmbed`, `PollSelector`, `PlusOneSwiper`.

---

## Data model

All ids are **strings** (`nanoid` via `generateId()`), **except** `profiles.id` which is the
auth user's **uuid**. Owner references (`host_id`, `user_id`, `recipient_id`,
`uploaded_by_id`, `follower_id`) are **text** holding that uuid. RLS compares with
`auth.uid()::text = <col>` (and `auth.uid() = id` for profiles).

| Table | Notable columns | Notes |
|---|---|---|
| `profiles` | `id (uuid FK auth.users)`, email, name, username, birthdate, phone, profile_pic_b64, `achievements (jsonb)` | one per auth user; created by `handle_new_user` trigger |
| `events` | host_id, host_name, name, tagline, date, time_start/end, time_end_next_day, city, location_name/address/lat/lng, theme, `custom_gradient(jsonb {from,to})`, cover_charge, capacity, discoverable, vibe_tags(jsonb), has_personal_dj, dj_*, contains_alcohol, external_photo_link, spotify_playlist_url, upi_id, photo_dump_unlocked, `vibe_wall_enabled`, `vibe_wall_closes_at`, `vibe_wall_cooldown_seconds`, `co_hosts(jsonb)`, `started`, `started_at`, `archived`, `payment_deadline_hours` (default 12) | public read; host-only write. `theme:'custom'` uses `custom_gradient` for the ambient FX; `vibe_wall_cooldown_seconds` is the per-guest slow-mode between vibe-wall posts. `archived`/`discoverable:false` hides from Discover |
| `rsvps` | event_id, user_id, guest_name, status(`going`/`maybe`/`waitlist`), guest_count, poll_food(jsonb), poll_drinks(jsonb), `plus_one_requested`, `plus_one_name`, `plus_one_approved`, `settled`, `checked_in`, `cover_paid`, `payment_deadline_at`, `payment_reminder_sent` | **public read** → a guest writes their own row, **and the host/co-hosts write any row under their event** (check-in, settlement, +1, cover_paid). `cover_paid`/`checked_in` flip-to-true is host/co-host-only (trigger, `0014`). The `guest_phone` / `guest_birthdate` columns still exist but the app **no longer writes PII into them** (public table) — phone → `payments.phone`, birthdate → client-only age check |
| `expenses` | event_id, description, amount, paid_by, `split_type`(equal/custom), `split_shares(jsonb)`, `receipt_url` | host-only |
| `payments` | event_id, rsvp_id, amount, paid_by, `phone`, transaction_id, gateway, `status` (`pending`/`approved`/`declined`) | insert: anyone (self-reported UTR); **update (approve/decline): host/co-hosts only** |
| `photos` | event_id, uploaded_by, uploaded_by_id, storage_path, photo_url, caption, filter | Storage bucket `party-photos`; base64 fallback; auto-purged 3 days after party |
| `comments` | event_id, author_name, author_id, body | vibe wall (realtime) |
| `notifications` | recipient_id, type, title, body, event_id, link, read | per-recipient; generated on rsvp/payment/comment/photo/achievement/announcement/start/waitlist |
| `announcements` | event_id, body, author_name | host broadcast (realtime); notifies going guests |
| `song_requests` | event_id, title, requested_by, votes | queue, upvotable (realtime) |
| `follows` | follower_id, host_id | drives the activity feed |

RLS is enabled on every table and is the **only** server-side authorization layer (there is
no app server) — see [Security model](#security-model). Public read where invite links are
shareable (`events`, `rsvps`, `photos`, `comments`, `song_requests`); owner/host-scoped
writes. Because `rsvps` is public-read, **never put PII on it** (phone/birthdate live
elsewhere); because a guest owns their RSVP row, entry/money fields (`cover_paid`,
`checked_in`) are locked to host/co-hosts by a trigger (`0014`), not by the row policy.

---

## Supabase migrations
Run **in order** in the Supabase SQL editor (idempotent-ish; a couple of `alter publication`
lines error if re-run — drop them if so).

| File | Purpose |
|---|---|
| `0001_enable_rls_and_harden.sql` | enable RLS on all tables; drop legacy plaintext `password` column |
| `0002_supabase_auth.sql` | `profiles` keyed to `auth.users` (uuid) + `handle_new_user` trigger + prod RLS |
| `0003_realtime_storage_comments.sql` | realtime publication + `party-photos` bucket + `comments` table |
| `0004_cleanup_placeholders.sql` | delete seeded demo parties + the "Arjun Mehta" placeholder |
| `0005_notifications_achievements.sql` | `notifications` table + `profiles.achievements` |
| `0006_harden_rls.sql` | tighten permissive `WITH CHECK (true)` policies; lock down SECURITY DEFINER fns; drop username→email RPC (login went email-only) |
| `0007_vibe_wall_settings.sql` | `events.vibe_wall_enabled` + `vibe_wall_closes_at` |
| `0008_feature_expansion.sql` | check-in/plus-one/split/receipt columns + `announcements` / `song_requests` / `follows` tables + `co_hosts` |
| `0009_party_lifecycle.sql` | `events.started` / `started_at` / `archived` |
| `0010_full_table_schema.sql` | **backfills EVERY column** the app writes to events/rsvps/expenses/photos/payments — the fix for silent write failures |
| `0011_comment_deletion.sql` | comments DELETE policy — a post's author or the event's host may delete it (vibe-wall moderation) |
| `0012_payment_approval.sql` | `rsvps.cover_paid` (entry-QR gate) + **fixes rsvps/payments RLS** so the host/co-hosts can actually write to a guest's row (check-in, settlement, +1, approvals were silently rejected before this) |
| `0013_payment_deadlines_and_phone.sql` | `events.payment_deadline_hours`, `rsvps.payment_deadline_at` / `payment_reminder_sent`, `payments.phone` — the payment-deadline/reminder/waitlist-promotion system |
| `0014_secure_rsvp_manager_fields.sql` | **security fix** — a BEFORE INSERT/UPDATE trigger so only the host/co-hosts can set `rsvps.cover_paid` / `checked_in` (a guest owns their row and could otherwise forge `cover_paid:true` to skip payment); also constrains guest payment inserts to `status='pending'`. See [Security model](#security-model). |
| `0015_delete_account.sql` | **self-service account deletion** — a `SECURITY DEFINER` function `delete_my_account()` (granted to `authenticated` only) that acts on `auth.uid()` alone (no id arg to forge). It full-wipes the caller's data (their hosted events + all data on them, their own RSVPs + linked payments, their photos/comments/follows/notifications) then deletes the `auth.users` row (cascades to `profiles`). Needed because a client-only SPA has no secret key for `auth.admin.deleteUser()`. See [Auth model](#auth-model). |
| `0016_custom_theme_and_slowmode.sql` | `events.custom_gradient` (jsonb `{from,to}` for a host-picked 'custom' theme) + `events.vibe_wall_cooldown_seconds` (anti-spam slow mode). Full-object upsert ⇒ these columns must exist. |
| `0017_payment_sweep_cron.sql` | **server-side sweeps on a schedule** — ports `checkPaymentDeadlines` to a `SECURITY DEFINER` SQL function `run_payment_sweeps()` (expire unpaid RSVPs past deadline, promote the waitlist, send reminders) and schedules it every 15 min via **`pg_cron`**, so parties nobody opens still sweep. Doubles as a keep-alive (the job touches the DB, so a free-tier project won't pause). **Prerequisite:** enable the `pg_cron` extension (Dashboard → Database → Extensions). |

**Dashboard settings (not SQL):** Auth → Email → turn **off** "Confirm email" for a smooth
demo (the UI also handles the confirm flow); Auth → Password security → enable **leaked
password protection**.

---

## Auth model
- Sign up: `supabase.auth.signUp({ email, password, options:{ data:{ name, username, birthdate, phone }}})`.
  If email confirmation is on, `registerUser` returns `{ needsConfirmation:true }` and the UI
  shows "check your email".
- Login: **email-only** (`signInWithPassword`). Username→email lookup was removed for security.
- **Google OAuth** (`signInWithGoogle` → `supabase.auth.signInWithOAuth({ provider:'google' })`):
  redirects to Google and back to the current origin; supabase-js detects the session in the
  return URL and `initAuth`'s `onAuthStateChange` hydrates the profile automatically (no callback
  route needed). **No new app env var** — the Google client ID/secret live in the Supabase
  dashboard, never in the browser bundle. Setup: (1) Google Cloud Console → OAuth 2.0 Web client
  with redirect URI `https://<ref>.supabase.co/auth/v1/callback`; (2) Supabase → Auth → Providers →
  Google → paste client ID/secret + enable; (3) Supabase → Auth → URL Configuration → add each app
  origin (`http://localhost:5173`, the Vercel domain) to **Site URL / Redirect URLs**.
- **Profile-completion gap:** Google supplies `name` + `email` but **not `username` or `birthdate`**
  (birthdate powers the 21+ alcohol gate; username is unique). So a first-time Google user lands
  with an incomplete profile and `ProfileCompletionModal` (mounted app-wide in `App.jsx`, shown when
  `isProfileIncomplete(currentUser)`) blocks the app until they set username + DOB (phone optional),
  written via `completeProfile()` (awaited — surfaces a taken-username conflict). The Google avatar
  URL is deliberately **not** imported: profile pics are `data:image` only (`safeImageSrc`
  `allowRemote:false`), so a remote URL would be blocked and would defeat the IP-beacon protection.
- `getCurrentUser()` = synchronous cached profile. `initAuth(onChange)` hydrates + subscribes.
- `updateUserProfile` strips `password` defensively and never writes it to a client-readable table.
- **Account deletion** (`deleteMyAccount`, Profile page → **Danger Zone**): calls the
  `delete_my_account()` RPC (migration `0015`) — a `SECURITY DEFINER` function that runs on
  `auth.uid()` only, so a caller can delete no one but themselves. It full-wipes the user's
  data and the `auth.users` row (cascades to `profiles`), then the client signs out and clears
  all `lowkey_*` localStorage. This is the client-only-SPA answer to "no secret key for
  `auth.admin.deleteUser()`". Works identically for Google and email accounts. Irreversible.
- **Turnstile CAPTCHA** (optional): if `VITE_TURNSTILE_SITE_KEY` is set, the login/signup forms
  render a Cloudflare Turnstile widget (`TurnstileWidget`) and pass its token to Supabase as
  `options: { captchaToken }`. Enable it in **Supabase → Auth → Settings → Enable CAPTCHA
  protection → Turnstile** and paste the Turnstile **Secret Key** there (never in the browser).
  When the env var is unset (local-only mode), the widget renders nothing and no token is sent,
  so local dev stays friction-free. OAuth (Google) is unaffected — it isn't gated by CAPTCHA.

---

## Security model

**The threat model is unusual and you must internalize it.** This is a client-only SPA
(no app server): the browser talks straight to Supabase with the *public* publishable key.
So **Postgres Row-Level Security is the entire server-side authorization layer** — there is
no other place a check can live. Every table has RLS enabled; the policies are the security.
A gap in a policy is a live vulnerability, not a theoretical one, because the anon key is
embedded in the shipped bundle and anyone can call the REST API with it directly.

**What is enforced (trust boundaries that hold):**
- **Passwords / sessions** — delegated entirely to Supabase Auth (bcrypt in `auth.users`);
  the app never stores a password. Login is **email-only** (the username→email RPC was
  dropped in `0006` to remove an enumeration surface).
- **Host-only writes** — `events`, `expenses` are host-scoped (`auth.uid()::text = host_id`).
- **`rsvps.cover_paid` / `checked_in`** — a guest owns their RSVP row and 0012's policy lets
  them write it, but **migration `0014` adds a trigger so only the host/co-hosts can flip
  those two fields to `true`.** Without it a guest could `PATCH` their own row with
  `{cover_paid:true}` and walk past the door scanner without paying. This is the one
  money/entry-integrity control and it lives in the DB, not the client.
- **Payment approval** — `payments` is host-only read; approve/decline is a host/co-host
  UPDATE (`0012`); guests may only insert a `status='pending'` payment (`0014`).
- **XSS** — every user URL that reaches an `href` is wrapped in `helpers.safeUrl()`
  (http(s) only); every user image that reaches an `<img src>` is wrapped in
  `helpers.safeImageSrc()` (photos: http(s)+`data:image/`; profile pics: `data:image/`
  **only**, so a profile can't beacon a viewer's IP via a remote URL). No
  `dangerouslySetInnerHTML`, no `eval`/`innerHTML` sinks anywhere.
- **PII kept off the public table** — `rsvps` is world-readable (the "who's going" list is
  public), so guest **phone and birthdate are deliberately NOT stored on the RSVP**. The
  phone lives on `payments.phone` (host-only read); the birthdate is only checked
  client-side at RSVP time for the 21+ gate and never persisted.

**Known limitations (inherent to a client-trusted, localStorage-first app — documented, not
bugs):** a guest can still forge non-gated fields on their *own* RSVP (e.g. mark themselves
`settled`, or set `cover_paid` back to `false`); any signed-in user can create a
notification for any recipient (the guest→host notify pattern needs it) so notification
*content* is spoofable; `song_requests` vote updates are open by design. None of these move
money or grant entry. Deadline/reminder sweeps are **lazy** (run on page load), not a cron —
a party nobody opens won't sweep until someone does. Anonymous (no-account) guests can't
receive notifications, since there's no SMS/email channel.

**Operational hardening (do this in the Supabase dashboard):** turn ON leaked-password
protection (Auth → Password security); keep "Confirm email" ON in production; rotate the
publishable key if it ever leaks alongside anything sensitive (it's browser-safe by design,
but treat the project ref as public). Never add the `sb_secret_…` key with a `VITE_` prefix.

---

## Routes
| Path | Page | Access |
|---|---|---|
| `/` | Home (discover + auth + my-parties/RSVPs) | public |
| `/create` | CreatorStudio | renders logged-out, but needs login to save |
| `/invite/:eventId` | GuestInvite (public invite + RSVP) | public |
| `/party/:eventId` | PartyDashboard (host tools) | public link, host actions |
| `/profile` | ProfilePage | requires login (redirects otherwise) |

Unknown event ids render a friendly "not found" state.

---

## Features
**Guest:** aesthetic invite; RSVP with per-ticket food/drink counts; 21+ age gate for alcohol;
**plus-ones** (host-approved); **waitlist** + auto-promote (with a tightened 1-hour payment
window once promoted); **UPI payment + UTR submission** for the cover charge, with a **payment
deadline** (host-configurable, default 12h) after which an unpaid RSVP auto-expires and frees the
spot; a one-time **payment reminder** notification as the deadline approaches; **QR entry pass**
(gated on payment approval **and** being within 1 day of the party — locked before that, see
[Gotchas](#gotchas--hard-won-lessons)); **add to calendar** (Google + .ics); **weather** forecast;
**song request** queue and **vibe wall** (realtime, optional, with close timer + delete) — both
**unlocked only after you RSVP** (hosts/co-hosts always have access); **follow**
the host; live **map** + Google Maps directions. Phone-number inputs enforce a **10-digit** number.

**Host:** multi-step **create wizard** with **Leaflet pin picker**, **custom gradient theme**
(pick two colours that retint the party) and a vibe-wall **slow mode** (cooldown between guest posts); live **dashboard** (countdown,
tallies, guest list); **door check-in** — manual toggle or **camera QR scanner** (host/co-host
only); **payment Approvals tab** — Pending / Approved / Declined sub-tabs (interchangeable),
searchable by phone number, name, or UTR, one-tap approve/decline; **kitty** with UPI QR,
**custom splits** + **receipt** upload, and settlement tracking (separate from the cover charge);
**photo dump** (Supabase Storage); **broadcast announcements** (notifies going guests); **co-hosts**
(added by **email**; entries are `{ email, id, username, name }` — linked to a profile when the
email has an account, and granted the same door/approval powers as the host; legacy plain-string
names still render); **post-party recap**; **duplicate** a party; **party lifecycle** — **Start
Party** (notifies guests), **Delete** (before it's over), **Archive** (after it's over), **Delete
archived** (permanent, from the Manage section).
**Profile peeks:** everyone at a party can view each other's profile (`ProfilePeek` modal) — host
& co-hosts on the invite, guest avatars in Who's Going and the dashboard guest list (accounts only).

**Social/system:** Discover **search + Free/Paid filters + city tabs**; **activity feed** from
followed hosts; **achievements** (SVG badges) + **host insights**; **notifications** (dropdown +
modal) — including payment-approved/declined, payment-reminder, spot-released, and waitlist-promoted;
global **toast** system; **installable PWA** (offline shell); **Apple-style liquid-glass**
navbar & modals; cursor glow, animated bg, scroll reveals.

---

## The data layer (`storage.js`)
Everything persists here. Exported API (all localStorage-first + background Supabase):

- **Events:** `getEvents, getEvent, saveEvent, duplicateEvent, startEvent, archiveEvent, deleteEvent`
- **RSVPs:** `getRSVPs, addRSVP, updateRSVP, deleteRSVP, goingCountFor, promoteWaitlist,
  checkPaymentDeadlines(eventId)` (lazy client-side sweep — expires unpaid RSVPs past their
  deadline, promotes the waitlist, sends reminders; run on mount by GuestInvite + PartyDashboard
  since there's no background job in this architecture)
- **Money:** `getExpenses, addExpense, getPayments, addPayment` (always starts `status: 'pending'`),
  `updatePayment(paymentId, 'approved'|'declined')` (flips the linked RSVP's `cover_paid` + notifies)
- **Media:** `getPhotos, addPhoto, uploadPhotoFile` (Storage → public URL, base64 fallback)
- **Social:** `getComments, addComment, deleteComment, removeLocalComment (realtime
  DELETE reconciliation), getAnnouncements, addAnnouncement,
  getSongRequests, addSongRequest, voteSongRequest, getFollowing, isFollowing, toggleFollow, getActivityFeed,
  getProfile, findProfileByEmail` (synced-profile lookups for co-hosts + profile peeks)
- **Notifications:** `getNotifications, unreadNotificationCount, addNotification, markNotificationsRead`
- **Realtime:** `subscribeToEvent(eventId, {onRsvp,onPhoto,onComment,onPayment})`, `subscribeToNotifications(userId, handler)`
- **Auth:** `registerUser, loginUser, signInWithGoogle, getCurrentUser, logoutUser, initAuth,
  updateUserProfile, isProfileIncomplete, completeProfile, deleteMyAccount` (`completeProfile`
  backs the Google profile-completion step; `deleteMyAccount` is the Danger-Zone full wipe via
  the `delete_my_account` RPC — see [Auth model](#auth-model)). `registerUser`/`loginUser` take
  an optional trailing `captchaToken` (Turnstile).
- **Sync:** `syncWithSupabase` (pull all), `resyncToCloud` (re-push *your own* rows then pull;
  returns `{pushed, failed, firstError, needsAuth}` — used by the ☁️ Re-sync button)
- Internal: `reportSyncError(context, error)` broadcasts `lowkey_sync_error`; `notifyHost(...)`.

Window events used as a bus: `lowkey_db_sync` (data changed), `lowkey_notifications`
(notifications changed), `lowkey_sync_error` (a cloud write failed).

---

## Utilities
- `supabase.js` — client from `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY`
  (**no hard-coded creds**; warns + local-only mode if unset). Strips a trailing `/rest/v1/`.
- `geo.js` — `searchAddress`, `reverseGeocode`, `getCurrentPosition`, `getOSMEmbedUrl`,
  `getOSMMarkerUrl`, `getGoogleDirectionsUrl` (directions open Google Maps).
- `calendar.js` — `getEventTimes`, `googleCalendarUrl`, `downloadICS`.
- `qr.js` — `generateQR` (dark-on-white so it's scannable), `checkInToken`, `parseCheckInToken`.
- `upi.js` — `buildUPILink`, `generateUPIQR`, `initiateUPIPayment`, `calculateSplit`.
- `helpers.js` — dates, `formatINR`, `generateId`, avatars, `getEventEnd`/`isEventOver`,
  `getPhotoDumpTimeRemaining`, **`safeUrl`** (http/https only — XSS guard for user URLs in
  `href`), **`safeImageSrc(src, {allowRemote})`** (image guard for user `<img src>`;
  `allowRemote:false` restricts to `data:image/` for profile pics),
  `computePaymentDeadline(hours)`, `isWithinOneDayOfParty(event)`, `getEntryQrState(event, rsvp)`
  (the entry-QR lock/unlock decision), `isPartyManager(event, userId)` (host or co-host by id).

---

## Environment variables
Copy `.env.example` → `.env.local` (gitignored). **Only `VITE_*` vars reach the browser.**

| Var | Where | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | client | base project URL `https://<ref>.supabase.co` (NOT the `/rest/v1/` path) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | client | `sb_publishable_…` (browser-safe; replaces legacy anon) |
| `VITE_PUBLIC_APP_URL` | client | canonical URL for share links |
| `VITE_TURNSTILE_SITE_KEY` | client | **optional** — Cloudflare Turnstile **public** site key for the login/signup CAPTCHA. Unset = CAPTCHA disabled (widget renders nothing). The Turnstile **secret** key goes in the Supabase dashboard, never here. |

> The Supabase **secret key** (`sb_secret_…`) is NOT used by this SPA. Never add it with a
> `VITE_` prefix. Same for the **Turnstile secret key** and the **Google OAuth secret** — both
> live in the Supabase dashboard, not in any `VITE_*` var.

---

## Local development & Supabase setup
1. `npm install`, then `cp .env.example .env.local` and fill in Supabase URL + publishable key.
   **Restart `npm run dev` after editing `.env.local`** (Vite reads env at startup only).
2. Run migrations `0001 → 0017` in order in the Supabase SQL editor.
3. Turn off "Confirm email" (Auth → Email) for a friction-free demo.
4. Without Supabase env, the app runs in **local-only mode** (localStorage) — enough to click
   through every screen, but nothing syncs across devices/origins.

---

## Payments (UPI + host approval)
Razorpay has been **removed** (no `/api` directory, no card/netbanking path) — the app is
UPI-only. `PaymentModal.jsx` generates a UPI QR (`utils/upi.js`) for the host's own `upi_id` and
collects a **phone number** + **UTR** from the guest; submitting calls `onPaymentSubmitted` —
this is a **hand-off to a human, not a confirmed payment**. It creates a `payments` row via
`addPayment()` with `status: 'pending'`.

**Approval loop:** the host (or a co-host) reviews it in the dashboard's **Approvals tab**
(Pending / Approved / Declined, searchable by phone/name/UTR) and calls `updatePayment(id,
'approved'|'declined')`. Approving a cover-charge payment (one with an `rsvp_id`) sets
`rsvps.cover_paid = true`, which — together with the 1-day-out window — unlocks that guest's
entry QR (see [Gotchas](#gotchas--hard-won-lessons)); it also notifies the guest either way.
Kitty-split payments (`rsvp_id` is `null`, from the dashboard's Kitty tab) just flip their own
status — the host still settles those via the separate "Mark paid" toggle, since kitty splits and
cover charges are different debts.

**Payment deadlines & waitlist promotion:** a fresh RSVP that owes a cover charge gets
`payment_deadline_at` = now + `event.payment_deadline_hours` (host-configurable in Edit Party,
default 12h). `checkPaymentDeadlines(eventId)` — run on mount by both GuestInvite and
PartyDashboard, since this app has no background job — expires any 'going' RSVP whose deadline
passed without an approved payment, notifies the guest, and promotes the next waitlisted guest
with a **tightened 1-hour window** (a spot was just freed for them). A one-time reminder
notification fires when a deadline is within 2 hours.

**Server-side sweeps (migration `0017`):** the same deadline/reminder/waitlist logic also runs on a
**`pg_cron`** schedule (`run_payment_sweeps()`, every 15 min) so a party nobody opens still sweeps —
the client-side lazy sweep on page load remains as the fast path. Anonymous guests (no account) still
can't receive these notifications (no SMS/email channel).

**Unpaid RSVP status:** a paid-party RSVP is **recorded immediately** at RSVP time (holds the spot;
the payment deadline runs from then), so RSVP-then-exit works. It just never *reads* as paid — the
entry pass shows **"payment required"** until a UTR is actually submitted, then **"awaiting payment
approval"** — via `QRTicket`'s `paymentSubmitted` prop. (Reloading/abandoning the QR screen therefore
never looks like a confirmed payment.)

---

## Deployment (Vercel)
Vercel-ready (`vercel.json` = framework `vite` + SPA rewrites).
1. Import the GitHub repo (auto-detects Vite).
2. Add env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_PUBLIC_APP_URL`.
3. Deploy; pushes to `main` auto-deploy. CLI: `npm i -g vercel && vercel --prod`.

---

## Design system & conventions
- **Design tokens** in `src/index.css` `:root` — `--neon-*`, gradients, spacing, radius,
  shadows, easing, z-index, and `--fx-accent-*` (retinted per `data-party-theme`). Prefer tokens.
- Dark, glassmorphic, neon aurora. Fonts: Space Grotesk (display), Inter (body), Satisfy (cursive).
- **Per-component CSS:** every `Foo.jsx` imports `./Foo.css` at the top. Naming is BEM-ish.
- Party themes: `theme-neon | retro | minimal | psychedelic` (see `mockData.js`).
- **Liquid glass** recipe (navbar + modals): gradient tint + `backdrop-filter: blur() saturate(180%)`
  + inset top-highlight/bottom-shadow box-shadows + a `::before` sheen. See `Navbar.css` /
  `NotificationsModal.css` / `PaymentModal.css`.
- **Every animation must honor** `@media (prefers-reduced-motion: reduce)`. There's a global
  catch-all in `index.css` that neutralizes *all* animations/transitions under that query, so a
  new component is covered by default — but keep adding per-component blocks for anything with
  bespoke motion.
- **Device-friendliness rules (audited):**
  - The viewport meta is `width=device-width, initial-scale=1` **with no `maximum-scale` /
    `user-scalable=no`** — never re-add those, they block pinch-zoom (WCAG 1.4.4).
  - `body { overflow-x: hidden }` is the global horizontal-scroll safety net; **don't rely on
    it** — fluid layouts (flex/grid, `min(…vw, …px)`, relative units) are the real fix. No
    `100vw` anywhere (it causes horizontal scroll when a scrollbar is present).
  - Breakpoints are a consistent two-step: `min-width: 768px` (tablet) and `1024px` (desktop),
    with a few `max-width: 768px` component overrides. Don't introduce a third breakpoint.
  - Touch targets ≥ 24px (WCAG 2.5.8); the co-host remove ✕ was 18px and was bumped to 28px.
  - Every modal caps height and scrolls internally (`max-height: …dvh; overflow-y: auto`) so
    content can't push its buttons off a short/landscape screen — mirror `PaymentModal` /
    `dashboard-edit-modal`. ConfirmDialog / ProfilePeek / QRScanner were fixed to match.
- **Lint (must pass) enforces the sharp edges:**
  - `react-hooks/set-state-in-effect` (error): never call `setState` synchronously in an effect
    body. Defer with `setTimeout(fn, 0)` or compute in a `useState` initializer.
  - `react-hooks/purity` (error): no `Math.random()` / `Date.now()` **during render**. Use
    `helpers.generateId()`; move impure time reads into module-level helper functions or effects.
  - `no-unused-vars`, `no-empty` (use `catch { /* ignore */ }`).

---

## Gotchas & hard-won lessons
These are real bugs that were hit and fixed. Re-read before touching related code.

- **A lingering `transform` breaks `position: fixed` descendants.** The per-route entrance
  animation (`.route-view`) must NOT use `both`/`forwards` fill — a persisted `transform:
  translateY(0)` makes the element a *containing block*, so every `position: fixed` modal inside
  a route (PaymentModal, ProfilePeek, ConfirmDialog…) sizes/scrolls against the **page height,
  not the viewport**. Symptom: a tall modal centered off-screen with its buttons unreachable (the
  overlay was `scrollHeight === clientHeight` at ~2800px = full page). Keep route/entrance
  animations fill-less, or never wrap routes in a persisted transform.
- **Scrollable centered modal pattern.** For a modal that can exceed the viewport (PaymentModal):
  overlay = plain block `overflow-y: auto`; inside it a `min-height: 100%` flex-center wrapper
  that GROWS past the viewport when the modal is tall (so the overlay scrolls and nothing clips);
  the backdrop is `position: fixed`; outside-click closes via the wrapper. Do **not** use flex/grid
  `align-items/place-items: center` on the scroll container — it clips an oversized child's ends.
- **Event expiry gates RSVP.** `isEventOver(event)` (helpers) must be checked in the invite's RSVP
  disabled condition + `handleRSVP` guard — a past-dated party should show the "party ended" banner
  and block RSVPs. It's not automatic; a new RSVP surface must add the check.
- **Notifications from repeatable sweeps need deterministic ids.** Payment expiry/reminder/waitlist
  run in ≥3 places (invite, dashboard, pg_cron); each `addNotification` with a *random* id yields a
  duplicate per source. Pass a stable `id` (`ntf_expired_<rsvpId>`, `ntf_remind_…`, `ntf_promoted_…`)
  so `addNotification`'s local dedup + the DB's `on conflict (id) do nothing` collapse them to one.
- **Unpaid RSVP is recorded immediately but must never *read* as paid.** A paid-party RSVP is saved
  at RSVP time (holds the spot; deadline runs), and the entry pass shows "payment required" (not
  "awaiting approval") until a UTR is actually submitted — via `QRTicket`'s `paymentSubmitted`.
  (An earlier attempt to *defer* creating the RSVP until payment broke plain RSVP-then-exit; don't.)

- **Full-object upserts require the full schema.** Missing a column ⇒ the whole write fails
  ⇒ the row never reaches Supabase (silent before; now toasts). If "nothing syncs," suspect a
  schema mismatch first → run `0010`, then re-save on the origin that has the data (or use
  ☁️ **Re-sync** on the Profile page). `select * from events` being empty is the tell.
- **`localStorage` is per-origin.** Data made on Vercel is invisible on localhost until it's in
  Supabase AND pulled down. Re-syncing on localhost can't push a party that only exists in
  Vercel's browser.
- **Unique realtime channel topics.** Two subscriptions to the same topic crash the page. Always
  include the module counter suffix (already done in `subscribeToEvent`/`subscribeToNotifications`).
- **Temporal dead zone.** A derived `const` referencing a `useState` value declared *below* it
  crashes the page (`Cannot access 'X' before initialization`). Declare hooks first, derived
  values after. (Bit us with `isWaitlisted` using `guestCount`.)
- **`setState` in effect body** is a lint error and causes cascading renders — always defer.
- **`Math.random`/`Date.now` in render** is a lint error — use helpers.
- **Stored XSS via user URLs:** `dj_profile_url`, `spotify_playlist_url`, etc. render into
  `href`/`src`. React does NOT block `javascript:` — always wrap with `helpers.safeUrl(...)`.
- **QR contrast:** `generateUPIQR`/`generateQR` must use dark modules on white
  (`dark:'#0B0B14'`); a near-white `dark` made QRs invisible.
- **Overflow clipping:** the notification badge was cropped because it sat inside the profile
  button (`overflow:hidden` for the circular avatar). Keep such badges as siblings.
- **Navbar transform reset on mobile:** the mobile media query must set `transform:none`
  (the desktop centering `translateX(-50%)` otherwise shoves it half off-screen).
- **Sticky elements vs the floating navbar:** anything `position:sticky` must stick *below*
  the fixed navbar (`top: 84px` desktop / `72px` mobile ≤768px) with a z-index *under*
  `--z-sticky`, or it paints over the capsule when scrolling (bit us with the dashboard tab bar).
- **Leaflet:** used vanilla (not react-leaflet). The map pin is a CSS overlay at the map center
  (avoids the default-marker-icon bundler pitfall); `map.invalidateSize()` runs on a timeout
  because the map lives in an animated/flex container.
- **Weather** only renders within Open-Meteo's ~16-day window; otherwise it shows nothing (by design).
- **No secrets in the client:** only `VITE_*` is bundled.
- **`getCurrentUser()` must stay synchronous** (4 pages use it in `useState` initializers).
- **RLS write policies must cover the actual writer, not just the owner.** `rsvps_owner_write`
  only ever let a guest write their *own* row — every host-side mutation of a *guest's* row
  (check-in, settled, +1 decisions) was silently rejected by Supabase and only ever "worked"
  locally. Fixed in `0012` to also allow the host/co-hosts. If a host-side toggle "works" in the
  browser but never shows up after a re-sync, suspect an RLS gap before anything else.
- **…but a row-owner policy is too broad for money/entry fields.** Once `0012` let the guest
  write their own RSVP, they could also write `cover_paid`/`checked_in` on it — i.e. forge
  "I paid" and skip the door. RLS is row-level, not column-level, so the fix is a **trigger**
  (`0014`) that blocks a non-manager flipping those two fields to `true`. Lesson: when one policy
  guards fields with different trust levels, reach for a trigger, not a broader policy.
- **`rsvps` is world-readable → it must never hold PII.** It has `public read using (true)` (the
  "who's going" list is public), so any column on it is dumpable by anyone with the (public) anon
  key. Guest **phone and birthdate are deliberately not written to the RSVP** — phone goes on the
  host-only `payments.phone`, birthdate is only used client-side for the 21+ gate. Don't add PII
  columns to `rsvps` writes.
- **User images need `safeImageSrc`, user links need `safeUrl`.** All `href` sinks are
  `safeUrl`-wrapped; all `<img src>` on user data (`photo_url`, `profile_pic_b64`) are
  `safeImageSrc`-wrapped. Profile pics use `{allowRemote:false}` (data:image only) so a crafted
  profile can't beacon a viewer's IP via a remote URL. Wrap any new such sink.
- **Editing an RSVP must merge, not replace.** GuestInvite's edit flow used to build a "full"
  rsvp object and swap it in wholesale — which silently wiped `checked_in`/`settled`/`cover_paid`/
  `plus_one_approved` on every edit, since the form doesn't know about those fields. Always
  `updateRSVP(id, partialUpdate)` (it merges internally) rather than replacing the row.
- **Temporal dead zone in `useEffect`, not just derived `const`s.** A `useEffect` that closes
  over a `setState` from a hook declared *below* it crashes the same way ("Cannot access before
  initialization") — hooks run top-to-bottom at render time regardless of when the *effect body*
  executes. Keep the effect *after* every state it references, not just before its first render.
- **`qr-scanner` + Vite:** needs the worker path set explicitly —
  `import QrScannerWorkerPath from 'qr-scanner/qr-scanner-worker.min.js?url'; QrScanner.WORKER_PATH = QrScannerWorkerPath;`
  — before constructing a scanner, or camera decode silently fails to start.
- **Cover charge ≠ kitty split.** They're different debts on the same event: `cover_charge` is
  paid at RSVP time and gates the entry QR (`rsvps.cover_paid`); the Kitty tab's expense split is
  settled post-party via the separate `rsvps.settled` toggle. Don't conflate the two fields.
- **Testing against the real Supabase project is a live-data risk.** `dist/` (and anything driven
  with Playwright against it) reads whatever's in `.env.local` — if that points at a real project,
  seeded test data can attempt real writes. Build a throwaway local-only bundle for browser-driven
  verification: `VITE_SUPABASE_URL="" VITE_SUPABASE_PUBLISHABLE_KEY="" npx vite build --outDir dist-test`,
  serve *that* (`vite preview --outDir dist-test --port 4174`), and delete it afterward.

---

## How to verify changes
No test runner. The workflow that's been used and works well:
1. `npm run lint && npm run build` — both must be clean.
2. **Drive the built app with Chromium** (Playwright) for real verification — this repeatedly
   caught bugs static review missed (the realtime crash, the mobile nav offset, the TDZ crash).
   Build a **local-only bundle** first if `.env.local` points at a real Supabase project (see the
   gotcha above) so test writes never reach production. Pattern: `npm run preview` (or serve the
   local-only `dist-test`), launch `chromium`, `addInitScript` to seed
   `localStorage['lowkey_events'|'lowkey_rsvps'|…]`, visit each route at mobile (390px) and
   tablet (820px), listen for `pageerror`, and check `document.documentElement.scrollWidth`
   for horizontal overflow. Playwright is installed **`--no-save`** (not in `package.json`);
   `leaflet` and `qr-scanner` ARE real dependencies.
3. For visual-only pieces you can render component markup standalone over a test background —
   but **include the global `button{background:none}` reset**, or `<button>` rows render with
   the browser's default light background (a test-harness artifact, not a real bug).

---

## Notes for AI agents
- **Start at `src/utils/storage.js`.** New persisted entities follow the pattern: write
  localStorage first → mirror to Supabase in `.then` with `reportSyncError` on failure → add a
  pull step in `syncWithSupabase()` → add columns/RLS in a new `00NN_*.sql` migration.
- **Migrations are ordered & cumulative.** Add new ones as `00NN_…sql`; don't edit already-run
  files (except one that hasn't been applied yet). If you add a column the app writes, you MUST
  migrate it or writes fail.
- Owner columns are **text** holding an auth uuid; `profiles.id` is a real `uuid`. RLS uses
  `auth.uid()::text = <col>` (and `auth.uid() = id` for profiles).
- Use `generateId()` for ids; never `Math.random()`/`Date.now()` in render.
- Wrap user-supplied URLs in `safeUrl()`.
- Give every Realtime subscription a unique topic; honor reduced-motion for animations.
- **Verify with `lint` + `build` + driving the app** before finishing.

---

Made with 💜 for the culture.
