# Restaurant Inventory Management System

A modern, role-based inventory management platform for multi-location restaurant chains. Built with Next.js 16, TypeScript, and Supabase, it enables real-time stock tracking, delivery management, and comprehensive reporting across unlimited store locations.

## Features

- **Multi-Location Support** - Manage inventory across unlimited restaurant locations from a single dashboard
- **Role-Based Access Control** - Three distinct roles (Admin, Driver, Staff) with granular permissions
- **Real-Time Stock Tracking** - Daily stock counts with complete audit trails
- **Delivery Management** - Record and track incoming stock deliveries
- **Low Stock Alerts** - Automatic notifications when items fall below PAR levels
- **Shift Management** - Schedule and track staff shifts with clock in/out
- **Comprehensive Reports** - Daily summaries, low stock reports, and activity tracking
- **Modern UI** - Dark mode, glassmorphism effects, and responsive design

## Tech Stack

| Category | Technology |
|----------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 (strict mode) |
| Database | PostgreSQL via Supabase |
| Authentication | Supabase Auth (JWT) |
| Styling | Tailwind CSS 4 |
| UI Components | Shadcn UI + Radix UI |
| State Management | TanStack Query 5 |
| Forms | React Hook Form + Zod |
| Testing | Vitest |

## Installation

### Prerequisites

- Node.js 20 or higher
- npm 10 or higher
- A Supabase project ([create one free](https://supabase.com))

### Setup

1. **Clone the repository**

```bash
git clone https://github.com/your-org/restaurant-inventory-management-system.git
cd restaurant-inventory-management-system
```

2. **Install dependencies**

```bash
npm install
```

3. **Configure environment variables**

Create a `.env.local` file in the root directory:

```bash
# Supabase Configuration (get these from your Supabase dashboard)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

4. **Set up the database**

Run the SQL migrations in your Supabase SQL editor (located in `/supabase/migrations/` if available, or set up tables as described in [ARCHITECTURE.md](./docs/ARCHITECTURE.md)).

5. **Start the development server**

```bash
npm run dev
```

6. **Open the application**

Navigate to [http://localhost:3000](http://localhost:3000)

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (server-side only) |

### Role Permissions

| Feature | Admin | Driver | Staff |
|---------|:-----:|:------:|:-----:|
| View all stores | ✅ | ✅ | Own only |
| Manage stores | ✅ | ❌ | ❌ |
| Manage inventory items | ✅ | ❌ | ❌ |
| Manage users | ✅ | ❌ | ❌ |
| Submit stock counts | ✅ | ❌ | ✅ |
| Record deliveries | ✅ | ✅ | ❌ |
| View reports | ✅ | ✅ | ❌ |
| Manage shifts | ✅ | ❌ | ❌ |

## Usage Examples

### Submitting a Stock Count (Staff/Admin)

```typescript
import { useStockCount } from '@/hooks/useStockCount'

function StockCountPage({ storeId }: { storeId: string }) {
  const { submitCount, isLoading } = useStockCount()

  const handleSubmit = async (items: StockCountItem[]) => {
    await submitCount.mutateAsync({
      store_id: storeId,
      items: items.map(item => ({
        inventory_item_id: item.id,
        quantity: item.quantity
      })),
      notes: 'End of day count'
    })
  }

  return <StockCountForm onSubmit={handleSubmit} isLoading={isLoading} />
}
```

### Recording a Delivery (Driver/Admin)

```typescript
import { useStockReception } from '@/hooks/useStockReception'

function DeliveryPage({ storeId }: { storeId: string }) {
  const { submitReception, isLoading } = useStockReception()

  const handleDelivery = async (items: DeliveryItem[]) => {
    await submitReception.mutateAsync({
      store_id: storeId,
      items: items.map(item => ({
        inventory_item_id: item.id,
        quantity: item.quantity
      })),
      notes: 'Morning delivery from supplier'
    })
  }

  return <DeliveryForm onSubmit={handleDelivery} isLoading={isLoading} />
}
```

### Checking User Permissions

```typescript
import { useAuth } from '@/hooks/useAuth'
import { canDoStockCount, canDoStockReception } from '@/lib/auth'

function ActionButtons() {
  const { role } = useAuth()

  return (
    <div>
      {canDoStockCount(role) && (
        <Button>Submit Stock Count</Button>
      )}
      {canDoStockReception(role) && (
        <Button>Record Delivery</Button>
      )}
    </div>
  )
}
```

## API Documentation

Full API documentation is available in [docs/API.md](./docs/API.md).

### Quick Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/stores` | GET | List all stores (paginated) |
| `/api/stores` | POST | Create a new store |
| `/api/stores/:id/stock-count` | POST | Submit stock count |
| `/api/stores/:id/stock-reception` | POST | Record delivery |
| `/api/inventory` | GET | List inventory items |
| `/api/reports/low-stock` | GET | Get low stock alerts |
| `/api/reports/daily-summary` | GET | Get daily activity summary |

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser                               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Next.js Middleware                        │
│  • Session validation                                        │
│  • Profile caching (5 min TTL)                              │
│  • Route-based access control                               │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌──────────────────────────┐    ┌──────────────────────────┐
│     React Components      │    │       API Routes         │
│  • Dashboard views        │    │  • withApiAuth wrapper   │
│  • Form components        │    │  • Rate limiting         │
│  • Table components       │    │  • Zod validation        │
└──────────────────────────┘    └──────────────────────────┘
              │                               │
              ▼                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    React Query (TanStack)                    │
│  • Caching with smart invalidation                          │
│  • Optimistic updates                                       │
│  • Background refetching                                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Supabase Client                         │
│  • Authentication (JWT)                                      │
│  • Real-time subscriptions                                   │
│  • PostgREST queries                                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   PostgreSQL Database                        │
│  • Row-Level Security (RLS)                                 │
│  • Stored procedures                                        │
│  • Audit triggers                                           │
└─────────────────────────────────────────────────────────────┘
```

For detailed architecture documentation, see [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md).

## Project Structure

```
├── app/                      # Next.js App Router
│   ├── (dashboard)/          # Protected dashboard routes
│   │   ├── stores/           # Store management
│   │   ├── inventory/        # Inventory management
│   │   ├── users/            # User management
│   │   ├── reports/          # Analytics & reports
│   │   └── my-shifts/        # Staff shift tracking
│   ├── (public)/             # Public routes (login, etc.)
│   └── api/                  # API routes
├── components/               # React components
│   ├── ui/                   # Shadcn UI primitives
│   ├── forms/                # Form components
│   ├── tables/               # Table components
│   ├── cards/                # Card components
│   └── layout/               # Layout components
├── hooks/                    # Custom React hooks
├── lib/                      # Utilities & business logic
│   ├── api/                  # API helpers
│   ├── supabase/             # Supabase clients
│   └── validations/          # Zod schemas
├── types/                    # TypeScript definitions
├── tests/                    # Test files
└── docs/                     # Documentation
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run test` | Run tests in watch mode |
| `npm run test:run` | Run tests once |
| `npm run test:coverage` | Generate coverage report |
| `npm run test:ui` | Open Vitest UI |

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

### Quick Start for Contributors

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests (`npm run test:run`)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## Troubleshooting

### Common Issues

#### "Unable to load dashboard" after login

This usually means the user profile wasn't created in the database. Ensure:
1. The user exists in Supabase Auth
2. A corresponding record exists in the `profiles` table
3. The profile has a valid `role` (Admin, Driver, or Staff)

#### Page shows blank/white after refresh

This can be caused by browser extensions interfering with Supabase requests. Try:
1. Opening in incognito/private mode
2. Disabling extensions (especially Reader Mode, ad blockers)
3. Whitelisting your Supabase domain in extension settings

#### Stock count not saving

Verify:
1. User has the correct role (Admin or Staff)
2. User is assigned to the store (Staff only)
3. All required fields are filled
4. Network requests are not being blocked

#### Login redirects back to login page

Check:
1. Supabase environment variables are correctly set
2. Cookies are not being blocked
3. The user's status is 'Active' in the profiles table

### Getting Help

- Check existing [GitHub Issues](https://github.com/your-org/restaurant-inventory-management-system/issues)
- Review the [API Documentation](./docs/API.md)
- Contact the development team

## License

This project is proprietary software. All rights reserved.

---

Built with [Next.js](https://nextjs.org) and [Supabase](https://supabase.com)
