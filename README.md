# LowKey

LowKey is a responsive React web app for discovering and hosting invite-first house parties in India. It focuses on city-based party discovery, quick party creation, WhatsApp-friendly invites, guest RSVP polls, user authentication, and 21+ age verification gates for parties serving alcohol.

The UI is optimized for both desktop and mobile viewports, featuring a floating, translucent oval navigation bar (iOS design language), and clean typographic styling without AI-looking placeholders.

## Current Status

- **Frontend**: React 19 + Vite + React Router.
- **Responsiveness**: Adapts dynamically from a compact mobile view to a wide multi-column desktop layout.
- **Data**: Browser `localStorage` acts as a local database for events, user session state, RSVPs, expenses, and photos.
- **Auth**: Built-in local registration, login, logout, and age verification (calculated via DOB).
- **Payments**: UPI QR/deep-link generation for splitting party expense kitties.
- **Deployability**: Static SPA-ready build with Vercel rewrites and Netlify redirects.

## Features

- **Responsive Floating Nav**: Translucent navigation tabs (Discover, Create, My Hosted, My RSVPs) with login/logout positioned on the top right.
- **City Discovery**: Filterable discovery grid for Bengaluru, Mumbai, Delhi NCR, Pune, Hyderabad, and Goa.
- **Aesthetic Brand Cursive**: Cursive Satisfy typography applied to all "lowkey" brand mentions.
- **Hosted/RSVP Dashboards**: Tabbed screens listing events hosted by the logged-in user or events they RSVP'd to, with automatic "Expired/Over" badges for past dates.
- **Vibe Checks & Polls**: Guest preference check-ins (Veg/Non-Veg, Drinks choice, staying status).
- **Age Verification (21+)**: Parties marked as containing alcohol enforce verification of date of birth (DOB) upon signup or RSVP submission.
- **DJs & Playlists**: Dedicated host profiles for live DJ acts (SoundCloud/Instagram links) and embedded Spotify playlists.

## Run Locally

```bash
npm install
npm run dev
```

Vite is preconfigured with the `--host` flag. This will run the server locally and expose it to your home Wi-Fi network. 

To test on your mobile device:
1. Make sure your computer and phone are connected to the same Wi-Fi network.
2. Note the **Network URL** (e.g. `http://192.168.1.XX:5173`) printed in your terminal after starting the dev server.
3. Type that URL into your phone's browser to preview.

Useful scripts:

```bash
npm run lint      # Runs ESLint code quality checks
npm run build     # Compiles production bundle in dist/
npm run preview   # Previews the production build locally
```

## File Map

- `src/main.jsx`: React entrypoint, browser router initialization, and mock database seeding.
- `src/App.jsx`: Route definitions mapping paths to Home, Creator Studio, Invites, and Dashboard.
- `src/index.css`: Design tokens (gradients, font families, color scales, animation settings) and responsive base layout utilities.
- `src/App.css`: App background shell.
- `src/data/mockData.js`: Seeding configurations containing mock events, initial RSVPs, expenses, photos, and a seeded host account (`arjun` / `password`).
- `src/utils/storage.js`: Local database CRUD helpers for events, RSVPs, photos, expenses, and user registration/login/session tracking.
- `src/utils/helpers.js`: Formatting dates, 12-hour times, Indian Rupee (INR) currency, sharing APIs, and WhatsApp redirection payloads.
- `src/pages/Home.jsx`: Landing screen rendering responsive floating nav tabs (Discover, Login/Register forms, My Hosted list, and My RSVPs list).
- `src/pages/Home.css`: Styles for the translucent oval navbar, clean features grids, responsive column counts, and login/registration forms.
- `src/pages/CreatorStudio.jsx`: Multi-step party creation wizard, now including a toggle for `contains_alcohol` and currentUser session injection.
- `src/pages/CreatorStudio.css`: Wizard page styling and transition animations.
- `src/pages/GuestInvite.jsx`: Invite/RSVP details page containing the 21+ age gate forms, food/drinks check-ins, and Spotify embeds.
- `src/pages/GuestInvite.css`: Style overrides for the RSVP forms, DOB picker field, and under-age warning block.
- `src/pages/PartyDashboard.jsx`: Host live dashboard with attendee approvals, expense splits, UPI settlements, and the Shared Camera Dump.
- `src/pages/PartyDashboard.css`: Dashboard tabs and live grid view styling.
- `src/components/`: Reusable modular elements (e.g. `GlassCard`, `GlowButton`, `AvatarStack`, `CountdownTimer`, `SpotifyEmbed`).
- `public/_redirects` & `vercel.json`: Redirect rewrites to support full client-side SPA routing on refresh.

## Data Shape Notes

- **Users**: `id`, `username`, `email`, `password`, `name`, `birthdate`, `phone`, `created_at`.
- **Events**: `id`, `host_id`, `host_name`, `name`, `tagline`, `date`, `time_start`, `time_end`, `status`, `city`, `location_name`, `location_address`, `theme`, `spotify_playlist_url`, `cover_charge`, `capacity`, `discoverable`, `vibe_tags`, `contains_alcohol`, `has_personal_dj`, `dj_name`, `dj_genre`, `dj_profile_url`, `dj_instagram`, `upi_id`, `photo_dump_unlocked`.
- **RSVPs**: `id`, `event_id`, `user_id`, `guest_name`, `status`, `poll_food`, `poll_drinks`, `poll_staying`, `plus_one_requested`, `plus_one_name`, `plus_one_approved`, `guest_birthdate`, `created_at`.
