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
      server_capacity: {
        Row: {
          id: number
          server_id: string
          timestamp: string
          max_capacity: number
          created_at: string
        }
        Insert: {
          server_id: string
          timestamp: string
          max_capacity: number
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
          message_markdown: string | null
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
          message_markdown?: string | null
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
      system_settings: {
        Row: {
          id: string
          key: string
          value: string
          data_type: 'string' | 'number' | 'boolean' | 'json'
          description: string | null
          category: string | null
          updated_at: string
          updated_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          key: string
          value: string
          data_type?: 'string' | 'number' | 'boolean' | 'json'
          description?: string | null
          category?: string | null
          updated_at?: string
          updated_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          key?: string
          value?: string
          data_type?: 'string' | 'number' | 'boolean' | 'json'
          description?: string | null
          category?: string | null
          updated_at?: string
          updated_by?: string | null
          created_at?: string
        }
      }
      site_updates: {
        Row: {
          id: number
          created_at: string
          updated_at: string
          title: string
          content: string
          content_markdown: string | null
          type: string
          priority: number
          tags: string[] | null
          is_published: boolean
          publish_date: string | null
          created_by: string | null
          view_count: number | null
        }
        Insert: {
          title: string
          content: string
          content_markdown?: string | null
          type?: string
          priority?: number
          tags?: string[] | null
          is_published?: boolean
          publish_date?: string | null
          created_by?: string | null
          view_count?: number | null
        }
        Update: {
          title?: string
          content?: string
          content_markdown?: string | null
          type?: string
          priority?: number
          tags?: string[] | null
          is_published?: boolean
          publish_date?: string | null
          created_by?: string | null
          view_count?: number | null
        }
      }
      roadmap_items: {
        Row: {
          id: number
          created_at: string
          updated_at: string
          title: string
          description: string
          description_markdown: string | null
          status: string
          priority: number
          category: string | null
          is_published: boolean
          display_order: number
          vote_count: number | null
          created_by: string | null
        }
        Insert: {
          title: string
          description: string
          description_markdown?: string | null
          status?: string
          priority?: number
          category?: string | null
          is_published?: boolean
          display_order?: number
          vote_count?: number | null
          created_by?: string | null
        }
        Update: {
          title?: string
          description?: string
          description_markdown?: string | null
          status?: string
          priority?: number
          category?: string | null
          is_published?: boolean
          display_order?: number
          vote_count?: number | null
          created_by?: string | null
        }
      }
      roadmap_votes: {
        Row: {
          id: number
          roadmap_item_id: number
          user_id: string
          voted_at: string
        }
        Insert: {
          roadmap_item_id: number
          user_id: string
          voted_at?: string
        }
        Update: {
          roadmap_item_id?: number
          user_id?: string
          voted_at?: string
        }
      }
      feature_flags: {
        Row: {
          id: number
          key: string
          name: string
          description: string | null
          is_enabled: boolean | null
          category: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          key: string
          name: string
          description?: string | null
          is_enabled?: boolean | null
          category?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          key?: string
          name?: string
          description?: string | null
          is_enabled?: boolean | null
          category?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      server_restart_predictions: {
        Row: {
          id: number
          server_id: string
          next_restart_time: string | null
          confidence: number
          detected_pattern: string | null
          last_restart_time: string | null
          average_downtime: number
          pattern_type: string | null
          pattern_interval: number | null
          pattern_time_of_day: string | null
          pattern_variance: number
          pattern_occurrences: number
          detected_events_count: number
          ml_reasoning: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          server_id: string
          next_restart_time?: string | null
          confidence?: number
          detected_pattern?: string | null
          last_restart_time?: string | null
          average_downtime?: number
          pattern_type?: string | null
          pattern_interval?: number | null
          pattern_time_of_day?: string | null
          pattern_variance?: number
          pattern_occurrences?: number
          detected_events_count?: number
          ml_reasoning?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          server_id?: string
          next_restart_time?: string | null
          confidence?: number
          detected_pattern?: string | null
          last_restart_time?: string | null
          average_downtime?: number
          pattern_type?: string | null
          pattern_interval?: number | null
          pattern_time_of_day?: string | null
          pattern_variance?: number
          pattern_occurrences?: number
          detected_events_count?: number
          ml_reasoning?: string | null
          updated_at?: string
        }
      }
      server_restart_events: {
        Row: {
          id: number
          server_id: string
          event_timestamp: string
          player_count_before: number | null
          player_count_after: number | null
          downtime_minutes: number | null
          created_at: string
        }
        Insert: {
          server_id: string
          event_timestamp: string
          player_count_before?: number | null
          player_count_after?: number | null
          downtime_minutes?: number | null
          created_at?: string
        }
      }
    }
  }
}
