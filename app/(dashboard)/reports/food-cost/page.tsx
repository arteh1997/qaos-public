"use client";

import { useState, useMemo } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DateRangePicker } from "@/components/ui/date-range-picker";
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
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  DollarSign,
  ChefHat,
  Minus,
} from "lucide-react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { DateRange } from "react-day-picker";
import { subDays, format } from "date-fns";
import type { FoodCostReport } from "@/types";
import { PageGuide } from "@/components/help/PageGuide";

function formatCurrency(amount: number, currency = "GBP"): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

function getVarianceBadge(pct: number) {
  if (pct <= -5)
    return (
      <Badge
        variant="outline"
        className="bg-green-500/10 text-green-400 border-green-500/20"
      >
        <TrendingDown className="h-3 w-3 mr-1" />
        Under by {Math.abs(pct).toFixed(1)}%
      </Badge>
    );
  if (pct <= 5)
    return (
      <Badge variant="outline" className="bg-muted text-gray-600 border-border">
        <Minus className="h-3 w-3 mr-1" />
        On target
      </Badge>
    );
  if (pct <= 15)
    return (
      <Badge
        variant="outline"
        className="bg-amber-500/10 text-amber-400 border-amber-500/20"
      >
        <TrendingUp className="h-3 w-3 mr-1" />
        Over by {pct.toFixed(1)}%
      </Badge>
    );
  return (
    <Badge
      variant="outline"
      className="bg-red-500/10 text-red-400 border-red-500/20"
    >
      <AlertTriangle className="h-3 w-3 mr-1" />
      Over by {pct.toFixed(1)}%
    </Badge>
  );
}

export default function FoodCostReportPage() {
  const { storeId } = useAuth();

  const [dateRange, setDateRange] = useState<DateRange>(() => ({
    from: subDays(new Date(), 6),
    to: new Date(),
  }));

  const startDate = dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : "";
  const endDate = dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : "";

  const {
    data: report,
    isLoading,
    error,
  } = useQuery<FoodCostReport>({
    queryKey: ["food-cost-report", storeId, startDate, endDate],
    queryFn: async () => {
      if (!storeId) throw new Error("No store selected");
      const res = await fetch(
        `/api/stores/${storeId}/reports/food-cost?startDate=${startDate}&endDate=${endDate}`,
      );
      if (!res.ok) throw new Error("Failed to load report");
      const json = await res.json();
      return json.data;
    },
    enabled: !!storeId && !!startDate && !!endDate,
  });

  const currency = "GBP"; // Will be dynamic with multi-currency (Feature 2)

  const summaryCards = useMemo(() => {
    if (!report) return null;
    const s = report.summary;

    return (
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Theoretical Cost</CardDescription>
            <CardTitle className="text-2xl">
              {formatCurrency(s.theoretical_cost, currency)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {s.theoretical_food_cost_pct}% of revenue
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Actual Cost (COGS)</CardDescription>
            <CardTitle className="text-2xl">
              {formatCurrency(s.actual_cost, currency)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {s.actual_food_cost_pct}% of revenue
            </p>
          </CardContent>
        </Card>

        <Card
          className={
            s.variance > 0 ? "border-amber-500/20" : "border-green-500/20"
          }
        >
          <CardHeader className="pb-2">
            <CardDescription>Variance</CardDescription>
            <CardTitle
              className={`text-2xl ${s.variance > 0 ? "text-amber-400" : "text-green-400"}`}
            >
              {s.variance > 0 ? "+" : ""}
              {formatCurrency(s.variance, currency)}
            </CardTitle>
          </CardHeader>
          <CardContent>{getVarianceBadge(s.variance_percentage)}</CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Revenue</CardDescription>
            <CardTitle className="text-2xl">
              {formatCurrency(s.total_revenue, currency)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Waste: {formatCurrency(s.waste_cost, currency)} | Unaccounted:{" "}
              {formatCurrency(s.unaccounted_variance, currency)}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }, [report, currency]);

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
              <ChefHat className="h-6 w-6 text-orange-400" />
              Food Cost Analysis
            </h1>
            <p className="text-sm text-muted-foreground">
              Actual vs theoretical food cost with variance breakdown
            </p>
          </div>
          <PageGuide pageKey="food-cost" />
        </div>
        <DateRangePicker
          value={dateRange}
          onChange={(range) =>
            setDateRange(
              range || { from: subDays(new Date(), 6), to: new Date() },
            )
          }
          presets={[
            "last7days",
            "last14days",
            "last30days",
            "last60days",
            "last90days",
            "thisWeek",
            "lastWeek",
            "thisMonth",
            "lastMonth",
          ]}
          align="start"
        />
      </div>

      {/* Loading / Error States */}
      {isLoading && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Calculating food cost analysis...
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-destructive">
          <CardContent className="py-12 text-center text-destructive">
            Failed to load food cost report. Please try again.
          </CardContent>
        </Card>
      )}

      {/* Report Data */}
      {report && (
        <>
          {/* Summary Cards */}
          {summaryCards}

          {/* Variance Breakdown */}
          {report.summary.variance !== 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Variance Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Total Variance
                    </span>
                    <span className="font-medium">
                      {formatCurrency(report.summary.variance, currency)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Attributable to Recorded Waste
                    </span>
                    <span className="font-medium text-amber-400">
                      {formatCurrency(report.summary.waste_cost, currency)}
                    </span>
                  </div>
                  <div className="border-t pt-3 flex items-center justify-between">
                    <span className="text-sm font-medium">
                      Unaccounted Variance
                    </span>
                    <span className="font-semibold text-red-400">
                      {formatCurrency(
                        report.summary.unaccounted_variance,
                        currency,
                      )}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Unaccounted variance may indicate: over-portioning,
                    theft/shrinkage, unrecorded waste, or inaccurate recipes.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Per-Item Breakdown Table */}
          {report.items.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Menu Item Breakdown</CardTitle>
                <CardDescription>
                  Theoretical cost based on recipe × POS sales
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Menu Item</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Units Sold</TableHead>
                        <TableHead className="text-right">Cost/Unit</TableHead>
                        <TableHead className="text-right">Total Cost</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                        <TableHead className="text-right">
                          Food Cost %
                        </TableHead>
                        <TableHead className="text-right">Waste</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.items.map((item) => (
                        <TableRow key={item.menu_item_id}>
                          <TableCell className="font-medium">
                            {item.name}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {item.category || "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            {item.units_sold}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(
                              item.theoretical_cost_per_unit,
                              currency,
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(
                              item.theoretical_cost_total,
                              currency,
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(item.revenue, currency)}
                          </TableCell>
                          <TableCell className="text-right">
                            <span
                              className={
                                item.food_cost_pct > 35
                                  ? "text-red-400 font-medium"
                                  : item.food_cost_pct > 30
                                    ? "text-amber-400"
                                    : "text-green-400"
                              }
                            >
                              {item.food_cost_pct}%
                            </span>
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {item.waste_attributed > 0
                              ? formatCurrency(item.waste_attributed, currency)
                              : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No menu items with recipes and POS sales found for this period.
                Make sure you have recipes linked to menu items and POS
                integration configured.
              </CardContent>
            </Card>
          )}

          {/* Category Summary */}
          {report.categories.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Category Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Items</TableHead>
                        <TableHead className="text-right">
                          Theoretical Cost
                        </TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                        <TableHead className="text-right">
                          Food Cost %
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.categories.map((cat) => (
                        <TableRow key={cat.category}>
                          <TableCell className="font-medium">
                            {cat.category}
                          </TableCell>
                          <TableCell className="text-right">
                            {cat.item_count}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(cat.theoretical_cost, currency)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(cat.revenue, currency)}
                          </TableCell>
                          <TableCell className="text-right">
                            <span
                              className={
                                cat.food_cost_pct > 35
                                  ? "text-red-400 font-medium"
                                  : cat.food_cost_pct > 30
                                    ? "text-amber-400"
                                    : "text-green-400"
                              }
                            >
                              {cat.food_cost_pct}%
                            </span>
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
    </div>
  );
}
