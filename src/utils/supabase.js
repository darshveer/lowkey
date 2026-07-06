import { createClient } from '@supabase/supabase-js';

// Configure via env (set these in .env.local and your Vercel project settings):
//   VITE_SUPABASE_URL             — base project URL, e.g. https://<ref>.supabase.co
//   VITE_SUPABASE_PUBLISHABLE_KEY — new-style publishable key (sb_publishable_...),
//                                    browser-safe. Replaces the legacy anon key.
// The SECRET key (sb_secret_...) is server-only and is intentionally NOT read here.
// The fallbacks keep the demo working out-of-the-box.
const rawUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  'https://bzhjglqmpskgdnunrnfu.supabase.co';

// createClient expects the base project URL — strip a trailing REST path if present.
const supabaseUrl = rawUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');

const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  // Legacy anon fallback so the demo keeps working until a publishable key is set.
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6aGpnbHFtcHNrZ2RudW5ybmZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0NDM0OTcsImV4cCI6MjA5NzAxOTQ5N30.qmy4EIZO7-TlGTTiLRepPKLZc0N_uMQtVzrd9mkzUlo';

export const supabase = createClient(supabaseUrl, supabasePublishableKey);
