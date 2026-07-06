# LowKey — House Parties, Simplified

LowKey is a mobile-first web app for planning and running house parties: create an
aesthetic invite, share it, collect RSVPs with food/drink preferences, split the
bill (UPI + Razorpay), drop a shared photo dump, and keep the hype on a live vibe
wall. Built for the Indian Gen‑Z party scene.

> **Status:** functional MVP. Data is localStorage-first with optional Supabase
> cloud sync + realtime. Payments run in simulation until Razorpay keys are set.

---

## Table of contents
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Project structure](#project-structure)
- [Data model](#data-model)
- [Routes](#routes)
- [Environment variables](#environment-variables)
- [Local development](#local-development)
- [Supabase setup](#supabase-setup)
- [Payments (Razorpay)](#payments-razorpay)
- [Deployment (Vercel)](#deployment-vercel)
- [Design system & conventions](#design-system--conventions)
- [Notes for AI agents](#notes-for-ai-agents)

---

## Tech stack
- **React 19** + **Vite 8** (JSX, no TypeScript)
- **React Router 7** (SPA routing, route-level code splitting via `React.lazy`)
- **Supabase** (`@supabase/supabase-js`) — Postgres, Auth, Storage, Realtime
- **Nominatim / OpenStreetMap** — address search, reverse geocoding, maps (keyless)
- **Razorpay** — card/UPI payments via serverless functions (`/api`)
- `qrcode` (UPI QR), `nanoid` (ids)
- **Vercel** — hosting + serverless functions
- ESLint 9 flat config (`eslint.config.js`)

No CSS framework — a hand-rolled design system lives in `src/index.css` (design
tokens) with per-component CSS files.

---

## Architecture

**localStorage-first with cloud sync.** Every read/write goes through
`src/utils/storage.js`, which persists to `localStorage` synchronously (so the UI
is instant and works offline) and then **mirrors the write to Supabase in the
background**. On load, `syncWithSupabase()` pulls cloud rows and merges them into
the local cache (`mergeById`). This means:

- The app is fully usable without any Supabase config (local-only mode).
- Supabase failures degrade gracefully (logged as warnings, never thrown).
- `getCurrentUser()` and other reads are **synchronous** (they read the cache),
  which is why React state initializers can call them directly.

**Auth.** Real **Supabase Auth** (`signUp` / `signInWithPassword`). A DB trigger
(`handle_new_user`) creates a `profiles` row from signup metadata. The signed-in
profile is cached in `localStorage` under `lowkey_session` so `getCurrentUser()`
stays synchronous; `initAuth()` (called in `App.jsx`) hydrates it from the real
session on load and subscribes to auth changes. Login is **email-only**.

**Realtime.** `subscribeToEvent()` and `subscribeToNotifications()` use Supabase
Realtime channels to live-update RSVPs, the photo feed, the vibe wall, and
notifications.

**Ambient FX.** A global animated background (`AnimatedBackground`), a
cursor-following glow (`CursorGlow`), and scroll-reveal animations (`Reveal`,
IntersectionObserver). All respect `prefers-reduced-motion`. FX accent colors
retint per party theme via a `data-party-theme` attribute on `<html>`.

---

## Project structure

```
.
├── api/razorpay/            # Vercel serverless functions (Node)
│   ├── create-order.js      #   creates a Razorpay order (server-side keys)
│   └── verify.js            #   verifies the payment signature (HMAC)
├── public/
│   ├── favicon.svg          # brand mark (aurora squircle + crescent + sparkles)
│   ├── manifest.webmanifest # PWA manifest
│   └── sw.js                # service worker (app-shell cache, installable/offline)
├── supabase/migrations/     # ordered SQL migrations — run 0001 → 0006
├── src/
│   ├── main.jsx             # entry: mounts App, ToastProvider, SW registration
│   ├── App.jsx              # routes, auth hydration, global FX mount
│   ├── index.css            # design tokens + base styles + animations
│   ├── pages/
│   │   ├── Home.jsx         # discover feed, auth (login/signup), my-parties tabs
│   │   ├── CreatorStudio.jsx# multi-step party creation wizard
│   │   ├── GuestInvite.jsx  # /invite/:id — the public invite + RSVP + vibe wall
│   │   ├── PartyDashboard.jsx# /party/:id — host dashboard (guests/kitty/photos)
│   │   └── ProfilePage.jsx  # /profile — insights, achievements, hosted parties
│   ├── components/          # ~25 presentational + feature components (+ .css each)
│   │   ├── Logo.jsx         # reusable brand mark (unique gradient ids via useId)
│   │   ├── Navbar.jsx       # global nav + profile dropdown + notifications
│   │   ├── NotificationsModal.jsx / ToastProvider.jsx
│   │   ├── AddressSearch.jsx / MapPreview.jsx   # OpenStreetMap
│   │   ├── PaymentModal.jsx / UPIQRCode.jsx     # payments
│   │   ├── VibeWall.jsx / PhotoGrid.jsx         # social
│   │   ├── AchievementBadge.jsx                 # SVG medal badges
│   │   ├── AnimatedBackground.jsx / CursorGlow.jsx / Reveal.jsx  # FX
│   │   └── GlassCard / GlowButton / AvatarStack / CountdownTimer / …
│   ├── context/toast-context.js   # ToastContext (paired with hooks/useToast.js)
│   ├── hooks/useToast.js
│   ├── data/
│   │   ├── mockData.js      # cities + poster themes + clearLegacyPlaceholders()
│   │   └── achievements.js  # achievement defs + computeStats() + earnedKeys()
│   └── utils/
│       ├── storage.js       # ★ the data layer: CRUD + auth + realtime + notifs
│       ├── supabase.js      # Supabase client (env-configured, no hard-coded keys)
│       ├── geo.js           # Nominatim search/reverse + OSM map/directions URLs
│       ├── helpers.js       # dates, currency, ids, avatars, share
│       └── upi.js           # UPI deep links + QR generation + split math
├── eslint.config.js         # flat config; src = browser globals, api = node
├── vercel.json              # framework + SPA rewrites
└── vite.config.js
```

`src/utils/storage.js` is the heart of the app — start there to understand data flow.

---

## Data model

All ids are strings. `profiles.id` is the auth user's **uuid**; other tables store
owner references (`host_id`, `user_id`, `recipient_id`, `uploaded_by_id`) as
**text** holding that uuid.

| Table | Key columns | Notes |
|---|---|---|
| `profiles` | `id (uuid, FK auth.users)`, `email`, `name`, `username`, `birthdate`, `phone`, `profile_pic_b64`, `achievements (jsonb)` | one per auth user; created by `handle_new_user` trigger |
| `events` | `id`, `host_id`, `name`, `date`, `time_start/end`, `location_name/address/lat/lng`, `theme`, `cover_charge`, `capacity`, `vibe_tags`, `spotify_playlist_url`, `upi_id`, `contains_alcohol`, `discoverable` | public read; host-only write |
| `rsvps` | `id`, `event_id`, `user_id`, `guest_name`, `status`, `guest_count`, `poll_food`, `poll_drinks`, `guest_birthdate`, `settled` | `poll_food/drinks` are `{veg,nonveg,vegan}` / `{byob,mocktails}` count maps |
| `expenses` | `id`, `event_id`, `description`, `amount`, `paid_by` | host-only |
| `payments` | `id`, `event_id`, `amount`, `paid_by`, `transaction_id`, `gateway`, `status` | references only — never store card data |
| `photos` | `id`, `event_id`, `uploaded_by`, `uploaded_by_id`, `photo_url`, `storage_path`, `caption` | file in Storage bucket `party-photos`; base64 fallback |
| `comments` | `id`, `event_id`, `author_name`, `author_id`, `body` | vibe wall |
| `notifications` | `id`, `recipient_id`, `type`, `title`, `body`, `event_id`, `link`, `read` | per-recipient; generated on RSVP/payment/comment/photo/achievement |

RLS is enabled on every table (see migrations). Public read where invite links are
shareable (`events`, `rsvps`, `photos`, `comments`); owner/host-scoped writes.

---

## Routes
| Path | Page | Access |
|---|---|---|
| `/` | Home (discover + auth + my-parties/RSVPs tabs) | public |
| `/create` | CreatorStudio (party wizard) | requires login |
| `/invite/:eventId` | GuestInvite (public invite + RSVP) | public |
| `/party/:eventId` | PartyDashboard (host tools) | public link, host features |
| `/profile` | ProfilePage (insights + achievements) | requires login |

Unknown event ids render a friendly "not found" state (no more mock fallbacks).

---

## Environment variables

Copy `.env.example` → `.env.local` and fill in. `.env.local` is gitignored.

| Var | Where | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | client | base project URL `https://<ref>.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | client | new-style publishable key (`sb_publishable_…`), browser-safe |
| `VITE_PUBLIC_APP_URL` | client | canonical app URL for share links |
| `RAZORPAY_KEY_ID` | **server** (Vercel) | Razorpay public key id — used by `/api` |
| `RAZORPAY_KEY_SECRET` | **server** (Vercel) | Razorpay secret — **never** prefix with `VITE_` |

> The Supabase **secret key** (`sb_secret_…`) is not used by this SPA and must
> never be added with a `VITE_` prefix. Anything `VITE_*` is bundled into the client.

---

## Local development

```bash
npm install
cp .env.example .env.local   # then fill in Supabase values
npm run dev                  # Vite dev server (http://localhost:5173)
npm run lint                 # ESLint
npm run build                # production build → dist/
npm run preview              # preview the production build
```

Without Supabase env vars the app runs in **local-only mode** (localStorage), which
is enough to click through every screen.

---

## Supabase setup

1. Create a Supabase project; copy the URL + **publishable** key into `.env.local`.
2. In the SQL Editor, run the migrations **in order**:
   `0001 → 0002 → 0003 → 0004 → 0005 → 0006`.
   - `0001` enable RLS + drop legacy password column
   - `0002` Supabase Auth: `profiles` keyed to `auth.users`, trigger, prod RLS
   - `0003` realtime + `party-photos` storage bucket + comments
   - `0004` delete placeholder/demo data
   - `0005` notifications table + `profiles.achievements`
   - `0006` harden RLS policies + lock down SECURITY DEFINER functions
3. **Auth → Email:** turn **off** "Confirm email" for a friction-free demo (the UI
   also handles the confirm flow if you leave it on).
4. **Auth → Password security:** enable **Leaked password protection** (HaveIBeenPwned).

Migrations are cumulative; if you re-run `0003`'s `alter publication … add table`,
drop those three lines (they error if the table is already published).

---

## Payments (Razorpay)

Client (`PaymentModal.jsx`) → `POST /api/razorpay/create-order` → opens Razorpay
Checkout → `POST /api/razorpay/verify` (server-side HMAC-SHA256 signature check).
If the backend isn't configured (no keys / local dev), checkout **falls back to a
local simulation** so the flow is always demoable. UPI works fully client-side via
QR + manual UTR entry (zero MDR).

---

## Deployment (Vercel)

The repo is Vercel-ready (`vercel.json` sets framework + SPA rewrites; `/api`
functions are auto-detected).

1. Import the GitHub repo at vercel.com/new (framework auto-detects as **Vite**).
2. Add env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`,
   `VITE_PUBLIC_APP_URL`, and (for live payments) `RAZORPAY_KEY_ID` /
   `RAZORPAY_KEY_SECRET`.
3. Deploy. Pushes to `main` auto-deploy.

CLI alternative: `npm i -g vercel && vercel --prod`.

---

## Design system & conventions
- **Tokens** in `src/index.css` `:root` — colors (`--neon-*`), gradients, spacing,
  radius, shadows, easing, z-index. Prefer tokens over hard-coded values.
- **Theme:** dark, glassmorphic, neon aurora. Fonts: Space Grotesk (display),
  Inter (body), Satisfy (cursive wordmark).
- **Per-component CSS:** each `Foo.jsx` has a `Foo.css` imported at the top.
- **Naming:** BEM-ish (`.block__element--modifier`).
- **Party themes:** `theme-neon | retro | minimal | psychedelic` (see `mockData.js`).
- **Motion:** every animation must honor `@media (prefers-reduced-motion: reduce)`.
- **Brand mark:** `components/Logo.jsx` (favicon parity); use it, don't inline SVG.
- **Lint:** `src/**` uses browser globals; `api/**` uses Node globals. Notable
  rules on: `react-hooks/set-state-in-effect`, `react-hooks/purity` (no
  `Math.random`/`Date.now` during render — use `helpers.generateId`, etc.).

---

## Notes for AI agents
- **The data layer is `src/utils/storage.js`.** Any new persisted entity should
  follow the pattern: write to `localStorage` first, mirror to Supabase in the
  background (`.then` with a `console.warn` on error), add a sync step in
  `syncWithSupabase()`, and (if it needs RLS) a migration in `supabase/migrations/`.
- **`getCurrentUser()` is synchronous** (reads the cached session). Don't make it
  async — four pages use it in `useState` initializers.
- **No secrets in the client.** Only `VITE_*` vars reach the browser. Server
  secrets live in `/api` + Vercel env.
- **Migrations are ordered and cumulative.** Add new ones as `000N_*.sql`; don't
  edit already-applied files unless fixing a not-yet-run one.
- **Ids:** use `helpers.generateId()` (nanoid). Never `Math.random()`/`Date.now()`
  during render (ESLint `react-hooks/purity` will fail the build).
- **Verify** with `npm run lint && npm run build` before finishing.
- Owner columns (`host_id`, `user_id`, `recipient_id`, `uploaded_by_id`) are
  **text** holding an auth uuid; `profiles.id` is a real `uuid`. RLS compares with
  `auth.uid()::text = <col>` (and `auth.uid() = id` for profiles).

---

Made with 💜 for the culture.
