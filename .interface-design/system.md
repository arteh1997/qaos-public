# Design System — Qaos Restaurant Intelligence Platform

## Direction

**Who**: Restaurant owners, managers, staff, drivers. People running kitchens — not developers. They open this at 6am with coffee or mid-rush on a phone.

**What they need**: Instant clarity. "Am I running out of anything?" "What do I need to order?" "Did my team do their job?" No charts that need interpreting. Plain English.

**Feel**: Dark, bold, precise. A command centre for your kitchen. High contrast teal on near-black. Clean and modern, never cluttered.

---

## Palette

All colors trace to CSS custom properties in `:root` (app/globals.css). Hex format for Tailwind v4 `@theme inline` compatibility.

### Surfaces

| Token              | Value     | Role                           |
| ------------------ | --------- | ------------------------------ |
| `--background`     | `#0a0a0a` | Canvas — near-black            |
| `--card`           | `#141414` | Cards — dark elevated surface  |
| `--popover`        | `#141414` | Dropdowns, dialogs             |
| `--muted`          | `#242424` | Subtle backgrounds, zebra rows |
| `--secondary`      | `#1f1f1f` | Secondary buttons, tags        |
| `--surface-raised` | `#1a1a1a` | Slightly elevated sections     |
| `--navbar`         | `#0a0a0a` | Top bar — matches canvas       |
| `--sidebar`        | `#0f0f0f` | Slightly darker than canvas    |

### Text

| Token                  | Value     | Role                                   |
| ---------------------- | --------- | -------------------------------------- |
| `--foreground`         | `#f2f2f2` | Primary text — near-white              |
| `--card-foreground`    | `#f2f2f2` | Card text                              |
| `--muted-foreground`   | `#8c8c8c` | Secondary text, labels, descriptions   |
| `--navbar-foreground`  | `#f2f2f2` | Navbar text                            |
| `--sidebar-foreground` | `#e6e6e6` | Sidebar labels                         |
| `--primary-foreground` | `#0a0a0a` | Text on primary buttons (dark on teal) |

### Semantic Colors

| Token              | Value     | Role                                      |
| ------------------ | --------- | ----------------------------------------- |
| `--primary`        | `#2ed9b8` | Primary actions — teal, bold, distinctive |
| `--accent`         | `#ff9933` | Accent — warm orange                      |
| `--highlight`      | `#b366ff` | Highlight — vibrant purple                |
| `--warm`           | `#ff9933` | Warm colour for warnings/attention        |
| `--glow`           | `#2ed9b8` | Glow effects — same as primary            |
| `--destructive`    | `#e04030` | Errors, danger                            |
| `--ring`           | `#2ed9b8` | Focus rings — teal                        |
| `--border`         | `#262626` | Subtle borders                            |
| `--input`          | `#262626` | Input borders                             |
| `--sidebar-active` | `#2ed9b8` | Active nav item — teal                    |

### Status Colors (Tailwind utilities — opacity-based for dark backgrounds)

| Use            | Class                                | Notes                             |
| -------------- | ------------------------------------ | --------------------------------- |
| Success badges | `bg-emerald-500/10 text-emerald-400` | Transparent green on dark         |
| Warning badges | `bg-amber-500/10 text-amber-400`     | Transparent amber on dark         |
| Error badges   | `bg-red-500/10 text-red-400`         | Transparent red on dark           |
| Info badges    | `bg-blue-500/10 text-blue-400`       | Transparent blue on dark          |
| Warning text   | `text-amber-400`                     | Never 600/700 on dark             |
| Error text     | `text-destructive` or `text-red-400` |                                   |
| Success text   | `text-emerald-400`                   |                                   |
| Status borders | `border-emerald-500/20` etc.         | Opacity-based, matches bg pattern |

### Charts

| Token       | Value     | Use                 |
| ----------- | --------- | ------------------- |
| `--chart-1` | `#2ed9b8` | Primary — teal      |
| `--chart-2` | `#ff9933` | Secondary — orange  |
| `--chart-3` | `#e04030` | Tertiary — red      |
| `--chart-4` | `#b366ff` | Quaternary — purple |
| `--chart-5` | `#4ade80` | Quinary — green     |

---

## Depth

**Philosophy**: Borders for structure, shadows for critical elevation only.

| Element        | Depth                              |
| -------------- | ---------------------------------- |
| Cards          | `shadow-card` — subtle dark shadow |
| Sidebar        | No shadow. Darker bg + `border-r`  |
| Navbar         | No shadow. Shares canvas bg        |
| Modals/dialogs | shadcn default shadow              |
| Dropdowns      | shadcn default shadow              |

### Shadow definition

```css
--shadow-card: 0 1px 3px rgba(0, 0, 0, 0.3), 0 4px 12px rgba(0, 0, 0, 0.2);
```

Dark-tinted shadow — never warm gray.

---

## Typography

- **Display font**: Syne (via `--font-syne` / `font-display`), weights 400–800
- **Body font**: Inter (via `--font-inter` / `font-sans`), fallback system-ui sans-serif
- **Antialiasing**: Always on (`antialiased` on body)
- **Headings**: All `h1, h2, h3` use Syne via CSS rule

### Scale

| Use                 | Class                                                              |
| ------------------- | ------------------------------------------------------------------ |
| Hero headline       | `.hero-headline` — Syne, 4xl→[5.5rem], extrabold, tracking-tighter |
| Section headline    | `.section-headline` — Syne, 3xl→6xl, bold, tracking-tighter        |
| Stat number         | `.stat-number` — Syne, 3xl→8xl, extrabold, tracking-tighter        |
| Page title          | `text-2xl font-semibold tracking-tight`                            |
| Section title       | `text-base font-semibold`                                          |
| Card title          | `text-base font-semibold` (via CardTitle)                          |
| Body                | `text-sm` (default)                                                |
| Description/caption | `text-sm text-muted-foreground`                                    |
| Tiny labels         | `text-xs text-muted-foreground`                                    |
| Stats card value    | `text-2xl font-bold`                                               |

### Glow text

```css
.glow-text {
  background: linear-gradient(135deg, var(--primary), var(--highlight));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
```

---

## Spacing

- **Base unit**: 4px (Tailwind's default)
- **Card padding**: `p-6` (CardContent default)
- **Section gaps**: `space-y-6` between major sections
- **Grid gaps**: `gap-4` for card grids, `gap-6` for section grids
- **Page structure**: `space-y-6` vertically
- **Marketing sections**: `py-24 md:py-32` or `py-32 md:py-40`

---

## Radius

- **Base**: `--radius: 0.75rem` (12px)
- Cards, buttons, inputs derive from `--radius-sm`, `--radius-md`, `--radius-lg`
- Marketing CTAs: `rounded-full` (pill buttons)

---

## Component Patterns

### Surface Rule

- **Never** use `bg-white` directly. Use `bg-card` for elevated surfaces.
- **Never** use `bg-gray-*`. Use `bg-muted` or `bg-muted/50` for subtle fills.
- Hover states: `hover:bg-muted` or `hover:bg-card`

### Color Replacement Rules

| Never use                 | Use instead                                                |
| ------------------------- | ---------------------------------------------------------- |
| `bg-white`                | `bg-card`                                                  |
| `bg-gray-50/100`          | `bg-muted` or `bg-muted/50`                                |
| `text-gray-500/600`       | `text-muted-foreground`                                    |
| `text-red-500/600`        | `text-destructive` or `text-red-400`                       |
| `bg-red-50`               | `bg-red-500/10`                                            |
| `bg-green-50`             | `bg-emerald-500/10`                                        |
| `bg-amber-50`             | `bg-amber-500/10`                                          |
| `bg-blue-50`              | `bg-blue-500/10`                                           |
| `text-emerald-700`        | `text-emerald-400`                                         |
| `text-amber-700`          | `text-amber-400`                                           |
| `text-red-700`            | `text-red-400`                                             |
| `border-gray-200`         | `border-border`                                            |
| `border-emerald-200`      | `border-emerald-500/20`                                    |
| `text-black`              | `text-foreground`                                          |
| `text-white` (on buttons) | `text-primary-foreground` or `text-destructive-foreground` |

### Sidebar

- Darker than canvas: `bg-sidebar` (`#0f0f0f`)
- Separation via `border-r` + subtle shade difference
- Active item: teal text (`text-sidebar-active`)
- Hover: `hover:bg-sidebar-hover` (`#1f1f1f`)
- Nav labels: `text-sidebar-foreground` (`#e6e6e6`)

### Navbar

- Matches canvas: `bg-navbar` (`#0a0a0a`)
- Text: `text-navbar-foreground` (`#f2f2f2`)

### Badges

| State            | Classes                              |
| ---------------- | ------------------------------------ |
| Success/complete | `bg-emerald-500/10 text-emerald-400` |
| Warning/low      | `bg-amber-500/10 text-amber-400`     |
| Error/critical   | `bg-red-500/10 text-red-400`         |
| Neutral/info     | `bg-muted text-muted-foreground`     |
| Tag-style        | `.badge-tag` utility class           |

### Marketing Pill Buttons

```html
<!-- Primary -->
<link
  class="bg-primary text-primary-foreground px-8 py-4 rounded-full font-semibold hover:brightness-110"
/>
<!-- Secondary -->
<link
  class="border border-border text-foreground px-8 py-4 rounded-full font-medium hover:bg-card"
/>
```

### Animation (framer-motion)

- **Easing**: `[0.22, 1, 0.36, 1]` (expo out) — consistent everywhere
- **Scroll trigger**: `useInView` with `{ once: true, margin: "-80px" }`
- **Stagger**: `delay: 0.1 + i * 0.08` for lists
- **Fade in**: `{ opacity: 0, y: 30 }` → `{ opacity: 1, y: 0 }`
- **Duration**: 0.5–0.8s for sections, 0.3–0.5s for individual elements

### Scrollbar

Custom styled: dark-tinted, 6px width, rounded thumb. Thumb `#333`, hover `#444`, track `#111`.

---

## Dashboard Philosophy

The owner dashboard is a **morning briefing**, not an analytics platform.

- No abstract charts. Two insight cards: "Items Running Low" and "Your Busiest Items."
- Stats: 3 cards max — Items Tracked, Running Low, Out of Stock.
- Plain English everywhere. "You're tracking 45 items." Not "Total: 45."
- Quick actions with big buttons. Record Delivery, View Reports, Manage Inventory.
- Recent activity renamed "What Happened Today."

Staff/Driver dashboards follow the same dark style but scoped to their role's actions.
