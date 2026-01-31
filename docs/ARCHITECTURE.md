# Architecture Documentation

This document describes the technical architecture of the Restaurant Inventory Management System.

## Table of Contents

- [System Overview](#system-overview)
- [Technology Stack](#technology-stack)
- [Application Layers](#application-layers)
- [Authentication & Authorization](#authentication--authorization)
- [Database Schema](#database-schema)
- [API Design](#api-design)
- [State Management](#state-management)
- [Security](#security)
- [Performance](#performance)
- [Deployment](#deployment)

## System Overview

The Restaurant Inventory Management System is a multi-tenant web application designed for restaurant chains to manage inventory across multiple locations. It follows a modern JAMstack architecture with server-side rendering capabilities.

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              Client Layer                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │   Browser   │  │   Mobile    │  │   Tablet    │  │   Desktop   │    │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘    │
│         └─────────────────┴─────────────────┴─────────────────┘         │
└─────────────────────────────────────┬───────────────────────────────────┘
                                      │ HTTPS
                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           Application Layer                              │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                        Next.js Application                          │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │ │
│  │  │  Middleware  │  │  App Router  │  │      API Routes          │  │ │
│  │  │  (Auth/RLS)  │  │  (Pages)     │  │  (REST Endpoints)        │  │ │
│  │  └──────────────┘  └──────────────┘  └──────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                         React Components                            │ │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  │ │
│  │  │ Layouts │  │  Forms  │  │ Tables  │  │  Cards  │  │   UI    │  │ │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘  └─────────┘  │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                          Custom Hooks                               │ │
│  │  useAuth │ useStores │ useInventory │ useReports │ useShifts       │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────┬───────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                             Data Layer                                   │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                         Supabase Platform                           │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │ │
│  │  │  Supabase    │  │   PostgREST  │  │      PostgreSQL          │  │ │
│  │  │    Auth      │  │     API      │  │     Database             │  │ │
│  │  └──────────────┘  └──────────────┘  └──────────────────────────┘  │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │ │
│  │  │  Row Level   │  │   Realtime   │  │      Storage             │  │ │
│  │  │  Security    │  │   (WebSocket)│  │     (Files)              │  │ │
│  │  └──────────────┘  └──────────────┘  └──────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

## Technology Stack

### Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 16.x | React framework with App Router |
| React | 19.x | UI component library |
| TypeScript | 5.x | Type-safe JavaScript |
| Tailwind CSS | 4.x | Utility-first CSS framework |
| Shadcn UI | Latest | Accessible component library |
| Radix UI | 1.x | Primitive UI components |
| TanStack Query | 5.x | Server state management |
| React Hook Form | 7.x | Form handling |
| Zod | 4.x | Schema validation |
| Lucide React | 0.5x | Icon library |

### Backend

| Technology | Purpose |
|------------|---------|
| Next.js API Routes | REST API endpoints |
| Supabase | Backend-as-a-Service |
| PostgreSQL | Relational database |
| PostgREST | Auto-generated REST API |
| Supabase Auth | JWT authentication |

### Development

| Tool | Purpose |
|------|---------|
| Vitest | Unit & integration testing |
| ESLint | Code linting |
| npm | Package management |

## Application Layers

### 1. Presentation Layer

Located in `app/` and `components/` directories.

**Route Groups:**
- `(dashboard)` - Protected routes requiring authentication
- `(public)` - Public routes (login, password reset)
- `api/` - REST API endpoints

**Component Structure:**
```
components/
├── ui/            # Shadcn primitives (Button, Input, Dialog)
├── forms/         # Domain forms (StoreForm, InventoryItemForm)
├── tables/        # Data tables (StoresTable, UsersTable)
├── cards/         # Info cards (StatsCard, StoreCard)
├── dashboard/     # Dashboard views (AdminDashboard, StaffDashboard)
├── layout/        # Layout components (Sidebar, Header, MobileNav)
└── providers/     # Context providers (QueryProvider, ThemeProvider)
```

### 2. Business Logic Layer

Located in `hooks/` and `lib/` directories.

**Custom Hooks:**
```typescript
// Data fetching with caching
useStores()      // Store CRUD operations
useInventory()   // Inventory item management
useStockCount()  // Stock count submissions
useReports()     // Report data fetching

// Authentication
useAuth()        // User session & profile

// UI State
useDebounce()    // Input debouncing
```

**Utilities:**
```
lib/
├── auth.ts          # Permission checking functions
├── constants.ts     # Application constants
├── utils.ts         # General utilities
├── rate-limit.ts    # Rate limiting logic
├── api/             # API helpers
│   ├── middleware.ts    # Auth & rate limiting
│   └── response.ts      # Response formatting
├── supabase/        # Database clients
│   ├── client.ts        # Browser client
│   ├── server.ts        # Server client
│   └── middleware.ts    # Session handling
└── validations/     # Zod schemas
    ├── store.ts
    ├── inventory.ts
    ├── shift.ts
    └── user.ts
```

### 3. Data Access Layer

Supabase handles data access through:
- **PostgREST**: Auto-generated REST API
- **Supabase Client**: Type-safe query builder
- **Row-Level Security**: Database-enforced access control

## Authentication & Authorization

### Authentication Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Browser   │     │   Next.js   │     │  Supabase   │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       │  1. Login Form    │                   │
       │──────────────────>│                   │
       │                   │ 2. signInWithPassword
       │                   │──────────────────>│
       │                   │                   │
       │                   │ 3. JWT Token      │
       │                   │<──────────────────│
       │                   │                   │
       │                   │ 4. Set Cookie     │
       │<──────────────────│                   │
       │                   │                   │
       │ 5. Protected Page │                   │
       │──────────────────>│                   │
       │                   │ 6. Validate JWT   │
       │                   │──────────────────>│
       │                   │                   │
       │                   │ 7. User Data      │
       │                   │<──────────────────│
       │                   │                   │
       │ 8. Render Page    │                   │
       │<──────────────────│                   │
       │                   │                   │
```

### Authorization Layers

**Layer 1: Middleware (middleware.ts)**
- Validates JWT on every request
- Caches user profile (5 min TTL)
- Enforces route-based restrictions
- Redirects unauthorized users

**Layer 2: API Routes**
- `withApiAuth()` wrapper validates permissions
- Rate limiting per user
- Role-based endpoint access

**Layer 3: Database (RLS)**
- Row-Level Security policies
- Users can only access permitted data
- Final security enforcement

### Role-Based Access Control

```typescript
type AppRole = 'Admin' | 'Driver' | 'Staff'

// Route restrictions (middleware.ts)
const restrictedRoutes = {
  '/inventory': ['Admin'],
  '/users': ['Admin'],
  '/reports': ['Admin', 'Driver'],
  '/my-shifts': ['Staff'],
}

// Permission helpers (lib/auth.ts)
hasGlobalAccess(role)        // Admin or Driver?
isStoreScopedRole(role)      // Is Staff?
canDoStockCount(role)        // Admin or Staff
canDoStockReception(role)    // Admin or Driver
canManageUsers(role)         // Admin only
canManageStores(role)        // Admin only
canAccessStore(role, userStore, targetStore)
```

## Database Schema

### Entity Relationship Diagram

```
┌────────────────┐       ┌────────────────┐
│    stores      │       │ inventory_items│
├────────────────┤       ├────────────────┤
│ id (PK)        │       │ id (PK)        │
│ name           │       │ name           │
│ address        │       │ category       │
│ is_active      │       │ unit_of_measure│
│ created_at     │       │ is_active      │
│ updated_at     │       │ created_at     │
└───────┬────────┘       └───────┬────────┘
        │                        │
        │    ┌───────────────────┤
        │    │                   │
        ▼    ▼                   │
┌────────────────────┐           │
│  store_inventory   │           │
├────────────────────┤           │
│ id (PK)            │           │
│ store_id (FK)──────┼───────────┘
│ inventory_item_id  │
│ quantity           │
│ par_level          │
│ last_updated_at    │
│ last_updated_by    │
└────────────────────┘
        │
        │
        ▼
┌────────────────────┐       ┌────────────────┐
│   stock_history    │       │   profiles     │
├────────────────────┤       ├────────────────┤
│ id (PK)            │       │ id (PK/FK)     │──> auth.users
│ store_id (FK)      │       │ email          │
│ inventory_item_id  │       │ full_name      │
│ action_type        │       │ role           │
│ quantity_before    │       │ store_id (FK)  │──> stores
│ quantity_after     │       │ status         │
│ quantity_change    │       │ created_at     │
│ performed_by (FK)──┼──────>│ updated_at     │
│ notes              │       └────────────────┘
│ created_at         │
└────────────────────┘

┌────────────────────┐       ┌────────────────┐
│     shifts         │       │  daily_counts  │
├────────────────────┤       ├────────────────┤
│ id (PK)            │       │ id (PK)        │
│ store_id (FK)      │       │ store_id (FK)  │
│ user_id (FK)       │       │ count_date     │
│ start_time         │       │ submitted_by   │
│ end_time           │       │ submitted_at   │
│ clock_in_time      │       └────────────────┘
│ clock_out_time     │
│ notes              │
│ created_at         │
│ updated_at         │
└────────────────────┘
```

### Table Descriptions

| Table | Purpose |
|-------|---------|
| `stores` | Restaurant locations |
| `profiles` | User profiles (linked to auth.users) |
| `inventory_items` | Global item catalog |
| `store_inventory` | Current stock per store |
| `stock_history` | Audit trail of all changes |
| `shifts` | Staff scheduling |
| `daily_counts` | Tracks daily count submissions |

### Key Relationships

- `profiles.id` → `auth.users.id` (1:1)
- `profiles.store_id` → `stores.id` (N:1, Staff only)
- `store_inventory` → `stores` + `inventory_items` (junction)
- `stock_history` → `stores` + `inventory_items` + `profiles`
- `shifts` → `stores` + `profiles`
- `daily_counts` → `stores` + `profiles`

## API Design

### RESTful Endpoints

```
/api
├── /stores
│   ├── GET     - List stores (paginated)
│   ├── POST    - Create store
│   └── /:storeId
│       ├── GET     - Get store
│       ├── PATCH   - Update store
│       ├── DELETE  - Delete store
│       ├── /inventory
│       │   └── GET - Get store inventory
│       ├── /history
│       │   └── GET - Get stock history
│       ├── /stock-count
│       │   └── POST - Submit count
│       └── /stock-reception
│           └── POST - Record delivery
├── /inventory
│   ├── GET     - List items
│   ├── POST    - Create item
│   └── /:itemId
│       ├── GET     - Get item
│       ├── PATCH   - Update item
│       └── DELETE  - Delete item
├── /shifts
│   ├── GET     - List shifts
│   ├── POST    - Create shift
│   └── /:shiftId
│       ├── GET     - Get shift
│       ├── PATCH   - Update shift
│       ├── DELETE  - Delete shift
│       ├── /clock-in
│       │   └── POST - Clock in
│       └── /clock-out
│           └── POST - Clock out
├── /users
│   └── /invite
│       └── POST - Invite user
├── /reports
│   ├── /daily-summary
│   │   └── GET - Daily activity
│   └── /low-stock
│       └── GET - Low stock items
└── /alerts
    └── /missing-counts
        └── GET - Missing counts
```

### Response Format

All responses follow a consistent format:

```typescript
interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: {
    message: string
    code: string
    details?: ValidationError[]
  }
  pagination?: {
    page: number
    pageSize: number
    totalItems: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
  requestId: string
}
```

## State Management

### Client State

- **React's useState/useReducer**: Component-local state
- **URL State**: Filters, pagination via search params
- **Theme**: next-themes for dark/light mode

### Server State

TanStack Query (React Query) manages all server state:

```typescript
// Query example
const { data, isLoading, error } = useQuery({
  queryKey: ['stores', filters],
  queryFn: () => fetchStores(filters),
  staleTime: 5 * 60 * 1000, // 5 minutes
})

// Mutation example
const mutation = useMutation({
  mutationFn: createStore,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['stores'] })
  },
})
```

### Caching Strategy

| Data Type | Stale Time | Cache Time |
|-----------|------------|------------|
| Stores | 5 min | 30 min |
| Inventory Items | 5 min | 30 min |
| Store Inventory | 1 min | 10 min |
| Reports | 1 min | 5 min |
| User Profile | 10 min | 60 min |

## Security

### Security Layers

1. **Transport**: HTTPS only
2. **Authentication**: Supabase JWT
3. **Authorization**: Multi-layer (Middleware → API → RLS)
4. **Validation**: Zod schemas
5. **Rate Limiting**: Per-user limits

### Security Best Practices

```typescript
// Input validation
const storeSchema = z.object({
  name: z.string().min(1).max(100),
  address: z.string().max(500).optional(),
})

// Sanitization (recommended)
import DOMPurify from 'dompurify'
const safeNotes = DOMPurify.sanitize(notes)

// Rate limiting
const rateLimit = new Map<string, { count: number; reset: number }>()

// Environment variable protection
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY // Server only
```

### Sensitive Data Handling

| Data | Protection |
|------|------------|
| Passwords | Supabase Auth (bcrypt) |
| JWT Tokens | HTTP-only cookies |
| Service Key | Server-side only |
| User PII | Database RLS |

## Performance

### Optimization Strategies

1. **React Query Caching**: Reduces redundant API calls
2. **Profile Caching**: 5-minute cookie cache
3. **Pagination**: All lists paginated
4. **Code Splitting**: Next.js automatic chunking
5. **Image Optimization**: next/image

### Performance Metrics

| Metric | Target |
|--------|--------|
| First Contentful Paint | < 1.5s |
| Time to Interactive | < 3s |
| API Response Time | < 200ms |
| Lighthouse Score | > 90 |

### Recommended Improvements

1. **Batch Stock Operations**: Replace loops with bulk inserts
2. **Database Indexes**: Add indexes for common queries
3. **Edge Caching**: Static asset caching at edge
4. **Connection Pooling**: Supabase handles this

## Deployment

### Production Requirements

- Node.js 20+
- Environment variables configured
- Supabase project with schema

### Recommended Platforms

| Platform | Best For |
|----------|----------|
| Vercel | Easiest deployment, best Next.js support |
| AWS | Enterprise, custom infrastructure |
| Railway | Simple, affordable |
| Render | Docker-based deployments |

### Environment Configuration

```bash
# Production .env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...  # Keep secret!
NODE_ENV=production
```

### Deployment Checklist

- [ ] Environment variables set
- [ ] Database migrations applied
- [ ] RLS policies enabled
- [ ] Rate limits configured
- [ ] Error tracking enabled (Sentry)
- [ ] Performance monitoring set up
- [ ] SSL certificate valid
- [ ] Backup strategy defined

---

## Quick Reference

### Key Files

| File | Purpose |
|------|---------|
| `middleware.ts` | Auth & route protection |
| `lib/supabase/client.ts` | Browser Supabase client |
| `lib/supabase/server.ts` | Server Supabase client |
| `lib/auth.ts` | Permission helpers |
| `hooks/useAuth.ts` | Auth hook |
| `types/database.ts` | Database types |
| `lib/validations/*.ts` | Zod schemas |

### Common Patterns

```typescript
// Protected API route
export async function GET(request: NextRequest) {
  const authResult = await withApiAuth(request, { requiredRole: 'Admin' })
  if ('error' in authResult) return authResult.error
  const { profile, supabase } = authResult
  // ... handle request
}

// Data hook usage
const { stores, createStore, isLoading } = useStores()
await createStore.mutateAsync(data)

// Permission check
if (canManageUsers(role)) {
  // Show admin UI
}
```
