import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bzhjglqmpskgdnunrnfu.supabase.co';
// Using the legacy anon public key as the anon key for client operations
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6aGpnbHFtcHNrZ2RudW5ybmZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0NDM0OTcsImV4cCI6MjA5NzAxOTQ5N30.qmy4EIZO7-TlGTTiLRepPKLZc0N_uMQtVzrd9mkzUlo';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
