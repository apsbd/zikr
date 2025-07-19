import { createClient } from '@supabase/supabase-js';

// Create a Supabase client with the service role key
// This should only be used in server-side code, never in client-side code
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    }
  }
);