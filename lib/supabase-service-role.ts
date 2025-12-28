import { createClient } from "@supabase/supabase-js"
import type { Database } from "./supabase.types"

/**
 * Service Role Client for Supabase
 * 
 * This client uses the service role key and should ONLY be used on the server side
 * for administrative operations that need to bypass RLS policies.
 * 
 * IMPORTANT: Never expose the service role key to the client!
 * This should only be used in:
 * - Server components
 * - Server actions
 * - API routes
 * - Edge functions with proper authentication
 * 
 * Use cases:
 * - Data collection and ETL processes
 * - Admin operations (creating/updating/deleting records)
 * - Batch operations
 * - System maintenance tasks
 */

let serviceRoleInstance: ReturnType<typeof createClient<Database>> | null = null

export function createServiceRoleClient() {
  if (serviceRoleInstance) return serviceRoleInstance

  const supabaseUrl = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase environment variables for service role client. " +
      "Required: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
    )
  }

  serviceRoleInstance = createClient<Database>(supabaseUrl, serviceRoleKey)
  return serviceRoleInstance
}

/**
 * Get the service role client instance
 * Throws an error if the client hasn't been initialized
 */
export function getServiceRoleClient() {
  if (!serviceRoleInstance) {
    throw new Error(
      "Service role client not initialized. Call createServiceRoleClient() first."
    )
  }
  return serviceRoleInstance
}
