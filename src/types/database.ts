export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          prospect_id: string
          type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          prospect_id?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activities_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_prospects: {
        Row: {
          campaign_id: string
          created_at: string
          id: string
          opened_at: string | null
          prospect_id: string
          recipient_email: string | null
          replied_at: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["campaign_prospect_status"]
          unsubscribe_token: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          id?: string
          opened_at?: string | null
          prospect_id: string
          recipient_email?: string | null
          replied_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["campaign_prospect_status"]
          unsubscribe_token?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          id?: string
          opened_at?: string | null
          prospect_id?: string
          recipient_email?: string | null
          replied_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["campaign_prospect_status"]
          unsubscribe_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_prospects_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_prospects_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
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
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
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
          opportunity_level: Database["public"]["Enums"]["opportunity_level"] | null
          opportunity_score: number | null
          phone: string | null
          province: string | null
          registration_number: string | null
          revenue_range: string | null
          source: string | null
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
          opportunity_level?: Database["public"]["Enums"]["opportunity_level"] | null
          opportunity_score?: number | null
          phone?: string | null
          province?: string | null
          registration_number?: string | null
          revenue_range?: string | null
          source?: string | null
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
          opportunity_level?: Database["public"]["Enums"]["opportunity_level"] | null
          opportunity_score?: number | null
          phone?: string | null
          province?: string | null
          registration_number?: string | null
          revenue_range?: string | null
          source?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
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
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
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
          name: string
          subject: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          subject: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
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
          created_at: string
          id: string
          name: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          name: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
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
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospects_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
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
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          phone?: string | null
          reason?: string | null
          source?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          phone?: string | null
          reason?: string | null
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppression_list_created_by_fkey"
            columns: ["created_by"]
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
      admin_update_user_role: {
        Args: {
          new_role: Database["public"]["Enums"]["user_role"]
          target_user_id: string
        }
        Returns: undefined
      }
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
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

type DefaultSchema = Database["public"]

export type Tables<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Row"]
export type TablesInsert<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Update"]
export type Enums<T extends keyof DefaultSchema["Enums"]> =
  DefaultSchema["Enums"][T]
