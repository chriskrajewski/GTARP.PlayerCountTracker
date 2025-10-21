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
      server_resource_snapshots: {
        Row: {
          id: number
          server_id: string
          timestamp: string
          resources: string[] | null
          created_at: string
        }
        Insert: {
          server_id: string
          timestamp: string
          resources?: string[] | null
          created_at?: string
        }
      }
      server_resource_changes: {
        Row: {
          id: number
          server_id: string
          timestamp: string
          added_resources: string[] | null
          removed_resources: string[] | null
          created_at: string
        }
        Insert: {
          server_id: string
          timestamp: string
          added_resources?: string[] | null
          removed_resources?: string[] | null
          created_at?: string
        }
      }
      server_xref: {
        Row: {
          id: number
          server_id: string
          server_name: string
          order?: number | null
          created_at?: string
        }
        Insert: {
          server_id: string
          server_name: string
          order?: number | null
          created_at?: string
        }
      }
      twitch_streams: {
        Row: {
          id: number
          created_at: string | null
          streamer_name: string
          stream_title: string
          viewer_count: number
          game_name: string
          serverId: string
        }
        Insert: {
          created_at?: string | null
          streamer_name: string
          stream_title: string
          viewer_count: number
          game_name: string
          serverId: string
        }
      }
      notification_banners: {
        Row: {
          id: number
          created_at: string
          updated_at: string
          title: string
          message: string
          type: 'info' | 'warning' | 'success' | 'announcement' | 'urgent'
          priority: number
          is_active: boolean
          is_dismissible: boolean
          start_date: string | null
          end_date: string | null
          action_text: string | null
          action_url: string | null
          action_target: '_self' | '_blank' | null
          background_color: string | null
          text_color: string | null
          border_color: string | null
          created_by: string | null
          view_count: number
          dismiss_count: number
        }
        Insert: {
          title: string
          message: string
          type?: 'info' | 'warning' | 'success' | 'announcement' | 'urgent'
          priority?: number
          is_active?: boolean
          is_dismissible?: boolean
          start_date?: string | null
          end_date?: string | null
          action_text?: string | null
          action_url?: string | null
          action_target?: '_self' | '_blank' | null
          background_color?: string | null
          text_color?: string | null
          border_color?: string | null
          created_by?: string | null
          view_count?: number
          dismiss_count?: number
        }
      }
      notification_banner_dismissals: {
        Row: {
          id: number
          banner_id: number
          user_id: string
          dismissed_at: string
        }
        Insert: {
          banner_id: number
          user_id: string
          dismissed_at?: string
        }
      }
    }
  }
}

