import { createClient } from "@supabase/supabase-js"
import type { Database } from "./supabase.types"

// This is to ensure we don't instantiate multiple Supabase clients on the client side
let clientInstance: ReturnType<typeof createClient<Database>> | null = null

export function createBrowserClient() {
  if (clientInstance) return clientInstance

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables for browser client.")
  }

  clientInstance = createClient<Database>(supabaseUrl, supabaseAnonKey)
  return clientInstance
}
