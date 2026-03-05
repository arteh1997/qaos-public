"use client";

// Prevent static prerendering - page uses client-side data fetching
export const dynamic = "force-dynamic";

import { useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useStoreSetupStatus } from "@/hooks/useStoreSetupStatus";
import { useStockHistoryRange } from "@/hooks/useReports";
import { DateRange } from "react-day-picker";
import { StockHistoryTable } from "@/components/tables/StockHistoryTable";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import {
  ArrowLeft,
  ClipboardList,
  Download,
  Calendar,
  Package,
  Printer,
} from "lucide-react";
import { format, startOfWeek } from "date-fns";
import {
  exportToCSV,
  generateExportFilename,
  formatDateTimeForExport,
} from "@/lib/export";
import { toast } from "sonner";
import { PageGuide } from "@/components/help/PageGuide";
import { useState } from "react";

export default function DailySummaryPage() {
  const { currentStore } = useAuth();
  const currentStoreId = currentStore?.store_id;

  // Check store setup status
  const { status: setupStatus, isLoading: setupLoading } = useStoreSetupStatus(
    currentStoreId || null,
  );

  // Default to "This week" - from Monday to today
  const [dateRange, setDateRange] = useState<DateRange>(() => ({
    from: startOfWeek(new Date(), { weekStartsOn: 1 }),
    to: new Date(),
  }));

  // Fetch history for current store only
  const { data: history, isLoading: historyLoading } = useStockHistoryRange(
    currentStoreId || undefined,
    dateRange,
  );

  const isLoading = historyLoading || setupLoading;

  // Separate counts and receptions
  const counts = (history ?? []).filter((h) => h.action_type === "Count");
  const receptions = (history ?? []).filter(
    (h) => h.action_type === "Reception",
  );

  // Format date range for display
  const dateRangeLabel = useMemo(() => {
    if (!dateRange?.from) return "Select dates";
    if (
      !dateRange?.to ||
      format(dateRange.from, "yyyy-MM-dd") ===
        format(dateRange.to, "yyyy-MM-dd")
    ) {
      return format(dateRange.from, "MMMM d, yyyy");
    }
    return `${format(dateRange.from, "MMM d")} - ${format(dateRange.to, "MMM d, yyyy")}`;
  }, [dateRange]);

  // Format filename for export
  const exportFilename = useMemo(() => {
    if (!dateRange?.from) return "stock-summary";
    const fromStr = format(dateRange.from, "yyyy-MM-dd");
    const toStr = dateRange.to ? format(dateRange.to, "yyyy-MM-dd") : fromStr;
    if (fromStr === toStr) return `stock-summary-${fromStr}`;
    return `stock-summary-${fromStr}-to-${toStr}`;
  }, [dateRange]);

  const handleExport = () => {
    if (!history || history.length === 0) {
      toast.info("No data to export");
      return;
    }

    const columns = [
      {
        key: "created_at",
        header: "Date/Time",
        transform: (v: unknown) => formatDateTimeForExport(v as string),
      },
      { key: "store.name", header: "Store" },
      { key: "inventory_item.name", header: "Item" },
      { key: "action_type", header: "Action" },
      {
        key: "quantity_before",
        header: "Previous Qty",
        transform: (v: unknown) => (v != null ? String(v) : "0"),
      },
      {
        key: "quantity_after",
        header: "New Qty",
        transform: (v: unknown) => (v != null ? String(v) : "0"),
      },
      {
        key: "quantity_change",
        header: "Change",
        transform: (v: unknown) => {
          const num = v as number;
          if (num == null) return "0";
          return num > 0 ? `+${num}` : String(num);
        },
      },
      { key: "performer.full_name", header: "User" },
      {
        key: "notes",
        header: "Notes",
        transform: (v: unknown) => String(v || ""),
      },
    ];

    exportToCSV(history, columns, generateExportFilename(exportFilename));
    toast.success(`Exported ${history.length} records`);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="flex gap-4">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-40" />
        </div>
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
              Stock Summary
            </h1>
            <p className="text-sm text-muted-foreground">
              Please select a store from the sidebar to view its stock summary.
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
              Stock Summary
            </h1>
            <p className="text-sm text-muted-foreground">
              Stock changes at {currentStore.store?.name}
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
              <div className="rounded-lg p-1.5 bg-emerald-500/10">
                <ClipboardList className="h-5 w-5 text-emerald-400" />
              </div>
              Stock Summary
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Stock changes at {currentStore.store?.name}
            </p>
          </div>
          <PageGuide pageKey="daily-summary" />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <DateRangePicker
            value={dateRange}
            onChange={(range) =>
              setDateRange(range || { from: new Date(), to: new Date() })
            }
            className="w-auto min-w-[220px]"
          />
          {history && history.length > 0 && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                className="h-8 text-xs print:hidden"
              >
                <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                Export
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.print()}
                className="h-8 text-xs print:hidden"
              >
                <Printer className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                Print
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Total Changes
            </p>
            <p className="text-2xl font-bold mt-1">{(history ?? []).length}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {dateRangeLabel}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Stock Counts
            </p>
            <p className="text-2xl font-bold mt-1">{counts.length}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              inventory checks
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Receptions
            </p>
            <p className="text-2xl font-bold mt-1">{receptions.length}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              deliveries received
            </p>
          </CardContent>
        </Card>
      </div>

      {history && history.length > 0 ? (
        <StockHistoryTable history={history} showStore={false} />
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm font-medium mb-1">No stock changes found</p>
            <p className="text-xs text-muted-foreground">
              Try selecting a different date range
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
