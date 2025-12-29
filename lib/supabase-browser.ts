import { createClient } from "@supabase/supabase-js"
import type { Database } from "./supabase.types"

// This is to ensure we don't instantiate multiple Supabase clients on the client side
let clientInstance: ReturnType<typeof createClient<Database>> | null = null
let sessionRestored = false

export function createBrowserClient() {
  if (clientInstance) return clientInstance

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables for browser client.")
  }

  clientInstance = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      flowType: 'pkce',
    },
  })

  // Initialize session restoration on first client creation
  if (!sessionRestored && typeof window !== 'undefined') {
    sessionRestored = true
    // Trigger session restoration immediately
    clientInstance.auth.getSession().catch(err => {
      console.error('Failed to restore session:', err)
    })
  }

  return clientInstance
}

/**
 * Wait for session to be restored from storage
 * This is critical for page refreshes to work properly
 */
export async function waitForSessionRestoration(): Promise<void> {
  const supabase = createBrowserClient()
  
  // Wait for the session to be restored
  return new Promise((resolve) => {
    let attempts = 0
    const maxAttempts = 50 // 5 seconds max wait (50 * 100ms)
    
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session || attempts >= maxAttempts) {
          resolve()
          return
        }
      } catch (error) {
        console.error('Error checking session:', error)
      }
      
      attempts++
      setTimeout(checkSession, 100)
    }
    
    checkSession()
  })
}

