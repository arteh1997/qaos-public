# Contributing to Restaurant Inventory Management System

Thank you for your interest in contributing! This guide will help you get started.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Code Standards](#code-standards)
- [Testing Guidelines](#testing-guidelines)
- [Pull Request Process](#pull-request-process)
- [Issue Guidelines](#issue-guidelines)

## Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Help others learn and grow
- Keep discussions professional

## Getting Started

### Prerequisites

- Node.js 20+
- npm 10+
- Git
- A Supabase account (for local development)

### Local Setup

1. **Fork and clone the repository**

```bash
git clone https://github.com/YOUR_USERNAME/restaurant-inventory-management-system.git
cd restaurant-inventory-management-system
```

2. **Install dependencies**

```bash
npm install
```

3. **Set up environment variables**

```bash
# Create .env.local with your Supabase credentials (see README.md for required vars)
```

4. **Start the development server**

```bash
npm run dev
```

5. **Run tests**

```bash
npm run test
```

## Development Workflow

### Branch Naming

Use descriptive branch names:

```
feature/add-user-profile-page
fix/stock-count-validation
refactor/api-response-format
docs/update-readme
test/add-shift-tests
```

### Commit Messages

Follow conventional commit format:

```
type(scope): description

[optional body]

[optional footer]
```

**Types:**

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Formatting, missing semicolons, etc.
- `refactor`: Code restructuring without behavior change
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**

```bash
feat(stores): add pagination to store list
fix(auth): resolve session timeout issue
docs(api): update endpoint documentation
refactor(hooks): simplify useStores hook
test(inventory): add unit tests for validation
```

### Development Flow

1. Create a feature branch from `main`
2. Make your changes
3. Write/update tests
4. Run linting and tests
5. Commit with meaningful messages
6. Push and create a Pull Request

## Code Standards

### TypeScript

- Use strict mode (already configured)
- Define explicit types for function parameters and returns
- Use interfaces for object shapes
- Avoid `any` type - use `unknown` if necessary

```typescript
// Good
interface StoreFormData {
  name: string;
  address?: string;
  is_active: boolean;
}

function createStore(data: StoreFormData): Promise<Store> {
  // ...
}

// Avoid
function createStore(data: any): any {
  // ...
}
```

### React Components

- Use functional components with hooks
- Keep components focused and small
- Extract reusable logic into custom hooks
- Use TypeScript for props

```typescript
// Good
interface StoreCardProps {
  store: Store;
  onEdit?: (store: Store) => void;
  onDelete?: (store: Store) => void;
}

export function StoreCard({ store, onEdit, onDelete }: StoreCardProps) {
  // ...
}
```

### File Organisation

```
components/
├── ui/           # Primitive UI components (Button, Input, etc.)
├── forms/        # Form components (StoreForm, InventoryForm)
├── tables/       # Table components (StoresTable, UsersTable)
├── cards/        # Card components (StoreCard, StatsCard)
└── layout/       # Layout components (Sidebar, Header)

hooks/
├── useAuth.ts    # Authentication hook
├── useStores.ts  # Store management hook
└── ...

lib/
├── api/          # API utilities
├── supabase/     # Supabase clients
├── validations/  # Zod schemas
└── utils.ts      # General utilities
```

### Naming Conventions

| Type             | Convention           | Example         |
| ---------------- | -------------------- | --------------- |
| Components       | PascalCase           | `StoreCard.tsx` |
| Hooks            | camelCase with `use` | `useStores.ts`  |
| Utilities        | camelCase            | `formatDate.ts` |
| Constants        | SCREAMING_SNAKE      | `MAX_PAGE_SIZE` |
| Types/Interfaces | PascalCase           | `StoreFormData` |

### Styling

- Use Tailwind CSS utility classes
- Follow the existing color scheme (CSS variables)
- Keep styles responsive (mobile-first)
- Use component variants for variations

```tsx
// Good - using Tailwind utilities
<Button className="bg-primary text-primary-foreground hover:bg-primary/90">
  Save
</Button>

// Good - using component variants
<Button variant="destructive" size="sm">
  Delete
</Button>
```

## Testing Guidelines

### Test Structure

```typescript
import { describe, it, expect, vi } from 'vitest'

describe('ComponentName', () => {
  describe('when condition', () => {
    it('should behave in a certain way', () => {
      // Arrange
      const props = { ... }

      // Act
      const result = doSomething(props)

      // Assert
      expect(result).toBe(expected)
    })
  })
})
```

### What to Test

1. **Unit Tests**
   - Utility functions
   - Validation schemas
   - Permission checks
   - Data transformations

2. **Component Tests**
   - User interactions
   - Conditional rendering
   - Form submissions
   - Error states

3. **Integration Tests**
   - API routes
   - Hook behavior
   - Authentication flows

### Running Tests

```bash
# Watch mode (development)
npm run test

# Single run (CI)
npm run test:run

# With coverage
npm run test:coverage

# Visual UI
npm run test:ui
```

### Test File Location

All tests live in the `tests/` directory, mirroring the source structure:

```
tests/
├── integration/
│   ├── api/             # API route tests (mock Supabase, CSRF, rate limiting)
│   └── rls/             # RLS tests (require real Supabase credentials)
├── hooks/               # Hook tests
└── lib/                 # Utility and service tests
```

## Pull Request Process

### Before Submitting

- [ ] Code follows project standards
- [ ] Tests pass locally (`npm run test:run`)
- [ ] Linting passes (`npm run lint`)
- [ ] Build succeeds (`npm run build`)
- [ ] Documentation updated if needed

### PR Template

```markdown
## Description

Brief description of changes

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## How to Test

1. Step one
2. Step two
3. Expected result

## Screenshots (if applicable)

## Checklist

- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] No console errors
- [ ] Responsive design verified
```

### Review Process

1. Submit PR against `main` branch
2. Automated checks run (lint, test, build)
3. At least one maintainer reviews
4. Address feedback and update
5. Maintainer merges when approved

### After Merge

- Delete your feature branch
- Pull latest `main` to your local
- Celebrate! 🎉

## Issue Guidelines

### Bug Reports

Include:

- Clear title and description
- Steps to reproduce
- Expected vs actual behavior
- Browser/OS information
- Screenshots or error logs

```markdown
**Bug Description**
Stock count form shows error after successful submission

**Steps to Reproduce**

1. Go to store page
2. Click "Stock Count"
3. Enter quantities
4. Click Submit

**Expected**
Success message and redirect to store page

**Actual**
Error toast appears, but data is saved

**Environment**

- Browser: Chrome 120
- OS: macOS 14.2
```

### Feature Requests

Include:

- Clear use case
- Proposed solution
- Alternatives considered
- Mockups if applicable

```markdown
**Feature**
Export stock history to CSV

**Use Case**
As an admin, I want to export stock history for auditing

**Proposed Solution**
Add "Export" button to stock history page

**Alternatives**

- PDF export
- Email report
```

### Questions

For general questions:

1. Check existing documentation
2. Search closed issues
3. If still unclear, open a discussion

## Development Tips

### Hot Reload

The dev server supports hot reload. Most changes appear instantly.

### Database Changes

When modifying database schema:

1. Update types in `types/database.ts`
2. Run `npm run db:types` (if configured)
3. Update affected queries

### Adding New Features

1. Start with the API route
2. Add validation schema
3. Create/update hooks
4. Build UI components
5. Add tests
6. Update documentation

### Debugging

```typescript
// Use console.log sparingly in development
console.log("Debug:", { variable });

// Remove before committing
// Or use conditional logging
if (process.env.NODE_ENV === "development") {
  console.log("Debug info");
}
```

## Getting Help

- Check [README.md](./README.md) for setup instructions
- Review [docs/API.md](./docs/API.md) for API reference
- Look at existing code for patterns
- Ask in GitHub Discussions

---

Thank you for contributing! Your help makes this project better for everyone.
