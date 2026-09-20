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
      appointment_access_tokens: {
        Row: {
          appointment_id: string
          created_at: string
          expires_at: string
          id: string
          last_used_at: string | null
          revoked_at: string | null
          token_encrypted: string
          token_hash: string
          updated_at: string
        }
        Insert: {
          appointment_id: string
          created_at?: string
          expires_at: string
          id?: string
          last_used_at?: string | null
          revoked_at?: string | null
          token_encrypted: string
          token_hash: string
          updated_at?: string
        }
        Update: {
          appointment_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          last_used_at?: string | null
          revoked_at?: string | null
          token_encrypted?: string
          token_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_access_tokens_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: true
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_history: {
        Row: {
          actor_type: string
          actor_user_id: string | null
          appointment_id: string
          business_id: string
          created_at: string
          event_key: string | null
          event_type: string
          id: string
          metadata: Json
        }
        Insert: {
          actor_type: string
          actor_user_id?: string | null
          appointment_id: string
          business_id: string
          created_at?: string
          event_key?: string | null
          event_type: string
          id?: string
          metadata?: Json
        }
        Update: {
          actor_type?: string
          actor_user_id?: string | null
          appointment_id?: string
          business_id?: string
          created_at?: string
          event_key?: string | null
          event_type?: string
          id?: string
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "appointment_history_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_history_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          booking_payment_id: string | null
          business_id: string
          created_at: string
          customer_email: string | null
          customer_name: string
          customer_phone: string
          end_time: string
          google_event_id: string | null
          google_integration_id: string | null
          id: string
          notes: string | null
          professional_id: string
          service_id: string
          service_price_cents: number
          start_time: string
          status: string
          whatsapp_consent_at: string | null
          whatsapp_opt_in: boolean
        }
        Insert: {
          booking_payment_id?: string | null
          business_id: string
          created_at?: string
          customer_email?: string | null
          customer_name: string
          customer_phone: string
          end_time: string
          google_event_id?: string | null
          google_integration_id?: string | null
          id?: string
          notes?: string | null
          professional_id: string
          service_id: string
          service_price_cents: number
          start_time: string
          status?: string
          whatsapp_consent_at?: string | null
          whatsapp_opt_in?: boolean
        }
        Update: {
          booking_payment_id?: string | null
          business_id?: string
          created_at?: string
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string
          end_time?: string
          google_event_id?: string | null
          google_integration_id?: string | null
          id?: string
          notes?: string | null
          professional_id?: string
          service_id?: string
          service_price_cents?: number
          start_time?: string
          status?: string
          whatsapp_consent_at?: string | null
          whatsapp_opt_in?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "appointments_booking_payment_id_fkey"
            columns: ["booking_payment_id"]
            isOneToOne: true
            referencedRelation: "booking_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_google_integration_id_fkey"
            columns: ["google_integration_id"]
            isOneToOne: false
            referencedRelation: "calendar_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_payments: {
        Row: {
          amount_cents: number
          appointment_id: string | null
          business_id: string
          created_at: string
          customer_email: string
          customer_name: string
          customer_phone: string
          deposit_percent: number
          end_time: string
          expires_at: string
          external_reference: string
          id: string
          paid_at: string | null
          professional_id: string
          provider: string
          provider_payment_id: string | null
          qr_code: string | null
          service_id: string
          service_price_cents: number
          start_time: string
          status: string
          ticket_url: string | null
          updated_at: string
          whatsapp_consent_at: string | null
          whatsapp_opt_in: boolean
        }
        Insert: {
          amount_cents: number
          appointment_id?: string | null
          business_id: string
          created_at?: string
          customer_email: string
          customer_name: string
          customer_phone: string
          deposit_percent: number
          end_time: string
          expires_at: string
          external_reference: string
          id?: string
          paid_at?: string | null
          professional_id: string
          provider?: string
          provider_payment_id?: string | null
          qr_code?: string | null
          service_id: string
          service_price_cents: number
          start_time: string
          status?: string
          ticket_url?: string | null
          updated_at?: string
          whatsapp_consent_at?: string | null
          whatsapp_opt_in?: boolean
        }
        Update: {
          amount_cents?: number
          appointment_id?: string | null
          business_id?: string
          created_at?: string
          customer_email?: string
          customer_name?: string
          customer_phone?: string
          deposit_percent?: number
          end_time?: string
          expires_at?: string
          external_reference?: string
          id?: string
          paid_at?: string | null
          professional_id?: string
          provider?: string
          provider_payment_id?: string | null
          qr_code?: string | null
          service_id?: string
          service_price_cents?: number
          start_time?: string
          status?: string
          ticket_url?: string | null
          updated_at?: string
          whatsapp_consent_at?: string | null
          whatsapp_opt_in?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "booking_payments_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_payments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_payments_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_payments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      business_hours: {
        Row: {
          business_id: string
          closes_at: string | null
          id: string
          is_closed: boolean
          opens_at: string | null
          weekday: number
        }
        Insert: {
          business_id: string
          closes_at?: string | null
          id?: string
          is_closed?: boolean
          opens_at?: string | null
          weekday: number
        }
        Update: {
          business_id?: string
          closes_at?: string | null
          id?: string
          is_closed?: boolean
          opens_at?: string | null
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "business_hours_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_members: {
        Row: {
          active: boolean
          business_id: string
          created_at: string
          id: string
          joined_at: string
          professional_id: string | null
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          business_id: string
          created_at?: string
          id?: string
          joined_at?: string
          professional_id?: string | null
          role: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          business_id?: string
          created_at?: string
          id?: string
          joined_at?: string
          professional_id?: string | null
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_members_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_members_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          active: boolean
          created_at: string
          deposit_enabled: boolean
          deposit_percent: number
          id: string
          name: string
          owner_id: string
          phone: string | null
          slug: string
          timezone: string
          updated_at: string
          whatsapp_enabled: boolean
          whatsapp_followup_enabled: boolean
          whatsapp_reminder_minutes: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          deposit_enabled?: boolean
          deposit_percent?: number
          id?: string
          name: string
          owner_id: string
          phone?: string | null
          slug: string
          timezone?: string
          updated_at?: string
          whatsapp_enabled?: boolean
          whatsapp_followup_enabled?: boolean
          whatsapp_reminder_minutes?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          deposit_enabled?: boolean
          deposit_percent?: number
          id?: string
          name?: string
          owner_id?: string
          phone?: string | null
          slug?: string
          timezone?: string
          updated_at?: string
          whatsapp_enabled?: boolean
          whatsapp_followup_enabled?: boolean
          whatsapp_reminder_minutes?: number
        }
        Relationships: []
      }
      calendar_integrations: {
        Row: {
          access_token_encrypted: string
          business_id: string
          calendar_id: string
          created_at: string
          expires_at: string
          id: string
          professional_id: string | null
          provider: string
          refresh_token_encrypted: string
          scope: string | null
          updated_at: string
        }
        Insert: {
          access_token_encrypted: string
          business_id: string
          calendar_id?: string
          created_at?: string
          expires_at: string
          id?: string
          professional_id?: string | null
          provider?: string
          refresh_token_encrypted: string
          scope?: string | null
          updated_at?: string
        }
        Update: {
          access_token_encrypted?: string
          business_id?: string
          calendar_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          professional_id?: string | null
          provider?: string
          refresh_token_encrypted?: string
          scope?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_integrations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_integrations_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      mercadopago_integrations: {
        Row: {
          access_token_encrypted: string
          business_id: string
          created_at: string
          expires_at: string
          id: string
          refresh_token_encrypted: string
          scope: string | null
          seller_user_id: string | null
          updated_at: string
        }
        Insert: {
          access_token_encrypted: string
          business_id: string
          created_at?: string
          expires_at: string
          id?: string
          refresh_token_encrypted: string
          scope?: string | null
          seller_user_id?: string | null
          updated_at?: string
        }
        Update: {
          access_token_encrypted?: string
          business_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          refresh_token_encrypted?: string
          scope?: string | null
          seller_user_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mercadopago_integrations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_logs: {
        Row: {
          appointment_id: string | null
          booking_payment_id: string | null
          business_id: string
          channel: string
          created_at: string
          error_message: string | null
          id: string
          notification_type: string
          provider_message_id: string | null
          recipient: string
          status: string
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          booking_payment_id?: string | null
          business_id: string
          channel?: string
          created_at?: string
          error_message?: string | null
          id?: string
          notification_type: string
          provider_message_id?: string | null
          recipient: string
          status: string
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          booking_payment_id?: string | null
          business_id?: string
          channel?: string
          created_at?: string
          error_message?: string | null
          id?: string
          notification_type?: string
          provider_message_id?: string | null
          recipient?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_logs_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_logs_booking_payment_id_fkey"
            columns: ["booking_payment_id"]
            isOneToOne: false
            referencedRelation: "booking_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_logs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_states: {
        Row: {
          business_id: string
          code_verifier_encrypted: string | null
          created_at: string
          expires_at: string
          professional_id: string | null
          provider: string
          state: string
          user_id: string
        }
        Insert: {
          business_id: string
          code_verifier_encrypted?: string | null
          created_at?: string
          expires_at: string
          professional_id?: string | null
          provider: string
          state: string
          user_id: string
        }
        Update: {
          business_id?: string
          code_verifier_encrypted?: string | null
          created_at?: string
          expires_at?: string
          professional_id?: string | null
          provider?: string
          state?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "oauth_states_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oauth_states_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_hours: {
        Row: {
          closes_at: string | null
          created_at: string
          id: string
          is_closed: boolean
          opens_at: string | null
          professional_id: string
          updated_at: string
          weekday: number
        }
        Insert: {
          closes_at?: string | null
          created_at?: string
          id?: string
          is_closed?: boolean
          opens_at?: string | null
          professional_id: string
          updated_at?: string
          weekday: number
        }
        Update: {
          closes_at?: string | null
          created_at?: string
          id?: string
          is_closed?: boolean
          opens_at?: string | null
          professional_id?: string
          updated_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "professional_hours_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      professionals: {
        Row: {
          active: boolean
          business_id: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          business_id: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          business_id?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "professionals_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limit_buckets: {
        Row: {
          action: string
          expires_at: string
          key_hash: string
          request_count: number
          window_start: string
        }
        Insert: {
          action: string
          expires_at: string
          key_hash: string
          request_count?: number
          window_start: string
        }
        Update: {
          action?: string
          expires_at?: string
          key_hash?: string
          request_count?: number
          window_start?: string
        }
        Relationships: []
      }
      schedule_blocks: {
        Row: {
          business_id: string
          created_at: string
          created_by: string | null
          end_time: string
          id: string
          professional_id: string | null
          reason: string | null
          start_time: string
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          created_by?: string | null
          end_time: string
          id?: string
          professional_id?: string | null
          reason?: string | null
          start_time: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          created_by?: string | null
          end_time?: string
          id?: string
          professional_id?: string | null
          reason?: string | null
          start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_blocks_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_blocks_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          active: boolean
          business_id: string
          created_at: string
          duration_minutes: number
          id: string
          name: string
          price_cents: number
        }
        Insert: {
          active?: boolean
          business_id: string
          created_at?: string
          duration_minutes: number
          id?: string
          name: string
          price_cents?: number
        }
        Update: {
          active?: boolean
          business_id?: string
          created_at?: string
          duration_minutes?: number
          id?: string
          name?: string
          price_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "services_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          business_id: string | null
          checkout_url: string | null
          created_at: string
          external_reference: string
          id: string
          last_payment_date: string | null
          next_billing_date: string | null
          payer_email: string
          provider: string
          provider_subscription_id: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          business_id?: string | null
          checkout_url?: string | null
          created_at?: string
          external_reference: string
          id?: string
          last_payment_date?: string | null
          next_billing_date?: string | null
          payer_email: string
          provider?: string
          provider_subscription_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          business_id?: string | null
          checkout_url?: string | null
          created_at?: string
          external_reference?: string
          id?: string
          last_payment_date?: string | null
          next_billing_date?: string | null
          payer_email?: string
          provider?: string
          provider_subscription_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      team_invitations: {
        Row: {
          accepted_at: string | null
          business_id: string
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          professional_id: string | null
          role: string
          token_hash: string
        }
        Insert: {
          accepted_at?: string | null
          business_id: string
          created_at?: string
          email: string
          expires_at: string
          id?: string
          invited_by: string
          professional_id?: string | null
          role: string
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          business_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          professional_id?: string | null
          role?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_invitations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_invitations_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          attempts: number
          data_id: string | null
          error_message: string | null
          event_key: string
          id: string
          last_attempt_at: string
          processed_at: string | null
          provider: string
          received_at: string
          request_id: string | null
          status: string
          topic: string | null
        }
        Insert: {
          attempts?: number
          data_id?: string | null
          error_message?: string | null
          event_key: string
          id?: string
          last_attempt_at?: string
          processed_at?: string | null
          provider?: string
          received_at?: string
          request_id?: string | null
          status?: string
          topic?: string | null
        }
        Update: {
          attempts?: number
          data_id?: string | null
          error_message?: string | null
          event_key?: string
          id?: string
          last_attempt_at?: string
          processed_at?: string | null
          provider?: string
          received_at?: string
          request_id?: string | null
          status?: string
          topic?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      business_professional_id: {
        Args: { p_business_id: string }
        Returns: string
      }
      business_role: { Args: { p_business_id: string }; Returns: string }
      consume_rate_limit: {
        Args: {
          p_action: string
          p_key_hash: string
          p_max_requests: number
          p_window_seconds: number
        }
        Returns: {
          allowed: boolean
          remaining: number
          retry_after: number
        }[]
      }
      create_booking_payment_hold: {
        Args: {
          p_amount_cents: number
          p_business_id: string
          p_customer_email: string
          p_customer_name: string
          p_customer_phone: string
          p_deposit_percent: number
          p_end_time: string
          p_expires_at: string
          p_external_reference: string
          p_professional_id: string
          p_service_id: string
          p_service_price_cents: number
          p_start_time: string
        }
        Returns: string
      }
      finalize_booking_payment: {
        Args: { p_paid_at?: string; p_provider_payment_id: string }
        Returns: string
      }
      reschedule_appointment: {
        Args: {
          p_appointment_id: string
          p_end_time: string
          p_professional_id: string
          p_start_time: string
        }
        Returns: string
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
  public: {
    Enums: {},
  },
} as const
