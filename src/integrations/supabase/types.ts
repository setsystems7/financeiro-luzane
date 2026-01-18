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
      ai_conversations: {
        Row: {
          context_data: Json | null
          created_at: string
          id: string
          messages: Json | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          context_data?: Json | null
          created_at?: string
          id?: string
          messages?: Json | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          context_data?: Json | null
          created_at?: string
          id?: string
          messages?: Json | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      colors: {
        Row: {
          created_at: string
          hex_code: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          hex_code?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          hex_code?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      demand_forecasts: {
        Row: {
          actual_quantity: number | null
          confidence_level: number | null
          created_at: string
          forecast_date: string
          id: string
          predicted_daily_quantity: number
          predicted_monthly_quantity: number
          product_id: string
          seasonality_index: number | null
          trend_direction: string | null
        }
        Insert: {
          actual_quantity?: number | null
          confidence_level?: number | null
          created_at?: string
          forecast_date: string
          id?: string
          predicted_daily_quantity?: number
          predicted_monthly_quantity?: number
          product_id: string
          seasonality_index?: number | null
          trend_direction?: string | null
        }
        Update: {
          actual_quantity?: number | null
          confidence_level?: number | null
          created_at?: string
          forecast_date?: string
          id?: string
          predicted_daily_quantity?: number
          predicted_monthly_quantity?: number
          product_id?: string
          seasonality_index?: number | null
          trend_direction?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "demand_forecasts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      exchange_items: {
        Row: {
          created_at: string
          exchange_id: string
          id: string
          product_id: string | null
          product_name: string
          product_size_id: string | null
          quantity: number
          returned_to_stock: boolean | null
          size: string | null
          unit_price: number
        }
        Insert: {
          created_at?: string
          exchange_id: string
          id?: string
          product_id?: string | null
          product_name: string
          product_size_id?: string | null
          quantity: number
          returned_to_stock?: boolean | null
          size?: string | null
          unit_price: number
        }
        Update: {
          created_at?: string
          exchange_id?: string
          id?: string
          product_id?: string | null
          product_name?: string
          product_size_id?: string | null
          quantity?: number
          returned_to_stock?: boolean | null
          size?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "exchange_items_exchange_id_fkey"
            columns: ["exchange_id"]
            isOneToOne: false
            referencedRelation: "exchanges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exchange_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exchange_items_product_size_id_fkey"
            columns: ["product_size_id"]
            isOneToOne: false
            referencedRelation: "product_sizes"
            referencedColumns: ["id"]
          },
        ]
      }
      exchanges: {
        Row: {
          created_at: string
          credit_amount: number
          credit_used: number | null
          customer_name: string | null
          customer_phone: string | null
          id: string
          is_active: boolean | null
          original_sale_id: string | null
          reason: string | null
          used_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          credit_amount?: number
          credit_used?: number | null
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          is_active?: boolean | null
          original_sale_id?: string | null
          reason?: string | null
          used_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          credit_amount?: number
          credit_used?: number | null
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          is_active?: boolean | null
          original_sale_id?: string | null
          reason?: string | null
          used_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exchanges_original_sale_id_fkey"
            columns: ["original_sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: string | null
          created_at: string
          description: string
          due_date: string
          id: string
          notes: string | null
          paid_date: string | null
          status: Database["public"]["Enums"]["expense_status"] | null
          supplier_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          amount: number
          category?: string | null
          created_at?: string
          description: string
          due_date: string
          id?: string
          notes?: string | null
          paid_date?: string | null
          status?: Database["public"]["Enums"]["expense_status"] | null
          supplier_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string
          description?: string
          due_date?: string
          id?: string
          notes?: string | null
          paid_date?: string | null
          status?: Database["public"]["Enums"]["expense_status"] | null
          supplier_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      fiado_payments: {
        Row: {
          amount: number
          created_at: string
          fiado_sale_id: string
          id: string
          notes: string | null
          payment_method: string | null
          user_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          fiado_sale_id: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          fiado_sale_id?: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fiado_payments_fiado_sale_id_fkey"
            columns: ["fiado_sale_id"]
            isOneToOne: false
            referencedRelation: "fiado_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      fiado_sale_items: {
        Row: {
          created_at: string
          fiado_sale_id: string
          id: string
          product_id: string | null
          product_name: string
          product_size_id: string | null
          quantity: number
          size: string | null
          total: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          fiado_sale_id: string
          id?: string
          product_id?: string | null
          product_name: string
          product_size_id?: string | null
          quantity: number
          size?: string | null
          total: number
          unit_price: number
        }
        Update: {
          created_at?: string
          fiado_sale_id?: string
          id?: string
          product_id?: string | null
          product_name?: string
          product_size_id?: string | null
          quantity?: number
          size?: string | null
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "fiado_sale_items_fiado_sale_id_fkey"
            columns: ["fiado_sale_id"]
            isOneToOne: false
            referencedRelation: "fiado_sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiado_sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiado_sale_items_product_size_id_fkey"
            columns: ["product_size_id"]
            isOneToOne: false
            referencedRelation: "product_sizes"
            referencedColumns: ["id"]
          },
        ]
      }
      fiado_sales: {
        Row: {
          amount_paid: number
          amount_pending: number
          approved_at: string | null
          approved_by: string | null
          created_at: string
          customer_cpf: string | null
          customer_name: string
          customer_phone: string | null
          id: string
          installments: number
          notes: string | null
          status: string
          total: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          amount_paid?: number
          amount_pending?: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          customer_cpf?: string | null
          customer_name: string
          customer_phone?: string | null
          id?: string
          installments?: number
          notes?: string | null
          status?: string
          total?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          amount_paid?: number
          amount_pending?: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          customer_cpf?: string | null
          customer_name?: string
          customer_phone?: string | null
          id?: string
          installments?: number
          notes?: string | null
          status?: string
          total?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      price_history: {
        Row: {
          created_at: string
          id: string
          new_cost_price: number | null
          new_sale_price: number | null
          old_cost_price: number | null
          old_sale_price: number | null
          product_id: string
          reason: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          new_cost_price?: number | null
          new_sale_price?: number | null
          old_cost_price?: number | null
          old_sale_price?: number | null
          product_id: string
          reason?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          new_cost_price?: number | null
          new_sale_price?: number | null
          old_cost_price?: number | null
          old_sale_price?: number | null
          product_id?: string
          reason?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "price_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_sizes: {
        Row: {
          barcode: string | null
          created_at: string
          id: string
          product_id: string
          quantity: number
          size: string
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          created_at?: string
          id?: string
          product_id: string
          quantity?: number
          size: string
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          size?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_sizes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          barcode: string | null
          category_id: string | null
          color_id: string | null
          cost_price: number
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          markup: number | null
          min_stock: number
          name: string
          photo_url: string | null
          sale_price: number
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          category_id?: string | null
          color_id?: string | null
          cost_price?: number
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          markup?: number | null
          min_stock?: number
          name: string
          photo_url?: string | null
          sale_price?: number
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          category_id?: string | null
          color_id?: string | null
          cost_price?: number
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          markup?: number | null
          min_stock?: number
          name?: string
          photo_url?: string | null
          sale_price?: number
          supplier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_color_id_fkey"
            columns: ["color_id"]
            isOneToOne: false
            referencedRelation: "colors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          role: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          role?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          role?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      purchase_suggestions: {
        Row: {
          created_at: string
          current_stock: number | null
          daily_demand: number | null
          days_until_stockout: number | null
          estimated_cost: number | null
          id: string
          notes: string | null
          product_id: string
          status: Database["public"]["Enums"]["suggestion_status"] | null
          suggested_order_date: string | null
          suggested_quantity: number
          supplier_id: string | null
          updated_at: string
          urgency: Database["public"]["Enums"]["urgency_level"] | null
        }
        Insert: {
          created_at?: string
          current_stock?: number | null
          daily_demand?: number | null
          days_until_stockout?: number | null
          estimated_cost?: number | null
          id?: string
          notes?: string | null
          product_id: string
          status?: Database["public"]["Enums"]["suggestion_status"] | null
          suggested_order_date?: string | null
          suggested_quantity?: number
          supplier_id?: string | null
          updated_at?: string
          urgency?: Database["public"]["Enums"]["urgency_level"] | null
        }
        Update: {
          created_at?: string
          current_stock?: number | null
          daily_demand?: number | null
          days_until_stockout?: number | null
          estimated_cost?: number | null
          id?: string
          notes?: string | null
          product_id?: string
          status?: Database["public"]["Enums"]["suggestion_status"] | null
          suggested_order_date?: string | null
          suggested_quantity?: number
          supplier_id?: string | null
          updated_at?: string
          urgency?: Database["public"]["Enums"]["urgency_level"] | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_suggestions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_suggestions_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      receivables: {
        Row: {
          amount: number
          created_at: string
          description: string
          due_date: string
          fee: number | null
          id: string
          is_received: boolean | null
          net_amount: number
          notes: string | null
          received_date: string | null
          sale_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          description: string
          due_date: string
          fee?: number | null
          id?: string
          is_received?: boolean | null
          net_amount: number
          notes?: string | null
          received_date?: string | null
          sale_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          due_date?: string
          fee?: number | null
          id?: string
          is_received?: boolean | null
          net_amount?: number
          notes?: string | null
          received_date?: string | null
          sale_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "receivables_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      restock_settings: {
        Row: {
          abc_class: Database["public"]["Enums"]["abc_class"] | null
          created_at: string
          economic_order_qty: number | null
          id: string
          last_calculated_at: string | null
          lead_time_days: number | null
          min_stock_override: number | null
          product_id: string
          reorder_point: number | null
          safety_stock_multiplier: number | null
          updated_at: string
          xyz_class: Database["public"]["Enums"]["xyz_class"] | null
        }
        Insert: {
          abc_class?: Database["public"]["Enums"]["abc_class"] | null
          created_at?: string
          economic_order_qty?: number | null
          id?: string
          last_calculated_at?: string | null
          lead_time_days?: number | null
          min_stock_override?: number | null
          product_id: string
          reorder_point?: number | null
          safety_stock_multiplier?: number | null
          updated_at?: string
          xyz_class?: Database["public"]["Enums"]["xyz_class"] | null
        }
        Update: {
          abc_class?: Database["public"]["Enums"]["abc_class"] | null
          created_at?: string
          economic_order_qty?: number | null
          id?: string
          last_calculated_at?: string | null
          lead_time_days?: number | null
          min_stock_override?: number | null
          product_id?: string
          reorder_point?: number | null
          safety_stock_multiplier?: number | null
          updated_at?: string
          xyz_class?: Database["public"]["Enums"]["xyz_class"] | null
        }
        Relationships: [
          {
            foreignKeyName: "restock_settings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          created_at: string
          id: string
          product_id: string | null
          product_name: string
          product_size_id: string | null
          quantity: number
          sale_id: string
          size: string | null
          total: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          product_id?: string | null
          product_name: string
          product_size_id?: string | null
          quantity: number
          sale_id: string
          size?: string | null
          total: number
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string | null
          product_name?: string
          product_size_id?: string | null
          quantity?: number
          sale_id?: string
          size?: string | null
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_product_size_id_fkey"
            columns: ["product_size_id"]
            isOneToOne: false
            referencedRelation: "product_sizes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          card_brand: string | null
          card_fee_amount: number | null
          card_fee_percent: number | null
          created_at: string
          customer_name: string | null
          customer_phone: string | null
          discount: number | null
          final_total: number
          id: string
          installments: number | null
          net_amount: number | null
          notes: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          sale_number: number
          status: Database["public"]["Enums"]["sale_status"] | null
          total: number
          user_id: string | null
        }
        Insert: {
          card_brand?: string | null
          card_fee_amount?: number | null
          card_fee_percent?: number | null
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          discount?: number | null
          final_total?: number
          id?: string
          installments?: number | null
          net_amount?: number | null
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          sale_number?: number
          status?: Database["public"]["Enums"]["sale_status"] | null
          total?: number
          user_id?: string | null
        }
        Update: {
          card_brand?: string | null
          card_fee_amount?: number | null
          card_fee_percent?: number | null
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          discount?: number | null
          final_total?: number
          id?: string
          installments?: number | null
          net_amount?: number | null
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          sale_number?: number
          status?: Database["public"]["Enums"]["sale_status"] | null
          total?: number
          user_id?: string | null
        }
        Relationships: []
      }
      stock_movements: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          product_id: string
          product_size_id: string | null
          quantity: number
          type: Database["public"]["Enums"]["stock_movement_type"]
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          product_id: string
          product_size_id?: string | null
          quantity: number
          type: Database["public"]["Enums"]["stock_movement_type"]
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          product_id?: string
          product_size_id?: string | null
          quantity?: number
          type?: Database["public"]["Enums"]["stock_movement_type"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_size_id_fkey"
            columns: ["product_size_id"]
            isOneToOne: false
            referencedRelation: "product_sizes"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          contact_name: string | null
          created_at: string
          default_lead_time_days: number | null
          email: string | null
          id: string
          min_order_value: number | null
          name: string
          notes: string | null
          order_cost: number | null
          phone: string | null
          reliability_score: number | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          contact_name?: string | null
          created_at?: string
          default_lead_time_days?: number | null
          email?: string | null
          id?: string
          min_order_value?: number | null
          name: string
          notes?: string | null
          order_cost?: number | null
          phone?: string | null
          reliability_score?: number | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          contact_name?: string | null
          created_at?: string
          default_lead_time_days?: number | null
          email?: string | null
          id?: string
          min_order_value?: number | null
          name?: string
          notes?: string | null
          order_cost?: number | null
          phone?: string | null
          reliability_score?: number | null
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
      abc_class: "A" | "B" | "C"
      expense_status: "pendente" | "pago" | "vencido"
      payment_method:
        | "dinheiro"
        | "cartao_credito"
        | "cartao_debito"
        | "pix"
        | "crediario"
      sale_status: "concluida" | "cancelada" | "trocada"
      stock_movement_type: "entrada" | "saida" | "ajuste"
      suggestion_status: "pending" | "ordered" | "ignored"
      urgency_level: "critical" | "high" | "medium" | "low"
      xyz_class: "X" | "Y" | "Z"
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
      abc_class: ["A", "B", "C"],
      expense_status: ["pendente", "pago", "vencido"],
      payment_method: [
        "dinheiro",
        "cartao_credito",
        "cartao_debito",
        "pix",
        "crediario",
      ],
      sale_status: ["concluida", "cancelada", "trocada"],
      stock_movement_type: ["entrada", "saida", "ajuste"],
      suggestion_status: ["pending", "ordered", "ignored"],
      urgency_level: ["critical", "high", "medium", "low"],
      xyz_class: ["X", "Y", "Z"],
    },
  },
} as const
