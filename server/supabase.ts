import { createClient } from '@supabase/supabase-js';
import type { WebSocketLikeConstructor } from '@supabase/realtime-js';
import ws from 'ws';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.warn('[supabase] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set. Supabase auth will be skipped.');
}
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[supabase] SUPABASE_URL or SUPABASE_ANON_KEY is not set. Native recovery emails will be skipped.');
}

// Admin client — uses service role key, bypasses RLS.
// autoRefreshToken / persistSession disabled since this runs server-side.
// ws is passed explicitly as the transport because Node.js 20 lacks native WebSocket.
// The ws and Supabase packages use equivalent runtime APIs but incompatible event
// callback types, so keep the compatibility cast isolated at this integration boundary.
const realtimeTransport = ws as unknown as WebSocketLikeConstructor;

export const supabaseAdmin = supabaseUrl && supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      realtime: { transport: realtimeTransport }
    })
  : null;

export const supabasePublicConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export function createSupabasePublicClient() {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    realtime: { transport: realtimeTransport }
  });
}
