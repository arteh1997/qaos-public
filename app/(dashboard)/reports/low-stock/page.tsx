"use client";

// Prevent static prerendering - page uses client-side data fetching
export const dynamic = "force-dynamic";

import { useState, useMemo, Suspense } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useStoreSetupStatus } from "@/hooks/useStoreSetupStatus";
import { useLowStockReport } from "@/hooks/useReports";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  AlertTriangle,
  Download,
  ArrowUp,
  ArrowDown,
  Package,
} from "lucide-react";
import { exportToCSV, generateExportFilename } from "@/lib/export";
import { toast } from "sonner";
import { PageGuide } from "@/components/help/PageGuide";
import { LowStockItem } from "@/types";

// Sort configuration
type SortKey = "item" | "current" | "par" | "shortage";
type SortDirection = "asc" | "desc";

interface SortConfig {
  key: SortKey;
  direction: SortDirection;
}

interface SortableHeaderProps {
  label: string;
  sortKey: SortKey;
  currentSort: SortConfig | null;
  onSort: (key: SortKey) => void;
  className?: string;
}

function SortableHeader({
  label,
  sortKey,
  currentSort,
  onSort,
  className = "",
}: SortableHeaderProps) {
  const isActive = currentSort?.key === sortKey;
  const direction = isActive ? currentSort.direction : null;

  return (
    <TableHead
      className={`cursor-pointer select-none hover:bg-muted/50 transition-colors ${className}`}
      onClick={() => onSort(sortKey)}
    >
      <div
        className={`flex items-center gap-1 ${className.includes("text-right") ? "justify-end" : ""}`}
      >
        <span>{label}</span>
        <span
          className={`transition-opacity ${isActive ? "opacity-100" : "opacity-0"}`}
        >
          {direction === "asc" ? (
            <ArrowUp className="h-3.5 w-3.5" />
          ) : (
            <ArrowDown className="h-3.5 w-3.5" />
          )}
        </span>
      </div>
    </TableHead>
  );
}

interface LowStockTableProps {
  items: LowStockItem[];
  storeId: string;
}

function LowStockTable({ items, storeId }: LowStockTableProps) {
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);

  const handleSort = (key: SortKey) => {
    setSortConfig((current) => {
      if (current?.key === key) {
        return {
          key,
          direction: current.direction === "asc" ? "desc" : "asc",
        };
      }
      return { key, direction: "asc" };
    });
  };

  const sortedItems = useMemo(() => {
    if (!sortConfig) return items;

    return [...items].sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;
      const multiplier = sortConfig.direction === "asc" ? 1 : -1;

      switch (sortConfig.key) {
        case "item":
          aVal = a.item_name.toLowerCase();
          bVal = b.item_name.toLowerCase();
          break;
        case "current":
          aVal = a.current_quantity;
          bVal = b.current_quantity;
          break;
        case "par":
          aVal = a.par_level;
          bVal = b.par_level;
          break;
        case "shortage":
          aVal = a.shortage;
          bVal = b.shortage;
          break;
        default:
          return 0;
      }

      if (typeof aVal === "string" && typeof bVal === "string") {
        return aVal.localeCompare(bVal) * multiplier;
      }

      if (aVal < bVal) return -1 * multiplier;
      if (aVal > bVal) return 1 * multiplier;
      return 0;
    });
  }, [items, sortConfig]);

  return (
    <>
      {/* Mobile card view */}
      <div className="sm:hidden space-y-2">
        {sortedItems.map((item) => (
          <div
            key={`${storeId}-${item.inventory_item_id}`}
            className="border rounded-lg p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium text-sm">{item.item_name}</p>
              <Badge variant="destructive" className="text-xs flex-shrink-0">
                -{item.shortage.toFixed(1)}
              </Badge>
            </div>
            <div className="flex items-center gap-4 mt-2 pt-2 border-t">
              <div>
                <div className="text-[10px] text-muted-foreground uppercase">
                  Current
                </div>
                <div className="text-lg font-bold text-destructive">
                  {item.current_quantity}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground uppercase">
                  PAR Level
                </div>
                <div className="text-lg font-bold text-muted-foreground">
                  {item.par_level}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table view */}
      <div className="hidden sm:block rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHeader
                label="Item"
                sortKey="item"
                currentSort={sortConfig}
                onSort={handleSort}
              />
              <SortableHeader
                label="Current"
                sortKey="current"
                currentSort={sortConfig}
                onSort={handleSort}
                className="text-right"
              />
              <SortableHeader
                label="PAR Level"
                sortKey="par"
                currentSort={sortConfig}
                onSort={handleSort}
                className="text-right"
              />
              <SortableHeader
                label="Shortage"
                sortKey="shortage"
                currentSort={sortConfig}
                onSort={handleSort}
                className="text-right"
              />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedItems.map((item) => (
              <TableRow key={`${storeId}-${item.inventory_item_id}`}>
                <TableCell className="font-medium">{item.item_name}</TableCell>
                <TableCell className="text-right text-destructive font-medium">
                  {item.current_quantity}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {item.par_level}
                </TableCell>
                <TableCell className="text-right">
                  <Badge variant="destructive">
                    -{item.shortage.toFixed(1)}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

function LowStockPageContent() {
  const { currentStore } = useAuth();
  const currentStoreId = currentStore?.store_id;

  // Check store setup status
  const { status: setupStatus, isLoading: setupLoading } = useStoreSetupStatus(
    currentStoreId || null,
  );
  const { data: lowStockItems, isLoading: reportLoading } =
    useLowStockReport(currentStoreId);

  const isLoading = reportLoading || setupLoading;

  const filteredItems = lowStockItems ?? [];

  const handleExport = () => {
    if (filteredItems.length === 0) {
      toast.info("No items to export");
      return;
    }

    const columns = [
      { key: "store_name" as const, header: "Store" },
      { key: "item_name" as const, header: "Item" },
      { key: "current_quantity" as const, header: "Current Quantity" },
      { key: "par_level" as const, header: "PAR Level" },
      { key: "shortage" as const, header: "Shortage" },
    ];

    exportToCSV(
      filteredItems,
      columns,
      generateExportFilename("low-stock-report"),
    );
    toast.success(`Exported ${filteredItems.length} items`);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-48" />
        </div>
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  // No store selected - prompt user to select one
  if (!currentStore) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <Link href="/reports">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
              Low Stock Report
            </h1>
            <p className="text-sm text-muted-foreground">
              Please select a store from the sidebar to view its low stock
              report.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Store hasn't completed setup - prompt to complete
  if (!setupStatus.isSetupComplete) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <Link href="/reports">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
              Low Stock Report
            </h1>
            <p className="text-sm text-muted-foreground">
              Items below PAR level at {currentStore.store?.name}
            </p>
          </div>
        </div>

        <Card className="border-amber-500/20 bg-amber-500/10">
          <CardContent className="py-12 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/50">
              <Package className="h-6 w-6 text-amber-400" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Complete Store Setup</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              You need to add inventory items to your store before you can view
              reports. Complete the store setup to start tracking stock.
            </p>
            <Link href="/">
              <Button>Go to Store Setup</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Link href="/reports">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight flex items-center gap-2">
              <div className="rounded-lg p-1.5 bg-amber-500/10">
                <AlertTriangle className="h-5 w-5 text-amber-400" />
              </div>
              Low Stock Report
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Items below PAR level at {currentStore.store?.name}
            </p>
          </div>
          <PageGuide pageKey="low-stock-report" />
          {filteredItems.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              className="h-8 text-xs shrink-0"
            >
              <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              Export
            </Button>
          )}
        </div>

        {filteredItems.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            <Card className="border-red-500/20 bg-red-500/10">
              <CardContent className="pt-4 pb-3">
                <p className="text-xs font-medium text-destructive uppercase tracking-wider">
                  Below PAR
                </p>
                <p className="text-2xl font-bold mt-1 text-destructive">
                  {filteredItems.length}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  items need restocking
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Total Shortage
                </p>
                <p className="text-2xl font-bold mt-1">
                  {filteredItems
                    .reduce((sum, i) => sum + i.shortage, 0)
                    .toFixed(0)}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  units below PAR
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {filteredItems.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
              <Package className="h-6 w-6 text-emerald-500" />
            </div>
            <h3 className="text-base font-semibold mb-1">
              All Stock Levels OK
            </h3>
            <p className="text-sm text-muted-foreground">
              No items are currently below their PAR level
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <LowStockTable
              items={filteredItems}
              storeId={currentStoreId || ""}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function LowStockPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10" />
            <Skeleton className="h-8 w-48" />
          </div>
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-96" />
        </div>
      }
    >
      <LowStockPageContent />
    </Suspense>
  );
}
