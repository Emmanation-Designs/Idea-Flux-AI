import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_SUPABASE_URL : undefined) || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://wxezfzhhzlauggufecmm.supabase.co';
const supabaseAnonKey = (typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_SUPABASE_ANON_KEY : undefined) || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind4ZXpmemhoemxhdWdndWZlY21tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyNTQxMjcsImV4cCI6MjA4OTgzMDEyN30.2nsDSFhOtm1Xs3RuZNDo74jGbBwd05E7lPP-FN5cd1Q';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL or Anon Key is missing. Auth and Database features will not work.');
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder'
);
