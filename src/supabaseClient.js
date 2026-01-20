import { createClient } from '@supabase/supabase-js'

// Use import.meta.env for Vite projects
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// This creates the connection
export const supabase = createClient(supabaseUrl, supabaseKey)