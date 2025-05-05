import { createBrowserClient } from "./supabase-browser"
import { createServerClient } from "./supabase-server"

export type Database = {
  public: {
    Tables: {
      player_counts: {
        Row: {
          id: number
          server_id: string
          timestamp: string
          player_count: number
          created_at: string
        }
        Insert: {
          server_id: string
          timestamp: string
          player_count: number
          created_at?: string
        }
      }
      server_xref: {
        Row: {
          id: number
          server_id: string
          server_name: string
          created_at?: string
        }
        Insert: {
          server_id: string
          server_name: string
          created_at?: string
        }
      }
    }
  }
}

// Check if we're in a browser environment
const isClient = typeof window !== "undefined"

// Create the appropriate client based on the environment
export const supabase = isClient ? createBrowserClient() : createServerClient()
