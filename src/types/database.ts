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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
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
