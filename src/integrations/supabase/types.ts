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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action_type: Database["public"]["Enums"]["activity_action_type"]
          created_at: string
          description: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          action_type: Database["public"]["Enums"]["activity_action_type"]
          created_at?: string
          description: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          action_type?: Database["public"]["Enums"]["activity_action_type"]
          created_at?: string
          description?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      company_settings: {
        Row: {
          address: string
          city: string
          company_description: string | null
          company_name: string
          created_at: string | null
          email: string
          id: string
          logo_height: number | null
          logo_position_x: number | null
          logo_position_y: number | null
          logo_url: string | null
          logo_width: number | null
          payment_terms: string | null
          phone: string
          tva_rate: number
          updated_at: string | null
        }
        Insert: {
          address?: string
          city?: string
          company_description?: string | null
          company_name?: string
          created_at?: string | null
          email?: string
          id?: string
          logo_height?: number | null
          logo_position_x?: number | null
          logo_position_y?: number | null
          logo_url?: string | null
          logo_width?: number | null
          payment_terms?: string | null
          phone?: string
          tva_rate?: number
          updated_at?: string | null
        }
        Update: {
          address?: string
          city?: string
          company_description?: string | null
          company_name?: string
          created_at?: string | null
          email?: string
          id?: string
          logo_height?: number | null
          logo_position_x?: number | null
          logo_position_y?: number | null
          logo_url?: string | null
          logo_width?: number | null
          payment_terms?: string | null
          phone?: string
          tva_rate?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      products: {
        Row: {
          alert_threshold: number
          bars_per_ton: number | null
          bloc_poids: number | null
          bloc_type: string | null
          capacite: number | null
          category: Database["public"]["Enums"]["product_category"]
          created_at: string
          created_by: string | null
          decimal_autorise: boolean | null
          description: string | null
          diametre: string | null
          dimension: string | null
          id: string
          is_active: boolean
          longueur_barre: number | null
          longueur_barre_ft: number | null
          name: string
          price: number
          prix_m2: number | null
          prix_par_barre: number | null
          prix_par_metre: number | null
          puissance: number | null
          purchase_price: number | null
          quantity: number
          sale_type: Database["public"]["Enums"]["sale_type"]
          specifications_techniques: Json | null
          stock_barre: number | null
          stock_boite: number | null
          surface_par_boite: number | null
          type_energie: string | null
          unit: string
          updated_at: string
          vetement_couleur: string | null
          vetement_genre: string | null
          vetement_taille: string | null
          voltage: number | null
        }
        Insert: {
          alert_threshold?: number
          bars_per_ton?: number | null
          bloc_poids?: number | null
          bloc_type?: string | null
          capacite?: number | null
          category: Database["public"]["Enums"]["product_category"]
          created_at?: string
          created_by?: string | null
          decimal_autorise?: boolean | null
          description?: string | null
          diametre?: string | null
          dimension?: string | null
          id?: string
          is_active?: boolean
          longueur_barre?: number | null
          longueur_barre_ft?: number | null
          name: string
          price: number
          prix_m2?: number | null
          prix_par_barre?: number | null
          prix_par_metre?: number | null
          puissance?: number | null
          purchase_price?: number | null
          quantity?: number
          sale_type?: Database["public"]["Enums"]["sale_type"]
          specifications_techniques?: Json | null
          stock_barre?: number | null
          stock_boite?: number | null
          surface_par_boite?: number | null
          type_energie?: string | null
          unit?: string
          updated_at?: string
          vetement_couleur?: string | null
          vetement_genre?: string | null
          vetement_taille?: string | null
          voltage?: number | null
        }
        Update: {
          alert_threshold?: number
          bars_per_ton?: number | null
          bloc_poids?: number | null
          bloc_type?: string | null
          capacite?: number | null
          category?: Database["public"]["Enums"]["product_category"]
          created_at?: string
          created_by?: string | null
          decimal_autorise?: boolean | null
          description?: string | null
          diametre?: string | null
          dimension?: string | null
          id?: string
          is_active?: boolean
          longueur_barre?: number | null
          longueur_barre_ft?: number | null
          name?: string
          price?: number
          prix_m2?: number | null
          prix_par_barre?: number | null
          prix_par_metre?: number | null
          puissance?: number | null
          purchase_price?: number | null
          quantity?: number
          sale_type?: Database["public"]["Enums"]["sale_type"]
          specifications_techniques?: Json | null
          stock_barre?: number | null
          stock_boite?: number | null
          surface_par_boite?: number | null
          type_energie?: string | null
          unit?: string
          updated_at?: string
          vetement_couleur?: string | null
          vetement_genre?: string | null
          vetement_taille?: string | null
          voltage?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sale_items: {
        Row: {
          id: string
          product_id: string
          product_name: string
          profit_amount: number | null
          purchase_price_at_sale: number | null
          quantity: number
          sale_id: string
          subtotal: number
          unit: string | null
          unit_price: number
        }
        Insert: {
          id?: string
          product_id: string
          product_name: string
          profit_amount?: number | null
          purchase_price_at_sale?: number | null
          quantity: number
          sale_id: string
          subtotal: number
          unit?: string | null
          unit_price: number
        }
        Update: {
          id?: string
          product_id?: string
          product_name?: string
          profit_amount?: number | null
          purchase_price_at_sale?: number | null
          quantity?: number
          sale_id?: string
          subtotal?: number
          unit?: string | null
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
          created_at: string
          customer_address: string | null
          customer_name: string | null
          discount_amount: number | null
          discount_type: string | null
          discount_value: number | null
          id: string
          notes: string | null
          payment_method: string | null
          seller_id: string
          subtotal: number
          total_amount: number
        }
        Insert: {
          created_at?: string
          customer_address?: string | null
          customer_name?: string | null
          discount_amount?: number | null
          discount_type?: string | null
          discount_value?: number | null
          id?: string
          notes?: string | null
          payment_method?: string | null
          seller_id: string
          subtotal?: number
          total_amount: number
        }
        Update: {
          created_at?: string
          customer_address?: string | null
          customer_name?: string | null
          discount_amount?: number | null
          discount_type?: string | null
          discount_value?: number | null
          id?: string
          notes?: string | null
          payment_method?: string | null
          seller_id?: string
          subtotal?: number
          total_amount?: number
        }
        Relationships: []
      }
      seller_authorized_categories: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          category: Database["public"]["Enums"]["product_category"]
          id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          category: Database["public"]["Enums"]["product_category"]
          id?: string
          user_id: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          category?: Database["public"]["Enums"]["product_category"]
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      stock_movements: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          movement_type: string
          new_quantity: number
          previous_quantity: number
          product_id: string
          quantity: number
          reason: string | null
          sale_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          movement_type: string
          new_quantity: number
          previous_quantity: number
          product_id: string
          quantity: number
          reason?: string | null
          sale_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          movement_type?: string
          new_quantity?: number
          previous_quantity?: number
          product_id?: string
          quantity?: number
          reason?: string | null
          sale_id?: string | null
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
            foreignKeyName: "stock_movements_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
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
      get_seller_authorized_categories: {
        Args: { _user_id: string }
        Returns: {
          category: Database["public"]["Enums"]["product_category"]
        }[]
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      promote_user_to_admin: { Args: { user_email: string }; Returns: boolean }
    }
    Enums: {
      activity_action_type:
        | "sale_created"
        | "product_added"
        | "product_updated"
        | "product_deleted"
        | "stock_adjusted"
        | "user_approved"
        | "user_deactivated"
        | "settings_updated"
        | "user_login"
        | "user_logout"
        | "user_signup"
        | "user_update_password"
        | "connection_failed"
        | "product_deactivated"
      app_role: "admin" | "seller"
      product_category:
        | "alimentaires"
        | "boissons"
        | "gazeuses"
        | "electronique"
        | "autres"
        | "energie"
        | "ceramique"
        | "fer"
        | "materiaux_de_construction"
        | "blocs"
        | "vetements"
      sale_type: "retail" | "wholesale"
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
      activity_action_type: [
        "sale_created",
        "product_added",
        "product_updated",
        "product_deleted",
        "stock_adjusted",
        "user_approved",
        "user_deactivated",
        "settings_updated",
        "user_login",
        "user_logout",
        "user_signup",
        "user_update_password",
        "connection_failed",
        "product_deactivated",
      ],
      app_role: ["admin", "seller"],
      product_category: [
        "alimentaires",
        "boissons",
        "gazeuses",
        "electronique",
        "autres",
        "energie",
        "ceramique",
        "fer",
        "materiaux_de_construction",
        "blocs",
        "vetements",
      ],
      sale_type: ["retail", "wholesale"],
    },
  },
} as const
