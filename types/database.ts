/**
 * Supabase Database Types
 *
 * This file contains TypeScript types for the database schema.
 * Keep this file in sync with your Supabase migrations.
 *
 * To regenerate from Supabase:
 * npx supabase gen types typescript --project-id YOUR_PROJECT_ID > types/database.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      stores: {
        Row: {
          id: string
          name: string
          address: string | null
          is_active: boolean
          opening_time: string | null
          closing_time: string | null
          weekly_hours: Json | null
          billing_user_id: string | null
          subscription_status: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          address?: string | null
          is_active?: boolean
          opening_time?: string | null
          closing_time?: string | null
          weekly_hours?: Json | null
          billing_user_id?: string | null
          subscription_status?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          address?: string | null
          is_active?: boolean
          opening_time?: string | null
          closing_time?: string | null
          weekly_hours?: Json | null
          billing_user_id?: string | null
          subscription_status?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stores_billing_user_id_fkey"
            columns: ["billing_user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          phone: string | null
          role: Database['public']['Enums']['user_role']
          store_id: string | null
          is_platform_admin: boolean
          default_store_id: string | null
          stripe_customer_id: string | null
          status: Database['public']['Enums']['user_status']
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          phone?: string | null
          role?: Database['public']['Enums']['user_role']
          store_id?: string | null
          is_platform_admin?: boolean
          default_store_id?: string | null
          stripe_customer_id?: string | null
          status?: Database['public']['Enums']['user_status']
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          phone?: string | null
          role?: Database['public']['Enums']['user_role']
          store_id?: string | null
          is_platform_admin?: boolean
          default_store_id?: string | null
          stripe_customer_id?: string | null
          status?: Database['public']['Enums']['user_status']
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_store_id_fkey"
            columns: ["store_id"]
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_default_store_id_fkey"
            columns: ["default_store_id"]
            referencedRelation: "stores"
            referencedColumns: ["id"]
          }
        ]
      }
      store_users: {
        Row: {
          id: string
          store_id: string
          user_id: string
          role: Database['public']['Enums']['store_user_role']
          is_billing_owner: boolean
          invited_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          store_id: string
          user_id: string
          role: Database['public']['Enums']['store_user_role']
          is_billing_owner?: boolean
          invited_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          store_id?: string
          user_id?: string
          role?: Database['public']['Enums']['store_user_role']
          is_billing_owner?: boolean
          invited_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_users_store_id_fkey"
            columns: ["store_id"]
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_users_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_users_invited_by_fkey"
            columns: ["invited_by"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      subscriptions: {
        Row: {
          id: string
          store_id: string
          billing_user_id: string
          stripe_subscription_id: string | null
          stripe_customer_id: string | null
          stripe_payment_method_id: string | null
          stripe_price_id: string | null
          status: Database['public']['Enums']['subscription_status']
          trial_start: string | null
          trial_end: string | null
          current_period_start: string | null
          current_period_end: string | null
          cancel_at_period_end: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          store_id: string
          billing_user_id: string
          stripe_subscription_id?: string | null
          stripe_customer_id?: string | null
          stripe_payment_method_id?: string | null
          stripe_price_id?: string | null
          status?: Database['public']['Enums']['subscription_status']
          trial_start?: string | null
          trial_end?: string | null
          current_period_start?: string | null
          current_period_end?: string | null
          cancel_at_period_end?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          store_id?: string
          billing_user_id?: string
          stripe_subscription_id?: string | null
          stripe_customer_id?: string | null
          stripe_payment_method_id?: string | null
          stripe_price_id?: string | null
          status?: Database['public']['Enums']['subscription_status']
          trial_start?: string | null
          trial_end?: string | null
          current_period_start?: string | null
          current_period_end?: string | null
          cancel_at_period_end?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_store_id_fkey"
            columns: ["store_id"]
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_billing_user_id_fkey"
            columns: ["billing_user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      billing_events: {
        Row: {
          id: string
          subscription_id: string | null
          store_id: string | null
          user_id: string | null
          event_type: string
          stripe_event_id: string | null
          amount_cents: number | null
          currency: string
          status: string | null
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          subscription_id?: string | null
          store_id?: string | null
          user_id?: string | null
          event_type: string
          stripe_event_id?: string | null
          amount_cents?: number | null
          currency?: string
          status?: string | null
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          subscription_id?: string | null
          store_id?: string | null
          user_id?: string | null
          event_type?: string
          stripe_event_id?: string | null
          amount_cents?: number | null
          currency?: string
          status?: string | null
          metadata?: Json
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_events_subscription_id_fkey"
            columns: ["subscription_id"]
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_events_store_id_fkey"
            columns: ["store_id"]
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_events_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      user_invites: {
        Row: {
          id: string
          email: string
          role: Database['public']['Enums']['store_user_role']
          store_id: string | null
          store_ids: string[]
          token: string
          invited_by: string
          expires_at: string
          used_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          role: Database['public']['Enums']['store_user_role']
          store_id?: string | null
          store_ids?: string[]
          token: string
          invited_by: string
          expires_at: string
          used_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          role?: Database['public']['Enums']['store_user_role']
          store_id?: string | null
          store_ids?: string[]
          token?: string
          invited_by?: string
          expires_at?: string
          used_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_invites_store_id_fkey"
            columns: ["store_id"]
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_invites_invited_by_fkey"
            columns: ["invited_by"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      audit_logs: {
        Row: {
          id: string
          user_id: string | null
          user_email: string | null
          action: string
          action_category: string
          store_id: string | null
          resource_type: string | null
          resource_id: string | null
          details: Json
          ip_address: string | null
          user_agent: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          user_email?: string | null
          action: string
          action_category: string
          store_id?: string | null
          resource_type?: string | null
          resource_id?: string | null
          details?: Json
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          user_email?: string | null
          action?: string
          action_category?: string
          store_id?: string | null
          resource_type?: string | null
          resource_id?: string | null
          details?: Json
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_store_id_fkey"
            columns: ["store_id"]
            referencedRelation: "stores"
            referencedColumns: ["id"]
          }
        ]
      }
      inventory_items: {
        Row: {
          id: string
          name: string
          category: string | null
          unit_of_measure: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          category?: string | null
          unit_of_measure: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          category?: string | null
          unit_of_measure?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      store_inventory: {
        Row: {
          id: string
          store_id: string
          inventory_item_id: string
          quantity: number
          par_level: number | null
          last_updated_at: string
          last_updated_by: string | null
        }
        Insert: {
          id?: string
          store_id: string
          inventory_item_id: string
          quantity?: number
          par_level?: number | null
          last_updated_at?: string
          last_updated_by?: string | null
        }
        Update: {
          id?: string
          store_id?: string
          inventory_item_id?: string
          quantity?: number
          par_level?: number | null
          last_updated_at?: string
          last_updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_inventory_store_id_fkey"
            columns: ["store_id"]
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_inventory_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_inventory_last_updated_by_fkey"
            columns: ["last_updated_by"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      stock_history: {
        Row: {
          id: string
          store_id: string
          inventory_item_id: string
          action_type: Database['public']['Enums']['stock_action_type']
          quantity_before: number | null
          quantity_after: number | null
          quantity_change: number | null
          performed_by: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          store_id: string
          inventory_item_id: string
          action_type: Database['public']['Enums']['stock_action_type']
          quantity_before?: number | null
          quantity_after?: number | null
          quantity_change?: number | null
          performed_by?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          store_id?: string
          inventory_item_id?: string
          action_type?: Database['public']['Enums']['stock_action_type']
          quantity_before?: number | null
          quantity_after?: number | null
          quantity_change?: number | null
          performed_by?: string | null
          notes?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_history_store_id_fkey"
            columns: ["store_id"]
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_history_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_history_performed_by_fkey"
            columns: ["performed_by"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      shifts: {
        Row: {
          id: string
          store_id: string
          user_id: string
          start_time: string
          end_time: string
          clock_in_time: string | null
          clock_out_time: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          store_id: string
          user_id: string
          start_time: string
          end_time: string
          clock_in_time?: string | null
          clock_out_time?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          store_id?: string
          user_id?: string
          start_time?: string
          end_time?: string
          clock_in_time?: string | null
          clock_out_time?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shifts_store_id_fkey"
            columns: ["store_id"]
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      daily_counts: {
        Row: {
          id: string
          store_id: string
          count_date: string
          submitted_by: string | null
          submitted_at: string
        }
        Insert: {
          id?: string
          store_id: string
          count_date: string
          submitted_by?: string | null
          submitted_at?: string
        }
        Update: {
          id?: string
          store_id?: string
          count_date?: string
          submitted_by?: string | null
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_counts_store_id_fkey"
            columns: ["store_id"]
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_counts_submitted_by_fkey"
            columns: ["submitted_by"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_store_subscription_active: {
        Args: { p_store_id: string }
        Returns: boolean
      }
      get_trial_days_remaining: {
        Args: { p_store_id: string }
        Returns: number
      }
      cleanup_expired_invites: {
        Args: Record<string, never>
        Returns: number
      }
    }
    Enums: {
      user_role: 'Owner' | 'Manager' | 'Staff' | 'Driver' | 'Admin'
      user_status: 'Invited' | 'Active' | 'Inactive'
      stock_action_type: 'Count' | 'Reception' | 'Adjustment'
      store_user_role: 'Owner' | 'Manager' | 'Staff' | 'Driver'
      subscription_status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Helper types for easier usage
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type Insertable<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type Updatable<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T]
