"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useStore } from "@/hooks/useStore";
import { useShifts } from "@/hooks/useShifts";
import {
  useDailyCounts,
  useLowStockReport,
  useStockHistory,
} from "@/hooks/useReports";
import { useStoreInventory } from "@/hooks/useStoreInventory";
import { useHACCPDashboard } from "@/hooks/useHACCP";
import { StatsCard } from "@/components/cards/StatsCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle,
  XCircle,
  Clock,
  ClipboardList,
  ArrowRight,
  AlertTriangle,
  Package,
  Activity,
  Trash2,
  TrendingDown,
  Shield,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { PageGuide } from "@/components/help/PageGuide";

export function StaffDashboard() {
  const { user, storeId, currentStore } = useAuth();
  const { data: store, isLoading: storeLoading } = useStore(storeId);
  const {
    todayShifts,
    currentShift,
    clockIn,
    clockOut,
    isLoading: shiftsLoading,
  } = useShifts(storeId, user?.id);
  const { data: dailyCounts, isLoading: countsLoading } =
    useDailyCounts(storeId);
  const { lowStockItems, isLoading: inventoryLoading } =
    useStoreInventory(storeId);
  const { data: storeLowStock, isLoading: lowStockLoading } =
    useLowStockReport(storeId);

  const today = new Date().toISOString().split("T")[0];
  const { data: recentActivity, isLoading: activityLoading } = useStockHistory(
    storeId || null,
    today,
  );

  // HACCP due checks
  const { data: haccpDashboard } = useHACCPDashboard(storeId || null);
  const haccpDueChecks = haccpDashboard?.due_checks ?? [];

  const [isClockingIn, setIsClockingIn] = useState(false);
  const [isClockingOut, setIsClockingOut] = useState(false);

  const isLoading =
    storeLoading ||
    shiftsLoading ||
    countsLoading ||
    inventoryLoading ||
    activityLoading ||
    lowStockLoading;

  // Memoized data
  const todayCountCompleted = useMemo(
    () => dailyCounts?.some((c) => c.count_date === today) ?? false,
    [dailyCounts, today],
  );

  const storeLowStockItems = storeLowStock ?? [];

  const outOfStockCount = useMemo(
    () =>
      storeLowStockItems.filter((item) => item.current_quantity === 0).length,
    [storeLowStockItems],
  );

  const myTodayShift = todayShifts[0];

  const recentActivityItems = useMemo(
    () =>
      (recentActivity ?? [])
        .filter((a) => a.performed_by === user?.id)
        .slice(0, 6),
    [recentActivity, user?.id],
  );

  // Get first name for greeting
  const firstName = user?.email?.split("@")[0] || "there";
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div>
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48 mt-2" />
        </div>
        <Skeleton className="h-24" />
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  if (!storeId || !currentStore) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{greeting}!</h1>
          <p className="text-muted-foreground">
            Please select a store from the sidebar to get started.
          </p>
        </div>
      </div>
    );
  }

  const hasUrgentIssues =
    !todayCountCompleted || outOfStockCount > 0 || haccpDueChecks.length > 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {greeting}, {firstName}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {store?.name} &middot; {format(new Date(), "EEEE, MMMM d, yyyy")}
          </p>
        </div>
        <PageGuide pageKey="dashboard" />
      </div>

      {/* URGENT ALERTS */}
      {hasUrgentIssues && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <h2 className="text-lg font-semibold">Needs Your Attention</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {!todayCountCompleted && (
              <Card className="border-amber-500/40 bg-amber-500/10">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <ClipboardList className="h-5 w-5 text-amber-400" />
                    <CardTitle className="text-base font-semibold text-amber-800">
                      Stock Count Pending
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-amber-400 mb-3">
                    Today&apos;s stock count hasn&apos;t been done yet.
                  </p>
                  <Link href="/stock-count">
                    <Button
                      size="sm"
                      className="w-full bg-amber-600 hover:bg-amber-700"
                    >
                      Do Stock Count Now
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}
            {outOfStockCount > 0 && (
              <Card className="border-destructive/40 bg-destructive/5">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-5 w-5 text-destructive" />
                    <CardTitle className="text-base font-semibold text-destructive">
                      {outOfStockCount} Item{outOfStockCount !== 1 ? "s" : ""}{" "}
                      Out of Stock
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1 text-sm text-destructive/80">
                    {storeLowStockItems
                      .filter((i) => i.current_quantity === 0)
                      .slice(0, 3)
                      .map((item) => (
                        <div
                          key={item.inventory_item_id}
                          className="flex items-center gap-2"
                        >
                          <div className="h-1.5 w-1.5 rounded-full bg-destructive" />
                          <span>{item.item_name}</span>
                        </div>
                      ))}
                    {outOfStockCount > 3 && (
                      <p className="text-xs text-destructive/80 mt-1">
                        +{outOfStockCount - 3} more
                      </p>
                    )}
                  </div>
                  <Link href="/low-stock">
                    <Button
                      size="sm"
                      variant="destructive"
                      className="w-full mt-3"
                    >
                      View All Low Stock
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}

            {/* HACCP Due Checks Alert */}
            {haccpDueChecks.length > 0 && (
              <Card className="border-amber-500/40 bg-amber-500/10">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-amber-400" />
                    <CardTitle className="text-base font-semibold text-amber-800">
                      {haccpDueChecks.length} Food Safety Check
                      {haccpDueChecks.length !== 1 ? "s" : ""} Due
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-amber-400 space-y-1">
                    {haccpDueChecks.slice(0, 3).map((check) => (
                      <div key={check.id} className="flex items-center gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-amber-600" />
                        <span>{check.name}</span>
                        <span className="text-xs text-amber-400 capitalize">
                          ({check.frequency})
                        </span>
                      </div>
                    ))}
                    {haccpDueChecks.length > 3 && (
                      <p className="text-xs text-amber-400/80 mt-1">
                        +{haccpDueChecks.length - 3} more
                      </p>
                    )}
                  </div>
                  <Link href="/haccp/checks">
                    <Button
                      size="sm"
                      className="w-full mt-3 bg-amber-600 hover:bg-amber-700"
                    >
                      Run Checks Now
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* TODAY'S SHIFT */}
      <Card className="bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base font-semibold">
              Today&apos;s Shift
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {myTodayShift ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-semibold">
                  {format(new Date(myTodayShift.start_time), "h:mm a")} &ndash;{" "}
                  {format(new Date(myTodayShift.end_time), "h:mm a")}
                </p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {myTodayShift.clock_in_time
                    ? `Clocked in ${formatDistanceToNow(new Date(myTodayShift.clock_in_time), { addSuffix: true })}`
                    : "Not yet clocked in"}
                </p>
              </div>
              <div>
                {myTodayShift.clock_in_time && !myTodayShift.clock_out_time ? (
                  <Button
                    variant="outline"
                    onClick={async () => {
                      setIsClockingOut(true);
                      try {
                        await clockOut(myTodayShift.id);
                      } finally {
                        setIsClockingOut(false);
                      }
                    }}
                    disabled={isClockingOut}
                  >
                    <Clock className="h-4 w-4 mr-2" />
                    Clock Out
                  </Button>
                ) : !myTodayShift.clock_in_time ? (
                  <Button
                    onClick={async () => {
                      setIsClockingIn(true);
                      try {
                        await clockIn(myTodayShift.id);
                      } finally {
                        setIsClockingIn(false);
                      }
                    }}
                    disabled={isClockingIn}
                  >
                    <Clock className="h-4 w-4 mr-2" />
                    Clock In
                  </Button>
                ) : (
                  <Badge className="bg-emerald-500/10 text-emerald-400">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Shift Complete
                  </Badge>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 text-muted-foreground">
              <Clock className="h-5 w-5" />
              <p className="text-sm">No shift scheduled for today</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* SUMMARY CARDS */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <Link href="/stock-count">
          <StatsCard
            title="Stock Count"
            value={todayCountCompleted ? "Done" : "Pending"}
            description={
              todayCountCompleted ? "Completed today" : "Not yet submitted"
            }
            icon={
              todayCountCompleted ? (
                <CheckCircle className="h-4 w-4 text-emerald-500" />
              ) : (
                <ClipboardList className="h-4 w-4" />
              )
            }
            variant={todayCountCompleted ? "success" : "warning"}
            className="hover:border-primary/50 transition-colors cursor-pointer bg-card"
          />
        </Link>
        <Link href="/low-stock">
          <StatsCard
            title="Low Stock"
            value={storeLowStockItems.length}
            description="Items below PAR"
            icon={<TrendingDown className="h-4 w-4" />}
            variant={storeLowStockItems.length > 0 ? "warning" : "default"}
            className="hover:border-primary/50 transition-colors cursor-pointer bg-card"
          />
        </Link>
        <StatsCard
          title="Out of Stock"
          value={outOfStockCount}
          description={outOfStockCount > 0 ? "Need restock" : "All stocked"}
          icon={<XCircle className="h-4 w-4" />}
          variant={outOfStockCount > 0 ? "danger" : "default"}
          className="bg-card"
        />
        <StatsCard
          title="Items Tracked"
          value={
            lowStockItems.length > 0
              ? lowStockItems.length + storeLowStockItems.length
              : "—"
          }
          description="In this store"
          icon={<Package className="h-4 w-4" />}
          className="bg-card"
        />
      </div>

      {/* QUICK ACTIONS */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Quick Actions</h2>
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
          <Link href="/stock-count">
            {!todayCountCompleted ? (
              <Card className="group h-full py-4 gap-2 transition-all hover:shadow-md border-primary bg-primary/5 hover:bg-primary/10">
                <CardContent className="flex flex-col items-center text-center gap-2">
                  <div className="rounded-full p-2.5 bg-primary text-primary-foreground">
                    <ClipboardList className="h-5 w-5" />
                  </div>
                  <span className="text-sm font-medium">Do Stock Count</span>
                </CardContent>
              </Card>
            ) : (
              <Card className="group h-full py-4 gap-2 transition-all hover:shadow-md hover:border-primary/30">
                <CardContent className="flex flex-col items-center text-center gap-2">
                  <div className="rounded-full p-2.5 bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                    <ClipboardList className="h-5 w-5" />
                  </div>
                  <span className="text-sm font-medium">Update Count</span>
                </CardContent>
              </Card>
            )}
          </Link>
          <Link href="/waste">
            <Card className="group h-full py-4 gap-2 transition-all hover:shadow-md hover:border-primary/30">
              <CardContent className="flex flex-col items-center text-center gap-2">
                <div className="rounded-full p-2.5 bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                  <Trash2 className="h-5 w-5" />
                </div>
                <span className="text-sm font-medium">Log Waste</span>
              </CardContent>
            </Card>
          </Link>
          <Link href="/low-stock">
            <Card className="group h-full py-4 gap-2 transition-all hover:shadow-md hover:border-primary/30">
              <CardContent className="flex flex-col items-center text-center gap-2">
                <div className="rounded-full p-2.5 bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <span className="text-sm font-medium">View Low Stock</span>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>

      {/* BOTTOM SECTION: Low Stock Items + Recent Activity */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Low Stock Items */}
        <Card className="bg-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <CardTitle className="text-base">Low Stock Items</CardTitle>
              </div>
              <Link href="/low-stock">
                <Button variant="ghost" size="sm" className="h-8 text-xs">
                  View All
                  <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {storeLowStockItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <CheckCircle className="h-6 w-6 text-emerald-500/50 mb-2" />
                <p className="text-sm text-muted-foreground">
                  All items above PAR level
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {storeLowStockItems.slice(0, 6).map((item) => (
                  <div
                    key={item.inventory_item_id}
                    className="flex items-center justify-between py-2 border-b last:border-0"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {item.item_name}
                      </p>
                    </div>
                    <Badge
                      variant={
                        item.current_quantity === 0 ? "destructive" : "outline"
                      }
                      className={
                        item.current_quantity > 0
                          ? "border-amber-500/40 text-amber-400"
                          : ""
                      }
                    >
                      {item.current_quantity} / {item.par_level}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="bg-card">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">My Activity Today</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {recentActivityItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <Clock className="h-6 w-6 text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">
                  No activity recorded yet today
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentActivityItems.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-center justify-between py-2 border-b last:border-0"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Badge
                        variant={
                          activity.action_type === "Reception"
                            ? "secondary"
                            : "default"
                        }
                        className="w-16 justify-center text-xs shrink-0"
                      >
                        {activity.action_type === "Reception" ? "In" : "Count"}
                      </Badge>
                      <p className="text-sm font-medium truncate">
                        {activity.inventory_item?.name || "Unknown"}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p
                        className={`text-sm font-mono font-medium ${
                          activity.quantity_change &&
                          activity.quantity_change > 0
                            ? "text-emerald-400"
                            : activity.quantity_change &&
                                activity.quantity_change < 0
                              ? "text-destructive"
                              : ""
                        }`}
                      >
                        {activity.quantity_change &&
                        activity.quantity_change > 0
                          ? "+"
                          : ""}
                        {activity.quantity_change ?? 0}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(activity.created_at), "h:mm a")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
