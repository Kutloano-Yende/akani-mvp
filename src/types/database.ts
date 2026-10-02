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
      activities: {
        Row: {
          created_at: string
          description: string | null
          id: string
          metadata: Json | null
          prospect_id: string
          tenant_id: string
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          prospect_id: string
          tenant_id: string
          type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          prospect_id?: string
          tenant_id?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "act_tenant_prospect_fk"
            columns: ["tenant_id", "prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "act_tenant_user_fk"
            columns: ["tenant_id", "user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "activities_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      api_usage: {
        Row: {
          created_at: string
          credits_used: number
          endpoint: string
          id: string
          provider: string
          results_returned: number
          user_id: string | null
        }
        Insert: {
          created_at?: string
          credits_used?: number
          endpoint: string
          id?: string
          provider: string
          results_returned?: number
          user_id?: string | null
        }
        Update: {
          created_at?: string
          credits_used?: number
          endpoint?: string
          id?: string
          provider?: string
          results_returned?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_usage_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      applications: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          prospect_id: string
          status: Database["public"]["Enums"]["application_status"]
          submitted_at: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          prospect_id: string
          status?: Database["public"]["Enums"]["application_status"]
          submitted_at?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          prospect_id?: string
          status?: Database["public"]["Enums"]["application_status"]
          submitted_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          ip_address: string | null
          metadata: Json | null
          tenant_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          tenant_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          tenant_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_tenant_user_fk"
            columns: ["tenant_id", "user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      booking_settings: {
        Row: {
          end_hour: number
          host_email: string | null
          host_name: string
          id: boolean
          max_days_ahead: number
          meeting_details: string
          min_notice_hours: number
          slot_minutes: number
          start_hour: number
          timezone: string
          updated_at: string
          working_days: number[]
        }
        Insert: {
          end_hour?: number
          host_email?: string | null
          host_name?: string
          id?: boolean
          max_days_ahead?: number
          meeting_details?: string
          min_notice_hours?: number
          slot_minutes?: number
          start_hour?: number
          timezone?: string
          updated_at?: string
          working_days?: number[]
        }
        Update: {
          end_hour?: number
          host_email?: string | null
          host_name?: string
          id?: boolean
          max_days_ahead?: number
          meeting_details?: string
          min_notice_hours?: number
          slot_minutes?: number
          start_hour?: number
          timezone?: string
          updated_at?: string
          working_days?: number[]
        }
        Relationships: []
      }
      bookings: {
        Row: {
          cancelled_at: string | null
          created_at: string
          end_at: string
          id: string
          lead_id: string
          start_at: string
          status: string
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          end_at: string
          id?: string
          lead_id: string
          start_at: string
          status?: string
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          end_at?: string
          id?: string
          lead_id?: string
          start_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_prospects: {
        Row: {
          campaign_id: string
          consent_answer: string | null
          consent_at: string | null
          created_at: string
          id: string
          opened_at: string | null
          prospect_id: string
          recipient_email: string | null
          replied_at: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["campaign_prospect_status"]
          tenant_id: string
          unsubscribe_token: string
        }
        Insert: {
          campaign_id: string
          consent_answer?: string | null
          consent_at?: string | null
          created_at?: string
          id?: string
          opened_at?: string | null
          prospect_id: string
          recipient_email?: string | null
          replied_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["campaign_prospect_status"]
          tenant_id: string
          unsubscribe_token?: string
        }
        Update: {
          campaign_id?: string
          consent_answer?: string | null
          consent_at?: string | null
          created_at?: string
          id?: string
          opened_at?: string | null
          prospect_id?: string
          recipient_email?: string | null
          replied_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["campaign_prospect_status"]
          tenant_id?: string
          unsubscribe_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_prospects_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cp_tenant_campaign_fk"
            columns: ["tenant_id", "campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "cp_tenant_prospect_fk"
            columns: ["tenant_id", "prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      campaigns: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          started_at: string | null
          status: Database["public"]["Enums"]["campaign_status"]
          template_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          template_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          template_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_tenant_creator_fk"
            columns: ["tenant_id", "created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "campaigns_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          email: string | null
          employee_count: number | null
          external_id: string | null
          id: string
          industry: string | null
          name: string
          opportunity_level:
            | Database["public"]["Enums"]["opportunity_level"]
            | null
          opportunity_score: number | null
          phone: string | null
          province: string | null
          registration_number: string | null
          revenue_range: string | null
          source: string | null
          tenant_id: string
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          employee_count?: number | null
          external_id?: string | null
          id?: string
          industry?: string | null
          name: string
          opportunity_level?:
            | Database["public"]["Enums"]["opportunity_level"]
            | null
          opportunity_score?: number | null
          phone?: string | null
          province?: string | null
          registration_number?: string | null
          revenue_range?: string | null
          source?: string | null
          tenant_id: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          employee_count?: number | null
          external_id?: string | null
          id?: string
          industry?: string | null
          name?: string
          opportunity_level?:
            | Database["public"]["Enums"]["opportunity_level"]
            | null
          opportunity_score?: number | null
          phone?: string | null
          province?: string | null
          registration_number?: string | null
          revenue_range?: string | null
          source?: string | null
          tenant_id?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          company_id: string
          created_at: string
          email: string | null
          external_id: string | null
          first_name: string | null
          id: string
          job_title: string | null
          last_name: string | null
          phone: string | null
          source: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          email?: string | null
          external_id?: string | null
          first_name?: string | null
          id?: string
          job_title?: string | null
          last_name?: string | null
          phone?: string | null
          source?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          email?: string | null
          external_id?: string | null
          first_name?: string | null
          id?: string
          job_title?: string | null
          last_name?: string | null
          phone?: string | null
          source?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_tenant_company_fk"
            columns: ["tenant_id", "company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "contacts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      conversions: {
        Row: {
          converted_at: string | null
          created_at: string
          id: string
          notes: string | null
          prospect_id: string
          reported_at: string
          reported_by: string | null
          status: Database["public"]["Enums"]["conversion_status"]
          updated_at: string
        }
        Insert: {
          converted_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          prospect_id: string
          reported_at?: string
          reported_by?: string | null
          status?: Database["public"]["Enums"]["conversion_status"]
          updated_at?: string
        }
        Update: {
          converted_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          prospect_id?: string
          reported_at?: string
          reported_by?: string | null
          status?: Database["public"]["Enums"]["conversion_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversions_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversions_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          id: string
          include_permission_buttons: boolean
          name: string
          subject: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          include_permission_buttons?: boolean
          name: string
          subject: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          include_permission_buttons?: boolean
          name?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          created_at: string
          email_sent: boolean
          id: string
          message: string
          page_path: string | null
          submitted_by: string
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          email_sent?: boolean
          id?: string
          message: string
          page_path?: string | null
          submitted_by: string
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          email_sent?: boolean
          id?: string
          message?: string
          page_path?: string | null
          submitted_by?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feedback_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      impersonation_sessions: {
        Row: {
          admin_id: string
          ended_at: string | null
          id: string
          ip_address: string | null
          started_at: string
          target_user_id: string
          user_agent: string | null
        }
        Insert: {
          admin_id: string
          ended_at?: string | null
          id?: string
          ip_address?: string | null
          started_at?: string
          target_user_id: string
          user_agent?: string | null
        }
        Update: {
          admin_id?: string
          ended_at?: string | null
          id?: string
          ip_address?: string | null
          started_at?: string
          target_user_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "impersonation_sessions_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "impersonation_sessions_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_emails: {
        Row: {
          error: string | null
          id: string
          lead_id: string
          sent_at: string
          status: string
          step: number
          subject: string | null
        }
        Insert: {
          error?: string | null
          id?: string
          lead_id: string
          sent_at?: string
          status: string
          step: number
          subject?: string | null
        }
        Update: {
          error?: string | null
          id?: string
          lead_id?: string
          sent_at?: string
          status?: string
          step?: number
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_emails_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          booked_at: string | null
          company_name: string | null
          created_at: string
          email: string
          first_name: string | null
          id: string
          last_emailed_at: string | null
          message: string | null
          name: string | null
          next_action_at: string | null
          phone: string | null
          prospect_id: string | null
          send_failures: number
          sequence_step: number
          source: string
          status: string
          token: string
        }
        Insert: {
          booked_at?: string | null
          company_name?: string | null
          created_at?: string
          email: string
          first_name?: string | null
          id?: string
          last_emailed_at?: string | null
          message?: string | null
          name?: string | null
          next_action_at?: string | null
          phone?: string | null
          prospect_id?: string | null
          send_failures?: number
          sequence_step?: number
          source: string
          status?: string
          token?: string
        }
        Update: {
          booked_at?: string | null
          company_name?: string | null
          created_at?: string
          email?: string
          first_name?: string | null
          id?: string
          last_emailed_at?: string | null
          message?: string | null
          name?: string | null
          next_action_at?: string | null
          phone?: string | null
          prospect_id?: string | null
          send_failures?: number
          sequence_step?: number
          source?: string
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_signals: {
        Row: {
          company_id: string
          created_at: string
          description: string
          id: string
          signal_type: string
          source: string | null
          weight: number
        }
        Insert: {
          company_id: string
          created_at?: string
          description: string
          id?: string
          signal_type: string
          source?: string | null
          weight?: number
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string
          id?: string
          signal_type?: string
          source?: string | null
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_signals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_admins: {
        Row: {
          user_id: string
        }
        Insert: {
          user_id: string
        }
        Update: {
          user_id?: string
        }
        Relationships: []
      }
      popia_requests: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          due_at: string
          handled_by: string | null
          id: string
          notes: string | null
          request_type: string
          status: string
          subject_email: string
          subject_name: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          due_at?: string
          handled_by?: string | null
          id?: string
          notes?: string | null
          request_type: string
          status?: string
          subject_email: string
          subject_name?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          due_at?: string
          handled_by?: string | null
          id?: string
          notes?: string | null
          request_type?: string
          status?: string
          subject_email?: string
          subject_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "popia_requests_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "popia_requests_handled_by_fkey"
            columns: ["handled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          id: string
          name: string
          role: Database["public"]["Enums"]["user_role"]
          sidebar_collapsed: boolean
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          id: string
          name: string
          role?: Database["public"]["Enums"]["user_role"]
          sidebar_collapsed?: boolean
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          name?: string
          role?: Database["public"]["Enums"]["user_role"]
          sidebar_collapsed?: boolean
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      prospects: {
        Row: {
          assigned_to: string | null
          company_id: string
          converted_at: string | null
          created_at: string
          first_contacted_at: string | null
          id: string
          last_contacted_at: string | null
          opportunity_score: number | null
          qualification_status: string | null
          qualified_at: string | null
          status: Database["public"]["Enums"]["prospect_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          company_id: string
          converted_at?: string | null
          created_at?: string
          first_contacted_at?: string | null
          id?: string
          last_contacted_at?: string | null
          opportunity_score?: number | null
          qualification_status?: string | null
          qualified_at?: string | null
          status?: Database["public"]["Enums"]["prospect_status"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          company_id?: string
          converted_at?: string | null
          created_at?: string
          first_contacted_at?: string | null
          id?: string
          last_contacted_at?: string | null
          opportunity_score?: number | null
          qualification_status?: string | null
          qualified_at?: string | null
          status?: Database["public"]["Enums"]["prospect_status"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospects_tenant_assignee_fk"
            columns: ["tenant_id", "assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "prospects_tenant_company_fk"
            columns: ["tenant_id", "company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["tenant_id", "id"]
          },
          {
            foreignKeyName: "prospects_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      suppression_list: {
        Row: {
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          phone: string | null
          reason: string | null
          source: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          phone?: string | null
          reason?: string | null
          source?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          phone?: string | null
          reason?: string | null
          source?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppression_list_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suppression_tenant_creator_fk"
            columns: ["tenant_id", "created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["tenant_id", "id"]
          },
        ]
      }
      tenants: {
        Row: {
          allow_custom_branding: boolean
          brand_accent_color: string | null
          brand_logo_url: string | null
          brand_primary_color: string | null
          chart_style: string | null
          created_at: string
          id: string
          layout_style: string | null
          name: string
          slug: string
          status: string
          suspended_at: string | null
        }
        Insert: {
          allow_custom_branding?: boolean
          brand_accent_color?: string | null
          brand_logo_url?: string | null
          brand_primary_color?: string | null
          chart_style?: string | null
          created_at?: string
          id?: string
          layout_style?: string | null
          name: string
          slug: string
          status?: string
          suspended_at?: string | null
        }
        Update: {
          allow_custom_branding?: boolean
          brand_accent_color?: string | null
          brand_logo_url?: string | null
          brand_primary_color?: string | null
          chart_style?: string | null
          created_at?: string
          id?: string
          layout_style?: string | null
          name?: string
          slug?: string
          status?: string
          suspended_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_update_user_role: {
        Args: {
          new_role: Database["public"]["Enums"]["user_role"]
          target_user_id: string
        }
        Returns: undefined
      }
      answer_permission: {
        Args: { p_answer: string; p_token: string }
        Returns: Json
      }
      book_slot: { Args: { p_start: string; p_token: string }; Returns: Json }
      booking_page_data: { Args: { p_token: string }; Returns: Json }
      cancel_booking: { Args: { p_token: string }; Returns: Json }
      current_tenant_appearance: {
        Args: never
        Returns: {
          allow_custom_branding: boolean
          chart_style: string
          layout_style: string
        }[]
      }
      current_tenant_id: { Args: never; Returns: string }
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      is_platform_admin: { Args: never; Returns: boolean }
      lead_claim_due: {
        Args: { p_limit?: number; p_secret: string }
        Returns: Json
      }
      lead_intake: {
        Args: {
          p_company: string
          p_email: string
          p_message: string
          p_name: string
          p_phone: string
          p_prospect_id?: string
          p_secret: string
          p_source: string
        }
        Returns: Json
      }
      lead_record_reply_ack: {
        Args: { p_error: string; p_ok: boolean; p_token: string }
        Returns: undefined
      }
      lead_record_send: {
        Args: {
          p_error: string
          p_lead_id: string
          p_next_at: string
          p_ok: boolean
          p_secret: string
          p_step: number
          p_subject: string
        }
        Returns: undefined
      }
      lead_reply_received: { Args: { p_token: string }; Returns: Json }
      unsubscribe_by_token: { Args: { p_token: string }; Returns: boolean }
    }
    Enums: {
      application_status: "submitted" | "approved" | "rejected"
      campaign_prospect_status: "pending" | "sent" | "opened" | "replied"
      campaign_status: "draft" | "active" | "completed"
      conversion_status: "pending" | "confirmed" | "rejected"
      opportunity_level: "low" | "medium" | "high"
      prospect_status:
        | "identified"
        | "qualified"
        | "contacted"
        | "interested"
        | "application"
        | "won"
        | "lost"
      user_role: "admin" | "manager" | "sales"
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
    Enums: {
      application_status: ["submitted", "approved", "rejected"],
      campaign_prospect_status: ["pending", "sent", "opened", "replied"],
      campaign_status: ["draft", "active", "completed"],
      conversion_status: ["pending", "confirmed", "rejected"],
      opportunity_level: ["low", "medium", "high"],
      prospect_status: [
        "identified",
        "qualified",
        "contacted",
        "interested",
        "application",
        "won",
        "lost",
      ],
      user_role: ["admin", "manager", "sales"],
    },
  },
} as const
