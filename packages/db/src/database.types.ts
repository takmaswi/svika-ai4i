// Generated from the live Svika schema (project xbsawnsdvibarhjobvrm) via the
// Supabase type generator. Do not edit by hand; regenerate after migrations.
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
      board_codes: {
        Row: {
          code: string
          created_at: string
          direction: Database["public"]["Enums"]["route_direction"]
          id: string
          route_id: string
          ticket_id: string
          valid_from: string
          valid_until: string
        }
        Insert: {
          code: string
          created_at?: string
          direction: Database["public"]["Enums"]["route_direction"]
          id?: string
          route_id: string
          ticket_id: string
          valid_from?: string
          valid_until: string
        }
        Update: {
          code?: string
          created_at?: string
          direction?: Database["public"]["Enums"]["route_direction"]
          id?: string
          route_id?: string
          ticket_id?: string
          valid_from?: string
          valid_until?: string
        }
        Relationships: [
          {
            foreignKeyName: "board_codes_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "board_codes_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: true
            referencedRelation: "ticket_status"
            referencedColumns: ["ticket_id"]
          },
          {
            foreignKeyName: "board_codes_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: true
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      code_redemption_attempts: {
        Row: {
          attempted_at: string
          code_entered: string
          conductor_id: string
          direction: Database["public"]["Enums"]["route_direction"] | null
          id: number
          outcome: string
          route_id: string | null
          ticket_id: string | null
        }
        Insert: {
          attempted_at?: string
          code_entered: string
          conductor_id: string
          direction?: Database["public"]["Enums"]["route_direction"] | null
          id?: never
          outcome: string
          route_id?: string | null
          ticket_id?: string | null
        }
        Update: {
          attempted_at?: string
          code_entered?: string
          conductor_id?: string
          direction?: Database["public"]["Enums"]["route_direction"] | null
          id?: never
          outcome?: string
          route_id?: string | null
          ticket_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "code_redemption_attempts_conductor_id_fkey"
            columns: ["conductor_id"]
            isOneToOne: false
            referencedRelation: "conductors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "code_redemption_attempts_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "code_redemption_attempts_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "ticket_status"
            referencedColumns: ["ticket_id"]
          },
          {
            foreignKeyName: "code_redemption_attempts_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      conductors: {
        Row: {
          active: boolean
          commission_rate_bps: number
          created_at: string
          id: string
          owner_id: string
          profile_id: string
        }
        Insert: {
          active?: boolean
          commission_rate_bps?: number
          created_at?: string
          id?: string
          owner_id: string
          profile_id: string
        }
        Update: {
          active?: boolean
          commission_rate_bps?: number
          created_at?: string
          id?: string
          owner_id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conductors_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conductors_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_accounts: {
        Row: {
          created_at: string
          currency: string
          id: string
          kind: Database["public"]["Enums"]["ledger_account_kind"]
          profile_id: string | null
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: string
          kind: Database["public"]["Enums"]["ledger_account_kind"]
          profile_id?: string | null
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          kind?: Database["public"]["Enums"]["ledger_account_kind"]
          profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ledger_accounts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_postings: {
        Row: {
          account_id: string
          amount_cents: number
          created_at: string
          id: number
          transaction_id: string
        }
        Insert: {
          account_id: string
          amount_cents: number
          created_at?: string
          id?: never
          transaction_id: string
        }
        Update: {
          account_id?: string
          amount_cents?: number
          created_at?: string
          id?: never
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledger_postings_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "ledger_postings_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ledger_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_postings_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "ledger_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_transactions: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          kind: Database["public"]["Enums"]["ledger_txn_kind"]
          memo: string | null
          ticket_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          kind: Database["public"]["Enums"]["ledger_txn_kind"]
          memo?: string | null
          ticket_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["ledger_txn_kind"]
          memo?: string | null
          ticket_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ledger_transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_transactions_ticket_fk"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "ticket_status"
            referencedColumns: ["ticket_id"]
          },
          {
            foreignKeyName: "ledger_transactions_ticket_fk"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      owners: {
        Row: {
          created_at: string
          display_name: string
          id: string
          profile_id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id?: string
          profile_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "owners_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          phone: string | null
          preferred_language: Database["public"]["Enums"]["app_language"]
        }
        Insert: {
          created_at?: string
          full_name?: string
          id: string
          phone?: string | null
          preferred_language?: Database["public"]["Enums"]["app_language"]
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          preferred_language?: Database["public"]["Enums"]["app_language"]
        }
        Relationships: []
      }
      route_fares: {
        Row: {
          created_at: string
          currency: string
          effective_from: string
          fare_cents: number
          id: string
          route_id: string
        }
        Insert: {
          created_at?: string
          currency?: string
          effective_from?: string
          fare_cents: number
          id?: string
          route_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          effective_from?: string
          fare_cents?: number
          id?: string
          route_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "route_fares_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      route_stops: {
        Row: {
          direction: Database["public"]["Enums"]["route_direction"]
          route_id: string
          seq: number
          stop_id: string
        }
        Insert: {
          direction: Database["public"]["Enums"]["route_direction"]
          route_id: string
          seq: number
          stop_id: string
        }
        Update: {
          direction?: Database["public"]["Enums"]["route_direction"]
          route_id?: string
          seq?: number
          stop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "route_stops_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_stops_stop_id_fkey"
            columns: ["stop_id"]
            isOneToOne: false
            referencedRelation: "stops"
            referencedColumns: ["id"]
          },
        ]
      }
      routes: {
        Row: {
          active: boolean
          code: string
          created_at: string
          id: string
          name: string
          name_sn: string | null
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          id?: string
          name: string
          name_sn?: string | null
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          id?: string
          name?: string
          name_sn?: string | null
        }
        Relationships: []
      }
      stops: {
        Row: {
          created_at: string
          id: string
          lat: number
          lng: number
          name: string
          name_sn: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          lat: number
          lng: number
          name: string
          name_sn?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          lat?: number
          lng?: number
          name?: string
          name_sn?: string | null
        }
        Relationships: []
      }
      ticket_events: {
        Row: {
          actor_profile_id: string | null
          conductor_id: string | null
          created_at: string
          detail: Json
          event_type: Database["public"]["Enums"]["ticket_event_type"]
          id: number
          ticket_id: string
          vehicle_id: string | null
        }
        Insert: {
          actor_profile_id?: string | null
          conductor_id?: string | null
          created_at?: string
          detail?: Json
          event_type: Database["public"]["Enums"]["ticket_event_type"]
          id?: never
          ticket_id: string
          vehicle_id?: string | null
        }
        Update: {
          actor_profile_id?: string | null
          conductor_id?: string | null
          created_at?: string
          detail?: Json
          event_type?: Database["public"]["Enums"]["ticket_event_type"]
          id?: never
          ticket_id?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ticket_events_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_events_conductor_id_fkey"
            columns: ["conductor_id"]
            isOneToOne: false
            referencedRelation: "conductors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_events_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "ticket_status"
            referencedColumns: ["ticket_id"]
          },
          {
            foreignKeyName: "ticket_events_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_events_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          currency: string
          direction: Database["public"]["Enums"]["route_direction"]
          fare_cents: number
          id: string
          purchased_at: string
          rider_id: string
          route_id: string
        }
        Insert: {
          currency?: string
          direction: Database["public"]["Enums"]["route_direction"]
          fare_cents: number
          id?: string
          purchased_at?: string
          rider_id: string
          route_id: string
        }
        Update: {
          currency?: string
          direction?: Database["public"]["Enums"]["route_direction"]
          fare_cents?: number
          id?: string
          purchased_at?: string
          rider_id?: string
          route_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          active: boolean
          capacity: number | null
          created_at: string
          id: string
          owner_id: string
          plate: string
        }
        Insert: {
          active?: boolean
          capacity?: number | null
          created_at?: string
          id?: string
          owner_id: string
          plate: string
        }
        Update: {
          active?: boolean
          capacity?: number | null
          created_at?: string
          id?: string
          owner_id?: string
          plate?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      account_balances: {
        Row: {
          account_id: string | null
          balance_cents: number | null
          currency: string | null
          kind: Database["public"]["Enums"]["ledger_account_kind"] | null
          profile_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ledger_accounts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_status: {
        Row: {
          direction: Database["public"]["Enums"]["route_direction"] | null
          fare_cents: number | null
          rider_id: string | null
          route_id: string | null
          status: Database["public"]["Enums"]["ticket_event_type"] | null
          status_at: string | null
          ticket_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tickets_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      current_fare_cents: { Args: { p_route: string }; Returns: number }
      current_owner_id: { Args: never; Returns: string }
      is_party_to_transaction: { Args: { p_txn: string }; Returns: boolean }
      purchase_ticket: {
        Args: {
          p_direction: Database["public"]["Enums"]["route_direction"]
          p_route: string
          p_valid_minutes?: number
        }
        Returns: {
          board_code: string
          fare_cents: number
          ticket_id: string
          valid_until: string
        }[]
      }
      record_topup: {
        Args: { p_amount_cents: number; p_memo?: string; p_profile: string }
        Returns: string
      }
      redeem_board_code: {
        Args: {
          p_code: string
          p_direction: Database["public"]["Enums"]["route_direction"]
          p_route: string
          p_vehicle?: string
        }
        Returns: {
          outcome: string
          ticket_id: string
        }[]
      }
    }
    Enums: {
      app_language: "en" | "sn"
      ledger_account_kind:
        | "rider_wallet"
        | "conductor_wallet"
        | "owner_wallet"
        | "platform_escrow"
        | "platform_fees"
        | "external_cash"
      ledger_txn_kind:
        | "topup"
        | "ticket_purchase"
        | "fare_settlement"
        | "refund"
        | "adjustment"
      route_direction: "outbound" | "inbound"
      ticket_event_type:
        | "issued"
        | "redeemed"
        | "cancelled"
        | "expired"
        | "refunded"
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
      app_language: ["en", "sn"],
      ledger_account_kind: [
        "rider_wallet",
        "conductor_wallet",
        "owner_wallet",
        "platform_escrow",
        "platform_fees",
        "external_cash",
      ],
      ledger_txn_kind: [
        "topup",
        "ticket_purchase",
        "fare_settlement",
        "refund",
        "adjustment",
      ],
      route_direction: ["outbound", "inbound"],
      ticket_event_type: [
        "issued",
        "redeemed",
        "cancelled",
        "expired",
        "refunded",
      ],
    },
  },
} as const
