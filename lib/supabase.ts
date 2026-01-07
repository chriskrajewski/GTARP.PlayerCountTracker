import { createBrowserClient } from "./supabase-browser"
import { createServerClient } from "./supabase-server"

// Check if we're in a browser environment
const isClient = typeof window !== "undefined"

// Lazy-load the server client to avoid initializing during build time
let cachedServerClient: ReturnType<typeof createServerClient> | null = null

function getOrCreateServerClient() {
  if (!cachedServerClient) {
    cachedServerClient = createServerClient()
  }
  return cachedServerClient
}

// Create the appropriate client based on the environment
// For browser: create immediately (safe)
// For server: use lazy getter to defer initialization until runtime
export const supabase = isClient ? createBrowserClient() : new Proxy({} as any, {
  get: (target, prop) => {
    const client = getOrCreateServerClient()
    return (client as any)[prop]
  }
})
