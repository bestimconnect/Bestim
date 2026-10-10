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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      car_makes: {
        Row: {
          id: string
          name_ar: string
          name_en: string
          sort: number
        }
        Insert: {
          id?: string
          name_ar: string
          name_en: string
          sort?: number
        }
        Update: {
          id?: string
          name_ar?: string
          name_en?: string
          sort?: number
        }
        Relationships: []
      }
      car_models: {
        Row: {
          body_type: string
          id: string
          make_id: string
          name_ar: string
          name_en: string
        }
        Insert: {
          body_type: string
          id?: string
          make_id: string
          name_ar: string
          name_en: string
        }
        Update: {
          body_type?: string
          id?: string
          make_id?: string
          name_ar?: string
          name_en?: string
        }
        Relationships: [
          {
            foreignKeyName: "car_models_make_id_fkey"
            columns: ["make_id"]
            isOneToOne: false
            referencedRelation: "car_makes"
            referencedColumns: ["id"]
          },
        ]
      }
      connect_leads: {
        Row: {
          company: string
          created_at: string
          fleet_size: string
          id: string
          kind: string
          lang: string
          name: string
          note: string | null
          phone: string
        }
        Insert: {
          company: string
          created_at?: string
          fleet_size: string
          id?: string
          kind: string
          lang: string
          name: string
          note?: string | null
          phone: string
        }
        Update: {
          company?: string
          created_at?: string
          fleet_size?: string
          id?: string
          kind?: string
          lang?: string
          name?: string
          note?: string | null
          phone?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          currency: string
          description: string | null
          expense_date: string
          from_log: boolean
          id: string
          full_tank: boolean
          liters: number | null
          log_id: string | null
          odometer_reading: number | null
          receipt_url: string | null
          user_id: string
          vehicle_id: string
        }
        Insert: {
          amount: number
          category?: string
          created_at?: string
          currency?: string
          description?: string | null
          expense_date?: string
          from_log?: boolean
          id?: string
          full_tank?: boolean
          liters?: number | null
          log_id?: string | null
          odometer_reading?: number | null
          receipt_url?: string | null
          user_id?: string
          vehicle_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          currency?: string
          description?: string | null
          expense_date?: string
          from_log?: boolean
          id?: string
          full_tank?: boolean
          liters?: number | null
          log_id?: string | null
          odometer_reading?: number | null
          receipt_url?: string | null
          user_id?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_log_id_fkey"
            columns: ["log_id"]
            isOneToOne: false
            referencedRelation: "maintenance_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      log_corrections: {
        Row: {
          corrected_at: string
          corrected_by: string
          field_name: string
          id: string
          log_id: string
          new_value: string | null
          old_value: string | null
          reason: string | null
        }
        Insert: {
          corrected_at?: string
          corrected_by?: string
          field_name: string
          id?: string
          log_id: string
          new_value?: string | null
          old_value?: string | null
          reason?: string | null
        }
        Update: {
          corrected_at?: string
          corrected_by?: string
          field_name?: string
          id?: string
          log_id?: string
          new_value?: string | null
          old_value?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "log_corrections_corrected_by_fkey"
            columns: ["corrected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "log_corrections_log_id_fkey"
            columns: ["log_id"]
            isOneToOne: false
            referencedRelation: "maintenance_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_logs: {
        Row: {
          cost: number | null
          created_at: string
          currency: string
          description: string | null
          details: Json
          id: string
          interval_km: number | null
          interval_months: number | null
          location: string | null
          odometer_reading: number | null
          parts_replaced: Json
          photos: string[]
          service_date: string
          service_type_id: string | null
          source: string
          status: string
          title: string
          updated_at: string
          user_id: string
          vehicle_id: string
          voice_transcript: string | null
        }
        Insert: {
          cost?: number | null
          created_at?: string
          currency?: string
          description?: string | null
          details?: Json
          id?: string
          interval_km?: number | null
          interval_months?: number | null
          location?: string | null
          odometer_reading?: number | null
          parts_replaced?: Json
          photos?: string[]
          service_date?: string
          service_type_id?: string | null
          source?: string
          status?: string
          title: string
          updated_at?: string
          user_id?: string
          vehicle_id: string
          voice_transcript?: string | null
        }
        Update: {
          cost?: number | null
          created_at?: string
          currency?: string
          description?: string | null
          details?: Json
          id?: string
          interval_km?: number | null
          interval_months?: number | null
          location?: string | null
          odometer_reading?: number | null
          parts_replaced?: Json
          photos?: string[]
          service_date?: string
          service_type_id?: string | null
          source?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
          vehicle_id?: string
          voice_transcript?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_logs_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_logs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      odometer_readings: {
        Row: {
          created_at: string
          id: string
          reading: number
          user_id: string
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reading: number
          user_id: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reading?: number
          user_id?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "odometer_readings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "odometer_readings_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          currency: string
          full_name: string
          id: string
          language: string
          notification_prefs: Json
          notifications_enabled: boolean
          onboarding_completed: boolean
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          currency?: string
          full_name?: string
          id: string
          language?: string
          notification_prefs?: Json
          notifications_enabled?: boolean
          onboarding_completed?: boolean
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          currency?: string
          full_name?: string
          id?: string
          language?: string
          notification_prefs?: Json
          notifications_enabled?: boolean
          onboarding_completed?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      record_categories: {
        Row: {
          expense_code: string | null
          icon: string | null
          id: string
          name_ar: string
          name_en: string
          parent_id: string | null
          sort: number
        }
        Insert: {
          expense_code?: string | null
          icon?: string | null
          id?: string
          name_ar: string
          name_en: string
          parent_id?: string | null
          sort?: number
        }
        Update: {
          expense_code?: string | null
          icon?: string | null
          id?: string
          name_ar?: string
          name_en?: string
          parent_id?: string | null
          sort?: number
        }
        Relationships: [
          {
            foreignKeyName: "record_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "record_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      reminders: {
        Row: {
          created_at: string
          description: string | null
          due_date: string | null
          due_odometer: number | null
          id: string
          notify_before_days: number
          repeat_interval_km: number | null
          repeat_interval_months: number | null
          service_type_id: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          due_date?: string | null
          due_odometer?: number | null
          id?: string
          notify_before_days?: number
          repeat_interval_km?: number | null
          repeat_interval_months?: number | null
          service_type_id?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id?: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          due_date?: string | null
          due_odometer?: number | null
          id?: string
          notify_before_days?: number
          repeat_interval_km?: number | null
          repeat_interval_months?: number | null
          service_type_id?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminders_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      service_types: {
        Row: {
          category: string
          category_id: string | null
          default_interval_km: number | null
          default_interval_months: number | null
          fields: string[]
          has_reminder: boolean
          icon: string
          id: string
          is_system: boolean
          name_ar: string
          name_en: string
          sort: number
        }
        Insert: {
          category?: string
          category_id?: string | null
          default_interval_km?: number | null
          default_interval_months?: number | null
          fields?: string[]
          has_reminder?: boolean
          icon?: string
          id?: string
          is_system?: boolean
          name_ar: string
          name_en: string
          sort?: number
        }
        Update: {
          category?: string
          category_id?: string | null
          default_interval_km?: number | null
          default_interval_months?: number | null
          fields?: string[]
          has_reminder?: boolean
          icon?: string
          id?: string
          is_system?: boolean
          name_ar?: string
          name_en?: string
          sort?: number
        }
        Relationships: [
          {
            foreignKeyName: "service_types_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "record_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_shares: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          includes_expenses: boolean
          share_token: string
          shared_by: string
          shared_with_email: string | null
          status: string
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          includes_expenses?: boolean
          share_token?: string
          shared_by?: string
          shared_with_email?: string | null
          status?: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          includes_expenses?: boolean
          share_token?: string
          shared_by?: string
          shared_with_email?: string | null
          status?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_shares_shared_by_fkey"
            columns: ["shared_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_shares_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          car_model_id: string | null
          color: string | null
          created_at: string
          current_odometer: number
          id: string
          is_primary: boolean
          make: string
          model: string
          nickname: string | null
          odometer_unit: string
          odometer_updated_at: string
          photo_url: string | null
          plate_number: string | null
          updated_at: string
          user_id: string
          vehicle_type: string
          vin: string | null
          year: number
        }
        Insert: {
          car_model_id?: string | null
          color?: string | null
          created_at?: string
          current_odometer?: number
          id?: string
          is_primary?: boolean
          make: string
          model: string
          nickname?: string | null
          odometer_unit?: string
          odometer_updated_at?: string
          photo_url?: string | null
          plate_number?: string | null
          updated_at?: string
          user_id?: string
          vehicle_type?: string
          vin?: string | null
          year: number
        }
        Update: {
          car_model_id?: string | null
          color?: string | null
          created_at?: string
          current_odometer?: number
          id?: string
          is_primary?: boolean
          make?: string
          model?: string
          nickname?: string | null
          odometer_unit?: string
          odometer_updated_at?: string
          photo_url?: string | null
          plate_number?: string | null
          updated_at?: string
          user_id?: string
          vehicle_type?: string
          vin?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_car_model_id_fkey"
            columns: ["car_model_id"]
            isOneToOne: false
            referencedRelation: "car_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_usage: {
        Row: {
          count: number
          day: string
          scans: number
          user_id: string
        }
        Insert: {
          count?: number
          day: string
          scans?: number
          user_id: string
        }
        Update: {
          count?: number
          day?: string
          scans?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_usage_user_id_fkey"
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
      accept_share: { Args: { token: string }; Returns: string }
      bump_scan_usage: { Args: never; Returns: number }
      bump_voice_usage: { Args: never; Returns: number }
      correct_log: {
        Args: { changes: Json; log_id: string; reason: string }
        Returns: undefined
      }
      delete_my_account: { Args: never; Returns: undefined }
      get_share: {
        Args: { token: string }
        Returns: {
          expires_at: string
          includes_expenses: boolean
          log_count: number
          make: string
          model: string
          nickname: string
          own: boolean
          shared_by_name: string
          vehicle_id: string
          vehicle_type: string
          year: number
        }[]
      }
      owns_log: { Args: { l: string }; Returns: boolean }
      owns_vehicle: { Args: { v: string }; Returns: boolean }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
