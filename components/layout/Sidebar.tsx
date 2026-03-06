"use client";

import { memo, useCallback, useMemo } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { AppRole, LegacyAppRole } from "@/types";
import {
  LayoutDashboard,
  Package,
  Users,
  FileText,
  Clock,
  CreditCard,
  Trash2,
  Truck,
  UtensilsCrossed,
  Settings,
  ClipboardList,
  AlertTriangle,
  PackageCheck,
  Activity,
  DollarSign,
  PoundSterling,
  ScanLine,
  Plug,
  Shield,
} from "lucide-react";
import { normalizeRole } from "@/lib/auth";
import { Separator } from "@/components/ui/separator";
import { StoreSelector } from "./StoreSelector";
import { useAuth } from "@/hooks/useAuth";

type NavSection =
  | "overview"
  | "stock"
  | "operations"
  | "team"
  | "insights"
  | "system";

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: AppRole[];
  section: NavSection;
  requiresBillingOwner?: boolean;
}

const navItems: NavItem[] = [
  // Overview — Dashboard stands alone at the top
  {
    title: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
    roles: ["Owner", "Manager", "Staff"],
    section: "overview",
  },

  // Stock — core inventory management flow
  {
    title: "Inventory",
    href: "/inventory",
    icon: Package,
    roles: ["Owner", "Manager"],
    section: "stock",
  },
  {
    title: "Stock Reception",
    href: "/deliveries",
    icon: PackageCheck,
    roles: ["Owner", "Manager", "Staff"],
    section: "stock",
  },
  {
    title: "Stock Costs",
    href: "/inventory-value",
    icon: DollarSign,
    roles: ["Owner", "Manager"],
    section: "stock",
  },
  {
    title: "Stock Count",
    href: "/stock-count",
    icon: ClipboardList,
    roles: ["Staff"],
    section: "stock",
  },
  {
    title: "Low Stock",
    href: "/low-stock",
    icon: AlertTriangle,
    roles: ["Staff"],
    section: "stock",
  },

  // Operations — broader business operations
  {
    title: "Menu & Costs",
    href: "/recipes",
    icon: UtensilsCrossed,
    roles: ["Owner", "Manager"],
    section: "operations",
  },
  {
    title: "Suppliers",
    href: "/suppliers",
    icon: Truck,
    roles: ["Owner", "Manager"],
    section: "operations",
  },
  {
    title: "Invoices",
    href: "/invoices",
    icon: ScanLine,
    roles: ["Owner", "Manager"],
    section: "operations",
  },
  {
    title: "Waste Tracking",
    href: "/waste",
    icon: Trash2,
    roles: ["Owner", "Manager", "Staff"],
    section: "operations",
  },
  {
    title: "Food Safety",
    href: "/haccp",
    icon: Shield,
    roles: ["Owner", "Manager", "Staff"],
    section: "operations",
  },

  // Team
  {
    title: "Team",
    href: "/users",
    icon: Users,
    roles: ["Owner", "Manager"],
    section: "team",
  },
  {
    title: "Shifts",
    href: "/shifts",
    icon: Clock,
    roles: ["Owner", "Manager"],
    section: "team",
  },
  {
    title: "My Shifts",
    href: "/my-shifts",
    icon: Clock,
    roles: ["Staff"],
    section: "team",
  },
  {
    title: "Payroll",
    href: "/payroll",
    icon: PoundSterling,
    roles: ["Owner", "Manager"],
    section: "team",
  },
  {
    title: "My Pay",
    href: "/my-pay",
    icon: PoundSterling,
    roles: ["Staff"],
    section: "team",
  },

  // Insights
  {
    title: "Reports",
    href: "/reports",
    icon: FileText,
    roles: ["Owner", "Manager", "Staff"],
    section: "insights",
  },
  {
    title: "Activity Log",
    href: "/activity",
    icon: Activity,
    roles: ["Owner", "Manager"],
    section: "insights",
  },

  // System
  {
    title: "Integrations",
    href: "/integrations",
    icon: Plug,
    roles: ["Owner", "Manager"],
    section: "system",
  },
  {
    title: "Settings",
    href: "/settings",
    icon: Settings,
    roles: ["Owner", "Manager"],
    section: "system",
  },
  {
    title: "Billing",
    href: "/billing",
    icon: CreditCard,
    roles: ["Owner"],
    section: "system",
  },
];

const SECTION_ORDER: NavSection[] = [
  "overview",
  "stock",
  "operations",
  "team",
  "insights",
  "system",
];

const SECTION_LABELS: Record<NavSection, string> = {
  overview: "",
  stock: "Stock",
  operations: "Operations",
  team: "Team",
  insights: "Insights",
  system: "System",
};

interface SidebarProps {
  role: AppRole | LegacyAppRole | null;
}

// Routes accessible during store setup (everything else is locked)
const SETUP_ALLOWED_HREFS = new Set(["/", "/stores", "/billing", "/profile"]);

// Map sidebar routes to their primary TanStack Query keys for prefetching
// Only include routes that have matching API endpoints under /api/stores/[storeId]/
const PREFETCH_MAP: Record<
  string,
  (storeId: string) => { queryKey: string[]; url: string }
> = {
  "/inventory": (sid) => ({
    queryKey: ["inventory", sid],
    url: `/api/stores/${sid}/inventory?page=1&page_size=25`,
  }),
  "/suppliers": (sid) => ({
    queryKey: ["suppliers", sid],
    url: `/api/stores/${sid}/suppliers`,
  }),
  "/recipes": (sid) => ({
    queryKey: ["recipes", sid],
    url: `/api/stores/${sid}/recipes`,
  }),
  "/waste": (sid) => ({
    queryKey: ["waste-log", sid],
    url: `/api/stores/${sid}/waste`,
  }),
  "/users": (sid) => ({
    queryKey: ["store-users", sid],
    url: `/api/stores/${sid}/users`,
  }),
  "/haccp": (sid) => ({
    queryKey: ["haccp-checks", sid],
    url: `/api/stores/${sid}/haccp/checks`,
  }),
};

export const Sidebar = memo(function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();
  const { currentStore } = useAuth();
  const queryClient = useQueryClient();

  const normalizedRole = normalizeRole(role);
  const isBillingOwner = currentStore?.is_billing_owner === true;
  const isInSetup =
    currentStore?.store && !currentStore.store.setup_completed_at;

  const groupedItems = useMemo(() => {
    const filtered = navItems.filter((item) => {
      if (!normalizedRole || !item.roles.includes(normalizedRole)) return false;
      if (item.requiresBillingOwner && !isBillingOwner) return false;
      // During setup, only allow specific routes
      if (isInSetup && !SETUP_ALLOWED_HREFS.has(item.href)) return false;
      return true;
    });

    const groups: Partial<Record<NavSection, NavItem[]>> = {};
    for (const item of filtered) {
      if (!groups[item.section]) groups[item.section] = [];
      groups[item.section]!.push(item);
    }
    return groups;
  }, [normalizedRole, isBillingOwner, isInSetup]);

  const storeId = currentStore?.store_id;

  const handlePrefetch = useCallback(
    (href: string) => {
      if (!storeId) return;
      const config = PREFETCH_MAP[href];
      if (!config) return;
      const { queryKey, url } = config(storeId);
      queryClient.prefetchQuery({
        queryKey,
        queryFn: async () => {
          const res = await fetch(url, { credentials: "include" });
          if (!res.ok) return null;
          const json = await res.json();
          return json.data;
        },
        staleTime: 30_000,
      });
    },
    [storeId, queryClient],
  );

  const visibleSections = SECTION_ORDER.filter((s) => groupedItems[s]?.length);

  return (
    <aside
      className="hidden md:flex flex-col w-60 bg-sidebar border-r border-sidebar-border"
      role="navigation"
      aria-label="Main navigation"
    >
      <StoreSelector className="py-2 border-b border-sidebar-border" />

      {isInSetup && (
        <div className="mx-2 mt-2 rounded-md bg-amber-500/10 border border-amber-500/20 px-3 py-2">
          <p className="text-xs font-medium text-amber-400">
            Setup in progress
          </p>
          <p className="text-[11px] text-amber-400/80 mt-0.5">
            Complete store setup to unlock all features
          </p>
        </div>
      )}

      <nav
        className="flex-1 p-2 space-y-1 overflow-y-auto"
        aria-label="Primary"
      >
        {visibleSections.map((section, sectionIdx) => {
          const items = groupedItems[section]!;

          return (
            <div key={section}>
              {sectionIdx > 0 && (
                <Separator className="my-2 bg-sidebar-border" />
              )}
              {SECTION_LABELS[section] && (
                <p className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
                  {SECTION_LABELS[section]}
                </p>
              )}
              {items.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/" &&
                    pathname.startsWith(item.href) &&
                    (pathname.length === item.href.length ||
                      pathname[item.href.length] === "/"));

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onMouseEnter={() => handlePrefetch(item.href)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                      isActive
                        ? "bg-sidebar-active/10 text-sidebar-active font-semibold"
                        : "text-sidebar-foreground font-medium hover:text-foreground hover:bg-muted/60",
                    )}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <item.icon
                      className="h-5 w-5 flex-shrink-0"
                      aria-hidden="true"
                    />
                    <span>{item.title}</span>
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>
    </aside>
  );
});
