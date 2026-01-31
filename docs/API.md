# API Documentation

Complete REST API reference for the Restaurant Inventory Management System.

## Base URL

```
Development: http://localhost:3000/api
Production:  https://your-domain.com/api
```

## Authentication

All API endpoints require authentication via Supabase JWT tokens.

### Request Headers

```http
Authorization: Bearer <supabase_jwt_token>
Content-Type: application/json
```

### Authentication Flow

1. User logs in via `/login` page
2. Supabase Auth issues a JWT token
3. Token is stored in HTTP-only cookies
4. Middleware validates token on each request
5. API routes verify user permissions

## Response Format

### Success Response

```json
{
  "success": true,
  "data": { ... },
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "totalItems": 100,
    "totalPages": 5,
    "hasNext": true,
    "hasPrev": false
  },
  "requestId": "req_abc123"
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "message": "Error description",
    "code": "ERROR_CODE"
  },
  "requestId": "req_abc123"
}
```

## Rate Limiting

All endpoints are rate-limited per user:

| Endpoint Category | Limit | Window |
|-------------------|-------|--------|
| General API | 100 requests | 1 minute |
| Reports | 20 requests | 1 minute |
| User Creation | 5 requests | 1 minute |
| Authentication | 10 requests | 1 minute |

### Rate Limit Headers

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1705340400000
```

### Rate Limit Exceeded (429)

```json
{
  "success": false,
  "error": {
    "message": "Too many requests. Please try again later.",
    "code": "RATE_LIMITED"
  }
}
```

---

## Stores

### List Stores

Retrieve a paginated list of all stores.

```http
GET /api/stores
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `pageSize` | number | 20 | Items per page (max: 100) |
| `search` | string | - | Search by name or address |
| `status` | string | - | Filter: `active`, `inactive`, or `all` |

**Authorization:** Admin, Driver, Staff (filtered to own store)

**Example Request:**

```bash
curl -X GET "http://localhost:3000/api/stores?page=1&pageSize=10&status=active" \
  -H "Authorization: Bearer <token>"
```

**Example Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Downtown Location",
      "address": "123 Main Street, City, ST 12345",
      "is_active": true,
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "totalItems": 25,
    "totalPages": 3,
    "hasNext": true,
    "hasPrev": false
  },
  "requestId": "req_abc123"
}
```

---

### Create Store

Create a new store location.

```http
POST /api/stores
```

**Authorization:** Admin only

**Request Body:**

```json
{
  "name": "New Location",
  "address": "456 Oak Avenue, City, ST 12345",
  "is_active": true
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Store name (1-100 chars) |
| `address` | string | No | Store address |
| `is_active` | boolean | No | Active status (default: true) |

**Example Response:**

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "name": "New Location",
    "address": "456 Oak Avenue, City, ST 12345",
    "is_active": true,
    "created_at": "2024-01-16T14:20:00Z",
    "updated_at": "2024-01-16T14:20:00Z"
  },
  "requestId": "req_def456"
}
```

---

### Get Store

Retrieve a specific store by ID.

```http
GET /api/stores/:storeId
```

**Authorization:** Admin, Driver, Staff (own store only)

**Example Response:**

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Downtown Location",
    "address": "123 Main Street, City, ST 12345",
    "is_active": true,
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z"
  },
  "requestId": "req_ghi789"
}
```

---

### Update Store

Update an existing store.

```http
PATCH /api/stores/:storeId
```

**Authorization:** Admin only

**Request Body:**

```json
{
  "name": "Updated Name",
  "address": "789 New Street",
  "is_active": false
}
```

All fields are optional. Only provided fields will be updated.

---

### Delete Store

Delete a store (soft delete by setting `is_active` to false).

```http
DELETE /api/stores/:storeId
```

**Authorization:** Admin only

**Example Response:**

```json
{
  "success": true,
  "data": {
    "message": "Store deleted successfully"
  },
  "requestId": "req_jkl012"
}
```

---

## Inventory Items

### List Inventory Items

Retrieve the global inventory item catalog.

```http
GET /api/inventory
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `pageSize` | number | 20 | Items per page (max: 100) |
| `search` | string | - | Search by name |
| `category` | string | - | Filter by category |
| `include_inactive` | boolean | false | Include inactive items |

**Authorization:** Admin only

**Example Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "660e8400-e29b-41d4-a716-446655440000",
      "name": "Tomatoes",
      "category": "Produce",
      "unit_of_measure": "lb",
      "is_active": true,
      "created_at": "2024-01-10T08:00:00Z",
      "updated_at": "2024-01-10T08:00:00Z"
    }
  ],
  "pagination": { ... },
  "requestId": "req_mno345"
}
```

---

### Create Inventory Item

Add a new item to the global catalog.

```http
POST /api/inventory
```

**Authorization:** Admin only

**Request Body:**

```json
{
  "name": "Fresh Salmon",
  "category": "Seafood",
  "unit_of_measure": "lb",
  "is_active": true
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Item name |
| `category` | string | No | Category (Produce, Meat, Dairy, etc.) |
| `unit_of_measure` | string | Yes | Unit (lb, kg, each, case, etc.) |
| `is_active` | boolean | No | Active status (default: true) |

---

### Update Inventory Item

```http
PATCH /api/inventory/:itemId
```

**Authorization:** Admin only

---

### Delete Inventory Item

Soft delete an inventory item.

```http
DELETE /api/inventory/:itemId
```

**Authorization:** Admin only

---

## Stock Operations

### Submit Stock Count

Record a daily stock count for a store.

```http
POST /api/stores/:storeId/stock-count
```

**Authorization:** Admin, Staff (own store only)

**Request Body:**

```json
{
  "items": [
    {
      "inventory_item_id": "660e8400-e29b-41d4-a716-446655440000",
      "quantity": 50
    },
    {
      "inventory_item_id": "660e8400-e29b-41d4-a716-446655440001",
      "quantity": 25
    }
  ],
  "notes": "End of day count - all items verified"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `items` | array | Yes | Array of item counts |
| `items[].inventory_item_id` | string | Yes | UUID of inventory item |
| `items[].quantity` | number | Yes | Current quantity (≥ 0) |
| `notes` | string | No | Optional notes |

**Example Response:**

```json
{
  "success": true,
  "data": {
    "message": "Stock count submitted successfully",
    "items_updated": 2,
    "daily_count_id": "770e8400-e29b-41d4-a716-446655440000"
  },
  "requestId": "req_pqr678"
}
```

**Side Effects:**
- Updates `store_inventory` table with new quantities
- Creates entries in `stock_history` with action_type = 'Count'
- Creates/updates `daily_counts` record for the store

---

### Record Stock Reception

Record incoming stock delivery.

```http
POST /api/stores/:storeId/stock-reception
```

**Authorization:** Admin, Driver

**Request Body:**

```json
{
  "items": [
    {
      "inventory_item_id": "660e8400-e29b-41d4-a716-446655440000",
      "quantity": 100
    }
  ],
  "notes": "Morning delivery from ABC Supplier"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `items` | array | Yes | Array of received items |
| `items[].inventory_item_id` | string | Yes | UUID of inventory item |
| `items[].quantity` | number | Yes | Quantity received (> 0) |
| `notes` | string | No | Delivery notes |

**Example Response:**

```json
{
  "success": true,
  "data": {
    "message": "Stock reception recorded successfully",
    "items_received": 1
  },
  "requestId": "req_stu901"
}
```

**Side Effects:**
- Adds quantity to `store_inventory` (existing + received)
- Creates entries in `stock_history` with action_type = 'Reception'

---

### Get Store Inventory

Retrieve current inventory levels for a store.

```http
GET /api/stores/:storeId/inventory
```

**Authorization:** Admin, Driver, Staff (own store only)

**Example Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "880e8400-e29b-41d4-a716-446655440000",
      "store_id": "550e8400-e29b-41d4-a716-446655440000",
      "inventory_item_id": "660e8400-e29b-41d4-a716-446655440000",
      "quantity": 50,
      "par_level": 20,
      "last_updated_at": "2024-01-16T18:00:00Z",
      "inventory_item": {
        "id": "660e8400-e29b-41d4-a716-446655440000",
        "name": "Tomatoes",
        "category": "Produce",
        "unit_of_measure": "lb"
      }
    }
  ],
  "requestId": "req_vwx234"
}
```

---

### Get Stock History

Retrieve stock change history for a store.

```http
GET /api/stores/:storeId/history
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `pageSize` | number | 50 | Items per page |
| `action_type` | string | - | Filter: `Count`, `Reception`, `Adjustment` |
| `start_date` | string | - | Start date (YYYY-MM-DD) |
| `end_date` | string | - | End date (YYYY-MM-DD) |

**Authorization:** Admin, Driver, Staff (own store only)

**Example Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "990e8400-e29b-41d4-a716-446655440000",
      "store_id": "550e8400-e29b-41d4-a716-446655440000",
      "inventory_item_id": "660e8400-e29b-41d4-a716-446655440000",
      "action_type": "Count",
      "quantity_before": 45,
      "quantity_after": 50,
      "quantity_change": 5,
      "performed_by": "aa0e8400-e29b-41d4-a716-446655440000",
      "notes": "End of day count",
      "created_at": "2024-01-16T18:00:00Z",
      "inventory_item": {
        "name": "Tomatoes",
        "unit_of_measure": "lb"
      },
      "performer": {
        "full_name": "John Smith",
        "email": "john@example.com"
      }
    }
  ],
  "pagination": { ... },
  "requestId": "req_yza567"
}
```

---

## Reports

### Daily Summary

Get a summary of stock activity for a specific date.

```http
GET /api/reports/daily-summary
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `date` | string | today | Report date (YYYY-MM-DD) |
| `store_id` | string | - | Filter by store (optional) |

**Authorization:** Admin, Driver

**Example Response:**

```json
{
  "success": true,
  "data": {
    "date": "2024-01-16",
    "summary": {
      "total_counts": 5,
      "total_receptions": 3,
      "stores_with_counts": 5,
      "stores_missing_counts": 2
    },
    "by_store": [
      {
        "store_id": "550e8400-e29b-41d4-a716-446655440000",
        "store_name": "Downtown Location",
        "count_submitted": true,
        "count_time": "2024-01-16T18:00:00Z",
        "receptions_today": 1,
        "items_counted": 45
      }
    ]
  },
  "requestId": "req_bcd890"
}
```

---

### Low Stock Report

Get items below their PAR (minimum) level.

```http
GET /api/reports/low-stock
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `store_id` | string | - | Filter by store (optional) |

**Authorization:** Admin, Driver

**Example Response:**

```json
{
  "success": true,
  "data": [
    {
      "store_id": "550e8400-e29b-41d4-a716-446655440000",
      "store_name": "Downtown Location",
      "inventory_item_id": "660e8400-e29b-41d4-a716-446655440000",
      "item_name": "Tomatoes",
      "category": "Produce",
      "unit_of_measure": "lb",
      "current_quantity": 5,
      "par_level": 20,
      "shortage": 15
    }
  ],
  "requestId": "req_efg123"
}
```

---

### Missing Counts Alert

Get stores that haven't submitted their daily count.

```http
GET /api/alerts/missing-counts
```

**Authorization:** Admin, Driver

**Example Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "name": "Airport Location",
      "address": "Terminal B, Airport",
      "last_count_date": "2024-01-15"
    }
  ],
  "requestId": "req_hij456"
}
```

---

## Shifts

### List Shifts

Retrieve shifts with optional filters.

```http
GET /api/shifts
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `pageSize` | number | 20 | Items per page |
| `store_id` | string | - | Filter by store |
| `user_id` | string | - | Filter by user |
| `start_date` | string | - | Start date (YYYY-MM-DD) |
| `end_date` | string | - | End date (YYYY-MM-DD) |

**Authorization:** Admin (all), Driver/Staff (own shifts only)

---

### Create Shift

Schedule a new shift.

```http
POST /api/shifts
```

**Authorization:** Admin only

**Request Body:**

```json
{
  "store_id": "550e8400-e29b-41d4-a716-446655440000",
  "user_id": "aa0e8400-e29b-41d4-a716-446655440000",
  "start_time": "2024-01-17T09:00:00Z",
  "end_time": "2024-01-17T17:00:00Z",
  "notes": "Opening shift"
}
```

---

### Clock In

Record clock-in time for a shift.

```http
POST /api/shifts/:shiftId/clock-in
```

**Authorization:** Admin, assigned user

**Example Response:**

```json
{
  "success": true,
  "data": {
    "message": "Clocked in successfully",
    "clock_in_time": "2024-01-17T08:55:00Z"
  },
  "requestId": "req_klm789"
}
```

---

### Clock Out

Record clock-out time for a shift.

```http
POST /api/shifts/:shiftId/clock-out
```

**Authorization:** Admin, assigned user

**Example Response:**

```json
{
  "success": true,
  "data": {
    "message": "Clocked out successfully",
    "clock_out_time": "2024-01-17T17:05:00Z",
    "total_hours": 8.17
  },
  "requestId": "req_nop012"
}
```

---

## Users

### Invite User

Create a new user and send an invitation.

```http
POST /api/users/invite
```

**Authorization:** Admin only

**Request Body:**

```json
{
  "email": "newuser@example.com",
  "fullName": "Jane Doe",
  "role": "Staff",
  "storeId": "550e8400-e29b-41d4-a716-446655440000"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | Yes | User's email address |
| `fullName` | string | Yes | User's full name |
| `role` | string | Yes | Role: `Admin`, `Driver`, or `Staff` |
| `storeId` | string | Conditional | Required for Staff role |

**Example Response:**

```json
{
  "success": true,
  "data": {
    "message": "User created successfully",
    "userId": "bb0e8400-e29b-41d4-a716-446655440000",
    "tempPassword": "abc123-def456-ghi789"
  },
  "requestId": "req_qrs345"
}
```

**Note:** The temporary password should be securely communicated to the user.

---

## Error Codes

| Status | Code | Description |
|--------|------|-------------|
| 400 | `BAD_REQUEST` | Invalid request body or parameters |
| 401 | `UNAUTHORIZED` | Missing or invalid authentication |
| 403 | `FORBIDDEN` | Insufficient permissions |
| 404 | `NOT_FOUND` | Resource not found |
| 409 | `CONFLICT` | Resource conflict (e.g., duplicate) |
| 422 | `VALIDATION_ERROR` | Request validation failed |
| 429 | `RATE_LIMITED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Server error |

---

## Validation Errors

When validation fails, the response includes field-specific errors:

```json
{
  "success": false,
  "error": {
    "message": "Validation failed",
    "code": "VALIDATION_ERROR",
    "details": [
      {
        "field": "name",
        "message": "Name is required"
      },
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ]
  },
  "requestId": "req_tuv678"
}
```

---

## Pagination

All list endpoints support pagination with consistent parameters:

**Request:**
```http
GET /api/stores?page=2&pageSize=25
```

**Response includes:**
```json
{
  "pagination": {
    "page": 2,
    "pageSize": 25,
    "totalItems": 100,
    "totalPages": 4,
    "hasNext": true,
    "hasPrev": true
  }
}
```

---

## Best Practices

### 1. Handle Rate Limits

```typescript
async function fetchWithRetry(url: string, options: RequestInit) {
  const response = await fetch(url, options)

  if (response.status === 429) {
    const resetTime = response.headers.get('X-RateLimit-Reset')
    const waitMs = Number(resetTime) - Date.now()
    await new Promise(resolve => setTimeout(resolve, waitMs))
    return fetchWithRetry(url, options)
  }

  return response
}
```

### 2. Use Pagination

Always paginate large datasets:

```typescript
async function getAllStores() {
  const stores = []
  let page = 1
  let hasMore = true

  while (hasMore) {
    const response = await fetch(`/api/stores?page=${page}&pageSize=100`)
    const data = await response.json()
    stores.push(...data.data)
    hasMore = data.pagination.hasNext
    page++
  }

  return stores
}
```

### 3. Include Request IDs in Bug Reports

Every response includes a `requestId`. Include this in bug reports for easier debugging.

---

## SDK Usage

The recommended way to interact with the API is through the provided React hooks:

```typescript
// Stores
import { useStores } from '@/hooks/useStores'
const { stores, createStore, updateStore, deleteStore } = useStores()

// Inventory
import { useInventory } from '@/hooks/useInventory'
const { items, createItem, updateItem } = useInventory()

// Stock Operations
import { useStockCount } from '@/hooks/useStockCount'
import { useStockReception } from '@/hooks/useStockReception'

// Reports
import { useLowStockReport, useMissingCounts } from '@/hooks/useReports'
```

These hooks handle authentication, caching, error handling, and optimistic updates automatically.
