import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

// Database types
export interface DbDeck {
  id: string;
  title: string;
  description: string;
  author: string;
  daily_new_limit: number;
  created_at: string;
  updated_at: string;
}

export interface DbCard {
  id: string;
  deck_id: string;
  front: string;
  back_bangla: string;
  back_english: string;
  created_at: string;
  updated_at: string;
}