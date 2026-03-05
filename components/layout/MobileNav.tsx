"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { AppRole, LegacyAppRole, StoreUser } from "@/types";
import { useAuth } from "@/hooks/useAuth";
import { normalizeRole } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/constants";

function getStoreRoleLabel(storeUser: StoreUser): string {
  if (storeUser.role === "Owner" && !storeUser.is_billing_owner)
    return "Co-Owner";
  return ROLE_LABELS[storeUser.role];
}
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  LayoutDashboard,
  Store,
  Package,
  Users,
  FileText,
  Clock,
  Menu,
  LogOut,
  Check,
  ChevronRight,
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

interface MobileNavProps {
  role: AppRole | LegacyAppRole | null;
  variant?: "default" | "navbar";
}

// Routes accessible during store setup (everything else is locked)
const SETUP_ALLOWED_HREFS = new Set(["/", "/stores", "/billing", "/profile"]);

export function MobileNav({ role, variant = "default" }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const [storesExpanded, setStoresExpanded] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { signOut, stores, currentStore, setCurrentStore, isMultiStoreUser } =
    useAuth();

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

  const visibleSections = SECTION_ORDER.filter((s) => groupedItems[s]?.length);

  const handleLogout = async () => {
    setOpen(false);
    await signOut();
  };

  const handleStoreSelect = (storeId: string) => {
    setCurrentStore(storeId);
    setStoresExpanded(false);
    setOpen(false);
    router.push("/");
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "md:hidden",
            variant === "navbar" &&
              "text-navbar-foreground hover:bg-navbar-foreground/10",
          )}
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-72 p-0 flex flex-col bg-sidebar text-sidebar-foreground border-sidebar-border"
      >
        <div className="flex h-14 items-center border-b border-sidebar-border px-6">
          <SheetTitle className="font-semibold text-lg text-sidebar-foreground">
            Qaos
          </SheetTitle>
        </div>

        {/* Store Selector for multi-store users */}
        {isMultiStoreUser && stores.length > 1 && (
          <div className="border-b border-sidebar-border">
            <button
              onClick={() => setStoresExpanded(!storesExpanded)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-sidebar-accent/50 transition-colors"
              aria-expanded={storesExpanded}
            >
              <div className="flex items-center gap-3">
                <Store className="h-5 w-5 text-sidebar-foreground/70" />
                <div className="text-left">
                  <p className="text-sm font-medium truncate max-w-[160px] text-sidebar-foreground">
                    {currentStore?.store?.name || "Select Store"}
                  </p>
                  {currentStore && (
                    <p className="text-xs text-sidebar-foreground/60">
                      {ROLE_LABELS[currentStore.role]}
                    </p>
                  )}
                </div>
              </div>
              <ChevronRight
                className={cn(
                  "h-4 w-4 text-sidebar-foreground/70 transition-transform",
                  storesExpanded && "rotate-90",
                )}
              />
            </button>

            {/* Store list */}
            {storesExpanded && (
              <div className="pb-2 px-2 space-y-1">
                {stores.map((storeUser) => (
                  <button
                    key={storeUser.store_id}
                    onClick={() => handleStoreSelect(storeUser.store_id)}
                    className={cn(
                      "w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md text-sm transition-colors",
                      currentStore?.store_id === storeUser.store_id
                        ? "bg-sidebar-accent text-sidebar-foreground"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                    )}
                  >
                    <div className="flex flex-col items-start min-w-0 flex-1">
                      <span className="font-medium truncate max-w-[180px]">
                        {storeUser.store?.name}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-sidebar-foreground/60">
                          {getStoreRoleLabel(storeUser)}
                        </span>
                        {storeUser.is_billing_owner && (
                          <Badge
                            variant="secondary"
                            className="text-[10px] px-1 py-0"
                          >
                            Billing
                          </Badge>
                        )}
                      </div>
                    </div>
                    {currentStore?.store_id === storeUser.store_id && (
                      <Check className="h-4 w-4 text-sidebar-foreground flex-shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Single store indicator */}
        {!isMultiStoreUser && currentStore && (
          <div className="border-b border-sidebar-border px-4 py-3">
            <div className="flex items-center gap-3">
              <Store className="h-5 w-5 text-sidebar-foreground/70" />
              <div>
                <p className="text-sm font-medium truncate max-w-[180px] text-sidebar-foreground">
                  {currentStore.store?.name}
                </p>
                <p className="text-xs text-sidebar-foreground/60">
                  {getStoreRoleLabel(currentStore)}
                </p>
              </div>
            </div>
          </div>
        )}

        {isInSetup && (
          <div className="mx-2 mt-2 rounded-md bg-amber-500/10 border border-amber-500/20 px-3 py-2">
            <p className="text-xs font-medium text-amber-400">
              Setup in progress
            </p>
            <p className="text-[11px] text-amber-400/80 dark:text-amber-500/80 mt-0.5">
              Complete store setup to unlock all features
            </p>
          </div>
        )}

        <nav
          className="flex-1 p-2 space-y-1 overflow-y-auto"
          aria-label="Mobile navigation"
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
                      onClick={() => setOpen(false)}
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

        <div className="border-t border-sidebar-border p-4 mt-auto">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors w-full text-destructive/70 hover:bg-destructive/5"
            aria-label="Log out of your account"
          >
            <LogOut className="h-5 w-5" aria-hidden="true" />
            <span>Log out</span>
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
