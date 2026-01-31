// Application role types - Only 3 roles: Admin, Driver, Staff (NO Manager)
export type AppRole = 'Admin' | 'Driver' | 'Staff';

export type UserStatus = 'Invited' | 'Active' | 'Inactive';

export type StockActionType = 'Count' | 'Reception' | 'Adjustment';

// Day of week for operating hours
export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

// Shift time slot (start and end time for a shift pattern)
export interface ShiftTimeSlot {
  start_time: string; // HH:MM format (e.g., "09:00")
  end_time: string;   // HH:MM format (e.g., "17:00")
}

// Operating hours and shift patterns for a single day
export interface DayHours {
  is_open: boolean;
  opening_time: string | null; // HH:MM format - when store opens
  closing_time: string | null; // HH:MM format - when store closes
  // Shift patterns for this day
  shifts?: {
    opening?: ShiftTimeSlot;  // Opening shift times
    mid?: ShiftTimeSlot;      // Mid-day shift times
    closing?: ShiftTimeSlot;  // Closing shift times
  };
}

// Weekly operating hours schedule
export type WeeklyHours = Record<DayOfWeek, DayHours>;

// Database table types
export interface Store {
  id: string;
  name: string;
  address: string | null;
  is_active: boolean;
  opening_time: string | null; // Default HH:MM format (e.g., "06:00") - kept for backwards compatibility
  closing_time: string | null; // Default HH:MM format (e.g., "23:00") - kept for backwards compatibility
  weekly_hours: WeeklyHours | null; // Per-day operating hours
  created_at: string;
  updated_at: string;
}

// Shift pattern preset
export interface ShiftPattern {
  id: string;
  name: string; // e.g., "Opening", "Mid", "Closing"
  start_offset_hours: number; // Hours after store opens (0 = opening time)
  duration_hours: number; // Length of shift
  color: string; // For visual display
}

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: AppRole;
  store_id: string | null;
  status: UserStatus;
  created_at: string;
  updated_at: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  category: string | null;
  unit_of_measure: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface StoreInventory {
  id: string;
  store_id: string;
  inventory_item_id: string;
  quantity: number;
  par_level: number | null;
  last_updated_at: string;
  last_updated_by: string | null;
  // Joined fields
  inventory_item?: InventoryItem;
  store?: Store;
}

export interface StockHistory {
  id: string;
  store_id: string;
  inventory_item_id: string;
  action_type: StockActionType;
  quantity_before: number | null;
  quantity_after: number | null;
  quantity_change: number | null;
  performed_by: string | null;
  notes: string | null;
  created_at: string;
  // Joined fields
  inventory_item?: InventoryItem;
  store?: Store;
  performer?: Profile;
}

export interface Shift {
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
  // Joined fields
  store?: Store;
  user?: Profile;
}

export interface DailyCount {
  id: string;
  store_id: string;
  count_date: string;
  submitted_by: string | null;
  submitted_at: string;
  // Joined fields
  store?: Store;
  submitter?: Profile;
}

// Form types
export interface StockCountItem {
  inventory_item_id: string;
  name: string;
  unit_of_measure: string;
  current_quantity: number;
  new_quantity: number | null;
}

export interface StockReceptionItem {
  inventory_item_id: string;
  name: string;
  unit_of_measure: string;
  quantity_received: number;
}

// Auth types
export interface AuthUser {
  id: string;
  email: string;
  profile: Profile | null;
}

// Navigation item type
export interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: AppRole[];
}

// Report types
export interface DailySummaryReport {
  date: string;
  store_id: string;
  store_name: string;
  total_counts: number;
  total_receptions: number;
  stock_changes: StockHistory[];
}

export interface LowStockItem {
  store_id: string;
  store_name: string;
  inventory_item_id: string;
  item_name: string;
  current_quantity: number;
  par_level: number;
  shortage: number;
}

// Dashboard stats
export interface AdminDashboardStats {
  total_stores: number;
  total_users: number;
  stores_missing_count: number;
  low_stock_alerts: number;
}

export interface DriverDashboardStats {
  total_stores: number;
  recent_deliveries: StockHistory[];
}

export interface StaffDashboardStats {
  store: Store | null;
  today_count_completed: boolean;
  current_shift: Shift | null;
}
