import { createClient } from '@supabase/supabase-js'

const fallbackSupabaseUrl = 'https://tawdrfphyjwfmzheyeia.supabase.co'
const fallbackSupabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRhd2RyZnBoeWp3Zm16aGV5ZWlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNjQ4MDQsImV4cCI6MjA5MDY0MDgwNH0.e46LmgNJaHlOjkPHoi8Nyy3vD7bCx4-RZZXctIhmrZE'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || fallbackSupabaseUrl
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || fallbackSupabaseAnonKey

if (import.meta.env.DEV && (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY)) {
  console.warn('Supabase environment variables are not fully configured. Using embedded fallback values for local development.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
