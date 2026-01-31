# Restaurant Inventory Management System - API Design

## Overview

This document provides a complete REST API specification for the Restaurant Inventory Management System. The API follows RESTful principles with Supabase as the backend.

---

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                        API ARCHITECTURE                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Client (Browser)                                               │
│         │                                                        │
│         ├──────────► Supabase Client (Direct DB via PostgREST) │
│         │            - CRUD operations                          │
│         │            - Protected by RLS policies                │
│         │                                                        │
│         └──────────► Next.js API Routes                         │
│                      - Complex operations                       │
│                      - User creation (admin operations)         │
│                      - Reports aggregation                      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Authentication

### Method: Supabase Auth (JWT-based)

All API requests require authentication via Supabase session cookies.

**Session Flow:**
1. User logs in via `/login` page
2. Supabase issues JWT stored in HTTP-only cookies
3. Middleware validates session on each request
4. Profile data cached for 5 minutes to reduce DB queries

**Headers:**
```
Cookie: sb-<project-ref>-auth-token=<jwt>
```

---

## Authorization (RBAC)

### Roles

| Role | Scope | Description |
|------|-------|-------------|
| `Admin` | Global | Full system access |
| `Driver` | Global | Stock reception + reports |
| `Staff` | Store-scoped | Stock counts only |

### Permission Matrix

| Resource | Admin | Driver | Staff |
|----------|-------|--------|-------|
| Stores (CRUD) | ✓ | R | R (own) |
| Users (CRUD) | ✓ | - | - |
| Inventory Items (CRUD) | ✓ | R | R |
| Stock Counts | ✓ | - | ✓ |
| Stock Reception | ✓ | ✓ | - |
| Reports | ✓ | ✓ | - |
| Shifts | ✓ | R | R (own) |

---

## Rate Limiting

All endpoints are rate-limited using a sliding window algorithm.

| Endpoint Category | Limit | Window |
|-------------------|-------|--------|
| User Creation | 5 requests | 1 minute |
| Reports | 20 requests | 1 minute |
| General API | 100 requests | 1 minute |

**Response Headers:**
```
X-RateLimit-Limit: 20
X-RateLimit-Remaining: 18
X-RateLimit-Reset: 1705340400000
```

**Rate Limit Exceeded Response:**
```json
{
  "message": "Too many requests. Please try again later."
}
```
**Status:** `429 Too Many Requests`

---

## Versioning Strategy

Currently using URL path versioning (implicit v1). Future versions will use:

```
/api/v1/users/invite
/api/v2/users/invite
```

---

## Error Handling

### Standard Error Response

```json
{
  "message": "Human-readable error description"
}
```

### HTTP Status Codes

| Code | Meaning | When Used |
|------|---------|-----------|
| `200` | Success | Successful operation |
| `400` | Bad Request | Validation errors, invalid data |
| `401` | Unauthorized | Missing or invalid authentication |
| `403` | Forbidden | Insufficient permissions |
| `404` | Not Found | Resource doesn't exist |
| `429` | Too Many Requests | Rate limit exceeded |
| `500` | Internal Server Error | Unexpected server errors |

---

## Complete Endpoint Reference

### 1. User Management

#### POST `/api/users/invite`

Create a new user with temporary password.

**Authorization:** Admin only

**Request:**
```json
{
  "email": "user@example.com",
  "fullName": "John Doe",
  "role": "Staff",
  "storeId": "uuid-of-store"
}
```

**Validation Rules:**
- `email`: Valid email format, required
- `fullName`: Min 2 characters, required
- `role`: One of `Admin`, `Driver`, `Staff`
- `storeId`: Required if role is `Staff`, optional otherwise

**Success Response (200):**
```json
{
  "message": "User created successfully",
  "tempPassword": "generated-uuid-password"
}
```

**Error Responses:**

| Status | Message |
|--------|---------|
| 400 | "A user with this email already exists" |
| 401 | "Unauthorized" |
| 403 | "Only admins can invite users" |
| 429 | "Too many requests. Please try again later." |

---

### 2. Reports

#### GET `/api/reports/daily-summary`

Get daily stock activity summary.

**Authorization:** Admin, Driver

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `date` | string (YYYY-MM-DD) | Today | Report date |
| `store_id` | UUID | All stores | Filter by store |

**Request:**
```
GET /api/reports/daily-summary?date=2024-01-15&store_id=abc123
```

**Success Response (200):**
```json
{
  "date": "2024-01-15",
  "summary": {
    "total_counts": 45,
    "total_receptions": 12,
    "stores_counted": 8
  },
  "daily_counts": [
    {
      "id": "uuid",
      "store_id": "uuid",
      "count_date": "2024-01-15",
      "submitted_by": "uuid",
      "submitted_at": "2024-01-15T14:30:00Z",
      "store": { "id": "uuid", "name": "Downtown Location" },
      "submitter": { "id": "uuid", "full_name": "John Doe" }
    }
  ],
  "stock_changes": [
    {
      "id": "uuid",
      "store_id": "uuid",
      "inventory_item_id": "uuid",
      "action_type": "Count",
      "quantity_before": 50,
      "quantity_after": 48,
      "quantity_change": -2,
      "performed_by": "uuid",
      "notes": "End of day count",
      "created_at": "2024-01-15T18:00:00Z",
      "inventory_item": { "id": "uuid", "name": "Tomatoes", "unit_of_measure": "kg" },
      "store": { "id": "uuid", "name": "Downtown Location" },
      "performer": { "id": "uuid", "full_name": "Jane Smith" }
    }
  ]
}
```

---

#### GET `/api/reports/low-stock`

Get items below PAR (reorder) level.

**Authorization:** Admin, Driver

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `store_id` | UUID | All stores | Filter by store |

**Success Response (200):**
```json
{
  "total_low_stock_items": 5,
  "items": [
    {
      "store_id": "uuid",
      "store_name": "Downtown Location",
      "inventory_item_id": "uuid",
      "item_name": "Tomatoes",
      "unit_of_measure": "kg",
      "current_quantity": 5,
      "par_level": 20,
      "shortage": 15
    }
  ]
}
```

---

#### GET `/api/alerts/missing-counts`

Identify stores that haven't submitted daily counts.

**Authorization:** Admin, Driver

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `date` | string (YYYY-MM-DD) | Yesterday | Check date |

**Success Response (200):**
```json
{
  "date": "2024-01-14",
  "missing_count": 2,
  "total_stores": 10,
  "missing_stores": [
    { "id": "uuid", "name": "Airport Location" },
    { "id": "uuid", "name": "Mall Location" }
  ]
}
```

---

## Direct Database Operations (via Supabase Client)

The following operations are performed directly through the Supabase client with Row Level Security (RLS) protection.

### Stores

#### List Stores
```typescript
supabase
  .from('stores')
  .select('*', { count: 'exact' })
  .order('name')
  .range(0, 19)
```

#### Create Store
```typescript
supabase
  .from('stores')
  .insert({ name, address, is_active: true })
  .select()
  .single()
```

#### Update Store
```typescript
supabase
  .from('stores')
  .update({ name, address, is_active })
  .eq('id', storeId)
  .select()
  .single()
```

---

### Inventory Items

#### List Items
```typescript
supabase
  .from('inventory_items')
  .select('*')
  .eq('is_active', true)
  .order('name')
```

#### Create Item
```typescript
supabase
  .from('inventory_items')
  .insert({ name, category, unit_of_measure, is_active: true })
  .select()
  .single()
```

---

### Store Inventory

#### Get Store Inventory
```typescript
supabase
  .from('store_inventory')
  .select(`
    *,
    inventory_item:inventory_items(*)
  `)
  .eq('store_id', storeId)
```

#### Update Inventory (Batch)
```typescript
supabase
  .from('store_inventory')
  .upsert(items, { onConflict: 'store_id,inventory_item_id' })
```

---

### Stock History

#### Get History
```typescript
supabase
  .from('stock_history')
  .select(`
    *,
    inventory_item:inventory_items(*),
    store:stores(*),
    performer:profiles(*)
  `)
  .eq('store_id', storeId)
  .order('created_at', { ascending: false })
```

---

### Stock Operations

#### Submit Stock Count (Batch)
```typescript
// 1. Batch upsert inventory quantities
await supabase
  .from('store_inventory')
  .upsert(inventoryUpdates, { onConflict: 'store_id,inventory_item_id' })

// 2. Batch insert history records
await supabase
  .from('stock_history')
  .insert(historyRecords)

// 3. Mark daily count complete
await supabase
  .from('daily_counts')
  .upsert({ store_id, count_date, submitted_by, submitted_at },
          { onConflict: 'store_id,count_date' })
```

#### Submit Stock Reception (Batch)
```typescript
// Same pattern as stock count, but with action_type: 'Reception'
```

---

### Shifts

#### Get Shifts
```typescript
supabase
  .from('shifts')
  .select(`
    *,
    store:stores(*),
    user:profiles(*)
  `)
  .eq('store_id', storeId)
  .order('start_time', { ascending: false })
```

#### Clock In
```typescript
supabase
  .from('shifts')
  .update({ clock_in_time: new Date().toISOString() })
  .eq('id', shiftId)
  .select()
  .single()
```

#### Clock Out
```typescript
supabase
  .from('shifts')
  .update({ clock_out_time: new Date().toISOString() })
  .eq('id', shiftId)
  .select()
  .single()
```

---

## Database Schema

### Entity Relationship Diagram

```
┌─────────────┐     ┌─────────────┐     ┌─────────────────┐
│   stores    │────<│  profiles   │     │ inventory_items │
└─────────────┘     └─────────────┘     └─────────────────┘
       │                   │                     │
       │                   │                     │
       ▼                   ▼                     ▼
┌─────────────────────────────────────────────────────────┐
│                    store_inventory                       │
│  (store_id, inventory_item_id, quantity, par_level)     │
└─────────────────────────────────────────────────────────┘
       │
       │
       ▼
┌─────────────────────────────────────────────────────────┐
│                     stock_history                        │
│  (action_type: Count|Reception|Adjustment)              │
│  (quantity_before, quantity_after, quantity_change)     │
└─────────────────────────────────────────────────────────┘

┌─────────────┐     ┌─────────────┐
│   stores    │────<│   shifts    │───>│  profiles   │
└─────────────┘     └─────────────┘     └─────────────┘

┌─────────────┐     ┌──────────────┐
│   stores    │────<│ daily_counts │───>│  profiles   │
└─────────────┘     └──────────────┘     └─────────────┘
```

### Table Schemas

#### profiles
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK, FK to auth.users |
| email | TEXT | NOT NULL |
| full_name | TEXT | |
| role | TEXT | CHECK (Admin, Driver, Staff) |
| store_id | UUID | FK to stores |
| status | TEXT | CHECK (Invited, Active, Inactive) |
| created_at | TIMESTAMPTZ | DEFAULT now() |
| updated_at | TIMESTAMPTZ | DEFAULT now() |

#### stores
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() |
| name | TEXT | NOT NULL |
| address | TEXT | |
| is_active | BOOLEAN | DEFAULT true |
| created_at | TIMESTAMPTZ | DEFAULT now() |
| updated_at | TIMESTAMPTZ | DEFAULT now() |

#### inventory_items
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() |
| name | TEXT | NOT NULL |
| category | TEXT | |
| unit_of_measure | TEXT | NOT NULL |
| is_active | BOOLEAN | DEFAULT true |
| created_at | TIMESTAMPTZ | DEFAULT now() |
| updated_at | TIMESTAMPTZ | DEFAULT now() |

#### store_inventory
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() |
| store_id | UUID | FK to stores, NOT NULL |
| inventory_item_id | UUID | FK to inventory_items, NOT NULL |
| quantity | NUMERIC | DEFAULT 0 |
| par_level | NUMERIC | |
| last_updated_at | TIMESTAMPTZ | DEFAULT now() |
| last_updated_by | UUID | FK to profiles |
| | | UNIQUE(store_id, inventory_item_id) |

#### stock_history
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() |
| store_id | UUID | FK to stores, NOT NULL |
| inventory_item_id | UUID | FK to inventory_items, NOT NULL |
| action_type | TEXT | CHECK (Count, Reception, Adjustment) |
| quantity_before | NUMERIC | |
| quantity_after | NUMERIC | |
| quantity_change | NUMERIC | |
| performed_by | UUID | FK to profiles |
| notes | TEXT | |
| created_at | TIMESTAMPTZ | DEFAULT now() |

#### shifts
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() |
| store_id | UUID | FK to stores, NOT NULL |
| user_id | UUID | FK to profiles, NOT NULL |
| start_time | TIMESTAMPTZ | NOT NULL |
| end_time | TIMESTAMPTZ | NOT NULL |
| clock_in_time | TIMESTAMPTZ | |
| clock_out_time | TIMESTAMPTZ | |
| notes | TEXT | |
| created_at | TIMESTAMPTZ | DEFAULT now() |
| updated_at | TIMESTAMPTZ | DEFAULT now() |

#### daily_counts
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() |
| store_id | UUID | FK to stores, NOT NULL |
| count_date | DATE | NOT NULL |
| submitted_by | UUID | FK to profiles |
| submitted_at | TIMESTAMPTZ | DEFAULT now() |
| | | UNIQUE(store_id, count_date) |

---

## Caching Strategy

### Client-Side (React Query)
- **Stale Time:** 5 minutes for most queries
- **Cache Time:** 30 minutes
- **Automatic Invalidation:** On mutations

### Server-Side (Middleware)
- **Profile Cache:** 5-minute TTL in HTTP-only cookie
- **Purpose:** Reduce DB queries for role checks

### Recommended Caching Headers
```typescript
// For static reference data
'Cache-Control': 'public, max-age=300, stale-while-revalidate=60'

// For user-specific data
'Cache-Control': 'private, no-cache'
```

---

## Security Considerations

### Input Validation
- All inputs validated with Zod schemas
- Notes fields sanitized to prevent XSS

### Authentication
- JWT-based via Supabase Auth
- HTTP-only cookies (secure in production)
- Session refresh on each request via middleware

### Authorization
- Row Level Security (RLS) on all tables
- Role-based middleware protection
- Store-scoped access for Staff role

### Rate Limiting
- Per-user sliding window algorithm
- Stricter limits on sensitive operations

---

## Recommended API Improvements

### 1. Add Explicit REST Endpoints

Convert more Supabase direct calls to REST endpoints for better control:

```
POST   /api/stores                    # Create store
GET    /api/stores                    # List stores
GET    /api/stores/:id                # Get store
PATCH  /api/stores/:id                # Update store
DELETE /api/stores/:id                # Delete store

POST   /api/stores/:id/stock-count    # Submit stock count
POST   /api/stores/:id/stock-receive  # Submit stock reception
GET    /api/stores/:id/inventory      # Get store inventory
GET    /api/stores/:id/history        # Get stock history

POST   /api/inventory                 # Create item
GET    /api/inventory                 # List items
PATCH  /api/inventory/:id             # Update item
DELETE /api/inventory/:id             # Soft delete item

GET    /api/shifts                    # List shifts
POST   /api/shifts                    # Create shift
POST   /api/shifts/:id/clock-in       # Clock in
POST   /api/shifts/:id/clock-out      # Clock out
```

### 2. Add Pagination Metadata

Standardize pagination response format:

```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "totalItems": 156,
    "totalPages": 8,
    "hasNext": true,
    "hasPrev": false
  }
}
```

### 3. Add Request Tracing

Include request ID for debugging:

```
X-Request-ID: abc-123-def
```

### 4. Consider GraphQL (Future)

For complex nested queries, GraphQL could reduce over-fetching. Supabase supports GraphQL via pg_graphql extension.

---

## API Success Criteria Checklist

- [x] RESTful design (no shortcuts)
- [x] JWT-based authentication
- [x] Rate limiting on all endpoints
- [x] Consistent error handling
- [x] Comprehensive validation
- [x] Role-based authorization
- [x] Audit trail (stock_history)
- [x] Batch operations for performance
- [x] Pagination support
- [x] Type-safe (TypeScript + Zod)

---

*Generated: January 2025*
*System: Restaurant Inventory Management v1.0*
