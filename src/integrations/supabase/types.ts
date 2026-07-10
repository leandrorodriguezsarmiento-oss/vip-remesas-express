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
      banners: {
        Row: {
          active: boolean
          created_at: string
          id: string
          image_url: string
          link_url: string | null
          sort_order: number
          title: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          image_url: string
          link_url?: string | null
          sort_order?: number
          title?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          image_url?: string
          link_url?: string | null
          sort_order?: number
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          read: boolean
          title: string
          tx_id: string | null
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          read?: boolean
          title: string
          tx_id?: string | null
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          read?: boolean
          title?: string
          tx_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_tx_id_fkey"
            columns: ["tx_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          balance_brl: number
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          preferred_language: string
          updated_at: string
        }
        Insert: {
          balance_brl?: number
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          preferred_language?: string
          updated_at?: string
        }
        Update: {
          balance_brl?: number
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          preferred_language?: string
          updated_at?: string
        }
        Relationships: []
      }
      promos: {
        Row: {
          active: boolean
          bonus_label: string | null
          created_at: string
          description: string | null
          ends_at: string | null
          id: string
          image_url: string | null
          price_brl: number
          starts_at: string | null
          title: string
        }
        Insert: {
          active?: boolean
          bonus_label?: string | null
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          image_url?: string | null
          price_brl: number
          starts_at?: string | null
          title: string
        }
        Update: {
          active?: boolean
          bonus_label?: string | null
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          image_url?: string | null
          price_brl?: number
          starts_at?: string | null
          title?: string
        }
        Relationships: []
      }
      rates: {
        Row: {
          active: boolean
          dest_currency: string
          id: string
          method_category: string
          min_amount: number
          origin_country: string
          origin_currency: string
          rate: number
          time_max_minutes: number
          time_min_minutes: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          dest_currency: string
          id?: string
          method_category: string
          min_amount?: number
          origin_country: string
          origin_currency: string
          rate: number
          time_max_minutes?: number
          time_min_minutes?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          dest_currency?: string
          id?: string
          method_category?: string
          min_amount?: number
          origin_country?: string
          origin_currency?: string
          rate?: number
          time_max_minutes?: number
          time_min_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      recargas_config: {
        Row: {
          active: boolean
          api_base_url: string | null
          api_key_name: string | null
          created_at: string
          id: string
          notes: string | null
          provider: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          api_base_url?: string | null
          api_key_name?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          provider?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          api_base_url?: string | null
          api_key_name?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          provider?: string
          updated_at?: string
        }
        Relationships: []
      }
      recipients: {
        Row: {
          account_details: string | null
          country: string
          created_at: string
          delivery_method: string
          full_name: string
          id: string
          phone: string
          user_id: string
        }
        Insert: {
          account_details?: string | null
          country: string
          created_at?: string
          delivery_method: string
          full_name: string
          id?: string
          phone: string
          user_id: string
        }
        Update: {
          account_details?: string | null
          country?: string
          created_at?: string
          delivery_method?: string
          full_name?: string
          id?: string
          phone?: string
          user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount_brl: number
          amount_dest: number
          created_at: string
          delivery_method: string
          dest_currency: string
          destination_country: string
          exchange_rate: number
          fee_brl: number
          id: string
          method_category: string
          notes: string | null
          origin_country: string
          origin_currency: string
          payment_method: string
          pix_code: string | null
          recipient_card: string | null
          recipient_name: string
          recipient_phone: string
          status: Database["public"]["Enums"]["tx_status"]
          total_brl: number
          tracking_id: string
          user_id: string
        }
        Insert: {
          amount_brl: number
          amount_dest: number
          created_at?: string
          delivery_method: string
          dest_currency: string
          destination_country: string
          exchange_rate: number
          fee_brl?: number
          id?: string
          method_category?: string
          notes?: string | null
          origin_country?: string
          origin_currency?: string
          payment_method: string
          pix_code?: string | null
          recipient_card?: string | null
          recipient_name: string
          recipient_phone: string
          status?: Database["public"]["Enums"]["tx_status"]
          total_brl: number
          tracking_id: string
          user_id: string
        }
        Update: {
          amount_brl?: number
          amount_dest?: number
          created_at?: string
          delivery_method?: string
          dest_currency?: string
          destination_country?: string
          exchange_rate?: number
          fee_brl?: number
          id?: string
          method_category?: string
          notes?: string | null
          origin_country?: string
          origin_currency?: string
          payment_method?: string
          pix_code?: string | null
          recipient_card?: string | null
          recipient_name?: string
          recipient_phone?: string
          status?: Database["public"]["Enums"]["tx_status"]
          total_brl?: number
          tracking_id?: string
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
      verification_codes: {
        Row: {
          code: string
          created_at: string
          email: string
          expires_at: string
          id: string
          type: string
          user_id: string
          verified: boolean
        }
        Insert: {
          code: string
          created_at?: string
          email: string
          expires_at: string
          id?: string
          type?: string
          user_id: string
          verified?: boolean
        }
        Update: {
          code?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          type?: string
          user_id?: string
          verified?: boolean
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      tx_status: "pending" | "processing" | "completed" | "rejected"
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
      app_role: ["admin", "user"],
      tx_status: ["pending", "processing", "completed", "rejected"],
    },
  },
} as const
