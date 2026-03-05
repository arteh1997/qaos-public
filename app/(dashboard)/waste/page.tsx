"use client";

import { Suspense, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useWasteTracking } from "@/hooks/useWasteTracking";
import { useStoreInventory } from "@/hooks/useStoreInventory";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { WasteLogForm } from "@/components/waste/WasteLogForm";
import dynamic from "next/dynamic";
import { Skeleton as ChartSkeleton } from "@/components/ui/skeleton";

const WasteAnalyticsCharts = dynamic(
  () =>
    import("@/components/waste/WasteAnalyticsCharts").then((mod) => ({
      default: mod.WasteAnalyticsCharts,
    })),
  { loading: () => <ChartSkeleton className="h-64 w-full" /> },
);
import {
  Trash2,
  DollarSign,
  AlertTriangle,
  TrendingDown,
  Plus,
  Printer,
} from "lucide-react";
import { toast } from "sonner";
import type { WasteReason } from "@/types";
import { PageGuide } from "@/components/help/PageGuide";

const REASON_COLORS: Record<string, string> = {
  spoilage: "bg-destructive/10 text-destructive/80",
  expired: "bg-orange-100 text-orange-800",
  damaged: "bg-amber-100 text-amber-400",
  overproduction: "bg-blue-100 text-blue-800",
  other: "bg-muted text-muted-foreground",
};

export default function WastePage() {
  const { currentStore, role } = useAuth();
  const storeId = currentStore?.store_id ?? null;

  const {
    submitWasteReport,
    isSubmitting,
    wasteHistory,
    isLoadingHistory,
    fetchWasteHistory,
    analytics,
    isLoadingAnalytics,
    fetchAnalytics,
  } = useWasteTracking(storeId);

  const { inventory } = useStoreInventory(storeId);

  const [showLogForm, setShowLogForm] = useState(false);
  const [reasonFilter, setReasonFilter] = useState<string>("all");

  useEffect(() => {
    if (storeId) {
      fetchAnalytics();
      fetchWasteHistory();
    }
  }, [storeId, fetchAnalytics, fetchWasteHistory]);

  if (role !== "Owner" && role !== "Manager" && role !== "Staff") {
    return (
      <div className="space-y-6">
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
          Waste Tracking
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Track and reduce food waste
        </p>
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            This feature is not available for your role.
          </CardContent>
        </Card>
      </div>
    );
  }

  const isManagement = role === "Owner" || role === "Manager";

  if (!storeId) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
          Waste Tracking
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Track and reduce food waste
        </p>
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            Select a store to view waste tracking.
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleSubmitWaste = async (data: {
    items: Array<{
      inventory_item_id: string;
      quantity: number;
      reason?: WasteReason;
    }>;
    notes?: string;
  }) => {
    try {
      await submitWasteReport(data);
      toast.success("Waste report submitted successfully");
      fetchWasteHistory();
      fetchAnalytics();
    } catch {
      toast.error("Failed to submit waste report");
    }
  };

  const handleReasonFilter = (value: string) => {
    setReasonFilter(value);
    fetchWasteHistory({
      reason: value === "all" ? undefined : (value as WasteReason),
    });
  };

  const inventoryOptions = inventory
    .filter((item) => item.inventory_item)
    .map((item) => ({
      id: item.inventory_item_id,
      name: item.inventory_item!.name,
      unit_of_measure: item.inventory_item!.unit_of_measure,
    }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Trash2 className="h-6 w-6" />
            Waste Tracking
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track and reduce food waste
          </p>
          <p className="text-sm text-muted-foreground mt-0.5">
            {currentStore?.store?.name ?? "Your store"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PageGuide pageKey="waste" />
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="print:hidden"
          >
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
          <Button onClick={() => setShowLogForm(true)} className="print:hidden">
            <Plus className="h-4 w-4 mr-2" />
            Log Waste
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {/* Analytics section - Owner/Manager only */}
      {isManagement && (
        <>
          {isLoadingAnalytics ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="pt-4">
                    <Skeleton className="h-4 w-20 mb-2" />
                    <Skeleton className="h-8 w-16" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : analytics ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <DollarSign className="h-4 w-4" />
                    Total Waste Cost
                  </div>
                  <p className="text-2xl font-bold mt-1 text-destructive">
                    ${analytics.summary.total_estimated_cost.toFixed(2)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <AlertTriangle className="h-4 w-4" />
                    Total Incidents
                  </div>
                  <p className="text-2xl font-bold mt-1">
                    {analytics.summary.total_incidents}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Trash2 className="h-4 w-4" />
                    Top Reason
                  </div>
                  <p className="text-2xl font-bold mt-1 capitalize">
                    {analytics.by_reason[0]?.reason ?? "N/A"}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <TrendingDown className="h-4 w-4" />
                    Avg Cost/Day
                  </div>
                  <p className="text-2xl font-bold mt-1">
                    $
                    {analytics.daily_trend.length > 0
                      ? (
                          analytics.summary.total_estimated_cost /
                          analytics.daily_trend.length
                        ).toFixed(2)
                      : "0.00"}
                  </p>
                </CardContent>
              </Card>
            </div>
          ) : null}

          {/* Charts */}
          {analytics && (
            <WasteAnalyticsCharts
              dailyTrend={analytics.daily_trend}
              byReason={analytics.by_reason}
            />
          )}

          {/* Top Wasted Items */}
          {analytics && analytics.top_items.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">
                  Top Wasted Items
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Mobile card view */}
                <div className="sm:hidden space-y-3">
                  {analytics.top_items.map((item) => (
                    <div
                      key={item.inventory_item_id}
                      className="border rounded-lg p-3 space-y-2"
                    >
                      <div>
                        <p className="font-medium">{item.item_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.category ?? "-"}
                        </p>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          {item.total_quantity} {item.unit_of_measure}
                        </span>
                        <span className="text-destructive font-medium">
                          £{item.total_cost.toFixed(2)}
                        </span>
                        <span className="text-muted-foreground">
                          {item.incident_count} incidents
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                {/* Desktop table view */}
                <div className="hidden sm:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Quantity</TableHead>
                        <TableHead className="text-right">Cost</TableHead>
                        <TableHead className="text-right">Incidents</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {analytics.top_items.map((item) => (
                        <TableRow key={item.inventory_item_id}>
                          <TableCell className="font-medium">
                            {item.item_name}
                          </TableCell>
                          <TableCell>{item.category ?? "-"}</TableCell>
                          <TableCell className="text-right">
                            {item.total_quantity} {item.unit_of_measure}
                          </TableCell>
                          <TableCell className="text-right text-destructive">
                            £{item.total_cost.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right">
                            {item.incident_count}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Waste History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Waste History</CardTitle>
            <Select value={reasonFilter} onValueChange={handleReasonFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Filter by reason" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Reasons</SelectItem>
                <SelectItem value="spoilage">Spoilage</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="damaged">Damaged</SelectItem>
                <SelectItem value="overproduction">Overproduction</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingHistory ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : wasteHistory.length === 0 ? (
            <EmptyState
              icon={Trash2}
              title="No waste records"
              description="Start logging waste to track and reduce losses."
              action={{
                label: "Log Waste",
                onClick: () => setShowLogForm(true),
                icon: Plus,
              }}
            />
          ) : (
            <>
              {/* Mobile card view */}
              <div className="sm:hidden space-y-3">
                {wasteHistory.map((entry) => (
                  <div
                    key={entry.id}
                    className="border rounded-lg p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {new Date(entry.reported_at).toLocaleDateString(
                          "en-US",
                          {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          },
                        )}
                      </span>
                      <Badge
                        variant="secondary"
                        className={REASON_COLORS[entry.reason] || ""}
                      >
                        {entry.reason}
                      </Badge>
                    </div>
                    <p className="font-medium">
                      {entry.inventory_item?.name ?? "Unknown"}
                    </p>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        Qty: {entry.quantity}
                      </span>
                      <span className="text-destructive font-medium">
                        £{entry.estimated_cost.toFixed(2)}
                      </span>
                    </div>
                    {entry.notes && (
                      <p className="text-xs text-muted-foreground">
                        {entry.notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
              {/* Desktop table view */}
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {wasteHistory.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="whitespace-nowrap">
                          {new Date(entry.reported_at).toLocaleDateString(
                            "en-US",
                            {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            },
                          )}
                        </TableCell>
                        <TableCell className="font-medium">
                          {entry.inventory_item?.name ?? "Unknown"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={REASON_COLORS[entry.reason] || ""}
                          >
                            {entry.reason}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {entry.quantity}
                        </TableCell>
                        <TableCell className="text-right text-destructive">
                          £{entry.estimated_cost.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-[200px] truncate">
                          {entry.notes ?? "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Log Form Dialog */}
      <WasteLogForm
        open={showLogForm}
        onOpenChange={setShowLogForm}
        inventoryItems={inventoryOptions}
        onSubmit={handleSubmitWaste}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
