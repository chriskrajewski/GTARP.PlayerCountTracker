import { createBrowserClient } from "./supabase-browser"
import { createServerClient } from "./supabase-server"

// Check if we're in a browser environment
const isClient = typeof window !== "undefined"

// Create the appropriate client based on the environment
export const supabase = isClient ? createBrowserClient() : createServerClient()
