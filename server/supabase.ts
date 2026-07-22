import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.warn('[supabase] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set. Supabase auth will be skipped.');
}

// Admin client — uses service role key, bypasses RLS.
// autoRefreshToken / persistSession disabled since this runs server-side.
// ws is passed explicitly as the transport because Node.js 20 lacks native WebSocket.
export const supabaseAdmin = supabaseUrl && supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      realtime: { transport: ws }
    })
  : null;
