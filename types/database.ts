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
  | Json[];

export type Database = {
  public: {
    Tables: {
      stores: {
        Row: {
          id: string;
          name: string;
          address: string | null;
          is_active: boolean;
          opening_time: string | null;
          closing_time: string | null;
          weekly_hours: Json | null;
          billing_user_id: string | null;
          subscription_status: string | null;
          country: string;
          currency: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          address?: string | null;
          is_active?: boolean;
          opening_time?: string | null;
          closing_time?: string | null;
          weekly_hours?: Json | null;
          billing_user_id?: string | null;
          subscription_status?: string | null;
          country?: string;
          currency?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          address?: string | null;
          is_active?: boolean;
          opening_time?: string | null;
          closing_time?: string | null;
          weekly_hours?: Json | null;
          billing_user_id?: string | null;
          subscription_status?: string | null;
          country?: string;
          currency?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stores_billing_user_id_fkey";
            columns: ["billing_user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          phone: string | null;
          role: Database["public"]["Enums"]["user_role"];
          store_id: string | null;
          is_platform_admin: boolean;
          default_store_id: string | null;
          stripe_customer_id: string | null;
          status: Database["public"]["Enums"]["user_status"];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          phone?: string | null;
          role?: Database["public"]["Enums"]["user_role"];
          store_id?: string | null;
          is_platform_admin?: boolean;
          default_store_id?: string | null;
          stripe_customer_id?: string | null;
          status?: Database["public"]["Enums"]["user_status"];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          phone?: string | null;
          role?: Database["public"]["Enums"]["user_role"];
          store_id?: string | null;
          is_platform_admin?: boolean;
          default_store_id?: string | null;
          stripe_customer_id?: string | null;
          status?: Database["public"]["Enums"]["user_status"];
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_store_id_fkey";
            columns: ["store_id"];
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "profiles_default_store_id_fkey";
            columns: ["default_store_id"];
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      store_users: {
        Row: {
          id: string;
          store_id: string;
          user_id: string;
          role: Database["public"]["Enums"]["store_user_role"];
          is_billing_owner: boolean;
          hourly_rate: number | null;
          invited_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          user_id: string;
          role: Database["public"]["Enums"]["store_user_role"];
          is_billing_owner?: boolean;
          hourly_rate?: number | null;
          invited_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          user_id?: string;
          role?: Database["public"]["Enums"]["store_user_role"];
          is_billing_owner?: boolean;
          hourly_rate?: number | null;
          invited_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "store_users_store_id_fkey";
            columns: ["store_id"];
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "store_users_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "store_users_invited_by_fkey";
            columns: ["invited_by"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      subscriptions: {
        Row: {
          id: string;
          store_id: string;
          billing_user_id: string;
          stripe_subscription_id: string | null;
          stripe_customer_id: string | null;
          stripe_payment_method_id: string | null;
          stripe_price_id: string | null;
          status: Database["public"]["Enums"]["subscription_status"];
          trial_start: string | null;
          trial_end: string | null;
          current_period_start: string | null;
          current_period_end: string | null;
          cancel_at_period_end: boolean;
          currency: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          billing_user_id: string;
          stripe_subscription_id?: string | null;
          stripe_customer_id?: string | null;
          stripe_payment_method_id?: string | null;
          stripe_price_id?: string | null;
          status?: Database["public"]["Enums"]["subscription_status"];
          trial_start?: string | null;
          trial_end?: string | null;
          current_period_start?: string | null;
          current_period_end?: string | null;
          cancel_at_period_end?: boolean;
          currency?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          billing_user_id?: string;
          stripe_subscription_id?: string | null;
          stripe_customer_id?: string | null;
          stripe_payment_method_id?: string | null;
          stripe_price_id?: string | null;
          status?: Database["public"]["Enums"]["subscription_status"];
          trial_start?: string | null;
          trial_end?: string | null;
          current_period_start?: string | null;
          current_period_end?: string | null;
          cancel_at_period_end?: boolean;
          currency?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subscriptions_store_id_fkey";
            columns: ["store_id"];
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subscriptions_billing_user_id_fkey";
            columns: ["billing_user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      billing_events: {
        Row: {
          id: string;
          subscription_id: string | null;
          store_id: string | null;
          user_id: string | null;
          event_type: string;
          stripe_event_id: string | null;
          amount_cents: number | null;
          currency: string;
          status: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          subscription_id?: string | null;
          store_id?: string | null;
          user_id?: string | null;
          event_type: string;
          stripe_event_id?: string | null;
          amount_cents?: number | null;
          currency?: string;
          status?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          subscription_id?: string | null;
          store_id?: string | null;
          user_id?: string | null;
          event_type?: string;
          stripe_event_id?: string | null;
          amount_cents?: number | null;
          currency?: string;
          status?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "billing_events_subscription_id_fkey";
            columns: ["subscription_id"];
            referencedRelation: "subscriptions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "billing_events_store_id_fkey";
            columns: ["store_id"];
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "billing_events_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      user_invites: {
        Row: {
          id: string;
          email: string;
          role: Database["public"]["Enums"]["store_user_role"];
          store_id: string | null;
          store_ids: string[];
          token: string;
          invited_by: string;
          expires_at: string;
          used_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          role: Database["public"]["Enums"]["store_user_role"];
          store_id?: string | null;
          store_ids?: string[];
          token: string;
          invited_by: string;
          expires_at: string;
          used_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          role?: Database["public"]["Enums"]["store_user_role"];
          store_id?: string | null;
          store_ids?: string[];
          token?: string;
          invited_by?: string;
          expires_at?: string;
          used_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_invites_store_id_fkey";
            columns: ["store_id"];
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_invites_invited_by_fkey";
            columns: ["invited_by"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_logs: {
        Row: {
          id: string;
          user_id: string | null;
          user_email: string | null;
          action: string;
          action_category: string;
          store_id: string | null;
          resource_type: string | null;
          resource_id: string | null;
          details: Json;
          ip_address: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          user_email?: string | null;
          action: string;
          action_category: string;
          store_id?: string | null;
          resource_type?: string | null;
          resource_id?: string | null;
          details?: Json;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          user_email?: string | null;
          action?: string;
          action_category?: string;
          store_id?: string | null;
          resource_type?: string | null;
          resource_id?: string | null;
          details?: Json;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "audit_logs_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "audit_logs_store_id_fkey";
            columns: ["store_id"];
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      inventory_items: {
        Row: {
          id: string;
          name: string;
          category: string | null;
          category_id: string | null;
          unit_of_measure: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          category?: string | null;
          category_id?: string | null;
          unit_of_measure: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          category?: string | null;
          category_id?: string | null;
          unit_of_measure?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_items_category_id_fkey";
            columns: ["category_id"];
            referencedRelation: "item_categories";
            referencedColumns: ["id"];
          },
        ];
      };
      item_categories: {
        Row: {
          id: string;
          store_id: string;
          name: string;
          description: string | null;
          color: string | null;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          name: string;
          description?: string | null;
          color?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          name?: string;
          description?: string | null;
          color?: string | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "item_categories_store_id_fkey";
            columns: ["store_id"];
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      item_tags: {
        Row: {
          id: string;
          store_id: string;
          name: string;
          description: string | null;
          color: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          name: string;
          description?: string | null;
          color?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          name?: string;
          description?: string | null;
          color?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "item_tags_store_id_fkey";
            columns: ["store_id"];
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      inventory_item_tags: {
        Row: {
          inventory_item_id: string;
          tag_id: string;
          created_at: string;
        };
        Insert: {
          inventory_item_id: string;
          tag_id: string;
          created_at?: string;
        };
        Update: {
          inventory_item_id?: string;
          tag_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_item_tags_inventory_item_id_fkey";
            columns: ["inventory_item_id"];
            referencedRelation: "inventory_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_item_tags_tag_id_fkey";
            columns: ["tag_id"];
            referencedRelation: "item_tags";
            referencedColumns: ["id"];
          },
        ];
      };
      store_inventory: {
        Row: {
          id: string;
          store_id: string;
          inventory_item_id: string;
          quantity: number;
          par_level: number | null;
          unit_cost: number;
          cost_currency: string;
          last_updated_at: string;
          last_updated_by: string | null;
        };
        Insert: {
          id?: string;
          store_id: string;
          inventory_item_id: string;
          quantity?: number;
          par_level?: number | null;
          unit_cost?: number;
          cost_currency?: string;
          last_updated_at?: string;
          last_updated_by?: string | null;
        };
        Update: {
          id?: string;
          store_id?: string;
          inventory_item_id?: string;
          quantity?: number;
          par_level?: number | null;
          unit_cost?: number;
          cost_currency?: string;
          last_updated_at?: string;
          last_updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "store_inventory_store_id_fkey";
            columns: ["store_id"];
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "store_inventory_inventory_item_id_fkey";
            columns: ["inventory_item_id"];
            referencedRelation: "inventory_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "store_inventory_last_updated_by_fkey";
            columns: ["last_updated_by"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      stock_history: {
        Row: {
          id: string;
          store_id: string;
          inventory_item_id: string;
          action_type: Database["public"]["Enums"]["stock_action_type"];
          quantity_before: number | null;
          quantity_after: number | null;
          quantity_change: number | null;
          performed_by: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          inventory_item_id: string;
          action_type: Database["public"]["Enums"]["stock_action_type"];
          quantity_before?: number | null;
          quantity_after?: number | null;
          quantity_change?: number | null;
          performed_by?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          inventory_item_id?: string;
          action_type?: Database["public"]["Enums"]["stock_action_type"];
          quantity_before?: number | null;
          quantity_after?: number | null;
          quantity_change?: number | null;
          performed_by?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stock_history_store_id_fkey";
            columns: ["store_id"];
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_history_inventory_item_id_fkey";
            columns: ["inventory_item_id"];
            referencedRelation: "inventory_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_history_performed_by_fkey";
            columns: ["performed_by"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      shifts: {
        Row: {
          id: string;
          store_id: string;
          user_id: string;
          start_time: string;
          end_time: string;
          clock_in_time: string | null;
          clock_out_time: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          user_id: string;
          start_time: string;
          end_time: string;
          clock_in_time?: string | null;
          clock_out_time?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          user_id?: string;
          start_time?: string;
          end_time?: string;
          clock_in_time?: string | null;
          clock_out_time?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "shifts_store_id_fkey";
            columns: ["store_id"];
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "shifts_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      daily_counts: {
        Row: {
          id: string;
          store_id: string;
          count_date: string;
          submitted_by: string | null;
          submitted_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          count_date: string;
          submitted_by?: string | null;
          submitted_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          count_date?: string;
          submitted_by?: string | null;
          submitted_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "daily_counts_store_id_fkey";
            columns: ["store_id"];
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "daily_counts_submitted_by_fkey";
            columns: ["submitted_by"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      waste_log: {
        Row: {
          id: string;
          store_id: string;
          inventory_item_id: string;
          quantity: number;
          reason: string;
          notes: string | null;
          estimated_cost: number;
          reported_by: string;
          reported_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          inventory_item_id: string;
          quantity: number;
          reason: string;
          notes?: string | null;
          estimated_cost?: number;
          reported_by: string;
          reported_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          inventory_item_id?: string;
          quantity?: number;
          reason?: string;
          notes?: string | null;
          estimated_cost?: number;
          reported_by?: string;
          reported_at?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "waste_log_store_id_fkey";
            columns: ["store_id"];
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "waste_log_inventory_item_id_fkey";
            columns: ["inventory_item_id"];
            referencedRelation: "inventory_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "waste_log_reported_by_fkey";
            columns: ["reported_by"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      recipes: {
        Row: {
          id: string;
          store_id: string;
          name: string;
          description: string | null;
          category: string | null;
          yield_quantity: number;
          yield_unit: string;
          prep_time_minutes: number | null;
          is_active: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          name: string;
          description?: string | null;
          category?: string | null;
          yield_quantity?: number;
          yield_unit?: string;
          prep_time_minutes?: number | null;
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          name?: string;
          description?: string | null;
          category?: string | null;
          yield_quantity?: number;
          yield_unit?: string;
          prep_time_minutes?: number | null;
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "recipes_store_id_fkey";
            columns: ["store_id"];
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recipes_created_by_fkey";
            columns: ["created_by"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      recipe_ingredients: {
        Row: {
          id: string;
          recipe_id: string;
          inventory_item_id: string;
          quantity: number;
          unit_of_measure: string;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          recipe_id: string;
          inventory_item_id: string;
          quantity: number;
          unit_of_measure: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          recipe_id?: string;
          inventory_item_id?: string;
          quantity?: number;
          unit_of_measure?: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "recipe_ingredients_recipe_id_fkey";
            columns: ["recipe_id"];
            referencedRelation: "recipes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recipe_ingredients_inventory_item_id_fkey";
            columns: ["inventory_item_id"];
            referencedRelation: "inventory_items";
            referencedColumns: ["id"];
          },
        ];
      };
      menu_items: {
        Row: {
          id: string;
          store_id: string;
          recipe_id: string | null;
          name: string;
          description: string | null;
          category: string | null;
          selling_price: number;
          currency: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          recipe_id?: string | null;
          name: string;
          description?: string | null;
          category?: string | null;
          selling_price: number;
          currency?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          recipe_id?: string | null;
          name?: string;
          description?: string | null;
          category?: string | null;
          selling_price?: number;
          currency?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "menu_items_store_id_fkey";
            columns: ["store_id"];
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "menu_items_recipe_id_fkey";
            columns: ["recipe_id"];
            referencedRelation: "recipes";
            referencedColumns: ["id"];
          },
        ];
      };
      suppliers: {
        Row: {
          id: string;
          store_id: string;
          name: string;
          email: string | null;
          phone: string | null;
          address: string | null;
          contact_person: string | null;
          payment_terms: string | null;
          notes: string | null;
          is_active: boolean;
          edi_webhook_url: string | null;
          edi_webhook_secret: string | null;
          edi_enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          name: string;
          email?: string | null;
          phone?: string | null;
          address?: string | null;
          contact_person?: string | null;
          payment_terms?: string | null;
          notes?: string | null;
          is_active?: boolean;
          edi_webhook_url?: string | null;
          edi_webhook_secret?: string | null;
          edi_enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          name?: string;
          email?: string | null;
          phone?: string | null;
          address?: string | null;
          contact_person?: string | null;
          payment_terms?: string | null;
          notes?: string | null;
          is_active?: boolean;
          edi_webhook_url?: string | null;
          edi_webhook_secret?: string | null;
          edi_enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "suppliers_store_id_fkey";
            columns: ["store_id"];
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      supplier_items: {
        Row: {
          id: string;
          supplier_id: string;
          inventory_item_id: string;
          supplier_sku: string | null;
          unit_cost: number;
          currency: string;
          lead_time_days: number | null;
          min_order_quantity: number;
          is_preferred: boolean;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          supplier_id: string;
          inventory_item_id: string;
          supplier_sku?: string | null;
          unit_cost?: number;
          currency?: string;
          lead_time_days?: number | null;
          min_order_quantity?: number;
          is_preferred?: boolean;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          supplier_id?: string;
          inventory_item_id?: string;
          supplier_sku?: string | null;
          unit_cost?: number;
          currency?: string;
          lead_time_days?: number | null;
          min_order_quantity?: number;
          is_preferred?: boolean;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "supplier_items_supplier_id_fkey";
            columns: ["supplier_id"];
            referencedRelation: "suppliers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "supplier_items_inventory_item_id_fkey";
            columns: ["inventory_item_id"];
            referencedRelation: "inventory_items";
            referencedColumns: ["id"];
          },
        ];
      };
      purchase_orders: {
        Row: {
          id: string;
          store_id: string;
          supplier_id: string;
          po_number: string;
          status: string;
          order_date: string | null;
          expected_delivery_date: string | null;
          actual_delivery_date: string | null;
          total_amount: number;
          currency: string;
          notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          supplier_id: string;
          po_number: string;
          status?: string;
          order_date?: string | null;
          expected_delivery_date?: string | null;
          actual_delivery_date?: string | null;
          total_amount?: number;
          currency?: string;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          supplier_id?: string;
          po_number?: string;
          status?: string;
          order_date?: string | null;
          expected_delivery_date?: string | null;
          actual_delivery_date?: string | null;
          total_amount?: number;
          currency?: string;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "purchase_orders_store_id_fkey";
            columns: ["store_id"];
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey";
            columns: ["supplier_id"];
            referencedRelation: "suppliers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchase_orders_created_by_fkey";
            columns: ["created_by"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      purchase_order_items: {
        Row: {
          id: string;
          purchase_order_id: string;
          inventory_item_id: string;
          supplier_item_id: string | null;
          quantity_ordered: number;
          quantity_received: number;
          unit_price: number;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          purchase_order_id: string;
          inventory_item_id: string;
          supplier_item_id?: string | null;
          quantity_ordered: number;
          quantity_received?: number;
          unit_price?: number;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          purchase_order_id?: string;
          inventory_item_id?: string;
          supplier_item_id?: string | null;
          quantity_ordered?: number;
          quantity_received?: number;
          unit_price?: number;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey";
            columns: ["purchase_order_id"];
            referencedRelation: "purchase_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchase_order_items_inventory_item_id_fkey";
            columns: ["inventory_item_id"];
            referencedRelation: "inventory_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchase_order_items_supplier_item_id_fkey";
            columns: ["supplier_item_id"];
            referencedRelation: "supplier_items";
            referencedColumns: ["id"];
          },
        ];
      };
      alert_preferences: {
        Row: {
          id: string;
          store_id: string;
          user_id: string;
          low_stock_enabled: boolean;
          critical_stock_enabled: boolean;
          missing_count_enabled: boolean;
          low_stock_threshold: number;
          alert_frequency: string;
          email_enabled: boolean;
          preferred_hour: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          user_id: string;
          low_stock_enabled?: boolean;
          critical_stock_enabled?: boolean;
          missing_count_enabled?: boolean;
          low_stock_threshold?: number;
          alert_frequency?: string;
          email_enabled?: boolean;
          preferred_hour?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          user_id?: string;
          low_stock_enabled?: boolean;
          critical_stock_enabled?: boolean;
          missing_count_enabled?: boolean;
          low_stock_threshold?: number;
          alert_frequency?: string;
          email_enabled?: boolean;
          preferred_hour?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "alert_preferences_store_id_fkey";
            columns: ["store_id"];
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alert_preferences_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      alert_history: {
        Row: {
          id: string;
          store_id: string;
          user_id: string;
          alert_type: string;
          channel: string;
          subject: string;
          item_count: number;
          status: string;
          error_message: string | null;
          metadata: Json;
          sent_at: string;
          acknowledged_at: string | null;
        };
        Insert: {
          id?: string;
          store_id: string;
          user_id: string;
          alert_type: string;
          channel?: string;
          subject: string;
          item_count?: number;
          status?: string;
          error_message?: string | null;
          metadata?: Json;
          sent_at?: string;
          acknowledged_at?: string | null;
        };
        Update: {
          id?: string;
          store_id?: string;
          user_id?: string;
          alert_type?: string;
          channel?: string;
          subject?: string;
          item_count?: number;
          status?: string;
          error_message?: string | null;
          metadata?: Json;
          sent_at?: string;
          acknowledged_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "alert_history_store_id_fkey";
            columns: ["store_id"];
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alert_history_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      api_keys: {
        Row: {
          id: string;
          store_id: string;
          created_by: string;
          name: string;
          key_prefix: string;
          key_hash: string;
          scopes: string[];
          is_active: boolean;
          last_used_at: string | null;
          expires_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          created_by: string;
          name: string;
          key_prefix: string;
          key_hash: string;
          scopes?: string[];
          is_active?: boolean;
          last_used_at?: string | null;
          expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          created_by?: string;
          name?: string;
          key_prefix?: string;
          key_hash?: string;
          scopes?: string[];
          is_active?: boolean;
          last_used_at?: string | null;
          expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "api_keys_store_id_fkey";
            columns: ["store_id"];
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "api_keys_created_by_fkey";
            columns: ["created_by"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      webhook_endpoints: {
        Row: {
          id: string;
          store_id: string;
          created_by: string;
          url: string;
          secret: string;
          events: string[];
          is_active: boolean;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          created_by: string;
          url: string;
          secret: string;
          events?: string[];
          is_active?: boolean;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          created_by?: string;
          url?: string;
          secret?: string;
          events?: string[];
          is_active?: boolean;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "webhook_endpoints_store_id_fkey";
            columns: ["store_id"];
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "webhook_endpoints_created_by_fkey";
            columns: ["created_by"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      webhook_deliveries: {
        Row: {
          id: string;
          webhook_endpoint_id: string;
          store_id: string;
          event_type: string;
          payload: Json;
          status: string;
          response_status: number | null;
          response_body: string | null;
          attempt_count: number;
          last_attempt_at: string | null;
          delivered_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          webhook_endpoint_id: string;
          store_id: string;
          event_type: string;
          payload: Json;
          status?: string;
          response_status?: number | null;
          response_body?: string | null;
          attempt_count?: number;
          last_attempt_at?: string | null;
          delivered_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          webhook_endpoint_id?: string;
          store_id?: string;
          event_type?: string;
          payload?: Json;
          status?: string;
          response_status?: number | null;
          response_body?: string | null;
          attempt_count?: number;
          last_attempt_at?: string | null;
          delivered_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_webhook_endpoint_id_fkey";
            columns: ["webhook_endpoint_id"];
            referencedRelation: "webhook_endpoints";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "webhook_deliveries_store_id_fkey";
            columns: ["store_id"];
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      pos_connections: {
        Row: {
          id: string;
          store_id: string;
          provider: string;
          name: string;
          is_active: boolean;
          credentials: Json;
          config: Json;
          last_synced_at: string | null;
          sync_status: string;
          sync_error: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          provider: string;
          name: string;
          is_active?: boolean;
          credentials?: Json;
          config?: Json;
          last_synced_at?: string | null;
          sync_status?: string;
          sync_error?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          provider?: string;
          name?: string;
          is_active?: boolean;
          credentials?: Json;
          config?: Json;
          last_synced_at?: string | null;
          sync_status?: string;
          sync_error?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pos_connections_store_id_fkey";
            columns: ["store_id"];
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pos_connections_created_by_fkey";
            columns: ["created_by"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      pos_item_mappings: {
        Row: {
          id: string;
          pos_connection_id: string;
          store_id: string;
          pos_item_id: string;
          pos_item_name: string;
          inventory_item_id: string;
          quantity_per_sale: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          pos_connection_id: string;
          store_id: string;
          pos_item_id: string;
          pos_item_name: string;
          inventory_item_id: string;
          quantity_per_sale?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          pos_connection_id?: string;
          store_id?: string;
          pos_item_id?: string;
          pos_item_name?: string;
          inventory_item_id?: string;
          quantity_per_sale?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pos_item_mappings_pos_connection_id_fkey";
            columns: ["pos_connection_id"];
            referencedRelation: "pos_connections";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pos_item_mappings_store_id_fkey";
            columns: ["store_id"];
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pos_item_mappings_inventory_item_id_fkey";
            columns: ["inventory_item_id"];
            referencedRelation: "inventory_items";
            referencedColumns: ["id"];
          },
        ];
      };
      pos_sale_events: {
        Row: {
          id: string;
          pos_connection_id: string;
          store_id: string;
          external_event_id: string;
          event_type: string;
          items: Json;
          total_amount: number | null;
          currency: string | null;
          occurred_at: string;
          processed_at: string | null;
          status: string;
          error_message: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          pos_connection_id: string;
          store_id: string;
          external_event_id: string;
          event_type?: string;
          items?: Json;
          total_amount?: number | null;
          currency?: string | null;
          occurred_at: string;
          processed_at?: string | null;
          status?: string;
          error_message?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          pos_connection_id?: string;
          store_id?: string;
          external_event_id?: string;
          event_type?: string;
          items?: Json;
          total_amount?: number | null;
          currency?: string | null;
          occurred_at?: string;
          processed_at?: string | null;
          status?: string;
          error_message?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pos_sale_events_pos_connection_id_fkey";
            columns: ["pos_connection_id"];
            referencedRelation: "pos_connections";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pos_sale_events_store_id_fkey";
            columns: ["store_id"];
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      pay_runs: {
        Row: {
          id: string;
          store_id: string;
          period_start: string;
          period_end: string;
          status: "draft" | "approved" | "paid";
          notes: string | null;
          total_amount: number;
          currency: string;
          approved_by: string | null;
          approved_at: string | null;
          paid_by: string | null;
          paid_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          period_start: string;
          period_end: string;
          status?: "draft" | "approved" | "paid";
          notes?: string | null;
          total_amount?: number;
          currency?: string;
          approved_by?: string | null;
          approved_at?: string | null;
          paid_by?: string | null;
          paid_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          period_start?: string;
          period_end?: string;
          status?: "draft" | "approved" | "paid";
          notes?: string | null;
          total_amount?: number;
          currency?: string;
          approved_by?: string | null;
          approved_at?: string | null;
          paid_by?: string | null;
          paid_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pay_runs_store_id_fkey";
            columns: ["store_id"];
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pay_runs_approved_by_fkey";
            columns: ["approved_by"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pay_runs_paid_by_fkey";
            columns: ["paid_by"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pay_runs_created_by_fkey";
            columns: ["created_by"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      pay_run_items: {
        Row: {
          id: string;
          pay_run_id: string;
          user_id: string;
          hourly_rate: number;
          total_hours: number;
          overtime_hours: number;
          adjustments: number;
          adjustment_notes: string | null;
          gross_pay: number;
          shift_ids: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          pay_run_id: string;
          user_id: string;
          hourly_rate?: number;
          total_hours?: number;
          overtime_hours?: number;
          adjustments?: number;
          adjustment_notes?: string | null;
          gross_pay?: number;
          shift_ids?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          pay_run_id?: string;
          user_id?: string;
          hourly_rate?: number;
          total_hours?: number;
          overtime_hours?: number;
          adjustments?: number;
          adjustment_notes?: string | null;
          gross_pay?: number;
          shift_ids?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pay_run_items_pay_run_id_fkey";
            columns: ["pay_run_id"];
            referencedRelation: "pay_runs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pay_run_items_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      invoices: {
        Row: {
          id: string;
          store_id: string;
          supplier_id: string | null;
          purchase_order_id: string | null;
          file_path: string;
          file_name: string;
          file_type: string;
          file_size_bytes: number | null;
          invoice_number: string | null;
          invoice_date: string | null;
          due_date: string | null;
          subtotal: number | null;
          tax_amount: number | null;
          total_amount: number | null;
          currency: string;
          extracted_data: Record<string, unknown>;
          ocr_provider: string | null;
          ocr_confidence: number | null;
          ocr_raw_response: Record<string, unknown> | null;
          ocr_processed_at: string | null;
          status: string;
          applied_reception_id: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          notes: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          supplier_id?: string | null;
          purchase_order_id?: string | null;
          file_path: string;
          file_name: string;
          file_type: string;
          file_size_bytes?: number | null;
          invoice_number?: string | null;
          invoice_date?: string | null;
          due_date?: string | null;
          subtotal?: number | null;
          tax_amount?: number | null;
          total_amount?: number | null;
          currency?: string;
          extracted_data?: Record<string, unknown>;
          ocr_provider?: string | null;
          ocr_confidence?: number | null;
          ocr_raw_response?: Record<string, unknown> | null;
          ocr_processed_at?: string | null;
          status?: string;
          applied_reception_id?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          notes?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          supplier_id?: string | null;
          purchase_order_id?: string | null;
          file_path?: string;
          file_name?: string;
          file_type?: string;
          file_size_bytes?: number | null;
          invoice_number?: string | null;
          invoice_date?: string | null;
          due_date?: string | null;
          subtotal?: number | null;
          tax_amount?: number | null;
          total_amount?: number | null;
          currency?: string;
          extracted_data?: Record<string, unknown>;
          ocr_provider?: string | null;
          ocr_confidence?: number | null;
          ocr_raw_response?: Record<string, unknown> | null;
          ocr_processed_at?: string | null;
          status?: string;
          applied_reception_id?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          notes?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      invoice_line_items: {
        Row: {
          id: string;
          invoice_id: string;
          description: string | null;
          quantity: number | null;
          unit_price: number | null;
          total_price: number | null;
          unit_of_measure: string | null;
          inventory_item_id: string | null;
          match_confidence: number | null;
          match_status: string;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Relationships: [
          {
            foreignKeyName: "invoice_line_items_invoice_id_fkey";
            columns: ["invoice_id"];
            referencedRelation: "invoices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoice_line_items_inventory_item_id_fkey";
            columns: ["inventory_item_id"];
            referencedRelation: "inventory_items";
            referencedColumns: ["id"];
          },
        ];
        Insert: {
          id?: string;
          invoice_id: string;
          description?: string | null;
          quantity?: number | null;
          unit_price?: number | null;
          total_price?: number | null;
          unit_of_measure?: string | null;
          inventory_item_id?: string | null;
          match_confidence?: number | null;
          match_status?: string;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          invoice_id?: string;
          description?: string | null;
          quantity?: number | null;
          unit_price?: number | null;
          total_price?: number | null;
          unit_of_measure?: string | null;
          inventory_item_id?: string | null;
          match_confidence?: number | null;
          match_status?: string;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      accounting_connections: {
        Row: {
          id: string;
          store_id: string;
          provider: string;
          credentials: Json;
          config: Json;
          is_active: boolean;
          last_synced_at: string | null;
          sync_status: string;
          sync_error: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          provider: string;
          credentials?: Json;
          config?: Json;
          is_active?: boolean;
          last_synced_at?: string | null;
          sync_status?: string;
          sync_error?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          provider?: string;
          credentials?: Json;
          config?: Json;
          is_active?: boolean;
          last_synced_at?: string | null;
          sync_status?: string;
          sync_error?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "accounting_connections_store_id_fkey";
            columns: ["store_id"];
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      accounting_sync_log: {
        Row: {
          id: string;
          connection_id: string;
          store_id: string;
          entity_type: string;
          entity_id: string;
          external_id: string | null;
          direction: string;
          status: string;
          error_message: string | null;
          payload: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          connection_id: string;
          store_id: string;
          entity_type: string;
          entity_id: string;
          external_id?: string | null;
          direction: string;
          status?: string;
          error_message?: string | null;
          payload?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          connection_id?: string;
          store_id?: string;
          entity_type?: string;
          entity_id?: string;
          external_id?: string | null;
          direction?: string;
          status?: string;
          error_message?: string | null;
          payload?: Json | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "accounting_sync_log_connection_id_fkey";
            columns: ["connection_id"];
            referencedRelation: "accounting_connections";
            referencedColumns: ["id"];
          },
        ];
      };
      integration_oauth_states: {
        Row: {
          id: string;
          store_id: string;
          provider: string;
          state_token: string;
          redirect_data: Json;
          expires_at: string;
          used_at: string | null;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          provider: string;
          state_token: string;
          redirect_data?: Json;
          expires_at: string;
          used_at?: string | null;
          created_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          provider?: string;
          state_token?: string;
          redirect_data?: Json;
          expires_at?: string;
          used_at?: string | null;
          created_by?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      supplier_portal_tokens: {
        Row: {
          id: string;
          supplier_id: string;
          store_id: string;
          token_hash: string;
          token_prefix: string;
          can_view_orders: boolean;
          can_upload_invoices: boolean;
          can_update_catalog: boolean;
          can_update_order_status: boolean;
          name: string;
          is_active: boolean;
          last_used_at: string | null;
          expires_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          supplier_id: string;
          store_id: string;
          token_hash: string;
          token_prefix: string;
          can_view_orders?: boolean;
          can_upload_invoices?: boolean;
          can_update_catalog?: boolean;
          can_update_order_status?: boolean;
          name?: string;
          is_active?: boolean;
          last_used_at?: string | null;
          expires_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          supplier_id?: string;
          store_id?: string;
          token_hash?: string;
          token_prefix?: string;
          can_view_orders?: boolean;
          can_upload_invoices?: boolean;
          can_update_catalog?: boolean;
          can_update_order_status?: boolean;
          name?: string;
          is_active?: boolean;
          last_used_at?: string | null;
          expires_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      supplier_portal_activity: {
        Row: {
          id: string;
          supplier_id: string;
          store_id: string;
          token_id: string | null;
          action: string;
          details: Json;
          ip_address: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          supplier_id: string;
          store_id: string;
          token_id?: string | null;
          action: string;
          details?: Json;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          supplier_id?: string;
          store_id?: string;
          token_id?: string | null;
          action?: string;
          details?: Json;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      haccp_check_templates: {
        Row: {
          id: string;
          store_id: string;
          name: string;
          description: string | null;
          frequency: "daily" | "weekly" | "shift";
          items: Json;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          name: string;
          description?: string | null;
          frequency?: "daily" | "weekly" | "shift";
          items?: Json;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          name?: string;
          description?: string | null;
          frequency?: "daily" | "weekly" | "shift";
          items?: Json;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "haccp_check_templates_store_id_fkey";
            columns: ["store_id"];
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      haccp_checks: {
        Row: {
          id: string;
          store_id: string;
          template_id: string | null;
          completed_by: string;
          completed_at: string;
          status: "pass" | "fail" | "partial";
          items: Json;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          template_id?: string | null;
          completed_by: string;
          completed_at?: string;
          status?: "pass" | "fail" | "partial";
          items?: Json;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          template_id?: string | null;
          completed_by?: string;
          completed_at?: string;
          status?: "pass" | "fail" | "partial";
          items?: Json;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "haccp_checks_store_id_fkey";
            columns: ["store_id"];
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "haccp_checks_template_id_fkey";
            columns: ["template_id"];
            referencedRelation: "haccp_check_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      haccp_temperature_logs: {
        Row: {
          id: string;
          store_id: string;
          location_name: string;
          temperature_celsius: number;
          recorded_by: string;
          recorded_at: string;
          is_in_range: boolean;
          min_temp: number | null;
          max_temp: number | null;
          corrective_action: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          location_name: string;
          temperature_celsius: number;
          recorded_by: string;
          recorded_at?: string;
          is_in_range?: boolean;
          min_temp?: number | null;
          max_temp?: number | null;
          corrective_action?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          location_name?: string;
          temperature_celsius?: number;
          recorded_by?: string;
          recorded_at?: string;
          is_in_range?: boolean;
          min_temp?: number | null;
          max_temp?: number | null;
          corrective_action?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "haccp_temperature_logs_store_id_fkey";
            columns: ["store_id"];
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      haccp_corrective_actions: {
        Row: {
          id: string;
          store_id: string;
          check_id: string | null;
          temp_log_id: string | null;
          description: string;
          action_taken: string | null;
          resolved_by: string | null;
          resolved_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          check_id?: string | null;
          temp_log_id?: string | null;
          description: string;
          action_taken?: string | null;
          resolved_by?: string | null;
          resolved_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          check_id?: string | null;
          temp_log_id?: string | null;
          description?: string;
          action_taken?: string | null;
          resolved_by?: string | null;
          resolved_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "haccp_corrective_actions_store_id_fkey";
            columns: ["store_id"];
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "haccp_corrective_actions_check_id_fkey";
            columns: ["check_id"];
            referencedRelation: "haccp_checks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "haccp_corrective_actions_temp_log_id_fkey";
            columns: ["temp_log_id"];
            referencedRelation: "haccp_temperature_logs";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      is_store_subscription_active: {
        Args: { p_store_id: string };
        Returns: boolean;
      };
      get_trial_days_remaining: {
        Args: { p_store_id: string };
        Returns: number;
      };
      cleanup_expired_invites: {
        Args: Record<string, never>;
        Returns: number;
      };
      get_items_by_category: {
        Args: { p_store_id: string };
        Returns: {
          category_id: string;
          category_name: string;
          category_color: string | null;
          item_count: number;
        }[];
      };
    };
    Enums: {
      user_role: "Owner" | "Manager" | "Staff" | "Admin";
      user_status: "Invited" | "Active" | "Inactive";
      stock_action_type:
        | "Count"
        | "Reception"
        | "Adjustment"
        | "Waste"
        | "Sale";
      store_user_role: "Owner" | "Manager" | "Staff";
      subscription_status:
        | "trialing"
        | "active"
        | "past_due"
        | "canceled"
        | "unpaid";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

// Helper types for easier usage
export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type Insertable<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type Updatable<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
export type Enums<T extends keyof Database["public"]["Enums"]> =
  Database["public"]["Enums"][T];
