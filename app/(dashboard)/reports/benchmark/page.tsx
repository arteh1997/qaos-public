"use client";

import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useBenchmark } from "@/hooks/useBenchmark";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import dynamic from "next/dynamic";
import { Skeleton as ChartSkeleton } from "@/components/ui/skeleton";

const StoreComparisonChart = dynamic(
  () =>
    import("@/components/charts/StoreComparisonChart").then((mod) => ({
      default: mod.StoreComparisonChart,
    })),
  { loading: () => <ChartSkeleton className="h-64 w-full" /> },
);
const StoreActivityTrendChart = dynamic(
  () =>
    import("@/components/charts/StoreComparisonChart").then((mod) => ({
      default: mod.StoreActivityTrendChart,
    })),
  { loading: () => <ChartSkeleton className="h-64 w-full" /> },
);
import {
  BarChart3,
  Trophy,
  Activity,
  Package,
  ClipboardCheck,
  Heart,
  Trash2,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { DateRange } from "react-day-picker";
import { PageGuide } from "@/components/help/PageGuide";
import { subDays, startOfDay } from "date-fns";

export default function BenchmarkPage() {
  const { stores, role } = useAuth();
  const [dateRange, setDateRange] = useState<DateRange>(() => ({
    from: subDays(new Date(), 29),
    to: new Date(),
  }));

  // Only Owners with multiple stores should see this
  const accessibleStores = useMemo(() => {
    return stores?.filter((s) => s.store?.is_active) ?? [];
  }, [stores]);

  const storeIds = useMemo(() => {
    return accessibleStores.map((s) => s.store_id);
  }, [accessibleStores]);

  const dateRangeParam = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return null;
    return {
      startDate: startOfDay(dateRange.from).toISOString(),
      endDate: (() => {
        const end = new Date(dateRange.to);
        end.setHours(23, 59, 59, 999);
        return end.toISOString();
      })(),
    };
  }, [dateRange]);

  const { data, isLoading, error } = useBenchmark(storeIds, 30, dateRangeParam);

  if (role !== "Owner" && role !== "Manager") {
    return (
      <div className="space-y-6">
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
          Store Benchmarking
        </h1>
        <p className="text-muted-foreground">
          Only Owners and Managers can access benchmarking analytics.
        </p>
      </div>
    );
  }

  if (accessibleStores.length < 2) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/reports">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
              Store Benchmarking
            </h1>
            <p className="text-sm text-muted-foreground">
              Compare performance across your stores
            </p>
          </div>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <h3 className="text-lg font-medium mb-1">
                Multi-store comparison requires 2+ stores
              </h3>
              <p className="text-sm text-muted-foreground">
                Add more stores to your account to unlock benchmarking
                analytics.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Link href="/reports">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight flex items-center gap-2">
              <div className="rounded-lg p-1.5 bg-blue-500/10">
                <BarChart3 className="h-5 w-5 text-blue-400" />
              </div>
              Store Benchmarking
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Compare performance across {accessibleStores.length} stores
            </p>
          </div>
          <PageGuide pageKey="benchmark" />
        </div>
        <DateRangePicker
          value={dateRange}
          onChange={(range) =>
            setDateRange(
              range || { from: subDays(new Date(), 29), to: new Date() },
            )
          }
          presets={[
            "last7days",
            "last14days",
            "last30days",
            "last60days",
            "last90days",
          ]}
          align="start"
        />
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">
              Failed to load benchmark data: {error.message}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Data loaded */}
      {data && (
        <>
          {/* KPI Summary Cards */}
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Avg Health
                </p>
                <p className="text-2xl font-bold mt-1">
                  {data.averages.healthScore}%
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  across {data.stores.length} stores
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Count Rate
                </p>
                <p className="text-2xl font-bold mt-1">
                  {data.averages.countCompletionRate}%
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  daily consistency
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Daily Activity
                </p>
                <p className="text-2xl font-bold mt-1">
                  {data.averages.avgDailyActivity}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  stock changes/day
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Avg Value
                </p>
                <p className="text-2xl font-bold mt-1">
                  £
                  {data.averages.totalValue.toLocaleString(undefined, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  })}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  per store average
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Rankings Table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Trophy className="h-4 w-4" />
                Store Rankings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 pr-4 font-medium">Store</th>
                      <th className="text-center py-2 px-3 font-medium">
                        <div className="flex flex-col items-center">
                          <Heart className="h-3.5 w-3.5 mb-0.5" />
                          <span>Health</span>
                        </div>
                      </th>
                      <th className="text-center py-2 px-3 font-medium">
                        <div className="flex flex-col items-center">
                          <ClipboardCheck className="h-3.5 w-3.5 mb-0.5" />
                          <span>Counts</span>
                        </div>
                      </th>
                      <th className="text-center py-2 px-3 font-medium">
                        <div className="flex flex-col items-center">
                          <Activity className="h-3.5 w-3.5 mb-0.5" />
                          <span>Activity</span>
                        </div>
                      </th>
                      <th className="text-center py-2 px-3 font-medium">
                        <div className="flex flex-col items-center">
                          <Package className="h-3.5 w-3.5 mb-0.5" />
                          <span>Items</span>
                        </div>
                      </th>
                      <th className="text-center py-2 px-3 font-medium">
                        <div className="flex flex-col items-center">
                          <Trash2 className="h-3.5 w-3.5 mb-0.5" />
                          <span>Waste</span>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.stores.map((store) => {
                      const healthRank = data.rankings.healthScore.find(
                        (r) => r.storeId === store.storeId,
                      );
                      const countRank = data.rankings.countCompletion.find(
                        (r) => r.storeId === store.storeId,
                      );
                      const activityRank = data.rankings.activity.find(
                        (r) => r.storeId === store.storeId,
                      );

                      return (
                        <tr
                          key={store.storeId}
                          className="border-b last:border-0"
                        >
                          <td className="py-2.5 pr-4">
                            <span className="font-medium">
                              {store.storeName}
                            </span>
                          </td>
                          <td className="text-center py-2.5 px-3">
                            <div className="flex flex-col items-center">
                              <RankBadge
                                rank={healthRank?.rank ?? 0}
                                total={data.stores.length}
                              />
                              <span className="text-xs text-muted-foreground mt-0.5">
                                {store.inventoryHealth.healthScore}%
                              </span>
                            </div>
                          </td>
                          <td className="text-center py-2.5 px-3">
                            <div className="flex flex-col items-center">
                              <RankBadge
                                rank={countRank?.rank ?? 0}
                                total={data.stores.length}
                              />
                              <span className="text-xs text-muted-foreground mt-0.5">
                                {store.countCompletionRate}%
                              </span>
                            </div>
                          </td>
                          <td className="text-center py-2.5 px-3">
                            <div className="flex flex-col items-center">
                              <RankBadge
                                rank={activityRank?.rank ?? 0}
                                total={data.stores.length}
                              />
                              <span className="text-xs text-muted-foreground mt-0.5">
                                {store.activity.totalActivity}
                              </span>
                            </div>
                          </td>
                          <td className="text-center py-2.5 px-3">
                            <span className="text-sm">
                              {store.inventoryHealth.totalItems}
                            </span>
                          </td>
                          <td className="text-center py-2.5 px-3">
                            <span className="text-sm">
                              {store.waste.totalUnits}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Comparison Charts */}
          <div className="grid gap-4 md:grid-cols-2">
            <StoreComparisonChart
              stores={data.stores}
              metric="healthScore"
              title="Inventory Health Score"
              unit="%"
              color="#16a34a"
            />
            <StoreComparisonChart
              stores={data.stores}
              metric="countCompletionRate"
              title="Count Completion Rate"
              unit="%"
              color="#2563eb"
            />
            <StoreComparisonChart
              stores={data.stores}
              metric="totalActivity"
              title="Total Stock Activity"
              color="#303030"
            />
            <StoreComparisonChart
              stores={data.stores}
              metric="totalValue"
              title="Inventory Value"
              unit=""
              color="#ea580c"
            />
          </div>

          {/* Activity Trend */}
          <StoreActivityTrendChart stores={data.stores} />

          {/* Per-Store Detail Cards */}
          <div>
            <h2 className="text-lg font-semibold mb-3">Store Details</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {data.stores.map((store) => (
                <Card key={store.storeId}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">
                      {store.storeName}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Health Score
                        </p>
                        <p className="font-medium">
                          {store.inventoryHealth.healthScore}%
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Count Rate
                        </p>
                        <p className="font-medium">
                          {store.countCompletionRate}%
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Items</p>
                        <p className="font-medium">
                          {store.inventoryHealth.totalItems}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Out of Stock
                        </p>
                        <p
                          className={`font-medium ${store.inventoryHealth.outOfStock > 0 ? "text-destructive" : ""}`}
                        >
                          {store.inventoryHealth.outOfStock}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Low Stock
                        </p>
                        <p
                          className={`font-medium ${store.inventoryHealth.lowStock > 0 ? "text-amber-400" : ""}`}
                        >
                          {store.inventoryHealth.lowStock}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Total Units
                        </p>
                        <p className="font-medium">
                          {store.inventory.totalUnits.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Inventory Value
                        </p>
                        <p className="font-medium">
                          £
                          {store.inventory.totalValue.toLocaleString(
                            undefined,
                            {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 0,
                            },
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Waste</p>
                        <p
                          className={`font-medium ${store.waste.totalUnits > 0 ? "text-destructive" : ""}`}
                        >
                          {store.waste.totalUnits} units
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function RankBadge({ rank, total }: { rank: number; total: number }) {
  if (rank === 0) return null;

  // Top performer
  if (rank === 1 && total > 1) {
    return (
      <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[10px] px-1.5">
        #{rank}
      </Badge>
    );
  }

  // Bottom performer
  if (rank === total && total > 1) {
    return (
      <Badge
        variant="outline"
        className="text-[10px] px-1.5 text-muted-foreground"
      >
        #{rank}
      </Badge>
    );
  }

  return (
    <Badge variant="secondary" className="text-[10px] px-1.5">
      #{rank}
    </Badge>
  );
}
