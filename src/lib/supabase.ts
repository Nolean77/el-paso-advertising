import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://tawdrfphyjwfmzheyeia.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRhd2RyZnBoeWp3Zm16aGV5ZWlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNjQ4MDQsImV4cCI6MjA5MDY0MDgwNH0.e46LmgNJaHlOjkPHoi8Nyy3vD7bCx4-RZZXctIhmrZE'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
