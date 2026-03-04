"use client";

import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useEarnings, usePayRuns } from "@/hooks/usePayroll";
import { PageHeader } from "@/components/ui/page-header";
import { PageGuide } from "@/components/help/PageGuide";
import { StatsCard } from "@/components/cards/StatsCard";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  PoundSterling,
  Clock,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Banknote,
} from "lucide-react";
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
} from "date-fns";
import type { PayRun, PayRunItem } from "@/types";

function formatCurrency(amount: number): string {
  return `\u00A3${amount.toFixed(2)}`;
}

function formatHours(hours: number): string {
  return `${hours.toFixed(1)}h`;
}

export default function MyPayPage() {
  const { currentStore, user } = useAuth();
  const storeId = currentStore?.store_id ?? null;

  const now = useMemo(() => new Date(), []);

  const weekStart = useMemo(
    () => format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd"),
    [now],
  );
  const weekEnd = useMemo(
    () => format(endOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd"),
    [now],
  );
  const monthStart = useMemo(
    () => format(startOfMonth(now), "yyyy-MM-dd"),
    [now],
  );
  const monthEnd = useMemo(() => format(endOfMonth(now), "yyyy-MM-dd"), [now]);

  const { data: weeklyData, isLoading: weeklyLoading } = useEarnings(
    storeId,
    weekStart,
    weekEnd,
  );

  const { data: monthlyData, isLoading: monthlyLoading } = useEarnings(
    storeId,
    monthStart,
    monthEnd,
  );

  const { data: payRuns, isLoading: payRunsLoading } = usePayRuns(storeId);

  const [expandedPayRun, setExpandedPayRun] = useState<string | null>(null);

  const isLoading = weeklyLoading || monthlyLoading || payRunsLoading;

  // For Staff, the API returns only their own data.
  // There will be at most one EarningsSummary entry.
  const weeklyEarnings = weeklyData?.earnings?.[0] ?? null;
  const monthlyEarnings = monthlyData?.earnings?.[0] ?? null;
  const hourlyRate =
    weeklyEarnings?.hourly_rate ?? monthlyEarnings?.hourly_rate ?? null;

  // Filter pay runs to only show ones that include this user's items
  const myPayRuns = useMemo(() => {
    if (!payRuns || !user) return [];
    return payRuns
      .filter((pr: PayRun) => pr.status === "paid")
      .map((pr: PayRun) => {
        const myItem = pr.items?.find(
          (item: PayRunItem) => item.user_id === user.id,
        );
        return myItem ? { ...pr, myItem } : null;
      })
      .filter(Boolean) as (PayRun & { myItem: PayRunItem })[];
  }, [payRuns, user]);

  if (!storeId) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="My Pay"
          description="View your earnings and payment history"
        >
          <PageGuide pageKey="my-pay" />
        </PageHeader>
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Please select a store to view your pay information.
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="My Pay"
          description="View your earnings and payment history"
        >
          <PageGuide pageKey="my-pay" />
        </PageHeader>
        <Skeleton className="h-64" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <Skeleton className="h-48" />
      </div>
    );
  }

  const togglePayRun = (id: string) => {
    setExpandedPayRun((prev) => (prev === id ? null : id));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Pay"
        description="View your earnings and payment history"
      >
        <PageGuide pageKey="my-pay" />
      </PageHeader>

      {/* Current Period Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <PoundSterling className="h-5 w-5" />
            This Week&apos;s Earnings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {hourlyRate === null ? (
            <div className="rounded-md bg-amber-500/10 border border-amber-500/50 px-4 py-3">
              <p className="text-sm text-amber-700 dark:text-amber-400">
                Your hourly rate hasn&apos;t been set yet. Please contact your
                manager.
              </p>
            </div>
          ) : weeklyEarnings && weeklyEarnings.shift_count > 0 ? (
            <>
              <div className="flex flex-wrap gap-6">
                <div>
                  <p className="text-sm text-muted-foreground">Hours Worked</p>
                  <p className="text-2xl font-semibold tracking-tight">
                    {formatHours(weeklyEarnings.total_hours)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Hourly Rate</p>
                  <p className="text-2xl font-semibold tracking-tight">
                    {formatCurrency(weeklyEarnings.hourly_rate!)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    Calculated Pay
                  </p>
                  <p className="text-2xl font-semibold tracking-tight text-emerald-600">
                    {formatCurrency(weeklyEarnings.gross_pay)}
                  </p>
                </div>
              </div>

              {/* Shift breakdown table */}
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Clock In</TableHead>
                      <TableHead>Clock Out</TableHead>
                      <TableHead className="text-right">Hours</TableHead>
                      <TableHead className="text-right">Pay</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {weeklyEarnings.shifts.map((shift) => (
                      <TableRow key={shift.shift_id}>
                        <TableCell>
                          {format(new Date(shift.date), "EEE, d MMM")}
                        </TableCell>
                        <TableCell>
                          {shift.clock_in
                            ? format(new Date(shift.clock_in), "h:mm a")
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {shift.clock_out
                            ? format(new Date(shift.clock_out), "h:mm a")
                            : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatHours(shift.hours)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(shift.pay)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground py-4">
              No completed shifts this week.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatsCard
          title="This Week"
          value={
            weeklyEarnings && weeklyEarnings.shift_count > 0
              ? formatCurrency(weeklyEarnings.gross_pay)
              : "\u00A30.00"
          }
          description={
            weeklyEarnings && weeklyEarnings.shift_count > 0
              ? `${formatHours(weeklyEarnings.total_hours)} worked`
              : "No shifts this week"
          }
          icon={<CalendarDays className="h-4 w-4" />}
        />
        <StatsCard
          title="This Month"
          value={
            monthlyEarnings && monthlyEarnings.shift_count > 0
              ? formatCurrency(monthlyEarnings.gross_pay)
              : "\u00A30.00"
          }
          description={
            monthlyEarnings && monthlyEarnings.shift_count > 0
              ? `${formatHours(monthlyEarnings.total_hours)} worked`
              : "No shifts this month"
          }
          icon={<Clock className="h-4 w-4" />}
        />
        <StatsCard
          title="Hourly Rate"
          value={hourlyRate !== null ? formatCurrency(hourlyRate) : "Not set"}
          description={
            hourlyRate !== null ? "Your current rate" : "Contact your manager"
          }
          icon={<PoundSterling className="h-4 w-4" />}
          variant={hourlyRate === null ? "warning" : "default"}
        />
      </div>

      {/* Payment History */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">
          Payment History
        </h2>

        {myPayRuns.length === 0 ? (
          <EmptyState
            icon={Banknote}
            title="No payments yet"
            description="Your payment history will appear here once your manager processes a pay run."
          />
        ) : (
          <div className="space-y-3">
            {myPayRuns.map((payRun) => {
              const isExpanded = expandedPayRun === payRun.id;
              const item = payRun.myItem;

              return (
                <Card key={payRun.id}>
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => togglePayRun(payRun.id)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base font-medium">
                          {format(new Date(payRun.period_start), "d MMM")} -{" "}
                          {format(new Date(payRun.period_end), "d MMM yyyy")}
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          <Badge className="border-transparent bg-emerald-50 text-emerald-700 hover:bg-emerald-100">
                            Paid
                          </Badge>
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pb-3">
                      <div className="flex flex-wrap gap-6 text-sm">
                        <div>
                          <span className="text-muted-foreground">Hours: </span>
                          <span className="font-medium">
                            {formatHours(item.total_hours)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Rate: </span>
                          <span className="font-medium">
                            {formatCurrency(item.hourly_rate)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">
                            Gross Pay:{" "}
                          </span>
                          <span className="font-medium text-emerald-600">
                            {formatCurrency(item.gross_pay)}
                          </span>
                        </div>
                        {payRun.paid_at && (
                          <div>
                            <span className="text-muted-foreground">
                              Paid:{" "}
                            </span>
                            <span className="font-medium">
                              {format(new Date(payRun.paid_at), "d MMM yyyy")}
                            </span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </button>

                  {isExpanded &&
                    item.shift_ids &&
                    item.shift_ids.length > 0 && (
                      <CardContent className="border-t pt-4">
                        <p className="text-sm text-muted-foreground mb-3">
                          Shift Breakdown
                        </p>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between text-muted-foreground">
                            <span>
                              Base Pay ({formatHours(item.total_hours)} x{" "}
                              {formatCurrency(item.hourly_rate)})
                            </span>
                            <span>
                              {formatCurrency(
                                item.total_hours * item.hourly_rate,
                              )}
                            </span>
                          </div>
                          {item.overtime_hours > 0 && (
                            <div className="flex justify-between text-muted-foreground">
                              <span>
                                Overtime ({formatHours(item.overtime_hours)})
                              </span>
                              <span>Included</span>
                            </div>
                          )}
                          {item.adjustments !== 0 && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                Adjustments
                                {item.adjustment_notes && (
                                  <span className="ml-1">
                                    ({item.adjustment_notes})
                                  </span>
                                )}
                              </span>
                              <span
                                className={
                                  item.adjustments > 0
                                    ? "text-emerald-600"
                                    : "text-destructive"
                                }
                              >
                                {item.adjustments > 0 ? "+" : ""}
                                {formatCurrency(item.adjustments)}
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between font-medium border-t pt-2">
                            <span>Total</span>
                            <span className="text-emerald-600">
                              {formatCurrency(item.gross_pay)}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground pt-1">
                            {item.shift_ids.length} shift
                            {item.shift_ids.length !== 1 ? "s" : ""} included in
                            this pay run
                          </p>
                        </div>
                      </CardContent>
                    )}

                  {isExpanded &&
                    (!item.shift_ids || item.shift_ids.length === 0) && (
                      <CardContent className="border-t pt-4">
                        <p className="text-sm text-muted-foreground">
                          No detailed shift breakdown available for this pay
                          run.
                        </p>
                      </CardContent>
                    )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
