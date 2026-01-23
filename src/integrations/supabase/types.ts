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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      adjustments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          month: string
          note: string | null
          rep_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          month: string
          note?: string | null
          rep_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          month?: string
          note?: string | null
          rep_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "adjustments_rep_id_fkey"
            columns: ["rep_id"]
            isOneToOne: false
            referencedRelation: "reps"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          created_at: string | null
          id: string
          key: string
          updated_at: string | null
          value: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          key: string
          updated_at?: string | null
          value?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          key?: string
          updated_at?: string | null
          value?: string | null
        }
        Relationships: []
      }
      commission_levels: {
        Row: {
          commission_percent: number
          created_at: string
          description: string | null
          display_name: string
          level: Database["public"]["Enums"]["commission_level"]
        }
        Insert: {
          commission_percent: number
          created_at?: string
          description?: string | null
          display_name: string
          level: Database["public"]["Enums"]["commission_level"]
        }
        Update: {
          commission_percent?: number
          created_at?: string
          description?: string | null
          display_name?: string
          level?: Database["public"]["Enums"]["commission_level"]
        }
        Relationships: []
      }
      deal_commissions: {
        Row: {
          commission_amount: number
          commission_percent: number
          commission_type: Database["public"]["Enums"]["commission_type"]
          created_at: string
          deal_id: string
          id: string
          paid: boolean
          paid_date: string | null
          rep_id: string
          updated_at: string
        }
        Insert: {
          commission_amount?: number
          commission_percent?: number
          commission_type: Database["public"]["Enums"]["commission_type"]
          created_at?: string
          deal_id: string
          id?: string
          paid?: boolean
          paid_date?: string | null
          rep_id: string
          updated_at?: string
        }
        Update: {
          commission_amount?: number
          commission_percent?: number
          commission_type?: Database["public"]["Enums"]["commission_type"]
          created_at?: string
          deal_id?: string
          id?: string
          paid?: boolean
          paid_date?: string | null
          rep_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_commissions_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_commissions_rep_id_fkey"
            columns: ["rep_id"]
            isOneToOne: false
            referencedRelation: "reps"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_photos: {
        Row: {
          created_at: string
          deal_id: string
          description: string | null
          file_name: string
          file_type: string | null
          file_url: string
          id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          deal_id: string
          description?: string | null
          file_name: string
          file_type?: string | null
          file_url: string
          id?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          deal_id?: string
          description?: string | null
          file_name?: string
          file_type?: string | null
          file_url?: string
          id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_photos_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          address: string
          city: string | null
          completion_date: string | null
          completion_images: string[] | null
          contract_signed: boolean | null
          created_at: string
          homeowner_email: string | null
          homeowner_name: string
          homeowner_phone: string | null
          id: string
          install_date: string | null
          install_images: string[] | null
          notes: string | null
          payment_requested: boolean | null
          payment_requested_at: string | null
          permit_file_url: string | null
          signature_date: string | null
          signature_url: string | null
          signed_date: string | null
          state: string | null
          status: Database["public"]["Enums"]["deal_status"]
          total_price: number
          updated_at: string
          zip_code: string | null
        }
        Insert: {
          address: string
          city?: string | null
          completion_date?: string | null
          completion_images?: string[] | null
          contract_signed?: boolean | null
          created_at?: string
          homeowner_email?: string | null
          homeowner_name: string
          homeowner_phone?: string | null
          id?: string
          install_date?: string | null
          install_images?: string[] | null
          notes?: string | null
          payment_requested?: boolean | null
          payment_requested_at?: string | null
          permit_file_url?: string | null
          signature_date?: string | null
          signature_url?: string | null
          signed_date?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["deal_status"]
          total_price?: number
          updated_at?: string
          zip_code?: string | null
        }
        Update: {
          address?: string
          city?: string | null
          completion_date?: string | null
          completion_images?: string[] | null
          contract_signed?: boolean | null
          created_at?: string
          homeowner_email?: string | null
          homeowner_name?: string
          homeowner_phone?: string | null
          id?: string
          install_date?: string | null
          install_images?: string[] | null
          notes?: string | null
          payment_requested?: boolean | null
          payment_requested_at?: string | null
          permit_file_url?: string | null
          signature_date?: string | null
          signature_url?: string | null
          signed_date?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["deal_status"]
          total_price?: number
          updated_at?: string
          zip_code?: string | null
        }
        Relationships: []
      }
      import_rows_raw: {
        Row: {
          created_at: string
          id: string
          import_id: string
          matched_merchant_id: string | null
          merchant_identifier: string | null
          profit: number | null
          raw_data: Json | null
        }
        Insert: {
          created_at?: string
          id?: string
          import_id: string
          matched_merchant_id?: string | null
          merchant_identifier?: string | null
          profit?: number | null
          raw_data?: Json | null
        }
        Update: {
          created_at?: string
          id?: string
          import_id?: string
          matched_merchant_id?: string | null
          merchant_identifier?: string | null
          profit?: number | null
          raw_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "import_rows_raw_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_rows_raw_matched_merchant_id_fkey"
            columns: ["matched_merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      imports: {
        Row: {
          created_at: string
          file_name: string
          id: string
          month: string
          row_count: number | null
          status: string
          total_payouts: number | null
          total_profit: number | null
          unmatched_count: number | null
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          id?: string
          month: string
          row_count?: number | null
          status?: string
          total_payouts?: number | null
          total_profit?: number | null
          unmatched_count?: number | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          id?: string
          month?: string
          row_count?: number | null
          status?: string
          total_payouts?: number | null
          total_profit?: number | null
          unmatched_count?: number | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      merchant_aliases: {
        Row: {
          alias: string
          created_at: string
          id: string
          merchant_id: string
        }
        Insert: {
          alias: string
          created_at?: string
          id?: string
          merchant_id: string
        }
        Update: {
          alias?: string
          created_at?: string
          id?: string
          merchant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_aliases_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_assignments: {
        Row: {
          created_at: string
          effective_from: string | null
          effective_to: string | null
          id: string
          level_override: Database["public"]["Enums"]["commission_level"] | null
          merchant_id: string
          percent_override: number | null
          rep_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          level_override?:
            | Database["public"]["Enums"]["commission_level"]
            | null
          merchant_id: string
          percent_override?: number | null
          rep_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          level_override?:
            | Database["public"]["Enums"]["commission_level"]
            | null
          merchant_id?: string
          percent_override?: number | null
          rep_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_assignments_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_assignments_rep_id_fkey"
            columns: ["rep_id"]
            isOneToOne: false
            referencedRelation: "reps"
            referencedColumns: ["id"]
          },
        ]
      }
      merchants: {
        Row: {
          created_at: string
          id: string
          mid: string | null
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          mid?: string | null
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          mid?: string | null
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      payout_rows: {
        Row: {
          created_at: string
          id: string
          import_id: string
          merchant_id: string
          month: string
          payout_amount: number
          percent_used: number
          profit: number
          rep_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          import_id: string
          merchant_id: string
          month: string
          payout_amount: number
          percent_used: number
          profit: number
          rep_id: string
        }
        Update: {
          created_at?: string
          id?: string
          import_id?: string
          merchant_id?: string
          month?: string
          payout_amount?: number
          percent_used?: number
          profit?: number
          rep_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payout_rows_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_rows_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_rows_rep_id_fkey"
            columns: ["rep_id"]
            isOneToOne: false
            referencedRelation: "reps"
            referencedColumns: ["id"]
          },
        ]
      }
      pin_documents: {
        Row: {
          created_at: string
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          pin_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          pin_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          pin_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pin_documents_pin_id_fkey"
            columns: ["pin_id"]
            isOneToOne: false
            referencedRelation: "rep_pins"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      rep_pins: {
        Row: {
          address: string | null
          appointment_date: string | null
          created_at: string
          deal_id: string | null
          homeowner_name: string | null
          id: string
          latitude: number
          longitude: number
          notes: string | null
          rep_id: string
          status: Database["public"]["Enums"]["pin_status"]
          updated_at: string
        }
        Insert: {
          address?: string | null
          appointment_date?: string | null
          created_at?: string
          deal_id?: string | null
          homeowner_name?: string | null
          id?: string
          latitude: number
          longitude: number
          notes?: string | null
          rep_id: string
          status?: Database["public"]["Enums"]["pin_status"]
          updated_at?: string
        }
        Update: {
          address?: string | null
          appointment_date?: string | null
          created_at?: string
          deal_id?: string | null
          homeowner_name?: string | null
          id?: string
          latitude?: number
          longitude?: number
          notes?: string | null
          rep_id?: string
          status?: Database["public"]["Enums"]["pin_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rep_pins_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rep_pins_rep_id_fkey"
            columns: ["rep_id"]
            isOneToOne: false
            referencedRelation: "reps"
            referencedColumns: ["id"]
          },
        ]
      }
      reps: {
        Row: {
          commission_level: Database["public"]["Enums"]["commission_level"]
          created_at: string
          default_commission_percent: number
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          commission_level?: Database["public"]["Enums"]["commission_level"]
          created_at?: string
          default_commission_percent?: number
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          commission_level?: Database["public"]["Enums"]["commission_level"]
          created_at?: string
          default_commission_percent?: number
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_address_exists: {
        Args: { check_address: string }
        Returns: {
          exists_already: boolean
          owner_rep_id: string
        }[]
      }
      create_deal_from_pin: {
        Args: {
          _homeowner_email?: string
          _homeowner_phone?: string
          _pin_id: string
        }
        Returns: string
      }
      get_rep_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "rep"
      commission_level: "bronze" | "silver" | "gold" | "platinum" | "diamond"
      commission_type: "setter" | "closer" | "self_gen"
      deal_status:
        | "lead"
        | "signed"
        | "permit"
        | "install_scheduled"
        | "installed"
        | "complete"
        | "paid"
        | "cancelled"
      pin_status: "lead" | "followup" | "installed" | "appointment"
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
    Enums: {
      app_role: ["admin", "rep"],
      commission_level: ["bronze", "silver", "gold", "platinum", "diamond"],
      commission_type: ["setter", "closer", "self_gen"],
      deal_status: [
        "lead",
        "signed",
        "permit",
        "install_scheduled",
        "installed",
        "complete",
        "paid",
        "cancelled",
      ],
      pin_status: ["lead", "followup", "installed", "appointment"],
    },
  },
} as const
