import { createClient } from '@supabase/supabase-js';

// Prefer environment configuration (set VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
// in .env.local or your Vercel project settings). The fallbacks keep the demo
// working out-of-the-box. The anon key is a public client key by design.
const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  'https://bzhjglqmpskgdnunrnfu.supabase.co';

const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6aGpnbHFtcHNrZ2RudW5ybmZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0NDM0OTcsImV4cCI6MjA5NzAxOTQ5N30.qmy4EIZO7-TlGTTiLRepPKLZc0N_uMQtVzrd9mkzUlo';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
