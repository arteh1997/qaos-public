// Supabase generated types for the database schema
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
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          address?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          address?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          role: 'Admin' | 'Driver' | 'Staff'
          store_id: string | null
          status: 'Invited' | 'Active' | 'Inactive'
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          role?: 'Admin' | 'Driver' | 'Staff'
          store_id?: string | null
          status?: 'Invited' | 'Active' | 'Inactive'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          role?: 'Admin' | 'Driver' | 'Staff'
          store_id?: string | null
          status?: 'Invited' | 'Active' | 'Inactive'
          created_at?: string
          updated_at?: string
        }
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
      }
      stock_history: {
        Row: {
          id: string
          store_id: string
          inventory_item_id: string
          action_type: 'Count' | 'Reception' | 'Adjustment'
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
          action_type: 'Count' | 'Reception' | 'Adjustment'
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
          action_type?: 'Count' | 'Reception' | 'Adjustment'
          quantity_before?: number | null
          quantity_after?: number | null
          quantity_change?: number | null
          performed_by?: string | null
          notes?: string | null
          created_at?: string
        }
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
      }
    }
    Enums: {
      user_role: 'Admin' | 'Driver' | 'Staff'
      user_status: 'Invited' | 'Active' | 'Inactive'
      stock_action_type: 'Count' | 'Reception' | 'Adjustment'
    }
  }
}
