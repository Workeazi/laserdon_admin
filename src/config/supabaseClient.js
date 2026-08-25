import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Check .env');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Admin client that bypasses Row Level Security (RLS) for CRUD operations
export const supabaseAdmin = supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey, {
  global: {
    headers: {
      Authorization: `Bearer ${supabaseServiceKey}`,
      apikey: supabaseServiceKey
    }
  },
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false
  }
}) : null;
