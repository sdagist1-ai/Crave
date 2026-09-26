// Generated from the Supabase schema — do not edit by hand.
// Regenerate with: npx supabase gen types typescript --project-id kqdsgmiutfsxsjgubget > src/types/database.ts

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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      group_members: {
        Row: {
          created_at: string
          group_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          avatar_url: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          share_code: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          share_code?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          share_code?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          first_name: string | null
          id: string
          last_name: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          first_name?: string | null
          id: string
          last_name?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
        }
        Relationships: []
      }
      app_updates: {
        Row: {
          id: number
          version: string
          min_build: number
          zip_url: string
          checksum: string | null
          notes: string | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          version: string
          min_build: number
          zip_url: string
          checksum?: string | null
          notes?: string | null
          is_active?: boolean
        }
        Update: {
          is_active?: boolean
          notes?: string | null
        }
        Relationships: []
      }
      ota_crash_logs: {
        Row: {
          id: number
          version: string
          build: number | null
          error_message: string
          user_id: string | null
          created_at: string
        }
        Insert: {
          version: string
          build?: number | null
          error_message: string
        }
        Update: never
        Relationships: []
      }
      cuisine_catalog: {
        Row: {
          label: string
          region: string
          sort: number
          generic: boolean
          google_types: string[]
          name_keywords: string[]
        }
        Insert: never
        Update: never
        Relationships: []
      }
      restaurants: {
        Row: {
          address: string
          area: string | null
          booking_platform: string | null
          booking_url: string | null
          city: string | null
          country_code: string | null
          created_at: string
          group_id: string
          id: number
          last_synced_at: string | null
          latitude: number
          longitude: number
          name: string
          notes: string | null
          opening_hours: Json | null
          owner: string | null
          photo_url: string | null
          place_id: string
          price_level: string | null
          primary_type: string | null
          types: string[] | null
          cuisine: string | null
          cuisine_detail: string | null
          cuisine_source: string | null
          occasions: string[]
          occasions_set: boolean
          rating: number | null
          user_rating_count: number | null
          vibes: Json
          visited: boolean
          website_url: string | null
        }
        Insert: {
          address: string
          area?: string | null
          booking_platform?: string | null
          booking_url?: string | null
          city?: string | null
          country_code?: string | null
          created_at?: string
          group_id: string
          id?: number
          last_synced_at?: string | null
          latitude: number
          longitude: number
          name: string
          notes?: string | null
          opening_hours?: Json | null
          owner?: string | null
          photo_url?: string | null
          place_id: string
          price_level?: string | null
          primary_type?: string | null
          types?: string[] | null
          cuisine?: string | null
          cuisine_detail?: string | null
          cuisine_source?: string | null
          occasions?: string[]
          occasions_set?: boolean
          rating?: number | null
          user_rating_count?: number | null
          vibes?: Json
          visited?: boolean
          website_url?: string | null
        }
        Update: {
          address?: string
          area?: string | null
          booking_platform?: string | null
          booking_url?: string | null
          city?: string | null
          country_code?: string | null
          created_at?: string
          group_id?: string
          id?: number
          last_synced_at?: string | null
          latitude?: number
          longitude?: number
          name?: string
          notes?: string | null
          opening_hours?: Json | null
          owner?: string | null
          photo_url?: string | null
          place_id?: string
          price_level?: string | null
          primary_type?: string | null
          types?: string[] | null
          cuisine?: string | null
          cuisine_detail?: string | null
          cuisine_source?: string | null
          occasions?: string[]
          occasions_set?: boolean
          rating?: number | null
          user_rating_count?: number | null
          vibes?: Json
          visited?: boolean
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restaurants_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurants_owner_fkey"
            columns: ["owner"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          created_at: string
          id: number
          notes: string | null
          photo_url: string | null
          photo_urls: string[] | null
          place_id: string
          score: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: number
          notes?: string | null
          photo_url?: string | null
          photo_urls?: string[] | null
          place_id: string
          score?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: number
          notes?: string | null
          photo_url?: string | null
          photo_urls?: string[] | null
          place_id?: string
          score?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_group: { Args: { group_name: string }; Returns: string }
      delete_user_account: { Args: never; Returns: undefined }
      get_group_feed: {
        Args: {
          p_category?: string
          p_group_id: string
          p_limit?: number
          p_offset?: number
          p_restaurant_id?: number
          p_search?: string
          p_sort?: string
          p_tab?: string
          p_vibes?: string[]
          p_cuisines?: string[]
          p_occasion?: string
          p_slim?: boolean
        }
        Returns: Json[]
      }
      get_list_facets: { Args: { p_group_id: string }; Returns: Json }
      guess_place_cuisine: {
        Args: { p_place_id: string; p_primary_type?: string; p_types?: string[]; p_name?: string }
        Returns: Json
      }
      get_my_groups: { Args: never; Returns: Json[] }
      get_my_stats: { Args: never; Returns: Json }
      // Returns json in SQL (so a wrong code can reply 400 without rolling back the
      // attempt); on success that JSON is the group id string.
      join_group: { Args: { invite_code: string }; Returns: string }
      reset_share_code: { Args: { p_group_id: string }; Returns: string }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
