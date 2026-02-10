// Application role types - 4 roles: Owner, Manager, Staff, Driver
// Owner: Full access to owned/co-owned stores, billing, invite users
// Manager: Full operational access to assigned store
// Staff: Clock in/out, stock counts at assigned store
// Driver: Deliveries/receptions across assigned stores
export type AppRole = 'Owner' | 'Manager' | 'Staff' | 'Driver';

// Legacy role type for backward compatibility during migration
export type LegacyAppRole = 'Admin' | 'Driver' | 'Staff';

export type UserStatus = 'Invited' | 'Active' | 'Inactive';

export type StockActionType = 'Count' | 'Reception' | 'Adjustment' | 'Waste' | 'Sale';

// Waste tracking types
export type WasteReason = 'spoilage' | 'damaged' | 'expired' | 'overproduction' | 'other';

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

// Subscription status for billing
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid';

// Database table types
export interface Store {
  id: string;
  name: string;
  address: string | null;
  is_active: boolean;
  opening_time: string | null; // Default HH:MM format (e.g., "06:00") - kept for backwards compatibility
  closing_time: string | null; // Default HH:MM format (e.g., "23:00") - kept for backwards compatibility
  weekly_hours: WeeklyHours | null; // Per-day operating hours
  billing_user_id: string | null; // User responsible for paying for this store
  subscription_status: string | null; // Current subscription status
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
  phone: string | null; // User's phone number
  role: AppRole | LegacyAppRole; // Kept for backward compatibility, use store_users for new system
  store_id: string | null; // Deprecated - use store_users for multi-store access
  is_platform_admin: boolean; // Super-admin access for platform support
  default_store_id: string | null; // User's preferred store for quick access
  stripe_customer_id: string | null; // Stripe customer ID for billing
  status: UserStatus;
  created_at: string;
  updated_at: string;
  // Joined fields for multi-tenant
  store_memberships?: StoreUser[];
}

// Store-User relationship for multi-tenant access
export interface StoreUser {
  id: string;
  store_id: string;
  user_id: string;
  role: AppRole;
  is_billing_owner: boolean; // True if this user pays for this store
  invited_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  store?: Store;
  user?: Profile;
}

// StoreUser with required store (for auth context)
export interface StoreUserWithStore extends StoreUser {
  store: Store;
}

// User invitation for email-based onboarding
export interface UserInvite {
  id: string;
  email: string;
  role: AppRole;
  store_id: string | null;
  store_ids: string[]; // For Driver role - multiple stores
  token: string;
  invited_by: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  store?: Store;
  inviter?: Profile;
}

// Subscription for billing (Stripe integration deferred)
export interface Subscription {
  id: string;
  store_id: string;
  billing_user_id: string;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  status: SubscriptionStatus;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
  // Joined fields
  store?: Store;
  billing_user?: Profile;
}

export interface InventoryItem {
  id: string;
  store_id: string; // Store that owns this inventory item (multi-tenant isolation)
  name: string;
  category: string | null;
  category_id: string | null;
  unit_of_measure: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Joined fields
  store?: Store;
}

export interface StoreInventory {
  id: string;
  store_id: string;
  inventory_item_id: string;
  quantity: number;
  par_level: number | null;
  unit_cost: number;
  cost_currency: string;
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
  stores: StoreUserWithStore[]; // User's store memberships with store data
  currentStore: StoreUserWithStore | null; // Currently selected store context
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
export interface OwnerDashboardStats {
  total_stores: number;
  total_users: number;
  stores_missing_count: number;
  low_stock_alerts: number;
}

// Legacy alias for backward compatibility
export type AdminDashboardStats = OwnerDashboardStats;

export interface ManagerDashboardStats {
  store: Store | null;
  total_users: number;
  today_count_completed: boolean;
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

// Audit log types
export type AuditCategory =
  | 'auth'      // Login, logout, password reset
  | 'user'      // User management (invite, role change, deactivate)
  | 'store'     // Store management (create, update, delete)
  | 'stock'     // Stock operations (count, reception, adjustment)
  | 'inventory' // Inventory item management
  | 'shift'     // Shift/schedule management
  | 'settings'  // Settings changes
  | 'report'    // Report generation/export
  | 'supplier'; // Supplier & purchase order management

export interface AuditLog {
  id: string;
  user_id: string | null;
  user_email: string | null;
  action: string;
  action_category: AuditCategory;
  store_id: string | null;
  resource_type: string | null;
  resource_id: string | null;
  details: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  // Joined fields
  user?: Profile;
  store?: Store;
}

// Waste log
export interface WasteLog {
  id: string;
  store_id: string;
  inventory_item_id: string;
  quantity: number;
  reason: WasteReason;
  notes: string | null;
  estimated_cost: number;
  reported_by: string;
  reported_at: string;
  created_at: string;
  // Joined fields
  inventory_item?: InventoryItem;
  reporter?: Profile;
}

// Recipe & Menu types
export interface Recipe {
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
  // Joined/computed fields
  ingredients?: RecipeIngredient[];
  total_cost?: number;
  cost_per_unit?: number;
  store?: Store;
}

export interface RecipeIngredient {
  id: string;
  recipe_id: string;
  inventory_item_id: string;
  quantity: number;
  unit_of_measure: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined/computed fields
  inventory_item?: InventoryItem;
  unit_cost?: number;
  line_cost?: number;
}

export interface MenuItem {
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
  // Joined/computed fields
  recipe?: Recipe;
  food_cost?: number;
  food_cost_percentage?: number;
  profit_margin?: number;
  store?: Store;
}

// Purchase order types
export type PurchaseOrderStatus = 'draft' | 'submitted' | 'acknowledged' | 'shipped' | 'partial' | 'received' | 'cancelled';

export interface Supplier {
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
  created_at: string;
  updated_at: string;
  store?: Store;
}

export interface SupplierItem {
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
  supplier?: Supplier;
  inventory_item?: InventoryItem;
}

export interface PurchaseOrder {
  id: string;
  store_id: string;
  supplier_id: string;
  po_number: string;
  status: PurchaseOrderStatus;
  order_date: string | null;
  expected_delivery_date: string | null;
  actual_delivery_date: string | null;
  total_amount: number;
  currency: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  supplier?: Supplier;
  items?: PurchaseOrderItem[];
}

export interface PurchaseOrderItem {
  id: string;
  purchase_order_id: string;
  inventory_item_id: string;
  supplier_item_id: string | null;
  quantity_ordered: number;
  quantity_received: number;
  unit_price: number;
  notes: string | null;
  created_at: string;
  inventory_item?: InventoryItem;
}

// Alert types
export type AlertType = 'low_stock' | 'critical_stock' | 'missing_count' | 'digest';
export type AlertFrequency = 'daily' | 'weekly' | 'never';
export type AlertChannel = 'email' | 'in_app';
export type AlertStatus = 'sent' | 'failed' | 'acknowledged';

export interface AlertPreferences {
  id: string;
  store_id: string;
  user_id: string;
  low_stock_enabled: boolean;
  critical_stock_enabled: boolean;
  missing_count_enabled: boolean;
  low_stock_threshold: number;
  alert_frequency: AlertFrequency;
  email_enabled: boolean;
  preferred_hour: number;
  created_at: string;
  updated_at: string;
}

export interface AlertHistory {
  id: string;
  store_id: string;
  user_id: string;
  alert_type: AlertType;
  channel: AlertChannel;
  subject: string;
  item_count: number;
  status: AlertStatus;
  error_message: string | null;
  metadata: Record<string, unknown>;
  sent_at: string;
  acknowledged_at: string | null;
}
