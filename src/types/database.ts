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
    PostgrestVersion: "14.17"
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
      admin_audit_log: {
        Row: {
          action: string
          admin_id: string | null
          created_at: string
          detail: Json | null
          id: number
          target: string | null
        }
        Insert: {
          action: string
          admin_id?: string | null
          created_at?: string
          detail?: Json | null
          id?: never
          target?: string | null
        }
        Update: {
          action?: string
          admin_id?: string | null
          created_at?: string
          detail?: Json | null
          id?: never
          target?: string | null
        }
        Relationships: []
      }
      admins: {
        Row: {
          created_at: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_usage_log: {
        Row: {
          created_at: string
          id: number
          kind: string
          ms: number | null
          ok: boolean
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: never
          kind: string
          ms?: number | null
          ok: boolean
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: never
          kind?: string
          ms?: number | null
          ok?: boolean
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      car_makes: {
        Row: {
          id: string
          is_active: boolean
          logo_path: string | null
          name_ar: string
          name_en: string
          sort: number
        }
        Insert: {
          id?: string
          is_active?: boolean
          logo_path?: string | null
          name_ar: string
          name_en: string
          sort?: number
        }
        Update: {
          id?: string
          is_active?: boolean
          logo_path?: string | null
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
          image_path: string | null
          is_active: boolean
          make_id: string
          name_ar: string
          name_en: string
        }
        Insert: {
          body_type: string
          id?: string
          image_path?: string | null
          is_active?: boolean
          make_id: string
          name_ar: string
          name_en: string
        }
        Update: {
          body_type?: string
          id?: string
          image_path?: string | null
          is_active?: boolean
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
          full_tank: boolean
          id: string
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
          full_tank?: boolean
          id?: string
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
          full_tank?: boolean
          id?: string
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
      plans: {
        Row: {
          created_at: string
          desc_ar: string
          desc_en: string
          entitlements: Json
          id: string
          is_active: boolean
          is_default: boolean
          name_ar: string
          name_en: string
          sort: number
        }
        Insert: {
          created_at?: string
          desc_ar?: string
          desc_en?: string
          entitlements?: Json
          id: string
          is_active?: boolean
          is_default?: boolean
          name_ar: string
          name_en: string
          sort?: number
        }
        Update: {
          created_at?: string
          desc_ar?: string
          desc_en?: string
          entitlements?: Json
          id?: string
          is_active?: boolean
          is_default?: boolean
          name_ar?: string
          name_en?: string
          sort?: number
        }
        Relationships: []
      }
      systems: {
        Row: {
          id: number
          name_en: string
          name_ar: string
          health_weight: number
          sort: number
        }
        Insert: {
          id?: number
          name_en?: string
          name_ar?: string
          health_weight?: number
          sort?: number
        }
        Update: {
          id?: number
          name_en?: string
          name_ar?: string
          health_weight?: number
          sort?: number
        }
        Relationships: []
      }
      push_tokens: {
        Row: { id: string; user_id: string; token: string; platform: string; updated_at: string }
        Insert: { id?: string; user_id: string; token: string; platform?: string; updated_at?: string }
        Update: { id?: string; user_id?: string; token?: string; platform?: string; updated_at?: string }
        Relationships: []
      }
      announcements: {
        Row: { id: string; title_ar: string; title_en: string | null; body_ar: string; body_en: string | null; audience: string; sent_by: string | null; push_sent: number; push_failed: number; action: string; action_value: string | null; created_at: string }
        Insert: { id?: string; title_ar: string; title_en?: string | null; body_ar: string; body_en?: string | null; audience?: string; sent_by?: string | null; push_sent?: number; push_failed?: number; action?: string; action_value?: string | null; created_at?: string }
        Update: { id?: string; title_ar?: string; title_en?: string | null; body_ar?: string; body_en?: string | null; audience?: string; sent_by?: string | null; push_sent?: number; push_failed?: number; action?: string; action_value?: string | null; created_at?: string }
        Relationships: []
      }
      announcement_users: {
        Row: { announcement_id: string; user_id: string }
        Insert: { announcement_id: string; user_id: string }
        Update: { announcement_id?: string; user_id?: string }
        Relationships: []
      }
      specialists: {
        Row: {
          key: string
          name_en: string
          name_ar: string
          shows_all_jobs: boolean
          sort: number
        }
        Insert: {
          key?: string
          name_en?: string
          name_ar?: string
          shows_all_jobs?: boolean
          sort?: number
        }
        Update: {
          key?: string
          name_en?: string
          name_ar?: string
          shows_all_jobs?: boolean
          sort?: number
        }
        Relationships: []
      }
      catalog_items: {
        Row: {
          id: string
          system_id: number | null
          subsystem: string | null
          subsystem_ar: string | null
          group_name: string | null
          group_ar: string | null
          name_en: string
          name_ar: string
          aliases: string[]
          fuel_types: string[] | null
          flags: string[]
          item_type: string
        }
        Insert: {
          id?: string
          system_id?: number | null
          subsystem?: string | null
          subsystem_ar?: string | null
          group_name?: string | null
          group_ar?: string | null
          name_en?: string
          name_ar?: string
          aliases?: string[]
          fuel_types?: string[] | null
          flags?: string[]
          item_type?: string
        }
        Update: {
          id?: string
          system_id?: number | null
          subsystem?: string | null
          subsystem_ar?: string | null
          group_name?: string | null
          group_ar?: string | null
          name_en?: string
          name_ar?: string
          aliases?: string[]
          fuel_types?: string[] | null
          flags?: string[]
          item_type?: string
        }
        Relationships: []
      }
      job_types: {
        Row: {
          id: string
          specialist_key: string
          category_en: string
          category_ar: string
          system_id: number | null
          name_en: string
          name_ar: string
          aliases: string[]
          tracked: boolean
          default_interval_km: number | null
          default_interval_months: number | null
          fuel_types: string[] | null
          suggested_items: string[]
          sort: number
        }
        Insert: {
          id?: string
          specialist_key?: string
          category_en?: string
          category_ar?: string
          system_id?: number | null
          name_en?: string
          name_ar?: string
          aliases?: string[]
          tracked?: boolean
          default_interval_km?: number | null
          default_interval_months?: number | null
          fuel_types?: string[] | null
          suggested_items?: string[]
          sort?: number
        }
        Update: {
          id?: string
          specialist_key?: string
          category_en?: string
          category_ar?: string
          system_id?: number | null
          name_en?: string
          name_ar?: string
          aliases?: string[]
          tracked?: boolean
          default_interval_km?: number | null
          default_interval_months?: number | null
          fuel_types?: string[] | null
          suggested_items?: string[]
          sort?: number
        }
        Relationships: []
      }
      visits: {
        Row: {
          id: string
          vehicle_id: string
          user_id: string
          visit_date: string
          odometer: number | null
          workshop_name: string | null
          workshop_phone: string | null
          notes: string | null
          photos: string[]
          deleted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          vehicle_id?: string
          user_id?: string
          visit_date?: string
          odometer?: number | null
          workshop_name?: string | null
          workshop_phone?: string | null
          notes?: string | null
          photos?: string[]
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          vehicle_id?: string
          user_id?: string
          visit_date?: string
          odometer?: number | null
          workshop_name?: string | null
          workshop_phone?: string | null
          notes?: string | null
          photos?: string[]
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      jobs: {
        Row: {
          id: string
          visit_id: string
          specialist_key: string
          specialist_name: string | null
          job_type_id: string | null
          custom_name: string | null
          position: string | null
          notes: string | null
          sort: number
        }
        Insert: {
          id?: string
          visit_id?: string
          specialist_key?: string
          specialist_name?: string | null
          job_type_id?: string | null
          custom_name?: string | null
          position?: string | null
          notes?: string | null
          sort?: number
        }
        Update: {
          id?: string
          visit_id?: string
          specialist_key?: string
          specialist_name?: string | null
          job_type_id?: string | null
          custom_name?: string | null
          position?: string | null
          notes?: string | null
          sort?: number
        }
        Relationships: [
          { foreignKeyName: "jobs_visit_id_fkey"; columns: ["visit_id"]; isOneToOne: false; referencedRelation: "visits"; referencedColumns: ["id"] },
        ]
      }
      line_items: {
        Row: {
          id: string
          job_id: string
          type: string
          catalog_item_id: string | null
          name: string
          qty: number
          unit: string | null
          unit_price: number | null
          total: number
          brand: string | null
          origin: string | null
          condition: string | null
          part_number: string | null
          warranty_months: number | null
        }
        Insert: {
          id?: string
          job_id?: string
          type?: string
          catalog_item_id?: string | null
          name?: string
          qty?: number
          unit?: string | null
          unit_price?: number | null
          total?: number
          brand?: string | null
          origin?: string | null
          condition?: string | null
          part_number?: string | null
          warranty_months?: number | null
        }
        Update: {
          id?: string
          job_id?: string
          type?: string
          catalog_item_id?: string | null
          name?: string
          qty?: number
          unit?: string | null
          unit_price?: number | null
          total?: number
          brand?: string | null
          origin?: string | null
          condition?: string | null
          part_number?: string | null
          warranty_months?: number | null
        }
        Relationships: [
          { foreignKeyName: "line_items_job_id_fkey"; columns: ["job_id"]; isOneToOne: false; referencedRelation: "jobs"; referencedColumns: ["id"] },
        ]
      }
      catalog_meta: {
        Row: { id: boolean; version: number }
        Insert: { id?: boolean; version?: number }
        Update: { id?: boolean; version?: number }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          currency: string
          deleted_at: string | null
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
          image_late: string | null
          image_ok: string | null
          image_soon: string | null
          is_active: boolean
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
          image_late?: string | null
          image_ok?: string | null
          image_soon?: string | null
          is_active?: boolean
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
          image_late?: string | null
          image_ok?: string | null
          image_soon?: string | null
          is_active?: boolean
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
      user_plans: {
        Row: {
          expires_at: string | null
          plan_id: string
          source: string
          updated_at: string
          user_id: string
        }
        Insert: {
          expires_at?: string | null
          plan_id: string
          source?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          expires_at?: string | null
          plan_id?: string
          source?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_plans_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_plans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
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
      vehicle_types: {
        Row: {
          id: string
          image_path: string | null
          is_active: boolean
          name_ar: string
          name_en: string
          sort: number
        }
        Insert: {
          id: string
          image_path?: string | null
          is_active?: boolean
          name_ar: string
          name_en: string
          sort?: number
        }
        Update: {
          id?: string
          image_path?: string | null
          is_active?: boolean
          name_ar?: string
          name_en?: string
          sort?: number
        }
        Relationships: []
      }
      vehicles: {
        Row: {
          car_model_id: string | null
          color: string | null
          created_at: string
          current_odometer: number
          deleted_at: string | null
          daily_km_hint: number | null
          id: string
          is_primary: boolean
          make: string
          model: string
          nickname: string | null
          odometer_unit: string
          odometer_updated_at: string | null
          photo_url: string | null
          plate_number: string | null
          removed_records: number
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
          daily_km_hint?: number | null
          id?: string
          is_primary?: boolean
          make: string
          model: string
          nickname?: string | null
          odometer_unit?: string
          odometer_updated_at?: string | null
          photo_url?: string | null
          plate_number?: string | null
          removed_records?: number
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
          daily_km_hint?: number | null
          id?: string
          is_primary?: boolean
          make?: string
          model?: string
          nickname?: string | null
          odometer_unit?: string
          odometer_updated_at?: string | null
          photo_url?: string | null
          plate_number?: string | null
          removed_records?: number
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
      widget_keys: {
        Row: {
          created_at: string
          id: string
          key_hash: string
          last_used_at: string | null
          platform: string
          user_id: string
          window_start: string
          window_uses: number
        }
        Insert: {
          created_at?: string
          id?: string
          key_hash: string
          last_used_at?: string | null
          platform: string
          user_id: string
          window_start?: string
          window_uses?: number
        }
        Update: {
          created_at?: string
          id?: string
          key_hash?: string
          last_used_at?: string | null
          platform?: string
          user_id?: string
          window_start?: string
          window_uses?: number
        }
        Relationships: [
          {
            foreignKeyName: "widget_keys_user_id_fkey"
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
      register_push_token: { Args: { p_token: string; p_platform: string }; Returns: undefined }
      remove_push_token: { Args: { p_token: string }; Returns: undefined }
      accept_share: { Args: { token: string }; Returns: string }
      admin_overview: { Args: never; Returns: Json }
      admin_role: { Args: never; Returns: string }
      admin_set_user_plan: {
        Args: { p_expires: string; p_plan: string; p_user: string }
        Returns: undefined
      }
      admin_type_usage: {
        Args: never
        Returns: {
          models: number
          type: string
          vehicles: number
        }[]
      }
      admin_user_detail: { Args: { p_user: string }; Returns: Json }
      admin_user_list: {
        Args: { p_limit: number; p_offset: number; p_search: string }
        Returns: {
          created_at: string
          email: string
          full_name: string
          id: string
          last_sign_in_at: string
          logs: number
          total: number
          vehicles: number
        }[]
      }
      bump_scan_usage: { Args: never; Returns: number }
      bump_voice_usage: { Args: never; Returns: number }
      can_edit_catalog: { Args: never; Returns: boolean }
      correct_log: {
        Args: { changes: Json; log_id: string; reason: string }
        Returns: undefined
      }
      create_widget_key: { Args: { p_platform: string }; Returns: string }
      delete_my_account: { Args: never; Returns: undefined }
      // v2 Services RPCs, hand-added like the soft-delete ones (see 20261121100000_v2_save_visit_health.sql).
      save_visit: { Args: { p: Json }; Returns: string }
      car_health: { Args: { p_vehicle_id: string }; Returns: Json }
      tracked_health: {
        Args: { p_vehicle_id: string }
        Returns: {
          tracked_item_id: string; job_type_id: string | null; catalog_item_id: string | null; system_id: number | null; weight: number
          interval_km: number | null; interval_months: number | null; last_done_km: number | null; last_done_date: string | null
          health: number | null; state: string | null; remaining_km: number | null; remaining_days: number | null; due_date: string | null
        }[]
      }
      search_catalog: {
        Args: { q: string; p_vehicle_id?: string; max_rows?: number }
        Returns: { kind: string; id: string; name_en: string; name_ar: string; system_id: number | null; item_type: string | null; specialist_key: string | null }[]
      }
      // v2 soft delete (20261121110000_v2_soft_delete.sql); hand-added until the migration is pushed and `npm run types` is re-run.
      soft_delete_vehicle: { Args: { p_vehicle_id: string }; Returns: undefined }
      restore_vehicle: { Args: { p_vehicle_id: string }; Returns: undefined }
      soft_delete_visit: { Args: { p_visit_id: string }; Returns: undefined }
      restore_visit: { Args: { p_visit_id: string }; Returns: undefined }
      soft_delete_my_account: { Args: never; Returns: undefined }
      restore_my_account: { Args: never; Returns: undefined }
      my_deleted_items: {
        Args: never
        Returns: { kind: string; id: string; vehicle_id: string; title: string; deleted_at: string; purge_at: string }[]
      }
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
          removed_records: number
          shared_by_name: string
          vehicle_id: string
          vehicle_type: string
          year: number
        }[]
      }
      has_role: { Args: { roles: string[] }; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      log_ai_usage: {
        Args: { p_kind: string; p_ms: number; p_ok: boolean }
        Returns: undefined
      }
      my_entitlements: { Args: never; Returns: Json }
      my_feature: { Args: { p_key: string }; Returns: boolean }
      my_limit: { Args: { p_key: string }; Returns: number }
      owns_log: { Args: { l: string }; Returns: boolean }
      owns_vehicle: { Args: { v: string }; Returns: boolean }
      plan_entitlements: { Args: { p_user: string }; Returns: Json }
      require_admin: { Args: never; Returns: undefined }
      require_pii_admin: { Args: never; Returns: undefined }
      revoke_widget_keys: { Args: never; Returns: undefined }
      widget_action: {
        Args: {
          p_action: string
          p_key: string
          p_km?: number
          p_service?: string
          p_title?: string
          p_vehicle: string
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
