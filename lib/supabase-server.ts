import { createClient } from "@supabase/supabase-js"
import type { Database } from "./supabase.types"

// This client should only be used in server components or server actions
export function createServerClient() {
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables for server client.")
  }

  return createClient<Database>(supabaseUrl, supabaseAnonKey)
}
