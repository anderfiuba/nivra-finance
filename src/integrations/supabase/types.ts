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
      category_budgets: {
        Row: {
          alert_threshold: number
          category_label: string
          created_at: string
          id: string
          monthly_limit: number
          updated_at: string
          user_id: string
        }
        Insert: {
          alert_threshold?: number
          category_label: string
          created_at?: string
          id?: string
          monthly_limit: number
          updated_at?: string
          user_id: string
        }
        Update: {
          alert_threshold?: number
          category_label?: string
          created_at?: string
          id?: string
          monthly_limit?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pluggy_accounts: {
        Row: {
          automatically_invested_balance: number | null
          available_credit_limit: number | null
          balance: number
          balance_close_date: string | null
          balance_due_date: string | null
          bank_overdraft_limit: number | null
          bank_overdraft_used: number | null
          card_brand: string | null
          card_level: string | null
          card_number_last4: string | null
          created_at: string
          credit_limit: number | null
          currency: string
          id: string
          marketing_name: string | null
          minimum_payment: number | null
          name: string
          owner: string | null
          pluggy_account_id: string
          pluggy_item_id: string
          raw_payload: Json | null
          subtype: string | null
          tax_number: string | null
          type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          automatically_invested_balance?: number | null
          available_credit_limit?: number | null
          balance?: number
          balance_close_date?: string | null
          balance_due_date?: string | null
          bank_overdraft_limit?: number | null
          bank_overdraft_used?: number | null
          card_brand?: string | null
          card_level?: string | null
          card_number_last4?: string | null
          created_at?: string
          credit_limit?: number | null
          currency?: string
          id?: string
          marketing_name?: string | null
          minimum_payment?: number | null
          name: string
          owner?: string | null
          pluggy_account_id: string
          pluggy_item_id: string
          raw_payload?: Json | null
          subtype?: string | null
          tax_number?: string | null
          type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          automatically_invested_balance?: number | null
          available_credit_limit?: number | null
          balance?: number
          balance_close_date?: string | null
          balance_due_date?: string | null
          bank_overdraft_limit?: number | null
          bank_overdraft_used?: number | null
          card_brand?: string | null
          card_level?: string | null
          card_number_last4?: string | null
          created_at?: string
          credit_limit?: number | null
          currency?: string
          id?: string
          marketing_name?: string | null
          minimum_payment?: number | null
          name?: string
          owner?: string | null
          pluggy_account_id?: string
          pluggy_item_id?: string
          raw_payload?: Json | null
          subtype?: string | null
          tax_number?: string | null
          type?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pluggy_bills: {
        Row: {
          allows_installments: boolean | null
          created_at: string
          due_date: string | null
          id: string
          minimum_payment_amount: number | null
          paid: boolean | null
          pluggy_account_id: string
          pluggy_bill_id: string
          pluggy_item_id: string
          raw_payload: Json | null
          total_amount: number | null
          total_amount_currency: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          allows_installments?: boolean | null
          created_at?: string
          due_date?: string | null
          id?: string
          minimum_payment_amount?: number | null
          paid?: boolean | null
          pluggy_account_id: string
          pluggy_bill_id: string
          pluggy_item_id: string
          raw_payload?: Json | null
          total_amount?: number | null
          total_amount_currency?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          allows_installments?: boolean | null
          created_at?: string
          due_date?: string | null
          id?: string
          minimum_payment_amount?: number | null
          paid?: boolean | null
          pluggy_account_id?: string
          pluggy_bill_id?: string
          pluggy_item_id?: string
          raw_payload?: Json | null
          total_amount?: number | null
          total_amount_currency?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pluggy_categories: {
        Row: {
          description: string
          description_translated: string | null
          id: string
          parent_description: string | null
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          description: string
          description_translated?: string | null
          id: string
          parent_description?: string | null
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          description?: string
          description_translated?: string | null
          id?: string
          parent_description?: string | null
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      pluggy_items: {
        Row: {
          client_user_id: string
          connector_id: number | null
          connector_image_url: string | null
          connector_name: string
          connector_primary_color: string | null
          created_at: string
          execution_status: string | null
          id: string
          last_synced_at: string | null
          pluggy_item_id: string
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          client_user_id: string
          connector_id?: number | null
          connector_image_url?: string | null
          connector_name: string
          connector_primary_color?: string | null
          created_at?: string
          execution_status?: string | null
          id?: string
          last_synced_at?: string | null
          pluggy_item_id: string
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          client_user_id?: string
          connector_id?: number | null
          connector_image_url?: string | null
          connector_name?: string
          connector_primary_color?: string | null
          created_at?: string
          execution_status?: string | null
          id?: string
          last_synced_at?: string | null
          pluggy_item_id?: string
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pluggy_transactions: {
        Row: {
          account_currency: string | null
          amount: number
          amount_in_account_currency: number | null
          category: string | null
          category_id: string | null
          category_parent_id: string | null
          category_pluggy: string | null
          created_at: string
          currency: string
          description: string
          id: string
          installment_number: number | null
          merchant_name: string | null
          operation_type: string | null
          payment_method: string | null
          pluggy_account_id: string
          pluggy_item_id: string
          pluggy_transaction_id: string
          raw_payload: Json | null
          status: string | null
          total_installments: number | null
          transaction_date: string
          type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_currency?: string | null
          amount: number
          amount_in_account_currency?: number | null
          category?: string | null
          category_id?: string | null
          category_parent_id?: string | null
          category_pluggy?: string | null
          created_at?: string
          currency?: string
          description: string
          id?: string
          installment_number?: number | null
          merchant_name?: string | null
          operation_type?: string | null
          payment_method?: string | null
          pluggy_account_id: string
          pluggy_item_id: string
          pluggy_transaction_id: string
          raw_payload?: Json | null
          status?: string | null
          total_installments?: number | null
          transaction_date: string
          type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_currency?: string | null
          amount?: number
          amount_in_account_currency?: number | null
          category?: string | null
          category_id?: string | null
          category_parent_id?: string | null
          category_pluggy?: string | null
          created_at?: string
          currency?: string
          description?: string
          id?: string
          installment_number?: number | null
          merchant_name?: string | null
          operation_type?: string | null
          payment_method?: string | null
          pluggy_account_id?: string
          pluggy_item_id?: string
          pluggy_transaction_id?: string
          raw_payload?: Json | null
          status?: string | null
          total_installments?: number | null
          transaction_date?: string
          type?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
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
