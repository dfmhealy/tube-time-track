export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      podcast_episodes: {
        Row: {
          audio_url: string
          created_at: string
          description: string | null
          duration_seconds: number | null
          episode_number: number | null
          id: string
          podcast_id: string
          publish_date: string | null
          season_number: number | null
          thumbnail_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          audio_url: string
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          episode_number?: number | null
          id?: string
          podcast_id: string
          publish_date?: string | null
          season_number?: number | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          audio_url?: string
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          episode_number?: number | null
          id?: string
          podcast_id?: string
          publish_date?: string | null
          season_number?: number | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "podcast_episodes_podcast_id_fkey"
            columns: ["podcast_id"]
            isOneToOne: false
            referencedRelation: "podcasts"
            referencedColumns: ["id"]
          },
        ]
      }
      podcast_sessions: {
        Row: {
          avg_playback_rate: number | null
          created_at: string
          ended_at: string | null
          episode_id: string
          id: string
          seconds_listened: number | null
          source: string | null
          started_at: string | null
          user_id: string
        }
        Insert: {
          avg_playback_rate?: number | null
          created_at?: string
          ended_at?: string | null
          episode_id: string
          id?: string
          seconds_listened?: number | null
          source?: string | null
          started_at?: string | null
          user_id: string
        }
        Update: {
          avg_playback_rate?: number | null
          created_at?: string
          ended_at?: string | null
          episode_id?: string
          id?: string
          seconds_listened?: number | null
          source?: string | null
          started_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "podcast_sessions_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "podcast_episodes"
            referencedColumns: ["id"]
          },
        ]
      }
      podcast_subscriptions: {
        Row: {
          id: string
          podcast_id: string
          subscribed_at: string
          user_id: string
        }
        Insert: {
          id?: string
          podcast_id: string
          subscribed_at?: string
          user_id: string
        }
        Update: {
          id?: string
          podcast_id?: string
          subscribed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "podcast_subscriptions_podcast_id_fkey"
            columns: ["podcast_id"]
            isOneToOne: false
            referencedRelation: "podcasts"
            referencedColumns: ["id"]
          },
        ]
      }
      podcasts: {
        Row: {
          category: string | null
          created_at: string
          creator: string
          description: string | null
          id: string
          language: string | null
          rss_url: string | null
          thumbnail_url: string
          title: string
          total_episodes: number | null
          updated_at: string
          website_url: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          creator: string
          description?: string | null
          id?: string
          language?: string | null
          rss_url?: string | null
          thumbnail_url: string
          title: string
          total_episodes?: number | null
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          creator?: string
          description?: string | null
          id?: string
          language?: string | null
          rss_url?: string | null
          thumbnail_url?: string
          title?: string
          total_episodes?: number | null
          updated_at?: string
          website_url?: string | null
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          auto_play: boolean | null
          created_at: string | null
          default_playback_rate: number | null
          id: string
          notifications_enabled: boolean | null
          theme: string | null
          updated_at: string | null
          user_id: string
          volume_preference: number | null
        }
        Insert: {
          auto_play?: boolean | null
          created_at?: string | null
          default_playback_rate?: number | null
          id?: string
          notifications_enabled?: boolean | null
          theme?: string | null
          updated_at?: string | null
          user_id: string
          volume_preference?: number | null
        }
        Update: {
          auto_play?: boolean | null
          created_at?: string | null
          default_playback_rate?: number | null
          id?: string
          notifications_enabled?: boolean | null
          theme?: string | null
          updated_at?: string | null
          user_id?: string
          volume_preference?: number | null
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          created_at: string | null
          display_name: string | null
          id: string
          timezone: string | null
          updated_at: string | null
          user_id: string
          weekly_goal_seconds: number | null
        }
        Insert: {
          created_at?: string | null
          display_name?: string | null
          id?: string
          timezone?: string | null
          updated_at?: string | null
          user_id: string
          weekly_goal_seconds?: number | null
        }
        Update: {
          created_at?: string | null
          display_name?: string | null
          id?: string
          timezone?: string | null
          updated_at?: string | null
          user_id?: string
          weekly_goal_seconds?: number | null
        }
        Relationships: []
      }
      user_stats: {
        Row: {
          created_at: string | null
          id: string
          last_watched_at: string | null
          streak_days: number | null
          total_seconds: number | null
          updated_at: string | null
          user_id: string
          weekly_goal_seconds: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_watched_at?: string | null
          streak_days?: number | null
          total_seconds?: number | null
          updated_at?: string | null
          user_id: string
          weekly_goal_seconds?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          last_watched_at?: string | null
          streak_days?: number | null
          total_seconds?: number | null
          updated_at?: string | null
          user_id?: string
          weekly_goal_seconds?: number | null
        }
        Relationships: []
      }
      videos: {
        Row: {
          added_at: string | null
          channel_title: string
          duration_seconds: number | null
          id: string
          last_watched_at: string | null
          tags: string[] | null
          thumbnail_url: string
          title: string
          user_id: string
          watch_seconds: number | null
          youtube_id: string
        }
        Insert: {
          added_at?: string | null
          channel_title: string
          duration_seconds?: number | null
          id?: string
          last_watched_at?: string | null
          tags?: string[] | null
          thumbnail_url: string
          title: string
          user_id: string
          watch_seconds?: number | null
          youtube_id: string
        }
        Update: {
          added_at?: string | null
          channel_title?: string
          duration_seconds?: number | null
          id?: string
          last_watched_at?: string | null
          tags?: string[] | null
          thumbnail_url?: string
          title?: string
          user_id?: string
          watch_seconds?: number | null
          youtube_id?: string
        }
        Relationships: []
      }
      watch_sessions: {
        Row: {
          avg_playback_rate: number | null
          created_at: string | null
          ended_at: string | null
          id: string
          seconds_watched: number | null
          source: string | null
          started_at: string | null
          user_id: string
          video_id: string
        }
        Insert: {
          avg_playback_rate?: number | null
          created_at?: string | null
          ended_at?: string | null
          id?: string
          seconds_watched?: number | null
          source?: string | null
          started_at?: string | null
          user_id: string
          video_id: string
        }
        Update: {
          avg_playback_rate?: number | null
          created_at?: string | null
          ended_at?: string | null
          id?: string
          seconds_watched?: number | null
          source?: string | null
          started_at?: string | null
          user_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "watch_sessions_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
