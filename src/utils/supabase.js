import { createClient } from '@supabase/supabase-js';

// Configure via env (set these in .env.local and your Vercel project settings):
//   VITE_SUPABASE_URL             — base project URL, e.g. https://<ref>.supabase.co
//   VITE_SUPABASE_PUBLISHABLE_KEY — new-style publishable key (sb_publishable_...),
//                                    browser-safe. Replaces the legacy anon key.
// The SECRET key (sb_secret_...) is server-only and is intentionally NOT read here.
//
// No credentials are hard-coded (this repo is open-source) — a missing config
// degrades gracefully to the app's localStorage-only mode.
const rawUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

// createClient expects the base project URL — strip a trailing REST path if present.
const supabaseUrl = rawUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');

if (!supabaseUrl || !supabasePublishableKey) {
  console.warn(
    '[LowKey] Supabase env not set (VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY). ' +
      'Running in local-only mode — data persists to localStorage but will not sync to the cloud.'
  );
}

// A harmless placeholder client when unconfigured keeps calls from throwing;
// the storage layer already treats network failures as an offline cache fallback.
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabasePublishableKey || 'public-anon-placeholder'
);
