# Design System — Restaurant Inventory Management

## Direction

**Who**: Restaurant owners, managers, staff, drivers. People running kitchens — not developers. They open this at 6am with coffee or mid-rush on a phone.

**What they need**: Instant clarity. "Am I running out of anything?" "What do I need to order?" "Did my team do their job?" No charts that need interpreting. Plain English.

**Feel**: Warm like a kitchen clipboard. Paper-on-wood. Approachable, not corporate. Clean but not sterile.

---

## Palette

All colors trace to CSS custom properties in `:root` (app/globals.css).

### Surfaces

| Token | Value | Role |
|-------|-------|------|
| `--background` | `#faf8f5` | Canvas — warm cream, like butcher paper |
| `--card` | `#ffffff` | Cards — clean white, lifts off warm canvas |
| `--popover` | `#ffffff` | Dropdowns, dialogs |
| `--muted` | `#f3f0eb` | Subtle backgrounds, zebra rows |
| `--secondary` | `#f3f0eb` | Secondary buttons, tags |
| `--accent` | `#f3f0eb` | Hover states, highlights |
| `--navbar` | `#1f1d1a` | Top bar — deep warm dark, not pure black |
| `--sidebar` | `#faf8f5` | Same as canvas (one room, not zones) |

### Text

| Token | Value | Role |
|-------|-------|------|
| `--foreground` | `#2d2a26` | Primary text — warm charcoal |
| `--card-foreground` | `#2d2a26` | Card text |
| `--muted-foreground` | `#8a8279` | Secondary text, labels, descriptions |
| `--navbar-foreground` | `#faf8f5` | Navbar text — cream on dark |
| `--sidebar-foreground` | `#8a8279` | Sidebar labels (muted) |
| `--primary-foreground` | `#faf8f5` | Text on primary buttons |

### Semantic Colors

| Token | Value | Role |
|-------|-------|------|
| `--primary` | `#2d2a26` | Primary actions — warm dark, approachable authority |
| `--destructive` | `#c4432b` | Warm red — the 86'd board, not neon alarm |
| `--ring` | `#2d7a4f` | Focus rings — fresh herb green |
| `--sidebar-active` | `#2d7a4f` | Active nav item — herb green |
| `--border` | `#e8e4dd` | Warm borders — visible when needed, invisible when not |
| `--input` | `#e8e4dd` | Input borders |

### Status Colors (Tailwind utilities, not tokens)

| Use | Class | Notes |
|-----|-------|-------|
| Success badges | `bg-emerald-50 text-emerald-700` | Herb green family |
| Warning text | `text-amber-500` or `text-amber-600` | Warm amber, never yellow-500 |
| Error/danger | `text-destructive` or `bg-destructive` | Uses the token |
| Error background | `bg-destructive/5` | Very faint red wash |
| Destructive button | `bg-destructive text-destructive-foreground hover:bg-destructive/90` | |
| Info | `text-blue-600` | Allowed — blue is neutral enough |

### Charts

| Token | Value | Use |
|-------|-------|-----|
| `--chart-1` | `#2d7a4f` | Primary — herb green |
| `--chart-2` | `#b58a3a` | Secondary — warm gold |
| `--chart-3` | `#c4432b` | Tertiary — warm red |
| `--chart-4` | `#5b8a72` | Quaternary — sage |
| `--chart-5` | `#d4a853` | Quinary — light gold |

---

## Depth

**Philosophy**: Borders for structure, shadows only for elevation.

| Element | Depth |
|---------|-------|
| Cards | `shadow-card` custom property — gentle lift like paper on clipboard |
| Sidebar | No shadow. Same bg as canvas. Border-only separation (`border-r`) |
| Navbar | No shadow. Deep warm dark bg provides natural separation |
| Modals/dialogs | shadcn default shadow |
| Dropdowns | shadcn default shadow |

### Shadow definition
```css
--shadow-card: 0 1px 2px rgba(140, 130, 115, 0.06),
  0 2px 4px rgba(140, 130, 115, 0.04),
  0 0 0 1px rgba(140, 130, 115, 0.08);
```

Warm-tinted shadow (rgb 140,130,115) — never cool gray.

---

## Typography

- **Font**: Inter (via `--font-inter`), fallback system-ui sans-serif
- **Antialiasing**: Always on (`antialiased` on body)

### Scale

| Use | Class |
|-----|-------|
| Page title | `text-2xl font-semibold tracking-tight` |
| Section title | `text-base font-semibold` |
| Card title | `text-base font-semibold` (via CardTitle) |
| Body | `text-sm` (default) |
| Description/caption | `text-sm text-muted-foreground` |
| Tiny labels | `text-xs text-muted-foreground` |
| Stats card value | `text-2xl font-bold` |

---

## Spacing

- **Base unit**: 4px (Tailwind's default)
- **Card padding**: `p-6` (CardContent default)
- **Section gaps**: `space-y-6` between major sections
- **Grid gaps**: `gap-4` for card grids, `gap-6` for section grids
- **Page structure**: `space-y-6` vertically

---

## Radius

- **Base**: `--radius: 0.625rem` (10px)
- Cards, buttons, inputs all derive from this via `--radius-sm`, `--radius-md`, `--radius-lg`

---

## Component Patterns

### Surface Rule
- **Never** use `bg-white` directly. Use `bg-card` for elevated surfaces.
- **Never** use `bg-gray-*`. Use `bg-muted` or `bg-muted/50` for subtle fills.
- Hover states: `hover:bg-muted` or `hover:bg-muted/50`

### Color Replacement Rules (what to use instead of Tailwind defaults)

| Never use | Use instead |
|-----------|-------------|
| `bg-white` | `bg-card` |
| `bg-gray-50/100` | `bg-muted` or `bg-muted/50` |
| `text-gray-500/600` | `text-muted-foreground` |
| `text-red-500/600` | `text-destructive` |
| `bg-red-50` | `bg-destructive/5` |
| `bg-red-600 text-white` | `bg-destructive text-destructive-foreground` |
| `border-gray-200` | `border-border` (or just `border`) |
| `text-green-600/700` | `text-emerald-600` / `text-emerald-700` |
| `bg-green-50/100` | `bg-emerald-50` |
| `text-yellow-500` | `text-amber-500` |
| `bg-yellow-50` | `bg-amber-50` |

### Sidebar

- Same background as canvas (`bg-sidebar` = `#faf8f5`)
- Separation via `border-r` only, no shadow
- Active item: `bg-card shadow-sm` with herb green text
- Hover: `hover:bg-card/60`
- Nav labels: `text-sidebar-foreground` (muted)

### Navbar

- Deep warm dark: `bg-navbar` (`#1f1d1a`)
- Text: `text-navbar-foreground` (`#faf8f5`)
- Not pure black. Warm undertone.

### Badges

| State | Classes |
|-------|---------|
| Success/complete | `bg-emerald-50 text-emerald-700` |
| Warning/low | `bg-amber-50 text-amber-700` |
| Error/critical | `bg-destructive/10 text-destructive` |
| Neutral/info | `bg-muted text-muted-foreground` |

### StatsCard

- Uses `bg-card` surface
- Icon in muted foreground
- Value: `text-2xl font-bold`
- Status indicators use warm semantic colors

### Scrollbar

Custom styled: warm-tinted, 6px width, rounded thumb.

---

## Dashboard Philosophy

The owner dashboard is a **morning briefing**, not an analytics platform.

- No abstract charts. Two insight cards: "Items Running Low" (list with progress bars) and "Your Busiest Items" (ranked list).
- Stats: 3 cards max — Items Tracked, Running Low, Out of Stock.
- Plain English everywhere. "You're tracking 45 items." Not "Total: 45."
- Quick actions with big buttons. Record Delivery, View Reports, Manage Inventory.
- Recent activity renamed "What Happened Today."

Staff/Driver dashboards follow the same warmth but scoped to their role's actions (shifts, deliveries, stock counts).
